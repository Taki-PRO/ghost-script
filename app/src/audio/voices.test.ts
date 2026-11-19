import { describe, expect, it } from 'vitest';
import {
  EMPTY_PLANNER,
  MAX_KEY_INK_VOICES,
  MAX_PER_ID,
  MAX_VOICES,
  SPACING_MS,
  createLimiter,
  plan,
  type SoundId,
} from './voices';

const DURATIONS: Record<SoundId, number> = {
  'key-tap': 80,
  'key-wrong': 110,
  'ink-sweep': 220,
  'seal-thud': 300,
  'rest-clean': 1080,
  'rest-struggled': 700,
  'rest-gave-up': 600,
};

function setup() {
  let t = 0;
  const limiter = createLimiter(() => t, DURATIONS);
  return {
    limiter,
    at(ms: number) {
      t = ms;
    },
  };
}

describe('voice limits', () => {
  it('exports the named limits', () => {
    expect(MAX_VOICES).toBe(4);
    expect(MAX_KEY_INK_VOICES).toBe(3);
    expect(MAX_PER_ID).toBe(2);
    expect(SPACING_MS).toEqual({ 'key-tap': 40, 'key-wrong': 40, 'ink-sweep': 80 });
  });

  it('accepts a fourth voice and drops the fifth for total', () => {
    const { limiter } = setup();
    expect(limiter.accept('seal-thud')).toEqual({ accept: true });
    expect(limiter.accept('rest-clean')).toEqual({ accept: true });
    expect(limiter.accept('rest-struggled')).toEqual({ accept: true });
    expect(limiter.accept('rest-gave-up')).toEqual({ accept: true });
    expect(limiter.accept('seal-thud')).toEqual({ accept: false, reason: 'total' });
  });

  it('drops a fourth key or ink voice for group but accepts an outcome', () => {
    const { limiter, at } = setup();
    expect(limiter.accept('key-tap').accept).toBe(true);
    expect(limiter.accept('key-wrong').accept).toBe(true);
    expect(limiter.accept('ink-sweep').accept).toBe(true);
    at(40);
    expect(limiter.accept('key-tap')).toEqual({ accept: false, reason: 'group' });
    expect(limiter.accept('key-wrong')).toEqual({ accept: false, reason: 'group' });
    expect(limiter.accept('seal-thud')).toEqual({ accept: true });
  });

  it('drops the fifth voice for total after three key voices and an outcome', () => {
    const { limiter } = setup();
    limiter.accept('key-tap');
    limiter.accept('key-wrong');
    limiter.accept('ink-sweep');
    expect(limiter.accept('seal-thud').accept).toBe(true);
    expect(limiter.accept('rest-struggled')).toEqual({ accept: false, reason: 'total' });
  });

  it('drops a third voice of one id for per-id', () => {
    const { limiter, at } = setup();
    expect(limiter.accept('ink-sweep').accept).toBe(true);
    at(80);
    expect(limiter.accept('ink-sweep').accept).toBe(true);
    at(160);
    expect(limiter.accept('ink-sweep')).toEqual({ accept: false, reason: 'per-id' });
    // A different key id still fits in the group.
    expect(limiter.accept('key-tap').accept).toBe(true);
  });

  it('accepts an outcome whenever fewer than 4 voices are active', () => {
    const { limiter } = setup();
    limiter.accept('key-tap');
    limiter.accept('key-wrong');
    limiter.accept('ink-sweep');
    expect(limiter.accept('rest-clean')).toEqual({ accept: true });
  });

  it('does not apply the per-id limit to outcome ids', () => {
    const { limiter } = setup();
    expect(limiter.accept('seal-thud').accept).toBe(true);
    expect(limiter.accept('seal-thud').accept).toBe(true);
    expect(limiter.accept('seal-thud').accept).toBe(true);
  });
});

describe('spacing', () => {
  it('drops key-tap at 39 ms and accepts it at 40 ms', () => {
    const { limiter, at } = setup();
    expect(limiter.accept('key-tap').accept).toBe(true);
    at(39);
    expect(limiter.accept('key-tap')).toEqual({ accept: false, reason: 'spacing' });
    at(40);
    expect(limiter.accept('key-tap')).toEqual({ accept: true });
  });

  it('drops key-wrong at 39 ms and accepts it at 40 ms', () => {
    const { limiter, at } = setup();
    expect(limiter.accept('key-wrong').accept).toBe(true);
    at(39);
    expect(limiter.accept('key-wrong')).toEqual({ accept: false, reason: 'spacing' });
    at(40);
    expect(limiter.accept('key-wrong')).toEqual({ accept: true });
  });

  it('drops ink-sweep at 79 ms and accepts it at 80 ms', () => {
    const { limiter, at } = setup();
    expect(limiter.accept('ink-sweep').accept).toBe(true);
    at(79);
    expect(limiter.accept('ink-sweep')).toEqual({ accept: false, reason: 'spacing' });
    at(80);
    expect(limiter.accept('ink-sweep')).toEqual({ accept: true });
  });

  it('measures spacing per id, not across ids', () => {
    const { limiter, at } = setup();
    limiter.accept('key-tap');
    at(1);
    expect(limiter.accept('key-wrong')).toEqual({ accept: true });
  });

  it('measures spacing from the last accepted request, not from a dropped one', () => {
    const { limiter, at } = setup();
    limiter.accept('key-tap');
    at(30);
    expect(limiter.accept('key-tap').accept).toBe(false);
    at(40);
    expect(limiter.accept('key-tap').accept).toBe(true);
  });

  it('puts no spacing on outcome sounds', () => {
    const { limiter } = setup();
    expect(limiter.accept('seal-thud').accept).toBe(true);
    expect(limiter.accept('seal-thud').accept).toBe(true);
  });

  it('reports spacing before per-id, group and total', () => {
    const { limiter, at } = setup();
    limiter.accept('key-tap');
    limiter.accept('key-wrong');
    limiter.accept('ink-sweep');
    limiter.accept('seal-thud');
    at(10);
    expect(limiter.accept('key-tap')).toEqual({ accept: false, reason: 'spacing' });
  });
});

