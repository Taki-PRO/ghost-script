// Feature: character-dataset, Property 5: CC-CEDICT multi-entry deduplication preserves order
//
// **Validates: Requirements 4.3**
//
// Property 5 (design.md): For any sequence of CC-CEDICT entries for the SAME
// simplified character, the parsed flat `pinyin` array equals the list of
// DISTINCT pinyin strings in first-occurrence order, and the flat `meanings`
// array equals the DISTINCT meaning strings in first-occurrence order.
//
// Companion assertion (per-entry retention, task 8.3): `entries` holds one
// `CcCedictSense` per source line, in file order, each carrying its own reading
// and its own glosses (no cross-entry dedup).
//
// Approach: generate a single CJK character and 1..6 source LINES for it. Each
// line carries one reading and 1..4 glosses, with DUPLICATE readings across
// lines and DUPLICATE glosses within/across lines deliberately allowed so
// dedup is exercised. Render those lines into real CC-CEDICT text
// (`TRAD SIMP [reading] /g1/g2/`, same char for trad and simp, a `#` comment
// prepended), parse, then compare against an independently-computed expected
// value.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  parseCcCedict,
  type CcCedictSense,
} from '../../scripts/lib/parse-cc-cedict';
import {
  arbitraryCharacter,
  arbitraryMeaning,
  arbitraryPinyinSyllable,
} from '../helpers/arbitraries';

// A source LINE for a character: one reading + 1..4 glosses. Readings come from
// 1..3 numbered pinyin syllables (space-joined). Glosses come from
// `arbitraryMeaning`, which never emits a `/`, `[` or `]` that would break the
// surrounding CC-CEDICT delimiters (readings sit inside `[...]`, glosses sit
// between `/`), so rendering is always well-formed.
interface SourceLine {
  reading: string;
  glosses: string[];
}

function arbitrarySourceLine(): fc.Arbitrary<SourceLine> {
  return fc.record({
    reading: fc
      .array(arbitraryPinyinSyllable(), { minLength: 1, maxLength: 3 })
      .map((syllables) => syllables.join(' ')),
    glosses: fc.array(arbitraryMeaning(), { minLength: 1, maxLength: 4 }),
  });
}

// Render one source line in CC-CEDICT format, using the same char for the
// traditional and simplified fields (fine for this parser, which keys on the
// simplified field).
function renderLine(char: string, line: SourceLine): string {
  return `${char} ${char} [${line.reading}] /${line.glosses.join('/')}/`;
}

/** First-occurrence dedup, preserving order. */
function distinctInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

describe('Property 5: CC-CEDICT multi-entry deduplication preserves order', () => {
  it('flat pinyin and meanings are distinct in first-occurrence order; entries retain each source line', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        fc.array(arbitrarySourceLine(), { minLength: 1, maxLength: 6 }),
        (char: string, lines: SourceLine[]) => {
          // Render the lines into a real CC-CEDICT text block, with a leading
          // comment line (which the parser must skip).
          const text = [
            '# CC-CEDICT test block',
            ...lines.map((line) => renderLine(char, line)),
          ].join('\n');

          const parsed = parseCcCedict(text);
          const entry = parsed.get(char);

          // Exactly one simplified key (the single generated char) with an entry.
          expect(entry).toBeDefined();
          if (entry === undefined) {
            return;
          }

          // Expected flat pinyin: distinct readings in first-occurrence order.
          const expectedPinyin = distinctInOrder(lines.map((l) => l.reading));
          // Expected flat meanings: distinct glosses across all lines,
          // first-occurrence order (iterating lines in order, glosses in order).
          const expectedMeanings = distinctInOrder(
            lines.flatMap((l) => l.glosses),
          );

          expect(entry.pinyin).toEqual(expectedPinyin);
          expect(entry.meanings).toEqual(expectedMeanings);

          // Companion: one CcCedictSense per source line, in file order, each
          // with its own reading and its own glosses (no dedup here).
          const expectedEntries: CcCedictSense[] = lines.map((l) => ({
            reading: l.reading,
            meanings: l.glosses,
          }));
          expect(entry.entries).toEqual(expectedEntries);
        },
      ),
      { numRuns: 200 },
    );
  });
});
