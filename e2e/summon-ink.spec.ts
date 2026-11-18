import { expect, test, type Locator, type Page } from '@playwright/test';
import type { CharacterRecord } from '../app/src/data/types';
import { learningOrder } from '../app/src/engine/learningOrder';
import {
  START,
  datasetMap,
  datasetRecord,
  expectInside,
  expectNoVerticalScroll,
  seed,
  seedBefore,
  visibleInkPaths,
} from './helpers';

// Summon-ink: strokes appear as keys are typed, and keys that ink nothing are
// described honestly (Requirements 4, 5 and 9.7 to 9.8). Every key letter is
// read from characters.json at test time; no code is typed from memory.

const INKLESS_KEY_TEXT = "This key's shape is one the game doesn't show yet.";
const OPAQUE_NOTE_TEXT = "This code uses shapes the game doesn't show yet.";

const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
] as const;

function firstOfClass(cls: 'partial' | 'opaque'): CharacterRecord {
  const map = datasetMap();
  for (const char of learningOrder(map)) {
    const record = map.get(char);
    if (record && record.summonInk.class === cls) return record;
  }
  throw new Error(`no ${cls} character in the dataset`);
}

function code(record: CharacterRecord): string {
  if (record.cangjie === null) throw new Error(`${record.character} has no code`);
  return record.cangjie.toUpperCase();
}

function keyStrokesOf(record: CharacterRecord): number[][] {
  if (record.summonInk.class === 'opaque') throw new Error(`${record.character} is opaque`);
  return record.summonInk.keyStrokes;
}

async function beginSeance(page: Page, record: CharacterRecord): Promise<Locator> {
  await seed(page, seedBefore(record.character));
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  const summon = page.getByRole('region', { name: 'Summon step' });
  await expect(summon, 'The Summon step did not appear after "Begin a Nightly Séance".').toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(record.prompt.pinyin);
  return summon;
}

async function pressKey(summon: Locator, letter: string): Promise<void> {
  await summon.getByRole('button', { name: new RegExp(`^Key ${letter}(,|$)`) }).click();
}

function statusLine(page: Page): Locator {
  return page.getByRole('region', { name: 'Summon step' }).locator('[role="status"]');
}

/** Index of the first key whose keyStrokes entry is empty. */
function firstInklessIndex(record: CharacterRecord): number {
  const index = keyStrokesOf(record).findIndex((strokes) => strokes.length === 0);
  if (index < 0) throw new Error(`${record.character} has no inkless key`);
  return index;
}

async function typeThroughInklessKey(summon: Locator, record: CharacterRecord): Promise<void> {
  const letters = code(record);
  const last = firstInklessIndex(record);
  for (let i = 0; i <= last; i++) await pressKey(summon, letters[i]!);
}

async function expectSummonFits(page: Page, summon: Locator): Promise<void> {
  await expectInside(page, 'Leave séance', page.getByRole('button', { name: 'Leave séance' }));
  await expectInside(page, 'Step 1 of 2: Summon', page.getByText('Step 1 of 2: Summon'));
  await expectInside(page, "Ghost's clue", page.getByRole('region', { name: "Ghost's clue" }));
  await expectInside(page, 'Cangjie code', page.getByRole('list', { name: 'Cangjie code' }));
  await expectInside(page, 'ink-surface', page.getByTestId('ink-surface'));
  const keys = summon.locator('[data-row="2"] button');
  const count = await keys.count();
  expect(count, 'no buttons in [data-row="2"]').toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expectInside(page, `row 2 key ${i}`, keys.nth(i));
  }
  await expectInside(page, 'Summon Give up', summon.getByRole('button', { name: 'Give up' }));
  await expectNoVerticalScroll(page);
}

test('the first key on 明 inks its strokes', async ({ page }) => {
  const record = datasetRecord('明');
  const summon = await beginSeance(page, record);
  expect(await visibleInkPaths(page)).toBe(0);
  // seedBefore() makes this a first meeting: the next slot shows its faint letter.
  const first = code(record)[0]!;
  await expect(summon.getByLabel(`Slot 1, type ${first}`)).toBeVisible();
  await pressKey(summon, first);
  await expect(summon.getByLabel(`Slot 1, type ${first}`)).toHaveCount(0);
  const expected = keyStrokesOf(record)[0]!.length;
  expect(expected).toBeGreaterThan(0);
  await expect.poll(() => visibleInkPaths(page), { timeout: 10_000 }).toBe(expected);
});

test('a partial character says so on a key whose shape is not shown', async ({ page }) => {
  const record = firstOfClass('partial');
  const summon = await beginSeance(page, record);
  await typeThroughInklessKey(summon, record);
  await expect(statusLine(page)).toContainText(INKLESS_KEY_TEXT);
  await expect(page.getByTestId('opaque-note')).toHaveCount(0);
  await expect(page.getByText(OPAQUE_NOTE_TEXT)).toHaveCount(0);
});

