import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, DEFAULT_CONFIG, type EngineConfig } from './config';
import { applyReview, nextDue, type Outcome, type ReviewEntry } from './scheduler';

const NOW = 1_700_000_000_000;
const TEN_MIN = 600_000;

function entry(step: number, overrides: Partial<ReviewEntry> = {}): ReviewEntry {
  return { step, lastOutcome: 'clean', nextDue: NOW - 1, ...overrides };
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    for (const v of Object.values(obj as Record<string, unknown>)) deepFreeze(v);
  }
  return obj;
}

describe('applyReview', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('first-ever clean review lands on step 0, due in 1 day', () => {
    const r = applyReview(undefined, 'clean', NOW, DEFAULT_CONFIG);
    expect(r.step).toBe(0);
    expect(r.nextDue).toBe(NOW + DAY_MS);
    expect(r.lastOutcome).toBe('clean');
    expect(r.history).toEqual([{ outcome: 'clean', at: NOW }]);
  });

  it.each([
    [0, 1, 3],
    [1, 2, 7],
    [2, 3, 14],
    [3, 4, 30],
    [4, 5, 60],
  ])('clean from step %i goes to step %i (%i days)', (from, to, days) => {
    const r = applyReview(entry(from), 'clean', NOW, DEFAULT_CONFIG);
    expect(r.step).toBe(to);
    expect(r.nextDue).toBe(NOW + days * DAY_MS);
  });

  it('clean at top step stays at 5 with 60 day interval', () => {
    const r = applyReview(entry(5), 'clean', NOW, DEFAULT_CONFIG);
    expect(r.step).toBe(5);
    expect(r.nextDue).toBe(NOW + 60 * DAY_MS);
  });

  it.each<Outcome>(['struggled', 'gave-up'])('%s resets step 4 to step 0, due in 10 minutes', (outcome) => {
    const r = applyReview(entry(4), outcome, NOW, DEFAULT_CONFIG);
    expect(r.step).toBe(0);
    expect(r.nextDue).toBe(NOW + TEN_MIN);
    expect(r.lastOutcome).toBe(outcome);
  });

  it.each<Outcome>(['struggled', 'gave-up'])('first-ever %s gives step 0, due in 10 minutes', (outcome) => {
    const r = applyReview(undefined, outcome, NOW, DEFAULT_CONFIG);
    expect(r.step).toBe(0);
    expect(r.nextDue).toBe(NOW + TEN_MIN);
    expect(r.history).toEqual([{ outcome, at: NOW }]);
  });

  it('clean after a miss lands on step 0 (1 day)', () => {
    const missed = applyReview(entry(4), 'struggled', NOW, DEFAULT_CONFIG);
    const later = NOW + TEN_MIN;
    const r = applyReview(missed, 'clean', later, DEFAULT_CONFIG);
    expect(r.step).toBe(0);
    expect(r.nextDue).toBe(later + DAY_MS);
  });

  it.each<Outcome>(['struggled', 'gave-up'])(
    'clean after a hand-built %s entry at step 4 lands on step 0 (1 day)',
    (lastOutcome) => {
      const r = applyReview(entry(4, { lastOutcome }), 'clean', NOW, DEFAULT_CONFIG);
      expect(r.step).toBe(0);
      expect(r.nextDue).toBe(NOW + DAY_MS);
    },
  );

  it('clean after a clean still advances by one (step 2 -> 3, 14 days)', () => {
    const r = applyReview(entry(2, { lastOutcome: 'clean' }), 'clean', NOW, DEFAULT_CONFIG);
    expect(r.step).toBe(3);
    expect(r.nextDue).toBe(NOW + 14 * DAY_MS);
  });

  it('sequence miss -> clean -> clean -> clean gives steps 0, 0, 1, 2', () => {
    const steps: number[] = [];
    let e = applyReview(entry(3), 'struggled', NOW, DEFAULT_CONFIG);
    steps.push(e.step);
    let t = NOW;
    for (let i = 0; i < 3; i++) {
      t += DAY_MS;
      e = applyReview(e, 'clean', t, DEFAULT_CONFIG);
      steps.push(e.step);
    }
    expect(steps).toEqual([0, 0, 1, 2]);
  });

  it('appends history newest-last without mutating the prior entry', () => {
    const prior = deepFreeze(
      entry(2, { history: [{ outcome: 'struggled', at: NOW - 2 }, { outcome: 'clean', at: NOW - 1 }] }),
    );
    const snapshot = JSON.parse(JSON.stringify(prior));
    let r: ReviewEntry | undefined;
    expect(() => {
      r = applyReview(prior, 'gave-up', NOW, DEFAULT_CONFIG);
    }).not.toThrow();
    expect(r?.history).toEqual([
      { outcome: 'struggled', at: NOW - 2 },
      { outcome: 'clean', at: NOW - 1 },
      { outcome: 'gave-up', at: NOW },
    ]);
    expect(prior).toEqual(snapshot);
    expect(prior.history).toHaveLength(2);
  });

  it('is pure and does not read the real clock', () => {
    const prior = entry(1);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2001-01-01T00:00:00Z'));
    const a = applyReview(prior, 'clean', NOW, DEFAULT_CONFIG);
    vi.setSystemTime(new Date('2099-12-31T00:00:00Z'));
    const b = applyReview(prior, 'clean', NOW, DEFAULT_CONFIG);
    expect(a).toEqual(b);
    expect(a.nextDue).toBe(NOW + 7 * DAY_MS);
    expect(a.history).toEqual([{ outcome: 'clean', at: NOW }]);
  });

  it.each([
    [99, 5, 60],
    [-3, 1, 3],
    [NaN, 1, 3],
  ])('clamps corrupt prior step %s without throwing', (bad, step, days) => {
    let r: ReviewEntry | undefined;
    expect(() => {
      r = applyReview(entry(bad), 'clean', NOW, DEFAULT_CONFIG);
    }).not.toThrow();
    expect(r?.step).toBe(step);
    expect(r?.nextDue).toBe(NOW + days * DAY_MS);
  });

  it('does not throw with an empty ladder and gives nextDue === now', () => {
    const cfg: EngineConfig = { ...DEFAULT_CONFIG, intervalLadderMs: [] };
    let first: ReviewEntry | undefined;
    let again: ReviewEntry | undefined;
    expect(() => {
      first = applyReview(undefined, 'clean', NOW, cfg);
      again = applyReview(entry(3), 'clean', NOW, cfg);
    }).not.toThrow();
    expect(first?.nextDue).toBe(NOW);
    expect(again?.nextDue).toBe(NOW);
  });
});

describe('nextDue', () => {
  it('returns the entry nextDue', () => {
    expect(nextDue(entry(0, { nextDue: NOW + 5 }))).toBe(NOW + 5);
  });

  it('never returns a negative number', () => {
    expect(nextDue(entry(0, { nextDue: -5 }))).toBe(0);
  });
});
