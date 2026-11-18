import { expect, test } from '@playwright/test';
import { START, waitForLegendReveal } from './helpers';

// Fresh-profile font requests (spec proof-pass, Requirement 7, ACs 10 and 11).
// A new player who stays on level 1 must not download the level 2 or level 3
// font subsets. No stored state is seeded.
test('a fresh profile on level 1 requests the level 1 font subset only', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));

  await page.goto(START);
  await waitForLegendReveal(page);
  await page.getByRole('button', { name: 'Begin the Séance' }).click();
  await page.getByRole('button', { name: /^Level 1/ }).click();
  await expect(page.getByRole('region', { name: 'Summon step' })).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState('networkidle');

  const fonts = urls.filter((url) => url.includes('lxgw-wenkai-subset'));
  const report = `font requests: ${JSON.stringify(fonts)}`;
  expect(urls.filter((url) => url.includes('lxgw-wenkai-subset-level2')), report).toEqual([]);
  expect(urls.filter((url) => url.includes('lxgw-wenkai-subset-level3')), report).toEqual([]);
  // The level 1 file is `lxgw-wenkai-subset-<hash>.woff2` (no "level" in the name).
  const levelOne = fonts.filter((url) => /lxgw-wenkai-subset(?!-level)/.test(url));
  expect(levelOne, report).not.toEqual([]);
});
