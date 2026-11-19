import { expect, test, type Page } from '@playwright/test';
import { CLEAR_HALF_WIDTH_PX, CONTROL_HALF_WIDTH_PX } from '../app/src/engine/grain';
import { contrastRatio, theme } from '../app/src/styles/theme';
import { START, expectNoVerticalScroll, findOverflow, waitForLegendReveal } from './helpers';

// The legend line inks itself in (spec proof-pass, Requirement 13, ACs 9, 12, 13, 17, 18, 21, 22, 23).
//
// The intro exposes `data-legend-state` ("inking" | "inked") on `figure[data-legend-state]`
// and, for each character of the line, a span `[data-legend-cell]` whose `data-ink` is
// "pending" | "active" | "done". The task text says `active` to `done`; those are the real values.

const FIGURE = 'figure[data-legend-state]';
const LINE = '天雨粟，鬼夜哭';
const HAN = /[\u4e00-\u9fff]/;
const SAMPLE_MS = [1000, 3000] as const;

interface Timing {
  inkedAt: number | null;
  cells: Record<string, { active?: number; done?: number }>;
}

/** Records, from navigation start, when the legend turns `inked` and when each cell turns active and done. */
async function recordLegend(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const timing: Timing = { inkedAt: null, cells: {} };
    (window as unknown as { __legend: Timing }).__legend = timing;
    const look = () => {
      const now = performance.now();
      const fig = document.querySelector('figure[data-legend-state]');
      if (fig && fig.getAttribute('data-legend-state') === 'inked' && timing.inkedAt === null) {
        timing.inkedAt = now;
      }
      document.querySelectorAll('[data-legend-cell]').forEach((cell) => {
        const char = cell.getAttribute('data-legend-cell') ?? '';
        const state = cell.getAttribute('data-ink');
        const entry = (timing.cells[char] ??= {});
        if (state === 'active' && entry.active === undefined) entry.active = now;
        if (state === 'done' && entry.done === undefined) entry.done = now;
      });
    };
    new MutationObserver(look).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-legend-state', 'data-ink'],
    });
    look();
  });
}

async function timing(page: Page): Promise<Timing> {
  return page.evaluate(() => (window as unknown as { __legend: Timing }).__legend);
}

