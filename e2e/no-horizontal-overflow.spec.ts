import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// Width_Check at 375 x 812 on five screens (Requirements 24.7 to 24.10).
//
// Pseudo-element mist layers (`body::after`, `#root::before`) are not elements,
// so `querySelectorAll` and `getBoundingClientRect` never see them, and fixed
// layers add nothing to the document scroll width. The helper therefore does
// not inspect pseudo-elements.

const VIEWPORT = { width: 375, height: 812 } as const;
const STORAGE_KEY = 'ghost-script:state';
const START = '/ghost-script/';

interface SeedState {
  readonly schemaVersion: 2;
  readonly introSeen: boolean;
  readonly cangjieIntroSeen: boolean;
  readonly history: Record<string, { step: number; lastOutcome: string; nextDue: number }>;
}

/** Characters of the dataset, read at test time (the file is generated, never edited). */
function datasetKeys(): string[] {
  const path = fileURLToPath(new URL('../app/public/data/characters.json', import.meta.url));
  return Object.keys(JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>);
}

/** Pre-load localStorage before the app starts; never overwrites a key the app has written. */
async function seed(page: Page, state: SeedState): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    { key: STORAGE_KEY, value: JSON.stringify(state) },
  );
}

function seedState(overrides: Partial<SeedState> = {}): SeedState {
  return { schemaVersion: 2, introSeen: true, cangjieIntroSeen: true, history: {}, ...overrides };
}

/** Lines describing every overflow found on the current screen; empty when it fits. */
async function findOverflow(page: Page): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate((width) => {
    const out: string[] = [];

    const describe = (el: Element): string => {
      const label = el.getAttribute('aria-label');
      const classes = Array.from(el.classList).slice(0, 3);
      let s = el.tagName.toLowerCase();
      if (el.id) s += `#${el.id}`;
      if (classes.length > 0) s += `.${classes.join('.')}`;
      if (label) s += `[aria-label="${label}"]`;
      const anchor = el.parentElement?.closest('[id], [aria-label]');
      if (anchor) {
        const anchorLabel = anchor.getAttribute('aria-label');
        s += ` in ${anchor.tagName.toLowerCase()}${anchor.id ? `#${anchor.id}` : ''}${
          anchorLabel ? `[aria-label="${anchorLabel}"]` : ''
        }`;
      }
      return s;
    };

    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth > width) out.push(`document scrollWidth ${scrollWidth} > ${width}`);

    const all = [document.body, ...Array.from(document.body.querySelectorAll('*'))];
    for (const el of all) {
      if (getComputedStyle(el).display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.right > width + 0.5 || r.left < -0.5) {
        out.push(`${describe(el)}: left ${Math.round(r.left)}, right ${Math.round(r.right)}`);
      }
    }
    return out;
  }, VIEWPORT.width);
}

function expectViewport(page: Page): void {
  expect(page.viewportSize()).toEqual(VIEWPORT);
}

test.describe('no horizontal overflow at 375 px', () => {
  test('Sources & licences', async ({ page }) => {
    expectViewport(page);
    await seed(page, seedState());
    await page.goto(START);
    await page.getByRole('button', { name: 'Sources & licences' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sources & licences' })).toBeVisible();
    const problems = await findOverflow(page);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('Graveyard', async ({ page }) => {
    expectViewport(page);
    const [a, b, c] = datasetKeys();
    expect(c, 'characters.json has fewer than three characters').toBeDefined();
    await seed(
      page,
      seedState({
        history: {
          [a as string]: { step: 0, lastOutcome: 'struggled', nextDue: 0 },
          [b as string]: { step: 3, lastOutcome: 'clean', nextDue: 32_503_680_000_000 },
          [c as string]: { step: 0, lastOutcome: 'gave-up', nextDue: 0 },
        },
      }),
    );
    await page.goto(START);
    await page.getByRole('button', { name: 'Graveyard' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Graveyard' })).toBeVisible();
    const problems = await findOverflow(page);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('How Cangjie works', async ({ page }) => {
    expectViewport(page);
    await seed(page, seedState({ cangjieIntroSeen: false }));
    await page.goto(START);
    await page.getByRole('button', { name: 'How Cangjie works' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'How Cangjie works' })).toBeVisible();
    const problems = await findOverflow(page);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('Summon step', async ({ page }) => {
    expectViewport(page);
    await seed(page, seedState());
    await page.goto(START);
    await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
    const summon = page.getByRole('region', { name: 'Summon step' });
    await expect(
      summon,
      'The Summon step did not appear after "Begin a Nightly Séance"; the first ghost may be unplayable.',
    ).toBeVisible({ timeout: 10_000 });
    const problems = await findOverflow(page);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('Write step', async ({ page }) => {
    expectViewport(page);
    await seed(page, seedState());
    await page.goto(START);
    await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
    const summon = page.getByRole('region', { name: 'Summon step' });
    await expect(
      summon,
      'The Summon step did not appear after "Begin a Nightly Séance"; the first ghost may be unplayable.',
    ).toBeVisible({ timeout: 10_000 });
    await summon.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByRole('region', { name: 'Write mode' })).toBeVisible({ timeout: 10_000 });
    const problems = await findOverflow(page);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('guard: an appended 600 px div is reported', async ({ page }) => {
    expectViewport(page);
    await seed(page, seedState());
    await page.goto(START);
    await expect(page.getByRole('button', { name: 'Begin a Nightly Séance' })).toBeVisible();
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.id = 'overflow-guard';
      div.style.width = '600px';
      div.style.height = '10px';
      document.body.appendChild(div);
    });
    const problems = await findOverflow(page);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toContain('div#overflow-guard');
  });
});
