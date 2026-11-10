// Feature: ghost-game-core, Property 10: Ties are broken by character-list order
// **Validates: Requirements 6.5, 6.6, 8.7**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { selectSession, type ReviewEntry, type ReviewHistory } from './scheduler';

const cjk = fc.integer({ min: 0x4e00, max: 0x4e00 + 300 }).map((cp) => String.fromCodePoint(cp));

const scenario = fc.record({
  list: fc.uniqueArray(cjk, { minLength: 2, maxLength: 40 }),
  now: fc.integer({ min: 1_000_000, max: 1_000_000_000 }),
  // Small pool of offsets from `now`: past, present boundary, future.
  offsets: fc.tuple(
    fc.integer({ min: -100_000, max: 0 }),
    fc.integer({ min: -100_000, max: 100_000 }),
    fc.integer({ min: 1, max: 100_000 }),
  ),
  // -1 => NEW (no history); 0..2 => index into the pool.
  picks: fc.array(fc.integer({ min: -1, max: 2 }), { minLength: 40, maxLength: 40 }),
  shuffleKeys: fc.array(fc.double({ min: 0, max: 1, noNaN: true }), {
    minLength: 40,
    maxLength: 40,
  }),
  sessionSize: fc.integer({ min: 1, max: 40 }),
  newPerSessionCap: fc.integer({ min: 0, max: 8 }),
});

function entry(nextDue: number): ReviewEntry {
  return { step: 0, lastOutcome: 'clean', nextDue };
}

describe('Property 10: ties are broken by character-list order', () => {
  it('orders tied candidates by list position, independent of history key order', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const config: EngineConfig = {
          ...DEFAULT_CONFIG,
          sessionSize: s.sessionSize,
          newPerSessionCap: s.newPerSessionCap,
        };
        const pool = s.offsets.map((o) => s.now + o);
        const pos = new Map(s.list.map((c, i) => [c, i]));

        const entries: [string, number][] = [];
        s.list.forEach((c, i) => {
          const p = s.picks[i];
          if (p >= 0) entries.push([c, pool[p]]);
        });
        const build = (order: [string, number][]): ReviewHistory => {
          const h: Record<string, ReviewEntry> = {};
          for (const [c, d] of order) h[c] = entry(d);
          return h;
        };
        const dueOf = new Map(entries);
        const history = build(entries);

        const session = selectSession(history, s.list, s.now, config);

        const isNew = (c: string) => !dueOf.has(c);
        const isDue = (c: string) => dueOf.has(c) && dueOf.get(c)! <= s.now;
        const isFuture = (c: string) => dueOf.has(c) && dueOf.get(c)! > s.now;

        const checkOrdered = (chars: string[]) => {
          for (let i = 1; i < chars.length; i++) {
            const a = chars[i - 1];
            const b = chars[i];
            const da = dueOf.get(a)!;
            const db = dueOf.get(b)!;
            expect(da).toBeLessThanOrEqual(db);
            if (da === db) expect(pos.get(a)!).toBeLessThan(pos.get(b)!);
          }
        };

        // (a) DUE: most overdue first, ties by list position.
        checkOrdered(session.filter(isDue));
        // (b) NOT-YET-DUE: soonest first, ties by list position.
        checkOrdered(session.filter(isFuture));

        // (c) NEW: list order, and exactly the first k new characters.
        const sessionNew = session.filter(isNew);
        const allNew = s.list.filter(isNew);
        expect(sessionNew).toEqual(allNew.slice(0, sessionNew.length));

        // (d) shuffling history key insertion order must not change the result.
        const shuffled = entries
          .map((e, i) => ({ e, k: s.shuffleKeys[i] }))
          .sort((x, y) => x.k - y.k)
          .map((x) => x.e);
        expect(selectSession(build(shuffled), s.list, s.now, config)).toEqual(session);
        expect(selectSession(build([...entries].reverse()), s.list, s.now, config)).toEqual(
          session,
        );
      }),
      { numRuns: 500 },
    );
  });
});
