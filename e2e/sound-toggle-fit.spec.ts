import { expect, test, type Browser, type Page } from '@playwright/test';
import { moonRoomPx } from '../app/src/engine/moonRoom';
import {
  START,
  boxGap,
  expectMoonInside,
  moonIntruders,
  reachSummary,
  seed,
  seedState,
  soundToggle,
  togglePlacement,
  type Box,
} from './helpers';

// Sound_Toggle placement and fit (spec night-sounds, task 10.5; Requirements 14.1 to 14.7, 14.9,
// 14.10, 14.11, 21.10). Nothing here reads an answer: the séance is walked with "Give up".
const WIDTHS = [
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
  { width: 320, height: 640 },
  { width: 992, height: 768 },
  { width: 991, height: 768 },
] as const;
const SIZE = 44;
const GAP = 16;
const TOLERANCE = 0.5;

async function toggleBox(page: Page): Promise<Box> {
  await expect(soundToggle(page)).toBeVisible();
  return (await togglePlacement(page)).toggle;
}

/** Boxes of every visible control and every visible text run (Range rects), except the toggle. */
async function otherBoxes(page: Page): Promise<{ name: string; box: Box }[]> {
  return page.evaluate(() => {
    const out: { name: string; box: { left: number; top: number; right: number; bottom: number } }[] = [];
    const toggle = document.querySelector('[data-testid="sound-toggle"]');
    const visible = (el: Element): boolean => {
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const push = (name: string, r: DOMRect): void => {
      if (r.width === 0 || r.height === 0) return;
      out.push({ name, box: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
    };
    const controls = 'button, a, input, select, textarea, [role="button"], [data-testid="ink-surface"]';
    for (const el of Array.from(document.body.querySelectorAll(controls))) {
      if (el === toggle || !visible(el)) continue;
      push(`control ${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 30)}"`, el.getBoundingClientRect());
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const parent = node.parentElement;
      if (text === '' || !parent || toggle?.contains(parent) || !visible(parent)) continue;
      if (parent.closest('script, style, noscript')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) push(`text "${text.slice(0, 30)}"`, r);
    }
    return out;
  });
}

/** The toggle is 44 x 44, meets no control or text, and nothing lies on the Moon. */
async function expectFit(page: Page, view: string, reference: Box): Promise<void> {
  const box = await toggleBox(page);
  expect(box.right - box.left, `${view}: toggle width`).toBeCloseTo(SIZE, 1);
  expect(box.bottom - box.top, `${view}: toggle height`).toBeCloseTo(SIZE, 1);
  for (const key of ['left', 'top', 'right', 'bottom'] as const) {
    expect(box[key], `${view}: toggle ${key} differs from the first screen`).toBeCloseTo(reference[key], 1);
  }
  const meets = (await otherBoxes(page))
    .filter(({ box: b }) => boxGap(box, b) < 0)
    .map(({ name, box: b }) => `${name} ${Math.round(b.left)},${Math.round(b.top)} to ${Math.round(b.right)},${Math.round(b.bottom)}`);
  expect(meets, `${view}: the toggle meets other content`).toEqual([]);
  expect(await moonIntruders(page), `${view}: something lies inside the moon disc`).toEqual([]);
}

/** Runs `body` on a fresh context (so each screen has its own save and viewport). */
async function onScreen(
  browser: Browser,
  vp: { width: number; height: number },
  state: ReturnType<typeof seedState>,
  body: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await seed(page, state);
    await page.goto(START);
    await body(page);
  } finally {
    await context.close();
  }
}

async function expectPlacement(page: Page, width: number): Promise<void> {
  const { toggle, moon, gapToMoon } = await togglePlacement(page);
  expect(gapToMoon, `gap to the moon at ${width} px`).toBeCloseTo(GAP, 0);
  if (width < 992) {
    expect(moon.left - toggle.right, 'right edge 16 px left of the moon').toBeCloseTo(GAP, 0);
  } else {
    expect(toggle.top - moon.bottom, 'top edge 16 px below the moon').toBeCloseTo(GAP, 0);
    expect((toggle.left + toggle.right) / 2, 'centred under the moon').toBeCloseTo(moon.cx, 0);
  }
}

async function expectStickyHeader(page: Page, width: number, view: string, back: RegExp): Promise<void> {
  expect(await page.evaluate(() => window.scrollY), `${view}: scroll`).toBe(0);
  const header = page.locator('header.sticky').first();
  const top = await header.evaluate((el) => el.getBoundingClientRect().top);
  expect(top, `${view}: the sticky header starts below the Top_Room`).toBeGreaterThanOrEqual(moonRoomPx(width) - TOLERANCE);
  const button = page.getByRole('button', { name: back });
  await expect(button).toBeVisible();
  const covered = await button.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const points = [
      [r.left + 2, r.top + 2],
      [r.right - 2, r.top + 2],
      [r.left + 2, r.bottom - 2],
      [r.right - 2, r.bottom - 2],
      [(r.left + r.right) / 2, (r.top + r.bottom) / 2],
    ] as const;
    return points.filter(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !hit || !(el === hit || el.contains(hit));
    }).length;
  });
  expect(covered, `${view}: points of the Back button covered by something else`).toBe(0);
}

