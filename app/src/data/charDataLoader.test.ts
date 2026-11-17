import { afterEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import {
  defaultDatasetUrl,
  getRecord,
  levelUrl,
  loadDataset,
  loadLevel,
  loadManifest,
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
    cangjie: 'ON',
    summonInk: { class: 'transparent', keyStrokes: [[0], [1]] },
    sources: {
      cangjie: 'unihan',
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

  it('accepts partial and opaque summonInk', async () => {
    const partial = validRecord('人') as unknown as Mutable;
    partial.summonInk = { class: 'partial', keyStrokes: [[0, 1], []] };
    const opaque = validRecord('大') as unknown as Mutable;
    opaque.summonInk = { class: 'opaque' };
    stubFetchBody({ 人: partial, 大: opaque });
    const res = await loadDataset();
    expect(res.ok).toBe(true);
  });

  it('uses a custom url when provided', async () => {
    const f = stubFetchBody({ 人: validRecord('人') });
    const res = await loadDataset('/custom/chars.json');
    expect(res.ok).toBe(true);
    expect(f).toHaveBeenCalledWith('/custom/chars.json');
  });

  // (needs task 3.5) fails until characters.json is regenerated with summonInk.
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
    'cangjie',
    'summonInk',
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
    ['lower-case cangjie', (r) => (r.cangjie = 'on')],
    ['six-key cangjie', (r) => (r.cangjie = 'ABCDEF')],
    ['non-string cangjie', (r) => (r.cangjie = 42)],
    ['summonInk unknown class', (r) => (r.summonInk = { class: 'ghostly' })],
    ['summonInk not an object', (r) => (r.summonInk = 'opaque')],
    ['opaque with keyStrokes', (r) => (r.summonInk = { class: 'opaque', keyStrokes: [[0], [1]] })],
    ['transparent without keyStrokes', (r) => (r.summonInk = { class: 'transparent' })],
    ['keyStrokes not arrays', (r) => (r.summonInk = { class: 'transparent', keyStrokes: [0, 1] })],
    ['keyStrokes wrong length', (r) => (r.summonInk = { class: 'transparent', keyStrokes: [[0, 1]] })],
    ['keyStrokes non-integer', (r) => (r.summonInk = { class: 'transparent', keyStrokes: [[0.5], [1]] })],
    ['keyStrokes out of range', (r) => (r.summonInk = { class: 'transparent', keyStrokes: [[0], [2]] })],
    ['keyStrokes negative', (r) => (r.summonInk = { class: 'transparent', keyStrokes: [[-1], [1]] })],
    ['keyStrokes not ascending', (r) => (r.summonInk = { class: 'transparent', keyStrokes: [[1, 0], []] })],
    ['keyStrokes duplicate stroke', (r) => (r.summonInk = { class: 'partial', keyStrokes: [[0], [0]] })],
    ['transparent missing a stroke', (r) => (r.summonInk = { class: 'transparent', keyStrokes: [[0], []] })],
    ['partial with all entries empty', (r) => (r.summonInk = { class: 'partial', keyStrokes: [[], []] })],
    ['transparent with null cangjie', (r) => (r.cangjie = null)],
  ];

  it.each(mutations)('%s', async (_name, mutate) => {
    const rec = validRecord('人') as unknown as Mutable;
    mutate(rec);
    stubFetchBody({ 人: rec });
    await expect(loadDataset()).resolves.toEqual(invalid);
  });

  it.each([['null', null], ['a valid code', 'ON']])('accepts cangjie %s', async (_n, value) => {
    const rec = validRecord('人') as unknown as Mutable;
    rec.cangjie = value;
    if (value === null) rec.summonInk = { class: 'opaque' };
    stubFetchBody({ 人: rec });
    const res = await loadDataset();
    expect(res.ok).toBe(true);
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

  it.each(['我', '口', '爱'])('serves real stroke data for %s', (ch) => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const loader = makeCharDataLoader(new Map(Object.entries(realData)));
    const onLoad = vi.fn();
    const onError = vi.fn();
    loader(ch, onLoad, onError);
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(toHanziWriterData(realData[ch].strokeData));
    expect(onError).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
  });
});

describe('levelUrl', () => {
  it('uses the base path and the level file names', () => {
    const base = import.meta.env?.BASE_URL ?? '/';
    expect(levelUrl(1)).toBe(`${base}data/characters.json`);
    expect(levelUrl(2)).toBe(`${base}data/characters-level2.json`);
    expect(levelUrl(3)).toBe(`${base}data/characters-level3.json`);
  });

  it('level 1 equals the default dataset URL', () => {
    expect(levelUrl(1)).toBe(defaultDatasetUrl());
  });
});

describe('promptReview', () => {
  it.each(['reviewed', 'unreviewed'])('accepts %s', async (value) => {
    const rec = validRecord('人') as unknown as Mutable;
    rec.promptReview = value;
    stubFetchBody({ 人: rec });
    const res = await loadDataset();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.dataset.get('人')?.promptReview).toBe(value);
  });

  it('accepts a record without promptReview', async () => {
    stubFetchBody({ 人: validRecord('人') });
    const res = await loadDataset();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.dataset.get('人')?.promptReview).toBeUndefined();
  });

  it.each([
    ['Reviewed', 'Reviewed'],
    ['empty string', ''],
    ['true', true],
    ['null', null],
    ['number', 1],
    ['object', { value: 'reviewed' }],
  ])('rejects %s', async (_name, value) => {
    const rec = validRecord('人') as unknown as Mutable;
    rec.promptReview = value;
    stubFetchBody({ 人: rec });
    await expect(loadDataset()).resolves.toEqual({ ok: false, reason: 'invalid-shape' });
  });
});

