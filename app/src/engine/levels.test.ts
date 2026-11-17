import { describe, expect, it } from 'vitest';
import type { Level } from '../data/types';
import {
  LEVELS,
  isLevel,
  isLevelFinished,
  nextLevel,
  nextLevelToLoad,
  sessionCharacterList,
  unplacedHistoryKeys,
} from './levels';
import type { ReviewEntry, ReviewHistory } from './scheduler';

const entry: ReviewEntry = { step: 0, lastOutcome: 'clean', nextDue: 0 };

function hist(...keys: string[]): ReviewHistory {
  const h: Record<string, ReviewEntry> = {};
  for (const k of keys) Object.defineProperty(h, k, { value: entry, enumerable: true });
  return h;
}

describe('LEVELS and isLevel', () => {
  it('lists 1, 2, 3 and accepts only those', () => {
    expect(LEVELS).toEqual([1, 2, 3]);
    for (const ok of [1, 2, 3]) expect(isLevel(ok)).toBe(true);
    for (const bad of [0, 4, '1', null, undefined, 1.5, NaN, {}]) expect(isLevel(bad)).toBe(false);
  });
});

describe('sessionCharacterList', () => {
  it('puts the chosen order first, then met characters of other levels in order', () => {
    const pool = sessionCharacterList(['a', 'b', 'c'], hist('y', 'x', 'z'), [['x', 'q', 'y'], ['z', 'w']]);
    expect(pool).toEqual(['a', 'b', 'c', 'x', 'y', 'z']);
  });

  it('removes duplicates', () => {
    const pool = sessionCharacterList(['a', 'a', 'b'], hist('b', 'x'), [['x', 'x', 'a'], ['x', 'b']]);
    expect(pool).toEqual(['a', 'b', 'x']);
  });

  it('excludes never-met characters of other levels', () => {
    const pool = sessionCharacterList(['a'], hist('a'), [['m', 'n'], ['o']]);
    expect(pool).toEqual(['a']);
  });

  it('includes due ghosts of other levels', () => {
    const history: ReviewHistory = { m: { step: 1, lastOutcome: 'struggled', nextDue: 5 } };
    expect(sessionCharacterList(['a', 'b'], history, [['m', 'n']])).toEqual(['a', 'b', 'm']);
  });

  it('does not mutate its inputs', () => {
    const chosen = ['a'];
    const others = [['m']];
    const history = hist('m');
    sessionCharacterList(chosen, history, others);
    expect(chosen).toEqual(['a']);
    expect(others).toEqual([['m']]);
    expect(Object.keys(history)).toEqual(['m']);
  });

  it('ignores prototype keys when checking history', () => {
    expect(sessionCharacterList([], {}, [['constructor', 'toString']])).toEqual([]);
  });
});

describe('isLevelFinished', () => {
  it('is true when every character has an entry', () => {
    expect(isLevelFinished(['a', 'b'], hist('a', 'b', 'c'))).toBe(true);
  });
  it('is false when one is missing', () => {
    expect(isLevelFinished(['a', 'b'], hist('a'))).toBe(false);
  });
  it('is false for an empty order', () => {
    expect(isLevelFinished([], hist('a'))).toBe(false);
  });
  it('does not count prototype keys', () => {
    expect(isLevelFinished(['constructor'], {})).toBe(false);
  });
});

describe('unplacedHistoryKeys', () => {
  it('returns keys found in no loaded set', () => {
    expect(unplacedHistoryKeys(hist('a', 'b', 'c'), [new Set(['a']), new Set(['c'])])).toEqual(['b']);
  });
  it('returns [] for empty history or when all are placed', () => {
    expect(unplacedHistoryKeys({}, [])).toEqual([]);
    expect(unplacedHistoryKeys(hist('a'), [new Set(['a'])])).toEqual([]);
  });
  it('treats every key as unplaced when nothing is loaded', () => {
    expect(unplacedHistoryKeys(hist('a', 'b'), [])).toEqual(['a', 'b']);
  });
  it('handles constructor and __proto__ as own keys', () => {
    const history = JSON.parse('{"constructor":{"step":0,"lastOutcome":"clean","nextDue":0},"__proto__":{"step":0,"lastOutcome":"clean","nextDue":0}}') as ReviewHistory;
    expect(unplacedHistoryKeys(history, [new Set(['a'])]).sort()).toEqual(['__proto__', 'constructor']);
    expect(unplacedHistoryKeys(history, [new Set(['constructor', '__proto__'])])).toEqual([]);
  });
  it('does not list inherited keys', () => {
    expect(unplacedHistoryKeys({}, [new Set()])).toEqual([]);
  });
});

describe('nextLevelToLoad', () => {
  const L = (...l: Level[]) => new Set<Level>(l);
  it('loads level 1 first', () => {
    expect(nextLevelToLoad(1, L(), [])).toBe(1);
    expect(nextLevelToLoad(3, L(), ['x'])).toBe(1);
    expect(nextLevelToLoad(3, L(2, 3), [])).toBe(1);
  });
  it('then loads the chosen level', () => {
    expect(nextLevelToLoad(2, L(1), [])).toBe(2);
    expect(nextLevelToLoad(3, L(1, 2), [])).toBe(3);
  });
  it('then the lowest unloaded level while keys are unplaced', () => {
    expect(nextLevelToLoad(1, L(1), ['x'])).toBe(2);
    expect(nextLevelToLoad(3, L(1, 3), ['x'])).toBe(2);
    expect(nextLevelToLoad(2, L(1, 2), ['x'])).toBe(3);
  });
  it('returns null when nothing is unplaced or all are loaded', () => {
    expect(nextLevelToLoad(1, L(1), [])).toBeNull();
    expect(nextLevelToLoad(2, L(1, 2), [])).toBeNull();
    expect(nextLevelToLoad(2, L(1, 2, 3), ['x'])).toBeNull();
  });
});

describe('nextLevel', () => {
  it('steps 1 to 2 to 3 to null', () => {
    expect(nextLevel(1)).toBe(2);
    expect(nextLevel(2)).toBe(3);
    expect(nextLevel(3)).toBeNull();
  });
});
