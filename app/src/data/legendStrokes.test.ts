import { afterEach, describe, expect, it, vi } from 'vitest';
import realFile from '../../public/data/legend-strokes.json';
import { defaultLegendStrokesUrl, legendHanCharacters, loadLegendStrokes } from './legendStrokes';

const SIX = ['天', '雨', '粟', '鬼', '夜', '哭'];

function entry(): { strokes: string[]; medians: number[][][]; radStrokes: number[] } {
  return { strokes: ['M 0 0 L 1 1 Z'], medians: [[[0, 0], [1, 1]]], radStrokes: [0] };
}

function stubBody(body: unknown): ReturnType<typeof vi.fn> {
  const f = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      }) as unknown as Response,
  );
  vi.stubGlobal('fetch', f);
  return f;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('legendHanCharacters', () => {
  it('lists the six Han characters in order and skips the comma', () => {
    expect(legendHanCharacters()).toEqual(SIX);
  });
});

describe('loadLegendStrokes: success', () => {
  it('returns the entries of the real file unchanged and uses the base-path URL', async () => {
    const f = stubBody(realFile);
    const res = await loadLegendStrokes();
    expect(f).toHaveBeenCalledWith(defaultLegendStrokesUrl());
    expect(defaultLegendStrokesUrl().endsWith('data/legend-strokes.json')).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(Object.keys(res.strokes)).toEqual(SIX);
    expect(res.strokes).toEqual(realFile);
  });

  it('uses a custom url', async () => {
    const f = stubBody({ 天: entry() });
    await loadLegendStrokes('/x/legend.json');
    expect(f).toHaveBeenCalledWith('/x/legend.json');
  });

  it('accepts a partial file and drops invalid or unrelated entries', async () => {
    stubBody({ 天: entry(), 雨: { strokes: [], medians: [] }, 人: entry() });
    const res = await loadLegendStrokes();
    if (!res.ok) throw new Error('expected ok');
    expect(Object.keys(res.strokes)).toEqual(['天']);
  });

  it('accepts an entry without radStrokes', async () => {
    const e = entry() as Partial<ReturnType<typeof entry>>;
    delete e.radStrokes;
    stubBody({ 天: e });
    await expect(loadLegendStrokes()).resolves.toMatchObject({ ok: true });
  });
});

describe('loadLegendStrokes: failures', () => {
  it('network: fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    await expect(loadLegendStrokes()).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('network: fetch throws synchronously', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('boom');
      }),
    );
    await expect(loadLegendStrokes()).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('network: reading the body rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => Promise.reject(new Error('x')) })),
    );
    await expect(loadLegendStrokes()).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('status: a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 }) as unknown as Response));
    await expect(loadLegendStrokes()).resolves.toEqual({ ok: false, reason: 'status' });
  });

  it.each(['not json', '', '<html>404</html>', '[]', 'null', '42'])('json: body %j', async (body) => {
    stubBody(body);
    await expect(loadLegendStrokes()).resolves.toEqual({ ok: false, reason: 'json' });
  });

  it.each([
    ['empty object', {}],
    ['only other characters', { 人: entry() }],
    ['only invalid entries', { 天: { strokes: ['M 0 0'], medians: [] }, 雨: null }],
  ])('empty: %s', async (_name, body) => {
    stubBody(body);
    await expect(loadLegendStrokes()).resolves.toEqual({ ok: false, reason: 'empty' });
  });
});
