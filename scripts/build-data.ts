// Data pipeline entry point for the Ghost Script character dataset.
//
// Two public surfaces:
//   - buildDataset(opts): pure-ish orchestration. Reads the input files, runs
//     every parser, resolves each character's ghost prompt, merges each
//     character fail-slow, and returns a serialised JSON string plus the
//     prompt-review CSV content on success. It NEVER writes output, calls
//     process.exit, or prints to stdout/stderr. It returns { ok: false, errors }
//     for per-character failures: missing required fields, prompt-selection
//     failures, and out-of-range/unknown override errors. All other failure
//     modes (missing input files, invalid character list, invalid overrides
//     file, output integrity mismatch) throw a typed Error so main() can
//     report them.
//   - main(): resolves the real repo-root paths, calls buildDataset, reports to
//     stdout/stderr, and writes app/public/data/characters.json and
//     data/prompt-review.csv atomically on success. Runs only when the file is
//     executed directly (ESM guard).

import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
  BuildOptions,
  BuildResult,
  CharacterRecord,
  MissingFieldError,
  Prompt,
} from '../app/src/data/types';

import { parseCharacterList } from './lib/parse-character-list';
import { parseHanziWriterData } from './lib/parse-hanzi-writer-data';
import { parseMakeMeAHanzi } from './lib/parse-make-me-a-hanzi';
import { parseCcCedict } from './lib/parse-cc-cedict';
import type { CcCedictEntry } from './lib/parse-cc-cedict';
import { mergeCharacter } from './lib/merge';
import { serialiseDataset } from './lib/serialise';
import { parsePromptOverrides } from './lib/parse-prompt-overrides';
import type { PromptOverride } from './lib/prompt';
import { numberedToToneMarks, selectPrompt } from './lib/prompt';

/**
 * Builds the character dataset from the input paths.
 *
 * Steps:
 *   1. Verify every required input path exists (throws on missing input).
 *   2. Parse the character list (throws on list-validation errors).
 *   3. Parse the three raw datasets.
 *   4. Read and parse prompt overrides when a path is given and the file
 *      exists (throws on override-file validation errors). An absent path or
 *      absent file means no overrides.
 *   5. Fail-slow pass: process EVERY character, collecting MissingFieldError
 *      items for each failure (missing fields, out-of-range/unknown override,
 *      or no-usable-sense prompt failure) before deciding. On per-character
 *      success resolve the prompt and call mergeCharacter with it.
 *   6. If any errors exist, return { ok: false, errors } (no output).
 *   7. On full success, serialise, verify the record count equals the
 *      character-list length (throws on mismatch), compute the prompt-review
 *      CSV, and return { ok: true, output, promptReviewCsv }.
 *
 * Input-file errors, character-list validation errors, override-file
 * validation errors, and output integrity mismatches are surfaced as thrown
 * Errors. Per-character problems are represented as
 * { ok: false, errors: MissingFieldError[] }.
 *
 * This function never writes to disk; the caller (main) performs the atomic
 * writes of the returned strings.
 */
