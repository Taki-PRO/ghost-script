import { expect, test, type Page } from '@playwright/test';
import {
  START,
  bandPixels,
  discExtent,
  findOverflow,
  luminance,
  moonDisc,
  openStartMenuWorstCase,
  reachFullSummary,
  reachSummary,
  seed,
  seedGraveyard,
  seedState,
} from './helpers';

// Sky_Cap (spec night-polish, Requirement 1): below 992 px the 76 px band above the sticky
// header shows only the night sky and the Moon at every scroll offset. The reference is the
// true sky at scroll 0, captured with the cap hidden by an injected style, so the same code
// runs on a build that has no cap. Reduced motion keeps the mist and the wisp still.

test.use({ reducedMotion: 'reduce' });

const BAND = 76; // --moon-room in CSS px below 992 px
const MIN_SCROLL = 2 * BAND;
const TOLERANCE = 6; // per RGB channel
const FALLBACK_HEIGHT = 420;
const FALLBACK_HEIGHT_LAST = 280;
const FALLBACK_HEIGHT_FINAL = 200;
// Recalibrated for the new paper Moon of task 6.2 (approved by the human). Measured along the
// centre row at 375 and 320, cap shown and hidden: the paper halo next to the disc is 0.0061 to
// 0.0083 (0.008 sat inside the grain noise and read the halo as disc), the disc edge pixel about
// 0.02 and the disc interior 0.08 to 0.29. The scan uses 0.015, between halo and edge; the edges
// are still held to 1 px of the scroll-0 reference and the diameter to 64 +- 2 px.
const DISC_THRESHOLD = 0.015;

type Opener = (page: Page) => Promise<void>;
interface Screen {
  readonly name: string;
  readonly open: Opener;
  readonly hasHeader: boolean;
  readonly fallback: boolean;
  readonly slow: boolean;
  /** Widths to test; every width when absent. */
  readonly widths?: readonly number[];
}

const openSources: Opener = async (page) => {
  await seed(page, seedState());
  await page.goto(START);
  await page.getByRole('button', { name: 'Sources & licences' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sources & licences' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};

const SCREENS: readonly Screen[] = [
  {
    name: 'Graveyard',
    open: async (page) => {
      // A restless ghost at index 120 of the learning order keeps the shown rows as tall as the test needs.
      await seedGraveyard(page, { farMetIndex: 120 });
    },
    hasHeader: true,
    fallback: false,
    slow: false,
  },
  { name: 'Sources & licences', open: openSources, hasHeader: true, fallback: false, slow: false },
  { name: 'Summary', open: reachSummary, hasHeader: false, fallback: true, slow: true },
  { name: 'Summary (10 ghosts)', open: reachFullSummary, hasHeader: false, fallback: true, slow: true },
  {
    name: 'Level screen',
    open: async (page) => {
      await seed(page, seedState());
      await page.goto(START);
      await page.getByRole('button', { name: /^Starting level: 1/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Where will you begin?' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
    },
    hasHeader: false,
    fallback: true,
    slow: false,
  },
  // Proof-pass Requirement 9.13: the Start menu in its worst case (tested at 375 x 812 only, see below).
  { name: 'Start menu worst case', open: openStartMenuWorstCase, hasHeader: false, fallback: true, slow: false, widths: [375] },
];

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 320, height: 640 },
] as const;

const HEADER = 'header.sticky-below-moon';

async function nextFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

async function scrollRange(page: Page): Promise<{ max: number; scrollHeight: number; innerHeight: number }> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => ({
    max: document.documentElement.scrollHeight - window.innerHeight,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
  }));
}

/** Sample points of the band: 5 columns by 3 rows, minus those within 7 rem of the Moon centre. */
function samplePoints(
  width: number,
  cx: number,
  cy: number,
  rem: number,
): { points: { x: number; y: number }[]; columns: number; rows: number } {
  const xs = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.floor(width * f));
  const ys = [0.15, 0.5, 0.85].map((f) => Math.floor(BAND * f));
  const points: { x: number; y: number }[] = [];
  const keptColumns = new Set<number>();
  for (const x of xs) {
    for (const y of ys) {
      if (Math.hypot(x - cx, y - cy) <= 7 * rem) continue;
      points.push({ x, y });
      keptColumns.add(x);
    }
  }
  return { points, columns: keptColumns.size, rows: ys.length };
}

async function describeBeneath(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ({ x, y }) => {
      const names = document
        .elementsFromPoint(x, y)
        .filter((el) => !el.matches('html, body, #root, .sky-cap'))
        .slice(0, 2)
        .map((el) => {
          const label = el.getAttribute('aria-label');
          const text = (el.textContent ?? '').trim().slice(0, 20);
          return `${el.tagName.toLowerCase()}${label ? `[aria-label="${label}"]` : ''}${text ? ` "${text}"` : ''}`;
        });
      return names.length > 0 ? names.join(' over ') : 'nothing but the page';
    },
    { x, y },
  );
}

