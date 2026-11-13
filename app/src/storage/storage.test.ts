import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../engine/config';
import { applyReview } from '../engine/scheduler';
import type { ReviewEntry } from '../engine/scheduler';
import * as defaults from './storage';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_STATE,
  STORAGE_KEY,
  createStore,
  type PersistedState,
  type StorageLike,
} from './storage';

const KEY = 'test-key';
const NOW = 1_700_000_000_000;

interface FakeBackend extends StorageLike {
  data: Map<string, string>;
  calls: string[];
  throwOn: { getItem: boolean; setItem: boolean; removeItem: boolean };
}

function makeBackend(): FakeBackend {
  const data = new Map<string, string>();
  const calls: string[] = [];
  const throwOn = { getItem: false, setItem: false, removeItem: false };
  return {
    data,
    calls,
    throwOn,
    getItem(k) {
      calls.push('getItem');
      if (throwOn.getItem) throw new Error('getItem failed');
      return data.get(k) ?? null;
    },
    setItem(k, v) {
      calls.push('setItem');
      if (throwOn.setItem) throw new Error('quota');
      data.set(k, v);
    },
    removeItem(k) {
      calls.push('removeItem');
      if (throwOn.removeItem) throw new Error('removeItem failed');
      data.delete(k);
    },
  };
}

const entry = (outcome: 'clean' | 'struggled' | 'gave-up' = 'clean', prior?: ReviewEntry): ReviewEntry =>
  applyReview(prior, outcome, NOW, DEFAULT_CONFIG);

const validBlob = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ schemaVersion: 1, introSeen: false, history: {}, ...over });

const goodEntry = { step: 1, lastOutcome: 'clean', nextDue: 5, history: [{ outcome: 'clean', at: 1 }] };

let backend: FakeBackend;
beforeEach(() => {
  backend = makeBackend();
});

