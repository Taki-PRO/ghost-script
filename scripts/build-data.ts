// Data pipeline entry point for the Ghost Script character dataset.
//
// Two public surfaces:
//   - buildDataset(opts): pure-ish orchestration. Reads the input files, runs
//     every parser, merges each character fail-slow, and returns a serialised
//     JSON string on success. It NEVER writes output, calls process.exit, or
//     prints to stdout/stderr. It returns { ok: false, errors } ONLY for
//     missing-field failures (MissingFieldError). All other failure modes
//     (missing input files, invalid character list, output integrity mismatch)
//     throw a typed Error so main() can report them.
//   - main(): resolves the real repo-root paths, calls buildDataset, reports to
//     stdout/stderr, and writes app/public/data/characters.json atomically on
//     success. Runs only when the file is executed directly (ESM guard).

import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type {
  BuildOptions,
  BuildResult,
  CharacterRecord,
  MissingFieldError,
} from '../app/src/data/types';

import { parseCharacterList } from './lib/parse-character-list';
import { parseHanziWriterData } from './lib/parse-hanzi-writer-data';
import { parseMakeMeAHanzi } from './lib/parse-make-me-a-hanzi';
import { parseCcCedict } from './lib/parse-cc-cedict';
import { mergeCharacter } from './lib/merge';
import { serialiseDataset } from './lib/serialise';

/**
 * Builds the character dataset from the four input paths.
 *
 * Steps:
 *   1. Verify every required input path exists (throws on missing input).
 *   2. Parse the character list (throws on list-validation errors).
 *   3. Parse the three raw datasets.
 *   4. Fail-slow merge: process EVERY character, collecting MissingFieldError
 *      items for each failure before deciding.
 *   5. If any missing-field errors exist, return { ok: false, errors } (no
 *      output written).
 *   6. On full success, serialise, verify the record count equals the
 *      character-list length (throws on mismatch), and return
 *      { ok: true, output }.
 *
 * Input-file errors, character-list validation errors, and output integrity
 * mismatches are surfaced as thrown Errors. Only per-character missing required
 * fields are represented as { ok: false, errors: MissingFieldError[] }.
 *
 * This function never writes to disk; the caller (main) performs the atomic
 * write of the returned string.
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

  // 4. Fail-slow merge pass: process EVERY character before deciding.
  const records = new Map<string, CharacterRecord>();
  const errors: MissingFieldError[] = [];

  for (const char of characters) {
    const merged = mergeCharacter(
      char,
      hanziWriter.get(char),
      makeMeAHanzi.get(char),
      ccCedict.get(char),
    );
    if (merged.ok) {
      records.set(char, merged.record);
    } else {
      errors.push({ character: char, missingFields: merged.missingFields });
    }
  }

  // 5. Any missing-field error aborts: return without writing output. Errors
  //    are already in character-list order (the loop preserves it).
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // 6. Serialise and verify the output record count matches the list length.
  const output = serialiseDataset(records);
  if (records.size !== characters.length) {
    throw new Error(
      `Output integrity check failed: serialised ${records.size} record(s) ` +
        `but character-list.txt has ${characters.length} character(s).`,
    );
  }

  return { ok: true, output };
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
    const lines = result.errors.map(
      (e) => `${e.character}: ${e.missingFields.join(', ')}`,
    );
    process.stderr.write(
      `Missing required fields for ${result.errors.length} character(s):\n`,
    );
    process.stderr.write(`${lines.join('\n')}\n`);
    process.stderr.write(
      `\n${result.errors.length} character(s) could not be built. No output written.\n`,
    );
    process.exitCode = 1;
    return;
  }

  // Success: write atomically (temp file + rename) in the output directory.
  const outputPath = join(root, 'app/public/data/characters.json');
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, result.output, 'utf8');
  await rename(tmpPath, outputPath);

  const count = Object.keys(JSON.parse(result.output) as object).length;
  process.stdout.write(
    `Built ${count} character(s) → ${outputPath}\n` +
      `All required fields (pinyin, meanings, strokeCount, strokeData, decomposition) are non-null.\n`,
  );
}

// ESM-safe execution guard: run main() only when this file is executed
// directly (e.g. `tsx scripts/build-data.ts`), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
