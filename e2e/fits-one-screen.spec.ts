import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  START,
  datasetMap,
  expectInside,
  expectMoonInside,
  expectNoVerticalScroll,
  findOverflow,
  reachFullSummary,
  seed,
  seedBefore,
  seedState,
  openStartMenuWorstCase,
  seedWithHistory,
  summonOtherHeight,
  waitForLegendReveal,
} from './helpers';
import { learningOrder } from '../app/src/engine/learningOrder';

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
      // seedState() has an empty history, so the first ghost is the walkthrough ghost.
      await expectInside(page, 'walkthrough line', page.getByTestId('walkthrough-line'));
      const keys = summon.locator('[data-row="2"] button');
      const count = await keys.count();
      expect(count, 'no buttons in [data-row="2"]').toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expectInside(page, `row 2 key ${i}`, keys.nth(i));
      }
      await expectInside(page, 'Summon Give up', summon.getByRole('button', { name: 'Give up' }));
      await expectInside(page, 'Sound_Toggle', page.getByTestId('sound-toggle'));
      await expectNoVerticalScroll(page);
    });

    test('Write step fits', async ({ page }) => {
      const summon = await startSeance(page);
      const write = await giveUpSummon(page, summon);
      await expectInside(page, 'Leave séance', page.getByRole('button', { name: 'Leave séance' }));
      await expectInside(page, 'write ink-surface', page.getByTestId('ink-surface'));
      await expectInside(page, 'walkthrough write line', page.getByTestId('walkthrough-write-line'));
      await expectInside(page, 'Write Give up', write.getByRole('button', { name: 'Give up' }));
      await expectInside(page, 'Sound_Toggle', page.getByTestId('sound-toggle'));
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

// The Summon step fits one screen at three viewports for a Returning_Ghost, a first meeting
// and the Guided_Ghost (proof-pass Requirements 3.1 to 3.3, 3.6 to 3.9, 3.12, 3.13).
const SUMMON_VIEWPORTS = [
  { width: 1024, height: 768, minPaper: 260 },
  { width: 375, height: 812, minPaper: 240 },
  { width: 320, height: 640, minPaper: 96 },
] as const;

const order = learningOrder(datasetMap());
const SUMMON_SCENARIOS = [
  { name: 'returning ghost', seed: () => seedWithHistory(order.slice(0, 3), 'struggled'), guided: false },
  { name: 'non-guided first meeting', seed: () => seedBefore(order[20] as string), guided: false },
  { name: 'guided ghost', seed: () => seedState(), guided: true },
] as const;

for (const vp of SUMMON_VIEWPORTS) {
  for (const scenario of SUMMON_SCENARIOS) {
    test.describe(`summon fit at ${vp.width} x ${vp.height}, ${scenario.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('Summon step fits with a big paper', async ({ page }) => {
        await seed(page, scenario.seed());
        await page.goto(START);
        await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
        const summon = page.getByRole('region', { name: 'Summon step' });
        await expect(summon).toBeVisible({ timeout: 10_000 });
        await page.evaluate(() => document.fonts.ready);
        const line = page.getByTestId('walkthrough-line');
        if (scenario.guided) await expect(line).toBeVisible();
        else await expect(line).toHaveCount(0);

        await expectInside(page, 'Sound_Toggle', page.getByTestId('sound-toggle'));
        const ink = page.getByTestId('ink-surface');
        await expectInside(page, 'ink-surface', ink);
        const box = await ink.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { width: r.width, height: r.height };
        });
        expect(Math.abs(box.width - box.height), `ink-surface ${box.width} x ${box.height} is not square`).toBeLessThanOrEqual(1);
        if (vp.width !== 320) {
          expect(box.width, `ink-surface ${box.width}px`).toBeGreaterThanOrEqual(vp.minPaper);
        }

        const other = await summonOtherHeight(page);
        expect(other, `other Summon content ${other}px`).toBeLessThanOrEqual(480);

        const small = await page.evaluate(() => {
          const out: string[] = [];
          const root = document.querySelector('main') as HTMLElement;
          for (const el of Array.from(root.querySelectorAll('*'))) {
            const own = Array.from(el.childNodes).some(
              (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
            );
            if (!own) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const size = Number.parseFloat(cs.fontSize);
            if (size < 12) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 20)}" ${size}px`);
          }
          return out;
        });
        expect(small, 'text under 12 px').toEqual([]);

        await expectNoVerticalScroll(page);
        expect(await findOverflow(page, vp.width)).toEqual([]);
      });
    });
  }
}

