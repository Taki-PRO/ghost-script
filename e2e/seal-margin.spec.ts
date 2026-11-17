import { expect, test, type Page } from '@playwright/test';
import type { CharacterRecord } from '../app/src/data/types';
import { learningOrder } from '../app/src/engine/learningOrder';
import {
  START,
  boxGap,
  datasetMap,
  datasetRecord,
  layToRestClean,
  paperBox,
  seed,
  seedBefore,
  sealBox,
  strokeBoxes,
} from './helpers';
// Seal margin (Requirements 13.1, 13.10, 13.11, 13.13, 13.14): after a clean
// outcome the Seal_Stamp lies inside the paper, in its bottom-right margin, and
// at least 2 px away from every stroke path of the writer. Characters, codes
// and strokes are all read from the dataset at test time.
const MIN_GAP_PX = 2;
const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 375, height: 812 },
] as const;
const SEAL_NAME = /^Seal:/;

function playable(record: CharacterRecord): boolean {
  return record.cangjie !== null;
}

/**
 * Characters to check, in learning order where it matters: 明 (design), the
 * first playable character after the walkthrough ghost, the playable character whose medians reach furthest
 * into the bottom-right corner of the 1024 square (high x, low y), and the one
 * whose medians span the widest.
 */
function chosenCharacters(): string[] {
  const map = datasetMap();
  const records = learningOrder(map)
    .map((c) => map.get(c))
    .filter((r): r is CharacterRecord => r !== undefined && playable(r));
  // The very first character is the walkthrough ghost of an empty history (see
  // `seedBefore`), so the "first playable" ghost is the second one.
  const first = records[1];
  if (!first) throw new Error('fewer than two playable characters in the dataset');
  let corner = first;
  let cornerScore = -Infinity;
  let wide = first;
  let wideSpan = -Infinity;
  for (const r of records) {
    const pts = r.strokeData.medians.flat();
    if (pts.length === 0) continue;
    const score = Math.max(...pts.map(([x, y]) => x - y));
    if (score > cornerScore) {
      cornerScore = score;
      corner = r;
    }
    const span = Math.max(...pts.map(([x]) => x)) - Math.min(...pts.map(([x]) => x));
    if (span > wideSpan) {
      wideSpan = span;
      wide = r;
    }
  }
  const out = ['明', first.character, corner.character, wide.character].filter((c) => map.has(c));
  return [...new Set(out)];
}

async function beginAt(page: Page, character: string): Promise<void> {
  await seed(page, seedBefore(character));
  await page.goto(START);
  await page.getByRole('button', { name: 'Begin a Nightly Séance' }).click();
  await expect(page.getByRole('region', { name: 'Summon step' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('region', { name: "Ghost's clue" })).toContainText(
    datasetRecord(character).prompt.pinyin,
  );
}

for (const character of chosenCharacters()) {
  for (const vp of VIEWPORTS) {
    test(`seal stays in the margin, clear of the strokes: ${character} at ${vp.width} x ${vp.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await beginAt(page, character);
      expect(await page.getByRole('img', { name: SEAL_NAME }).count(), 'a seal exists during Summon').toBe(0);

      await layToRestClean(page, character);
      await page.waitForTimeout(500); // let the 300 ms stamp finish
      await expect(page.getByRole('img', { name: `Seal: ${character}` })).toHaveCount(1);

      const seal = await sealBox(page);
      const paper = await paperBox(page);
      const detail = `${character} ${vp.width}x${vp.height}: seal ${JSON.stringify(seal)}, paper ${JSON.stringify(paper)}`;
      expect(seal.left, detail).toBeGreaterThanOrEqual(paper.left);
      expect(seal.top, detail).toBeGreaterThanOrEqual(paper.top);
      expect(seal.right, detail).toBeLessThanOrEqual(paper.right);
      expect(seal.bottom, detail).toBeLessThanOrEqual(paper.bottom);
      // Bottom-right margin: the seal's centre lies in the lower right quarter of the paper.
      expect((seal.left + seal.right) / 2, detail).toBeGreaterThan((paper.left + paper.right) / 2);
      expect((seal.top + seal.bottom) / 2, detail).toBeGreaterThan((paper.top + paper.bottom) / 2);

      const boxes = await strokeBoxes(page);
      expect(boxes.length, `${character}: no stroke paths found in the writer SVG`).toBeGreaterThan(0);
      const minGap = Math.min(...boxes.map((b) => boxGap(b, seal)));
      console.log(`MIN_GAP ${character} ${vp.width}x${vp.height}: ${minGap.toFixed(1)} px over ${boxes.length} paths`);
      expect(minGap, `${detail}: closest stroke path is ${minGap.toFixed(1)} px from the seal`).toBeGreaterThanOrEqual(
        MIN_GAP_PX,
      );
    });
  }
}

test('no seal after a give-up', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[0]);
  const character = chosenCharacters()[0]!;
  await beginAt(page, character);
  const summon = page.getByRole('region', { name: 'Summon step' });
  await summon.getByRole('button', { name: 'Give up' }).click();
  const write = page.getByRole('region', { name: 'Write mode' });
  await expect(write).toBeVisible({ timeout: 10_000 });
  expect(await page.getByRole('img', { name: SEAL_NAME }).count(), 'a seal exists during writing').toBe(0);
  await write.getByRole('button', { name: 'Give up' }).click();
  await expect(page.getByRole('button', { name: /^(Next ghost|Finish the séance)$/ })).toBeVisible({
    timeout: 10_000,
  });
  await page.waitForTimeout(500);
  expect(await page.getByRole('img', { name: SEAL_NAME }).count(), 'a seal exists after a give-up').toBe(0);
});
