import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { CharacterRecord } from '../app/src/data/types';
import { learningOrder } from '../app/src/engine/learningOrder';
import {
  START,
  datasetMap,
  datasetRecord,
  expectNoVerticalScroll,
  seed,
  seedBefore,
  seedState,
  visibleInkPaths,
  type SeedState,
} from './helpers';

// Screenshots (Requirement 20): four views at the two Rite_Viewports, written to the
// gitignored `e2e/screenshots/`. Every key letter is read from characters.json at test
// time. Each view also checks by bounding boxes that no control or text lies inside the
// moon disc (design, "Night scene").

const SHOTS_DIR = fileURLToPath(new URL('./screenshots/', import.meta.url));
const DAY_MS = 24 * 60 * 60 * 1000;

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
] as const;



async function save(page: Page, view: string): Promise<void> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  const path = `${SHOTS_DIR}${view}-${size.width}x${size.height}.png`;
  await page.screenshot({ path });
  const bytes = statSync(path).size; // throws when the file is missing
  expect(bytes, `${path} is empty`).toBeGreaterThan(0);
}

/** Lines naming every control or text element whose box meets the moon disc. */
async function moonIntruders(page: Page): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    // The disc is the first `circle <r> at <x>% <y>%` gradient of the fixed body::before
    // (index.css); its position is read from the computed style, never hard-coded.
    const bg = getComputedStyle(document.body, '::before').backgroundImage;
    const m = bg.match(/radial-gradient\((?:circle )?([\d.]+)(rem|px)(?: circle)? at ([\d.]+)% ([\d.]+)%/);
    if (!m) return [`moon disc not found in body::before: ${bg.slice(0, 200)}`];
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const radius = Number.parseFloat(m[1]!) * (m[2] === 'rem' ? rem : 1);
    const cx = (Number.parseFloat(m[3]!) / 100) * window.innerWidth;
    const cy = (Number.parseFloat(m[4]!) / 100) * window.innerHeight;
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
  });
}

async function expectMoonClear(page: Page, view: string): Promise<void> {
  expect(await moonIntruders(page), `${view}: something lies inside the moon disc`).toEqual([]);
}

function code(record: CharacterRecord): string {
  if (record.cangjie === null) throw new Error(`${record.character} has no code`);
  return record.cangjie.toUpperCase();
}

function firstKeyStrokes(record: CharacterRecord): number {
  if (record.summonInk.class === 'opaque') throw new Error(`${record.character} is opaque`);
  return record.summonInk.keyStrokes[0]?.length ?? 0;
}

/** At-rest, restless and never-met ghosts: first 8 clean and far from due, next 4 missed, rest unmet. */
function graveyardSeed(now: number = Date.now()): SeedState {
  const order = learningOrder(datasetMap());
  const history: SeedState['history'] = {};
  order.slice(0, 8).forEach((char) => {
    history[char] = { step: 2, lastOutcome: 'clean', nextDue: now + 30 * DAY_MS };
  });
  order.slice(8, 12).forEach((char) => {
    history[char] = { step: 0, lastOutcome: 'struggled', nextDue: 0 };
  });
  return seedState({ history });
}

for (const vp of VIEWPORTS) {
  test.describe(`screenshots at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    test('intro', async ({ page }) => {
      await seed(page, seedState({ introSeen: false }));
      await page.goto(START);
      await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
      await expectMoonClear(page, 'intro');
      await save(page, 'intro');
    });

    test('summon after one key', async ({ page }) => {
      const record = datasetRecord('明');
      const expected = firstKeyStrokes(record);
      expect(expected, 'the first key of 明 must ink at least one stroke').toBeGreaterThan(0);
      await seed(page, seedBefore(record.character));
      await page.goto(START);
      await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
      const summon = page.getByRole('region', { name: 'Summon step' });
      await expect(summon).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(record.prompt.pinyin);
      await summon.getByRole('button', { name: new RegExp(`^Key ${code(record)[0]}(,|$)`) }).click();
      await expect.poll(() => visibleInkPaths(page), { timeout: 10_000 }).toBe(expected);
      await page.waitForTimeout(1500); // let the stroke finish drawing
      await expectMoonClear(page, 'summon');
      await save(page, 'summon');
    });

    test('write step', async ({ page }) => {
      const record = datasetRecord('明');
      await seed(page, seedBefore(record.character));
      await page.goto(START);
      await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
      const summon = page.getByRole('region', { name: 'Summon step' });
      await expect(summon).toBeVisible({ timeout: 10_000 });
      await summon.getByRole('button', { name: 'Give up' }).click();
      const write = page.getByRole('region', { name: 'Write mode' });
      await expect(write).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('ink-surface')).toBeVisible();
      await page.waitForTimeout(1000);
      await expectNoVerticalScroll(page);
      await expectMoonClear(page, 'write');
      await save(page, 'write');
    });

    test('graveyard with a seeded history', async ({ page }) => {
      await seed(page, graveyardSeed());
      await page.goto(START);
      await page.getByRole('button', { name: 'Graveyard' }).click();
      await expect(page.getByRole('heading', { name: 'Graveyard' })).toBeVisible();
      const graves = page.getByRole('list', { name: 'Graves' });
      await expect(graves.getByRole('listitem', { name: /at rest/ })).toHaveCount(8);
      await expect(graves.getByRole('listitem', { name: /restless/ })).toHaveCount(4);
      await expect(graves.getByRole('listitem', { name: /never met/ }).first()).toBeVisible();
      await expectMoonClear(page, 'graveyard');
      await save(page, 'graveyard');
    });
  });
}
