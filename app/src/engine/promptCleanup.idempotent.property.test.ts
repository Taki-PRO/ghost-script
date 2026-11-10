// Feature: ghost-game-core, Property 3: Cleanup is idempotent
// **Validates: Requirements 4.6, 8.7**
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import characters from '../../public/data/characters.json';
import { cleanupMeaning } from './promptCleanup';

const NUM_RUNS = 500;

const glosses = ['three', 'mouth', 'to walk', 'one', 'a (article)', 'what', 'CL', 'pr.', 'Taiwan'];
const separators = ['; ', ', ', ' ', ';;', ' ; ', ';', ',', '', '\t', '\n', '  '];
const notes = [
  '(CL:个[ge4])',
  'CL:个[ge4]',
  '[shen2 me5]',
  '(e.g. 例子[li4 zi5] "x")',
  'Taiwan pr. [han4]',
  '(Taiwan pr. [han4])',
  'also pr. [yao1]',
  '(colloquial pr. [nei4])',
];
// Constructions where a pattern only appears after another note is removed.
const nested = [
  '(CL:a(b)c)',
  'CL(CL:x):y',
  '(e.g. (CL:z))',
  'C[x]L:y',
  'Taiwan pr[x]. [y]',
  '(Taiwan pr. [a]) pr. [b]',
  '[[x]]',
  '(( ))',
  'CCL:L:x',
  '(CL(CL:a):b)',
  'pr.[a] [b]',
  'Taiwan (CL:x)pr. [y]',
  '(e.g.(e.g. x))',
  '((CL:x)',
  'x)(CL:y',
  '[CL:x]',
  '[a[b]c]',
  '(CL:[x)])',
  ';(CL:x);',
  ' ; (CL:x) ; ',
  '(CL:x) ;; (e.g. y)',
];
const unbalanced = ['(', ')', '[', ']', '((', '))', '(CL:', '[x', 'x]', '(e.g.', '(Taiwan pr.', 'CL:'];

const fragment: fc.Arbitrary<string> = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom(...glosses) },
  { weight: 3, arbitrary: fc.constantFrom(...separators) },
  { weight: 4, arbitrary: fc.constantFrom(...notes) },
  { weight: 4, arbitrary: fc.constantFrom(...nested) },
  { weight: 2, arbitrary: fc.constantFrom(...unbalanced) },
  { weight: 1, arbitrary: fc.constantFrom(' ', '  ', '\t', '\n', '\u00a0', '\u3000') },
  { weight: 1, arbitrary: fc.string({ maxLength: 8 }) },
  { weight: 1, arbitrary: fc.string({ unit: 'binary', maxLength: 6 }) },
);

const meaningArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 6, arbitrary: fc.array(fragment, { maxLength: 10 }).map((p) => p.join('')) },
  // strings consisting only of notes
  {
    weight: 2,
    arbitrary: fc
      .array(fc.constantFrom(...notes, ...nested), { minLength: 1, maxLength: 5 })
      .map((p) => p.join(' ')),
  },
  // whitespace-only
  { weight: 1, arbitrary: fc.array(fc.constantFrom(' ', '\t', '\n', '\u3000'), { maxLength: 6 }).map((p) => p.join('')) },
  // arbitrary unicode
  { weight: 2, arbitrary: fc.string({ unit: 'binary', maxLength: 40 }) },
  { weight: 1, arbitrary: fc.string({ maxLength: 40 }) },
);

describe('Property 3: cleanupMeaning is idempotent', () => {
  it('cleanupMeaning(cleanupMeaning(x)) === cleanupMeaning(x) for generated meanings', () => {
    fc.assert(
      fc.property(meaningArb, (x) => {
        const once = cleanupMeaning(x);
        expect(cleanupMeaning(once)).toBe(once);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('is idempotent on every real prompt.meaning in characters.json', () => {
    const data = characters as unknown as Record<string, { prompt?: { meaning?: string } }>;
    const meanings = Object.values(data)
      .map((r) => r.prompt?.meaning)
      .filter((m): m is string => typeof m === 'string');
    expect(meanings.length).toBeGreaterThan(0);
    for (const m of meanings) {
      const once = cleanupMeaning(m);
      expect(cleanupMeaning(once), m).toBe(once);
    }
  });
});
