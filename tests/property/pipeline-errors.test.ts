// Feature: character-dataset, Property 3: Fail-slow error aggregation
//
// Property 3 (design.md): For any set of characters where a RANDOM SUBSET has
// one or more missing required fields, the pipeline processes EVERY character
// before returning a failure, and the failure result lists EVERY affected
// character with EVERY missing field — not just the first.
//
// **Validates: Requirements 3.6**
//
// Approach (mirrors 13.3): generate a tiny set of characters, randomly decide
// for each which of its three source rows to OMIT, write the resulting sources
// into a fresh temp dir, point BuildOptions at them, and call buildDataset.
// Omitting a source implies a known set of missing required fields:
//   - omit hanzi-writer file → strokeCount + strokeData missing
//   - omit Make-Me-a-Hanzi line → decomposition missing
//   - omit CC-CEDICT line → pinyin + meanings missing
// At least one character is forced deficient so the build fails. We then assert
// the failure lists exactly the deficient characters, each with exactly the
// missing fields implied by what we omitted (stable order
// pinyin, meanings, strokeCount, strokeData, decomposition), and that complete
// characters never appear in errors.

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { buildDataset } from '../../scripts/build-data';
import type {
  BuildOptions,
  MissingFieldError,
  RequiredField,
} from '../../app/src/data/types';
import { arbitraryCharacter } from '../helpers/arbitraries';

// --- Source-row shapes (match the real parsers) ----------------------------

/** A hanzi-writer-data file body: { strokes, medians, radStrokes }. */
function hanziWriterFileBody(): string {
  return JSON.stringify({
    strokes: ['M 100 200 L 300 400'],
    medians: [[[100, 200], [300, 400]]],
    radStrokes: [],
  });
}

/** A Make-Me-a-Hanzi dictionary line: newline-delimited JSON object. */
function makeMeAHanziLine(char: string): string {
  // Atomic entry (decomposition starts with ？). Shape matches
  // isMakeMeAHanziLine: { character, decomposition, radical }.
  return JSON.stringify({
    character: char,
    decomposition: '？',
    radical: char,
  });
}

/**
 * A CC-CEDICT data line: `Traditional Simplified [pinyin] /meaning/`.
 *
 * Uses a plain, lowercase (non-proper-noun) reading and a plain gloss so the
 * default prompt selection always yields a usable sense — a character that is
 * otherwise complete must fail ONLY because we deliberately omitted a source,
 * never because of a prompt-selection failure.
 */
function ccCedictLine(char: string): string {
  return `${char} ${char} [hao3] /good/`;
}

// --- Deficiency model -------------------------------------------------------

interface Deficiency {
  omitHanziWriter: boolean;
  omitMakeMeAHanzi: boolean;
  omitCcCedict: boolean;
}

/** Any source omitted → the character is deficient (will appear in errors). */
function isDeficient(d: Deficiency): boolean {
  return d.omitHanziWriter || d.omitMakeMeAHanzi || d.omitCcCedict;
}

/**
 * The exact missing required fields implied by a deficiency, in the pipeline's
 * stable order: pinyin, meanings, strokeCount, strokeData, decomposition.
 */
function expectedMissingFields(d: Deficiency): RequiredField[] {
  const missing: RequiredField[] = [];
  if (d.omitCcCedict) {
    missing.push('pinyin', 'meanings');
  }
  if (d.omitHanziWriter) {
    missing.push('strokeCount', 'strokeData');
  }
  if (d.omitMakeMeAHanzi) {
    missing.push('decomposition');
  }
  return missing;
}

// --- Arbitrary --------------------------------------------------------------

interface GeneratedCase {
  /** Characters paired with their deficiency decision, in list order. */
  entries: { char: string; deficiency: Deficiency }[];
}

/**
 * Generate 2–10 distinct characters, each with a random omission decision, and
 * FORCE at least one character to be deficient (so the build fails). We force
 * it by flipping the first non-deficient character's hanzi-writer omission when
 * the random draw produced an all-complete set.
 */
function arbitraryCase(): fc.Arbitrary<GeneratedCase> {
  return fc
    .uniqueArray(arbitraryCharacter(), { minLength: 2, maxLength: 10 })
    .chain((chars) =>
      fc
        .array(
          fc.record({
            omitHanziWriter: fc.boolean(),
            omitMakeMeAHanzi: fc.boolean(),
            omitCcCedict: fc.boolean(),
          }),
          { minLength: chars.length, maxLength: chars.length },
        )
        .map((deficiencies): GeneratedCase => {
          const entries = chars.map((char, i) => ({
            char,
            deficiency: deficiencies[i],
          }));
          // Ensure at least one deficient character so the build fails.
          if (!entries.some((e) => isDeficient(e.deficiency))) {
            entries[0].deficiency.omitHanziWriter = true;
          }
          return { entries };
        }),
    );
}

