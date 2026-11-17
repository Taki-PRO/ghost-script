import { describe, expect, it } from 'vitest';
import { firstMeetingSet, isBrandNewPlayer } from './firstMeeting';
import type { ReviewEntry, ReviewHistory } from './scheduler';

const entry: ReviewEntry = { step: 1, lastOutcome: 'clean', nextDue: 1000 };

describe('isBrandNewPlayer', () => {
  it('is true for an empty history', () => {
    expect(isBrandNewPlayer({})).toBe(true);
  });

  it('is false with one entry', () => {
    expect(isBrandNewPlayer({ a: entry })).toBe(false);
  });

  it('is false when the only key is "constructor"', () => {
    expect(isBrandNewPlayer({ constructor: entry } as ReviewHistory)).toBe(false);
  });
});

describe('firstMeetingSet', () => {
  it('keeps characters without an entry and drops those with one', () => {
    const history: ReviewHistory = { a: entry, b: entry };
    const set = firstMeetingSet(history, ['a', 'b', 'c', 'd']);
    expect([...set].sort()).toEqual(['c', 'd']);
  });

  it('returns every character for an empty history', () => {
    expect([...firstMeetingSet({}, ['a', 'b'])]).toEqual(['a', 'b']);
  });

  it('returns an empty set for an empty characters list', () => {
    expect(firstMeetingSet({ a: entry }, []).size).toBe(0);
    expect(firstMeetingSet({}, []).size).toBe(0);
  });

  it('does not read the prototype for "constructor" and "__proto__"', () => {
    const set = firstMeetingSet({}, ['constructor', '__proto__', 'toString']);
    expect(set.has('constructor')).toBe(true);
    expect(set.has('__proto__')).toBe(true);
    expect(set.has('toString')).toBe(true);
  });

  it('drops "constructor" when it is an own key', () => {
    const history = { constructor: entry } as ReviewHistory;
    const set = firstMeetingSet(history, ['constructor', 'x']);
    expect([...set]).toEqual(['x']);
  });

  it('does not mutate its inputs', () => {
    const history: ReviewHistory = { a: entry };
    const chars = ['a', 'b'];
    const historyCopy = JSON.parse(JSON.stringify(history));
    firstMeetingSet(history, chars);
    isBrandNewPlayer(history);
    expect(history).toEqual(historyCopy);
    expect(chars).toEqual(['a', 'b']);
  });
});
