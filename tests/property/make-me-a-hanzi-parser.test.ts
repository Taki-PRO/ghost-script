// Feature: character-dataset, Property 7: Decomposition verbatim pass-through
//
// **Validates: Requirements 4.7**
//
// Property 7 (design.md): For any Make Me a Hanzi dictionary line that parses
// successfully, the pipeline stores the `decomposition` field (and
// `radical`/`etymology`/`matches`) structurally equal to the original parsed
// value — no fields added, removed, or modified — AND the computed
// `atomic`/`components` follow the documented rule:
//   - `atomic === decomposition.startsWith('？')` (U+FF1F)
//   - `components === [character]` when atomic, else `extractLeafComponents(decomposition)`.
//
// This also exercises the Properties 8 + 16 companion rule: `components` is
// computed by reusing the REAL `extractLeafComponents` as the expectation, so
// the test asserts the parser uses exactly that extraction rule.
//
// Approach:
//   1. Generate realistic raw Make Me a Hanzi line objects
//      ({ character, decomposition, radical, etymology, matches }).
//   2. Render each as a JSON line, join with '\n', parse with parseMakeMeAHanzi.
//   3. For each generated character assert verbatim pass-through of
//      decomposition / radical / etymology / matches, plus the atomic /
//      components rule.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  extractLeafComponents,
  parseMakeMeAHanzi,
} from '../../scripts/lib/parse-make-me-a-hanzi';
import type { Etymology } from '../../app/src/data/types';
import {
  arbitraryCharacter,
  arbitraryComponentCharacter,
} from '../helpers/arbitraries';

const QUESTION_MARK = '\uFF1F'; // ？ U+FF1F

/** Ideographic Description Characters U+2FF0–U+2FFB. */
const IDC_CHARS = [
  '\u2FF0',
  '\u2FF1',
  '\u2FF2',
  '\u2FF3',
  '\u2FF4',
  '\u2FF5',
  '\u2FF6',
  '\u2FF7',
  '\u2FF8',
  '\u2FF9',
  '\u2FFA',
  '\u2FFB',
] as const;

/** The exact raw-line shape parseMakeMeAHanzi consumes (required + optional fields). */
interface RawLine {
  character: string;
  decomposition: string;
  radical: string;
  etymology: Etymology | null;
  matches: (number[] | null)[] | null;
}

/** A valid Etymology variant, or null (mirrors the source's optional field). */
function arbitraryEtymology(): fc.Arbitrary<Etymology | null> {
  return fc.oneof(
    fc.constant<Etymology | null>(null),
    fc.record({
      type: fc.constantFrom<'ideographic' | 'pictographic'>(
        'ideographic',
        'pictographic',
      ),
      hint: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    fc.record({
      type: fc.constant<'pictophonetic'>('pictophonetic'),
      hint: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
        nil: null,
      }),
      phonetic: fc.option(arbitraryComponentCharacter(), { nil: null }),
      semantic: fc.option(arbitraryComponentCharacter(), { nil: null }),
    }),
  );
}

/** `matches`: null, or an array of (number[] | null) entries. */
function arbitraryMatches(): fc.Arbitrary<(number[] | null)[] | null> {
  return fc.option(
    fc.array(
      fc.option(fc.array(fc.integer({ min: 0, max: 10 }), { maxLength: 4 }), {
        nil: null,
      }),
      { maxLength: 4 },
    ),
    { nil: null },
  );
}

/**
 * A realistic IDS decomposition string:
 *   - atomic sentinel `？` alone, OR
 *   - an IDC + 2–3 component chars, occasionally with an interior `？`.
 */
function arbitraryDecompositionString(): fc.Arbitrary<string> {
  const atomic = fc.constant(QUESTION_MARK);
  const compound = fc
    .record({
      idc: fc.constantFrom(...IDC_CHARS),
      parts: fc.array(
        fc.oneof(
          { weight: 5, arbitrary: arbitraryComponentCharacter() },
          { weight: 1, arbitrary: fc.constant(QUESTION_MARK) },
        ),
        { minLength: 2, maxLength: 3 },
      ),
    })
    .map(({ idc, parts }) => idc + parts.join(''));

  return fc.oneof(
    { weight: 3, arbitrary: compound },
    { weight: 1, arbitrary: atomic },
  );
}

/** A realistic raw Make Me a Hanzi line object. */
function arbitraryRawLine(): fc.Arbitrary<RawLine> {
  return fc.record({
    character: arbitraryCharacter(),
    decomposition: arbitraryDecompositionString(),
    radical: arbitraryComponentCharacter(),
    etymology: arbitraryEtymology(),
    matches: arbitraryMatches(),
  });
}

/**
 * A list of raw lines with DISTINCT characters, so that every generated line
 * survives into the Map (parseMakeMeAHanzi keys by character; a duplicate
 * character would overwrite an earlier line).
 */
function arbitraryRawLines(): fc.Arbitrary<RawLine[]> {
  return fc
    .uniqueArray(arbitraryRawLine(), {
      minLength: 1,
      maxLength: 12,
      selector: (line) => line.character,
    });
}

describe('Property 7: decomposition verbatim pass-through', () => {
  it('stores decomposition/radical/etymology/matches verbatim and computes atomic/components by the documented rule', () => {
    fc.assert(
      fc.property(arbitraryRawLines(), (lines) => {
        const rawText = lines
          .map((line) => JSON.stringify(line))
          .join('\n');

        const parsed = parseMakeMeAHanzi(rawText);

        // Every distinct-character line must be present.
        expect(parsed.size).toBe(lines.length);

        for (const line of lines) {
          const entry = parsed.get(line.character);
          expect(entry).toBeDefined();
          if (entry === undefined) {
            return;
          }

          // Verbatim pass-through (byte-equal string / deep-equal structures).
          expect(entry.decomposition).toBe(line.decomposition);
          expect(entry.radical).toBe(line.radical);
          expect(entry.etymology).toEqual(line.etymology);
          expect(entry.matches).toEqual(line.matches);

          // atomic follows the documented startsWith('？') rule.
          const expectedAtomic = line.decomposition.startsWith(QUESTION_MARK);
          expect(entry.atomic).toBe(expectedAtomic);

          // components follows the documented rule, reusing the real extractor
          // as the expectation (Properties 7 + 8 + 16 companion).
          const expectedComponents = expectedAtomic
            ? [line.character]
            : extractLeafComponents(line.decomposition);
          expect(entry.components).toEqual(expectedComponents);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('defaults etymology and matches to null when absent from the raw line', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryDecompositionString(),
        arbitraryComponentCharacter(),
        (character, decomposition, radical) => {
          // Render a line object WITHOUT etymology / matches fields.
          const rawText = JSON.stringify({ character, decomposition, radical });

          const parsed = parseMakeMeAHanzi(rawText);
          const entry = parsed.get(character);

          expect(entry).toBeDefined();
          if (entry === undefined) {
            return;
          }

          expect(entry.decomposition).toBe(decomposition);
          expect(entry.radical).toBe(radical);
          // Absent optional fields default to null.
          expect(entry.etymology).toBeNull();
          expect(entry.matches).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