for (const vp of VIEWPORTS) {
  test.describe(`sky cap at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    for (const screen of SCREENS.filter((s) => s.widths === undefined || s.widths.includes(vp.width))) {
      test(`${screen.name}: the band holds the night sky and the Moon at every offset`, async ({ page }) => {
        test.setTimeout(screen.slow ? 480_000 : 90_000);
        await screen.open(page);

        let viewport: { width: number; height: number } = { width: vp.width, height: vp.height };
        let range = await scrollRange(page);
        if (range.max < MIN_SCROLL && screen.fallback) {
          viewport = { width: vp.width, height: FALLBACK_HEIGHT };
          await page.setViewportSize(viewport);
          range = await scrollRange(page);
          if (range.max < MIN_SCROLL) {
            // A test device only, not a supported layout.
            viewport = { width: vp.width, height: FALLBACK_HEIGHT_LAST };
            await page.setViewportSize(viewport);
            range = await scrollRange(page);
            if (range.max < MIN_SCROLL) {
              // A test device only, not a supported layout.
              viewport = { width: vp.width, height: FALLBACK_HEIGHT_FINAL };
              await page.setViewportSize(viewport);
              range = await scrollRange(page);
            }
          }
        }
        const label = `${screen.name} at ${viewport.width} x ${viewport.height}`;
        expect(
          range.max,
          `${label}: not scrollable (scrollHeight ${range.scrollHeight}, innerHeight ${range.innerHeight}); ` +
            `the Moon_Room check needs at least ${MIN_SCROLL} px`,
        ).toBeGreaterThanOrEqual(MIN_SCROLL);

        const disc = await moonDisc(page);
        const rem = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
        const { points, columns, rows } = samplePoints(viewport.width, disc.cx, disc.cy, rem);
        expect(columns, `${label}: fewer than 3 sample columns remain`).toBeGreaterThanOrEqual(3);
        expect(points.length, `${label}: fewer than ${3 * rows} sample points remain`).toBeGreaterThanOrEqual(3 * rows);

        // Reference: the true sky at scroll 0, with any cap hidden.
        await page.evaluate(() => window.scrollTo(0, 0));
        await nextFrames(page);
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.id = 'no-cap';
          style.textContent = '.sky-cap{display:none!important}';
          document.head.appendChild(style);
        });
        await nextFrames(page);
        const reference = await bandPixels(page, viewport.width, BAND, points);
        const refDisc = await discExtent(page, reference.png, Math.round(disc.cy), disc.cx, 3 * rem, DISC_THRESHOLD);
        await page.evaluate(() => document.getElementById('no-cap')?.remove());
        await nextFrames(page);
        expect(refDisc, `${label}: no Moon disc found at scroll 0`).not.toBeNull();

        const offsets = [0, Math.round(range.max / 3), Math.round((2 * range.max) / 3), range.max];
        for (const offset of offsets) {
          await page.evaluate((y) => window.scrollTo(0, y), offset);
          await nextFrames(page);
          const at = `${label}, offset ${offset}`;
          const band = await bandPixels(page, viewport.width, BAND, points);

          // Sky colour against the scroll-0 reference.
          const bad: string[] = [];
          let worst = 0;
          let first: { x: number; y: number } | undefined;
          band.colours.forEach((rgb, i) => {
            const ref = reference.colours[i]!;
            const delta = Math.max(...rgb.map((c, k) => Math.abs(c - ref[k]!)));
            if (delta > TOLERANCE) {
              const p = points[i]!;
              if (!first) first = p;
              worst = Math.max(worst, delta);
              bad.push(`(${p.x}, ${p.y}) rgb(${rgb.join(', ')}) vs rgb(${ref.join(', ')}) delta ${delta}`);
            }
          });
          const firstPoint = first as { x: number; y: number } | undefined;
          const beneath = firstPoint ? await describeBeneath(page, firstPoint.x, firstPoint.y) : '';
          expect
            .soft(
              bad.length,
              `${at}: ${bad.length} of ${points.length} points differ from the Night_Sky by more than ${TOLERANCE} ` +
                `(worst delta ${worst}); first: point ${bad[0] ?? ''}; beneath: ${beneath}`,
            )
            .toBe(0);

          // The Moon keeps its place and size, and its contrast with the sky.
          const extent = await discExtent(page, band.png, Math.round(disc.cy), disc.cx, 3 * rem, DISC_THRESHOLD);
          if (extent && refDisc) {
            expect.soft(Math.abs(extent.left - refDisc.left), `${at}: Moon left edge ${extent.left} vs ${refDisc.left}`).toBeLessThanOrEqual(1);
            expect.soft(Math.abs(extent.right - refDisc.right), `${at}: Moon right edge ${extent.right} vs ${refDisc.right}`).toBeLessThanOrEqual(1);
            expect.soft(Math.abs(extent.diameter - 4 * rem), `${at}: Moon diameter ${extent.diameter}`).toBeLessThanOrEqual(2);
          } else {
            expect.soft(extent, `${at}: no Moon disc found`).not.toBeNull();
          }
          const [centre, sky] = (
            await bandPixels(page, viewport.width, BAND, [
              { x: Math.round(disc.cx), y: Math.round(disc.cy) },
              { x: Math.round(disc.cx - 8 * rem), y: Math.round(disc.cy) },
            ])
          ).colours;
          const ratio = (luminance(centre!) + 0.05) / (luminance(sky!) + 0.05);
          expect
            .soft(ratio, `${at}: Moon centre rgb(${centre!.join(', ')}) vs sky rgb(${sky!.join(', ')}), ratio ${ratio.toFixed(2)}`)
            .toBeGreaterThanOrEqual(1.2);

          // The sticky header keeps its place and stays visible.
          if (screen.hasHeader) {
            const header = page.locator(HEADER);
            const top = await header.evaluate((el) => el.getBoundingClientRect().top);
            // At offset 0 the header sits at its natural place, at or below the band; once the page has
            // scrolled it is stuck at the band's bottom edge.
            if (offset === 0) expect.soft(top, `${at}: header top ${top}, expected at least ${BAND - 1}`).toBeGreaterThanOrEqual(BAND - 1);
            else expect.soft(Math.abs(top - BAND), `${at}: header top ${top}, expected ${BAND}`).toBeLessThanOrEqual(1);
            const visible = await header.evaluate((el) => {
              const r = el.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return hit !== null && (hit === el || el.contains(hit));
            });
            expect.soft(visible, `${at}: the header is covered at its centre point`).toBe(true);
          }
        }

        // No horizontal overflow, at rest and scrolled to the end.
        expect(await findOverflow(page, viewport.width), `${label}: horizontal overflow`).toEqual([]);
      });
    }

    for (const screen of SCREENS.filter((s) => s.hasHeader)) {
      test(`${screen.name}: the cap is hidden, takes no focus, and every focused control clears the header`, async ({
        page,
      }) => {
        await screen.open(page);
        const label = `${screen.name} at ${vp.width} x ${vp.height}`;

        const cap = page.getByTestId('sky-cap');
        await expect(cap, `${label}: no .sky-cap element`).toHaveCount(1);
        await expect(cap, `${label}: the cap is not aria-hidden`).toHaveAttribute('aria-hidden', 'true');
        expect(await cap.getAttribute('tabindex'), `${label}: the cap has a tabindex`).toBeNull();

        const stops = async (): Promise<{ order: string[]; clearance: string[] }> => {
          const count = await page.evaluate(
            () =>
              document.querySelectorAll('a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')
                .length,
          );
          const order: string[] = [];
          const clearance: string[] = [];
          for (let i = 0; i < count + 1; i += 1) {
            await page.keyboard.press('Tab');
            await nextFrames(page);
            const info = await page.evaluate((header) => {
              const el = document.activeElement;
              if (!el || el === document.body) return null;
              const h = document.querySelector(header)?.getBoundingClientRect();
              const r = el.getBoundingClientRect();
              const name = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}"`;
              const inHeader = document.querySelector(header)?.contains(el) ?? false;
              return { name, top: r.top, headerBottom: h ? h.bottom : 0, inHeader };
            }, HEADER);
            if (!info) continue;
            order.push(info.name);
            if (!info.inHeader && info.top < info.headerBottom - 0.5) {
              clearance.push(`${info.name}: top ${Math.round(info.top)} is above the header bottom ${Math.round(info.headerBottom)}`);
            }
          }
          return { order, clearance };
        };

        const withCap = await stops();
        expect(withCap.clearance, `${label}: focused controls hidden behind the header`).toEqual([]);

        await screen.open(page);
        await page.evaluate(() => document.querySelector('.sky-cap')?.remove());
        const withoutCap = await stops();
        expect(withCap.order, `${label}: the Tab order changes with the cap`).toEqual(withoutCap.order);
      });
    }
  });
}

