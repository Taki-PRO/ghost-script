import { expect, test, type Locator, type Page } from '@playwright/test';
import type { CharacterRecord } from '../app/src/data/types';
import { isPlayableInCangjie } from '../app/src/engine/cangjieRules';
import { learningOrder } from '../app/src/engine/learningOrder';
import {
  START,
  datasetMap,
  expectInside,
  expectNoVerticalScroll,
  findOverflow,
  seed,
  seedBefore,
  seedState,
  seedWithHistory,
  slotName,
  walkthroughRecord,
} from './helpers';

// First meeting: the faint code, the walkthrough ghost, returning ghosts and the
// summary's return times (spec first-meeting, Requirements 12.6 and 12.7).
// Every code, pinyin and line comes from characters.json at test time; no code
// is typed from memory.

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
] as const;

function letters(record: CharacterRecord): string[] {
  if (record.cangjie === null) throw new Error(`${record.character} has no code`);
  return record.cangjie.toUpperCase().split('');
}

/** First playable ghost of the learning order after position 0, other than the walkthrough ghost. */
function otherFirstMeetingGhost(): CharacterRecord {
  const map = datasetMap();
  const walk = walkthroughRecord().character;
  for (const char of learningOrder(map).slice(1)) {
    const record = map.get(char);
    if (record && char !== walk && isPlayableInCangjie(record.cangjie)) return record;
  }
  throw new Error('no other playable ghost');
}

async function beginFromMenu(page: Page): Promise<Locator> {
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  const summon = page.getByRole('region', { name: 'Summon step' });
  await expect(summon, 'The Summon step did not appear after "Begin a Nightly Séance".').toBeVisible({
    timeout: 10_000,
  });
  return summon;
}

async function pressKey(summon: Locator, letter: string): Promise<void> {
  await summon.getByRole('button', { name: new RegExp(`^Key ${letter}(,|$)`) }).click();
}

test.describe('first meeting: content', () => {
  test('a new player goes from the intro to the walkthrough ghost with its faint code', async ({ page }) => {
    const record = walkthroughRecord();
    await seed(page, seedState({ introSeen: false, cangjieIntroSeen: false }));
    await page.goto(START);
    await page.getByRole('button', { name: 'Begin the Séance' }).click();
    // A first run now passes through the Level_Screen (spec harder-ghosts).
    await page.getByRole('button', { name: /^Level 1/ }).click();
    const summon = page.getByRole('region', { name: 'Summon step' });
    await expect(summon).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /How Cangjie works/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(record.prompt.pinyin);
    const code = letters(record);
    for (let i = 0; i < code.length; i++) {
      await expect(summon.getByRole('listitem', { name: slotName(i + 1, code[i]) })).toBeVisible();
    }
    await expect(summon.getByTestId('walkthrough-line')).toContainText(`Press ${code[0]}:`);
  });

  test('the walkthrough line follows the typed code and ends at completion', async ({ page }) => {
    const record = walkthroughRecord();
    const code = letters(record);
    await seed(page, seedState());
    const summon = await beginFromMenu(page);
    const line = summon.getByTestId('walkthrough-line');
    for (let i = 0; i < code.length; i++) {
      await expect(line).toContainText(`Press ${code[i]}:`);
      await pressKey(summon, code[i]);
    }
    await expect(line).toHaveCount(0);
  });

  test('a returning ghost shows empty slots and no code', async ({ page }) => {
    const record = walkthroughRecord();
    await seed(page, seedWithHistory([record.character], 'clean'));
    const summon = await beginFromMenu(page);
    await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(record.prompt.pinyin);
    await expect(summon.getByRole('listitem', { name: 'Slot 1, empty' })).toBeVisible();
    await expect(summon.getByRole('listitem', { name: /type / })).toHaveCount(0);
    await expect(summon.getByTestId('walkthrough-line')).toHaveCount(0);
  });
});