for (const vp of WIDTHS) {
  test.describe(`sound toggle fit at ${vp.width} x ${vp.height}`, () => {
    test('every screen but the summary', async ({ browser }) => {
      test.setTimeout(180_000);
      let reference: Box | null = null;
      const check = async (page: Page, view: string): Promise<void> => {
        await page.evaluate(() => document.fonts.ready);
        reference ??= await toggleBox(page);
        await expectFit(page, view, reference);
        await expectPlacement(page, vp.width);
      };
      const menuOpen = async (page: Page, name: string | RegExp): Promise<void> => {
        await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
        await page.getByRole('button', { name }).click();
      };

      // Intro (the first screen: its box is the reference).
      await onScreen(browser, vp, seedState({ introSeen: false }), async (page) => {
        await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
        await check(page, 'intro');
        await expectMoonInside(page, 'intro');
      });
      // Level screen.
      await onScreen(browser, vp, seedState(), async (page) => {
        await menuOpen(page, /^Starting level:/);
        await expect(page.getByRole('heading', { level: 1, name: 'Where will you begin?' })).toBeVisible();
        await check(page, 'level');
      });
      // Start menu: the Ambience_Toggle lives on the Graveyard only, so it is absent here.
      await onScreen(browser, vp, seedState(), async (page) => {
        await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
        await expect(page.getByTestId('ambience-toggle')).toHaveCount(0);
        await check(page, 'menu');
      });
      // Graveyard (with the Ambience_Toggle) and its sticky header.
      await onScreen(browser, vp, seedState(), async (page) => {
        await menuOpen(page, 'Graveyard');
        await expect(page.getByRole('heading', { level: 1, name: 'Graveyard' })).toBeVisible();
        await expect(page.getByTestId('ambience-toggle')).toBeVisible();
        await check(page, 'graveyard');
        await expectStickyHeader(page, vp.width, 'graveyard', /^Back to menu$/);
      });
      // Sources & licences and its sticky header.
      await onScreen(browser, vp, seedState(), async (page) => {
        await menuOpen(page, 'Sources & licences');
        await expect(page.getByRole('heading', { level: 1, name: 'Sources & licences' })).toBeVisible();
        await check(page, 'sources');
        await expectStickyHeader(page, vp.width, 'sources', /^Back to menu$/);
      });
      // Cangjie guide.
      await onScreen(browser, vp, seedState({ cangjieIntroSeen: false }), async (page) => {
        await menuOpen(page, 'How Cangjie works');
        await expect(page.getByRole('heading', { level: 1, name: 'How Cangjie works' })).toBeVisible();
        await check(page, 'guide');
      });
      // Séance: Summon, then Write.
      await onScreen(browser, vp, seedState(), async (page) => {
        await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
        const summon = page.getByRole('region', { name: 'Summon step' });
        await expect(summon).toBeVisible({ timeout: 10_000 });
        const heading = page.getByRole('heading', { name: /^Ghost \d+ of \d+$/ });
        await expect(heading).toBeVisible();
        await check(page, 'summon');
        await expectMoonInside(page, 'summon');
        const box = await toggleBox(page);
        for (const [name, locator] of [
          ['Leave séance', page.getByRole('button', { name: 'Leave séance' })],
          ['heading', heading],
        ] as const) {
          const b = await locator.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          });
          expect(boxGap(box, b), `summon: the toggle meets ${name}`).toBeGreaterThanOrEqual(0);
        }
        await summon.getByRole('button', { name: 'Give up' }).click();
        await expect(page.getByRole('region', { name: 'Write mode' })).toBeVisible({ timeout: 10_000 });
        await check(page, 'write');
        await expectMoonInside(page, 'write');
      });
    });

    test('summary', async ({ browser }) => {
      test.setTimeout(240_000);
      let reference: Box | null = null;
      await onScreen(browser, vp, seedState({ introSeen: false }), async (page) => {
        await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
        reference = await toggleBox(page);
      });
      const context = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
      const page = await context.newPage();
      try {
        await reachSummary(page);
        expect(reference, 'no reference box').not.toBeNull();
        await expectFit(page, 'summary', reference as unknown as Box);
        await expectPlacement(page, vp.width);
        await expectMoonInside(page, 'summary');
      } finally {
        await context.close();
      }
    });
  });
}

test.describe('sound toggle on the loading and error screens', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('absent while the ghosts load', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/data/characters.json*', async (route) => {
      await gate;
      await route.continue();
    });
    await seed(page, seedState());
    await page.goto(START, { waitUntil: 'commit' });
    await expect(page.getByText('Summoning the ghosts…')).toBeVisible();
    await expect(soundToggle(page)).toHaveCount(0);
    release();
    await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
    await expect(soundToggle(page)).toBeVisible();
  });
  test('absent when the ghosts cannot be summoned', async ({ page }) => {
    await page.route('**/data/characters.json*', (route) => route.abort());
    await seed(page, seedState());
    await page.goto(START);
    await expect(page.getByRole('heading', { name: 'The ghosts could not be summoned' })).toBeVisible();
    await expect(soundToggle(page)).toHaveCount(0);
  });
});
