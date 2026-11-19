import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  START,
  findOverflow,
  levelOrder,
  regionPixels,
  seed,
  seedGraveyard,
  seedState,
  seedWithHistory,
  waitForLegendReveal,
} from './helpers';

// Slips (spec night-polish, Requirement 6): lift, glow, sink, the masked deckled edge, the focus
// ring, disabled, reduced motion and touch, on the start menu, the Graveyard and Sources & licences.
// Gap G3: the shortened press shadow is tested with a pointer press only. A keyboard press keeps
// the focus ring's box-shadow and still sinks 1 px.

const SLIPS = '.slip:visible, .slip-primary:visible';
const SETTLE_MS = 300; // the transitions run 200 ms
const EPS = 0.01;

interface Layer {
  r: number;
  g: number;
  b: number;
  a: number;
  y: number;
  blur: number;
  raw: string;
}

/** Splits a computed `box-shadow` at its top-level commas and reads colour, offset and blur. */
function parseShadow(value: string): Layer[] {
  if (value === 'none') return [];
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === ',' && depth === 0) {
      parts.push(value.slice(from, i).trim());
      from = i + 1;
    }
  }
  parts.push(value.slice(from).trim());
  return parts.map((raw) => {
    const m = raw.match(/^(.*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?$/);
    if (!m) throw new Error(`cannot parse the shadow layer "${raw}"`);
    const colour = m[1]!;
    let r: number;
    let g: number;
    let b: number;
    let a = 1;
    if (colour.startsWith('color(')) {
      const n = colour.replace(/^color\(\s*srgb\s+/, '').replace(/\)$/, '').split(/\s*\/\s*/);
      const [cr, cg, cb] = n[0]!.trim().split(/\s+/).map(Number);
      r = cr! * 255;
      g = cg! * 255;
      b = cb! * 255;
      if (n[1] !== undefined) a = Number(n[1]);
    } else {
      const n = colour.replace(/^rgba?\(/, '').replace(/\)$/, '').split(/[\s,/]+/).map(Number);
      [r, g, b] = [n[0]!, n[1]!, n[2]!];
      if (n[3] !== undefined) a = n[3];
    }
    return { r, g, b, a, y: Number(m[3]), blur: Number(m[4]), raw };
  });
}

const isBlack = (l: Layer): boolean => l.a > 0 && l.r < 3 && l.g < 3 && l.b < 3;
const isCandle = (l: Layer): boolean =>
  l.a > 0 && Math.abs(l.r - 240) <= 3 && Math.abs(l.g - 184) <= 3 && Math.abs(l.b - 102) <= 3;
const candleAlpha = (layers: Layer[]): number => Math.max(0, ...layers.filter(isCandle).map((l) => l.a));

interface Snapshot {
  top: number;
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
  transform: string;
  boxShadow: string;
  transitionDuration: string;
}

async function snap(slip: Locator): Promise<Snapshot> {
  return slip.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const h = el as HTMLElement;
    return {
      top: r.top,
      width: r.width,
      height: r.height,
      offsetTop: h.offsetTop,
      offsetLeft: h.offsetLeft,
      transform: cs.transform,
      boxShadow: cs.boxShadow,
      transitionDuration: cs.transitionDuration,
    };
  });
}

async function label(slip: Locator): Promise<string> {
  return ((await slip.innerText()).trim().replace(/\s+/g, ' ') || (await slip.getAttribute('aria-label')) || 'slip').slice(0, 40);
}

/**
 * Every visible Slip as a locator that stays on the same element, even while the test hides it
 * for a screenshot (an `nth()` of a `:visible` locator would move on to the next Slip).
 */
async function slipsOf(page: Page): Promise<Locator[]> {
  const count = await page.locator(SLIPS).evaluateAll((els) => {
    els.forEach((el, i) => el.setAttribute('data-slip-probe', String(i)));
    return els.length;
  });
  return Array.from({ length: count }, (_, i) => page.locator(`[data-slip-probe="${i}"]`));
}

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(SETTLE_MS);
}

/** Pointer away from every Slip, and the page at rest. */
async function rest(page: Page): Promise<void> {
  await page.mouse.move(1, 1);
  await settle(page);
}

// --- screens -----------------------------------------------------------------------------------

interface Screen {
  name: string;
  open: (page: Page) => Promise<void>;
  /** Number of `.slip-primary` the screen shows. */
  primaries: number;
}

const openMenu = async (page: Page): Promise<void> => {
  await seed(page, seedState());
  await page.goto(START);
  await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};
