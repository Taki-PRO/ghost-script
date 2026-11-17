import { expect, test, type Page } from '@playwright/test';
import {
  STORAGE_KEY,
  START,
  expectNoVerticalScroll,
  findOverflow,
  levelDatasetMap,
  levelOrder,
  seed,
  seedState,
  seedV2,
  slotName,
  walkthroughRecord,
} from './helpers';

// Harder ghosts: the Level_Screen, the level slip on the menu, the Graveyard level
// switcher and the version 2 migration (spec harder-ghosts, Requirements 6, 7, 9,
// 10, 11.4 and 12). Every character, count and order is read from the generated
// datasets at test time.

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
  { width: 320, height: 640 },
] as const;

const FAR_FUTURE = 32_503_680_000_000;
const CHINESE = /[\u2e80-\u2fdf\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u;

type Saved = {
  schemaVersion: number;
  introSeen: boolean;
  cangjieIntroSeen: boolean;
  history: Record<string, unknown>;
  level: number;
  levelChosen: boolean;
};

async function readSave(page: Page): Promise<Saved> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  expect(raw, 'nothing is saved in localStorage').not.toBeNull();
  return JSON.parse(raw as string) as Saved;
}

async function openLevelScreenFirstRun(page: Page): Promise<void> {
  await seed(page, seedState({ introSeen: false, cangjieIntroSeen: false }));
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin the Séance' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Where will you begin?' })).toBeVisible();
  // The three description lines come from the manifest.
  await expect(page.getByText(/characters, about \d+ strokes each\./)).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
}

test.describe('harder ghosts: first run', () => {
  test('intro → Level_Screen → first séance for level 2 with the guided first ghost first', async ({ page }) => {
    const walk = walkthroughRecord();
    expect(walk.character, 'the walkthrough ghost changed').toBe('明');
    expect(levelDatasetMap(1).has(walk.character)).toBe(true);
    expect(levelDatasetMap(2).has(walk.character), 'the guided ghost belongs to level 1').toBe(false);
    await openLevelScreenFirstRun(page);
    await page.getByRole('button', { name: /^Level 2/ }).click();
    const summon = page.getByRole('region', { name: 'Summon step' });
    await expect(summon).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(walk.prompt.pinyin);
    if (walk.cangjie === null) throw new Error('the walkthrough ghost has no code');
    const code = walk.cangjie.toUpperCase().split('');
    for (let i = 0; i < code.length; i++) {
      await expect(summon.getByRole('listitem', { name: slotName(i + 1, code[i]!) })).toBeVisible();
    }
    await expect(summon.getByTestId('walkthrough-line')).toContainText(`Press ${code[0]}:`);
    const save = await readSave(page);
    expect(save.level).toBe(2);
    expect(save.levelChosen).toBe(true);
  });
});

