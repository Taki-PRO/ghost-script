// Feature: ghost-game-core, Property 7: The interval ladder never skips a step on a clean review
// **Validates: Requirements 6.2, 6.8, 8.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { applyReview, type Outcome, type ReviewEntry } from './scheduler';

const ladderArb = fc
  .array(fc.integer({ min: 0, max: 1e10 }), { minLength: 1, maxLength: 8 })
  .map((a) => [...a].sort((x, y) => x - y));

const configArb: fc.Arbitrary<EngineConfig> = fc.oneof(
  fc.constant(DEFAULT_CONFIG),
  fc
    .tuple(ladderArb, fc.integer({ min: 0, max: 1e10 }))
    .map(([ladder, relearn]) => ({
      ...DEFAULT_CONFIG,
      intervalLadderMs: ladder,
      relearnDelayMs: relearn,
    })),
);

const nowArb = fc.integer({ min: 0, max: 4e12 });
const outcomeArb: fc.Arbitrary<Outcome> = fc.constantFrom('clean', 'struggled', 'gave-up');
const missArb: fc.Arbitrary<Outcome> = fc.constantFrom('struggled', 'gave-up');

describe('Property 7: ladder never skips a step on a clean review', () => {
  it('(a) single clean review advances exactly one step, capped at top', () => {
    fc.assert(
      fc.property(
        configArb,
        nowArb,
        fc.nat(),
        fc.integer({ min: 0, max: 4e12 }),
        outcomeArb,
        fc.array(fc.record({ outcome: outcomeArb, at: nowArb }), { maxLength: 4 }),
        (config, now, stepSeed, dueSeed, lastOutcome, history) => {
          const top = config.intervalLadderMs.length - 1;
          const s = stepSeed % (top + 1);
          const prior: ReviewEntry = { step: s, lastOutcome, nextDue: dueSeed, history };
          const result = applyReview(prior, 'clean', now, config);
          const expected = Math.min(s + 1, top);
          expect(result.step).toBe(expected);
          expect(result.nextDue).toBe(now + config.intervalLadderMs[expected]);

          const first = applyReview(undefined, 'clean', now, config);
          expect(first.step).toBe(0);
          expect(first.nextDue).toBe(now + config.intervalLadderMs[0]);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('(b) consecutive clean reviews climb one step at a time with non-decreasing intervals', () => {
    fc.assert(
      fc.property(
        configArb,
        nowArb,
        fc.option(missArb, { nil: undefined }),
        fc.array(fc.nat({ max: 1e10 }), { minLength: 1, maxLength: 15 }),
        (config, start, miss, gaps) => {
          const top = config.intervalLadderMs.length - 1;
          let entry: ReviewEntry | undefined = miss
            ? applyReview(undefined, miss, start, config)
            : undefined;
          let prevStep = entry ? entry.step : -1;
          let now = entry ? entry.nextDue : start;
          let prevInterval = -Infinity;

          for (const gap of gaps) {
            now += gap; // strictly later or equal to previous nextDue
            const next: ReviewEntry = applyReview(entry, 'clean', now, config);
            expect(next.step).toBe(Math.min(prevStep + 1, top));
            expect(next.step - prevStep).toBeLessThanOrEqual(1);
            expect(next.step).toBeGreaterThanOrEqual(prevStep);
            const interval = next.nextDue - now;
            expect(interval).toBe(config.intervalLadderMs[next.step]);
            expect(interval).toBeGreaterThanOrEqual(prevInterval);
            prevInterval = interval;
            prevStep = next.step;
            entry = next;
            now = next.nextDue;
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
