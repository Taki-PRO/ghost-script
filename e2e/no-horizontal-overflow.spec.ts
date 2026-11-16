import { expect, test, type Page } from '@playwright/test';
import { START, datasetKeys, findOverflow, seed, seedState } from './helpers';

// Width_Check at 375 x 812 and 320 x 640 on five screens (Requirements 24.7 to 24.10, 29.1, 29.2).
// Helpers live in `e2e/helpers.ts`.

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 320, height: 640 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`no horizontal overflow at ${vp.width} px`, () => {
    test.use({ viewport: vp });

    function expectViewport(page: Page): void {
      expect(page.viewportSize()).toEqual(vp);
    }

    test('Sources & licences', async ({ page }) => {
      expectViewport(page);
      await seed(page, seedState());
      await page.goto(START);
      await page.getByRole('button', { name: 'Sources & licences' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Sources & licences' })).toBeVisible();

      const problems = await findOverflow(page, vp.width);
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test('Graveyard', async ({ page }) => {
      expectViewport(page);
      const [a, b, c] = datasetKeys();
      expect(c, 'characters.json has fewer than three characters').toBeDefined();
      await seed(
        page,
        seedState({
          history: {
            [a as string]: { step: 0, lastOutcome: 'struggled', nextDue: 0 },
            [b as string]: { step: 3, lastOutcome: 'clean', nextDue: 32_503_680_000_000 },
            [c as string]: { step: 0, lastOutcome: 'gave-up', nextDue: 0 },
          },
        }),
      );
      await page.goto(START);
      await page.getByRole('button', { name: 'Graveyard' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Graveyard' })).toBeVisible();

      const problems = await findOverflow(page, vp.width);
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test('How Cangjie works', async ({ page }) => {
      expectViewport(page);
      await seed(page, seedState({ cangjieIntroSeen: false }));
      await page.goto(START);
      await page.getByRole('button', { name: 'How Cangjie works' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'How Cangjie works' })).toBeVisible();

      const problems = await findOverflow(page, vp.width);
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test('Summon step', async ({ page }) => {
      expectViewport(page);
      await seed(page, seedState());
      await page.goto(START);
      await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
      const summon = page.getByRole('region', { name: 'Summon step' });
      await expect(
        summon,
        'The Summon step did not appear after "Begin a Nightly Séance"; the first ghost may be unplayable.',
      ).toBeVisible({ timeout: 10_000 });

      const problems = await findOverflow(page, vp.width);
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test('Write step', async ({ page }) => {
      expectViewport(page);
      await seed(page, seedState());
      await page.goto(START);
      await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
      const summon = page.getByRole('region', { name: 'Summon step' });
      await expect(
        summon,
        'The Summon step did not appear after "Begin a Nightly Séance"; the first ghost may be unplayable.',
      ).toBeVisible({ timeout: 10_000 });
      await summon.getByRole('button', { name: 'Give up' }).click();
      await expect(page.getByRole('region', { name: 'Write mode' })).toBeVisible({ timeout: 10_000 });

      const problems = await findOverflow(page, vp.width);
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test('guard: an appended 600 px div is reported', async ({ page }) => {
      expectViewport(page);
      await seed(page, seedState());
      await page.goto(START);
      await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
      await page.evaluate(() => {
        const div = document.createElement('div');
        div.id = 'overflow-guard';
        div.style.width = '600px';
        div.style.height = '10px';
        document.body.appendChild(div);
      });

      const problems = await findOverflow(page, vp.width);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.join('\n')).toContain('div#overflow-guard');
    });
  });
}
