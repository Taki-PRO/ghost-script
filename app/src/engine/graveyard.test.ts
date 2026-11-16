import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { buildGraveyard, classifyEntry, cleanStreak } from './graveyard';
import { learningOrder } from './learningOrder';
import { applyReview } from './scheduler';
import type { ReviewEntry, ReviewHistory } from './scheduler';

const NOW = 1_000_000_000_000;
const C = DEFAULT_CONFIG;

describe('classifyEntry', () => {
  it('no entry is unmet', () => {
    expect(classifyEntry(undefined, NOW)).toBe('unmet');
  });

  it('a clean review just made is at-rest', () => {
    expect(classifyEntry(applyReview(undefined, 'clean', NOW, C), NOW)).toBe('at-rest');
  });

  it('a struggled review is restless even before the delay ends', () => {
    expect(classifyEntry(applyReview(undefined, 'struggled', NOW, C), NOW)).toBe('restless');
  });

  it('a gave-up review is restless', () => {
    expect(classifyEntry(applyReview(undefined, 'gave-up', NOW, C), NOW)).toBe('restless');
  });

  it('a clean ghost becomes restless once due', () => {
    const e = applyReview(undefined, 'clean', NOW, C);
    expect(classifyEntry(e, e.nextDue - 1)).toBe('at-rest');
    expect(classifyEntry(e, e.nextDue)).toBe('restless');
    expect(classifyEntry(e, e.nextDue + 1)).toBe('restless');
  });

  it('boundary: nextDue === now is restless, nextDue === now + 1 is at-rest', () => {
    const base = applyReview(undefined, 'clean', NOW, C);
    expect(classifyEntry({ ...base, nextDue: NOW }, NOW)).toBe('restless');
    expect(classifyEntry({ ...base, nextDue: NOW + 1 }, NOW)).toBe('at-rest');
  });

  it('non-finite nextDue counts as 0, so a clean ghost is restless', () => {
    const base = applyReview(undefined, 'clean', NOW, C);
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(classifyEntry({ ...base, nextDue: bad }, NOW)).toBe('restless');
    }
  });

  it('negative nextDue is restless', () => {
    const base = applyReview(undefined, 'clean', NOW, C);
    expect(classifyEntry({ ...base, nextDue: -5 }, NOW)).toBe('restless');
  });
});

describe('cleanStreak', () => {
  it('counts three clean attempts after a miss', () => {
    let e = applyReview(undefined, 'struggled', NOW, C);
    for (let i = 1; i <= 3; i++) e = applyReview(e, 'clean', NOW + i, C);
    expect(cleanStreak(e)).toBe(3);
  });

  it('is 0 when a miss is last', () => {
    let e = applyReview(undefined, 'clean', NOW, C);
    e = applyReview(e, 'gave-up', NOW + 1, C);
    expect(cleanStreak(e)).toBe(0);
  });

  it('without history: 1 when lastOutcome is clean, else 0', () => {
    expect(cleanStreak({ step: 0, lastOutcome: 'clean', nextDue: 1 })).toBe(1);
    expect(cleanStreak({ step: 0, lastOutcome: 'struggled', nextDue: 1 })).toBe(0);
  });

  it('empty history array is 0', () => {
    expect(cleanStreak({ step: 0, lastOutcome: 'clean', nextDue: 1, history: [] })).toBe(0);
  });
});

describe('buildGraveyard', () => {
  const dataset = new Map([
    ['三', { strokeCount: 3, summonInk: { class: 'opaque' as const } }],
    ['一', { strokeCount: 1, summonInk: { class: 'opaque' as const } }],
    ['大', { strokeCount: 3, summonInk: { class: 'opaque' as const } }],
    ['人', { strokeCount: 2, summonInk: { class: 'opaque' as const } }],
  ]);
  const order = learningOrder(dataset);
  const clean: ReviewEntry = applyReview(undefined, 'clean', NOW, C);
  const missed: ReviewEntry = applyReview(undefined, 'struggled', NOW, C);

  it('lists graves in learning order with 1-based positions', () => {
    const m = buildGraveyard(order, {}, NOW);
    expect(m.graves.map((g) => g.position)).toEqual([1, 2, 3, 4]);
  });

  it('classifies each state and counts sum to the dataset size', () => {
    const history: ReviewHistory = { 一: clean, 人: missed };
    const m = buildGraveyard(order, history, NOW);
    expect(m.counts).toEqual({ unmet: 2, restless: 1, 'at-rest': 1 });
    expect(m.counts.unmet + m.counts.restless + m.counts['at-rest']).toBe(dataset.size);
    expect(m.graves[0]).toMatchObject({ state: 'at-rest', char: '一', streak: 1 });
    expect(m.graves[1]).toMatchObject({ state: 'restless', char: '人', streak: 0 });
  });

  it('ignores history keys that are not in the order', () => {
    const m = buildGraveyard(order, { 龍: clean }, NOW);
    expect(m.graves).toHaveLength(4);
    expect(m.counts.unmet).toBe(4);
  });

  it('unmet graves carry no char, even when listed in the order', () => {
    const m = buildGraveyard(order, { 一: clean }, NOW);
    const unmet = m.graves.filter((g) => g.state === 'unmet');
    expect(unmet).toHaveLength(3);
    for (const g of unmet) {
      expect('char' in g).toBe(false);
      expect(Object.keys(g).sort()).toEqual(['position', 'state']);
    }
  });

  it('skips duplicates in the order (first wins)', () => {
    const m = buildGraveyard(['一', '人', '一'], {}, NOW);
    expect(m.graves).toHaveLength(2);
  });

  it('does not treat prototype properties as history entries', () => {
    const m = buildGraveyard(['constructor', 'toString', '__proto__'], {}, NOW);
    expect(m.counts).toEqual({ unmet: 3, restless: 0, 'at-rest': 0 });
  });

  it('empty order gives an empty model', () => {
    expect(buildGraveyard([], {}, NOW)).toEqual({
      graves: [],
      counts: { unmet: 0, restless: 0, 'at-rest': 0 },
    });
  });
});
