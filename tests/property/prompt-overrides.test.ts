// Feature: character-dataset, Property 21: every override index is in range and reviewer-attributed
//
// Property 21: For any APPLIED prompt-override in a SUCCESSFUL build,
//   - `entryIndex` is a valid index into the character's CC-CEDICT entries,
//   - `meaningIndex` is a valid index into that entry's meanings, and
//   - `reviewedBy` is non-empty.
//
// Validates: Requirements 6.6, 6.7
//
// buildDataset reads from FILE PATHS, so — like pipeline-determinism.test.ts —
// we materialise each generated input set into a fresh temp directory, point a
// BuildOptions at it, and run the real build. Two complementary angles:
//
//   (A) Build-level (the real guarantee). Generate a small set of characters,
//       each with a KNOWN number of CC-CEDICT entries and a KNOWN number of
//       usable glosses per entry. Generate an overrides CSV whose every override
//       picks IN-RANGE entry/meaning indices and a non-empty reviewer. Run the
//       build, assert success, parse the output, and assert each overridden
//       character's `prompt` equals the override-selected entry's reading
//       (tone-mark form) and that entry's gloss at `meaningIndex`. Also assert
//       the prompt-review.csv marks those rows `override` with the reviewer.
//
//   (B) Negative. An OUT-OF-RANGE entry/meaning index makes buildDataset return
//       `{ ok: false }` with an `overrideError` of `entry-index-out-of-range` /
//       `meaning-index-out-of-range` for that character. An empty reviewer (or a
//       malformed row) is a parse-level failure in loadOverrides, so buildDataset
//       THROWS.
//
// Generated glosses are "plain": no `/` (the CC-CEDICT delimiter), no comma or
// quote (so review-CSV cells are emitted unquoted), and no `(bound form) `
// prefix or skipped prefix, so the override-selected gloss strips to itself and
// the expected `prompt.meaning` is exactly that gloss.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';

import type { BuildOptions, CharacterRecord } from '../../app/src/data/types';
import { buildDataset } from '../../scripts/build-data';
import { numberedToToneMarks } from '../../scripts/lib/prompt';
import { arbitraryCharacter, arbitraryStrokeData } from '../helpers/arbitraries';
import type { StrokeData } from '../../app/src/data/types';

// --- Generated input model --------------------------------------------------

/** One CC-CEDICT entry (source line) for a character: a reading + glosses. */
interface GeneratedEntry {
  reading: string; // numbered pinyin, e.g. "wo3"
  glosses: string[]; // plain usable glosses (no `/`, no comma/quote)
}

/** A complete, build-succeeding input bundle for ONE character. */
interface GeneratedCharInput {
  character: string;
  strokeData: StrokeData;
  decomposition: string; // IDS string for the Make Me a Hanzi line
  radical: string;
  entries: GeneratedEntry[]; // 1..N CC-CEDICT source lines
}

/** An override naming a character, with the indices to apply + its reviewer. */
interface GeneratedOverride {
  character: string;
  entryIndex: number;
  meaningIndex: number;
  reviewedBy: string;
}

// Plain numbered readings (lowercase onset → not a proper-noun skip, though the
// override picks by index regardless of the default proper-noun rule).
const READINGS = ['wo3', 'kou3', 'shui3', 'huo3', 'zou3', 'xin1', 'da4', 'hao3'] as const;

// Plain usable glosses: no `/`, no comma, no quote, no `(bound form) `/skipped
// prefix. So the override-selected gloss strips to itself.
const GLOSSES = [
  'three',
  'mouth',
  'water',
  'fire',
  'to walk',
  'heart',
  'big',
  'small',
  'to eat',
  'person',
] as const;

// Non-empty reviewer names (no comma/quote so review-CSV cells stay unquoted).
const REVIEWERS = ['alice', 'bob', 'carol', 'dylan-reviewer'] as const;

/** 1..3 CC-CEDICT entries, each with 1..3 plain usable glosses. */
function arbitraryEntries(): fc.Arbitrary<GeneratedEntry[]> {
  return fc.array(
    fc.record({
      reading: fc.constantFrom(...READINGS),
      glosses: fc.array(fc.constantFrom(...GLOSSES), {
        minLength: 1,
        maxLength: 3,
      }),
    }),
    { minLength: 1, maxLength: 3 },
  );
}

/** One character's full input bundle (atomic decomposition keeps it valid). */
function arbitraryGeneratedCharInput(
  character: string,
): fc.Arbitrary<GeneratedCharInput> {
  return fc.record({
    character: fc.constant(character),
    strokeData: arbitraryStrokeData(),
    decomposition: fc.constant('？'),
    radical: arbitraryCharacter(),
    entries: arbitraryEntries(),
  });
}