describe('loadLevel', () => {
  it('loads a level 2 file with a stubbed fetch', async () => {
    const a = validRecord('人') as unknown as Mutable;
    a.promptReview = 'unreviewed';
    const b = validRecord('大') as unknown as Mutable;
    b.promptReview = 'reviewed';
    const f = stubFetchBody({ 人: a, 大: b });
    const res = await loadLevel(2);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(levelUrl(2));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect([...res.dataset.keys()]).toEqual(['人', '大']);
    expect(res.dataset.get('人')?.promptReview).toBe('unreviewed');
  });

  it('reports a failed fetch and an invalid record', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response));
    await expect(loadLevel(3)).resolves.toEqual({ ok: false, reason: 'fetch-failed' });
    const bad = validRecord('人') as unknown as Mutable;
    bad.promptReview = 'maybe';
    stubFetchBody({ 人: bad });
    await expect(loadLevel(3)).resolves.toEqual({ ok: false, reason: 'invalid-shape' });
  });
});

describe('loadManifest', () => {
  const info = (level: number, file: string) => ({
    level,
    file,
    count: 300 + (level - 1) * 100,
    averageStrokes: 7 + level / 10,
    exampleMeanings: ['eight', 'father', 'white'],
  });
  const validManifest = () => ({
    levels: [
      info(1, 'characters.json'),
      info(2, 'characters-level2.json'),
      info(3, 'characters-level3.json'),
    ],
  });

  it('loads a valid manifest from the default URL', async () => {
    const f = stubFetchBody(validManifest());
    const res = await loadManifest();
    const base = import.meta.env?.BASE_URL ?? '/';
    expect(f).toHaveBeenCalledWith(`${base}data/levels.json`);
    expect(res).toEqual({ ok: true, manifest: validManifest() });
  });

  it('uses a custom url', async () => {
    const f = stubFetchBody(validManifest());
    await loadManifest('/x/levels.json');
    expect(f).toHaveBeenCalledWith('/x/levels.json');
  });

  it('fails on network error, bad status and non-JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('network'))));
    await expect(loadManifest()).resolves.toEqual({ ok: false });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 }) as unknown as Response));
    await expect(loadManifest()).resolves.toEqual({ ok: false });
    stubFetchBody('not json');
    await expect(loadManifest()).resolves.toEqual({ ok: false });
  });

  type M = ReturnType<typeof validManifest>;
  const cases: [string, (m: M) => unknown][] = [
    ['top level is an array', () => []],
    ['levels missing', () => ({})],
    ['two levels', (m) => ({ levels: m.levels.slice(0, 2) })],
    ['four levels', (m) => ({ levels: [...m.levels, info(3, 'characters-level3.json')] })],
    ['levels out of order', (m) => ({ levels: [m.levels[1], m.levels[0], m.levels[2]] })],
    ['wrong file name', (m) => void (m.levels[1].file = 'other.json')],
    ['count 0', (m) => void (m.levels[0].count = 0)],
    ['count fractional', (m) => void (m.levels[0].count = 1.5)],
    ['count a string', (m) => void ((m.levels[0] as Record<string, unknown>).count = '300')],
    ['averageStrokes not a number', (m) => void ((m.levels[2] as Record<string, unknown>).averageStrokes = 'x')],
    ['two example meanings', (m) => void (m.levels[0].exampleMeanings = ['a', 'b'])],
    ['four example meanings', (m) => void (m.levels[0].exampleMeanings = ['a', 'b', 'c', 'd'])],
    ['empty example meaning', (m) => void (m.levels[1].exampleMeanings = ['a', '', 'c'])],
    ['non-string example meaning', (m) => void (m.levels[1].exampleMeanings = ['a', 'b', 3 as unknown as string])],
  ];

  it.each(cases)('rejects: %s', async (_name, mutate) => {
    const m = validManifest();
    const out = mutate(m);
    stubFetchBody(out === undefined ? m : out);
    await expect(loadManifest()).resolves.toEqual({ ok: false });
  });
});
