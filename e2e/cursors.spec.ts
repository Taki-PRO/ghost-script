import { expect, test, type Locator, type Page } from '@playwright/test';
import { START, datasetRecord, seed, seedBefore, seedGraveyard, seedState } from './helpers';

// Cursors (spec night-polish, Requirements 2 and 3): a ghost cursor on fine pointers, a brush-tip
// cursor on the Write paper only, and no image cursor on touch devices. The same selectors and
// the same app run in both contexts; only the device differs.

const CHARACTER = '明';

async function cursorOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => getComputedStyle(el).cursor);
}

async function expectUrl(name: string, locator: Locator): Promise<void> {
  await expect(locator, `${name} is not present`).toBeVisible();
  const cursor = await cursorOf(locator);
  expect(cursor, `${name}: computed cursor is "${cursor.slice(0, 60)}", expected a url( value`).toContain('url(');
}

async function expectNoUrl(name: string, locator: Locator): Promise<void> {
  await expect(locator, `${name} is not present`).toBeVisible();
  const cursor = await cursorOf(locator);
  expect(cursor, `${name}: computed cursor has a url( value on a touch device`).not.toContain('url(');
}

/** Opens the first ghost (the character 明) at the Summon step. */
async function openSummon(page: Page): Promise<void> {
  await seed(page, seedBefore(CHARACTER));
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  await expect(page.getByRole('region', { name: 'Summon step' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('ink-surface')).toBeVisible();
}

/** Types the code of 明 and waits for the Write step. */
async function openWrite(page: Page): Promise<void> {
  await openSummon(page);
  const code = datasetRecord(CHARACTER).cangjie;
  if (code === null) throw new Error(`${CHARACTER} has no Cangjie code`);
  const summon = page.getByRole('region', { name: 'Summon step' });
  for (const letter of code.toUpperCase()) {
    await summon.getByRole('button', { name: new RegExp(`^Key ${letter}(,|$)`) }).click();
  }
  await expect(page.getByRole('region', { name: 'Write mode' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('ink-surface')).toBeVisible();
  await page.waitForTimeout(500); // let the writer mount
}

async function openIntro(page: Page): Promise<void> {
  await seed(page, seedState({ introSeen: false }));
  await page.goto(START);
  await expect(page.getByRole('button', { name: 'Begin the Séance' })).toBeVisible();
}

async function openMenu(page: Page): Promise<void> {
  await seed(page, seedState());
  await page.goto(START);
  await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
}

async function paperGeometry(page: Page): Promise<{
  touchAction: string;
  surface: { width: number; height: number };
  container: { width: number; height: number };
}> {
  return page.evaluate(() => {
    const surface = document.querySelector('[data-testid="ink-surface"]');
    const container = document.querySelector('[data-testid="ink-container"]');
    if (!surface || !container) throw new Error('the paper is missing');
    const s = surface.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    return {
      touchAction: getComputedStyle(surface).touchAction,
      surface: { width: s.width, height: s.height },
      container: { width: c.width, height: c.height },
    };
  });
}

test.describe('desktop (fine pointer)', () => {
  test('intro: body, a button and a non-interactive element carry a url( cursor', async ({ page }) => {
    await openIntro(page);
    await expectUrl('intro body', page.locator('body'));
    await expectUrl('intro button', page.locator('button:not(:disabled)').first());
    await expectUrl('intro heading', page.locator('h1').first());
  });

  test('start menu: body, a button and a non-interactive element carry a url( cursor', async ({ page }) => {
    await openMenu(page);
    await expectUrl('menu body', page.locator('body'));
    await expectUrl('menu button', page.getByRole('button', { name: 'Begin a Nightly Séance' }));
    await expectUrl('menu heading', page.locator('h1').first());
  });

  test('Graveyard: body, a button and a non-interactive element carry a url( cursor', async ({ page }) => {
    await seedGraveyard(page);
    await expectUrl('Graveyard body', page.locator('body'));
    await expectUrl('Graveyard button', page.locator('button:not(:disabled)').first());
    await expectUrl('Graveyard heading', page.getByRole('heading', { level: 1, name: 'Graveyard' }));
  });

  test('a disabled button keeps not-allowed', async ({ page }) => {
    await openMenu(page);
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = 'cursor-probe';
      b.disabled = true;
      b.textContent = 'Probe';
      document.body.appendChild(b);
    });
    expect(await cursorOf(page.locator('#cursor-probe'))).toBe('not-allowed');
  });

  test('Write step: the paper and every descendant carry a url( cursor, and drawing does not change it', async ({
    page,
  }) => {
    await openWrite(page);
    const paper = page.getByTestId('ink-surface');
    await expectUrl('Write body', page.locator('body'));
    await expectUrl('Write paper', paper);
    const missing = await paper.evaluate((el) =>
      Array.from(el.querySelectorAll('*'))
        .filter((d) => !getComputedStyle(d).cursor.includes('url('))
        .map((d) => `${d.tagName.toLowerCase()}[${d.getAttribute('data-testid') ?? ''}]`),
    );
    expect(missing, 'descendants of the Write paper without a url( cursor').toEqual([]);

    const rest = await cursorOf(paper);
    expect(rest, 'the Write paper carries the brush cursor').toContain('crosshair');
    const box = await paper.boundingBox();
    if (!box) throw new Error('no paper box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 4 });
      expect(await cursorOf(paper), 'cursor while the primary button is held').toBe(rest);
    } finally {
      await page.mouse.up();
    }
  });

  test('Summon paper does not carry the brush cursor and keeps its box', async ({ page }) => {
    await openSummon(page);
    const summonCursor = await cursorOf(page.getByTestId('ink-surface'));
    expect(summonCursor, 'the Summon paper keeps a ghost cursor').toContain('url(');
    expect(summonCursor, 'the Summon paper must not carry the brush value').not.toContain('crosshair');
    expect(await page.getByTestId('ink-surface').getAttribute('data-brush')).toBeNull();
    const summon = await paperGeometry(page);
    expect(summon.container).toEqual(summon.surface);
    expect(summon.touchAction).toBe('none');
  });

  test('Write paper keeps touch-action none and equal surface and container boxes', async ({ page }) => {
    await openWrite(page);
    const write = await paperGeometry(page);
    expect(write.touchAction, 'Write paper touch-action').toBe('none');
    expect(write.container, 'ink-container box equals ink-surface box on Write').toEqual(write.surface);
  });

  test('Tab still shows the focus ring', async ({ page }) => {
    await openMenu(page);
    await page.keyboard.press('Tab');
    // The slip box-shadow transition runs 200 ms; wait until it has settled.
    await page.waitForTimeout(400);
    const ring = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return getComputedStyle(el).boxShadow;
    });
    expect(ring, 'Tab moved focus to an element').not.toBeNull();
    expect(ring, 'focus ring box-shadow').not.toBe('none');
    expect(ring, 'ink ring colour (aged paper)').toContain('rgb(236, 230, 214)');
    expect(ring, 'candle glow, 14px blur').toContain('14px');
  });
});