// The intro fits one screen (Requirement 23.6). introSeen is false, so the App opens on the intro.
const INTRO_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
  { width: 320, height: 640 },
] as const;

for (const vp of INTRO_VIEWPORTS) {
  test.describe(`intro fit at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    test('intro fits', async ({ page }) => {
      expect(page.viewportSize()).toEqual(vp);
      await seed(page, seedState({ introSeen: false }));
      await page.goto(START);
      await waitForLegendReveal(page);
      const begin = page.getByRole('button', { name: 'Begin the Séance' });
      const sources = page.getByRole('button', { name: 'Sources' });
      await expectInside(page, 'Begin the Séance', begin);
      await expectInside(page, 'Sources', sources);
      await expectInside(page, 'Sound_Toggle', page.getByTestId('sound-toggle'));
      await expectNoVerticalScroll(page);
      const m = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        beginBottom: Array.from(document.querySelectorAll('button'))
          .find((b) => b.textContent?.includes('Begin the Séance'))
          ?.getBoundingClientRect().bottom,
      }));
      test.info().annotations.push({
        type: 'slack',
        description: `page ${m.innerHeight - m.scrollHeight}px, Begin button ${Math.round(m.innerHeight - (m.beginBottom ?? 0))}px`,
      });
    });
  });
}

// A full 10-ghost Summary (clean, struggled and gave-up) fits one screen (proof-pass Requirements 4.10, 4.12, 4.15, 4.17).
for (const vp of VIEWPORTS) {
  test.describe(`summary fit at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp, reducedMotion: 'reduce' });
    test('a full summary fits', async ({ page }) => {
      test.setTimeout(480_000);
      await reachFullSummary(page);
      expect(page.viewportSize()).toEqual(vp);
      await expect(page.getByRole('list', { name: 'Ghosts that will return' }).getByRole('listitem')).toHaveCount(10);
      const tiles = page.getByRole('list', { name: 'Ghosts that will return' }).getByRole('listitem');
      for (const word of [/laid to rest/, /struggled/, /gave up/]) {
        expect(await tiles.evaluateAll(
          (els, source) => els.filter((el) => new RegExp(source).test(el.getAttribute('aria-label') ?? '')).length,
          word.source,
        ), `no ${word.source} tile`).toBeGreaterThan(0);
      }
      await expect(page.getByRole('img', { name: /^Seal: / }).first()).toBeVisible();
      await expectInside(page, 'Begin another Séance', page.getByRole('button', { name: 'Begin another Séance' }));
      await expectInside(page, 'Sound_Toggle', page.getByTestId('sound-toggle'));
      await expect(page.locator('.slip-primary')).toHaveCount(1);
      await expectMoonInside(page, `summary ${vp.width}`);
      const m = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        contentBottom: Math.max(
          ...Array.from(document.querySelectorAll('main *')).map((el) => el.getBoundingClientRect().bottom + window.scrollY),
        ),
      }));
      test.info().annotations.push({ type: 'summary-height', description: `${m.scrollHeight} of ${m.innerHeight}` });
      console.log(`summary height at ${vp.width} x ${vp.height}: scrollHeight ${m.scrollHeight}, content bottom ${Math.round(m.contentBottom)}`);
      await expectNoVerticalScroll(page);
      expect(await findOverflow(page, vp.width)).toEqual([]);
    });
  });
}

