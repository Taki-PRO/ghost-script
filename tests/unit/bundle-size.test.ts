import { describe, expect, it } from 'vitest';
import {
  BUNDLE_BUDGET_BYTES,
  compareFirstLoad,
  FIRST_LOAD_TOLERANCE,
  firstLoad,
  isLazy,
  lazyFiles,
  parseReadmeFirstLoad,
  roundedKb,
  summariseBundle,
  withinTolerance,
  type SizedFile,
} from '../../scripts/check-bundle-size';

const f = (path: string, gzipBytes: number): SizedFile => ({ path, gzipBytes });

describe('summariseBundle', () => {
  it('has a budget of 300,000 bytes', () => {
    expect(BUNDLE_BUDGET_BYTES).toBe(300_000);
  });

  it('is ok when under budget', () => {
    const r = summariseBundle([f('a.js', 100_000), f('b.css', 5)]);
    expect(r.total).toBe(100_005);
    expect(r.ok).toBe(true);
  });

  it('is ok when exactly at budget', () => {
    const r = summariseBundle([f('a.js', 299_999), f('b.css', 1)]);
    expect(r.total).toBe(BUNDLE_BUDGET_BYTES);
    expect(r.ok).toBe(true);
  });

  it('is not ok when one byte over budget', () => {
    const r = summariseBundle([f('a.js', 300_000), f('b.css', 1)]);
    expect(r.total).toBe(300_001);
    expect(r.ok).toBe(false);
  });

  it('excludes data/characters.json from total and list', () => {
    const r = summariseBundle([f('data/characters.json', 900_000), f('a.js', 10)]);
    expect(r.total).toBe(10);
    expect(r.ok).toBe(true);
    expect(r.largest.map((x) => x.path)).toEqual(['a.js']);
  });

  it('does not count the lazy level datasets or level fonts', () => {
    const r = summariseBundle([
      f('data/characters-level2.json', 900_000),
      f('data/characters-level3.json', 900_000),
      f('assets/lxgw-wenkai-subset-level2-abc123.woff2', 400_000),
      f('assets/lxgw-wenkai-subset-level3-def456.woff2', 400_000),
      f('a.js', 10),
    ]);
    expect(r.total).toBe(10);
    expect(r.ok).toBe(true);
    expect(r.largest.map((x) => x.path)).toEqual(['a.js']);
  });

  it('counts other data files and the level 1 font', () => {
    const r = summariseBundle([
      f('data/levels.json', 2_000),
      f('assets/lxgw-wenkai-subset-abc.woff2', 3_000),
      f('a.js', 10),
    ]);
    expect(r.total).toBe(5_010);
    expect(isLazy('data/levels.json')).toBe(false);
    expect(isLazy('assets/lxgw-wenkai-subset-abc.woff2')).toBe(false);
  });

  it('fails when counted files are over budget even beside lazy files', () => {
    const r = summariseBundle([
      f('data/levels.json', 300_001),
      f('data/characters-level2.json', 1),
    ]);
    expect(r.ok).toBe(false);
  });

  it('lists lazy files with their sizes, sorted by path', () => {
    const files: SizedFile[] = [
      { path: 'a.js', gzipBytes: 1, rawBytes: 2 },
      { path: 'data/characters-level3.json', gzipBytes: 30, rawBytes: 300 },
      { path: 'data/characters.json', gzipBytes: 10, rawBytes: 100 },
    ];
    expect(lazyFiles(files).map((x) => [x.path, x.rawBytes, x.gzipBytes])).toEqual([
      ['data/characters-level3.json', 300, 30],
      ['data/characters.json', 100, 10],
    ]);
  });

  it('keeps only the five largest, biggest first', () => {
    const files = [1, 2, 3, 4, 5, 6, 7].map((n) => f(`f${n}.js`, n * 10));
    const r = summariseBundle(files);
    expect(r.largest.map((x) => x.path)).toEqual(['f7.js', 'f6.js', 'f5.js', 'f4.js', 'f3.js']);
    expect(r.total).toBe(280);
  });

  it('handles an empty list', () => {
    expect(summariseBundle([])).toEqual({ total: 0, ok: true, largest: [] });
  });
});

