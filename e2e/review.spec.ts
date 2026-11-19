import { expect, test, type Page } from '@playwright/test';
import {
  START,
  STORAGE_KEY,
  datasetMap,
  layToRestClean,
  levelOrder,
  seed,
  seedState,
} from './helpers';
import { buildGraveyard } from '../app/src/engine/graveyard';
import { DEFAULT_CONFIG } from '../app/src/engine/config';
import type { ReviewHistory } from '../app/src/engine/scheduler';
// Review_Run (proof-pass Requirements 10.34, 10.35, 10.25, 9.14): three restless ghosts, one
// remembered and two missed. The first ghost of the run is the most overdue one, so the
// seeded `nextDue` values (1000, 2000, 3000) fix the order.
test.use({ reducedMotion: 'reduce' });
type StoredHistory = Record<string, { step: number; lastOutcome: string; nextDue: number; history?: unknown }>;
async function storedHistory(page: Page): Promise<StoredHistory> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  expect(raw, 'nothing stored under the state key').not.toBeNull();
  return (JSON.parse(raw as string) as { history: StoredHistory }).history;
}
test('a Review_Run with one clean and two missed ghosts stores the right history', async ({ page }) => {
  test.setTimeout(180_000);
  const dataset = datasetMap();
  const pinyinSeen = new Set<string>();
  const chosen: string[] = [];
  for (const ch of levelOrder(1)) {
    const record = dataset.get(ch);
    if (!record || record.cangjie === null || pinyinSeen.has(record.prompt.pinyin)) continue;
    pinyinSeen.add(record.prompt.pinyin);
    chosen.push(ch);
    if (chosen.length === 3) break;
  }
  const [cleanChar, struggledChar, gaveUpChar] = chosen as [string, string, string];
  const seeded: StoredHistory = {
    [cleanChar]: { step: 1, lastOutcome: 'gave-up', nextDue: 1000 },
    [struggledChar]: { step: 2, lastOutcome: 'clean', nextDue: 2000 },
    [gaveUpChar]: { step: 0, lastOutcome: 'struggled', nextDue: 3000 },
  };
  await seed(page, seedState({ history: seeded }));
  await page.goto(START);
  await page.getByRole('button', { name: 'Review restless ghosts (3)' }).click();
  const clue = page.getByRole('region', { name: "Ghost's clue" });
  const next = page.getByRole('button', { name: /^(Next ghost|Finish the séance)$/ });
  // Ghost 1: remembered.
  await expect(clue).toContainText(dataset.get(cleanChar)!.prompt.pinyin);
  await layToRestClean(page, cleanChar);
  await next.click();
  // Ghost 2: struggled, with three wrong keys first. The miss is stamped when the outcome is recorded.
  await expect(clue).toContainText(dataset.get(struggledChar)!.prompt.pinyin);
  const beforeStruggled = Date.now();
  await layToRestClean(page, struggledChar, { expectSeal: false, wrongKeyFirst: true });
  await expect(next).toBeVisible({ timeout: 15_000 });
  const afterStruggled = Date.now();
  await next.click();
  // Ghost 3: gave up.
  await expect(clue).toContainText(dataset.get(gaveUpChar)!.prompt.pinyin);
  const summon = page.getByRole('region', { name: 'Summon step' });
  await expect(summon).toBeVisible();
  const beforeGaveUp = Date.now();
  await summon.getByRole('button', { name: 'Give up' }).click();
  const writeGiveUp = page.getByRole('region', { name: 'Write mode' }).getByRole('button', { name: 'Give up' });
  await expect(writeGiveUp).toBeEnabled({ timeout: 10_000 });
  await writeGiveUp.click();
  await expect(next).toBeVisible({ timeout: 15_000 });
  const afterGaveUp = Date.now();
  await next.click();
  await expect(page.getByText('1 of 3 ghosts remembered')).toBeVisible();
  await expect(page.getByText(/laid to rest/i)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'The review is over' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin another Séance' })).toHaveCount(0);
  await expect(page.locator('.slip-primary')).toHaveCount(1);
  const stored = await storedHistory(page);
  expect(Object.keys(stored).sort()).toEqual([cleanChar, struggledChar, gaveUpChar].sort());
  // The clean entry equals its seed.
  expect(stored[cleanChar]).toEqual(seeded[cleanChar]);
  // Each missed entry has step 0 and nextDue = recording time + relearnDelayMs.
  const delay = DEFAULT_CONFIG.relearnDelayMs;
  expect(delay).toBe(600_000);
  expect(stored[struggledChar]!.step).toBe(0);
  expect(stored[struggledChar]!.lastOutcome).toBe('struggled');
  expect(stored[struggledChar]!.nextDue).toBeGreaterThanOrEqual(beforeStruggled + delay);
  expect(stored[struggledChar]!.nextDue).toBeLessThanOrEqual(afterStruggled + delay);
  expect(stored[gaveUpChar]!.step).toBe(0);
  expect(stored[gaveUpChar]!.lastOutcome).toBe('gave-up');
  expect(stored[gaveUpChar]!.nextDue).toBeGreaterThanOrEqual(beforeGaveUp + delay);
  expect(stored[gaveUpChar]!.nextDue).toBeLessThanOrEqual(afterGaveUp + delay);
  // "Back to menu" returns to the Start menu.
  await page.getByRole('button', { name: 'Back to menu' }).click();
  await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
  // The Graveyard counts equal buildGraveyard over the stored history.
  await page.reload();
  await page.getByRole('button', { name: 'Graveyard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Graveyard' })).toBeVisible();
  const model = buildGraveyard(levelOrder(1), (await storedHistory(page)) as unknown as ReviewHistory, Date.now());
  const legend = page.getByRole('list', { name: 'Legend' });
  await expect(legend).toContainText(`Never met: ${model.counts.unmet}`);
  await expect(legend).toContainText(`Restless: ${model.counts.restless}`);
  await expect(legend).toContainText(`At rest: ${model.counts['at-rest']}`);
  expect(model.counts.restless).toBe(3);
});
