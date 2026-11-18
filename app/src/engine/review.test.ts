import { describe, expect, it } from 'vitest';
import { DAY_MS, DEFAULT_CONFIG } from './config';
import {
  planReview,
  recordReview,
  restlessCharacters,
  restlessCount,
  reviewCountLine,
  reviewPool,
  REVIEW_RESULT_TEXT,
} from './review';
import type { Outcome, ReviewEntry, ReviewHistory } from './scheduler';

const NOW = 1_000_000_000_000;

function entry(lastOutcome: Outcome, nextDue: number, step = 2): ReviewEntry {
  return { step, lastOutcome, nextDue, history: [{ outcome: lastOutcome, at: nextDue - DAY_MS }] };
}

describe('restless definition (R10.29)', () => {
  const history: ReviewHistory = {
    甲: entry('struggled', NOW + 5 * DAY_MS),
    乙: entry('gave-up', NOW + 5 * DAY_MS),
    丙: entry('clean', NOW - 1),
    丁: entry('clean', NOW),
    戊: entry('clean', NOW + 1),
  };

  it('counts a missed ghost, even when not due', () => {
    expect(restlessCharacters(history, NOW)).toEqual(expect.arrayContaining(['甲', '乙']));
  });
  it('counts a clean ghost that is due, at or before now', () => {
    const r = restlessCharacters(history, NOW);
    expect(r).toContain('丙');
    expect(r).toContain('丁');
  });
  it('does not count a clean ghost that is not due', () => {
    expect(restlessCharacters(history, NOW)).not.toContain('戊');
  });
  it('does not count a ghost with no entry', () => {
    expect(restlessCharacters({}, NOW)).toEqual([]);
    expect(restlessCount(history, NOW)).toBe(4);
  });
  it('limits the count to known characters', () => {
    expect(restlessCount(history, NOW, new Set(['甲', '戊', '无']))).toBe(1);
  });
});

describe('pool and plan (R10.30)', () => {
  it('orders the pool by level, then learning order, without duplicates', () => {
    const history: ReviewHistory = {
      a: entry('struggled', NOW),
      b: entry('struggled', NOW),
      c: entry('struggled', NOW),
      d: entry('struggled', NOW),
      e: entry('clean', NOW + DAY_MS),
    };
    const orders = [
      ['c', 'x', 'a', 'e'],
      ['b', 'a', 'd'],
    ];
    expect(reviewPool(orders, history, NOW)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('puts due ghosts first, most overdue first, then not-due soonest first', () => {
    const history: ReviewHistory = {
      late: entry('struggled', NOW + 3 * DAY_MS),
      soon: entry('struggled', NOW + DAY_MS),
      newer: entry('clean', NOW - 10),
      older: entry('clean', NOW - 1000),
    };
    const orders = [['late', 'soon', 'newer', 'older']];
    expect(planReview(orders, history, NOW, DEFAULT_CONFIG)).toEqual([
      'older',
      'newer',
      'soon',
      'late',
    ]);
  });

  it('caps the plan at 10 with a pool of 11', () => {
    const chars = Array.from({ length: 11 }, (_, i) => `g${i}`);
    const history: ReviewHistory = Object.fromEntries(
      chars.map((c, i) => [c, entry('struggled', NOW - i)]),
    );
    const plan = planReview([chars], history, NOW, DEFAULT_CONFIG);
    expect(plan).toHaveLength(10);
    expect(plan).not.toContain('g0');
  });

  it('uses every ghost when the pool holds fewer than 10', () => {
    const history: ReviewHistory = {
      a: entry('struggled', NOW),
      b: entry('gave-up', NOW),
      c: entry('struggled', NOW),
    };
    expect(planReview([['a', 'b', 'c']], history, NOW, DEFAULT_CONFIG)).toHaveLength(3);
  });

  it('plans nothing when nothing is restless', () => {
    expect(planReview([['a']], { a: entry('clean', NOW + DAY_MS) }, NOW, DEFAULT_CONFIG)).toEqual(
      [],
    );
  });
});

describe('recordReview (R10.31)', () => {
  const prior = entry('struggled', NOW - 5, 3);

  it('stores nothing for a clean review', () => {
    expect(recordReview(prior, 'clean', NOW, DEFAULT_CONFIG)).toBeNull();
  });
  it('stores applyReview for struggled', () => {
    const next = recordReview(prior, 'struggled', NOW, DEFAULT_CONFIG);
    expect(next).toMatchObject({
      step: 0,
      lastOutcome: 'struggled',
      nextDue: NOW + DEFAULT_CONFIG.relearnDelayMs,
    });
    expect(next?.history).toHaveLength(2);
  });
  it('stores applyReview for gave-up', () => {
    const next = recordReview(prior, 'gave-up', NOW, DEFAULT_CONFIG);
    expect(next).toMatchObject({
      step: 0,
      lastOutcome: 'gave-up',
      nextDue: NOW + DEFAULT_CONFIG.relearnDelayMs,
    });
  });
  it('never creates an entry when there is no prior one', () => {
    expect(recordReview(undefined, 'clean', NOW, DEFAULT_CONFIG)).toBeNull();
    expect(recordReview(undefined, 'struggled', NOW, DEFAULT_CONFIG)).toBeNull();
    expect(recordReview(undefined, 'gave-up', NOW, DEFAULT_CONFIG)).toBeNull();
  });
});

describe('texts', () => {
  it('has the approved result texts and no "laid to rest"', () => {
    expect(REVIEW_RESULT_TEXT.clean).toBe('Remembered. It rests after its next séance.');
    expect(REVIEW_RESULT_TEXT['gave-up']).toBe('The ghost slipped away');
    for (const t of Object.values(REVIEW_RESULT_TEXT)) {
      expect(t.toLowerCase()).not.toContain('laid to rest');
    }
  });
  it('words the count line for one and many', () => {
    expect(reviewCountLine(1, 1)).toBe('1 of 1 ghost remembered');
    expect(reviewCountLine(0, 1)).toBe('0 of 1 ghost remembered');
    expect(reviewCountLine(2, 3)).toBe('2 of 3 ghosts remembered');
  });
});