test.describe('legend ink', () => {
  test('reaches inked within 6000 ms of load and each Han cell takes at most 900 ms', async ({ page }) => {
    await recordLegend(page);
    await page.goto(START);
    await expect(page.locator(FIGURE)).toHaveAttribute('data-legend-state', 'inked', { timeout: 15_000 });
    const t = await timing(page);
    console.log(`time to inked: ${t.inkedAt === null ? 'unknown' : Math.round(t.inkedAt)} ms from navigation start`);
    expect(t.inkedAt, 'inked was never observed').not.toBeNull();
    expect(t.inkedAt as number).toBeLessThanOrEqual(6000);

    const han = Array.from(new Set(Array.from(LINE).filter((c) => HAN.test(c))));
    expect(han.length).toBe(6);
    for (const char of han) {
      const c = t.cells[char];
      expect(c?.active, `${char} never became active`).toBeDefined();
      expect(c?.done, `${char} never became done`).toBeDefined();
      const took = (c!.done as number) - (c!.active as number);
      expect(took, `${char} took ${Math.round(took)} ms`).toBeLessThanOrEqual(900);
    }
    // the state never leaves "inked"
    await page.waitForTimeout(500);
    await expect(page.locator(FIGURE)).toHaveAttribute('data-legend-state', 'inked');
  });

  const failures: Array<{ name: string; handle: (route: import('@playwright/test').Route) => Promise<void> }> = [
    { name: 'network failure', handle: (r) => r.abort() },
    { name: 'non-ok response', handle: (r) => r.fulfill({ status: 404, body: 'not found' }) },
    {
      name: 'invalid JSON',
      handle: (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{ not json' }),
    },
    {
      name: 'no entries',
      handle: (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    },
  ];
  for (const failure of failures) {
    test(`a ${failure.name} ends inked with the wipe and no error text`, async ({ page }) => {
      await page.route('**/legend-strokes.json*', failure.handle);
      await recordLegend(page);
      await page.goto(START);
      await waitForLegendReveal(page);
      await expect(page.locator('figure[data-legend-state] blockquote.ink-reveal')).toBeVisible();
      await expect(page.locator(FIGURE)).toHaveAttribute('data-legend-state', 'inked');
      const body = (await page.locator('body').innerText()).toLowerCase();
      for (const word of ['error', 'failed', 'could not', 'unable', 'went wrong']) {
        expect(body, `error text "${word}" is shown`).not.toContain(word);
      }
      await expect(page.getByText(LINE)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
    });
  }

  test('reduced motion is inked at once and renders no grain', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(START);
    await expect(page.locator(FIGURE)).toHaveAttribute('data-legend-state', 'inked', { timeout: 500 });
    await expect(page.locator('.grain')).toHaveCount(0);
    await expect(page.getByText(LINE)).toBeVisible();
  });

  test('Sources and Begin the Séance are clickable 300 ms after load', async ({ page }) => {
    await page.goto(START);
    await page.waitForTimeout(300);
    await expect(page.locator(FIGURE)).toHaveAttribute('data-legend-state', 'inking');
    await page.getByRole('button', { name: 'Sources' }).click({ timeout: 1000 });
    await expect(page.getByRole('heading', { name: /Sources/ }).first()).toBeVisible();

    await page.goto(START);
    await page.waitForTimeout(300);
    await expect(page.locator(FIGURE)).toHaveAttribute('data-legend-state', 'inking');
    await page.getByRole('button', { name: 'Begin the Séance' }).click({ timeout: 1000 });
    await expect(page.getByRole('button', { name: /^Level 1/ })).toBeVisible();
  });

  const sizes = [
    { width: 1024, height: 768 },
    { width: 375, height: 812 },
    { width: 320, height: 640 },
  ];
  for (const size of sizes) {
    test(`fits one screen during and after the ink at ${size.width} x ${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(START);
      const start = Date.now();
      for (const at of SAMPLE_MS) {
        await page.waitForTimeout(Math.max(0, at - (Date.now() - start)));
        await expectNoVerticalScroll(page);
        expect(await findOverflow(page, size.width), `overflow at ~${at} ms`).toEqual([]);
      }
      await waitForLegendReveal(page);
      await expectNoVerticalScroll(page);
      expect(await findOverflow(page, size.width), 'overflow after the ink').toEqual([]);
    });
  }

  test('every grain falls for at least 12 s and ignores the pointer', async ({ page }) => {
    await page.goto(START);
    await expect(page.locator(FIGURE)).toBeVisible();
    const grains = await page.locator('.grain').evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        const durations = cs.animationDuration.split(',').map((d) => {
          const v = Number.parseFloat(d);
          return d.trim().endsWith('ms') ? v / 1000 : v;
        });
        return { durations, pointerEvents: cs.pointerEvents };
      }),
    );
    expect(grains.length).toBeGreaterThan(0);
    for (const g of grains) {
      expect(Math.min(...g.durations), JSON.stringify(g)).toBeGreaterThanOrEqual(12);
      expect(g.pointerEvents).toBe('none');
    }
    const container = await page.getByTestId('legend-grain').evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(container).toBe('none');
  });

  // Grain keeps clear of the controls (spec proof-pass, Requirement 13, ACs 32 to 36).
  const grainSizes = [
    { width: 1024, height: 768 },
    { width: 375, height: 812 },
    { width: 320, height: 640 },
  ];
  for (const size of grainSizes) {
    test(`no grain path meets a control box, and ink text over a grain keeps 4.5:1, at ${size.width} x ${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(START);
      await waitForLegendReveal(page);
      const m = await page.evaluate(() => {
        const layer = document.querySelector('[data-testid="legend-grain"]') as HTMLElement;
        const lr = layer.getBoundingClientRect();
        const grains = [...layer.querySelectorAll<HTMLElement>('.grain')].map((el) => {
          const cs = getComputedStyle(el);
          const left = lr.left + Number.parseFloat(cs.left);
          return { left, right: left + Number.parseFloat(cs.width) };
        });
        const controls = [...document.querySelectorAll<HTMLElement>('main button, main a, button, a')].map((el) => {
          const r = el.getBoundingClientRect();
          return { name: (el.textContent ?? '').trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        });
        const texts = [...document.querySelectorAll<HTMLElement>('main *')]
          .filter(
            (el) =>
              [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim()) &&
              !el.closest('figure, button, a, [aria-hidden="true"]'),
          )
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { text: (el.textContent ?? '').trim().slice(0, 20), left: r.left, right: r.right, colour: getComputedStyle(el).color };
          });
        return { layer: { top: lr.top, bottom: lr.bottom }, grains, controls, texts };
      });
      expect(m.grains).toHaveLength(24);
      expect(m.controls.length).toBeGreaterThanOrEqual(2);
      for (const c of m.controls) {
        // the layout constants must cover the real control
        expect(c.right - c.left, c.name).toBeLessThanOrEqual(2 * CONTROL_HALF_WIDTH_PX);
        const box = { left: c.left - 4, right: c.right + 4, top: c.top - 4, bottom: c.bottom + 4 };
        expect(box.left, c.name).toBeGreaterThanOrEqual(size.width / 2 - CLEAR_HALF_WIDTH_PX - 0.5);
        for (const g of m.grains) {
          const xOverlap = g.left < box.right && g.right > box.left;
          // the fall covers the layer from its top to its bottom, so any box inside the layer is crossed in y
          const yOverlap = box.top < m.layer.bottom && box.bottom > m.layer.top;
          expect(xOverlap && yOverlap, `grain ${g.left}..${g.right} meets "${c.name}" ${box.left}..${box.right}`).toBe(false);
        }
      }
      const hex = (rgb: string) =>
        '#' + (rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
      const bg = theme.background.slice(1);
      const ink = theme.ink.slice(1);
      const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
      const worst =
        '#' + [0, 2, 4].map((i) => Math.round(ch(ink, i) * 0.35 + ch(bg, i) * 0.65).toString(16).padStart(2, '0')).join('');
      for (const t of m.texts) {
        const hit = m.grains.some((g) => g.left < t.right && g.right > t.left);
        if (hit) expect(contrastRatio(hex(t.colour), worst), t.text).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test('assistive technology reads the whole legend line once', async ({ page }) => {
    await page.goto(START);
    const read = async () =>
      page.evaluate(() => {
        const fig = document.querySelector('figure[data-legend-state]');
        let text = '';
        const walk = (node: Node) => {
          if (node.nodeType === 3) text += node.textContent ?? '';
          else if (node instanceof Element && node.getAttribute('aria-hidden') !== 'true') {
            node.childNodes.forEach(walk);
          }
        };
        if (fig) walk(fig);
        return (text.match(/[\u4e00-\u9fff\uff0c]/g) ?? []).join('');
      });
    await page.waitForTimeout(1000);
    expect(await read(), 'during the ink').toBe(LINE.replace(/\s/g, ''));
    await waitForLegendReveal(page);
    expect(await read(), 'after the ink').toBe(LINE);
  });
});
