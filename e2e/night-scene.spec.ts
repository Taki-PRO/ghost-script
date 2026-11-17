import { expect, test, type Page } from '@playwright/test';
import {
  START,
  luminance,
  moonDisc,
  pixelsAt,
  seed,
  seedGraveyard,
  seedState,
  waitForInkReveal,
  type Rgb,
} from './helpers';

// Night scene (Requirements 24.7, 24.8 and 25.3): the sky, grain and mist cover the full
// height of long screens, and the Moon shows its shade. Pixels come from a Full_Page_Capture
// taken from scroll 0, decoded with `pixelsAt`. The mist drifts, so only the left strip and
// a few points are sampled, never the mist itself.

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1024, height: 768 },
] as const;

const BACKGROUND: Rgb = [14, 15, 19]; // `background` token #0e0f13
const STRIP_X = 3;
const SAMPLE_X = 12;
const STRIP_TOLERANCE = 3;
const MAX_FLAT_ROWS = 8;

type Opener = (page: Page) => Promise<void>;

const SCREENS: ReadonlyArray<{ name: string; open: Opener }> = [
  {
    name: 'Graveyard',
    open: async (page) => {
      await seedGraveyard(page);
    },
  },
  {
    name: 'Sources & licences',
    open: async (page) => {
      await seed(page, seedState());
      await page.goto(START);
      await page.getByRole('button', { name: 'Sources & licences' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Sources & licences' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
    },
  },
];

function isFlat(rgb: Rgb): boolean {
  return rgb.every((c, i) => Math.abs(c - BACKGROUND[i]!) <= STRIP_TOLERANCE);
}

for (const vp of VIEWPORTS) {
  test.describe(`night scene at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    for (const screen of SCREENS) {
      test(`${screen.name}: the page is taller than the viewport and has no flat band`, async ({ page }) => {
        await screen.open(page);
        await page.evaluate(() => window.scrollTo(0, 0));

        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        expect(height, `${screen.name}: scrollHeight ${height}, viewport ${vp.height}`).toBeGreaterThan(vp.height);

        // Requirement 24.8: computed styles.
        const styles = await page.evaluate(() => {
          const html = getComputedStyle(document.documentElement);
          const body = getComputedStyle(document.body);
          const layer = (selector: string, pseudo: '::before' | '::after') => {
            const cs = getComputedStyle(document.querySelector(selector)!, pseudo);
            return { position: cs.position, height: Number.parseFloat(cs.height) };
          };
          return {
            scrollHeight: document.documentElement.scrollHeight,
            htmlBackgroundColor: html.backgroundColor,
            bodyBackgroundColor: body.backgroundColor,
            bodyBackgroundImage: body.backgroundImage,
            layers: {
              'body::after': layer('body', '::after'),
              '#root::before': layer('#root', '::before'),
              '#root::after': layer('#root', '::after'),
            },
          };
        });
        expect(styles.htmlBackgroundColor, 'html background-color').toBe('rgb(16, 28, 56)');
        expect(['rgba(0, 0, 0, 0)', 'transparent'], 'body background-color').toContain(styles.bodyBackgroundColor);
        expect(styles.bodyBackgroundImage, 'body background-image').toBe('none');
        for (const [name, layer] of Object.entries(styles.layers)) {
          expect(layer.position, `${name} position`).toBe('absolute');
          expect(
            Math.abs(layer.height - styles.scrollHeight),
            `${name} height ${layer.height} vs scrollHeight ${styles.scrollHeight}`,
          ).toBeLessThanOrEqual(2);
        }

        // Requirement 24.7: Full_Page_Capture from scroll 0.
        const png = await page.screenshot({ fullPage: true });

        // Strip 3 px from the left edge, rows below the first viewport.
        const rows: { x: number; y: number }[] = [];
        for (let y = vp.height; y < height; y += 1) rows.push({ x: STRIP_X, y });
        const strip = await pixelsAt(page, png, rows);
        let run = 0;
        let longest = 0;
        let longestEnd = vp.height;
        strip.forEach((rgb, i) => {
          run = isFlat(rgb) ? run + 1 : 0;
          if (run > longest) {
            longest = run;
            longestEnd = vp.height + i;
          }
        });
        expect(
          longest,
          `${screen.name}: ${longest} consecutive rows of #0e0f13 in the left strip, ending at y ${longestEnd}`,
        ).toBeLessThanOrEqual(MAX_FLAT_ROWS);

        // Three sample points below the first viewport must be blue-tinted. The first two lie in
        // the page margin (cards cover the middle). The last lies at the middle of the width,
        // where the page bottom is empty: the Vignette is strongest in the corners, and there the
        // held sky darkened by up to 55% falls to a blue lead of 18, below the limit of 20.
        const samples = [
          { label: '150% of the viewport height', x: SAMPLE_X, y: Math.min(Math.round(vp.height * 1.5), height - 1) },
          { label: 'the middle of the page', x: SAMPLE_X, y: Math.max(Math.round(height / 2), vp.height + 1) },
          { label: '5 px above the bottom', x: Math.floor(vp.width / 2), y: height - 5 },
        ];
        const colours = await pixelsAt(
          page,
          png,
          samples.map((s) => ({ x: s.x, y: s.y })),
        );
        samples.forEach((s, i) => {
          const [r, , b] = colours[i]!;
          expect(
            b - r,
            `${screen.name}: ${s.label} (y ${s.y}) is rgb(${colours[i]!.join(', ')}), not blue-tinted`,
          ).toBeGreaterThanOrEqual(20);
        });
      });
    }

    test('intro: the Moon shade is visible', async ({ page }) => {
      await seed(page, seedState({ introSeen: false }));
      await page.goto(START);
      await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
      await waitForInkReveal(page);
      await page.evaluate(() => document.fonts.ready);

      const disc = await moonDisc(page);
      const rem = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
      const png = await page.screenshot();
      const [lit, shaded] = await pixelsAt(page, png, [
        { x: disc.cx - 0.8 * rem, y: disc.cy - 0.8 * rem },
        { x: disc.cx + 0.5 * rem, y: disc.cy + 0.5 * rem },
      ]);
      const ratio = (luminance(lit!) + 0.05) / (luminance(shaded!) + 0.05);
      expect(
        ratio,
        `lit rgb(${lit!.join(', ')}), shaded rgb(${shaded!.join(', ')}), ratio ${ratio.toFixed(3)}`,
      ).toBeGreaterThanOrEqual(1.2);
    });
  });
}