describe('first run and round trip', () => {
  it('returns DEFAULT_STATE when nothing is stored', () => {
    const s = createStore({ backend, key: KEY });
    expect(s.loadState()).toEqual(DEFAULT_STATE);
    expect(s.getIntroSeen()).toBe(false);
  });

  it('round-trips state and stores schemaVersion (Req 7.2)', () => {
    const s = createStore({ backend, key: KEY });
    const state: PersistedState = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      introSeen: true,
      history: { 女: entry('clean'), 好: entry('struggled') },
    };
    s.saveState(state);
    expect(s.loadState()).toEqual(state);
    const raw = JSON.parse(backend.data.get(KEY) as string) as Record<string, unknown>;
    expect(raw.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe('migrations from known older versions', () => {
  it('migrates v1 to v2', () => {
    backend.data.set(KEY, validBlob({ history: { 女: goodEntry } }));
    const s = createStore({
      backend,
      key: KEY,
      currentVersion: 2,
      migrations: { 1: (old) => ({ ...(old as object), introSeen: true }) },
    });
    expect(s.loadState()).toEqual({ schemaVersion: 2, introSeen: true, history: { 女: goodEntry } });
  });

  it('migrates by reshaping an old field', () => {
    backend.data.set(KEY, JSON.stringify({ schemaVersion: 1, seen: true, entries: { 女: goodEntry } }));
    const s = createStore({
      backend,
      key: KEY,
      currentVersion: 2,
      migrations: {
        1: (old) => {
          const o = old as { seen: boolean; entries: unknown };
          return { introSeen: o.seen, history: o.entries };
        },
      },
    });
    expect(s.loadState()).toEqual({ schemaVersion: 2, introSeen: true, history: { 女: goodEntry } });
  });

  it('runs a two-step chain v1 -> v2 -> v3 in order', () => {
    backend.data.set(KEY, validBlob());
    const order: number[] = [];
    const s = createStore({
      backend,
      key: KEY,
      currentVersion: 3,
      migrations: {
        1: (old) => {
          order.push(1);
          return { ...(old as object), introSeen: true };
        },
        2: (old) => {
          order.push(2);
          return { ...(old as object), history: { 女: goodEntry } };
        },
      },
    });
    expect(s.loadState()).toEqual({ schemaVersion: 3, introSeen: true, history: { 女: goodEntry } });
    expect(order).toEqual([1, 2]);
  });

  it('resets when an older version has no migration', () => {
    backend.data.set(KEY, validBlob({ introSeen: true }));
    const s = createStore({ backend, key: KEY, currentVersion: 2, migrations: {} });
    expect(s.loadState()).toEqual(s.defaultState);
  });

  it('resets when the migration chain has a gap', () => {
    backend.data.set(KEY, validBlob({ introSeen: true }));
    const s = createStore({
      backend,
      key: KEY,
      currentVersion: 3,
      migrations: { 2: (old) => old },
    });
    expect(s.loadState()).toEqual(s.defaultState);
  });

  it('resets when a migration throws', () => {
    backend.data.set(KEY, validBlob({ introSeen: true }));
    const s = createStore({
      backend,
      key: KEY,
      currentVersion: 2,
      migrations: {
        1: () => {
          throw new Error('boom');
        },
      },
    });
    expect(s.loadState()).toEqual(s.defaultState);
  });

  it.each([
    ['null', null],
    ['a string', 'junk'],
    ['an array', []],
    ['a bad shape', { introSeen: 'yes', history: {} }],
    ['a bad history', { introSeen: true, history: { 女: { step: -1 } } }],
  ])('resets when a migration returns %s', (_name, out) => {
    backend.data.set(KEY, validBlob({ introSeen: true }));
    const s = createStore({ backend, key: KEY, currentVersion: 2, migrations: { 1: () => out } });
    expect(s.loadState()).toEqual(s.defaultState);
  });
});

describe('unknown or newer schema versions', () => {
  const versions: [string, string][] = [
    ['99', '99'],
    ['3 (newer than 2)', '3'],
    ['0', '0'],
    ['-1', '-1'],
    ['1.5', '1.5'],
    ["'1' string", '"1"'],
    ['null', 'null'],
  ];
  it.each(versions)('resets and never migrates for schemaVersion %s', (_n, literal) => {
    backend.data.set(KEY, `{"schemaVersion":${literal},"introSeen":true,"history":{}}`);
    const migrate = vi.fn((old: unknown) => old);
    const s = createStore({ backend, key: KEY, currentVersion: 2, migrations: { 1: migrate, 2: migrate } });
    expect(s.loadState()).toEqual(s.defaultState);
    expect(migrate).not.toHaveBeenCalled();
  });

  it('resets and never migrates when schemaVersion is missing', () => {
    backend.data.set(KEY, '{"introSeen":true,"history":{}}');
    const migrate = vi.fn((old: unknown) => old);
    const s = createStore({ backend, key: KEY, currentVersion: 2, migrations: { 1: migrate } });
    expect(s.loadState()).toEqual(s.defaultState);
    expect(migrate).not.toHaveBeenCalled();
  });
});

describe('corrupt data resets to defaults', () => {
  const cases: [string, string][] = [
    ['invalid JSON', '{not json'],
    ['JSON null', 'null'],
    ['a JSON array', '[1,2]'],
    ['a JSON string', '"hello"'],
    ['wrong introSeen type', validBlob({ introSeen: 'yes' })],
    ['history not an object', validBlob({ history: [] })],
    ['step -1', validBlob({ history: { 女: { ...goodEntry, step: -1 } } })],
    ['step 2.5', validBlob({ history: { 女: { ...goodEntry, step: 2.5 } } })],
    ['step NaN (null)', validBlob({ history: { 女: { ...goodEntry, step: null } } })],
    ['bad lastOutcome', validBlob({ history: { 女: { ...goodEntry, lastOutcome: 'perfect' } } })],
    ['negative nextDue', validBlob({ history: { 女: { ...goodEntry, nextDue: -5 } } })],
    ['non-numeric nextDue', validBlob({ history: { 女: { ...goodEntry, nextDue: '5' } } })],
    ['bad attempt outcome', validBlob({ history: { 女: { ...goodEntry, history: [{ outcome: 'x', at: 1 }] } } })],
    ['bad attempt at', validBlob({ history: { 女: { ...goodEntry, history: [{ outcome: 'clean', at: 'now' }] } } })],
    ['attempts not an array', validBlob({ history: { 女: { ...goodEntry, history: {} } } })],
    [
      '__proto__ key in history',
      `{"schemaVersion":1,"introSeen":false,"history":{"__proto__":${JSON.stringify(goodEntry)}}}`,
    ],
    [
      'constructor key in history',
      `{"schemaVersion":1,"introSeen":false,"history":{"constructor":${JSON.stringify(goodEntry)}}}`,
    ],
  ];
  it.each(cases)('resets on %s', (_n, raw) => {
    backend.data.set(KEY, raw);
    const s = createStore({ backend, key: KEY });
    expect(s.loadState()).toEqual(s.defaultState);
  });

  it('accepts a valid hand-written blob (sanity check)', () => {
    backend.data.set(KEY, validBlob({ history: { 女: goodEntry } }));
    const s = createStore({ backend, key: KEY });
    expect(s.loadState().history['女']).toEqual(goodEntry);
  });
});

describe('never throws', () => {
  it('getItem throwing yields DEFAULT_STATE', () => {
    backend.throwOn.getItem = true;
    const s = createStore({ backend, key: KEY });
    expect(() => s.loadState()).not.toThrow();
    expect(s.loadState()).toEqual(s.defaultState);
    expect(s.getIntroSeen()).toBe(false);
  });

  it('setItem throwing (quota) is swallowed and recordOutcome returns in-memory state', () => {
    backend.throwOn.setItem = true;
    const s = createStore({ backend, key: KEY });
    const e = entry();
    expect(() => s.saveState(s.defaultState)).not.toThrow();
    expect(() => s.setIntroSeen(true)).not.toThrow();
    let result: PersistedState | undefined;
    expect(() => {
      result = s.recordOutcome('女', e);
    }).not.toThrow();
    expect(result?.history['女']).toEqual(e);
    expect(backend.data.size).toBe(0);
  });

  it('removeItem throwing does not break resetToDefaults', () => {
    backend.throwOn.removeItem = true;
    const s = createStore({ backend, key: KEY });
    expect(() => s.resetToDefaults()).not.toThrow();
  });

  it('a throwing backend resolver makes every API safe', () => {
    const s = createStore({
      key: KEY,
      backend: () => {
        throw new Error('SecurityError');
      },
    });
    const e = entry();
    expect(s.loadState()).toEqual(s.defaultState);
    expect(() => s.saveState(s.defaultState)).not.toThrow();
    expect(() => s.setIntroSeen(true)).not.toThrow();
    expect(s.getIntroSeen()).toBe(false);
    expect(s.recordOutcome('女', e).history['女']).toEqual(e);
    expect(() => s.resetToDefaults()).not.toThrow();
  });

  it('no backend at all gives safe defaults', () => {
    const s = createStore({ key: KEY, backend: () => undefined });
    const e = entry();
    expect(s.loadState()).toEqual(s.defaultState);
    expect(s.getIntroSeen()).toBe(false);
    expect(() => s.setIntroSeen(true)).not.toThrow();
    expect(s.recordOutcome('女', e).history['女']).toEqual(e);
    expect(() => s.resetToDefaults()).not.toThrow();
  });
});

describe('recordOutcome persists immediately (Req 7.6)', () => {
  it('writes the entry before returning', () => {
    const s = createStore({ backend, key: KEY });
    const e = entry();
    const before = backend.calls.filter((c) => c === 'setItem').length;
    const result = s.recordOutcome('女', e);
    expect(backend.calls.filter((c) => c === 'setItem').length - before).toBe(1);
    const raw = JSON.parse(backend.data.get(KEY) as string) as PersistedState;
    expect(raw.history['女']).toEqual(e);
    expect(result).toEqual(s.loadState());
  });

  it('keeps earlier characters when recording another', () => {
    const s = createStore({ backend, key: KEY });
    const a = entry('clean');
    const b = entry('struggled');
    s.recordOutcome('女', a);
    s.recordOutcome('好', b);
    const raw = JSON.parse(backend.data.get(KEY) as string) as PersistedState;
    expect(raw.history).toEqual({ 女: a, 好: b });
  });

  it('overwrites the same character', () => {
    const s = createStore({ backend, key: KEY });
    const first = entry('clean');
    const second = entry('clean', first);
    s.recordOutcome('女', first);
    const result = s.recordOutcome('女', second);
    expect(Object.keys(result.history)).toEqual(['女']);
    expect(result.history['女']).toEqual(second);
    expect(s.loadState().history['女']).toEqual(second);
  });

  it('preserves introSeen', () => {
    const s = createStore({ backend, key: KEY });
    s.setIntroSeen(true);
    const result = s.recordOutcome('女', entry());
    expect(result.introSeen).toBe(true);
    expect(s.getIntroSeen()).toBe(true);
  });
});

describe('intro flag and reset', () => {
  it('setIntroSeen(true) round-trips and preserves history', () => {
    const s = createStore({ backend, key: KEY });
    const e = entry();
    s.recordOutcome('女', e);
    s.setIntroSeen(true);
    expect(s.getIntroSeen()).toBe(true);
    expect(s.loadState().history['女']).toEqual(e);
  });

  it('setIntroSeen(false) works after true', () => {
    const s = createStore({ backend, key: KEY });
    s.setIntroSeen(true);
    s.setIntroSeen(false);
    expect(s.getIntroSeen()).toBe(false);
  });

  it('resetToDefaults clears everything and removes the key', () => {
    const s = createStore({ backend, key: KEY });
    s.setIntroSeen(true);
    s.recordOutcome('女', entry());
    s.resetToDefaults();
    expect(backend.data.has(KEY)).toBe(false);
    expect(s.loadState()).toEqual(DEFAULT_STATE);
  });
});

describe('schemaVersion stamping and default immutability', () => {
  it('saveState writes the store version, not the passed one', () => {
    const s = createStore({ backend, key: KEY, currentVersion: 4 });
    s.saveState({ schemaVersion: 99, introSeen: true, history: {} });
    const raw = JSON.parse(backend.data.get(KEY) as string) as PersistedState;
    expect(raw.schemaVersion).toBe(4);
    expect(s.loadState().schemaVersion).toBe(4);
  });

  it('DEFAULT_STATE is frozen and mutation does not leak into loadState', () => {
    const s = createStore({ backend, key: KEY });
    const d = s.loadState() as { introSeen: boolean; history: Record<string, ReviewEntry> };
    expect(Object.isFrozen(d)).toBe(true);
    expect(() => {
      d.introSeen = true;
    }).toThrow();
    expect(() => {
      d.history['女'] = entry();
    }).toThrow();
    expect(s.loadState()).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION, introSeen: false, history: {} });
    expect(Object.isFrozen(DEFAULT_STATE)).toBe(true);
  });
});

describe('default module-level store on jsdom localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('persists through localStorage under STORAGE_KEY', () => {
    defaults.setIntroSeen(true);
    expect(defaults.getIntroSeen()).toBe(true);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, introSeen: true });
  });

  it('records outcomes and resets via the default functions', () => {
    const e = entry();
    defaults.recordOutcome('女', e);
    expect(defaults.loadState().history['女']).toEqual(e);
    defaults.resetToDefaults();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(defaults.loadState()).toEqual(DEFAULT_STATE);
  });

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const e = entry();
    expect(() => defaults.saveState(DEFAULT_STATE)).not.toThrow();
    expect(() => defaults.setIntroSeen(true)).not.toThrow();
    expect(defaults.recordOutcome('女', e).history['女']).toEqual(e);
  });
});