export async function buildDataset(opts: BuildOptions): Promise<BuildResult> {
  // 1. Validate that all required input paths exist. Missing input files are
  //    not representable as MissingFieldError, so they throw.
  const missingInputs: string[] = [];
  for (const path of [
    opts.characterListPath,
    opts.hanziWriterDataDir,
    opts.makeMeAHanziPath,
    opts.ccCedictPath,
  ]) {
    if (!existsSync(path)) {
      missingInputs.push(path);
    }
  }
  if (missingInputs.length > 0) {
    throw new Error(
      `Missing required input path(s):\n${missingInputs
        .map((p) => `  - ${p}`)
        .join('\n')}`,
    );
  }

  // 2. Read and parse the character list. Validation errors (not-cjk /
  //    duplicate) are input-validation failures, surfaced as a thrown Error.
  const characterListRaw = await readFile(opts.characterListPath, 'utf8');
  const listResult = parseCharacterList(characterListRaw);
  if (!listResult.ok) {
    const summary = listResult.errors
      .map(
        (e) => `  line ${e.line}: ${e.character || '(empty)'} — ${e.reason}`,
      )
      .join('\n');
    throw new Error(
      `character-list.txt failed validation (${listResult.errors.length} error(s)):\n${summary}`,
    );
  }
  const characters = listResult.characters;

  // 3. Parse the three raw datasets.
  const hanziWriter = parseHanziWriterData(opts.hanziWriterDataDir, characters);
  const makeMeAHanziRaw = await readFile(opts.makeMeAHanziPath, 'utf8');
  const makeMeAHanzi = parseMakeMeAHanzi(makeMeAHanziRaw);
  const ccCedictRaw = await readFile(opts.ccCedictPath, 'utf8');
  const ccCedict = parseCcCedict(ccCedictRaw);

  // 4. Read prompt overrides when provided and present. An absent path or
  //    missing file means an empty overrides map. A parse failure (shape /
  //    reviewer / duplicate) is an input-validation failure → throw.
  const overrides = await loadOverrides(opts.promptOverridesPath);

  // An override naming a character NOT in character-list.txt is an
  // unknown-character error. Collect those first (they have no per-character
  // slot in the main loop otherwise).
  const characterSet = new Set(characters);
  const unknownOverrideErrors: MissingFieldError[] = [];
  for (const override of overrides.values()) {
    if (!characterSet.has(override.character)) {
      unknownOverrideErrors.push({
        character: override.character,
        missingFields: [],
        overrideError: 'unknown-character',
      });
    }
  }

  // 5. Fail-slow pass: process EVERY character before deciding.
  const records = new Map<string, CharacterRecord>();
  const errors: MissingFieldError[] = [];

  for (const char of characters) {
    const cc = ccCedict.get(char);
    const override = overrides.get(char);

    // Detect missing required fields exactly as before, independent of prompt.
    const missingFields = detectMissingFields(
      hanziWriter.get(char),
      makeMeAHanzi.get(char),
      cc,
    );

    // Validate override indices against this character's parsed CC-CEDICT
    // entries. Only meaningful when the character actually has CC-CEDICT data.
    const overrideError = override
      ? validateOverrideRange(override, cc)
      : undefined;

    // Resolve the prompt. We only attempt selection when the override (if any)
    // is in range and CC-CEDICT data exists; otherwise the failures above
    // already capture the problem.
    let prompt: Prompt | undefined;
    let promptFailure: MissingFieldError['promptFailure'];
    if (cc !== undefined && overrideError === undefined) {
      const selection = selectPrompt(char, cc, override);
      if (selection.ok) {
        prompt = {
          meaning: selection.choice.meaning,
          pinyin: selection.choice.pinyin,
        };
      } else {
        promptFailure = selection.reason;
      }
    }

    if (
      missingFields.length > 0 ||
      overrideError !== undefined ||
      promptFailure !== undefined
    ) {
      const err: MissingFieldError = { character: char, missingFields };
      if (promptFailure !== undefined) {
        err.promptFailure = promptFailure;
      }
      if (overrideError !== undefined) {
        err.overrideError = overrideError;
      }
      errors.push(err);
      continue;
    }

    // Success: prompt is defined here (cc present, override in range, selection
    // ok). Assert for TypeScript and merge.
    const merged = mergeCharacter(
      char,
      hanziWriter.get(char),
      makeMeAHanzi.get(char),
      cc,
      prompt as Prompt,
    );
    if (merged.ok) {
      records.set(char, merged.record);
    } else {
      // Should not happen (missingFields already checked), but stay fail-slow.
      errors.push({ character: char, missingFields: merged.missingFields });
    }
  }

  // 6. Any per-character error aborts: return without writing output. Unknown
  //    override errors are appended after the in-list errors; in-list errors
  //    are already in character-list order (the loop preserves it).
  const allErrors = [...errors, ...unknownOverrideErrors];
  if (allErrors.length > 0) {
    return { ok: false, errors: allErrors };
  }

  // 7. Serialise and verify the output record count matches the list length.
  const output = serialiseDataset(records);
  if (records.size !== characters.length) {
    throw new Error(
      `Output integrity check failed: serialised ${records.size} record(s) ` +
        `but character-list.txt has ${characters.length} character(s).`,
    );
  }

  // Compute the prompt-review CSV in character-list order.
  const promptReviewCsv = buildPromptReviewCsv(characters, ccCedict, overrides);

  return { ok: true, output, promptReviewCsv };
}

/**
 * Read and parse the prompt-overrides CSV. Returns an empty map when the path
 * is undefined or the file does not exist. Throws an Error summarising every
 * override error when the file fails shape/validation checks.
 */
