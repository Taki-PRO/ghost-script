// Feature: ghost-game-core, Property 12: The learning order is a deterministic, stroke-count-sorted permutation of the dataset
// **Validates: Requirements 6.12, 8.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { learningOrder } from './learningOrder';

const bmpChar = fc.integer({ min: 0x4e00, max: 0x9fff }).map((c) => String.fromCodePoint(c));
const astralChar = fc.integer({ min: 0x20000, max: 0x2a6df }).map((c) => String.fromCodePoint(c));
const charArb = fc.oneof(bmpChar, astralChar);

const entriesArb = fc.uniqueArray(
  fc.tuple(charArb, fc.integer({ min: 1, max: 6 })),
  { minLength: 0, maxLength: 60, selector: ([ch]) => ch },
);

const cp = (s: string): number => s.codePointAt(0) as number;

describe('learningOrder property', () => {
  it('is a deterministic, stroke-count-sorted permutation of the dataset', () => {
    fc.assert(
      fc.property(
        entriesArb.chain((entries) =>
          fc.tuple(
            fc.constant(entries),
            fc.shuffledSubarray(entries, { minLength: entries.length, maxLength: entries.length }),
          ),
        ),
        ([entries, shuffled]) => {
          const dataset = new Map(entries.map(([c, n]) => [c, { strokeCount: n }]));
          const before = [...dataset.entries()];
          const out = learningOrder(dataset);

          // (a) permutation
          expect(out.length).toBe(dataset.size);
          expect(new Set(out).size).toBe(out.length);
          for (const k of out) expect(dataset.has(k)).toBe(true);
          for (const k of dataset.keys()) expect(out).toContain(k);

          // (b) non-decreasing strokeCount, (c) codepoint tie-break
          for (let i = 1; i < out.length; i++) {
            const a = dataset.get(out[i - 1])!.strokeCount;
            const b = dataset.get(out[i])!.strokeCount;
            expect(a).toBeLessThanOrEqual(b);
            if (a === b) expect(cp(out[i - 1])).toBeLessThan(cp(out[i]));
          }

          // (d) determinism, independent of insertion order
          expect(learningOrder(dataset)).toEqual(out);
          const shuffledMap = new Map(shuffled.map(([c, n]) => [c, { strokeCount: n }]));
          expect(learningOrder(shuffledMap)).toEqual(out);

          // (e) input not mutated
          expect([...dataset.entries()]).toEqual(before);
        },
      ),
      { numRuns: 300 },
    );
  });
});
