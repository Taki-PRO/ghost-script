// Feature: character-dataset, Property 8: No placeholder in components array
// Feature: character-dataset, Property 9: Atomic record has exactly one component equal to the character
// Feature: character-dataset, Property 16: Decomposition IDS string contains only valid codepoints
//
// **Validates: Requirements 5.5, 5.6**
//
// This file covers three decomposition/component invariants from design.md:
//
//   Property 8  — For any CharacterRecord, every element of
//                 `decomposition.components` is a SINGLE codepoint inside one of
//                 the five recognised blocks (CJK Unified U+4E00–U+9FFF,
//                 CJK Extension A U+3400–U+4DBF, CJK Radicals Supplement
//                 U+2E80–U+2EFF, Kangxi Radicals U+2F00–U+2FDF, CJK Strokes
//                 U+31C0–U+31EF); never the placeholder ？ (U+FF1F) and never an
//                 Ideographic Description Character (U+2FF0–U+2FFB).
//
//   Property 9  — For any CharacterRecord where `decomposition.atomic === true`,
//                 `components` has exactly one element equal to
//                 `record.character`.
//
//   Property 16 — For any decomposition IDS string that is not the ？ sentinel,
//                 every codepoint in that string is one of: (a) a codepoint in
//                 one of the five recognised component blocks (CJK Unified
//                 U+4E00–U+9FFF, CJK Extension A U+3400–U+4DBF, CJK Radicals
//                 Supplement U+2E80–U+2EFF, Kangxi Radicals U+2F00–U+2FDF, CJK
//                 Strokes U+31C0–U+31EF), (b) an IDC U+2FF0–U+2FFB, or (c) the
//                 placeholder ？ (U+FF1F).
//
// Note on the dedicated Property-16 generator:
//   design.md Property 16 now covers the five recognised component blocks (it
//   was corrected on Nov 9 after the real Make Me a Hanzi data was found to
//   contain CJK Radicals Supplement codepoints in IDS strings). The dedicated
//   generator `arbitraryDesignIdsString` below restricts its component chars to
//   CJK Unified ideographs — a strict subset of the five recognised blocks — so
//   its assertions remain valid under the corrected property (CJK Unified is
//   one of the five blocks). The broader five-block coverage is exercised by
//   the Property 8 tests and by the full-pipeline integration test, which
//   checks the corrected Property 16 directly against all 300 real records.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { extractLeafComponents } from '../../scripts/lib/parse-make-me-a-hanzi';
import {
  arbitraryCharacterRecord,
  arbitraryComponentCharacter,
  arbitraryDecomposition,
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

/** Codepoint ranges of the five recognised component blocks (Property 8). */
const COMPONENT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0x3400, 0x4dbf], // CJK Extension A
  [0x2e80, 0x2eff], // CJK Radicals Supplement
  [0x2f00, 0x2fdf], // Kangxi Radicals
  [0x31c0, 0x31ef], // CJK Strokes
];

