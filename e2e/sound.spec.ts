import { expect, test, type Page } from '@playwright/test';
import { learningOrder } from '../app/src/engine/learningOrder';
import {
  START,
  STORAGE_KEY,
  beforeGesture,
  datasetMap,
  datasetRecord,
  installAudioRecorder,
  loopStopCount,
  loopingStarts,
  readAudioLog,
  recordMedia,
  seed,
  seedBefore,
  seedSound,
  seedState,
  soundToggle,
} from './helpers';

// Night sounds, end to end (spec night-sounds, task 13.2). Chromium keeps its default autoplay
// policy: a context stays suspended until a real click or key press. Nothing here reads an
// answer: the keys typed come from characters.json at test time.

const CLICK_SPOT = { x: 3, y: 700 };

/** Console errors and uncaught page errors seen so far. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function savedState(page: Page): Promise<Record<string, unknown>> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  if (raw === null) throw new Error('nothing is saved yet');
  return JSON.parse(raw) as Record<string, unknown>;
}

async function startsCount(page: Page): Promise<number> {
  return (await readAudioLog(page)).starts.length;
}

async function openMenu(page: Page): Promise<void> {
  await page.goto(START);
  await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test.describe('night sounds end to end', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await installAudioRecorder(page);
  });

  for (const [name, state] of [
    ['a schema 3 seed', seedState()],
    ['a schema 4 seed with sound on', seedSound({ soundOn: true })],
  ] as const) {
    test(`no context before a gesture, exactly one after a click (${name})`, async ({ page }) => {
      const errors = watchErrors(page);
      await seed(page, state);
      await openMenu(page);
      await page.waitForTimeout(500);
      let log = await readAudioLog(page);
      expect(log.constructed, 'a context was built at load').toBe(0);
      expect(log.starts).toEqual([]);

      await page.mouse.click(CLICK_SPOT.x, CLICK_SPOT.y);
      await expect.poll(async () => (await readAudioLog(page)).constructed).toBe(1);
      await page.mouse.click(CLICK_SPOT.x, CLICK_SPOT.y);
      await page.keyboard.press('Shift');
      await page.waitForTimeout(300);
      log = await readAudioLog(page);
      expect(log.constructed, 'more than one context after later gestures').toBe(1);
      expect(beforeGesture(log.constructions)).toEqual([]);
      expect(log.failures).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test('a key press as the first gesture builds exactly one context', async ({ page }) => {
    await seed(page, seedState());
    await openMenu(page);
    expect((await readAudioLog(page)).constructed).toBe(0);
    await page.keyboard.press('Shift');
    await expect.poll(async () => (await readAudioLog(page)).constructed).toBe(1);
  });

  test('with soundOn false seeded, a click and a key press build no context', async ({ page }) => {
    const errors = watchErrors(page);
    await seed(page, seedSound({ soundOn: false }));
    await openMenu(page);
    await expect(soundToggle(page)).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.click(CLICK_SPOT.x, CLICK_SPOT.y);
    await page.keyboard.press('Shift');
    await page.waitForTimeout(500);
    const log = await readAudioLog(page);
    expect(log.constructed).toBe(0);
    expect(log.starts).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the Sound_Toggle flips, persists across a reload and across a recorded outcome', async ({ page }) => {
    const errors = watchErrors(page);
    await seed(page, seedSound({ soundOn: true, ambienceOn: false }));
    await openMenu(page);
    const toggle = soundToggle(page);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await savedState(page)).soundOn).toBe(false);

    await page.reload();
    await expect(soundToggle(page)).toHaveAttribute('aria-pressed', 'false');

    // A recorded outcome keeps the sound fields (they are copied by name on every write).
    await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
    await page.getByRole('region', { name: 'Summon step' }).getByRole('button', { name: 'Give up' }).click();
    const writeGiveUp = page.getByRole('region', { name: 'Write mode' }).getByRole('button', { name: 'Give up' });
    await expect(writeGiveUp).toBeEnabled({ timeout: 15_000 });
    await writeGiveUp.click();
    await expect
      .poll(async () => Object.keys(((await savedState(page)).history ?? {}) as Record<string, unknown>).length, {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
    const after = await savedState(page);
    expect(after.soundOn).toBe(false);
    expect(after.ambienceOn).toBe(false);
    expect(after.schemaVersion).toBe(4);

    await page.reload();
    await expect(soundToggle(page)).toHaveAttribute('aria-pressed', 'false');
    expect((await readAudioLog(page)).constructed, 'sound off built a context').toBe(0);
    expect(errors).toEqual([]);
  });

  test('turning sound on builds the context in the same gesture and starts a source', async ({ page }) => {
    const errors = watchErrors(page);
    await seed(page, seedSound({ soundOn: false }));
    await openMenu(page);
    expect((await readAudioLog(page)).constructed).toBe(0);

    await soundToggle(page).click();
    await expect(soundToggle(page)).toHaveAttribute('aria-pressed', 'true');
    const log = await readAudioLog(page);
    expect(log.constructed).toBe(1);
    expect(log.constructions[0]?.t, 'the context was built outside a gesture').not.toBeNull();
    expect(log.constructions[0]!.t!).toBeLessThan(1000);
    await expect.poll(() => startsCount(page)).toBeGreaterThan(0);
    await expect.poll(async () => (await savedState(page)).soundOn).toBe(true);

    await page.reload();
    await expect(soundToggle(page)).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });

  test('a Summon key and a wrong key each start a source; no media loads through the Write step', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    const media = recordMedia(page);

    const map = datasetMap();
    const order = learningOrder(map);
    const char = order.slice(5).find((c) => map.get(c)?.cangjie != null && map.get(c)?.summonInk.class !== 'opaque');
    if (char === undefined) throw new Error('no suitable character in the dataset');
    const code = datasetRecord(char).cangjie!.toUpperCase();
    const wrong = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('').find((l) => !code.includes(l));
    if (wrong === undefined) throw new Error('no letter outside the code');

    await seed(page, seedBefore(char));
    await openMenu(page);
    await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
    const summon = page.getByRole('region', { name: 'Summon step' });
    await expect(summon).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(600); // the click built the context and resumed it

    const beforeWrong = await startsCount(page);
    await page.keyboard.press(wrong.toLowerCase());
    await expect.poll(() => startsCount(page), { message: 'a wrong key started no source' }).toBeGreaterThan(beforeWrong);

    await page.waitForTimeout(150);
    const beforeRight = await startsCount(page);
    await page.keyboard.press(code[0]!.toLowerCase());
    await expect.poll(() => startsCount(page), { message: 'a right key started no source' }).toBeGreaterThan(beforeRight);

    // Finish the code by hand (the first letter is already typed), then draw one stroke.
    for (const letter of code.slice(1)) {
      await summon.getByRole('button', { name: new RegExp(`^Key ${letter}(,|$)`) }).click();
    }
    await expect(page.getByRole('region', { name: 'Write mode' })).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await drawFirstStroke(page, char);
    await page.waitForTimeout(500);

    const log = await readAudioLog(page);
    expect(log.constructed).toBe(1);
    expect(log.failures).toEqual([]);
    expect(media.requests, 'a media request was made').toEqual([]);
    expect(media.responses, 'an audio response was received').toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the wind is off by default and starts no looping source on the menu', async ({ page }) => {
    const errors = watchErrors(page);
    const media = recordMedia(page);
    await seed(page, seedSound({ soundOn: true }));
    await openMenu(page);
    // The Ambience_Toggle lives on the Graveyard only.
    await expect(page.getByTestId('ambience-toggle')).toHaveCount(0);
    await page.mouse.click(CLICK_SPOT.x, CLICK_SPOT.y);
    await expect.poll(async () => (await readAudioLog(page)).constructed).toBe(1);
    await page.waitForTimeout(1500);
    expect(loopingStarts(await readAudioLog(page))).toEqual([]);
    expect(media.requests).toEqual([]);
    expect(media.responses).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('with the wind saved on, it starts on the menu and stops on the séance', async ({ page }) => {
    const errors = watchErrors(page);
    const media = recordMedia(page);
    await seed(page, seedSound({ soundOn: true, ambienceOn: true }));
    await openMenu(page);
    await expect(page.getByTestId('ambience-toggle')).toHaveCount(0);
    expect(loopingStarts(await readAudioLog(page)), 'wind before a gesture').toEqual([]);

    await page.mouse.click(CLICK_SPOT.x, CLICK_SPOT.y);
    await expect.poll(async () => loopingStarts(await readAudioLog(page)).length, { timeout: 10_000 }).toBe(1);
    expect(await loopStopCount(page)).toBe(0);

    await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
    await expect(page.getByRole('region', { name: 'Summon step' })).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => loopStopCount(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(800);
    expect(loopingStarts(await readAudioLog(page)).length, 'the wind restarted in the séance').toBe(1);
    expect(media.requests).toEqual([]);
    expect(media.responses).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('reduced motion stops the wind and no-preference brings it back', async ({ page }) => {
    const errors = watchErrors(page);
    await seed(page, seedSound({ soundOn: true, ambienceOn: true }));
    await openMenu(page);
    await page.mouse.click(CLICK_SPOT.x, CLICK_SPOT.y);
    await expect.poll(async () => loopingStarts(await readAudioLog(page)).length, { timeout: 10_000 }).toBe(1);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => loopStopCount(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(800);
    expect(loopingStarts(await readAudioLog(page)).length, 'the wind restarted while reduced').toBe(1);
    // The Ambience_Toggle lives on the Graveyard: it shows as disabled there, and the saved choice is untouched.
    await page.getByRole('button', { name: 'Graveyard' }).click();
    await expect(page.getByTestId('ambience-toggle')).toHaveAttribute('aria-disabled', 'true');
    expect((await savedState(page)).ambienceOn).toBe(true);
    await page.waitForTimeout(800);
    expect(loopingStarts(await readAudioLog(page)).length, 'the wind started on the Graveyard while reduced').toBe(1);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => loopingStarts(await readAudioLog(page)).length, { timeout: 10_000 }).toBe(2);
    expect(errors).toEqual([]);
  });
});

/** Draws the first stroke of the character on the Write paper with the mouse (the helper's method). */
async function drawFirstStroke(page: Page, character: string): Promise<void> {
  const median = datasetRecord(character).strokeData.medians[0];
  if (!median) throw new Error(`${character} has no stroke`);
  const group = page.locator('[data-testid="ink-container"] svg > g').first();
  await expect(group).toBeAttached();
  const points = await group.evaluate((g, pts) => {
    const ctm = (g as SVGGraphicsElement).getScreenCTM();
    if (!ctm) throw new Error('the positioned group has no screen matrix');
    return pts.map(([x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform(ctm);
      return { x: p.x, y: p.y };
    });
  }, median);
  const [first, ...rest] = points;
  if (!first) throw new Error('empty median');
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const p of rest) await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.up();
}