async function loadOverrides(
  promptOverridesPath: string | undefined,
): Promise<Map<string, PromptOverride>> {
  if (promptOverridesPath === undefined || !existsSync(promptOverridesPath)) {
    return new Map<string, PromptOverride>();
  }
  const raw = await readFile(promptOverridesPath, 'utf8');
  const result = parsePromptOverrides(raw);
  if (!result.ok) {
    const summary = result.errors
      .map(
        (e) => `  line ${e.line}: ${e.character || '(empty)'} — ${e.reason}`,
      )
      .join('\n');
    throw new Error(
      `prompt-overrides.csv failed validation (${result.errors.length} error(s)):\n${summary}`,
    );
  }
  return result.overrides;
}

/**
 * Detect missing required fields for a character, mirroring mergeCharacter's
 * rules so the build can decide per character without a prompt in hand. Stable
 * order: pinyin, meanings, strokeCount, strokeData, decomposition.
 */
function detectMissingFields(
  hanziWriter: ReturnType<ReturnType<typeof parseHanziWriterData>['get']>,
  makeMeAHanzi: ReturnType<ReturnType<typeof parseMakeMeAHanzi>['get']>,
  ccCedict: CcCedictEntry | undefined,
): MissingFieldError['missingFields'] {
  const missing: MissingFieldError['missingFields'] = [];
  const hasPinyin = ccCedict !== undefined && ccCedict.pinyin.length > 0;
  const hasMeanings = ccCedict !== undefined && ccCedict.meanings.length > 0;
  const hasStrokes =
    hanziWriter !== undefined && hanziWriter.strokes.length > 0;
  const hasDecomposition = makeMeAHanzi !== undefined;

  if (!hasPinyin) {
    missing.push('pinyin');
  }
  if (!hasMeanings) {
    missing.push('meanings');
  }
  if (!hasStrokes) {
    missing.push('strokeCount');
    missing.push('strokeData');
  }
  if (!hasDecomposition) {
    missing.push('decomposition');
  }
  return missing;
}

/**
 * Validate an override's indices against a character's parsed CC-CEDICT data.
 * Returns the offending-range reason, or undefined when both indices are in
 * range. A character with no CC-CEDICT data is reported via missing-fields
 * elsewhere; here we treat an absent entry list as entry-index-out-of-range.
 */
function validateOverrideRange(
  override: PromptOverride,
  ccCedict: CcCedictEntry | undefined,
): MissingFieldError['overrideError'] {
  const entries = ccCedict?.entries ?? [];
  if (override.entryIndex < 0 || override.entryIndex >= entries.length) {
    return 'entry-index-out-of-range';
  }
  const entry = entries[override.entryIndex];
  if (
    override.meaningIndex < 0 ||
    override.meaningIndex >= entry.meanings.length
  ) {
    return 'meaning-index-out-of-range';
  }
  return undefined;
}

// --- prompt-review.csv -----------------------------------------------------

const REVIEW_HEADER =
  'character,chosenMeaning,chosenPinyin,source,reviewedBy,alternatives';

/**
 * Build the deterministic prompt-review CSV content. Lists every character in
 * CHARACTER-LIST ORDER with the chosen meaning/pinyin, whether the choice came
 * from an override or the default rule, the reviewer (for overrides), and every
 * alternative sense grouped by CC-CEDICT entry.
 *
 * Columns: character,chosenMeaning,chosenPinyin,source,reviewedBy,alternatives
 *
 * Every character in the list is guaranteed to have been built successfully
 * (this runs only on full success), so prompt selection always yields a choice.
 */
function buildPromptReviewCsv(
  characters: string[],
  ccCedict: Map<string, CcCedictEntry>,
  overrides: Map<string, PromptOverride>,
): string {
  const rows: string[] = [REVIEW_HEADER];

  for (const char of characters) {
    // Guaranteed present on success; assert for TypeScript.
    const cc = ccCedict.get(char) as CcCedictEntry;
    const override = overrides.get(char);
    const selection = selectPrompt(char, cc, override);
    // Guaranteed ok on a successful build.
    if (!selection.ok) {
      // Defensive: should never occur; emit an explicit marker rather than
      // throwing, to keep the review artefact deterministic.
      rows.push(
        [char, '', '', 'default', '', buildAlternatives(cc)]
          .map(csvField)
          .join(','),
      );
      continue;
    }

    const choice = selection.choice;
    const source = choice.fromOverride ? 'override' : 'default';
    const reviewedBy = choice.fromOverride ? (override?.reviewedBy ?? '') : '';

    rows.push(
      [
        char,
        choice.meaning,
        choice.pinyin,
        source,
        reviewedBy,
        buildAlternatives(cc),
      ]
        .map(csvField)
        .join(','),
    );
  }

  return rows.join('\n') + '\n';
}

