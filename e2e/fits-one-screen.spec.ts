import { expect, test, type Locator, type Page } from '@playwright/test';
import { START, expectInside, expectNoVerticalScroll, seed, seedState } from './helpers';

// Height_Check and scroll reset at 1024 x 768 and 375 x 812 (Requirements 29.3 to 29.7).
// Codes are never typed: "Give up" moves through the steps.

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`one-screen fit at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    async function startSeance(page: Page): Promise<Locator> {
      expect(page.viewportSize()).toEqual(vp);
      await seed(page, seedState());
      await page.goto(START);
      await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
      const summon = page.getByRole('region', { name: 'Summon step' });
      await expect(
        summon,
        'The Summon step did not appear after "Begin a Nightly Séance"; the first ghost may be unplayable.',
      ).toBeVisible({ timeout: 10_000 });
      return summon;
    }

    async function giveUpSummon(page: Page, summon: Locator): Promise<Locator> {
      await summon.getByRole('button', { name: 'Give up' }).click();
      const write = page.getByRole('region', { name: 'Write mode' });
      await expect(write).toBeVisible({ timeout: 10_000 });
      return write;
    }

    test('Summon step fits', async ({ page }) => {
      const summon = await startSeance(page);
      await expectInside(page, 'Leave séance', page.getByRole('button', { name: 'Leave séance' }));
      await expectInside(page, 'Step 1 of 2: Summon', page.getByText('Step 1 of 2: Summon'));
      await expectInside(page, "Ghost's clue", page.getByRole('region', { name: "Ghost's clue" }));
      await expectInside(page, 'Cangjie code', page.getByRole('list', { name: 'Cangjie code' }));
      await expectInside(page, 'ink-surface', page.getByTestId('ink-surface'));
      const keys = summon.locator('[data-row="2"] button');
      const count = await keys.count();
      expect(count, 'no buttons in [data-row="2"]').toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expectInside(page, `row 2 key ${i}`, keys.nth(i));
      }
      await expectInside(page, 'Summon Give up', summon.getByRole('button', { name: 'Give up' }));
      await expectNoVerticalScroll(page);
    });

    test('Write step fits', async ({ page }) => {
      const summon = await startSeance(page);
      const write = await giveUpSummon(page, summon);
      await expectInside(page, 'Leave séance', page.getByRole('button', { name: 'Leave séance' }));
      await expectInside(page, 'write ink-surface', page.getByTestId('ink-surface'));
      await expectInside(page, 'Write Give up', write.getByRole('button', { name: 'Give up' }));
      await expectNoVerticalScroll(page);
    });

    test('Next ghost fits', async ({ page }) => {
      const summon = await startSeance(page);
      const write = await giveUpSummon(page, summon);
      const giveUp = write.getByRole('button', { name: 'Give up' });
      await expect(giveUp).toBeEnabled({ timeout: 10_000 });
      await giveUp.click();
      await expectInside(page, 'Next ghost', page.getByRole('button', { name: 'Next ghost' }));
    });

    test('scroll resets to the top on Next ghost', async ({ page }) => {
      const summon = await startSeance(page);
      await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.id = 'scroll-spacer';
        spacer.style.height = '2000px';
        document.body.appendChild(spacer);
        window.scrollTo(0, 500);
      });
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      const write = await giveUpSummon(page, summon);
      const giveUp = write.getByRole('button', { name: 'Give up' });
      await expect(giveUp).toBeEnabled({ timeout: 10_000 });
      await giveUp.click();
      await page.getByRole('button', { name: 'Next ghost' }).click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    });
  });
}
