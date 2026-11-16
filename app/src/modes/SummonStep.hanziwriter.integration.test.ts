/**
 * Integration test: the REAL hanzi-writer library (not mocked) in jsdom,
 * drawing single strokes of 明 with `showCharacter: false`.
 *
 * It documents the library behaviour the Summon step's ink queue relies on
 * (spec summon-ink, design "hanzi-writer 3.7.3: the verified way to draw
 * individual strokes"):
 *  - at mount nothing is visible;
 *  - `animateStroke(n)` leaves stroke n visible, and earlier strokes stay;
 *  - overlapping `animateStroke` calls cancel each other, so the earlier
 *    stroke never appears. That is why the step queues stroke calls and
 *    awaits each one.
 *
 * The stroke data is read straight from the committed characters.json, so
 * this test does not depend on `summonInk` being present or on loadDataset.
 *
 * POLYFILL: if jsdom has no usable `requestAnimationFrame`, a timer-based one
 * is installed below (about 60 frames per second). The library's animation
 * loop needs it.
 */
import HanziWriter from 'hanzi-writer';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import realDataJson from '../../public/data/characters.json';
import type { CharacterRecord } from '../data/types';

const records = realDataJson as unknown as Record<string, CharacterRecord>;
const MING = '明';
const SVG_NS = 'http://www.w3.org/2000/svg';
const FAST_SPEED = 50; // fast enough to finish a stroke in a few frames

let installedRaf = false;
let installedCaf = false;

beforeAll(() => {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number) as typeof requestAnimationFrame;
    installedRaf = true;
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    globalThis.cancelAnimationFrame = ((id: number): void => {
      clearTimeout(id);
    }) as typeof cancelAnimationFrame;
    installedCaf = true;
  }
});

afterAll(() => {
  if (installedRaf) delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame;
  if (installedCaf) delete (globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
});

const containers: HTMLElement[] = [];

afterEach(() => {
  for (const el of containers.splice(0)) el.remove();
});

/** Product of the `opacity` of an element and all its ancestors up to the svg. */
function effectiveOpacity(el: Element): number {
  let value = 1;
  let node: Element | null = el;
  while (node && node.namespaceURI === SVG_NS) {
    const raw = (node as SVGElement).style?.opacity || node.getAttribute('opacity');
    if (raw !== null && raw !== undefined && raw !== '') value *= Number(raw);
    if (node.tagName.toLowerCase() === 'svg') break;
    node = node.parentElement;
  }
  return value;
}

function createWriter(): { writer: HanziWriter; svg: SVGSVGElement } {
  const record = records[MING];
  if (!record) throw new Error('明 is missing from characters.json');
  const el = document.createElement('div');
  document.body.appendChild(el);
  containers.push(el);
  const writer = HanziWriter.create(el, MING, {
    width: 200,
    height: 200,
    padding: 12,
    showCharacter: false,
    showOutline: false,
    strokeAnimationSpeed: FAST_SPEED,
    charDataLoader: (_char, onLoad) => {
      const { strokes, medians, radStrokes } = record.strokeData;
      onLoad({ strokes, medians, radStrokes });
    },
  });
  const svg = el.querySelector('svg');
  if (!svg) throw new Error('hanzi-writer did not create an svg');
  return { writer, svg };
}

/**
 * The 3 layers hold one path per stroke each, in the order outline, main,
 * highlight. The main layer is the middle group of paths.
 */
function layers(svg: SVGSVGElement, strokeCount: number): { all: SVGPathElement[]; main: SVGPathElement[] } {
  const all = Array.from(svg.querySelectorAll('path')).filter(
    (p) => !p.closest('defs'), // skip the clipPath masks, which are not strokes
  ) as SVGPathElement[];
  expect(all).toHaveLength(strokeCount * 3);
  return { all, main: all.slice(strokeCount, strokeCount * 2) };
}

describe('real hanzi-writer: drawing single strokes of 明 without showCharacter', () => {
  const strokeCount = records[MING]?.strokeCount ?? 0;

  it('has stroke data for 明 in the committed dataset', () => {
    expect(strokeCount).toBe(8);
    expect(records[MING]?.strokeData.strokes).toHaveLength(8);
  });

  it('shows nothing at mount: every stroke path has effective opacity 0', async () => {
    const { writer, svg } = createWriter();
    await writer.getCharacterData();
    const { all } = layers(svg, strokeCount);
    expect(all.map(effectiveOpacity)).toEqual(all.map(() => 0));
  });

  it('leaves exactly strokes 0 and 1 visible after awaiting animateStroke(0) then animateStroke(1)', async () => {
    const { writer, svg } = createWriter();
    await writer.getCharacterData();
    await writer.animateStroke(0);
    await writer.animateStroke(1);
    const { all, main } = layers(svg, strokeCount);
    const visibleMain = main.map((p, i) => (effectiveOpacity(p) === 1 ? i : -1)).filter((i) => i >= 0);
    expect(visibleMain).toEqual([0, 1]);
    // Nothing outside the main layer is visible.
    const visibleOthers = all.filter((p) => !main.includes(p) && effectiveOpacity(p) > 0);
    expect(visibleOthers).toEqual([]);
  });

  it('cancels stroke 4 when animateStroke(5) is called without awaiting it (why the step queues strokes)', async () => {
    const { writer, svg } = createWriter();
    await writer.getCharacterData();
    // Overlapping calls: the second cancels the first, and a cancelled draw is
    // not completed. The Summon step therefore awaits each stroke in a queue.
    const first = writer.animateStroke(4);
    const second = writer.animateStroke(5);
    const [r4, r5] = await Promise.all([first, second]);
    expect(r4).toBeDefined();
    expect(r5).toBeDefined();
    if (!r4 || !r5) throw new Error('animateStroke resolved without a result');
    expect(r4.canceled).toBe(true);
    expect(r5.canceled).toBe(false);
    const { main } = layers(svg, strokeCount);
    expect(effectiveOpacity(main[4])).toBe(0);
    expect(effectiveOpacity(main[5])).toBe(1);
  });
});