const openGraveyard = async (page: Page): Promise<void> => {
  await seedGraveyard(page);
};
const openSources = async (page: Page): Promise<void> => {
  await seed(page, seedState());
  await page.goto(START);
  await page.getByRole('button', { name: 'Sources & licences' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sources & licences' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};
const openIntro = async (page: Page): Promise<void> => {
  await seed(page, seedState({ introSeen: false }));
  await page.goto(START);
  await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
  await waitForLegendReveal(page);
};

// A met ghost (it has a history entry, due now): the Summon step shows no code, "Give up" moves on.
const openWrite = async (page: Page): Promise<void> => {
  await seed(page, seedWithHistory(levelOrder(1).slice(0, 12), 'struggled'));
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  const summon = page.getByRole('region', { name: 'Summon step' });
  await expect(summon, 'The Summon step did not appear for the met ghost.').toBeVisible({ timeout: 10_000 });
  await summon.getByRole('button', { name: 'Give up' }).click();
  const write = page.getByRole('region', { name: 'Write mode' });
  await expect(write).toBeVisible({ timeout: 10_000 });
  await expect(write.getByRole('button', { name: 'Give up' })).toBeEnabled({ timeout: 10_000 });
  await page.evaluate(() => document.fonts.ready);
};

// The art direction gives the Graveyard and Sources & licences no Primary_Action.
const SCREENS: Screen[] = [
  { name: 'start menu', open: openMenu, primaries: 1 },
  { name: 'Graveyard', open: openGraveyard, primaries: 0 },
  { name: 'Sources & licences', open: openSources, primaries: 0 },
  { name: 'Write step', open: openWrite, primaries: 0 },
];

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 320, height: 640 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`slips at ${viewport.width} px`, () => {
    test.use({ viewport });
    test.describe.configure({ timeout: 180_000 });

    for (const screen of SCREENS) {
      test.describe(screen.name, () => {
        test('lift, glow, sink, layout and height in every state', async ({ page }) => {
          await screen.open(page);
          const slips = await slipsOf(page);
          expect(slips.length, `${screen.name}: no Slip found`).toBeGreaterThan(0);
          for (const slip of slips) {
            const name = `${screen.name} "${await label(slip)}" at ${viewport.width}`;
            await slip.hover();
            await rest(page);
            const at = await snap(slip);
            await slip.hover();
            await settle(page);
            const hover = await snap(slip);
            await page.mouse.down();
            await settle(page);
            const pressed = await snap(slip);
            await page.mouse.move(1, 1); // release outside the Slip: no click
            await page.mouse.up();

            for (const [state, s] of [['rest', at], ['hover', hover], ['pressed', pressed]] as const) {
              expect(s.height, `${name}: height in ${state}`).toBeGreaterThanOrEqual(44);
              expect(s.width, `${name}: width in ${state}`).toBe(at.width);
              expect(s.offsetTop, `${name}: offsetTop in ${state}`).toBe(at.offsetTop);
              expect(s.offsetLeft, `${name}: offsetLeft in ${state}`).toBe(at.offsetLeft);
            }
            const lift = hover.top - at.top;
            expect(lift, `${name}: hover moves ${lift} px`).toBeGreaterThanOrEqual(-2 - EPS);
            expect(lift, `${name}: hover must lift by at least 1 px, moved ${lift}`).toBeLessThanOrEqual(-1 + EPS);
            const sink = pressed.top - at.top;
            expect(sink, `${name}: press sinks ${sink} px`).toBeGreaterThanOrEqual(-EPS);
            expect(sink, `${name}: press sinks ${sink} px`).toBeLessThanOrEqual(1 + EPS);

            // glow: a candle layer that rest lacks appears on hover
            const restLayers = parseShadow(at.boxShadow);
            const hoverLayers = parseShadow(hover.boxShadow);
            const restCandle = new Set(restLayers.filter(isCandle).map((l) => l.raw));
            expect(
              hoverLayers.filter(isCandle).some((l) => !restCandle.has(l.raw)),
              `${name}: no new candle layer on hover (rest "${at.boxShadow}", hover "${hover.boxShadow}")`,
            ).toBe(true);

            // pointer press (gap G3): a shorter black shadow and a weaker glow than on hover
            const pressedLayers = parseShadow(pressed.boxShadow);
            const restBlack = restLayers.find(isBlack);
            const pressedBlack = pressedLayers.find(isBlack);
            expect(restBlack, `${name}: rest has no black drop shadow`).toBeDefined();
            expect(pressedBlack, `${name}: pressed has no black drop shadow (${pressed.boxShadow})`).toBeDefined();
            expect(pressedBlack!.y, `${name}: pressed shadow offset`).toBeLessThan(restBlack!.y);
            expect(pressedBlack!.blur, `${name}: pressed shadow blur`).toBeLessThan(restBlack!.blur);
            expect(candleAlpha(pressedLayers), `${name}: pressed glow alpha`).toBeLessThan(candleAlpha(hoverLayers));
          }
        });

        test('keyboard focus lifts, keeps its glow and its ring is not clipped', async ({ page }) => {
          await screen.open(page);
          const slips = await slipsOf(page);
          for (const slip of slips) {
            const name = `${screen.name} "${await label(slip)}" at ${viewport.width}`;
            await slip.scrollIntoViewIfNeeded();
            await rest(page);
            const at = await snap(slip);
            await page.keyboard.press('Shift'); // keyboard modality, so a script focus is :focus-visible
            await slip.focus();
            await settle(page);
            expect(await slip.evaluate((el) => el.matches(':focus-visible')), `${name}: not :focus-visible`).toBe(true);
            const focus = await snap(slip);
            expect(focus.height, `${name}: height in focus`).toBeGreaterThanOrEqual(44);
            expect(focus.width, `${name}: width in focus`).toBe(at.width);
            expect(focus.offsetTop, `${name}: offsetTop in focus`).toBe(at.offsetTop);
            expect(focus.offsetLeft, `${name}: offsetLeft in focus`).toBe(at.offsetLeft);
            const lift = focus.top - at.top;
            expect(lift, `${name}: focus moves ${lift} px`).toBeGreaterThanOrEqual(-2 - EPS);
            expect(lift, `${name}: focus must lift by at least 1 px, moved ${lift}`).toBeLessThanOrEqual(-1 + EPS);
            const restCandle = new Set(parseShadow(at.boxShadow).filter(isCandle).map((l) => l.raw));
            expect(
              parseShadow(focus.boxShadow).filter(isCandle).some((l) => !restCandle.has(l.raw)),
              `${name}: no candle layer on focus (${focus.boxShadow})`,
            ).toBe(true);

            // ring pixels: just outside each side of the border box, with and without the Slip
            const box = await slip.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            });
            const withSlip = await page.screenshot({ animations: 'disabled' });
            await slip.evaluate((el) => ((el as HTMLElement).style.visibility = 'hidden'));
            const without = await page.screenshot({ animations: 'disabled' });
            await slip.evaluate((el) => ((el as HTMLElement).style.visibility = ''));
            const T = 6;
            const inset = 8; // keep clear of the rounded corners
            const sides = {
              top: { left: box.left + inset, right: box.right - inset, top: box.top - T, bottom: box.top - 0.5 },
              bottom: { left: box.left + inset, right: box.right - inset, top: box.bottom + 0.5, bottom: box.bottom + T },
              left: { left: box.left - T, right: box.left - 0.5, top: box.top + inset, bottom: box.bottom - inset },
              right: { left: box.right + 0.5, right: box.right + T, top: box.top + inset, bottom: box.bottom - inset },
            };
            const names = Object.keys(sides) as (keyof typeof sides)[];
            const a = await regionPixels(page, withSlip, names.map((n) => sides[n]));
            const b = await regionPixels(page, without, names.map((n) => sides[n]));
            names.forEach((side, i) => {
              expect(a[i]!.length, `${name}: the ${side} strip lies outside the viewport`).toBeGreaterThan(0);
              let most = 0;
              a[i]!.forEach((p, k) => {
                const q = b[i]![k]!.rgb;
                most = Math.max(most, Math.abs(p.rgb[0] - q[0]) + Math.abs(p.rgb[1] - q[1]) + Math.abs(p.rgb[2] - q[2]));
              });
              expect(most, `${name}: nothing is painted outside the ${side} side (ring clipped?)`).toBeGreaterThanOrEqual(40);
            });
            await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          }
        });

        test('findOverflow is clean at rest and with a Slip hovered', async ({ page }) => {
          await screen.open(page);
          await rest(page);
          expect(await findOverflow(page, viewport.width), `${screen.name}: overflow at rest`).toEqual([]);
          const slips = await slipsOf(page);
          for (const slip of [slips[0]!, slips[slips.length - 1]!]) {
            await slip.hover();
            await settle(page);
            expect(
              await findOverflow(page, viewport.width),
              `${screen.name}: overflow with "${await label(slip)}" hovered`,
            ).toEqual([]);
          }
        });
      });
    }
  });
}