for (const vp of VIEWPORTS) {
  test.describe(`harder ghosts: Level_Screen at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    test('fits without vertical or horizontal scroll, has no .slip-primary and no Chinese', async ({ page }) => {
      await openLevelScreenFirstRun(page);
      await expectNoVerticalScroll(page);
      expect(await findOverflow(page, vp.width), 'horizontal overflow on the Level_Screen').toEqual([]);
      await expect(page.locator('.slip-primary')).toHaveCount(0);
      const html = await page.evaluate(() => `${document.title}\n${document.body.outerHTML}`);
      expect(CHINESE.test(html), 'a Chinese character is on the Level_Screen').toBe(false);
    });

    test('opened from the menu it also fits and shows no Chinese character', async ({ page }) => {
      await seed(page, seedState());
      await page.goto(START);
      await page.getByRole('button', { name: /^Starting level: 1/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Where will you begin?' })).toBeVisible();
      await expect(page.getByText(/characters, about \d+ strokes each\./)).toHaveCount(3);
      await page.evaluate(() => document.fonts.ready);
      await expectNoVerticalScroll(page);
      expect(await findOverflow(page, vp.width), 'horizontal overflow on the Level_Screen').toEqual([]);
      await expect(page.locator('.slip-primary')).toHaveCount(0);
      const html = await page.evaluate(() => `${document.title}\n${document.body.outerHTML}`);
      expect(CHINESE.test(html), 'a Chinese character is on the Level_Screen').toBe(false);
    });
  });
}

test.describe('harder ghosts: change the level from the menu', () => {
  test('the new level is saved and the history, introSeen and cangjieIntroSeen stay unchanged', async ({ page }) => {
    const [a, b] = levelOrder(1);
    const history = {
      [a as string]: { step: 2, lastOutcome: 'clean', nextDue: FAR_FUTURE },
      [b as string]: { step: 0, lastOutcome: 'struggled', nextDue: 0 },
    };
    await seed(page, seedState({ history }));
    await page.goto(START);
    await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
    const before = await readSave(page);
    await page.getByRole('button', { name: 'Starting level: 1' }).click();
    await expect(page.getByRole('button', { name: /^Level 1/ })).toHaveAttribute('aria-current', 'true');
    await page.getByRole('button', { name: /^Level 3/ }).click();
    await expect(page.getByRole('button', { name: 'Starting level: 3' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Summon step' })).toHaveCount(0);
    await expect(page.locator('.slip-primary')).toHaveCount(1);
    const after = await readSave(page);
    expect(after.level).toBe(3);
    expect(after.levelChosen).toBe(true);
    expect(after.history).toEqual(before.history);
    expect(after.introSeen).toBe(before.introSeen);
    expect(after.cangjieIntroSeen).toBe(before.cangjieIntroSeen);
    expect(Object.keys(after.history).sort()).toEqual([a as string, b as string].sort());
  });
});

test.describe('harder ghosts: Graveyard level switch', () => {
  test('counts add up per level and a never-met glyph is never drawn', async ({ page }) => {
    const level1 = levelOrder(1);
    const level2 = levelOrder(2);
    const met1 = level1.slice(0, 3);
    const met2 = level2.slice(0, 2);
    const history: Record<string, { step: number; lastOutcome: string; nextDue: number }> = {};
    // level 1: one at rest, two restless; level 2: one at rest, one restless
    history[met1[0]!] = { step: 3, lastOutcome: 'clean', nextDue: FAR_FUTURE };
    history[met1[1]!] = { step: 0, lastOutcome: 'struggled', nextDue: 0 };
    history[met1[2]!] = { step: 0, lastOutcome: 'gave-up', nextDue: 0 };
    history[met2[0]!] = { step: 3, lastOutcome: 'clean', nextDue: FAR_FUTURE };
    history[met2[1]!] = { step: 0, lastOutcome: 'struggled', nextDue: 0 };
    await seed(page, seedState({ history, level: 2 }));
    await page.goto(START);
    await page.getByRole('button', { name: 'Graveyard' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Graveyard' })).toBeVisible();

    const count = async (label: string): Promise<number> => {
      const text = await page.getByRole('list', { name: 'Legend' }).getByText(new RegExp(`^${label}: \\d+$`)).innerText();
      return Number(text.split(': ')[1]);
    };
    const check = async (level: 1 | 2 | 3, met: readonly string[], rest: number, atRest: number): Promise<void> => {
      const records = levelDatasetMap(level);
      await expect(page.getByRole('button', { name: /^Level \d/, pressed: true })).toContainText(`Level ${level}`);
      await expect(page.getByRole('button', { name: new RegExp(`^Level ${level}`) })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByText(`These graves are the ghosts of level ${level}`, { exact: false })).toBeVisible();
      const unmet = await count('Never met');
      const restless = await count('Restless');
      const resting = await count('At rest');
      expect(restless).toBe(rest);
      expect(resting).toBe(atRest);
      expect(unmet + restless + resting, `level ${level} counts do not add up`).toBe(records.size);
      expect(unmet).toBe(records.size - met.length);
      await expect(page.getByRole('list', { name: 'Graves' }).getByRole('listitem')).toHaveCount(records.size);
      // Never-met graves carry only their position; no character of the level that is unmet is drawn.
      const gravesText = await page.getByRole('list', { name: 'Graves' }).evaluate((el) => el.textContent ?? '');
      const labels = await page
        .getByRole('list', { name: 'Graves' })
        .getByRole('listitem')
        .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
      const unmetLabels = labels.filter((l) => /never met$/.test(l));
      expect(unmetLabels.length).toBe(unmet);
      for (const l of unmetLabels) {
        expect(l).toMatch(new RegExp(`^Ghost \\d+ of ${records.size}, never met$`));
      }
      for (const char of records.keys()) {
        if (!met.includes(char)) expect(gravesText, `never-met "${char}" is drawn`).not.toContain(char);
      }
      for (const char of met) expect(gravesText).toContain(char);
    };

    await check(2, met2, 1, 1);
    await page.getByRole('button', { name: /^Level 1/ }).click();
    await expect(page.getByText('These graves are the ghosts of level 1', { exact: false })).toBeVisible({
      timeout: 15_000,
    });
    await check(1, met1, 2, 1);
    await page.getByRole('button', { name: /^Level 3/ }).click();
    await expect(page.getByText('These graves are the ghosts of level 3', { exact: false })).toBeVisible({
      timeout: 15_000,
    });
    await check(3, [], 0, 0);
    await expect(page.getByText('No ghost has been met yet.', { exact: false })).toBeVisible();
    // Switching the shown level does not change the chosen level.
    expect((await readSave(page)).level).toBe(2);
  });
});

test.describe('harder ghosts: version 2 save', () => {
  test('opens on the menu at level 1 with its history intact', async ({ page }) => {
    const [a, b] = levelOrder(1);
    const history = {
      [a as string]: { step: 3, lastOutcome: 'clean', nextDue: FAR_FUTURE },
      [b as string]: { step: 0, lastOutcome: 'struggled', nextDue: 0 },
    };
    await seed(page, seedV2({ history }));
    await page.goto(START);
    await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Starting level: 1' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Where will you begin?' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Graveyard' }).click();
    await expect(page.getByRole('button', { name: /^Level 1/ })).toHaveAttribute('aria-pressed', 'true');
    const grave = page.getByRole('list', { name: 'Graves' });
    await expect(grave.getByRole('listitem', { name: new RegExp(`^${a}, at rest`) })).toBeVisible();
    await expect(grave.getByRole('listitem', { name: new RegExp(`^${b}, restless`) })).toBeVisible();
    const save = await readSave(page);
    expect(save.history).toEqual(history);
  });
});