test('an opaque character shows a static note and no per-key message', async ({ page }) => {
  const record = firstOfClass('opaque');
  const summon = await beginSeance(page, record);
  const note = page.getByText(OPAQUE_NOTE_TEXT);
  await expect(note).toBeVisible();
  const attrs = await note.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLive: el.getAttribute('aria-live'),
    inLive: el.closest('[role], [aria-live]') !== null,
    inStatus: el.closest('[role="status"]') !== null,
  }));
  expect(attrs.role).toBeNull();
  expect(attrs.ariaLive).toBeNull();
  expect(attrs.inStatus).toBe(false);
  expect(attrs.inLive, 'the note sits inside an element with a role or aria-live').toBe(false);
  await expect(statusLine(page)).not.toContainText(OPAQUE_NOTE_TEXT);

  await pressKey(summon, code(record)[0]!);
  await expect(statusLine(page)).not.toContainText(INKLESS_KEY_TEXT);
  await expect(page.getByText(OPAQUE_NOTE_TEXT)).toHaveCount(1);
  await expect(note).toBeVisible();
  await expect(note).toHaveText(OPAQUE_NOTE_TEXT);
});

/** First record of the learning order, partial or transparent, whose last key inks one to three strokes. */
function returningCandidate(): CharacterRecord {
  const map = datasetMap();
  for (const char of learningOrder(map)) {
    const record = map.get(char);
    if (!record || record.cangjie === null) continue;
    if (record.summonInk.class === 'opaque') continue;
    const last = record.summonInk.keyStrokes[record.summonInk.keyStrokes.length - 1];
    if (last && last.length >= 1 && last.length <= 3) return record;
  }
  throw new Error('no transparent or partial record whose last key inks one to three strokes');
}

test('a returning ghost goes to Write after the last key and the target never appears', async ({ page }) => {
  const record = returningCandidate();
  const target = record.character;
  const letters = code(record);
  // One met ghost, due now, so the séance's first ghost is returning.
  await seed(page, {
    schemaVersion: 3,
    introSeen: true,
    cangjieIntroSeen: true,
    history: { [target]: { step: 0, lastOutcome: 'clean', nextDue: 0 } },
    level: 1,
    levelChosen: true,
  });
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  const summon = page.getByRole('region', { name: 'Summon step' });
  await expect(summon).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(record.prompt.pinyin);
  await expect(summon.getByRole('listitem', { name: /type / })).toHaveCount(0);

  for (let i = 0; i < letters.length - 1; i++) await pressKey(summon, letters[i]!);

  await page.evaluate((needle) => {
    const w = window as unknown as { __seen: string[] };
    w.__seen = [];
    const hit = (s: string | null | undefined): boolean => (s ?? '').includes(needle);
    const scan = (n: Node): void => {
      if (n.nodeType === 3 && hit(n.textContent)) w.__seen.push(`text: ${n.textContent}`);
      if (n.nodeType === 1) {
        const el = n as Element;
        for (const a of Array.from(el.attributes)) if (hit(a.value)) w.__seen.push(`attr ${a.name} on ${el.tagName}`);
        for (const c of Array.from(el.childNodes)) scan(c);
      }
    };
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'childList') r.addedNodes.forEach(scan);
        else if (r.type === 'characterData') {
          if (hit(r.target.textContent)) w.__seen.push(`text change: ${r.target.textContent}`);
        } else if (r.type === 'attributes' && r.target instanceof Element) {
          if (hit(r.target.getAttribute(r.attributeName ?? ''))) w.__seen.push(`attr ${r.attributeName}`);
        }
      }
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  }, target);

  await pressKey(summon, letters[letters.length - 1]!);
  await expect(page.getByRole('region', { name: 'Write mode' })).toBeVisible({ timeout: 1000 });
  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  expect(seen, `the character ${target} appeared in the page`).toEqual([]);
});

test('a first meeting still forms the character after the last key', async ({ page }) => {
  const record = datasetRecord('明');
  const summon = await beginSeance(page, record);
  const letters = code(record);
  for (const letter of letters) await pressKey(summon, letter);
  // The reveal holds the formed character before Write; Write is not visible at once.
  await expect(page.getByRole('region', { name: 'Write mode' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Write mode' })).toBeVisible({ timeout: 15_000 });
});

for (const vp of VIEWPORTS) {
  test.describe(`summon-ink fit at ${vp.width} x ${vp.height}`, () => {
    test.use({ viewport: vp });

    test('after the first key on 明', async ({ page }) => {
      expect(page.viewportSize()).toEqual(vp);
      const record = datasetRecord('明');
      const summon = await beginSeance(page, record);
      await pressKey(summon, code(record)[0]!);
      await expect
        .poll(() => visibleInkPaths(page), { timeout: 10_000 })
        .toBe(keyStrokesOf(record)[0]!.length);
      await expectSummonFits(page, summon);
    });

    test('after an inkless key', async ({ page }) => {
      expect(page.viewportSize()).toEqual(vp);
      const record = firstOfClass('partial');
      const summon = await beginSeance(page, record);
      await typeThroughInklessKey(summon, record);
      await expect(statusLine(page)).toContainText(INKLESS_KEY_TEXT);
      await expectSummonFits(page, summon);
    });

    test('with the note of an opaque character', async ({ page }) => {
      expect(page.viewportSize()).toEqual(vp);
      const record = firstOfClass('opaque');
      const summon = await beginSeance(page, record);
      await expect(page.getByText(OPAQUE_NOTE_TEXT)).toBeVisible();
      await expectInside(page, 'Opaque note', page.getByText(OPAQUE_NOTE_TEXT));
      await expectSummonFits(page, summon);
    });
  });
}