/**
 * Render every CC-CEDICT sense of a character grouped by entry into a single
 * cell. Each group is `entry<N> (<tone-mark reading>): gloss1 | gloss2`, and
 * groups are joined by ` ;; `. Example:
 *   entry0 (sān): three | 3 ;; entry1 (San1): surname San
 */
function buildAlternatives(cc: CcCedictEntry): string {
  const groups = cc.entries.map((entry, index) => {
    const reading = numberedToToneMarks(entry.reading);
    const glosses = entry.meanings.join(' | ');
    return `entry${index} (${reading}): ${glosses}`;
  });
  return groups.join(' ;; ');
}

/**
 * RFC-4180 quote a single CSV field. Wraps the value in double quotes and
 * doubles any embedded quote when the value contains a comma, double quote, or
 * newline; otherwise returns it unchanged.
 */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Absolute path to the repository root, resolved from this file's location. */
function repoRoot(): string {
  // This file lives at <repo>/scripts/build-data.ts, so the repo root is one
  // directory up from the script's directory.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..');
}

/**
 * CLI entry point. Resolves the hardcoded repo-root paths, runs buildDataset,
 * reports progress, and writes the output atomically on success. Never throws:
 * all failure modes set process.exitCode = 1 and return.
 */
async function main(): Promise<void> {
  const root = repoRoot();
  const opts: BuildOptions = {
    characterListPath: join(root, 'data/character-list.txt'),
    hanziWriterDataDir: join(root, 'data/raw/hanzi-writer-data'),
    makeMeAHanziPath: join(root, 'data/raw/make-me-a-hanzi/dictionary.txt'),
    ccCedictPath: join(root, 'data/raw/cc-cedict/cedict_ts.u8'),
    promptOverridesPath: join(root, 'data/prompt-overrides.csv'),
    promptReviewPath: join(root, 'data/prompt-review.csv'),
  };

  let result: BuildResult;
  try {
    result = await buildDataset(opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
    return;
  }

  if (!result.ok) {
    const lines = result.errors.map((e) => formatError(e));
    process.stderr.write(
      `${result.errors.length} character(s) could not be built:\n`,
    );
    process.stderr.write(`${lines.join('\n')}\n`);
    process.stderr.write(`\nNo output written.\n`);
    process.exitCode = 1;
    return;
  }

  // Success: write both artefacts atomically (temp file + rename).
  const outputPath = join(root, 'app/public/data/characters.json');
  await atomicWrite(outputPath, result.output);

  const reviewPath =
    opts.promptReviewPath ?? join(root, 'data/prompt-review.csv');
  await atomicWrite(reviewPath, result.promptReviewCsv);

  const count = Object.keys(JSON.parse(result.output) as object).length;
  process.stdout.write(
    `Built ${count} character(s) → ${outputPath}\n` +
      `All required fields (pinyin, meanings, strokeCount, strokeData, decomposition) and prompt are non-null.\n` +
      `Wrote prompt review → ${reviewPath}\n`,
  );
}

/** Atomically write `content` to `path` via a temp file + rename. */
async function atomicWrite(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, content, 'utf8');
  await rename(tmpPath, path);
}

/** Format one per-character failure for the stderr report. */
function formatError(e: MissingFieldError): string {
  const parts: string[] = [];
  if (e.missingFields.length > 0) {
    parts.push(`missing: ${e.missingFields.join(', ')}`);
  }
  if (e.overrideError !== undefined) {
    parts.push(`override: ${e.overrideError}`);
  }
  if (e.promptFailure !== undefined) {
    parts.push(`prompt: ${e.promptFailure}`);
  }
  return `${e.character}: ${parts.join('; ')}`;
}

// ESM-safe execution guard: run main() only when this file is executed
// directly (e.g. `tsx scripts/build-data.ts`), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
