import { afterEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import {
  defaultDatasetUrl,
  getRecord,
  loadDataset,
  makeCharDataLoader,
  toHanziWriterData,
} from './charDataLoader';
import type { CharacterRecord, StrokeData } from './types';

const realData = realDataJson as unknown as Record<string, CharacterRecord>;

/** One valid, minimal CharacterRecord literal. */
function validRecord(char: string): CharacterRecord {
  return {
    character: char,
    pinyin: ['ni3'],
    meanings: ['you'],
    strokeCount: 2,
    strokeData: {
      strokes: ['M 0 0 L 10 10 Z', 'M 5 5 L 20 20 Z'],
      medians: [
        [
          [0, 0],
          [10, 10],
        ],
        [
          [5, 5],
          [20, 20],
        ],
      ],
      radStrokes: [0, 1],
    },
    decomposition: {
      decomposition: '？',
      radical: char,
      etymology: null,
      matches: null,
      atomic: true,
      components: [char],
    },
    prompt: { meaning: 'you', pinyin: 'nǐ' },
    sources: {
      pinyin: 'cc-cedict',
      meanings: 'cc-cedict',
      strokeCount: 'hanzi-writer-data',
      strokeData: 'hanzi-writer-data',
      decomposition: 'make-me-a-hanzi',
    },
  };
}

/** A record shape whose fields tests may overwrite or delete with arbitrary (invalid) values. */
interface Mutable {
  [field: string]: unknown;
  strokeData: { strokes: unknown[]; medians: unknown[][] };
  prompt: { meaning?: unknown; pinyin?: unknown };
}

function okResponse(body: string): Response {
  return { ok: true, status: 200, text: async () => body } as unknown as Response;
}

function stubFetchBody(body: unknown): ReturnType<typeof vi.fn> {
  const f = vi.fn(async () => okResponse(typeof body === 'string' ? body : JSON.stringify(body)));
  vi.stubGlobal('fetch', f);
  return f;
}

function deepFreeze<T>(o: T): T {
  if (typeof o === 'object' && o !== null && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadDataset: success', () => {
  it('returns a Map keyed in JSON key order and uses the default URL', async () => {
    const f = stubFetchBody({ 乙: validRecord('乙'), 人: validRecord('人'), 大: validRecord('大') });
    const res = await loadDataset();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.dataset).toBeInstanceOf(Map);
    expect([...res.dataset.keys()]).toEqual(['乙', '人', '大']);
    expect(res.dataset.get('人')).toEqual(validRecord('人'));
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(defaultDatasetUrl());
    expect(defaultDatasetUrl().endsWith('data/characters.json')).toBe(true);
  });

  it('uses a custom url when provided', async () => {
    const f = stubFetchBody({ 人: validRecord('人') });
    const res = await loadDataset('/custom/chars.json');
    expect(res.ok).toBe(true);
    expect(f).toHaveBeenCalledWith('/custom/chars.json');
  });

  it('loads the real characters.json without mutating it', async () => {
    const before = JSON.parse(JSON.stringify(realData));
    stubFetchBody(realData);
    const res = await loadDataset();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.dataset.size).toBe(Object.keys(realData).length);
    expect(res.dataset.size).toBe(300);
    for (const rec of res.dataset.values()) {
      expect(rec.strokeData.strokes.length).toBeGreaterThan(0);
    }
    expect(realData).toEqual(before);
  });
});

describe('loadDataset: fetch-failed', () => {
  it('network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('network'))));
    await expect(loadDataset()).resolves.toEqual({ ok: false, reason: 'fetch-failed' });
  });

  it.each([
    [false, 200],
    [false, 404],
    [false, 500],
  ])('response ok=%s status=%s', async (ok, status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok, status, text: async () => '{}' }) as unknown as Response),
    );
    await expect(loadDataset()).resolves.toEqual({ ok: false, reason: 'fetch-failed' });
  });

  it('fetch throws synchronously', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('sync boom');
      }),
    );
    await expect(loadDataset()).resolves.toEqual({ ok: false, reason: 'fetch-failed' });
  });

  it('reading the body rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => Promise.reject(new Error('x')) })),
    );
    await expect(loadDataset()).resolves.toEqual({ ok: false, reason: 'fetch-failed' });
  });
});

describe('loadDataset: parse-failed', () => {
  it.each(['not json', '{"a":', '', '<html>404</html>'])('body %j is not JSON', async (body) => {
    stubFetchBody(body);
    await expect(loadDataset()).resolves.toEqual({ ok: false, reason: 'parse-failed' });
  });
});

