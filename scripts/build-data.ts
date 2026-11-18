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
import { basename, dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
  BuildOptions,
  BuildResult,
  CangjieError,
  CharacterRecord,
  Level,
  LevelManifest,
  MissingFieldError,
  Prompt,
  RuleChange,
  PromptOverrideFailure,
  SummonInkClass,
} from '../app/src/data/types';

import { isPlayableInCangjie, isValidCangjieCode } from '../app/src/engine/cangjieRules';
import { parseUnihanCangjie } from './lib/parse-unihan';
import { LEGEND_SOURCE } from '../app/src/data/citations';
import {
  buildLegendStrokes,
  legendCharacters,
  serialiseLegendStrokes,
} from './lib/legend-strokes';
import {
  Sha256MismatchError,
  readRecordedSha256,
  verifyFileSha256,
} from './lib/verify-sha256';
import { parseCharacterList } from './lib/parse-character-list';
import { parseHanziWriterData } from './lib/parse-hanzi-writer-data';
import { parseMakeMeAHanzi } from './lib/parse-make-me-a-hanzi';
import { parseCcCedict } from './lib/parse-cc-cedict';
import { checkClueCorrections } from './lib/clue-corrections';
import type { CcCedictEntry } from './lib/parse-cc-cedict';
import { mergeCharacter } from './lib/merge';
import { serialiseDataset } from './lib/serialise';
import { renderRuleChangesCsv } from './lib/rule-changes';
import { parsePromptOverrides } from './lib/parse-prompt-overrides';
import { parsePromptApprovals } from './lib/parse-prompt-approvals';
import {
  LEVELS,
  LEVEL_FILES,
  buildManifest,
  formatFileReport,
  serialiseManifest,
} from './lib/levels';
import {
  buildReviewSample,
  buildSampleProvenance,
  serialiseSampleProvenance,
} from './lib/review-sample';
import {
  computePromptCounts,
  renderCountsModule,
  renderReadmeBlock,
  replaceReadmeBlock,
} from './lib/prompt-counts';
import type { PromptCounts } from './lib/prompt-counts';
import type { PromptOverride, PromptSelectionResult } from './lib/prompt';
import { numberedToToneMarks, selectPrompt } from './lib/prompt';
import { parseHskExamples } from './lib/parse-hsk-examples';
import { containsHan, selectPromptByExamples } from './lib/select-prompt-by-examples';
import { cleanupMeaning } from '../app/src/engine/promptCleanup';

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
    opts.unihanPath,
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

  // Verify the Unihan file's SHA-256 BEFORE reading its contents, then parse.
  await verifyFileSha256(opts.unihanPath, opts.unihanSha256);
  const unihanRaw = await readFile(opts.unihanPath, 'utf8');
  const unihan = parseUnihanCangjie(unihanRaw);

  // 4. Read prompt overrides when provided and present. An absent path or
  //    missing file means an empty overrides map. A parse failure (shape /
  //    reviewer / duplicate) is an input-validation failure → throw.
  const isLaterLevel = opts.level === 2 || opts.level === 3;
  const overrides = await loadOverrides(
    opts.promptOverridesPath,
    isLaterLevel,
  );
  // Exact-match guard for the approved clue corrections; throws before any
  // file is written (this function never writes).
  const clueFailures = checkClueCorrections(
    opts.level ?? 1,
    new Set(characters),
    ccCedict,
    overrides,
  );
  if (clueFailures.length > 0) {
    throw new Error(
      `clue corrections failed (${clueFailures.length}):\n${clueFailures
        .map((f) => `  - ${f}`)
        .join('\n')}`,
    );
  }
  // Approvals only matter at level 2 and 3 (absent file means none).
  const approvals = isLaterLevel
    ? await loadApprovals(opts.promptApprovalsPath)
    : new Set<string>();

  // The Clue_Rule needs the HSK example words; only levels 2 and 3 read them.
  const examples =
    isLaterLevel && opts.hskCharsPath !== undefined
      ? parseHskExamples(await readFile(opts.hskCharsPath, 'utf8'))
      : undefined;
  const promptContext: PromptContext = { examples, ccCedict, approvals };

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
  const cangjieErrors: CangjieError[] = [];
  const cangjieMissing: string[] = [];
  const notPlayable: string[] = [];
  const ruleChanges: RuleChange[] = [];

  for (const char of characters) {
    // Cangjie: verbatim Unihan value, validated, never derived (fail-slow).
    const cangjieValues = unihan.get(char) ?? [];
    let cangjie: string | null = null;
    if (cangjieValues.length > 1) {
      cangjieErrors.push({
        character: char,
        values: [...cangjieValues],
        reason: 'multiple-values',
      });
    } else if (cangjieValues.length === 1) {
      const value = cangjieValues[0] as string;
      if (isValidCangjieCode(value)) {
        cangjie = value;
      } else {
        cangjieErrors.push({
          character: char,
          values: [value],
          reason: 'invalid-format',
        });
      }
    }
    const cangjieFailed = cangjieErrors.some((e) => e.character === char);
    if (!cangjieFailed) {
      if (cangjie === null) {
        cangjieMissing.push(char);
      }
      if (!isPlayableInCangjie(cangjie)) {
        notPlayable.push(char);
      }
    }

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
      const selection = choosePrompt(char, cc, override, promptContext);
      if (selection.ok) {
        prompt = {
          meaning: selection.choice.meaning,
          pinyin: selection.choice.pinyin,
        };
        // Gate (levels 2 and 3, also for an override): the cleaned meaning,
        // not masked, must have no Han character.
        if (isLaterLevel && containsHan(cleanupMeaning(prompt.meaning))) {
          prompt = undefined;
          promptFailure = 'chinese-in-meaning';
        } else if (isLaterLevel && override === undefined) {
          // Rule change: the Clue_Rule's prompt against the Current_Rule's.
          const current = selectPrompt(char, cc, undefined);
          if (
            current.ok &&
            (current.choice.pinyin !== prompt.pinyin ||
              current.choice.meaning !== prompt.meaning)
          ) {
            ruleChanges.push({
              character: char,
              level: opts.level as 2 | 3,
              oldPinyin: current.choice.pinyin,
              oldMeaning: current.choice.meaning,
              newPinyin: prompt.pinyin,
              newMeaning: prompt.meaning,
            });
          }
        }
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
        if (promptFailure === 'chinese-in-meaning' && opts.level !== undefined) {
          err.level = opts.level;
        }
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
      cangjie,
    );
    if (merged.ok) {
      records.set(
        char,
        isLaterLevel
          ? {
              ...merged.record,
              promptReview:
                override !== undefined || approvals.has(char)
                  ? 'reviewed'
                  : 'unreviewed',
            }
          : merged.record,
      );
    } else {
      // Should not happen (missingFields already checked), but stay fail-slow.
      errors.push({ character: char, missingFields: merged.missingFields });
    }
  }

  // 6. Any per-character error aborts: return without writing output. Unknown
  //    override errors are appended after the in-list errors; in-list errors
  //    are already in character-list order (the loop preserves it).
  const allErrors = [...errors, ...unknownOverrideErrors];
  if (allErrors.length > 0 || cangjieErrors.length > 0) {
    return { ok: false, errors: allErrors, cangjieErrors };
  }

  // 7. Serialise and verify the output record count matches the list length.
  const output = serialiseDataset(records, { minify: isLaterLevel });
  if (records.size !== characters.length) {
    throw new Error(
      `Output integrity check failed: serialised ${records.size} record(s) ` +
        `but character-list.txt has ${characters.length} character(s).`,
    );
  }

  // Compute the prompt-review CSV in character-list order.
  const promptReviewCsv = buildPromptReviewCsv(
    characters,
    overrides,
    promptContext,
  );

  const summonInkCounts: Record<SummonInkClass, number> = {
    transparent: 0,
    partial: 0,
    opaque: 0,
  };
  for (const record of records.values()) {
    summonInkCounts[record.summonInk.class] += 1;
  }

  return {
    ok: true,
    output,
    promptReviewCsv,
    ruleChanges,
    cangjieMissing,
    notPlayable,
    summonInkCounts,
  };
}

