// Feature: ghost-game-core, Property 11: A full dataset always yields exactly 10 distinct ghosts
// **Validates: Requirements 3.1, 6.7, 8.7**
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { selectSession, type ReviewEntry, type ReviewHistory } from './scheduler';

const NUM_RUNS = 500;
const MAX = 60;

type State = 'new' | 'due' | 'future' | 'corrupt';

const cjk = (n: number): string => String.fromCodePoint(0x4e00 + n);

const scenario = fc
  .record({
    codes: fc.uniqueArray(fc.integer({ min: 0, max: 400 }), { minLength: 0, maxLength: MAX }),
    dupIdx: fc.array(fc.nat({ max: MAX - 1 }), { minLength: 0, maxLength: 20 }),
    withDupes: fc.boolean(),
    states: fc.array(fc.constantFrom<State>('new', 'due', 'future', 'corrupt'), {
      minLength: MAX,
      maxLength: MAX,
    }),
    offsets: fc.array(fc.integer({ min: 0, max: 5_000_000_000 }), { minLength: MAX, maxLength: MAX }),
    offList: fc.integer({ min: 0, max: 3 }),
    now: fc.integer({ min: 0, max: 4_000_000_000_000 }),
    cap: fc.integer({ min: 0, max: 12 }),
    useDefault: fc.boolean(),
    size: fc.integer({ min: 1, max: 20 }),
  })
  .map((s) => {
    const base = s.codes.map(cjk);
    const list = [...base];
    if (s.withDupes && base.length > 0) {
      for (const i of s.dupIdx) list.push(base[i % base.length]);
    }
    const entry = (nextDue: number): ReviewEntry => ({ step: 0, lastOutcome: 'clean', nextDue });
    const history: Record<string, ReviewEntry> = {};
    base.forEach((ch, i) => {
      const st = s.states[i];
      if (st === 'due') history[ch] = entry(Math.max(0, s.now - s.offsets[i]));
      else if (st === 'future') history[ch] = entry(s.now + 1 + s.offsets[i]);
      else if (st === 'corrupt') history[ch] = entry(Number.NaN);
      // 'new' => no entry
    });
    for (let k = 0; k < s.offList; k++) history[String.fromCodePoint(0x5000 + k)] = entry(s.now);
    const config: EngineConfig = s.useDefault
      ? DEFAULT_CONFIG
      : { ...DEFAULT_CONFIG, newPerSessionCap: s.cap };
    return { list, distinct: new Set(list), history: history as ReviewHistory, now: s.now, config, size: s.size };
  });

function checkBasics(session: string[], distinct: Set<string>): void {
  expect(new Set(session).size).toBe(session.length);
  for (const ch of session) expect(distinct.has(ch)).toBe(true);
}

describe('Property 11: exactly 10 distinct ghosts', () => {
  it('returns exactly 10 distinct when >= 10 distinct characters, else all of them', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const session = selectSession(s.history, s.list, s.now, s.config);
        checkBasics(session, s.distinct);
        if (s.distinct.size >= 10) expect(session.length).toBe(10);
        else {
          expect(session.length).toBe(s.distinct.size);
          expect(new Set(session)).toEqual(s.distinct);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('length === min(sessionSize, distinct count) for any sessionSize 1..20', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const config = { ...s.config, sessionSize: s.size };
        const session = selectSession(s.history, s.list, s.now, config);
        checkBasics(session, s.distinct);
        expect(session.length).toBe(Math.min(s.size, s.distinct.size));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('regression: 3 due, 0 not-yet-due, 30 new, cap 0 => exactly 10 distinct', () => {
    const now = 1_000_000;
    const list = Array.from({ length: 33 }, (_, i) => cjk(i));
    const history: Record<string, ReviewEntry> = {};
    for (const ch of list.slice(0, 3)) history[ch] = { step: 0, lastOutcome: 'clean', nextDue: now - 10 };
    const session = selectSession(history, list, now, { ...DEFAULT_CONFIG, newPerSessionCap: 0 });
    expect(session).toHaveLength(10);
    expect(new Set(session).size).toBe(10);
    expect(session.slice(0, 3).sort()).toEqual(list.slice(0, 3).sort());
    expect(session.slice(3)).toEqual(list.slice(3, 10));
  });
});