/** 1..3 distinct characters, each with a full input bundle. */
function arbitraryInputBundle(): fc.Arbitrary<GeneratedCharInput[]> {
  return fc
    .uniqueArray(arbitraryCharacter(), { minLength: 1, maxLength: 3 })
    .chain((characters) =>
      fc.tuple(
        ...characters.map((character) =>
          arbitraryGeneratedCharInput(character),
        ),
      ),
    )
    .map((tuple) => [...tuple]);
}

/**
 * An input bundle PLUS an in-range override for every character. The override's
 * entryIndex is picked within the character's entries and its meaningIndex
 * within that chosen entry's glosses — so every override is applicable and the
 * build succeeds.
 */
function arbitraryBundleWithInRangeOverrides(): fc.Arbitrary<{
  inputs: GeneratedCharInput[];
  overrides: GeneratedOverride[];
}> {
  return arbitraryInputBundle().chain((inputs) =>
    fc
      .tuple(
        ...inputs.map((input) =>
          fc
            .integer({ min: 0, max: input.entries.length - 1 })
            .chain((entryIndex) =>
              fc.record({
                character: fc.constant(input.character),
                entryIndex: fc.constant(entryIndex),
                meaningIndex: fc.integer({
                  min: 0,
                  max: input.entries[entryIndex].glosses.length - 1,
                }),
                reviewedBy: fc.constantFrom(...REVIEWERS),
              }),
            ),
        ),
      )
      .map((overrides) => ({ inputs, overrides: [...overrides] })),
  );
}

// --- Materialisation --------------------------------------------------------

/** All temp dirs created during the run, cleaned up in afterEach. */
const tempDirs: string[] = [];

/**
 * Write a generated input bundle + overrides rows into a fresh temp directory
 * and return a BuildOptions pointing at the materialised files. `overrideRows`
 * is the list of raw CSV data rows (already comma-joined) appended after the
 * header; pass [] for a header-only (no overrides) file.
 */
function materialise(
  inputs: GeneratedCharInput[],
  overrideRows: string[],
): BuildOptions {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-ovr-'));
  tempDirs.push(dir);

  const hanziWriterDir = join(dir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDir, { recursive: true });

  // character-list.txt: a comment header + one character per line.
  const characterListPath = join(dir, 'character-list.txt');
  const listBody = inputs.map((i) => i.character).join('\n');
  writeFileSync(
    characterListPath,
    `# generated test list\n${listBody}\n`,
    'utf8',
  );

  // hanzi-writer-data/<char>.json: verbatim { strokes, medians, radStrokes }.
  for (const input of inputs) {
    writeFileSync(
      join(hanziWriterDir, `${input.character}.json`),
      JSON.stringify(input.strokeData),
      'utf8',
    );
  }

  // make-me-a-hanzi dictionary.txt: newline-delimited JSON, one object per line.
  const makeMeAHanziPath = join(dir, 'dictionary.txt');
  const mmhLines = inputs.map((input) =>
    JSON.stringify({
      character: input.character,
      decomposition: input.decomposition,
      radical: input.radical,
    }),
  );
  writeFileSync(makeMeAHanziPath, `${mmhLines.join('\n')}\n`, 'utf8');

  // cc-cedict cedict_ts.u8: `Trad Simp [reading] /gloss1/gloss2/`, one line per
  // entry so parseCcCedict collects them (in file order) into `entries`.
  const ccCedictPath = join(dir, 'cedict_ts.u8');
  const cedictLines: string[] = [];
  for (const input of inputs) {
    for (const entry of input.entries) {
      const glossBlock = entry.glosses.join('/');
      cedictLines.push(
        `${input.character} ${input.character} [${entry.reading}] /${glossBlock}/`,
      );
    }
  }
  writeFileSync(
    ccCedictPath,
    `# CC-CEDICT generated test header\n${cedictLines.join('\n')}\n`,
    'utf8',
  );

  // prompt-overrides.csv: header + the provided data rows.
  const promptOverridesPath = join(dir, 'prompt-overrides.csv');
  const header = 'character,entryIndex,meaningIndex,reviewedBy';
  const body = overrideRows.length > 0 ? `\n${overrideRows.join('\n')}` : '';
  writeFileSync(promptOverridesPath, `${header}${body}\n`, 'utf8');

  return {
    characterListPath,
    hanziWriterDataDir: hanziWriterDir,
    makeMeAHanziPath,
    ccCedictPath,
    promptOverridesPath,
  };
}

/** Format an override as a CSV data row. */
function overrideRow(o: GeneratedOverride): string {
  return `${o.character},${o.entryIndex},${o.meaningIndex},${o.reviewedBy}`;
}

/**
 * Parse one logical line of the prompt-review CSV into fields. The generated
 * data keeps every cell free of commas/quotes/newlines, so a plain split is
 * safe here (this is a test helper, not the pipeline).
 */
