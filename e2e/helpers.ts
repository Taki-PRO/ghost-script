import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';
import type { CharacterRecord } from '../app/src/data/types';
import { learningOrder } from '../app/src/engine/learningOrder';

// Shared helpers of the E2E_Suite (Requirements 24.7 to 24.10 and 29).
//
// Pseudo-element mist layers (`body::after`, `#root::before`) are not elements,
// so `querySelectorAll` and `getBoundingClientRect` never see them, and fixed
// layers add nothing to the document scroll width. `findOverflow` therefore
// does not inspect pseudo-elements.

export const STORAGE_KEY = 'ghost-script:state';
export const START = '/ghost-script/';

export interface SeedState {
  readonly schemaVersion: 2;
  readonly introSeen: boolean;
  readonly cangjieIntroSeen: boolean;
  readonly history: Record<string, { step: number; lastOutcome: string; nextDue: number }>;
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
  const history: SeedState['history'] = {};
  for (const earlier of order.slice(0, index)) {
    history[earlier] = { step: 0, lastOutcome: 'clean', nextDue: now + 30 * DAY_MS };
  }
  return seedState({ history });
}

/** Pre-load localStorage before the app starts; never overwrites a key the app has written. */
export async function seed(page: Page, state: SeedState): Promise<void> {
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
  return { schemaVersion: 2, introSeen: true, cangjieIntroSeen: true, history: {}, ...overrides };
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
