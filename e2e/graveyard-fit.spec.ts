import { expect, test, type Page } from '@playwright/test';
import { moonRoomPx } from '../app/src/engine/moonRoom';
import { learningOrder } from '../app/src/engine/learningOrder';
import { START, datasetMap, findOverflow, luminance, pixelsAt, seed, seedState } from './helpers';

// Graveyard fit (Requirements 8.11, 15.7, 15.14): tilted tablets cause no
// horizontal overflow, the sticky header starts below the Moon_Room, the
// hillside sits behind the grid, never-met tablets are blank, and the markers,
// counts and accessible names hold.

const FAR_FUTURE = 32_503_680_000_000;
const WIDTHS = [320, 375, 1024, 1440] as const;

async function openGraveyard(page: Page): Promise<{ at: string; restless: string; gaveUp: string; total: number }> {
  const keys = learningOrder(datasetMap());
  const [a, b, c] = keys;
  expect(c, 'characters.json has fewer than three characters').toBeDefined();
  await seed(
    page,
    seedState({
      history: {
        [a as string]: { step: 3, lastOutcome: 'clean', nextDue: FAR_FUTURE },
        [b as string]: { step: 0, lastOutcome: 'struggled', nextDue: 0 },
        [c as string]: { step: 0, lastOutcome: 'gave-up', nextDue: 0 },
      },
    }),
  );
  await page.goto(START);
  await page.getByRole('button', { name: 'Graveyard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Graveyard' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { at: a as string, restless: b as string, gaveUp: c as string, total: keys.length };
}

for (const width of WIDTHS) {
  test.describe(`graveyard at ${width} px`, () => {
    test.use({ viewport: { width, height: width >= 1024 ? 768 : 812 } });

    test('tilted tablets cause no horizontal overflow', async ({ page }) => {
      await openGraveyard(page);
      const tilted = await page.locator('[aria-label="Graves"] > li[class*="tablet-tilt-"]').count();
      expect(tilted, 'no tilted tablets found').toBeGreaterThan(0);
      const problems = await findOverflow(page, width);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  });
}

test.describe('graveyard content', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('hillside sits behind the grid', async ({ page }) => {
    await openGraveyard(page);
    const hillside = page.getByTestId('hillside');
    await expect(hillside).toHaveAttribute('aria-hidden', 'true');
    const result = await page.evaluate(() => {
      const hill = document.querySelector('[data-testid="hillside"]');
      const grid = document.querySelector('[aria-label="Graves"]');
      if (!hill || !grid) throw new Error('hillside or grid missing');
      // The SVG is 12 rem at the top of the grid; the wrapper carries the SVG
      // and the ground gradient below it, so the wrapper is what covers the grid.
      const wrapper = hill.parentElement;
      if (!wrapper) throw new Error('hill wrapper missing');
      const h = wrapper.getBoundingClientRect();
      const g = grid.getBoundingClientRect();
      const first = grid.querySelector('li');
      if (!first) throw new Error('no tablets');
      const f = first.getBoundingClientRect();
      const stack = document.elementsFromPoint(f.left + f.width / 2, f.top + f.height / 2);
      const tabletIndex = stack.findIndex((el) => first.contains(el));
      const hillIndex = stack.indexOf(hill);
      return {
        covers: h.left <= g.left + 0.5 && h.right >= g.right - 0.5 && h.top <= g.top + 0.5 && h.bottom >= g.bottom - 0.5,
        before: Boolean(hill.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING),
        tabletIndex,
        hillIndex,
      };
    });
    expect(result.covers, 'the hill wrapper does not cover the grid').toBe(true);
    expect(result.before, 'the hillside is not before the grid in the document').toBe(true);
    expect(result.tabletIndex, 'no tablet at the probe point').toBeGreaterThanOrEqual(0);
    expect(result.hillIndex, 'the hillside is not under the probe point').toBeGreaterThanOrEqual(0);
    expect(result.tabletIndex, 'the hillside paints over the tablet').toBeLessThan(result.hillIndex);
  });

  test('never-met tablets are blank with no glyph and no border', async ({ page }) => {
    const { total } = await openGraveyard(page);
    const unmet = page.getByRole('listitem', { name: /, never met$/ });
    await expect(unmet).toHaveCount(total - 3);
    const info = await unmet.evaluateAll((els) =>
      els.map((el) => ({
        text: (el.textContent ?? '').trim(),
        border: getComputedStyle(el).borderTopWidth,
        lang: el.querySelector('[lang="zh"]') !== null,
      })),
    );
    for (const t of info) {
      expect(t.text, 'an unmet tablet shows more than its marker').toBe('·');
      expect(t.text).not.toMatch(/[\u3400-\u9fff]/);
      expect(t.border).toBe('0px');
      expect(t.lang).toBe(false);
    }
    const names = await unmet.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
    expect(names[0]).toBe(`Ghost 4 of ${total}, never met`);
  });

  test('markers, counts and accessible names hold', async ({ page }) => {
    const { at, restless, gaveUp, total } = await openGraveyard(page);
    const graves = page.getByRole('list', { name: 'Graves' });

    const atRest = graves.getByRole('listitem', { name: `${at}, at rest, 1 clean in a row` });
    await expect(atRest).toHaveCount(1);
    await expect(atRest).toContainText('✓');
    await expect(atRest.locator('[lang="zh"]')).toHaveText(at);

    for (const ch of [restless, gaveUp]) {
      const tablet = graves.getByRole('listitem', { name: new RegExp(`^${ch}, restless, due again`) });
      await expect(tablet).toHaveCount(1);
      await expect(tablet).toContainText('!');
      await expect(tablet.locator('[lang="zh"]')).toHaveText(ch);
    }

    const legend = page.getByRole('list', { name: 'Legend' });
    await expect(legend).toContainText(`Never met: ${total - 3}`);
    await expect(legend).toContainText('Restless: 2');
    await expect(legend).toContainText('At rest: 1');
  });
});

for (const vp of [
  { width: 375, height: 812 },
  { width: 320, height: 640 },
] as const) {
  test.describe(`graveyard header at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    test('sticky header row starts at or below the Moon_Room at scroll 0', async ({ page }) => {
      await openGraveyard(page);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const top = await page.getByRole('heading', { level: 1, name: 'Graveyard' }).evaluate((h) => {
        const header = h.closest('header');
        if (!header) throw new Error('no header');
        return header.getBoundingClientRect().top;
      });
      const room = moonRoomPx(vp.width);
      expect(top, `header top ${top} is above the Moon_Room ${room}`).toBeGreaterThanOrEqual(room);
    });
  });
}

// Hillside (Requirements 25.8 and 25.9): the hill sits behind the first rows
// and its far ridge shows against the sky.
for (const vp of [
  { width: 375, height: 812 },
  { width: 1024, height: 768 },
] as const) {
  test.describe(`graveyard hillside at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    test('the SVG contains the first row and the far ridge crest lies behind rows one and two', async ({ page }) => {
      await openGraveyard(page);
      const m = await page.evaluate(() => {
        const hill = document.querySelector('[data-testid="hillside"]');
        const grid = document.querySelector('[aria-label="Graves"]');
        const ridge = hill?.querySelector('path');
        if (!hill || !grid || !ridge) throw new Error('hillside, ridge or grid missing');
        const tablets = Array.from(grid.querySelectorAll(':scope > li')).map((li) => li.getBoundingClientRect());
        const firstTop = tablets[0]!.top;
        const row1 = tablets.filter((r) => Math.abs(r.top - firstTop) < 0.5);
        const rest = tablets.filter((r) => Math.abs(r.top - firstTop) >= 0.5);
        const secondTop = Math.min(...rest.map((r) => r.top));
        const row2 = rest.filter((r) => Math.abs(r.top - secondTop) < 0.5);
        const h = hill.getBoundingClientRect();
        return {
          svgTop: h.top,
          svgBottom: h.bottom,
          row1Top: Math.min(...row1.map((r) => r.top)),
          row1Bottom: Math.max(...row1.map((r) => r.bottom)),
          row2Bottom: Math.max(...row2.map((r) => r.bottom)),
          crest: ridge.getBoundingClientRect().top,
        };
      });
      const detail = JSON.stringify(m);
      expect(m.svgTop, detail).toBeLessThanOrEqual(m.row1Top + 0.5);
      expect(m.svgBottom, detail).toBeGreaterThanOrEqual(m.row1Bottom - 0.5);
      expect(m.crest, detail).toBeGreaterThanOrEqual(m.row1Top - 0.5);
      expect(m.crest, detail).toBeLessThanOrEqual(m.row2Bottom + 0.5);
    });

    test('the hillside paints behind the first tablet', async ({ page }) => {
      await openGraveyard(page);
      const r = await page.evaluate(() => {
        const hill = document.querySelector('[data-testid="hillside"]');
        const first = document.querySelector('[aria-label="Graves"] > li');
        if (!hill || !first) throw new Error('hillside or tablet missing');
        const f = first.getBoundingClientRect();
        const stack = document.elementsFromPoint(f.left + f.width / 2, f.top + f.height / 2);
        return { tabletIndex: stack.findIndex((el) => first.contains(el)), hillIndex: stack.indexOf(hill) };
      });
      expect(r.tabletIndex, 'no tablet at the probe point').toBeGreaterThanOrEqual(0);
      expect(r.hillIndex, 'the hillside is not under the first tablet').toBeGreaterThanOrEqual(0);
      expect(r.tabletIndex, 'the hillside paints over the first tablet').toBeLessThan(r.hillIndex);
    });

    test('the far ridge is lighter than the sky at its left end', async ({ page }) => {
      await openGraveyard(page);
      const hill = page.getByTestId('hillside');
      await hill.scrollIntoViewIfNeeded();
      await page.evaluate(() => document.fonts.ready);
      // The ridge is not flat at its left end: the curve rises as it leaves
      // x = 0. The strip is 3 px inside the wrapper, so the ridge top there is
      // read from the path itself (the point of the outline at that x).
      const at = await page.evaluate(() => {
        const hill = document.querySelector('[data-testid="hillside"]') as SVGSVGElement | null;
        const ridge = hill?.querySelector('path');
        const wrapper = hill?.parentElement;
        if (!hill || !ridge || !wrapper) throw new Error('hillside missing');
        const h = hill.getBoundingClientRect();
        const w = wrapper.getBoundingClientRect();
        const x = w.left + 3;
        const unitX = ((x - h.left) / h.width) * 100;
        const total = ridge.getTotalLength();
        let ridgeUnitY = 22;
        for (let l = 0; l <= total; l += total / 2000) {
          const pt = ridge.getPointAtLength(l);
          ridgeUnitY = pt.y;
          if (pt.x >= unitX) break;
        }
        return { x, ridgeY: h.top + (ridgeUnitY / 48) * h.height };
      });
      const png = await page.screenshot();
      const [upper, lower] = await pixelsAt(page, png, [
        { x: at.x, y: at.ridgeY - 1 },
        { x: at.x, y: at.ridgeY + 1 },
      ]);
      const ratio = (luminance(lower!) + 0.05) / (luminance(upper!) + 0.05);
      expect(
        ratio,
        `lower ${lower}, upper ${upper}, luminance ${luminance(lower!)} / ${luminance(upper!)}, ratio ${ratio}`,
      ).toBeGreaterThanOrEqual(1.2);
    });
  });
}
