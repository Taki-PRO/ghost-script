// Feature: ghost-game-core, Property 9: The new-per-session cap holds whenever something is due
// **Validates: Requirements 6.5, 8.7**
//
// SPEC CONFLICT (documented, not a code bug):
// Design Property 9 literally says "new count <= newPerSessionCap whenever at
// least one character is due". Requirement 6.5 band (d) says that if the
// session is STILL short of sessionSize after bands (a)-(c) (due, capped new,
// not-yet-due), it is filled with further NEW characters IGNORING the cap
// (see also Property 11: a full dataset always yields a full session).
// Example: 2 due, 0 not-yet-due, 20 new, sessionSize 10, cap 5 => 8 new.
// So the literal sentence is false in that legitimate case. This file tests
// the PRECISE form the requirements imply:
//   P9-a  new > cap  =>  every non-new char of the list is in the session AND
//         session.length === min(sessionSize, distinct list length).
//   P9-b  nonNew >= sessionSize - cap  =>  new <= cap.
//   P9-c  new chars in the session are the first k new chars in list order.
// plus the complementary "nothing due => cap does not apply" behaviour.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { selectSession, type ReviewEntry, type ReviewHistory } from './scheduler';

type Status = 'new' | 'due' | 'future';

const NOW = 1_700_000_000_000;

function entry(nextDue: number): ReviewEntry {
  return { step: 0, lastOutcome: 'clean', nextDue };
}

const cjkChar = fc.integer({ min: 0x4e00, max: 0x4e00 + 2000 }).map((cp) => String.fromCodePoint(cp));

interface Scenario {
  list: string[];
  statuses: Map<string, Status>;
  history: ReviewHistory;
  config: EngineConfig;
  anyDue: boolean;
}

const scenario: fc.Arbitrary<Scenario> = fc
  .record({
    list: fc.uniqueArray(cjkChar, { minLength: 1, maxLength: 40 }),
    // Extra entries are sliced off to the list length.
    marks: fc.array(
      fc.record({
        status: fc.constantFrom<Status>('new', 'due', 'future'),
        offset: fc.integer({ min: 0, max: 1_000_000_000 }),
      }),
      { minLength: 40, maxLength: 40 },
    ),
    sessionSize: fc.integer({ min: 1, max: 15 }),
    newPerSessionCap: fc.integer({ min: 0, max: 8 }),
  })
  .map(({ list, marks, sessionSize, newPerSessionCap }) => {
    const statuses = new Map<string, Status>();
    const history: Record<string, ReviewEntry> = {};
    list.forEach((ch, i) => {
      const { status, offset } = marks[i];
      statuses.set(ch, status);
      if (status === 'due') history[ch] = entry(NOW - offset);
      else if (status === 'future') history[ch] = entry(NOW + 1 + offset);
    });
    const anyDue = [...statuses.values()].includes('due');
    return {
      list,
      statuses,
      history,
      config: { ...DEFAULT_CONFIG, sessionSize, newPerSessionCap },
      anyDue,
    };
  });

describe('Property 9: new-per-session cap when something is due', () => {
  it('P9-a/b/c hold for any history with at least one due character', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        fc.pre(s.anyDue);
        const { list, statuses, history, config } = s;
        const session = selectSession(history, list, NOW, config);
        const cap = config.newPerSessionCap;

        const newInList = list.filter((c) => statuses.get(c) === 'new');
        const nonNew = list.filter((c) => statuses.get(c) !== 'new');
        const newInSession = session.filter((c) => statuses.get(c) === 'new');

        // P9-a: exceeding the cap is only allowed when band (d) had to fill the session.
        if (newInSession.length > cap) {
          const inSession = new Set(session);
          expect(nonNew.every((c) => inSession.has(c))).toBe(true);
          expect(session.length).toBe(Math.min(config.sessionSize, list.length));
        }

        // P9-b: if bands (a)-(c) can fill the rest, the literal cap holds.
        if (nonNew.length >= config.sessionSize - cap) {
          expect(newInSession.length).toBeLessThanOrEqual(cap);
        }

        // P9-c: new characters come in list order with none skipped.
        expect(newInSession).toEqual(newInList.slice(0, newInSession.length));
      }),
      { numRuns: 500 },
    );
  });

  it('overflow example (Req 6.5(d)): 2 due, 20 new, size 10, cap 5 => 8 new, allowed by P9-a', () => {
    const list = Array.from({ length: 22 }, (_, i) => String.fromCodePoint(0x4e00 + i));
    const dueChars = list.slice(0, 2);
    const history: Record<string, ReviewEntry> = {};
    dueChars.forEach((c, i) => (history[c] = entry(NOW - 1000 * (i + 1))));
    const config = { ...DEFAULT_CONFIG, sessionSize: 10, newPerSessionCap: 5 };

    const session = selectSession(history, list, NOW, config);
    const newCount = session.filter((c) => !(c in history)).length;

    expect(session).toHaveLength(10);
    expect(newCount).toBe(8);
    // Exceeds the cap, which is allowed because (Req 6.5(d)) the session was
    // short after bands (a)-(c): all non-new chars are in the session and it is full.
    expect(newCount).toBeGreaterThan(config.newPerSessionCap);
    expect(dueChars.every((c) => session.includes(c))).toBe(true);
  });

  it('nothing due: the cap does not apply (30 new, size 10 => 10 new)', () => {
    const list = Array.from({ length: 30 }, (_, i) => String.fromCodePoint(0x4e00 + i));
    const session = selectSession({}, list, NOW, { ...DEFAULT_CONFIG, sessionSize: 10, newPerSessionCap: 5 });
    expect(session).toEqual(list.slice(0, 10));
  });
});
