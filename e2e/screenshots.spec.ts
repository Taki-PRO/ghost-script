import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { CharacterRecord } from '../app/src/data/types';
import { learningOrder } from '../app/src/engine/learningOrder';
import {
  START,
  datasetMap,
  datasetRecord,
  expectMoonInside,
  expectNoVerticalScroll,
  layToRestClean,
  seed,
  seedBefore,
  seedState,
  visibleInkPaths,
  type SeedState,
} from './helpers';

// Screenshots (Requirement 20): four views at the two Rite_Viewports, written to the
// gitignored `e2e/screenshots/`. Every key letter is read from characters.json at test
// time. Each view also checks that the moon disc is wholly inside the viewport and that
// no control or text lies inside it (Requirement 8.12, helpers `expectMoonInside`).

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

async function openSummon(page: Page, character: string): Promise<void> {
  await seed(page, seedBefore(character));
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  await expect(page.getByRole('region', { name: 'Summon step' })).toBeVisible({ timeout: 10_000 });
}

async function openGraveyard(page: Page): Promise<void> {
  await seed(page, graveyardSeed());
  await page.goto(START);
  await page.getByRole('button', { name: 'Graveyard' }).click();
  await expect(page.getByRole('heading', { name: 'Graveyard' })).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test.describe(`screenshots at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    test('intro', async ({ page }) => {
      await seed(page, seedState({ introSeen: false }));
      await page.goto(START);
      await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
      await expectMoonInside(page, 'intro');
      await save(page, 'intro');
    });

    test('summon after one key', async ({ page }) => {
      const record = datasetRecord('明');
      const expected = firstKeyStrokes(record);
      expect(expected, 'the first key of 明 must ink at least one stroke').toBeGreaterThan(0);
      await openSummon(page, record.character);
      const summon = page.getByRole('region', { name: 'Summon step' });
      await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(record.prompt.pinyin);
      await summon.getByRole('button', { name: new RegExp(`^Key ${code(record)[0]}(,|$)`) }).click();
      await expect.poll(() => visibleInkPaths(page), { timeout: 10_000 }).toBe(expected);
      await page.waitForTimeout(1500); // let the stroke finish drawing
      await expectMoonInside(page, 'summon');
      await save(page, 'summon');
    });

    test('write step', async ({ page }) => {
      const record = datasetRecord('明');
      await openSummon(page, record.character);
      await layToRestClean(page, record.character); // waits for the Seal_Stamp
      await page.waitForTimeout(1000); // let the stamp finish
      await expectNoVerticalScroll(page);
      await expectMoonInside(page, 'write');
      await save(page, 'write');
    });

    test('graveyard with a seeded history', async ({ page }) => {
      await openGraveyard(page);
      const graves = page.getByRole('list', { name: 'Graves' });
      await expect(graves.getByRole('listitem', { name: /at rest/ })).toHaveCount(8);
      await expect(graves.getByRole('listitem', { name: /restless/ })).toHaveCount(4);
      await expect(graves.getByRole('listitem', { name: /never met/ }).first()).toBeVisible();
      await expectMoonInside(page, 'graveyard');
      await save(page, 'graveyard');
    });
  });
}

// Moon check at 320 x 640 (Requirement 8.12): intro, Summon step and Graveyard. No PNG is written.
test.describe('moon at 320 x 640', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('intro', async ({ page }) => {
    await seed(page, seedState({ introSeen: false }));
    await page.goto(START);
    await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
    await expectMoonInside(page, 'intro 320');
  });

  test('summon', async ({ page }) => {
    await openSummon(page, '明');
    await expectMoonInside(page, 'summon 320');
  });

  test('graveyard', async ({ page }) => {
    await openGraveyard(page);
    await expectMoonInside(page, 'graveyard 320');
  });
});