// --- the Sound_Toggle (night-sounds 10.4) ------------------------------------------------------

for (const viewport of VIEWPORTS) {
  test.describe(`the Sound_Toggle at ${viewport.width} px`, () => {
    test.use({ viewport });

    test('is a Slip: at least 44 px, no slip-primary, lifts, glows and sinks', async ({ page }) => {
      await openMenu(page);
      const toggle = page.getByTestId('sound-toggle');
      await expect(toggle).toHaveCount(1);
      await expect(toggle).toHaveClass(/(^|\s)slip(\s|$)/);
      await expect(toggle).not.toHaveClass(/slip-primary/);
      await toggle.hover();
      await rest(page);
      const at = await snap(toggle);
      await toggle.hover();
      await settle(page);
      const hover = await snap(toggle);
      await page.mouse.down();
      await settle(page);
      const pressed = await snap(toggle);
      await page.mouse.move(1, 1); // release outside the Slip: no click
      await page.mouse.up();
      expect(at.height, 'toggle height').toBeGreaterThanOrEqual(44);
      expect(at.width, 'toggle width').toBeGreaterThanOrEqual(44);
      const lift = hover.top - at.top;
      expect(lift, `hover moves ${lift} px`).toBeGreaterThanOrEqual(-2 - EPS);
      expect(lift, `hover must lift by at least 1 px, moved ${lift}`).toBeLessThanOrEqual(-1 + EPS);
      const sink = pressed.top - at.top;
      expect(sink, `press sinks ${sink} px`).toBeGreaterThanOrEqual(-EPS);
      expect(sink, `press sinks ${sink} px`).toBeLessThanOrEqual(1 + EPS);
      const restCandle = new Set(parseShadow(at.boxShadow).filter(isCandle).map((l) => l.raw));
      expect(
        parseShadow(hover.boxShadow).filter(isCandle).some((l) => !restCandle.has(l.raw)),
        `no new candle layer on hover (${hover.boxShadow})`,
      ).toBe(true);
      expect(await page.locator('.slip-primary:visible').count(), 'the menu keeps one Primary_Slip').toBe(1);
    });
  });
}

