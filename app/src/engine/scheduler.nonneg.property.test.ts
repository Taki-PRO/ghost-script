// Feature: ghost-game-core, Property 5: Intervals and next-due offsets are never negative
// **Validates: Requirements 6.4, 8.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { applyReview, nextDue, type Outcome, type ReviewEntry } from './scheduler';

const nowArb = fc.integer({ min: 0, max: 4_000_000_000_000 });
const outcomeArb = fc.constantFrom<Outcome>('clean', 'struggled', 'gave-up');

const historyArb = fc.option(
  fc.array(fc.record({ outcome: outcomeArb, at: fc.integer({ min: 0, max: 4_000_000_000_000 }) }), {
    maxLength: 5,
  }),
  { nil: undefined },
);

const validEntryArb: fc.Arbitrary<ReviewEntry> = fc.record({
  step: fc.integer({ min: 0, max: 5 }),
  lastOutcome: outcomeArb,
  nextDue: fc.integer({ min: 0, max: 5e12 }),
  history: historyArb,
});

const corruptEntryArb: fc.Arbitrary<ReviewEntry> = fc.record({
  step: fc.oneof(
    fc.integer({ min: -1000, max: -1 }),
    fc.integer({ min: 6, max: 1000 }),
    fc.constant(Number.NaN),
    fc.constant(Number.POSITIVE_INFINITY),
    fc.constant(Number.NEGATIVE_INFINITY),
  ),
  lastOutcome: outcomeArb,
  nextDue: fc.integer({ min: 0, max: 5e12 }),
  history: historyArb,
});

const priorArb: fc.Arbitrary<ReviewEntry | undefined> = fc.oneof(
  fc.constant(undefined),
  validEntryArb,
  corruptEntryArb,
);

const randomConfigArb: fc.Arbitrary<EngineConfig> = fc
  .record({
    ladder: fc
      .array(fc.integer({ min: 0, max: 1e10 }), { minLength: 1, maxLength: 8 })
      .map((a) => [...a].sort((x, y) => x - y)),
    relearn: fc.integer({ min: 0, max: 1e10 }),
  })
  .map(({ ladder, relearn }) => ({
    ...DEFAULT_CONFIG,
    intervalLadderMs: ladder,
    relearnDelayMs: relearn,
  }));

const hostileNumberArb = fc.oneof(
  fc.integer({ min: -1e10, max: -1 }),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.integer({ min: 0, max: 1e10 }),
);

const hostileConfigArb: fc.Arbitrary<EngineConfig> = fc
  .record({
    ladder: fc.array(hostileNumberArb, { minLength: 0, maxLength: 8 }),
    relearn: hostileNumberArb,
  })
  .map(({ ladder, relearn }) => ({
    ...DEFAULT_CONFIG,
    intervalLadderMs: ladder,
    relearnDelayMs: relearn,
  }));

const configArb: fc.Arbitrary<EngineConfig> = fc.oneof(
  fc.constant(DEFAULT_CONFIG),
  randomConfigArb,
  hostileConfigArb,
);

/** Clamp a raw configured interval the way Req 6.4 requires: finite and >= 0. */
function clampInterval(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  return Math.max(0, raw);
}

describe('Property 5: intervals and next-due offsets are never negative', () => {
  it('applyReview never yields a negative offset and uses the clamped ladder/relearn interval', () => {
    fc.assert(
      fc.property(priorArb, outcomeArb, nowArb, configArb, (prior, outcome, now, config) => {
        const result = applyReview(prior, outcome, now, config);
        const offset = result.nextDue - now;

        // Applied offset is non-negative.
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(result.nextDue)).toBe(true);

        // Chosen interval: ladder[step] when clean, relearn delay otherwise.
        const chosen =
          outcome === 'clean'
            ? config.intervalLadderMs[result.step]
            : config.relearnDelayMs;
        expect(offset).toBe(clampInterval(chosen));
        expect(clampInterval(chosen)).toBeGreaterThanOrEqual(0);

        // nextDue() accessor is never negative.
        expect(nextDue(result)).toBeGreaterThanOrEqual(0);

        // Step stays a valid ladder index.
        expect(Number.isInteger(result.step)).toBe(true);
        expect(result.step).toBeGreaterThanOrEqual(0);
        expect(result.step).toBeLessThanOrEqual(Math.max(0, config.intervalLadderMs.length - 1));
      }),
      { numRuns: 300 },
    );
  });
});
