// Feature: ghost-game-core, Property 4: A missed character is never scheduled later than a clean one with the same history
// **Validates: Requirements 6.9, 8.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DAY_MS, DEFAULT_CONFIG, type EngineConfig } from './config';
import {
  applyReview,
  selectSession,
  type Outcome,
  type ReviewEntry,
  type ReviewHistory,
} from './scheduler';

const missArb = fc.constantFrom<Outcome>('struggled', 'gave-up');
const anyOutcomeArb = fc.constantFrom<Outcome>('clean', 'struggled', 'gave-up');
const nowArb = fc.integer({ min: 0, max: 4e12 });

const entryArb: fc.Arbitrary<ReviewEntry> = fc.record({
  step: fc.integer({ min: 0, max: 5 }),
  lastOutcome: anyOutcomeArb,
  nextDue: fc.integer({ min: 0, max: 5e12 }),
});
const priorArb = fc.option(entryArb, { nil: undefined });

// Random configs where the relearn delay is strictly smaller than ladder[0].
const randomConfigArb: fc.Arbitrary<EngineConfig> = fc
  .record({
    first: fc.integer({ min: 1, max: 1e10 }),
    rest: fc.array(fc.integer({ min: 0, max: 1e10 }), { maxLength: 5 }),
    relearnFrac: fc.double({ min: 0, max: 0.99, noNaN: true }),
  })
  .map(({ first, rest, relearnFrac }) => {
    const tail = [...rest.map((x) => first + x)].sort((a, b) => a - b);
    return {
      ...DEFAULT_CONFIG,
      intervalLadderMs: [first, ...tail],
      relearnDelayMs: Math.min(first - 1, Math.floor(first * relearnFrac)),
    };
  });
const configArb = fc.oneof(fc.constant(DEFAULT_CONFIG), randomConfigArb);

describe('Property 4: missed is never scheduled later than clean', () => {
  it('review level: miss nextDue <= clean nextDue for the same prior', () => {
    fc.assert(
      fc.property(priorArb, nowArb, missArb, configArb, (prior, now, miss, cfg) => {
        const missed = applyReview(prior, miss, now, cfg);
        const clean = applyReview(prior, 'clean', now, cfg);
        expect(missed.nextDue).toBeLessThanOrEqual(clean.nextDue);
      }),
      { numRuns: 300 },
    );
  });

  it('selection level: X (missed) is selected whenever Y (clean) is, and ordered before it', () => {
    const scenarioArb = fc
      .record({
        prior: priorArb,
        t: fc.integer({ min: 0, max: 1e12 }),
        miss: missArb,
        offset: fc.integer({ min: 0, max: 90 * DAY_MS }),
        others: fc.array(
          fc.record({
            entry: fc.option(
              fc.record({
                step: fc.integer({ min: 0, max: 5 }),
                lastOutcome: anyOutcomeArb,
                // Relative to t so others land in due and not-yet-due bands.
                rel: fc.integer({ min: -90 * DAY_MS, max: 90 * DAY_MS }),
              }),
              { nil: undefined },
            ),
          }),
          { maxLength: 15 },
        ),
        extraNew: fc.integer({ min: 0, max: 8 }),
      })
      .chain((s) => {
        const total = 2 + s.others.length + s.extraNew;
        const names = Array.from({ length: total }, (_, i) => (i === 0 ? 'X' : i === 1 ? 'Y' : `o${i}`));
        return fc
          .shuffledSubarray(names, { minLength: total, maxLength: total })
          .map((list) => ({ ...s, list }));
      });

    fc.assert(
      fc.property(scenarioArb, ({ prior, t, miss, offset, others, list }) => {
        const cfg = DEFAULT_CONFIG;
        const history: Record<string, ReviewEntry> = {
          X: applyReview(prior, miss, t, cfg),
          Y: applyReview(prior, 'clean', t, cfg),
        };
        others.forEach((o, i) => {
          if (o.entry) {
            history[`o${i + 2}`] = {
              step: o.entry.step,
              lastOutcome: o.entry.lastOutcome,
              nextDue: Math.max(0, t + o.entry.rel),
            };
          }
        });
        const now = t + offset;
        const session = selectSession(history as ReviewHistory, list, now, cfg);
        const ix = session.indexOf('X');
        const iy = session.indexOf('Y');
        if (iy !== -1) {
          expect(ix).not.toBe(-1);
          expect(ix).toBeLessThan(iy);
        }
      }),
      { numRuns: 500 },
    );
  });
});