// --- screens and shapes, at 375 ----------------------------------------------------------------

test.describe('one Primary_Slip per screen, no clip, one mask', () => {
  test.use({ viewport: VIEWPORTS[0]! });
  test.describe.configure({ timeout: 120_000 });

  test('at most one .slip-primary on a screen, exactly the expected count', async ({ browser }) => {
    for (const screen of [{ name: 'intro', open: openIntro, primaries: 1 }, ...SCREENS]) {
      // a fresh context per screen: each screen has its own seed
      const context = await browser.newContext({ viewport: VIEWPORTS[0]! });
      const page = await context.newPage();
      await screen.open(page);
      const count = await page.locator('.slip-primary:visible').count();
      expect(count, `${screen.name}: ${count} Primary_Slips`).toBe(screen.primaries);
      expect(count, `${screen.name}: more than one Primary_Slip`).toBeLessThanOrEqual(1);
      await context.close();
    }
  });

  test('clip-path is none, overflow is visible and the mask is one string', async ({ page }) => {
    const masks = new Set<string>();
    let seen = 0;
    for (const screen of SCREENS) {
      await screen.open(page);
      const rows = await page.locator(SLIPS).evaluateAll((els) =>
        els.map((el) => {
          const cs = getComputedStyle(el);
          const before = getComputedStyle(el, '::before');
          return {
            clipPath: cs.clipPath,
            overflow: cs.overflow,
            overflowX: cs.overflowX,
            overflowY: cs.overflowY,
            mask: `${before.getPropertyValue('mask-image')} | ${before.getPropertyValue('mask-size')} | ${before.getPropertyValue('mask-position')} | ${before.getPropertyValue('mask-repeat')}`,
          };
        }),
      );
      for (const row of rows) {
        seen += 1;
        expect(row.clipPath, `${screen.name}: clip-path`).toBe('none');
        expect(row.overflow, `${screen.name}: overflow`).toBe('visible');
        expect(row.overflowX).toBe('visible');
        expect(row.overflowY).toBe('visible');
        expect(row.mask, `${screen.name}: the ::before has no mask`).toContain('url(');
        masks.add(row.mask);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect([...masks].length, `${masks.size} different masks`).toBe(1);
  });

  test('a disabled Slip keeps transform none and its rest shadow under hover and press', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/characters-level2.json', async (route) => {
      await gate;
      await route.continue();
    });
    await seedGraveyard(page);
    const level1 = page.getByRole('button', { name: /^Level 1/ });
    const level3 = page.getByRole('button', { name: /^Level 3/ });
    await level3.hover();
    await rest(page);
    const enabledRest = (await snap(level3)).boxShadow;

    await page.getByRole('button', { name: /^Level 2/ }).click();
    await expect(level1).toBeDisabled();
    await expect(level3).toBeDisabled();
    try {
      await rest(page);
      const disabledRest = await snap(level3);
      expect(disabledRest.boxShadow, 'disabled rest shadow').toBe(enabledRest);
      expect(disabledRest.transform).toBe('none');
      await level3.hover();
      await settle(page);
      const hover = await snap(level3);
      expect(hover.transform, 'disabled under hover').toBe('none');
      expect(hover.boxShadow, 'disabled under hover').toBe(enabledRest);
      await page.mouse.down();
      await settle(page);
      const pressed = await snap(level3);
      expect(pressed.transform, 'disabled while pressed').toBe('none');
      expect(pressed.boxShadow, 'disabled while pressed').toBe(enabledRest);
      expect(pressed.height).toBeGreaterThanOrEqual(44);
      await page.mouse.up();
    } finally {
      release();
    }
  });
});