// The plain Start menu (no finished notice, no review slip) fits one screen (proof-pass Requirements 9.1, 9.2, 9.11).
// The worst case with the review slip is added by task 13.5.
for (const vp of VIEWPORTS) {
  test.describe(`start menu fit at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });
    test('the plain Start menu fits', async ({ page }) => {
      expect(page.viewportSize()).toEqual(vp);
      await seed(page, seedState());
      await page.goto(START);
      const begin = page.getByRole('button', { name: 'Begin a Nightly Séance' });
      await expect(begin).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expectInside(page, 'Begin a Nightly Séance', begin);
      await expectInside(page, 'Sound_Toggle', page.getByTestId('sound-toggle'));
      await expectNoVerticalScroll(page);
      const m = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
      }));
      expect(m.scrollHeight, `scrollHeight ${m.scrollHeight} of ${m.innerHeight}`).toBeLessThanOrEqual(m.innerHeight);
      expect(m.scrollWidth, `scrollWidth ${m.scrollWidth} of ${m.innerWidth}`).toBeLessThanOrEqual(m.innerWidth);
      expect(await findOverflow(page, vp.width)).toEqual([]);
      const slips = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.slip, .slip-primary'))
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => ({
            name: (el.textContent ?? '').trim().slice(0, 30),
            height: el.getBoundingClientRect().height,
          })),
      );
      expect(slips.length, 'no slips on the Start menu').toBeGreaterThan(0);
      for (const s of slips) {
        expect(s.height, `slip "${s.name}" is ${s.height}px high`).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator('.slip-primary')).toHaveCount(1);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const root = document.querySelector('main') as HTMLElement;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const own = Array.from(el.childNodes).some(
            (n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '',
          );
          if (!own) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const size = Number.parseFloat(cs.fontSize);
          if (size < 12) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 20)}" ${size}px`);
        }
        return out;
      });
      expect(small, 'text under 12 px').toEqual([]);
      await expectMoonInside(page, `start menu ${vp.width}`);
    });
  });
}
// The Start menu worst case (proof-pass Requirements 9.3, 9.4, 9.11): the longest finished notice, the
// "Move on" slip and the review slip with a 4-digit count (1200 restless ghosts across all three levels).
for (const vp of VIEWPORTS) {
  test.describe(`start menu worst case fit at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });
    test('the worst-case Start menu fits', async ({ page }) => {
      expect(page.viewportSize()).toEqual(vp);
      await openStartMenuWorstCase(page);
      for (const name of [
        'Begin a Nightly Séance',
        /^Starting level: 1/,
        /^Review restless ghosts \(\d{4}\)$/,
        'Move on to level 2',
        'Read the legend again',
        'How Cangjie works',
        'Graveyard',
        'Sources & licences',
      ]) {
        await expectInside(page, String(name), page.getByRole('button', { name }));
      }
      await expectInside(page, 'finished notice', page.getByText('You have met every ghost of level 1.'));
      await expectInside(page, 'Sound_Toggle', page.getByTestId('sound-toggle'));
      await expectInside(
        page,
        'sources hint',
        page.getByText('Where the words, strokes, codes and fonts come from.'),
      );
      await expectNoVerticalScroll(page);
      const m = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
      }));
      console.log(`start menu worst case at ${vp.width} x ${vp.height}: scrollHeight ${m.scrollHeight} of ${m.innerHeight}, scrollWidth ${m.scrollWidth}`);
      expect(m.scrollHeight, `scrollHeight ${m.scrollHeight} of ${m.innerHeight}`).toBeLessThanOrEqual(m.innerHeight);
      expect(m.scrollWidth, `scrollWidth ${m.scrollWidth} of ${m.innerWidth}`).toBeLessThanOrEqual(m.innerWidth);
      expect(await findOverflow(page, vp.width)).toEqual([]);
      const slips = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.slip, .slip-primary'))
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => ({ name: (el.textContent ?? '').trim().slice(0, 30), height: el.getBoundingClientRect().height })),
      );
      expect(slips.length, 'slips on the worst-case Start menu').toBe(8);
      for (const s of slips) {
        expect(s.height, `slip "${s.name}" is ${s.height}px high`).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator('.slip-primary')).toHaveCount(1);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        const root = document.querySelector('main') as HTMLElement;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
          if (!own) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const size = Number.parseFloat(cs.fontSize);
          if (size < 12) out.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 20)}" ${size}px`);
        }
        return out;
      });
      expect(small, 'text under 12 px').toEqual([]);
      await expectMoonInside(page, `start menu worst case ${vp.width}`);
    });
  });
}
