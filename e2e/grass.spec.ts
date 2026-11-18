import { expect, test, type Page } from '@playwright/test';
import { findOverflow, seedGraveyard } from './helpers';

// Grass (spec night-polish, Requirement 4): decorative tufts at the foot of every tablet and
// along the hill crest. They sit inside the tablets, never meet a Marker or a glyph, paint
// behind the grid, add no overflow and no Tab stop.

const HIDE_GRASS = '[data-grass] { display: none !important; }';

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

test.describe('tablet tufts', () => {
  test('each tuft box lies inside its tablet, at its foot, at most 16 px high', async ({ page }) => {
    await seedGraveyard(page);
    const rows = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[aria-label="Graves"] > li'));
      return items.map((li, index) => {
        const tufts = li.querySelectorAll('[data-grass="tablet"]');
        const t = tufts[0]?.getBoundingClientRect();
        const l = li.getBoundingClientRect();
        const w = tufts[0] as HTMLElement | undefined;
        return {
          index,
          count: tufts.length,
          // Layout frame (before the tablet's tilt): the tuft's bottom edge against the tablet's
          // padding box. The tilt turns the li box into a larger axis-aligned box, so the
          // bottom edge is measured here and the containment check stays on the painted boxes.
          foot: w ? (li as HTMLElement).clientHeight - (w.offsetTop + w.offsetHeight) : null,
          layoutHeight: w ? w.offsetHeight : null,
          li: { left: l.left, top: l.top, right: l.right, bottom: l.bottom },
          tuft: t ? { left: t.left, top: t.top, right: t.right, bottom: t.bottom } : null,
        };
      });
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const detail = `tablet position ${row.index + 1}: ${JSON.stringify(row)}`;
      expect(row.count, detail).toBe(1);
      const t = row.tuft as Rect;
      expect(t.left, detail).toBeGreaterThanOrEqual(row.li.left - 0.5);
      expect(t.right, detail).toBeLessThanOrEqual(row.li.right + 0.5);
      expect(t.top, detail).toBeGreaterThanOrEqual(row.li.top - 0.5);
      expect(t.bottom, detail).toBeLessThanOrEqual(row.li.bottom + 0.5);
      expect(Math.abs(row.foot as number), detail).toBeLessThanOrEqual(2);
      expect(row.layoutHeight as number, detail).toBeLessThanOrEqual(16);
      expect(t.bottom - t.top, detail).toBeLessThanOrEqual(16);
    }
  });

  for (const vp of [
    { width: 375, height: 812 },
    { width: 320, height: 640 },
  ]) {
    test(`no tuft box meets a Marker or a glyph at ${vp.width} x ${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await seedGraveyard(page);
      const hits = await page.evaluate(() => {
        const out: string[] = [];
        const box = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        };
        const meet = (
          a: { left: number; top: number; right: number; bottom: number },
          b: { left: number; top: number; right: number; bottom: number },
        ) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const items = Array.from(document.querySelectorAll('[aria-label="Graves"] > li'));
        const others = Array.from(
          document.querySelectorAll('[aria-label="Graves"] > li > span[aria-hidden="true"]:not([data-grass])'),
        ).concat(Array.from(document.querySelectorAll('[aria-label="Graves"] [lang="zh"]')));
        items.forEach((li, index) => {
          const tuft = li.querySelector('[data-grass="tablet"]');
          if (!tuft) return;
          const t = box(tuft);
          for (const o of others) {
            if (meet(t, box(o))) {
              const kind = o.getAttribute('lang') === 'zh' ? 'glyph' : 'Marker';
              const owner = o.closest('li') === li ? 'its own' : 'another tablet\'s';
              out.push(
                `viewport ${innerWidth} x ${innerHeight}, tablet position ${index + 1}: tuft ${JSON.stringify(t)} meets ${owner} ${kind} ${JSON.stringify(box(o))}`,
              );
            }
          }
        });
        return out;
      });
      expect(hits).toEqual([]);
    });
  }

  test('the computed overflow of every tablet is visible', async ({ page }) => {
    await seedGraveyard(page);
    const bad = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[aria-label="Graves"] > li'))
        .map((li, i) => ({ i, o: getComputedStyle(li).overflow }))
        .filter((x) => x.o !== 'visible')
        .map((x) => `tablet position ${x.i + 1}: overflow ${x.o}`),
    );
    expect(bad).toEqual([]);
  });

  test('tablet boxes keep their size with the tufts hidden', async ({ page }) => {
    await seedGraveyard(page);
    const sizes = (): Promise<string[]> =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[aria-label="Graves"] > li')).map((li) => {
          const r = li.getBoundingClientRect();
          return `${r.width.toFixed(2)}x${r.height.toFixed(2)}@${r.left.toFixed(2)},${r.top.toFixed(2)}`;
        }),
      );
    const withGrass = await sizes();
    expect(withGrass.length).toBeGreaterThan(0);
    await page.addStyleTag({ content: HIDE_GRASS });
    expect(await sizes()).toEqual(withGrass);
  });
});

test.describe('hill tufts', () => {
  test('come before the grid in document order and set no z-index', async ({ page }) => {
    await seedGraveyard(page);
    const r = await page.evaluate(() => {
      const grid = document.querySelector('[aria-label="Graves"]');
      const hill = Array.from(document.querySelectorAll('[data-grass="hill"]'));
      if (!grid) throw new Error('grid missing');
      return {
        count: hill.length,
        afterGrid: hill.filter((h) => !(grid.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_PRECEDING)).length,
        zIndexed: hill.filter((h) => getComputedStyle(h).zIndex !== 'auto' || (h as HTMLElement).style.zIndex !== '').length,
      };
    });
    expect(r.count, 'hill tuft count').toBe(12);
    expect(r.afterGrid, 'hill tufts that come after the grid').toBe(0);
    expect(r.zIndexed, 'hill tufts with a z-index').toBe(0);
  });

  test('paint behind a tablet (paint-order check)', async ({ page }) => {
    await seedGraveyard(page);
    // Tufts take no pointer events, so hit-testing skips them. Turn the events on in the test
    // only, then read the painted stack (topmost first) at points where a tuft meets a tablet.
    await page.addStyleTag({ content: '[data-grass] { pointer-events: auto !important; }' });
    await page.getByTestId('hillside').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    const r = await page.evaluate(() => {
      const results: string[] = [];
      let checked = 0;
      const tablets = Array.from(document.querySelectorAll('[aria-label="Graves"] > li'));
      for (const [slot, h] of Array.from(document.querySelectorAll('[data-grass="hill"]')).entries()) {
        const hr = h.getBoundingClientRect();
        for (let ix = 0; ix <= 8; ix += 1) {
          for (let iy = 0; iy <= 6; iy += 1) {
            const x = hr.left + (hr.width * ix) / 8;
            const y = hr.top + (hr.height * iy) / 6;
            if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue;
            const stack = document.elementsFromPoint(x, y);
            const hi = stack.findIndex((e) => h.contains(e));
            const ti = stack.findIndex((e) => tablets.some((li) => li.contains(e)));
            if (hi < 0 || ti < 0) continue;
            checked += 1;
            if (!(ti < hi)) results.push(`hill slot ${slot} at ${Math.round(x)},${Math.round(y)}: the tuft paints above a tablet`);
          }
        }
      }
      return { results, checked };
    });
    expect(r.results).toEqual([]);
    expect(r.checked, 'no hill tuft overlapped a tablet at a hit-testable point').toBeGreaterThan(0);
  });
});

test.describe('no horizontal overflow from the Grass', () => {
  for (const width of [320, 375, 1024, 1440]) {
    test(`findOverflow is clean at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 600 ? 700 : 900 });
      await seedGraveyard(page);
      expect(await findOverflow(page, width)).toEqual([]);
    });
  }
});

test.describe('Tab order', () => {
  async function tabSequence(page: Page): Promise<string[]> {
    const seen: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab');
      seen.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return 'body';
          const inGrass = el.closest('[data-grass]') !== null;
          return `${inGrass ? 'GRASS:' : ''}${el.tagName.toLowerCase()}:${el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 30)}`;
        }),
      );
    }
    return seen;
  }

  test('is the same with the tufts hidden, and no tuft takes focus', async ({ page }) => {
    await seedGraveyard(page);
    const withGrass = await tabSequence(page);
    expect(withGrass.filter((s) => s.startsWith('GRASS:'))).toEqual([]);
    expect(
      await page.evaluate(
        () => document.querySelectorAll('[data-grass] [tabindex], [data-grass] a, [data-grass] button').length,
      ),
    ).toBe(0);
    // A fresh load with the tufts hidden must give the same stops.
    await seedGraveyardFresh(page);
    await page.addStyleTag({ content: HIDE_GRASS });
    expect(await tabSequence(page)).toEqual(withGrass);
  });
});

async function seedGraveyardFresh(page: Page): Promise<void> {
  await page.reload();
  await page.getByRole('button', { name: 'Graveyard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Graveyard' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