function parseReviewRows(csv: string): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  const lines = csv.split('\n').filter((l) => l.length > 0);
  // Skip the header (index 0).
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(',');
    rows.set(fields[0], fields);
  }
  return rows;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// --- (A) Build-level: in-range overrides are applied -----------------------

describe('Property 21 (A): applied overrides are in range and reviewer-attributed', () => {
  it('each overridden prompt uses the selected entry reading + gloss, and the review CSV attributes it', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryBundleWithInRangeOverrides(),
        async ({ inputs, overrides }) => {
          const opts = materialise(inputs, overrides.map(overrideRow));

          const result = await buildDataset(opts);
          expect(result.ok).toBe(true);
          if (!result.ok) {
            return;
          }

          const dataset = JSON.parse(result.output) as Record<
            string,
            CharacterRecord
          >;
          const inputByChar = new Map(inputs.map((i) => [i.character, i]));
          const reviewRows = parseReviewRows(result.promptReviewCsv);

          for (const override of overrides) {
            const input = inputByChar.get(override.character);
            expect(input).toBeDefined();
            if (input === undefined) {
              continue;
            }

            // In-range by construction — assert the guarantee explicitly.
            expect(override.entryIndex).toBeGreaterThanOrEqual(0);
            expect(override.entryIndex).toBeLessThan(input.entries.length);
            const selectedEntry = input.entries[override.entryIndex];
            expect(override.meaningIndex).toBeGreaterThanOrEqual(0);
            expect(override.meaningIndex).toBeLessThan(
              selectedEntry.glosses.length,
            );
            expect(override.reviewedBy.length).toBeGreaterThan(0);

            const expectedMeaning = selectedEntry.glosses[override.meaningIndex];
            const expectedPinyin = numberedToToneMarks(selectedEntry.reading);

            // The built record's prompt matches the override selection.
            const record = dataset[override.character];
            expect(record).toBeDefined();
            expect(record.prompt.meaning).toBe(expectedMeaning);
            expect(record.prompt.pinyin).toBe(expectedPinyin);

            // The review CSV marks the row `override` with this reviewer.
            // Columns: character,chosenMeaning,chosenPinyin,source,reviewedBy,...
            const fields = reviewRows.get(override.character);
            expect(fields).toBeDefined();
            if (fields === undefined) {
              continue;
            }
            expect(fields[1]).toBe(expectedMeaning);
            expect(fields[2]).toBe(expectedPinyin);
            expect(fields[3]).toBe('override');
            expect(fields[4]).toBe(override.reviewedBy);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- (B) Negative: out-of-range index → ok:false with overrideError --------

describe('Property 21 (B): out-of-range override indices fail the build', () => {
  it('an out-of-range entry/meaning index yields ok:false with the matching overrideError', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbitraryInputBundle(),
        // Which kind of out-of-range to inject, and which character to target.
        fc.constantFrom<'entry' | 'meaning'>('entry', 'meaning'),
        async (inputs, kind) => {
          // Target the first character.
          const target = inputs[0];
          const reviewer = 'reviewer';

          let row: string;
          let expectedReason:
            | 'entry-index-out-of-range'
            | 'meaning-index-out-of-range';

          if (kind === 'entry') {
            // entryIndex == entries.length is one past the end → out of range.
            row = `${target.character},${target.entries.length},0,${reviewer}`;
            expectedReason = 'entry-index-out-of-range';
          } else {
            // Valid entry 0, but meaningIndex == that entry's gloss count.
            const glossCount = target.entries[0].glosses.length;
            row = `${target.character},0,${glossCount},${reviewer}`;
            expectedReason = 'meaning-index-out-of-range';
          }

          const opts = materialise(inputs, [row]);
          const result = await buildDataset(opts);

          expect(result.ok).toBe(false);
          if (result.ok) {
            return;
          }
          const err = result.errors.find(
            (e) => e.character === target.character,
          );
          expect(err).toBeDefined();
          expect(err?.overrideError).toBe(expectedReason);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- (B) Negative: empty reviewer / malformed row → throws -----------------

describe('Property 21 (B): a missing reviewer or malformed row makes the build throw', () => {
  it('an empty reviewer is rejected at parse time (loadOverrides throws)', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInputBundle(), async (inputs) => {
        const target = inputs[0];
        // Empty reviewer field → missing-reviewer at parse level.
        const row = `${target.character},0,0,`;
        const opts = materialise(inputs, [row]);

        await expect(buildDataset(opts)).rejects.toThrow(
          /prompt-overrides\.csv failed validation/,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('a malformed row (wrong column count) makes the build throw', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInputBundle(), async (inputs) => {
        const target = inputs[0];
        // Only three columns → malformed-row at parse level.
        const row = `${target.character},0,0`;
        const opts = materialise(inputs, [row]);

        await expect(buildDataset(opts)).rejects.toThrow(
          /prompt-overrides\.csv failed validation/,
        );
      }),
      { numRuns: 100 },
    );
  });
});