/**
 * Read and parse the prompt-overrides CSV. Returns an empty map when the path
 * is undefined or the file does not exist. Throws an Error summarising every
 * override error when the file fails shape/validation checks.
 */
async function loadOverrides(
  promptOverridesPath: string | undefined,
  requireHuman = false,
): Promise<Map<string, PromptOverride>> {
  if (promptOverridesPath === undefined || !existsSync(promptOverridesPath)) {
    return new Map<string, PromptOverride>();
  }
  const raw = await readFile(promptOverridesPath, 'utf8');
  const result = requireHuman
    ? parsePromptOverrides(raw, { requiredReviewer: 'human' })
    : parsePromptOverrides(raw);
  if (!result.ok) {
    const summary = result.errors
      .map(
        (e) => `  line ${e.line}: ${e.character || '(empty)'} — ${e.reason}`,
      )
      .join('\n');
    throw new Error(
      `${requireHuman ? basename(promptOverridesPath) : 'prompt-overrides.csv'} failed validation (${result.errors.length} error(s)):\n${summary}`,
    );
  }
  return result.overrides;
}

/**
 * Read and parse the shared prompt-approvals CSV. An absent path or file means
 * no approvals. A parse failure throws an Error naming every bad row.
 */
async function loadApprovals(
  promptApprovalsPath: string | undefined,
): Promise<Set<string>> {
  if (promptApprovalsPath === undefined || !existsSync(promptApprovalsPath)) {
    return new Set<string>();
  }
  const raw = await readFile(promptApprovalsPath, 'utf8');
  const result = parsePromptApprovals(raw);
  if (!result.ok) {
    const summary = result.errors
      .map(
        (e) => `  line ${e.line}: ${e.character || '(empty)'} — ${e.reason}`,
      )
      .join('\n');
    throw new Error(
      `${basename(promptApprovalsPath)} failed validation (${result.errors.length} error(s)):\n${summary}`,
    );
  }
  return result.approvals;
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

// --- prompt choice ---------------------------------------------------------

/** What choosePrompt needs besides the character. */
interface PromptContext {
  /** HSK example words per character; set only for levels 2 and 3 with a CSV path. */
  examples: ReadonlyMap<string, string[]> | undefined;
  ccCedict: ReadonlyMap<string, CcCedictEntry>;
  /** Characters with an approval row (level 2 and 3). */
  approvals: ReadonlySet<string>;
}

/**
 * The one place that picks a prompt, used by the character loop and by the
 * Review_File writer so they cannot disagree. An override wins; otherwise the
 * Clue_Rule runs when example words are available; otherwise the Current_Rule.
 * An approval never changes the prompt (Requirement 19); it only marks it
 * reviewed, outside this function.
 */
function choosePrompt(
  char: string,
  cc: CcCedictEntry,
  override: PromptOverride | undefined,
  ctx: PromptContext,
): PromptSelectionResult {
  if (override !== undefined) {
    return selectPrompt(char, cc, override);
  }
  if (ctx.examples === undefined) {
    return selectPrompt(char, cc, undefined);
  }
  return selectPromptByExamples(char, cc, ctx.examples.get(char) ?? [], ctx.ccCedict);
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
  overrides: Map<string, PromptOverride>,
  ctx: PromptContext,
): string {
  const { ccCedict, approvals } = ctx;
  const rows: string[] = [REVIEW_HEADER];

  for (const char of characters) {
    // Guaranteed present on success; assert for TypeScript.
    const cc = ccCedict.get(char) as CcCedictEntry;
    const override = overrides.get(char);
    const selection = choosePrompt(char, cc, override, ctx);
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
    const reviewedBy = choice.fromOverride
      ? (override?.reviewedBy ?? '')
      : approvals.has(char)
        ? 'human'
        : '';

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

// --- All levels --------------------------------------------------------------

/** Inputs of one level for buildAllLevels. */
export interface LevelInputPaths {
  characterListPath: string;
  /** Absent path or absent file means no overrides. */
  promptOverridesPath?: string;
}

/** Options of buildAllLevels: the shared sources plus one input set per level. */
export interface AllLevelsOptions {
  hanziWriterDataDir: string;
  makeMeAHanziPath: string;
  ccCedictPath: string;
  unihanPath: string;
  unihanSha256: string;
  /** Shared by level 2 and 3. Absent path or absent file means no approvals. */
  promptApprovalsPath?: string;
  /** hsk30-chars.csv; passed to levels 2 and 3 only. Absent means the Current_Rule. */
  hskCharsPath?: string;
  levels: Readonly<Record<Level, LevelInputPaths>>;
}

/** What one successful level contributes. */
export interface LevelBuild {
  level: Level;
  /** Number of records. */
  count: number;
  /** Serialised Level_Dataset (level 1 pretty, levels 2 and 3 minified). */
  output: string;
  /** The level's Review_File content. */
  promptReviewCsv: string;
  /** Prompt changes of the Clue_Rule over the Current_Rule (levels 2 and 3). */
  ruleChanges: RuleChange[];
  cangjieMissing: string[];
  notPlayable: string[];
  summonInkCounts: Record<SummonInkClass, number>;
}

/** The failures of one level. */
export interface LevelFailure {
  level: Level;
  errors: MissingFieldError[];
  cangjieErrors: CangjieError[];
}

/** Every file content a successful all-levels build produces. */
export interface AllLevelsOutput {
  levels: LevelBuild[];
  manifest: LevelManifest;
  /** levels.json content. */
  manifestJson: string;
  /** Review_Samples of level 2 and 3. */
  samples: Record<2 | 3, string>;
  /** Sample_Provenance JSON content. */
  provenanceJson: string;
  promptCounts: PromptCounts;
  /** Content of app/src/data/promptCounts.generated.ts. */
  countsModule: string;
  /** Sentence placed between the README markers. */
  readmeBlock: string;
  /** Content of data/prompt-rule-changes.csv. */
  ruleChangesCsv: string;
  /** Content of app/public/data/legend-strokes.json. */
  legendStrokesJson: string;
}

export type AllLevelsResult =
  | ({ ok: true } & AllLevelsOutput)
  | { ok: false; failures: LevelFailure[] };

/**
 * Builds all three levels without writing anything. Every level is built
 * before the result is decided, so one report lists the failures of all
 * levels. Input-file errors (missing sources, invalid lists, invalid override
 * or approval files, hash mismatch) throw, as in buildDataset.
 */
export async function buildAllLevels(
  opts: AllLevelsOptions,
): Promise<AllLevelsResult> {
  // Approvals name characters of level 2 or 3; one that is in neither list is
  // reported before anything is built.
  const orders = new Map<Level, string[]>();
  for (const level of LEVELS) {
    const raw = await readFile(opts.levels[level].characterListPath, 'utf8');
    const parsed = parseCharacterList(raw);
    if (!parsed.ok) {
      const summary = parsed.errors
        .map((e) => `  line ${e.line}: ${e.character || '(empty)'} — ${e.reason}`)
        .join('\n');
      throw new Error(
        `${basename(opts.levels[level].characterListPath)} failed validation (${parsed.errors.length} error(s)):\n${summary}`,
      );
    }
    orders.set(level, parsed.characters);
  }
  const approvals = await loadApprovals(opts.promptApprovalsPath);
  const laterChars = new Set([
    ...(orders.get(2) as string[]),
    ...(orders.get(3) as string[]),
  ]);
  const unknownApprovals = [...approvals].filter((c) => !laterChars.has(c));
  if (unknownApprovals.length > 0) {
    throw new Error(
      `${basename(opts.promptApprovalsPath as string)} names character(s) that are in neither level 2 nor level 3: ${unknownApprovals.join(' ')}`,
    );
  }

  const builds: LevelBuild[] = [];
  const failures: LevelFailure[] = [];
  for (const level of LEVELS) {
    const input = opts.levels[level];
    const result = await buildDataset({
      characterListPath: input.characterListPath,
      hanziWriterDataDir: opts.hanziWriterDataDir,
      makeMeAHanziPath: opts.makeMeAHanziPath,
      ccCedictPath: opts.ccCedictPath,
      promptOverridesPath: input.promptOverridesPath,
      unihanPath: opts.unihanPath,
      unihanSha256: opts.unihanSha256,
      ...(level === 1
        ? {}
        : {
            level,
            promptApprovalsPath: opts.promptApprovalsPath,
            hskCharsPath: opts.hskCharsPath,
          }),
    });
    if (!result.ok) {
      failures.push({
        level,
        errors: result.errors,
        cangjieErrors: result.cangjieErrors,
      });
      continue;
    }
    builds.push({
      level,
      count: Object.keys(JSON.parse(result.output) as object).length,
      output: result.output,
      promptReviewCsv: result.promptReviewCsv,
      ruleChanges: result.ruleChanges,
      cangjieMissing: result.cangjieMissing,
      notPlayable: result.notPlayable,
      summonInkCounts: result.summonInkCounts,
    });
  }
  if (failures.length > 0) {
    return { ok: false, failures };
  }

  const parsedByLevel = new Map<Level, Record<string, CharacterRecord>>();
  for (const b of builds) {
    parsedByLevel.set(
      b.level,
      JSON.parse(b.output) as Record<string, CharacterRecord>,
    );
  }
  const manifest = buildManifest(
    LEVELS.map((level) => ({
      level,
      order: orders.get(level) as string[],
      records: new Map(Object.entries(parsedByLevel.get(level) as object)) as Map<
        string,
        CharacterRecord
      >,
    })),
    (character) => {
      const entry = parseHanziWriterData(opts.hanziWriterDataDir, [
        character,
      ]).get(character);
      if (entry === undefined) {
        throw new Error(`${character}.json is missing or invalid`);
      }
      return entry.strokes;
    },
  );
  const csvOf = (level: Level): string =>
    (builds.find((b) => b.level === level) as LevelBuild).promptReviewCsv;
  const countOf = (level: Level): number =>
    (builds.find((b) => b.level === level) as LevelBuild).count;
  const samples: Record<2 | 3, string> = {
    2: buildReviewSample(csvOf(2), 2),
    3: buildReviewSample(csvOf(3), 3),
  };
  const provenanceJson = serialiseSampleProvenance(
    buildSampleProvenance({ 2: countOf(2), 3: countOf(3) }),
  );
  const promptCounts = computePromptCounts({
    level2: parsedByLevel.get(2) as Record<string, CharacterRecord>,
    level3: parsedByLevel.get(3) as Record<string, CharacterRecord>,
  });
  return {
    ok: true,
    levels: builds,
    manifest,
    manifestJson: serialiseManifest(manifest),
    samples,
    provenanceJson,
    promptCounts,
    countsModule: renderCountsModule(promptCounts),
    readmeBlock: renderReadmeBlock(promptCounts),
    ruleChangesCsv: renderRuleChangesCsv(
      builds.flatMap((b) => (b.level === 1 ? [] : b.ruleChanges)),
    ),
    legendStrokesJson: serialiseLegendStrokes(
      buildLegendStrokes(
        opts.hanziWriterDataDir,
        legendCharacters(LEGEND_SOURCE.zh),
      ),
    ),
  };
}

/** Where each generated file goes. */
export interface AllLevelsPaths {
  datasets: Record<Level, string>;
  manifest: string;
  reviewFiles: Record<Level, string>;
  samples: Record<2 | 3, string>;
  provenance: string;
  countsModule: string;
  readme: string;
  ruleChanges: string;
  legendStrokes: string;
}

/** The generated-file paths inside a repository root. */
export function defaultPaths(root: string): AllLevelsPaths {
  return {
    datasets: {
      1: join(root, 'app/public/data', LEVEL_FILES[1]),
      2: join(root, 'app/public/data', LEVEL_FILES[2]),
      3: join(root, 'app/public/data', LEVEL_FILES[3]),
    },
    manifest: join(root, 'app/public/data/levels.json'),
    reviewFiles: {
      1: join(root, 'data/prompt-review.csv'),
      2: join(root, 'data/prompt-review-level2.csv'),
      3: join(root, 'data/prompt-review-level3.csv'),
    },
    samples: {
      2: join(root, 'data/prompt-review-sample-level2.csv'),
      3: join(root, 'data/prompt-review-sample-level3.csv'),
    },
    provenance: join(root, 'data/prompt-review-sample-provenance.json'),
    countsModule: join(root, 'app/src/data/promptCounts.generated.ts'),
    readme: join(root, 'README.md'),
    ruleChanges: join(root, 'data/prompt-rule-changes.csv'),
    legendStrokes: join(root, 'app/public/data/legend-strokes.json'),
  };
}

/** Every file to write with its content, in a fixed order. */
function filesToWrite(
  output: AllLevelsOutput,
  paths: AllLevelsPaths,
  readmeText: string,
): Array<{ path: string; content: string }> {
  const level = (n: Level): LevelBuild =>
    output.levels.find((b) => b.level === n) as LevelBuild;
  return [
    ...LEVELS.map((n) => ({ path: paths.datasets[n], content: level(n).output })),
    { path: paths.manifest, content: output.manifestJson },
    ...LEVELS.map((n) => ({
      path: paths.reviewFiles[n],
      content: level(n).promptReviewCsv,
    })),
    { path: paths.samples[2], content: output.samples[2] },
    { path: paths.samples[3], content: output.samples[3] },
    { path: paths.provenance, content: output.provenanceJson },
    { path: paths.countsModule, content: output.countsModule },
    { path: paths.ruleChanges, content: output.ruleChangesCsv },
    { path: paths.legendStrokes, content: output.legendStrokesJson },
    {
      path: paths.readme,
      content: replaceReadmeBlock(readmeText, output.readmeBlock),
    },
  ];
}

/**
 * Writes every generated file. The README block is computed first, so a
 * missing marker throws before any file is touched. Every file is written to a
 * temp file before the first rename.
 */
export async function writeAllLevels(
  output: AllLevelsOutput,
  paths: AllLevelsPaths,
): Promise<void> {
  const readmeText = await readFile(paths.readme, 'utf8');
  const files = filesToWrite(output, paths, readmeText);
  await atomicWriteAll(files);
}

/** Writes all temp files, then renames them into place. */
async function atomicWriteAll(
  files: ReadonlyArray<{ path: string; content: string }>,
): Promise<void> {
  for (const f of files) {
    await writeFile(`${f.path}.tmp`, f.content, 'utf8');
  }
  for (const f of files) {
    await rename(`${f.path}.tmp`, f.path);
  }
}

/** The failure report of a failed all-levels build, grouped by level. */
export function formatAllLevelsFailures(
  failures: readonly LevelFailure[],
): string {
  const blocks = failures.map((f) => {
    const lines: string[] = [`Level ${f.level}:`];
    if (f.errors.length > 0) {
      lines.push(`  ${f.errors.length} character(s) could not be built:`);
      for (const e of f.errors) lines.push(`    ${formatError(e)}`);
    }
    if (f.cangjieErrors.length > 0) {
      lines.push(
        `  ${f.cangjieErrors.length} character(s) have an unusable Cangjie code:`,
      );
      for (const line of formatCangjieErrors(f.cangjieErrors).split('\n')) {
        lines.push(`    ${line}`);
      }
    }
    return lines.join('\n');
  });
  return `${blocks.join('\n')}\n\nNo output written.\n`;
}

/**
 * The success report: per-level Cangjie and summon-ink lines, then one line per
 * data file with record count, raw bytes and gzip bytes. Paths are shown
 * relative to `baseDir`.
 */
export function formatAllLevelsReport(
  output: AllLevelsOutput,
  paths: AllLevelsPaths,
  baseDir: string,
): string {
  let text = '';
  for (const b of output.levels) {
    text +=
      `Level ${b.level}: ${b.count} character(s)\n` +
      formatCangjieSummary(b.count, b.cangjieMissing, b.notPlayable) +
      formatSummonInkSummary(b.summonInkCounts);
  }
  const line = (path: string, records: number, content: string): string =>
    formatFileReport(
      relative(baseDir, path),
      records,
      Buffer.byteLength(content, 'utf8'),
      gzipSync(Buffer.from(content, 'utf8')).length,
    ) + '\n';
  for (const b of output.levels) {
    text += line(paths.datasets[b.level], b.count, b.output);
  }
  text += line(paths.manifest, output.manifest.levels.length, output.manifestJson);
  text += line(
    paths.legendStrokes,
    legendCharacters(LEGEND_SOURCE.zh).length,
    output.legendStrokesJson,
  );
  const changed = (n: Level): number =>
    output.levels.find((b) => b.level === n)?.ruleChanges.length ?? 0;
  text += `Prompt rule changes: level 2: ${changed(2)}, level 3: ${changed(3)}, total: ${changed(2) + changed(3)}\n`;
  return text;
}

/**
 * CLI entry point. Resolves the hardcoded repo-root paths, builds every level,
 * reports progress, and writes the outputs on success. Never throws: all
 * failure modes set process.exitCode = 1 and return.
 */
async function main(): Promise<void> {
  const root = repoRoot();
  const unihanFile = 'Unihan_DictionaryLikeData.txt';
  const sourcesPath = join(root, 'data/raw/SOURCES.md');
  let unihanSha256: string | null = null;
  try {
    unihanSha256 = readRecordedSha256(
      await readFile(sourcesPath, 'utf8'),
      unihanFile,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: cannot read ${sourcesPath}: ${message}\n`);
    process.exitCode = 1;
    return;
  }
  if (unihanSha256 === null) {
    process.stderr.write(
      `Error: no recorded SHA-256 for ${unihanFile} in ${sourcesPath}. No output written.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const opts: AllLevelsOptions = {
    hanziWriterDataDir: join(root, 'data/raw/hanzi-writer-data'),
    makeMeAHanziPath: join(root, 'data/raw/make-me-a-hanzi/dictionary.txt'),
    ccCedictPath: join(root, 'data/raw/cc-cedict/cedict_ts.u8'),
    unihanPath: join(root, 'data/raw/unihan', unihanFile),
    unihanSha256,
    promptApprovalsPath: join(root, 'data/prompt-approvals.csv'),
    hskCharsPath: join(root, 'data/raw/hsk30/hsk30-chars.csv'),
    levels: {
      1: {
        characterListPath: join(root, 'data/character-list.txt'),
        promptOverridesPath: join(root, 'data/prompt-overrides.csv'),
      },
      2: {
        characterListPath: join(root, 'data/character-list-level2.txt'),
        promptOverridesPath: join(root, 'data/prompt-overrides-level2.csv'),
      },
      3: {
        characterListPath: join(root, 'data/character-list-level3.txt'),
        promptOverridesPath: join(root, 'data/prompt-overrides-level3.csv'),
      },
    },
  };

  let result: AllLevelsResult;
  try {
    result = await buildAllLevels(opts);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const prefix =
      err instanceof Sha256MismatchError ? 'Error (Unihan hash check): ' : 'Error: ';
    process.stderr.write(`${prefix}${message}\n`);
    process.exitCode = 1;
    return;
  }

  if (!result.ok) {
    process.stderr.write(formatAllLevelsFailures(result.failures));
    process.exitCode = 1;
    return;
  }

  const paths = defaultPaths(root);
  try {
    await writeAllLevels(result, paths);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    formatAllLevelsReport(result, paths, root) +
      `All required fields (pinyin, meanings, strokeCount, strokeData, decomposition) and prompt are non-null.\n` +
      `Wrote prompt review files, review samples, levels.json and prompt counts.\n`,
  );
}

/**
 * The four Cangjie lines of the success summary: coverage, characters without
 * a code, the Playable count, and the characters that are not Playable.
 */
export function formatCangjieSummary(
  count: number,
  cangjieMissing: readonly string[],
  notPlayable: readonly string[],
): string {
  const withCode = count - cangjieMissing.length;
  const playable = count - notPlayable.length;
  const missingText = cangjieMissing.length === 0 ? 'none' : cangjieMissing.join(' ');
  const notPlayableText = notPlayable.length === 0 ? 'none' : notPlayable.join(' ');
  return (
    `Cangjie code: ${withCode} of ${count} characters have one.\n` +
    `Without a Cangjie code: ${missingText}\n` +
    `Playable in Cangjie: ${playable} of ${count}\n` +
    `Not playable in Cangjie: ${notPlayableText}\n`
  );
}

/** The summon-ink line of the success summary: how many characters are in each class. */
export function formatSummonInkSummary(
  counts: Readonly<Record<SummonInkClass, number>>,
): string {
  return (
    `Summon ink: transparent ${counts.transparent}, ` +
    `partial ${counts.partial}, opaque ${counts.opaque}\n`
  );
}

/** One line per failing character: `character: values (reason)`. */
export function formatCangjieErrors(errors: readonly CangjieError[]): string {
  return errors
    .map((e) => `${e.character}: ${e.values.join(', ')} (${e.reason})`)
    .join('\n');
}

/**
 * Plain-words help for each override failure. A new reason added to
 * `PromptOverrideFailure` fails to compile until it has a message here.
 */
const OVERRIDE_ERROR_HELP: Record<PromptOverrideFailure, string> = {
  'unknown-character':
    'this character is not in data/character-list.txt. In data/prompt-overrides.csv, remove the row or add the character to data/character-list.txt.',
  'entry-index-out-of-range':
    'entryIndex is larger than the number of CC-CEDICT entries for this character. Fix this row in data/prompt-overrides.csv (column entryIndex).',
  'meaning-index-out-of-range':
    'meaningIndex is larger than the number of meanings in the chosen CC-CEDICT entry. Fix this row in data/prompt-overrides.csv (column meaningIndex).',
};

/** Format one per-character failure for the stderr report. */
export function formatError(e: MissingFieldError): string {
  const parts: string[] = [];
  if (e.missingFields.length > 0) {
    parts.push(`missing: ${e.missingFields.join(', ')}`);
  }
  if (e.overrideError !== undefined) {
    parts.push(`override ${e.overrideError}: ${OVERRIDE_ERROR_HELP[e.overrideError]}`);
  }
  if (e.promptFailure === 'chinese-in-meaning') {
    const file =
      e.level === 2 || e.level === 3
        ? `data/prompt-overrides-level${e.level}.csv`
        : 'the level override file';
    parts.push(
      `prompt: chinese-in-meaning (the meaning would show a Chinese character at level ${e.level ?? '?'}; add an override row in ${file})`,
    );
  } else if (e.promptFailure !== undefined) {
    parts.push(`prompt: ${e.promptFailure}`);
  }
  return `${e.character}: ${parts.join('; ')}`;
}

// ESM-safe execution guard: run main() only when this file is executed
// directly (e.g. `tsx scripts/build-data.ts`), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