describe('firstLoad', () => {
  it('adds the level 1 dataset to the counted bundle', () => {
    const r = firstLoad([f('a.js', 100), f('b.css', 20), f('data/characters.json', 500)]);
    expect(r).toEqual({ counted: 120, level1: 500, total: 620 });
  });

  it('does not count the other lazy files in any figure', () => {
    const r = firstLoad([
      f('a.js', 10),
      f('data/characters.json', 50),
      f('data/characters-level2.json', 900),
      f('assets/lxgw-wenkai-subset-level3-x.woff2', 400),
    ]);
    expect(r).toEqual({ counted: 10, level1: 50, total: 60 });
  });

  it('counts the legend strokes file (it is not lazy)', () => {
    expect(isLazy('data/legend-strokes.json')).toBe(false);
    const r = firstLoad([f('a.js', 10), f('data/legend-strokes.json', 6_350), f('data/characters.json', 7)]);
    expect(r).toEqual({ counted: 6_360, level1: 7, total: 6_367 });
  });

  it('gives zero level 1 bytes when the dataset is absent, and zero for no files', () => {
    expect(firstLoad([f('a.js', 3)])).toEqual({ counted: 3, level1: 0, total: 3 });
    expect(firstLoad([])).toEqual({ counted: 0, level1: 0, total: 0 });
  });

  it('keeps the budget on the counted part only', () => {
    const files = [f('a.js', 250_000), f('data/characters.json', 361_679)];
    expect(summariseBundle(files).ok).toBe(true);
    expect(firstLoad(files).total).toBeGreaterThan(BUNDLE_BUDGET_BYTES);
  });
});

describe('roundedKb', () => {
  it('rounds to the nearest kB with .5 going up', () => {
    expect(roundedKb(0)).toBe(0);
    expect(roundedKb(499)).toBe(0);
    expect(roundedKb(500)).toBe(1);
    expect(roundedKb(1_499)).toBe(1);
    expect(roundedKb(1_500)).toBe(2);
    expect(roundedKb(583_662)).toBe(584);
    expect(roundedKb(230_447)).toBe(230);
  });
});

describe('withinTolerance', () => {
  it('allows a difference of 1% of the printed figure and no more', () => {
    expect(FIRST_LOAD_TOLERANCE).toBe(0.01);
    expect(withinTolerance(101_000, 100_000)).toBe(true);
    expect(withinTolerance(99_000, 100_000)).toBe(true);
    expect(withinTolerance(101_001, 100_000)).toBe(false);
    expect(withinTolerance(98_999, 100_000)).toBe(false);
  });
});

describe('README first-load comparison', () => {
  const text = (tKb: string, cKb: string, c: string, l: string, t: string): string =>
    `Real first load: about ${tKb} kB gzipped, of which about ${cKb} kB counts against the 300 kB budget.\n\n` +
    `Exact figures, as printed by \`npm run check:bundle\`: ${c} bytes counted + ${l} bytes level 1 dataset = ${t} bytes. The budget is 300,000 bytes.`;
  const printed = { counted: 230_447, level1: 353_215, total: 583_662 };
  const stated = { ...printed, countedKb: 230, totalKb: 584 };

  it('parses the exact and the rounded figures', () => {
    expect(parseReadmeFirstLoad(text('584', '230', '230,447', '353,215', '583,662'))).toEqual(stated);
  });
  it('returns null when the README has no figures or only one of the two places', () => {
    expect(parseReadmeFirstLoad('# Title\nNo sizes here.')).toBeNull();
    expect(parseReadmeFirstLoad(text('584', '230', '1', '2', '3').split('\n\n')[0] ?? '')).toBeNull();
    expect(parseReadmeFirstLoad(text('584', '230', '1', '2', '3').split('\n\n')[1] ?? '')).toBeNull();
  });
  it('passes when the figures are equal or within 1%', () => {
    expect(compareFirstLoad(stated, printed)).toEqual({ ok: true });
    expect(
      compareFirstLoad({ counted: 232_700, level1: 351_000, total: 589_400, countedKb: 232, totalKb: 589 }, printed),
    ).toEqual({ ok: true });
  });
  it.each([
    ['counted', { ...stated, counted: 232_752 }, 'counted 232752'],
    ['level1', { ...stated, level1: 356_748 }, 'level1 356748'],
    ['total', { ...stated, total: 589_499 }, 'total 589499'],
  ])('fails, naming both figures, when %s is just outside 1%', (key, s, statedText) => {
    const r = compareFirstLoad(s, printed);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0]).toContain(statedText);
    expect(r.messages[0]).toContain(String(printed[key as keyof typeof printed]));
  });
  it('fails when a rounded figure is more than 1% from the printed figure', () => {
    expect(compareFirstLoad({ ...stated, countedKb: 233 }, printed).ok).toBe(false);
    expect(compareFirstLoad({ ...stated, totalKb: 590 }, printed).ok).toBe(false);
  });
  it('fails when the figures could not be parsed', () => {
    const r = compareFirstLoad(null, printed);
    expect(r.ok).toBe(false);
  });
});
