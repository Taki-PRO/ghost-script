// Feature: ghost-game-core, Property 1: Cleanup never returns an empty string
// **Validates: Requirements 4.4, 8.7**
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cleanupMeaning } from './promptCleanup';

const gloss = fc.constantFrom('three', 'mouth', 'to walk', 'surname Li', 'big', 'water');
const separator = fc.constantFrom('; ', ', ', ' ', ';', '  ', '\t');
const note = fc.constantFrom(
  '(CL:个[ge4])',
  'CL:个[ge4]',
  '[shen2 me5]',
  '(e.g. 例子[li4 zi5] "x")',
  'Taiwan pr. [han4]',
  '(Taiwan pr. [han4])',
  'also pr. [yao1]',
  '(colloquial pr. [nei4])',
);
const edge = fc.oneof(
  note, // notes only: cleanup would empty these, exercising the fallback
  fc.constantFrom(' ', '  ', '\t', '\n', ' \u3000 '), // whitespace only
  fc.constantFrom('(', ')', '[', ']', '((', '))', '[[', ']]', '(CL:', '[x', 'CL:', '(e.g. ', ') ]'),
  fc.fullUnicodeString({ maxLength: 8 }),
  fc.string({ maxLength: 8 }),
);

const fragment = fc.oneof(gloss, separator, note, edge);
const realistic = fc.array(fragment, { minLength: 1, maxLength: 8 }).map((a) => a.join(''));
const onlyNotes = fc.array(fc.tuple(note, separator), { minLength: 1, maxLength: 4 }).map((a) => a.map(([n, s]) => n + s).join(''));

const input = fc
  .oneof(realistic, onlyNotes, fc.string({ minLength: 1 }), fc.fullUnicodeString({ minLength: 1 }))
  .filter((s) => s.length > 0);

describe('Property 1: cleanupMeaning never returns an empty string', () => {
  it('returns a non-empty string for any non-empty input', () => {
    fc.assert(
      fc.property(input, (s) => {
        const out = cleanupMeaning(s);
        expect(typeof out).toBe('string');
        expect(out.length).toBeGreaterThan(0);
        if (s.trim() !== '') {
          // Not whitespace-only unless the input was whitespace-only.
          expect(out.trim()).not.toBe('');
        } else {
          // Whitespace-only input falls back to the original.
          expect(out).toBe(s);
        }
      }),
      { numRuns: 500 },
    );
  });
});