test.describe('touch device', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('intro has no url( cursor', async ({ page }) => {
    await openIntro(page);
    await expectNoUrl('intro body', page.locator('body'));
    await expectNoUrl('intro button', page.locator('button:not(:disabled)').first());
    await expectNoUrl('intro heading', page.locator('h1').first());
  });

  test('start menu has no url( cursor', async ({ page }) => {
    await openMenu(page);
    await expectNoUrl('menu body', page.locator('body'));
    await expectNoUrl('menu button', page.getByRole('button', { name: 'Begin a Nightly Séance' }));
  });

  test('Graveyard has no url( cursor', async ({ page }) => {
    await seedGraveyard(page);
    await expectNoUrl('Graveyard body', page.locator('body'));
    await expectNoUrl('Graveyard button', page.locator('button:not(:disabled)').first());
  });

  test('Write step: body, a button and the paper have no url( cursor; touch-action stays none', async ({ page }) => {
    await openWrite(page);
    await expectNoUrl('Write body', page.locator('body'));
    await expectNoUrl('Write button', page.locator('button:not(:disabled)').first());
    await expectNoUrl('Write paper', page.getByTestId('ink-surface'));
    const geometry = await paperGeometry(page);
    expect(geometry.touchAction).toBe('none');
    expect(geometry.container).toEqual(geometry.surface);
  });
});