// --- Temp-dir writer --------------------------------------------------------

/**
 * Materialise a generated case into a fresh temp directory and return the
 * BuildOptions pointing at it. The caller is responsible for cleanup.
 */
function writeCaseToTempDir(testCase: GeneratedCase): {
  options: BuildOptions;
  tempDir: string;
} {
  const tempDir = mkdtempSync(join(tmpdir(), 'ghost-script-errors-'));
  const hanziWriterDataDir = join(tempDir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDataDir);

  // character-list.txt: comment header + one char per line (every generated
  // character is listed regardless of deficiency).
  const characterListPath = join(tempDir, 'character-list.txt');
  const listBody =
    '# property-test generated list\n' +
    testCase.entries.map((e) => e.char).join('\n') +
    '\n';
  writeFileSync(characterListPath, listBody, 'utf8');

  // hanzi-writer files: one <char>.json per NON-omitted character.
  for (const { char, deficiency } of testCase.entries) {
    if (!deficiency.omitHanziWriter) {
      writeFileSync(
        join(hanziWriterDataDir, `${char}.json`),
        hanziWriterFileBody(),
        'utf8',
      );
    }
  }

  // Make-Me-a-Hanzi dictionary.txt: one line per NON-omitted character.
  const makeMeAHanziPath = join(tempDir, 'dictionary.txt');
  const mmhLines = testCase.entries
    .filter((e) => !e.deficiency.omitMakeMeAHanzi)
    .map((e) => makeMeAHanziLine(e.char));
  writeFileSync(makeMeAHanziPath, mmhLines.join('\n') + '\n', 'utf8');

  // CC-CEDICT cedict_ts.u8: a comment header + one line per NON-omitted char.
  const ccCedictPath = join(tempDir, 'cedict_ts.u8');
  const ccLines = testCase.entries
    .filter((e) => !e.deficiency.omitCcCedict)
    .map((e) => ccCedictLine(e.char));
  writeFileSync(
    ccCedictPath,
    '# CC-CEDICT property-test fixture\n' + ccLines.join('\n') + '\n',
    'utf8',
  );

  return {
    options: {
      characterListPath,
      hanziWriterDataDir,
      makeMeAHanziPath,
      ccCedictPath,
    },
    tempDir,
  };
}

// --- Property ---------------------------------------------------------------

describe('Property 3: fail-slow error aggregation', () => {
  it('lists every deficient character with exactly its missing fields', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryCase(), async (testCase) => {
        const { options, tempDir } = writeCaseToTempDir(testCase);
        try {
          const result = await buildDataset(options);

          // At least one character is deficient → the build must fail.
          expect(result.ok).toBe(false);
          if (result.ok) {
            return; // unreachable after the assertion above; narrows the type.
          }

          const errors: MissingFieldError[] = result.errors;

          // Index errors by character for lookup.
          const errorByChar = new Map<string, MissingFieldError>();
          for (const err of errors) {
            // No duplicate error entries for a single character.
            expect(errorByChar.has(err.character)).toBe(false);
            errorByChar.set(err.character, err);
          }

          const deficientChars = testCase.entries
            .filter((e) => isDeficient(e.deficiency))
            .map((e) => e.char);
          const completeChars = testCase.entries
            .filter((e) => !isDeficient(e.deficiency))
            .map((e) => e.char);

          // "Process EVERY character": errors must cover ALL deficient
          // characters (not just the first), and no complete character.
          expect(errors.length).toBe(deficientChars.length);

          // Every deficient character appears with EXACTLY its implied fields.
          for (const { char, deficiency } of testCase.entries) {
            if (!isDeficient(deficiency)) {
              continue;
            }
            const err = errorByChar.get(char);
            expect(err).toBeDefined();
            if (err === undefined) {
              return;
            }
            expect(err.missingFields).toEqual(expectedMissingFields(deficiency));
            // No spurious prompt/override failures for a pure missing-field case.
            expect(err.promptFailure).toBeUndefined();
            expect(err.overrideError).toBeUndefined();
          }

          // No complete character leaks into the error list.
          for (const char of completeChars) {
            expect(errorByChar.has(char)).toBe(false);
          }
        } finally {
          rmSync(tempDir, { recursive: true, force: true });
        }
      }),
      { numRuns: 100 },
    );
  });
});
