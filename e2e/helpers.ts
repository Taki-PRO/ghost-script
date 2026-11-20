import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import type { CharacterRecord } from '../app/src/data/types';
import { learningOrder } from '../app/src/engine/learningOrder';
import { pickWalkthroughGhost } from '../app/src/engine/walkthrough';
import { type AudioLog, seedSchemaVersion } from './audioLog';
import { luminance } from './colour';

// Shared helpers of the E2E_Suite (Requirements 24.7 to 24.10 and 29).
//
// Pseudo-element mist layers (`body::after`, `#root::before`) are not elements,
// so `querySelectorAll` and `getBoundingClientRect` never see them, and fixed
// layers add nothing to the document scroll width. `findOverflow` therefore
// does not inspect pseudo-elements.

export { luminance, luminanceRatio, type Rgb } from './colour';

export const STORAGE_KEY = 'ghost-script:state';
export const START = '/ghost-script/';

type SeedHistory = Record<string, { step: number; lastOutcome: string; nextDue: number }>;
export interface SeedState {
  readonly schemaVersion: 3 | 4;
  readonly introSeen: boolean;
  readonly cangjieIntroSeen: boolean;
  readonly history: SeedHistory;
  readonly level: 1 | 2 | 3;
  readonly levelChosen: boolean;
  /** Schema 4 only; `seedState` writes both when the version is 4. */
  readonly soundOn?: boolean;
  readonly ambienceOn?: boolean;
}
/** A save written before levels existed (version 2); the app migrates it to version 3. */
export interface SeedStateV2 {
  readonly schemaVersion: 2;
  readonly introSeen: boolean;
  readonly cangjieIntroSeen: boolean;
  readonly history: SeedHistory;
}

/** Characters of the dataset, read at test time (the file is generated, never edited). */
export function datasetKeys(): string[] {
  const path = fileURLToPath(new URL('../app/public/data/characters.json', import.meta.url));
  return Object.keys(JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>);
}

/** The generated dataset, read at test time (the file is generated, never edited). */
export function datasetMap(): Map<string, CharacterRecord> {
  const path = fileURLToPath(new URL('../app/public/data/characters.json', import.meta.url));
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, CharacterRecord>;
  return new Map(Object.entries(raw));
}

function levelPath(level: 1 | 2 | 3): string {
  const file = level === 1 ? 'characters.json' : `characters-level${level}.json`;
  return fileURLToPath(new URL(`../app/public/data/${file}`, import.meta.url));
}
/** The generated dataset of one level, read at test time. */
export function levelDatasetMap(level: 1 | 2 | 3): Map<string, CharacterRecord> {
  const raw = JSON.parse(readFileSync(levelPath(level), 'utf8')) as Record<string, CharacterRecord>;
  return new Map(Object.entries(raw));
}
/** The Learning_Order of one level, from the app's own `learningOrder`. */
export function levelOrder(level: 1 | 2 | 3): string[] {
  return learningOrder(levelDatasetMap(level));
}
/** One record of the dataset; throws when the character is missing. */
export function datasetRecord(char: string): CharacterRecord {
  const record = datasetMap().get(char);
  if (!record) throw new Error(`"${char}" is not in the dataset`);
  return record;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A seed state in which every character before `char` in the learning order is
 * reviewed `clean` and not due for 30 days, so the scheduler's new-character
 * band starts at `char`. No App hook is involved.
 */
export function seedBefore(char: string, now: number = Date.now()): SeedState {
  const order = learningOrder(datasetMap());
  const index = order.indexOf(char);
  if (index < 0) throw new Error(`"${char}" is not in the learning order`);
  const history: SeedHistory = {};
  for (const earlier of order.slice(0, index)) {
    history[earlier] = { step: 0, lastOutcome: 'clean', nextDue: now + 30 * DAY_MS };
  }
  return seedState({ history });
}

/** Pre-load localStorage before the app starts; never overwrites a key the app has written. */
export async function seed(page: Page, state: SeedState | SeedStateV2): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    { key: STORAGE_KEY, value: JSON.stringify(state) },
  );
}