describe('loadDataset: invalid-shape', () => {
  const invalid = { ok: false, reason: 'invalid-shape' };

  it.each([
    ['array', '[]'],
    ['null', 'null'],
    ['string', '"hello"'],
    ['number', '42'],
  ])('top-level %s', async (_name, body) => {
    stubFetchBody(body);
    await expect(loadDataset()).resolves.toEqual(invalid);
  });

  it.each([
    'character',
    'pinyin',
    'meanings',
    'strokeCount',
    'strokeData',
    'decomposition',
    'prompt',
    'sources',
  ])('record missing %s', async (field) => {
    const rec = validRecord('人') as unknown as Mutable;
    delete rec[field];
    stubFetchBody({ 人: rec });
    await expect(loadDataset()).resolves.toEqual(invalid);
  });

  const mutations: [string, (r: Mutable) => void][] = [
    ['empty pinyin array', (r) => (r.pinyin = [])],
    ['empty meanings', (r) => (r.meanings = [])],
    ['strokeCount 0', (r) => (r.strokeCount = 0)],
    ['strokeCount 1.5', (r) => (r.strokeCount = 1.5)],
    ['strokeCount negative', (r) => (r.strokeCount = -3)],
    ['empty strokes', (r) => (r.strokeData.strokes = [])],
    ['medians length mismatch', (r) => (r.strokeData.medians = [r.strokeData.medians[0]])],
    ['medians with non-number', (r) => (r.strokeData.medians[0][0] = ['a', 1])],
    ['empty prompt.meaning', (r) => (r.prompt.meaning = '')],
    ['missing prompt.pinyin', (r) => delete r.prompt.pinyin],
    ['character differs from key', (r) => (r.character = '大')],
  ];

  it.each(mutations)('%s', async (_name, mutate) => {
    const rec = validRecord('人') as unknown as Mutable;
    mutate(rec);
    stubFetchBody({ 人: rec });
    await expect(loadDataset()).resolves.toEqual(invalid);
  });

  it('one bad record among many good ones fails the whole load', async () => {
    const body: Record<string, unknown> = {};
    for (const c of ['一', '二', '三', '四', '五']) body[c] = validRecord(c);
    const bad = validRecord('六') as unknown as Mutable;
    bad.meanings = [];
    body['六'] = bad;
    stubFetchBody(body);
    await expect(loadDataset()).resolves.toEqual(invalid);
  });

  it.each(['__proto__', 'constructor'])('forbidden key %s', async (key) => {
    // Raw JSON so `__proto__` becomes an own property after JSON.parse.
    const rec = JSON.stringify(validRecord(key));
    stubFetchBody(`{"${key}":${rec}}`);
    await expect(loadDataset()).resolves.toEqual(invalid);
  });
});

describe('getRecord', () => {
  it('returns the record when present and undefined when absent', async () => {
    stubFetchBody({ 人: validRecord('人') });
    const res = await loadDataset();
    if (!res.ok) throw new Error('expected ok');
    expect(getRecord(res.dataset, '人')).toEqual(validRecord('人'));
    expect(getRecord(res.dataset, '大')).toBeUndefined();
  });
});

describe('toHanziWriterData', () => {
  it('projects strokes/medians/radStrokes into a new object without mutating input', () => {
    const sd: StrokeData = deepFreeze(validRecord('人').strokeData);
    const out = toHanziWriterData(sd);
    expect(out).not.toBe(sd);
    expect(out.strokes).toEqual(sd.strokes);
    expect(out.medians).toEqual(sd.medians);
    expect(out.radStrokes).toEqual(sd.radStrokes);
    expect(sd).toEqual(validRecord('人').strokeData);
  });
});

describe('makeCharDataLoader', () => {
  it('calls onLoad synchronously once for a known char, never onError, never fetch', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const rec = validRecord('人');
    const loader = makeCharDataLoader(new Map([['人', rec]]));
    const onLoad = vi.fn();
    const onError = vi.fn();
    loader('人', onLoad, onError);
    // Assertions run right after the call returns: onLoad was synchronous.
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(toHanziWriterData(rec.strokeData));
    expect(onError).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
  });

  it('calls onError once, not onLoad, for an unknown char', () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const loader = makeCharDataLoader(new Map([['人', validRecord('人')]]));
    const onLoad = vi.fn();
    const onError = vi.fn();
    loader('龙', onLoad, onError);
    expect(onLoad).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('龙');
    expect(f).not.toHaveBeenCalled();
  });

  it.each(['我', '口', '爱'])('serves real stroke data for %s', async (ch) => {
    const f = stubFetchBody(realData);
    const res = await loadDataset();
    if (!res.ok) throw new Error('expected ok');
    f.mockClear();
    const loader = makeCharDataLoader(res.dataset);
    const onLoad = vi.fn();
    const onError = vi.fn();
    loader(ch, onLoad, onError);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(toHanziWriterData(realData[ch].strokeData));
    expect(onError).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
  });
});