describe('release and expiry', () => {
  it('frees a place exactly at the voice end time', () => {
    const { limiter, at } = setup();
    for (const id of ['seal-thud', 'rest-clean', 'rest-struggled', 'rest-gave-up'] as const) {
      limiter.accept(id);
    }
    at(299);
    expect(limiter.accept('rest-gave-up')).toEqual({ accept: false, reason: 'total' });
    at(300); // seal-thud ends at 300
    expect(limiter.accept('rest-gave-up')).toEqual({ accept: true });
  });

  it('frees a key voice at its end time for the group limit', () => {
    const { limiter, at } = setup();
    limiter.accept('key-tap'); // ends 80
    at(40);
    limiter.accept('key-wrong'); // ends 150
    limiter.accept('ink-sweep'); // ends 260
    at(79);
    expect(limiter.accept('key-tap')).toEqual({ accept: false, reason: 'group' });
    at(80);
    expect(limiter.accept('key-tap')).toEqual({ accept: true });
  });

  it('frees a per-id place at the end time', () => {
    const { limiter, at } = setup();
    limiter.accept('key-tap'); // ends 80
    at(40);
    limiter.accept('key-tap'); // ends 120
    at(80);
    expect(limiter.accept('key-tap').accept).toBe(true); // first ended at 80
    at(120);
    expect(limiter.accept('key-tap').accept).toBe(true);
  });

  it('records the end as request time plus duration', () => {
    const { state } = plan(EMPTY_PLANNER, 'rest-clean', 500, 1080);
    expect(state.active).toEqual([{ id: 'rest-clean', end: 1580 }]);
    expect(state.last).toEqual({ 'rest-clean': 500 });
  });

  it('accepts everything again after all voices expire', () => {
    const { limiter, at } = setup();
    for (const id of ['seal-thud', 'rest-clean', 'rest-struggled', 'rest-gave-up'] as const) {
      limiter.accept(id);
    }
    at(5000);
    expect(limiter.accept('rest-clean')).toEqual({ accept: true });
  });

  it('reset clears voices and spacing', () => {
    const { limiter } = setup();
    limiter.accept('key-tap');
    limiter.reset();
    expect(limiter.accept('key-tap')).toEqual({ accept: true });
  });
});

describe('dropping', () => {
  it('changes nothing but the pruned state', () => {
    let state = EMPTY_PLANNER;
    state = plan(state, 'key-tap', 0, 80).state; // ends 80
    state = plan(state, 'ink-sweep', 0, 220).state;
    const result = plan(state, 'key-tap', 20, 80); // spacing drop
    expect(result.decision).toEqual({ accept: false, reason: 'spacing' });
    expect(result.state.last).toEqual(state.last);
    expect(result.state.active).toEqual(state.active);

    const later = plan(state, 'key-tap', 100, 80).state;
    const dropped = plan(later, 'key-tap', 110, 80);
    expect(dropped.state.active).toEqual([{ id: 'ink-sweep', end: 220 }, { id: 'key-tap', end: 180 }]);
    expect(dropped.state.last).toEqual(later.last);
  });

  it('prunes ended voices on a drop', () => {
    let state = plan(EMPTY_PLANNER, 'key-tap', 0, 80).state;
    const result = plan(state, 'key-tap', 90, 80);
    expect(result.decision.accept).toBe(true);
    state = plan(EMPTY_PLANNER, 'key-tap', 0, 80).state;
    const dropped = plan({ ...state, last: { 'key-tap': 85 } }, 'key-tap', 90, 80);
    expect(dropped.decision).toEqual({ accept: false, reason: 'spacing' });
    expect(dropped.state.active).toEqual([]);
  });

  it('never queues a dropped request', () => {
    const { limiter, at } = setup();
    limiter.accept('key-tap');
    at(10);
    expect(limiter.accept('key-tap').accept).toBe(false);
    // Nothing plays later on its own: the next call is judged only on its own time.
    at(45);
    expect(limiter.accept('key-tap')).toEqual({ accept: true });
    at(50);
    expect(limiter.accept('key-tap')).toEqual({ accept: false, reason: 'spacing' });
  });

  it('returns equal results for equal inputs and leaves the input unchanged', () => {
    const state = plan(EMPTY_PLANNER, 'ink-sweep', 0, 220).state;
    const snapshot = JSON.stringify(state);
    const a = plan(state, 'key-tap', 100, 80);
    const b = plan(state, 'key-tap', 100, 80);
    expect(a).toEqual(b);
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(JSON.stringify(EMPTY_PLANNER)).toBe('{"active":[],"last":{}}');
  });
});