export function seedState(overrides: Partial<SeedState> = {}): SeedState {
  const introSeen = overrides.introSeen ?? true;
  const version = seedSchemaVersion(overrides.schemaVersion, overrides);
  const { soundOn, ambienceOn, ...rest } = overrides;
  const base = {
    introSeen,
    cangjieIntroSeen: true,
    history: {},
    level: 1 as const,
    levelChosen: introSeen,
    ...rest,
  };
  // Without a sound field the seed stays at schema 3 (the app migrates it); otherwise schema 4 with both flags.
  if (version === 3) return { ...base, schemaVersion: 3 };
  return { ...base, schemaVersion: 4, soundOn: soundOn ?? true, ambienceOn: ambienceOn ?? false };
}
/** A schema 4 seed with the two sound flags (defaults: sound on, wind off). */
export function seedSound(
  flags: { soundOn?: boolean; ambienceOn?: boolean } = {},
  overrides: Partial<SeedState> = {},
): SeedState {
  return seedState({ ...overrides, schemaVersion: 4, soundOn: flags.soundOn ?? true, ambienceOn: flags.ambienceOn ?? false });
}
/** A version 2 save for the migration test: opens on the menu at level 1 when `introSeen` is true. */
export function seedV2(overrides: Partial<SeedStateV2> = {}): SeedStateV2 {
  return { schemaVersion: 2, introSeen: true, cangjieIntroSeen: true, history: {}, ...overrides };
}

/**
 * The record of the Walkthrough_Ghost, read from the rule's own output on the
 * generated dataset. Throws when the rule finds no character.
 */
export function walkthroughRecord(): CharacterRecord {
  const dataset = datasetMap();
  const char = pickWalkthroughGhost(learningOrder(dataset), dataset);
  if (char === null) throw new Error('pickWalkthroughGhost found no character');
  const record = dataset.get(char);
  if (!record) throw new Error(`"${char}" is not in the dataset`);
  return record;
}

/** A seed state whose history holds every listed character, due now (`nextDue` 0). */
export function seedWithHistory(chars: readonly string[], outcome: string): SeedState {
  const history: SeedHistory = {};
  for (const char of chars) {
    history[char] = { step: 0, lastOutcome: outcome, nextDue: 0 };
  }
  return seedState({ history });
}

/** Accessible name of a faint Code_Slot on a first meeting: "Slot {n}, type {letter}". */
export function slotName(index: number, letter: string): string {
  return `Slot ${index}, type ${letter}`;
}

/**
 * Height in CSS px of all Summon content other than the paper (proof-pass
 * design, "Measurement method"): the session height (`main > div > div`) plus
 * the Shell's vertical padding, minus the `ink-surface` height and minus the
 * line block (the walkthrough line and its 4 px flex gap, when shown).
 */
export async function summonOtherHeight(page: Page): Promise<number> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const session = document.querySelector('main > div > div');
    const ink = document.querySelector('[data-testid="ink-surface"]');
    if (!session || !ink) throw new Error('no session or ink-surface on the screen');
    const main = document.querySelector('main') as HTMLElement;
    const cs = getComputedStyle(main);
    const padding = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
    const line = document.querySelector('[data-testid="walkthrough-line"]');
    const lineBlock = line ? line.getBoundingClientRect().height + 4 : 0;
    return session.getBoundingClientRect().height + padding - ink.getBoundingClientRect().height - lineBlock;
  });
}