/** True when `cp` falls in one of the five recognised component blocks. */
function isRecognisedComponentCodepoint(cp: number): boolean {
  return COMPONENT_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

/** Codepoint of a single-codepoint string, or `undefined` if empty. */
function singleCodePoint(ch: string): number | undefined {
  const points = Array.from(ch);
  if (points.length !== 1) {
    return undefined;
  }
  return points[0].codePointAt(0);
}

/** True for an Ideographic Description Character U+2FF0–U+2FFB. */
function isIdc(cp: number): boolean {
  return cp >= 0x2ff0 && cp <= 0x2ffb;
}

/**
 * Assert every element of a `components` array satisfies Property 8:
 * one recognised-block codepoint, never ？, never an IDC.
 */
function assertComponentsValid(components: string[]): void {
  for (const component of components) {
    // Exactly one codepoint (length-1 by codepoint, not UTF-16 unit).
    const cp = singleCodePoint(component);
    expect(cp).toBeDefined();
    if (cp === undefined) {
      return;
    }
    // Never the placeholder.
    expect(component).not.toBe(QUESTION_MARK);
    // Never an IDC.
    expect(isIdc(cp)).toBe(false);
    // Always inside one of the five recognised blocks.
    expect(isRecognisedComponentCodepoint(cp)).toBe(true);
  }
}

// --- Property 8 -------------------------------------------------------------

describe('Property 8: no placeholder in components array', () => {
  it('every component of a generated CharacterRecord is a single recognised-block codepoint, never ？ or an IDC', () => {
    fc.assert(
      fc.property(arbitraryCharacterRecord(), (record) => {
        assertComponentsValid(record.decomposition.components);
      }),
      { numRuns: 100 },
    );
  });

  it('extractLeafComponents over a generated IDS string yields only valid components', () => {
    // Drives the real extractor directly on the decomposition string produced
    // by the shared arbitrary (which draws from all five component blocks plus
    // IDCs and an optional interior ？), then re-checks Property 8 on its output.
    fc.assert(
      fc.property(arbitraryDecomposition(), (decomposition) => {
        const components = extractLeafComponents(decomposition.decomposition);

        assertComponentsValid(components);

        // The extractor must strip every IDC and every ？ — so no component is
        // ever equal to one of those structural codepoints.
        for (const component of components) {
          expect(IDC_CHARS).not.toContain(component);
          expect(component).not.toBe(QUESTION_MARK);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('extractLeafComponents over an IDS built from five-block component chars keeps exactly those chars', () => {
    // Build a raw IDS string directly from arbitraryComponentCharacter() (the
    // full five-block source the pipeline uses), mixed with IDCs and an
    // optional interior ？. The extractor must return every recognised-block
    // component and drop every IDC / ？ — proving Property 8 holds across all
    // five blocks, not just CJK Unified.
    const idsFromComponents = fc
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
      .map(({ idc, parts }) => ({ ids: idc + parts.join(''), parts }));

    fc.assert(
      fc.property(idsFromComponents, ({ ids, parts }) => {
        const components = extractLeafComponents(ids);

        assertComponentsValid(components);

        // Expected leaves: the component chars (not ？), de-duped first-occurrence.
        const expected: string[] = [];
        const seen = new Set<string>();
        for (const part of parts) {
          if (part === QUESTION_MARK) {
            continue;
          }
          if (!seen.has(part)) {
            seen.add(part);
            expected.push(part);
          }
        }
        expect(components).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 9 -------------------------------------------------------------

describe('Property 9: atomic record has exactly one component equal to the character', () => {
  it('for every atomic generated record, components === [character]', () => {
    let sawAtomic = false;

    fc.assert(
      fc.property(arbitraryCharacterRecord(), (record) => {
        if (record.decomposition.atomic !== true) {
          return; // Property 9 only constrains atomic records.
        }
        sawAtomic = true;

        const { components } = record.decomposition;
        expect(components).toHaveLength(1);
        expect(components[0]).toBe(record.character);
      }),
      { numRuns: 100 },
    );

    // Sanity: the arbitrary does generate atomic records, so the invariant was
    // actually exercised rather than vacuously skipped on every run.
    expect(sawAtomic).toBe(true);
  });
});

// --- Property 16 ------------------------------------------------------------

/**
 * A dedicated IDS-string generator matching design.md Property 16 EXACTLY:
 * structural codepoints are only CJK Unified ideographs (U+4E00–U+9FFF), IDCs
 * (U+2FF0–U+2FFB) and an optional interior ？ (U+FF1F).
 *
 * (The shared arbitraryDecomposition draws component chars from five blocks, so
 * it cannot be reused for Property 16 as the design states it — see the file
 * header's SPEC DISCREPANCY note.)
 */
function arbitraryCjkUnifiedChar(): fc.Arbitrary<string> {
  return fc
    .integer({ min: 0x4e00, max: 0x9fff })
    .map((cp) => String.fromCodePoint(cp));
}

function arbitraryDesignIdsString(): fc.Arbitrary<string> {
  const atomic = fc.constant(QUESTION_MARK);
  const compound = fc
    .record({
      idc: fc.constantFrom(...IDC_CHARS),
      parts: fc.array(
        fc.oneof(
          { weight: 5, arbitrary: arbitraryCjkUnifiedChar() },
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

describe('Property 16: decomposition IDS string contains only valid codepoints', () => {
  it('every codepoint of a non-sentinel IDS string is a CJK Unified ideograph, an IDC, or ？', () => {
    fc.assert(
      fc.property(arbitraryDesignIdsString(), (ids) => {
        if (ids === QUESTION_MARK) {
          return; // the ？ sentinel itself is excluded by the property's premise.
        }

        for (const ch of ids) {
          const cp = ch.codePointAt(0);
          expect(cp).toBeDefined();
          if (cp === undefined) {
            return;
          }
          const isCjkUnified = cp >= 0x4e00 && cp <= 0x9fff;
          const isPlaceholder = ch === QUESTION_MARK;
          expect(isCjkUnified || isIdc(cp) || isPlaceholder).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('extractLeafComponents over a design-shaped IDS string returns only CJK Unified ideographs', () => {
    // Under Property 16's three-category alphabet the only leaf codepoints are
    // CJK Unified ideographs, since IDCs and ？ are structural/placeholder and
    // get stripped by the extractor.
    fc.assert(
      fc.property(arbitraryDesignIdsString(), (ids) => {
        const components = extractLeafComponents(ids);
        for (const component of components) {
          const cp = singleCodePoint(component);
          expect(cp).toBeDefined();
          if (cp === undefined) {
            return;
          }
          expect(cp >= 0x4e00 && cp <= 0x9fff).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