test.describe('sky cap at 1024 x 768', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  for (const screen of SCREENS.filter((s) => s.hasHeader)) {
    test(`${screen.name}: the header sticks at the top and the cap has no height`, async ({ page }) => {
      await screen.open(page);
      const range = await scrollRange(page);
      const label = `${screen.name} at 1024 x 768`;
      expect(range.max, `${label}: not scrollable (scrollHeight ${range.scrollHeight}, innerHeight ${range.innerHeight})`).toBeGreaterThan(0);
      for (const offset of [0, Math.round(range.max / 2), range.max]) {
        await page.evaluate((y) => window.scrollTo(0, y), offset);
        await nextFrames(page);
        const top = await page.locator(HEADER).evaluate((el) => el.getBoundingClientRect().top);
        // At offset 0 the header sits at its natural place (below the page padding); once scrolled it sticks at 0.
        if (offset === 0) expect.soft(top, `${label}, offset ${offset}: header top ${top}, expected at least 0`).toBeGreaterThanOrEqual(-1);
        else expect.soft(Math.abs(top), `${label}, offset ${offset}: header top ${top}, expected 0`).toBeLessThanOrEqual(1);
      }
      const heights = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.sky-cap')).map((el) => getComputedStyle(el).height),
      );
      expect.soft(heights.length, `${label}: expected exactly one .sky-cap element`).toBe(1);
      for (const h of heights) expect.soft(h, `${label}: the cap has a painted height`).toBe('0px');
    });
  }
});