/** Lines describing every overflow found on the current screen; empty when it fits. */
export async function findOverflow(page: Page, width: number): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((width) => {
    const out: string[] = [];

    const describe = (el: Element): string => {
      const label = el.getAttribute('aria-label');
      const classes = Array.from(el.classList).slice(0, 3);
      let s = el.tagName.toLowerCase();
      if (el.id) s += `#${el.id}`;
      if (classes.length > 0) s += `.${classes.join('.')}`;
      if (label) s += `[aria-label="${label}"]`;
      const anchor = el.parentElement?.closest('[id], [aria-label]');
      if (anchor) {
        const anchorLabel = anchor.getAttribute('aria-label');
        s += ` in ${anchor.tagName.toLowerCase()}${anchor.id ? `#${anchor.id}` : ''}${
          anchorLabel ? `[aria-label="${anchorLabel}"]` : ''
        }`;
      }
      return s;
    };

    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth > width) out.push(`document scrollWidth ${scrollWidth} > ${width}`);

    const all = [document.body, ...Array.from(document.body.querySelectorAll('*'))];
    for (const el of all) {
      if (getComputedStyle(el).display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.right > width + 0.5 || r.left < -0.5) {
        out.push(`${describe(el)}: left ${Math.round(r.left)}, right ${Math.round(r.right)}`);
      }
    }
    return out;
  }, width);
}

export interface BoxInside {
  readonly box: { top: number; bottom: number; left: number; right: number };
  readonly viewport: { width: number; height: number };
}

/** Bounding box of the located element and the viewport (`innerWidth`, `innerHeight`). */
export async function boxInside(page: Page, locator: Locator): Promise<BoxInside> {
  const box = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });
  const viewport = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  return { box, viewport };
}

/** Fails unless the located element is visible and inside the viewport. */
export async function expectInside(page: Page, name: string, locator: Locator): Promise<void> {
  await expect(locator, `${name} is not visible`).toBeVisible();
  const { box, viewport } = await boxInside(page, locator);
  const detail = `${name}: box ${JSON.stringify(box)}, innerWidth ${viewport.width}, innerHeight ${viewport.height}`;
  expect(box.top, detail).toBeGreaterThanOrEqual(0);
  expect(box.bottom, detail).toBeLessThanOrEqual(viewport.height);
  expect(box.left, detail).toBeGreaterThanOrEqual(0);
  expect(box.right, detail).toBeLessThanOrEqual(viewport.width);
}

export async function expectNoVerticalScroll(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const m = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(m.scrollHeight, `scrollHeight ${m.scrollHeight}, innerHeight ${m.innerHeight}`).toBeLessThanOrEqual(
    m.innerHeight,
  );
}

/**
 * Number of stroke paths under `[data-testid="ink-container"]` that are drawn:
 * a `clip-path` attribute, no `display: none` on the path or an ancestor, and
 * an effective opacity (own times ancestors') above 0.
 */
export async function visibleInkPaths(page: Page): Promise<number> {
  return page.evaluate(() => {
    let count = 0;
    const paths = document.querySelectorAll('[data-testid="ink-container"] path[clip-path]');
    for (const path of Array.from(paths)) {
      let opacity = 1;
      let hidden = false;
      for (let el: Element | null = path; el; el = el.parentElement) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none') hidden = true;
        opacity *= Number.parseFloat(cs.opacity);
        if (el.getAttribute('data-testid') === 'ink-container') break;
      }
      if (!hidden && opacity > 0) count += 1;
    }
    return count;
  });
}

// ---------------------------------------------------------------------------
// Moon (follow-up 1, Requirement 8.12): geometry read from the computed custom
// properties of `:root`, the one source shared with the CSS.
// ---------------------------------------------------------------------------

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface MoonDisc extends Box {
  /** Centre and radius in CSS pixels. */
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly viewport: { readonly width: number; readonly height: number };
}

/**
 * The Moon's disc box in viewport pixels. Reads `--moon-size`, `--moon-inset-x`
 * and `--moon-inset-y` (rem or px) from the root, resolves rem against the root
 * font size, and measures the viewport without scrollbars. The centre lies
 * `--moon-inset-x` from the right edge and `--moon-inset-y` from the top.
 */
export async function moonDisc(page: Page): Promise<MoonDisc> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const root = document.documentElement;
    const rem = Number.parseFloat(getComputedStyle(root).fontSize);
    const read = (name: string): number => {
      const raw = getComputedStyle(root).getPropertyValue(name).trim();
      const m = raw.match(/^(-?[\d.]+)(rem|px)$/);
      if (!m) throw new Error(`${name} is "${raw}"; expected a rem or px length`);
      return Number.parseFloat(m[1]!) * (m[2] === 'rem' ? rem : 1);
    };
    const size = read('--moon-size');
    const width = root.clientWidth;
    const height = root.clientHeight;
    const radius = size / 2;
    const cx = width - read('--moon-inset-x');
    const cy = read('--moon-inset-y');
    return {
      cx,
      cy,
      radius,
      left: cx - radius,
      top: cy - radius,
      right: cx + radius,
      bottom: cy + radius,
      viewport: { width, height },
    };
  });
}

/** Lines naming every control or text element whose box meets the moon disc. */
export async function moonIntruders(page: Page): Promise<string[]> {
  const disc = await moonDisc(page);
  return page.evaluate(({ cx, cy, radius }) => {
    const out: string[] = [];
    const hasOwnText = (el: Element): boolean =>
      Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
    const isControl = (el: Element): boolean =>
      el.matches('button, a, input, select, textarea, [role="button"], [data-testid="ink-surface"]');
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (!isControl(el) && !hasOwnText(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const nx = Math.max(r.left, Math.min(cx, r.right));
      const ny = Math.max(r.top, Math.min(cy, r.bottom));
      if ((nx - cx) ** 2 + (ny - cy) ** 2 < radius ** 2) {
        const text = (el.textContent ?? '').trim().slice(0, 30);
        out.push(
          `${el.tagName.toLowerCase()} "${text}" box ${Math.round(r.left)},${Math.round(r.top)} to ` +
            `${Math.round(r.right)},${Math.round(r.bottom)}; moon ${Math.round(cx)},${Math.round(cy)} r ${Math.round(radius)}`,
        );
      }
    }
    return out;
  }, disc);
}

/** Fails if the disc is cut off by a viewport edge, or if any control or text meets it. */
export async function expectMoonInside(page: Page, view = 'page'): Promise<void> {
  const d = await moonDisc(page);
  const detail = `${view}: moon box ${Math.round(d.left)},${Math.round(d.top)} to ${Math.round(d.right)},${Math.round(d.bottom)}, viewport ${d.viewport.width} x ${d.viewport.height}`;
  expect(d.left, `${detail}: cut off on the left`).toBeGreaterThanOrEqual(0);
  expect(d.top, `${detail}: cut off at the top`).toBeGreaterThanOrEqual(0);
  expect(d.right, `${detail}: cut off on the right`).toBeLessThanOrEqual(d.viewport.width);
  expect(d.bottom, `${detail}: cut off at the bottom`).toBeLessThanOrEqual(d.viewport.height);
  expect(await moonIntruders(page), `${view}: something lies inside the moon disc`).toEqual([]);
}

// ---------------------------------------------------------------------------
// Seal and strokes (follow-up 5, Requirements 13.13 and 13.14).
// ---------------------------------------------------------------------------

const SEAL = '[data-testid="seal-stamp"]';
const WRITER_SVG = '[data-testid="ink-container"] svg';

/** Bounding box of the Seal_Stamp in viewport pixels; throws when there is no seal. */
export async function sealBox(page: Page): Promise<Box> {
  return page.locator(SEAL).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
}

/** Bounding box of the paper (`[data-testid="ink-surface"]`) in viewport pixels. */
export async function paperBox(page: Page): Promise<Box> {
  return page.getByTestId('ink-surface').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
}

/** Bounding box of every `path` in the writer SVG (empty boxes skipped). */
export async function strokeBoxes(page: Page): Promise<Box[]> {
  return page.evaluate((selector) => {
    const out: { left: number; top: number; right: number; bottom: number }[] = [];
    for (const path of Array.from(document.querySelectorAll(`${selector} path`))) {
      const r = path.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    return out;
  }, WRITER_SVG);
}

/** Gap in px between two boxes; negative when they overlap. */
export function boxGap(a: Box, b: Box): number {
  const dx = Math.max(a.left - b.right, b.left - a.right);
  const dy = Math.max(a.top - b.bottom, b.top - a.bottom);
  return Math.max(dx, dy);
}

/**
 * From the Summon step of the ghost `character`: types its Cangjie code (read
 * from characters.json), waits for the Write step, then draws every stroke
 * along the dataset medians (the data the app hands to hanzi-writer), mapped
 * to the screen with `getScreenCTM()` of the writer's positioned group, so the
 * mapping is the library's own. Waits for the Seal_Stamp, which only a clean
 * outcome produces. Uses real mouse input; no App hook is involved.
 */
export async function layToRestClean(
  page: Page,
  character: string,
  options: { readonly expectSeal?: boolean; readonly wrongKeyFirst?: boolean } = {},
): Promise<void> {
  const record = datasetRecord(character);
  if (record.cangjie === null) throw new Error(`${character} has no Cangjie code`);
  const summon = page.getByRole('region', { name: 'Summon step' });
  await expect(summon).toBeVisible({ timeout: 10_000 });
  if (options.wrongKeyFirst === true) {
    // Three keys that are not the next letter: more mistakes than the clean threshold (2), so the outcome is struggled.
    const wrong = record.cangjie[0]?.toUpperCase() === 'A' ? 'B' : 'A';
    for (let i = 0; i < 3; i++) {
      await summon.getByRole('button', { name: new RegExp(`^Key ${wrong}(,|$)`) }).click();
    }
  }
  for (const letter of record.cangjie.toUpperCase()) {
    await summon.getByRole('button', { name: new RegExp(`^Key ${letter}(,|$)`) }).click();
  }
  await expect(page.getByRole('region', { name: 'Write mode' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('ink-surface')).toBeVisible();
  await page.waitForTimeout(500); // let the writer mount and settle

  const group = page.locator(`${WRITER_SVG} > g`).first();
  await expect(group).toBeAttached();
  for (const median of record.strokeData.medians) {
    const points = await group.evaluate((g, pts) => {
      const ctm = (g as SVGGraphicsElement).getScreenCTM();
      if (!ctm) throw new Error('the positioned group has no screen matrix');
      return pts.map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(ctm);
        return { x: p.x, y: p.y };
      });
    }, median);
    const [first, ...rest] = points;
    if (!first) throw new Error(`${character} has an empty median`);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const p of rest) await page.mouse.move(p.x, p.y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  if (options.expectSeal !== false) {
    await expect(page.getByRole('img', { name: `Seal: ${character}` })).toBeVisible({ timeout: 15_000 });
  }
}

// ---------------------------------------------------------------------------
// Ink wait and full-page pixels (Requirements 20.9, 24.7, 25.3, 25.9).
// ---------------------------------------------------------------------------

/**
 * Waits until every animation of `blockquote.ink-reveal` has finished, then
 * fails unless all play states are `finished`. Resolves at once when the
 * blockquote has no animation (reduced motion). Fails when there is no blockquote.
 */
export async function waitForInkReveal(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const q = document.querySelector('blockquote.ink-reveal');
    if (!q) throw new Error('blockquote.ink-reveal not found');
    await Promise.all(q.getAnimations().map((a) => a.finished));
  });
  const states = await page.evaluate(() =>
    Array.from(document.querySelector('blockquote.ink-reveal')?.getAnimations() ?? []).map((a) => a.playState),
  );
  expect(states.every((s) => s === 'finished'), `animation states: ${states.join(', ')}`).toBe(true);
}

/**
 * Waits until the intro's legend figure reports `data-legend-state="inked"`, up to 15 s (the ink
 * takes about 5.5 s, the safety timer 6 s). Resolves at once in reduced motion, where the figure
 * is inked at first render. Fails when there is no legend figure or the state is never reached.
 */
export async function waitForLegendReveal(page: Page): Promise<void> {
  await expect(page.locator('figure[data-legend-state]')).toHaveAttribute('data-legend-state', 'inked', {
    timeout: 15_000,
  });
}

/**
 * Colour of a PNG at each point (image pixels, origin top left). Decodes the
 * buffer in a second page with `createImageBitmap` and a canvas; no dependency.
 */
export async function pixelsAt(
  page: Page,
  png: Buffer,
  points: readonly { readonly x: number; readonly y: number }[],
): Promise<Array<[number, number, number]>> {
  const decoder = await page.context().newPage();
  try {
    return await decoder.evaluate(
      async ({ base64, points }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(bitmap, 0, 0);
        return points.map(({ x, y }): [number, number, number] => {
          if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) {
            throw new Error(`point ${x},${y} is outside the ${bitmap.width} x ${bitmap.height} image`);
          }
          const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          return [d[0]!, d[1]!, d[2]!];
        });
      },
      { base64: png.toString('base64'), points: points.map((p) => ({ x: p.x, y: p.y })) },
    );
  } finally {
    await decoder.close();
  }
}

/**
 * Colour of every pixel inside each box of a PNG (image pixels, origin top left;
 * each box is rounded outwards and clipped to the image). Returns one row-major
 * list per box with the pixel coordinates. Decodes the buffer once.
 */
export async function regionPixels(
  page: Page,
  png: Buffer,
  boxes: readonly { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }[],
): Promise<Array<{ x: number; y: number; rgb: [number, number, number] }[]>> {
  const decoder = await page.context().newPage();
  try {
    return await decoder.evaluate(
      async ({ base64, boxes }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(bitmap, 0, 0);
        return boxes.map((b) => {
          const x0 = Math.max(0, Math.floor(b.left));
          const y0 = Math.max(0, Math.floor(b.top));
          const x1 = Math.min(bitmap.width, Math.ceil(b.right));
          const y1 = Math.min(bitmap.height, Math.ceil(b.bottom));
          const out: { x: number; y: number; rgb: [number, number, number] }[] = [];
          if (x1 <= x0 || y1 <= y0) return out;
          const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = ((y - y0) * (x1 - x0) + (x - x0)) * 4;
              out.push({ x, y, rgb: [d[i]!, d[i + 1]!, d[i + 2]!] });
            }
          }
          return out;
        });
      },
      { base64: png.toString('base64'), boxes: boxes.map((b) => ({ ...b })) },
    );
  } finally {
    await decoder.close();
  }
}
/**
 * Seeds one at-rest, one restless and one gave-up character (the first three of
 * the learning order), opens the Graveyard and waits for the fonts. No App hook.
 */
export async function seedGraveyard(
  page: Page,
  options: { readonly farMetIndex?: number } = {},
): Promise<{ at: string; restless: string; gaveUp: string; total: number }> {
  const farFuture = 32_503_680_000_000;
  const keys = learningOrder(datasetMap());
  const [a, b, c] = keys;
  expect(c, 'characters.json has fewer than three characters').toBeDefined();
  const history: SeedHistory = {
    [a as string]: { step: 3, lastOutcome: 'clean', nextDue: farFuture },
    [b as string]: { step: 0, lastOutcome: 'struggled', nextDue: 0 },
    [c as string]: { step: 0, lastOutcome: 'gave-up', nextDue: 0 },
  };
  // The Graveyard shows only the rows through the last Met_Ghost's row plus one. A restless ghost
  // far down the learning order makes the shown list long enough for the tests that scroll.
  if (options.farMetIndex !== undefined) {
    const far = keys[options.farMetIndex];
    expect(far, `the learning order has no index ${options.farMetIndex}`).toBeDefined();
    history[far as string] = { step: 0, lastOutcome: 'struggled', nextDue: 0 };
  }
  await seed(page, seedState({ history }));
  await page.goto(START);
  await page.getByRole('button', { name: 'Graveyard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Graveyard' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { at: a as string, restless: b as string, gaveUp: c as string, total: keys.length };
}

// ---------------------------------------------------------------------------
// Sky_Cap (spec night-polish, Requirement 1): the band above the sticky header.
// ---------------------------------------------------------------------------

/**
 * Screenshot of the top band of the viewport (`x 0, y 0, width, height`) and the
 * colour of each point in it (band pixels, origin top left of the band). Uses the
 * live viewport, so it shows what the player sees at the current scroll offset.
 */
export async function bandPixels(
  page: Page,
  width: number,
  height: number,
  points: readonly { readonly x: number; readonly y: number }[],
): Promise<{ png: Buffer; colours: Array<[number, number, number]> }> {
  const png = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
  const colours = await pixelsAt(page, png, points);
  return { png, colours };
}

/**
 * Left and right edge of the Moon disc along one row of a band screenshot: the
 * first and last x, within `halfSpan` of `cx`, whose luminance is above
 * `threshold`. Returns null when no pixel of the row passes. The sky and the
 * halo are well below the threshold, the disc is above it.
 */
export async function discExtent(
  page: Page,
  png: Buffer,
  y: number,
  cx: number,
  halfSpan: number,
  threshold: number,
): Promise<{ left: number; right: number; diameter: number } | null> {
  const imageWidth = png.readUInt32BE(16); // IHDR width of the PNG
  const xs: number[] = [];
  const from = Math.max(0, Math.round(cx - halfSpan));
  const to = Math.min(imageWidth - 1, Math.round(cx + halfSpan));
  for (let x = from; x <= to; x += 1) xs.push(x);
  const colours = await pixelsAt(
    page,
    png,
    xs.map((x) => ({ x, y })),
  );
  let left: number | null = null;
  let right: number | null = null;
  colours.forEach((rgb, i) => {
    if (luminance(rgb) > threshold) {
      if (left === null) left = xs[i]!;
      right = xs[i]!;
    }
  });
  if (left === null || right === null) return null;
  return { left, right, diameter: right - left + 1 };
}

/**
 * Plays a Nightly Séance from the start menu to the Summary screen by giving up
 * every ghost (the route of the summary test in `first-meeting.spec.ts`). Seeds a
 * fresh save first. Callers set a generous test timeout and `reducedMotion`.
 */
export async function reachSummary(page: Page): Promise<void> {
  await seed(page, seedState());
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  const summary = page.getByRole('heading', { name: 'The séance is over' });
  const next = page.getByRole('button', { name: /^(Next ghost|Finish the séance)$/ });
  const summonGiveUp = page.getByRole('region', { name: 'Summon step' }).getByRole('button', { name: 'Give up' });
  const writeGiveUp = page.getByRole('region', { name: 'Write mode' }).getByRole('button', { name: 'Give up' });
  const deadline = Date.now() + 200_000;
  while (!(await summary.isVisible())) {
    if (Date.now() > deadline) throw new Error('the Séance did not reach the summary');
    if (await next.isVisible()) await next.click();
    else if (await summonGiveUp.isVisible()) await summonGiveUp.click();
    else if ((await writeGiveUp.isVisible()) && (await writeGiveUp.isEnabled())) await writeGiveUp.click();
    else await page.waitForTimeout(100);
  }
  await page.evaluate(() => document.fonts.ready);
}

/** The kinds of ending `reachFullSummary` plays, by ghost position; later ghosts give up. */
const FULL_SUMMARY_PLAN = ['clean', 'struggled', 'gave-up', 'clean', 'struggled'] as const;

/**
 * Plays a full Nightly Séance of ten ghosts to the Summary screen with a mix of outcomes:
 * clean, struggled and gave-up (see FULL_SUMMARY_PLAN; the rest give up). Seeds a fresh save,
 * so every ghost is a first meeting and its faint code identifies it in the dataset.
 * Callers set a generous test timeout and `reducedMotion`.
 */
export async function reachFullSummary(page: Page): Promise<void> {
  await seed(page, seedState());
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  const dataset = datasetMap();
  const summary = page.getByRole('heading', { name: 'The séance is over' });
  const next = page.getByRole('button', { name: /^(Next ghost|Finish the séance)$/ });
  const summon = page.getByRole('region', { name: 'Summon step' });
  const writeGiveUp = page.getByRole('region', { name: 'Write mode' }).getByRole('button', { name: 'Give up' });
  const deadline = Date.now() + 400_000;
  const heading = page.getByRole('heading', { name: /^Ghost \d+ of \d+$/ });
  let handled = 0;
  while (!(await summary.isVisible())) {
    if (Date.now() > deadline) throw new Error('the Séance did not reach the summary');
    if (await next.isVisible()) {
      await next.click();
    } else if (await summon.isVisible()) {
      // The Summon step stays on screen for a moment after "Give up"; act once per ghost number.
      const number = Number.parseInt(((await heading.textContent()) ?? '').replace(/\D+(\d+).*/, '$1'), 10);
      if (number <= handled) {
        await page.waitForTimeout(100);
        continue;
      }
      handled = number;
      const kind = FULL_SUMMARY_PLAN[number - 1] ?? 'gave-up';
      if (kind === 'gave-up') {
        await summon.getByRole('button', { name: 'Give up' }).click();
        continue;
      }
      const clue = (await page.getByRole('region', { name: "Ghost's clue" }).textContent()) ?? '';
      const slots = await summon.getByRole('listitem', { name: /^Slot \d+, type [A-Y]$/ }).evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label') ?? ''),
      );
      const code = slots.map((label) => label.slice(-1)).join('');
      const record = Array.from(dataset.values()).find(
        (r) => (r.cangjie ?? '').toUpperCase() === code && clue.includes(r.prompt.pinyin),
      );
      if (!record) throw new Error(`no dataset record for code "${code}" and clue "${clue}"`);
      await layToRestClean(page, record.character, {
        expectSeal: kind === 'clean',
        wrongKeyFirst: kind === 'struggled',
      });
    } else if ((await writeGiveUp.isVisible()) && (await writeGiveUp.isEnabled())) {
      await writeGiveUp.click();
    } else {
      await page.waitForTimeout(100);
    }
  }
  await page.evaluate(() => document.fonts.ready);
}
/**
 * The Start menu worst case (proof-pass Requirements 9.3, 9.4): every ghost of all three levels
 * (1,200 in total) is in the history as `struggled`, so level 1 is a Finished_Level (the notice
 * and the "Move on to level 2" slip show) and the review slip counts 1200, a 4-digit number.
 */
export function seedStartMenuWorstCase(): SeedState {
  const history: SeedHistory = {};
  for (const level of [1, 2, 3] as const) {
    for (const char of levelDatasetMap(level).keys()) {
      history[char] = { step: 0, lastOutcome: 'struggled', nextDue: 0 };
    }
  }
  return seedState({ history });
}
/** Opens the worst-case Start menu and checks that its notice, both slips and the 4-digit count are shown. */
export async function openStartMenuWorstCase(page: Page): Promise<void> {
  await seed(page, seedStartMenuWorstCase());
  await page.goto(START);
  await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
  await expect(page.getByText('You have met every ghost of level 1.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move on to level 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Review restless ghosts \(\d{4}\)$/ })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

// ---------------------------------------------------------------------------
// Night sounds (spec night-sounds, task 10.3): the Audio_Recorder, media
// recording and the toggle placement box.
// ---------------------------------------------------------------------------

export { beforeGesture, loopingStarts, type AudioLog } from './audioLog';

/**
 * Installs the Audio_Recorder before any page script runs and exposes the log as
 * `window.__audio` (read it with `readAudioLog`). It wraps `AudioContext` and
 * `webkitAudioContext` (construction, `resume`, `suspend`), the `createOscillator` and
 * `createBufferSource` calls, and `AudioScheduledSourceNode.prototype.start`. Each event
 * carries `t`, the ms since the first pointerdown, touchend, click or keydown, or null
 * before it. Every wrapper records a failure and rethrows or passes the rejection on, so
 * the app sees exactly what it would see without the recorder. Chromium's autoplay policy
 * is kept, so contexts start suspended until a real click or key press.
 */
export async function installAudioRecorder(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = {
      firstGestureAt: null as number | null,
      constructed: 0,
      constructions: [] as { t: number | null }[],
      resumes: 0,
      resumeCalls: [] as { t: number | null }[],
      suspends: 0,
      loopStops: 0,
      starts: [] as { t: number | null; kind: string; loop: boolean }[],
      failures: [] as { t: number | null; what: string; message: string }[],
    };
    (window as unknown as { __audio: typeof log }).__audio = log;
    const now = (): number | null => (log.firstGestureAt === null ? null : performance.now() - log.firstGestureAt);
    const fail = (what: string, error: unknown): void => {
      log.failures.push({ t: now(), what, message: error instanceof Error ? error.message : String(error) });
    };
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
      window.addEventListener(
        type,
        () => {
          if (log.firstGestureAt === null) log.firstGestureAt = performance.now();
        },
        { capture: true, passive: true },
      );
    }

    type Ctor = new (options?: AudioContextOptions) => AudioContext;
    const wrap = (Orig: Ctor): Ctor =>
      class extends Orig {
        constructor(options?: AudioContextOptions) {
          try {
            super(options);
          } catch (error) {
            fail('construct', error);
            throw error;
          }
          log.constructed += 1;
          log.constructions.push({ t: now() });
        }
        override resume(): Promise<void> {
          log.resumes += 1;
          log.resumeCalls.push({ t: now() });
          const result = super.resume();
          result.catch((error: unknown) => fail('resume', error));
          return result;
        }
        override suspend(): Promise<void> {
          log.suspends += 1;
          return super.suspend();
        }
        override createOscillator(): OscillatorNode {
          try {
            return super.createOscillator();
          } catch (error) {
            fail('createOscillator', error);
            throw error;
          }
        }
        override createBufferSource(): AudioBufferSourceNode {
          try {
            return super.createBufferSource();
          } catch (error) {
            fail('createBufferSource', error);
            throw error;
          }
        }
      };
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
    if (w.AudioContext) w.AudioContext = wrap(w.AudioContext);
    if (w.webkitAudioContext) w.webkitAudioContext = wrap(w.webkitAudioContext);

    // Chromium defines its own `start` and `stop` on AudioBufferSourceNode.prototype, so that prototype is
    // wrapped too. Where it only inherits them (no own property) the base wrapper already sees it.
    const protos: { start: unknown; stop: unknown }[] = [];
    if (typeof AudioScheduledSourceNode !== 'undefined') protos.push(AudioScheduledSourceNode.prototype);
    if (
      typeof AudioBufferSourceNode !== 'undefined' &&
      Object.prototype.hasOwnProperty.call(AudioBufferSourceNode.prototype, 'start')
    ) {
      protos.push(AudioBufferSourceNode.prototype);
    }
    for (const proto of protos) {
      const start = proto.start as (this: AudioScheduledSourceNode, when?: number) => void;
      proto.start = function (this: AudioScheduledSourceNode, when?: number): void {
        log.starts.push({
          t: now(),
          kind: this.constructor.name,
          loop: (this as unknown as { loop?: boolean }).loop === true,
        });
        try {
          start.call(this, when);
        } catch (error) {
          fail('start', error);
          throw error;
        }
      };
      const stop = proto.stop as (this: AudioScheduledSourceNode, when?: number) => void;
      proto.stop = function (this: AudioScheduledSourceNode, when?: number): void {
        if ((this as unknown as { loop?: boolean }).loop === true) log.loopStops += 1;
        stop.call(this, when);
      };
    }
  });
}

/** Number of `stop()` calls on looping sources (the night wind) since the page loaded. */
export async function loopStopCount(page: Page): Promise<number> {
  const log = await readAudioLog(page);
  return (log as AudioLog & { loopStops?: number }).loopStops ?? 0;
}

/** The Audio_Recorder log of the current page; throws when `installAudioRecorder` was not called first. */
export async function readAudioLog(page: Page): Promise<AudioLog> {
  const log = await page.evaluate(() => (window as unknown as { __audio?: unknown }).__audio ?? null);
  if (log === null) throw new Error('window.__audio is missing: call installAudioRecorder(page) before page.goto');
  return log as AudioLog;
}

/** Collects the URL of every `media` request and every `audio/*` response (Requirement 18.3). */
export function recordMedia(page: Page): { readonly requests: string[]; readonly responses: string[] } {
  const requests: string[] = [];
  const responses: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'media') requests.push(request.url());
  });
  page.on('response', (response) => {
    const type = response.headers()['content-type'] ?? '';
    if (type.toLowerCase().startsWith('audio/')) responses.push(response.url());
  });
  return { requests, responses };
}

/** The Sound_Toggle (`data-testid="sound-toggle"`). */
export function soundToggle(page: Page): Locator {
  return page.getByTestId('sound-toggle');
}

export interface TogglePlacement {
  readonly toggle: Box;
  readonly moon: MoonDisc;
  /** Gap in px between the toggle box and the Moon disc box; negative when they overlap. */
  readonly gapToMoon: number;
}

/** Bounding box of the Sound_Toggle and the Moon disc box (`moonDisc`), for placement checks. */
export async function togglePlacement(page: Page): Promise<TogglePlacement> {
  const moon = await moonDisc(page);
  const toggle = await soundToggle(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  return { toggle, moon, gapToMoon: boxGap(toggle, moon) };
}
