// Feature: ghost-game-core, Property 8: A missed review resets to step 0 with a 10-minute delay
// **Validates: Requirements 6.3, 8.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { applyReview, type Outcome, type ReviewEntry } from './scheduler';

const nowArb = fc.integer({ min: 0, max: 4e12 });
const missArb = fc.constantFrom<Outcome>('struggled', 'gave-up');
const anyOutcomeArb = fc.constantFrom<Outcome>('clean', 'struggled', 'gave-up');

const stepArb = fc.oneof(
  fc.integer({ min: 0, max: 5 }),
  fc.constantFrom(-3, 99, NaN),
);

const entryArb: fc.Arbitrary<ReviewEntry> = fc.record({
  step: stepArb,
  lastOutcome: anyOutcomeArb,
  nextDue: fc.integer({ min: 0, max: 5e12 }),
  history: fc.option(
    fc.array(
      fc.record({ outcome: anyOutcomeArb, at: fc.integer({ min: 0, max: 4e12 }) }),
      { maxLength: 5 },
    ),
    { nil: undefined },
  ),
});

const priorArb = fc.option(entryArb, { nil: undefined });

const ladderArb = fc
  .array(fc.integer({ min: 0, max: 1e10 }), { minLength: 1, maxLength: 8 })
  .map((xs) => [...xs].sort((a, b) => a - b));

const randomConfigArb: fc.Arbitrary<EngineConfig> = fc
  .record({
    intervalLadderMs: ladderArb,
    relearnDelayMs: fc.integer({ min: 0, max: 1e10 }),
  })
  .map((c) => ({ ...DEFAULT_CONFIG, ...c }));

const configArb = fc.oneof(fc.constant(DEFAULT_CONFIG), randomConfigArb);

describe('Property 8: missed review resets to step 0', () => {
  it('sets step 0, nextDue = now + relearnDelayMs, lastOutcome = outcome', () => {
    fc.assert(
      fc.property(priorArb, nowArb, missArb, configArb, (prior, now, outcome, config) => {
        const r = applyReview(prior, outcome, now, config);
        expect(r.step).toBe(0);
        expect(r.nextDue).toBe(now + config.relearnDelayMs);
        expect(r.lastOutcome).toBe(outcome);
      }),
      { numRuns: 300 },
    );
  });

  it('uses exactly 10 minutes (600000 ms) with DEFAULT_CONFIG', () => {
    fc.assert(
      fc.property(priorArb, nowArb, missArb, (prior, now, outcome) => {
        const r = applyReview(prior, outcome, now, DEFAULT_CONFIG);
        expect(r.nextDue - now).toBe(600_000);
        expect(r.step).toBe(0);
      }),
      { numRuns: 300 },
    );
  });

  it('a miss never lengthens the due date versus a clean review', () => {
    fc.assert(
      fc.property(priorArb, nowArb, missArb, configArb, (prior, now, outcome, config) => {
        fc.pre(config.relearnDelayMs <= config.intervalLadderMs[0]);
        const missed = applyReview(prior, outcome, now, config);
        const clean = applyReview(prior, 'clean', now, config);
        expect(missed.nextDue).toBeLessThanOrEqual(clean.nextDue);
      }),
      { numRuns: 300 },
    );
  });
});
