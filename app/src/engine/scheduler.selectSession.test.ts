import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { selectSession, type ReviewEntry, type ReviewHistory } from './scheduler';

const NOW = 1_700_000_000_000;
const SMALL: EngineConfig = { ...DEFAULT_CONFIG, sessionSize: 4, newPerSessionCap: 2 };

const entry = (nextDue: number): ReviewEntry => ({ step: 0, lastOutcome: 'clean', nextDue });

/** Build a history from [char, nextDue] pairs. */
const hist = (pairs: ReadonlyArray<readonly [string, number]>): ReviewHistory =>
  Object.fromEntries(pairs.map(([c, d]) => [c, entry(d)]));

/** n distinct single-character-ish ids with a prefix, e.g. n1..nN. */
const ids = (prefix: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

const deepFreeze = <T>(o: T): T => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('selectSession band (a): due characters', () => {
  it('orders due characters most overdue first', () => {
    const list = ['a', 'b', 'c'];
    const history = hist([
      ['a', NOW - 1], // barely past
      ['b', NOW - 1_000_000], // far in the past
      ['c', NOW - 1_000], // in between
    ]);
    expect(selectSession(history, list, NOW, DEFAULT_CONFIG)).toEqual(['b', 'c', 'a']);
  });

  it('treats nextDue === now as due (ahead of new characters)', () => {
    const history = hist([['b', NOW]]);
    expect(selectSession(history, ['a', 'b', 'c'], NOW, SMALL)).toEqual(['b', 'a', 'c']);
  });

  it('treats nextDue === now + 1 as not yet due', () => {
    const history = hist([['b', NOW + 1]]);
    // Nothing due: new uncapped first, then not-yet-due.
    expect(selectSession(history, ['a', 'b', 'c'], NOW, SMALL)).toEqual(['a', 'c', 'b']);
  });
});

describe('selectSession band (b): new characters', () => {
  it('places new characters after due ones, in list order, capped at newPerSessionCap', () => {
    const list = ['n1', 'd1', 'n2', 'd2', 'n3', 'n4'];
    const history = hist([
      ['d1', NOW - 10],
      ['d2', NOW - 20],
    ]);
    const config: EngineConfig = { ...DEFAULT_CONFIG, sessionSize: 4, newPerSessionCap: 1 };
    // d2 (more overdue), d1, then only 1 new in band (b) (n1); n2 fills only because size is 4: 2 due + 1 new = 3, then (d) n2.
    expect(selectSession(history, list, NOW, config)).toEqual(['d2', 'd1', 'n1', 'n2']);
  });

  it('takes only newPerSessionCap new in band (b) before not-yet-due characters', () => {
    const list = ['n1', 'n2', 'n3', 'd1', 'f1'];
    const history = hist([
      ['d1', NOW - 5],
      ['f1', NOW + 5],
    ]);
    const config: EngineConfig = { ...DEFAULT_CONFIG, sessionSize: 4, newPerSessionCap: 2 };
    // d1, n1, n2 (cap), f1 (c). n3 would only be band (d) and the session is full.
    expect(selectSession(history, list, NOW, config)).toEqual(['d1', 'n1', 'n2', 'f1']);
  });

  it('is uncapped when nothing is due: 12 new, sessionSize 10 => first 10 in list order', () => {
    const list = ids('n', 12);
    expect(selectSession({}, list, NOW, DEFAULT_CONFIG)).toEqual(ids('n', 10));
    // 10 > newPerSessionCap (5)
    expect(DEFAULT_CONFIG.newPerSessionCap).toBe(5);
  });

  it('is uncapped when all history is not yet due, and new precede not-yet-due', () => {
    const list = ['f1', 'n1', 'n2', 'n3', 'f2'];
    const history = hist([
      ['f1', NOW + 10],
      ['f2', NOW + 20],
    ]);
    expect(selectSession(history, list, NOW, SMALL)).toEqual(['n1', 'n2', 'n3', 'f1']);
  });
});

describe('selectSession band (c): not-yet-due characters', () => {
  it('orders not-yet-due soonest first, after the capped new ones', () => {
    const list = ['f1', 'f2', 'f3', 'n1', 'n2', 'n3', 'd1'];
    const history = hist([
      ['d1', NOW - 1],
      ['f1', NOW + 3000],
      ['f2', NOW + 1000],
      ['f3', NOW + 2000],
    ]);
    const config: EngineConfig = { ...DEFAULT_CONFIG, sessionSize: 6, newPerSessionCap: 2 };
    expect(selectSession(history, list, NOW, config)).toEqual([
      'd1',
      'n1',
      'n2',
      'f2',
      'f3',
      'f1',
    ]);
  });
});

describe('selectSession band (d): extra new characters', () => {
  it('Req 6.5(d): 2 due, 0 not-yet-due, 20 new, size 10 => 2 due, 5 new (b), 3 more new (d)', () => {
    // Req 6.5(d): when due + not-yet-due characters cannot fill the session, the remaining
    // slots are filled with further NEW characters ignoring the cap. That is why the NEW
    // count here is 8 (5 from band b + 3 from band d), which exceeds newPerSessionCap (5)
    // even though something is due.
    const newChars = ids('n', 20);
    const list = ['d1', 'd2', ...newChars];
    const history = hist([
      ['d1', NOW - 100],
      ['d2', NOW - 200],
    ]);
    const result = selectSession(history, list, NOW, DEFAULT_CONFIG);
    expect(result).toEqual(['d2', 'd1', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']);
    expect(result.filter((c) => c.startsWith('n'))).toHaveLength(8);
    expect(8).toBeGreaterThan(DEFAULT_CONFIG.newPerSessionCap);
  });
});

describe('selectSession band ordering', () => {
  it('orders due, capped new, soonest not-yet-due, then extra new', () => {
    const list = [
      'n1', 'n2', 'n3', 'n4', 'n5', 'n6',
      'f1', 'f2',
      'd1', 'd2',
    ];
    const history = hist([
      ['d1', NOW - 10],
      ['d2', NOW - 20],
      ['f1', NOW + 200],
      ['f2', NOW + 100],
    ]);
    const config: EngineConfig = { ...DEFAULT_CONFIG, sessionSize: 10, newPerSessionCap: 2 };
    expect(selectSession(history, list, NOW, config)).toEqual([
      'd2', 'd1', // (a)
      'n1', 'n2', // (b) capped
      'f2', 'f1', // (c)
      'n3', 'n4', 'n5', 'n6', // (d)
    ]);
  });
});

describe('selectSession ties and determinism', () => {
  it('breaks equal nextDue by list position in the due band', () => {
    const history = hist([
      ['c', NOW - 50],
      ['a', NOW - 50],
      ['b', NOW - 50],
    ]);
    expect(selectSession(history, ['a', 'b', 'c'], NOW, SMALL)).toEqual(['a', 'b', 'c']);
    expect(selectSession(history, ['c', 'b', 'a'], NOW, SMALL)).toEqual(['c', 'b', 'a']);
  });

  it('breaks equal nextDue by list position in the not-yet-due band', () => {
    const history = hist([
      ['c', NOW + 50],
      ['a', NOW + 50],
      ['b', NOW + 50],
    ]);
    expect(selectSession(history, ['b', 'c', 'a'], NOW, SMALL)).toEqual(['b', 'c', 'a']);
  });

  it('does not depend on history key insertion order', () => {
    const list = ['a', 'b', 'c', 'd', 'e'];
    const pairs: Array<readonly [string, number]> = [
      ['a', NOW - 5],
      ['b', NOW - 5],
      ['c', NOW + 7],
      ['d', NOW + 7],
    ];
    const h1 = hist(pairs);
    const h2 = hist([...pairs].reverse());
    expect(Object.keys(h1)).not.toEqual(Object.keys(h2));
    const r1 = selectSession(h1, list, NOW, DEFAULT_CONFIG);
    expect(r1).toEqual(['a', 'b', 'e', 'c', 'd']);
    expect(selectSession(h2, list, NOW, DEFAULT_CONFIG)).toEqual(r1);
  });
});

describe('selectSession size handling', () => {
  it('returns exactly 10 distinct characters when >= 10 are available', () => {
    const list = ids('x', 25);
    const history = hist(ids('x', 8).map((c, i) => [c, NOW - i * 10] as const));
    const result = selectSession(history, list, NOW, DEFAULT_CONFIG);
    expect(result).toHaveLength(10);
    expect(new Set(result).size).toBe(10);
  });

  it('returns all characters when fewer than sessionSize exist', () => {
    const history = hist([['b', NOW - 1]]);
    expect(selectSession(history, ['a', 'b', 'c'], NOW, DEFAULT_CONFIG)).toEqual(['b', 'a', 'c']);
  });

  it('returns [] for an empty list', () => {
    expect(selectSession({}, [], NOW, DEFAULT_CONFIG)).toEqual([]);
  });

  it('returns [] for sessionSize 0 or negative', () => {
    const list = ['a', 'b'];
    expect(selectSession({}, list, NOW, { ...DEFAULT_CONFIG, sessionSize: 0 })).toEqual([]);
    expect(selectSession({}, list, NOW, { ...DEFAULT_CONFIG, sessionSize: -3 })).toEqual([]);
  });
});

describe('selectSession input robustness', () => {
  it('dedupes duplicates in characterList (first occurrence wins)', () => {
    const history = hist([['b', NOW - 1]]);
    expect(selectSession(history, ['a', 'b', 'a', 'c', 'b'], NOW, DEFAULT_CONFIG)).toEqual([
      'b',
      'a',
      'c',
    ]);
    // First occurrence defines list position for tie-breaks.
    const tied = hist([
      ['x', NOW - 5],
      ['y', NOW - 5],
    ]);
    expect(selectSession(tied, ['y', 'x', 'y'], NOW, DEFAULT_CONFIG)).toEqual(['y', 'x']);
  });

  it('ignores history entries for characters not in the list', () => {
    const history = hist([
      ['ghost', NOW - 1],
      ['a', NOW - 2],
    ]);
    expect(selectSession(history, ['a', 'b'], NOW, SMALL)).toEqual(['a', 'b']);
  });

  it('treats a prototype-named character ("constructor") as new without crashing', () => {
    const list = ['constructor', 'toString', 'a'];
    const history = hist([['a', NOW - 1]]);
    expect(selectSession(history, list, NOW, SMALL)).toEqual(['a', 'constructor', 'toString']);
  });

  it('treats NaN nextDue as due and most overdue', () => {
    const history = hist([
      ['a', NOW - 1],
      ['b', Number.NaN],
      ['c', 5],
    ]);
    expect(selectSession(history, ['a', 'b', 'c'], NOW, SMALL)).toEqual(['b', 'c', 'a']);
  });
});

describe('selectSession purity', () => {
  it('does not mutate its inputs', () => {
    const list = deepFreeze(['n1', 'd1', 'f1', 'n1', 'n2']);
    const history = deepFreeze(
      hist([
        ['d1', NOW - 1],
        ['f1', NOW + 1],
      ]),
    );
    const config = deepFreeze({ ...SMALL, intervalLadderMs: [...SMALL.intervalLadderMs] });
    expect(() => selectSession(history, list, NOW, config)).not.toThrow();
    expect(list).toEqual(['n1', 'd1', 'f1', 'n1', 'n2']);
    expect(Object.keys(history)).toEqual(['d1', 'f1']);
  });

  it('ignores the real clock', () => {
    const list = ['n1', 'd1', 'f1', 'n2'];
    const history = hist([
      ['d1', NOW - 1],
      ['f1', NOW + 1],
    ]);
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const r1 = selectSession(history, list, NOW, SMALL);
    vi.setSystemTime(NOW * 2);
    const r2 = selectSession(history, list, NOW, SMALL);
    expect(r1).toEqual(['d1', 'n1', 'n2', 'f1']);
    expect(r2).toEqual(r1);
  });
});
