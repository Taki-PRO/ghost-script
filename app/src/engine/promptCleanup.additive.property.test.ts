// Feature: ghost-game-core, Property 2: Cleanup never adds text
// **Validates: Requirements 4.5, 8.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cleanupMeaning } from './promptCleanup';

const gloss = fc.constantFrom('three', 'mouth', 'to walk', 'what', 'fire; flame', 'a');
const separator = fc.constantFrom('; ', ', ', ' ', '\t', '\u00a0', ';', ',', '\n', '  ', ' \t ', '\u2003');
const note = fc.constantFrom(
  '(CL:个[ge4])',
  'CL:个[ge4]',
  '[shen2 me5]',
  '(e.g. 例子[li4 zi5] "x")',
  'Taiwan pr. [han4]',
  '(Taiwan pr. [han4])',
  'also pr. [yao1]',
  '(colloquial pr. [nei4])',
  '(CL:',
  '(e.g. (nested',
  '[unclosed',
  'closed]',
  ')',
  '(',
  '()',
  '( )',
  'pr. [',
  'CL:',
);
const whitespaceRun = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\u00a0', '\u2003', '\u3000', '\r'), { minLength: 1, maxLength: 6 })
  .map((a) => a.join(''));
const arbitrary = fc.oneof(fc.string({ maxLength: 8 }), fc.fullUnicodeString({ maxLength: 8 }));

const fragment = fc.oneof(gloss, separator, note, whitespaceRun, arbitrary);
const meaning = fc.array(fragment, { maxLength: 12 }).map((a) => a.join(''));
const input = fc.oneof(meaning, fc.string(), fc.fullUnicodeString());

function isSubsequence(sub: string[], full: string[]): boolean {
  let i = 0;
  for (const c of full) {
    if (i < sub.length && sub[i] === c) i++;
  }
  return i === sub.length;
}

describe('Property 2: Cleanup never adds text', () => {
  it('output code points are a subset of the input code points', () => {
    fc.assert(
      fc.property(input, (s) => {
        const inSet = new Set(Array.from(s));
        for (const c of cleanupMeaning(s)) {
          expect(inSet.has(c)).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('output is a subsequence of the input (code point order preserved)', () => {
    fc.assert(
      fc.property(input, (s) => {
        expect(isSubsequence(Array.from(cleanupMeaning(s)), Array.from(s))).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});
