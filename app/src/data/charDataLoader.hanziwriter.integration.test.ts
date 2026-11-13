/**
 * Integration test: the REAL hanzi-writer library (not mocked) loading stroke
 * data from OUR offline dataset through makeCharDataLoader.
 *
 * Polyfills: see the POLYFILLS block below (documents exactly what was added).
 */
import HanziWriter from 'hanzi-writer';
import type { CharacterJson } from 'hanzi-writer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import { loadDataset, makeCharDataLoader, type CharacterDataset } from './charDataLoader';
import type { CharacterRecord } from './types';

// POLYFILLS: none. The real library created writers in jsdom without needing
// any extra SVG/DOM APIs for the options used here.

const realData = realDataJson as unknown as Record<string, CharacterRecord>;
const TIMEOUT_MS = 3000;

type Signal =
  | { kind: 'success'; data: CharacterJson }
  | { kind: 'error'; error: Error | string | undefined };

/** Create a real writer and resolve with whichever load signal the library emits first. */
function createAndWait(
  el: HTMLElement,
  char: string,
  dataset: CharacterDataset,
): Promise<{ signal: Signal; writer: HanziWriter }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`hanzi-writer gave no load signal for "${char}" within ${TIMEOUT_MS}ms`)),
      TIMEOUT_MS,
    );
    // eslint-disable-next-line prefer-const
    let writer: HanziWriter | undefined;
    let early: Signal | undefined;
    const done = (signal: Signal): void => {
      clearTimeout(timer);
      if (writer) resolve({ signal, writer });
      else early = signal; // callback fired synchronously inside create()
    };
    writer = HanziWriter.create(el, char, {
      charDataLoader: makeCharDataLoader(dataset),
      onLoadCharDataSuccess: (data) => done({ kind: 'success', data }),
      onLoadCharDataError: (error) => done({ kind: 'error', error }),
      showCharacter: false,
      showOutline: false,
    });
    if (early) done(early);
  });
}

describe('real hanzi-writer + offline charDataLoader', () => {
  let dataset: CharacterDataset;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;
  const containers: HTMLElement[] = [];

  function container(): HTMLElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    containers.push(el);
    return el;
  }

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    fetchSpy = vi.fn(async () => new Response(JSON.stringify(realDataJson), { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    const result = await loadDataset('/data/characters.json');
    if (!result.ok) throw new Error(`loadDataset failed: ${result.reason}`);
    dataset = result.dataset;
    fetchSpy.mockClear(); // only count fetches made AFTER the dataset is loaded
  });

  afterEach(() => {
    for (const el of containers.splice(0)) el.remove();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it.each(['我', '口', '爱'])('loads stroke data for %s from our dataset', async (char) => {
    const record = realData[char];
    expect(record).toBeDefined();

    const { signal, writer } = await createAndWait(container(), char, dataset);

    expect(signal.kind).toBe('success');
    if (signal.kind !== 'success') return;
    expect(signal.data.strokes.length).toBeGreaterThan(0);
    expect(signal.data.strokes.length).toBe(record.strokeCount);

    const character = await writer.getCharacterData();
    expect(character.strokes.length).toBe(record.strokeCount);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never requests a hanzi-writer CDN URL', async () => {
    for (const char of ['我', '口', '爱']) {
      await createAndWait(container(), char, dataset);
    }
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('jsdelivr') || u.includes('hanzi-writer-data'))).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
  });

  it('signals an error (not success) for a character missing from the dataset', async () => {
    expect(dataset.has('龘')).toBe(false);
    const { signal, writer } = await createAndWait(container(), '龘', dataset);
    // Avoid an unhandled rejection from the library's internal promise.
    writer.getCharacterData().catch(() => undefined);

    expect(signal.kind).toBe('error');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