// --- reduced motion ----------------------------------------------------------------------------

test.describe('reduced motion', () => {
  test.use({ viewport: VIEWPORTS[0]!, reducedMotion: 'reduce' });

  test('no transform and no transition in hover, focus and press, the static end states stay', async ({ page }) => {
    await openMenu(page);
    const slips = [
      page.getByRole('button', { name: 'Begin a Nightly Séance' }),
      page.getByRole('button', { name: 'Graveyard' }),
    ];
    for (const slip of slips) {
      const name = await label(slip);
      await slip.hover();
      await rest(page);
      const at = await snap(slip);
      expect(at.transitionDuration, `${name}: rest transition`).toBe('0s');
      await slip.hover();
      await settle(page);
      const hover = await snap(slip);
      expect(hover.transform, `${name}: hover transform`).toBe('none');
      expect(hover.transitionDuration, `${name}: hover transition`).toBe('0s');
      expect(hover.boxShadow, `${name}: hover shadow equals rest`).not.toBe(at.boxShadow);
      expect(hover.top, `${name}: hover moved`).toBe(at.top);
      await page.mouse.down();
      await settle(page);
      const pressed = await snap(slip);
      expect(pressed.transform, `${name}: pressed transform`).toBe('none');
      expect(pressed.transitionDuration, `${name}: pressed transition`).toBe('0s');
      const restBlack = parseShadow(at.boxShadow).find(isBlack)!;
      const pressedBlack = parseShadow(pressed.boxShadow).find(isBlack)!;
      expect(pressedBlack.blur, `${name}: pressed shadow stays shorter`).toBeLessThan(restBlack.blur);
      await page.mouse.move(1, 1);
      await page.mouse.up();
      await rest(page);
      await page.keyboard.press('Shift');
      await slip.focus();
      await settle(page);
      expect(await slip.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
      const focus = await snap(slip);
      expect(focus.transform, `${name}: focus transform`).toBe('none');
      expect(focus.transitionDuration, `${name}: focus transition`).toBe('0s');
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    }
  });
});

// --- touch -------------------------------------------------------------------------------------

test.describe('touch device', () => {
  test.use({ viewport: VIEWPORTS[0]!, hasTouch: true, isMobile: true });

  test('a tapped Slip shows its rest box-shadow', async ({ page }) => {
    await openMenu(page);
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches), 'the context reports hover').toBe(false);
    // keep the tap from navigating away
    await page.evaluate(() => window.addEventListener('click', (e) => e.stopPropagation(), true));
    for (const slip of [
      page.getByRole('button', { name: 'Begin a Nightly Séance' }),
      page.getByRole('button', { name: 'Graveyard' }),
    ]) {
      const name = await label(slip);
      await settle(page);
      const at = await snap(slip);
      await slip.tap();
      await settle(page);
      // the press look returns to rest through the 200 ms transition: wait for it to end
      await slip.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      await settle(page);
      const tapped = await snap(slip);
      expect(tapped.boxShadow, `${name}: tapped shadow`).toBe(at.boxShadow);
      expect(tapped.transform, `${name}: tapped transform`).toBe('none');
      expect(tapped.top, `${name}: tapped position`).toBe(at.top);
    }
  });
});
