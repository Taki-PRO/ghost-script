// Feature: ghost-game-core, Property 6: Session selection is deterministic
// **Validates: Requirements 6.6, 8.7**
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_CONFIG, type EngineConfig } from './config';
import { selectSession, type ReviewEntry, type ReviewHistory } from './scheduler';

const NUM_RUNS = 300;

const cjkArb = fc.integer({ min: 0x4e00, max: 0x9fff }).map((cp) => String.fromCodePoint(cp));

// 0..40 distinct characters.
const distinctListArb = fc.uniqueArray(cjkArb, { minLength: 0, maxLength: 40 });

// Pool of nextDue values so ties actually occur.
const tiePool = [0, 1000, 5_000_000, 2_000_000_000_000];

const entryArb: fc.Arbitrary<ReviewEntry> = fc.record({
  step: fc.integer({ min: 0, max: 5 }),
  lastOutcome: fc.constantFrom('clean', 'struggled', 'gave-up') as fc.Arbitrary<
    ReviewEntry['lastOutcome']
  >,
  nextDue: fc.oneof(fc.integer({ min: 0, max: 4e12 }), fc.constantFrom(...tiePool)),
  history: fc.option(
    fc.array(
      fc.record({
        outcome: fc.constantFrom('clean', 'struggled', 'gave-up') as fc.Arbitrary<
          ReviewEntry['lastOutcome']
        >,
        at: fc.integer({ min: 0, max: 4e12 }),
      }),
      { maxLength: 3 },
    ),
    { nil: undefined },
  ),
});

const configArb: fc.Arbitrary<EngineConfig> = fc.oneof(
  fc.constant(DEFAULT_CONFIG),
  fc
    .record({
      sessionSize: fc.integer({ min: 0, max: 15 }),
      newPerSessionCap: fc.integer({ min: 0, max: 8 }),
    })
    .map((c) => ({ ...DEFAULT_CONFIG, ...c })),
);

interface Scenario {
  list: string[];
  history: ReviewHistory;
  entries: [string, ReviewEntry][];
  now: number;
  config: EngineConfig;
}

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .tuple(
    distinctListArb,
    fc.array(fc.nat(), { maxLength: 6 }), // indices of duplicates mixed in
    fc.array(entryArb, { minLength: 40, maxLength: 40 }),
    fc.array(fc.boolean(), { minLength: 40, maxLength: 40 }), // which list chars have history
    fc.uniqueArray(cjkArb, { minLength: 0, maxLength: 4 }), // extra chars (may be off-list)
    fc.integer({ min: 0, max: 4e12 }),
    fc.oneof(fc.constantFrom(...tiePool), fc.integer({ min: 0, max: 4e12 })),
    configArb,
  )
  .map(([base, dupIdx, entries, covered, extras, nowRand, nowTie, config]) => {
    const list = [...base];
    for (const i of dupIdx) {
      if (base.length > 0) list.splice(i % (list.length + 1), 0, base[i % base.length]);
    }
    const pairs: [string, ReviewEntry][] = [];
    const used = new Set<string>();
    base.forEach((ch, i) => {
      if (covered[i]) {
        pairs.push([ch, entries[i]]);
        used.add(ch);
      }
    });
    extras.forEach((ch, i) => {
      if (!used.has(ch)) {
        pairs.push([ch, entries[39 - i]]);
        used.add(ch);
      }
    });
    return {
      list,
      history: Object.fromEntries(pairs),
      entries: pairs,
      now: i32(nowRand, nowTie),
      config,
    };
  });

function i32(a: number, b: number): number {
  // Prefer values that interact with the tie pool half of the time.
  return a % 2 === 0 ? a : b;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

describe('Property 6: Session selection is deterministic', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a) identical inputs give identical ordered results', () => {
    fc.assert(
      fc.property(scenarioArb, ({ list, history, now, config }) => {
        const first = selectSession(history, list, now, config);
        const second = selectSession(history, list, now, config);
        expect(second).toEqual(first);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('(b) result does not depend on history key insertion order', () => {
    fc.assert(
      fc.property(scenarioArb, fc.integer(), ({ list, entries, history, now, config }, seed) => {
        const reversed: ReviewHistory = Object.fromEntries([...entries].reverse());
        // Deterministic shuffle driven by the seed.
        const shuffled = [...entries].sort(
          (x, y) => hash(x[0], seed) - hash(y[0], seed) || x[0].localeCompare(y[0]),
        );
        const expected = selectSession(history, list, now, config);
        expect(selectSession(reversed, list, now, config)).toEqual(expected);
        expect(selectSession(Object.fromEntries(shuffled), list, now, config)).toEqual(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('(c) does not mutate inputs and ignores the real clock', () => {
    fc.assert(
      fc.property(scenarioArb, ({ list, history, now, config }) => {
        const snapshot = JSON.parse(JSON.stringify({ list, history, config })) as unknown;
        deepFreeze(list);
        deepFreeze(history);
        deepFreeze(config);

        vi.useFakeTimers();
        vi.setSystemTime(new Date(1_000_000));
        const first = selectSession(history, list, now, config);
        vi.setSystemTime(new Date(3_000_000_000_000));
        const second = selectSession(history, list, now, config);
        vi.useRealTimers();

        expect(second).toEqual(first);
        expect(JSON.parse(JSON.stringify({ list, history, config }))).toEqual(snapshot);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

function hash(s: string, seed: number): number {
  let h = seed | 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}
