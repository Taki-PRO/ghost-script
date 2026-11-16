import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';

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