for (const vp of VIEWPORTS) {
  test.describe(`first meeting: one-screen fit at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    test('walkthrough ghost: Summon step with line and faint code fits', async ({ page }) => {
      const record = walkthroughRecord();
      const code = letters(record);
      await seed(page, seedState());
      const summon = await beginFromMenu(page);
      await expectInside(page, 'Leave séance', page.getByRole('button', { name: 'Leave séance' }));
      await expectInside(page, 'Step label', page.getByText('Step 1 of 2: Summon'));
      await expectInside(page, "Ghost's clue", page.getByRole('region', { name: "Ghost's clue" }));
      await expectInside(page, 'walkthrough line', summon.getByTestId('walkthrough-line'));
      for (let i = 0; i < code.length; i++) {
        await expectInside(page, `slot ${i + 1}`, summon.getByRole('listitem', { name: slotName(i + 1, code[i]) }));
      }
      await expectInside(page, 'ink-surface', page.getByTestId('ink-surface'));
      const keys = summon.locator('[data-row="2"] button');
      const count = await keys.count();
      expect(count, 'no buttons in [data-row="2"]').toBeGreaterThan(0);
      for (let i = 0; i < count; i++) await expectInside(page, `row 2 key ${i}`, keys.nth(i));
      await expectInside(page, 'Summon Give up', summon.getByRole('button', { name: 'Give up' }));
      await expectNoVerticalScroll(page);
    });

    test('walkthrough ghost: Write step with line fits', async ({ page }) => {
      await seed(page, seedState());
      const summon = await beginFromMenu(page);
      await summon.getByRole('button', { name: 'Give up' }).click();
      const write = page.getByRole('region', { name: 'Write mode' });
      await expect(write).toBeVisible({ timeout: 10_000 });
      const line = page.getByTestId('walkthrough-write-line');
      await expect(line).toHaveText('Now write it from memory');
      await expectInside(page, 'Leave séance', page.getByRole('button', { name: 'Leave séance' }));
      await expectInside(page, 'Write line', line);
      await expectInside(page, 'write ink-surface', page.getByTestId('ink-surface'));
      await expectInside(page, 'Write Give up', write.getByRole('button', { name: 'Give up' }));
      await expectNoVerticalScroll(page);
    });

    test('another first-meeting ghost: faint code, no line, fits', async ({ page }) => {
      const record = otherFirstMeetingGhost();
      const code = letters(record);
      await seed(page, seedBefore(record.character));
      const summon = await beginFromMenu(page);
      await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(record.prompt.pinyin);
      await expect(summon.getByTestId('walkthrough-line')).toHaveCount(0);
      for (let i = 0; i < code.length; i++) {
        await expectInside(page, `slot ${i + 1}`, summon.getByRole('listitem', { name: slotName(i + 1, code[i]) }));
      }
      await expectInside(page, 'ink-surface', page.getByTestId('ink-surface'));
      const keys = summon.locator('[data-row="2"] button');
      const count = await keys.count();
      for (let i = 0; i < count; i++) await expectInside(page, `row 2 key ${i}`, keys.nth(i));
      await expectInside(page, 'Summon Give up', summon.getByRole('button', { name: 'Give up' }));
      await expectNoVerticalScroll(page);
      await summon.getByRole('button', { name: 'Give up' }).click();
      const write = page.getByRole('region', { name: 'Write mode' });
      await expect(write).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('walkthrough-write-line')).toHaveCount(0);
      await expectInside(page, 'write ink-surface', page.getByTestId('ink-surface'));
      await expectInside(page, 'Write Give up', write.getByRole('button', { name: 'Give up' }));
      await expectNoVerticalScroll(page);
    });
  });
}

test.describe('first meeting: summary', () => {
  test.use({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });

  test('a whole Séance ends with a return time for every ghost', async ({ page }) => {
    test.setTimeout(240_000);
    await seed(page, seedState());
    await beginFromMenu(page);
    const summary = page.getByRole('heading', { name: 'The séance is over' });
    const next = page.getByRole('button', { name: /^(Next ghost|Finish the séance)$/ });
    const summonGiveUp = page
      .getByRole('region', { name: 'Summon step' })
      .getByRole('button', { name: 'Give up' });
    const writeGiveUp = page
      .getByRole('region', { name: 'Write mode' })
      .getByRole('button', { name: 'Give up' });
    const deadline = Date.now() + 200_000;
    while (!(await summary.isVisible())) {
      if (Date.now() > deadline) throw new Error('the Séance did not reach the summary');
      if (await next.isVisible()) await next.click();
      else if (await summonGiveUp.isVisible()) await summonGiveUp.click();
      else if (await writeGiveUp.isVisible() && (await writeGiveUp.isEnabled())) await writeGiveUp.click();
      else await page.waitForTimeout(100);
    }
    const rows = page.getByRole('list', { name: 'Ghosts that will return' }).getByRole('listitem');
    await expect(rows).toHaveCount(10);
    for (let i = 0; i < 10; i++) {
      await expect(rows.nth(i)).toContainText(/returns (now|soon|tomorrow|in \d+ (minutes?|hours?|days))/);
    }
    expect(await findOverflow(page, 375)).toEqual([]);
  });
});
