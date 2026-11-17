// Unit tests for buildAllLevels / writeAllLevels (harder-ghosts task 5.3).
//
// Fixtures are generated into temp directories: three small levels (level 1
// has 4 characters, levels 2 and 3 have 52 and 55 so a 50-row Review_Sample
// exists). Nothing here touches the real data files.
//
// Requirements: 3.1 to 3.8, 3.12, 3.13, 4.1 to 4.6, 4.10, 4.13, 5.1, 5.2
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildAllLevels,
  defaultPaths,
  formatAllLevelsFailures,
  formatAllLevelsReport,
  writeAllLevels,
} from '../../scripts/build-data';
import type { AllLevelsOptions, AllLevelsPaths } from '../../scripts/build-data';
import { README_END_MARKER, README_START_MARKER } from '../../scripts/lib/prompt-counts';
import { sha256Hex } from '../../scripts/lib/verify-sha256';
import type { CharacterRecord } from '../../app/src/data/types';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** `count` consecutive CJK characters from codepoint `start`. */
function chars(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCodePoint(start + i));
}
const L1 = chars(0x4e00, 4);
const L2 = chars(0x4f00, 52);
const L3 = chars(0x5000, 55);

const REVIEW_HEADER = 'character,chosenMeaning,chosenPinyin,source,reviewedBy,alternatives';

interface Fixture {
  dir: string;
  options: AllLevelsOptions;
  paths: AllLevelsPaths;
}

/** Writes complete sources and level lists for the three fixture levels. */
function makeFixture(extra: { overrides2?: string; approvals?: string; skipStrokes?: string[] } = {}): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-script-all-levels-'));
  tempDirs.push(dir);
  const all = [...L1, ...L2, ...L3];
  const hanziWriterDataDir = join(dir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDataDir);
  for (const c of all) {
    if (extra.skipStrokes?.includes(c)) continue;
    writeFileSync(
      join(hanziWriterDataDir, `${c}.json`),
      JSON.stringify({ strokes: ['M 1 2 L 3 4'], medians: [[[1, 2], [3, 4]]], radStrokes: [] }),
    );
  }
  const makeMeAHanziPath = join(dir, 'dictionary.txt');
  writeFileSync(
    makeMeAHanziPath,
    all.map((c) => JSON.stringify({ character: c, decomposition: '？', radical: c })).join('\n') + '\n',
  );
  const ccCedictPath = join(dir, 'cedict_ts.u8');
  writeFileSync(ccCedictPath, all.map((c) => `${c} ${c} [hao3] /good/`).join('\n') + '\n');
  const unihanPath = join(dir, 'unihan.txt');
  writeFileSync(
    unihanPath,
    all.map((c) => `U+${(c.codePointAt(0) as number).toString(16).toUpperCase()}\tkCangjie\tMM`).join('\n') + '\n',
  );
  const list = (name: string, list: string[]): string => {
    const path = join(dir, name);
    writeFileSync(path, `${list.join('\n')}\n`);
    return path;
  };
  const l1 = list('character-list.txt', L1);
  const l2 = list('character-list-level2.txt', L2);
  const l3 = list('character-list-level3.txt', L3);
  const overrides2 = join(dir, 'prompt-overrides-level2.csv');
  if (extra.overrides2 !== undefined) writeFileSync(overrides2, extra.overrides2);
  const approvals = join(dir, 'prompt-approvals.csv');
  if (extra.approvals !== undefined) writeFileSync(approvals, extra.approvals);

  const options: AllLevelsOptions = {
    hanziWriterDataDir,
    makeMeAHanziPath,
    ccCedictPath,
    unihanPath,
    unihanSha256: sha256Hex(readFileSync(unihanPath)),
    promptApprovalsPath: approvals,
    levels: {
      1: { characterListPath: l1 },
      2: { characterListPath: l2, promptOverridesPath: overrides2 },
      3: { characterListPath: l3, promptOverridesPath: join(dir, 'prompt-overrides-level3.csv') },
    },
  };
  const out = join(dir, 'out');
  mkdirSync(out);
  const paths = defaultPaths(out);
  for (const sub of ['app/public/data', 'app/src/data', 'data']) {
    mkdirSync(join(out, sub), { recursive: true });
  }
  writeFileSync(paths.readme, `# R\n${README_START_MARKER}\nold\n${README_END_MARKER}\nend\n`);
  return { dir, options, paths };
}

const OVERRIDES2 = `character,entryIndex,meaningIndex,reviewedBy\n${L2[0]},0,0,human\n`;
const APPROVALS = `character,reviewedBy\n${L3[0]},human\n`;

async function buildOk(fixture: Fixture) {
  const result = await buildAllLevels(fixture.options);
  if (!result.ok) throw new Error(formatAllLevelsFailures(result.failures));
  return result;
}

function rowOf(csv: string, character: string): string {
  const row = csv.split('\n').find((line) => line.startsWith(`${character},`));
  if (row === undefined) throw new Error(`no row for ${character}`);
  return row;
}

describe('buildAllLevels promptReview', () => {
  it('marks override and approval rows reviewed, the rest unreviewed, and level 1 gets no field', async () => {
    const f = makeFixture({ overrides2: OVERRIDES2, approvals: APPROVALS });
    const result = await buildOk(f);
    const [b1, b2, b3] = result.levels;
    const r1 = JSON.parse(b1.output) as Record<string, CharacterRecord>;
    const r2 = JSON.parse(b2.output) as Record<string, CharacterRecord>;
    const r3 = JSON.parse(b3.output) as Record<string, CharacterRecord>;
    expect(Object.keys(r1)).toHaveLength(4);
    expect(Object.keys(r2)).toHaveLength(52);
    expect(Object.keys(r3)).toHaveLength(55);
    expect(Object.values(r1).every((r) => !('promptReview' in r))).toBe(true);
    expect(r2[L2[0]].promptReview).toBe('reviewed'); // override row
    expect(r2[L2[1]].promptReview).toBe('unreviewed'); // neither
    expect(r3[L3[0]].promptReview).toBe('reviewed'); // approval row
    expect(r3[L3[1]].promptReview).toBe('unreviewed');
    expect(result.promptCounts).toMatchObject({
      level2: { reviewed: 1, unreviewed: 51, total: 52 },
      level3: { reviewed: 1, unreviewed: 54, total: 55 },
      reviewed: 2,
      unreviewed: 105,
      total: 107,
    });
  });

  it('with no overrides or approvals files every level 2 and 3 record is unreviewed', async () => {
    const result = await buildOk(makeFixture());
    expect(result.promptCounts.reviewed).toBe(0);
    expect(result.promptCounts.unreviewed).toBe(107);
  });

  it('an approval for a character in no later level throws', async () => {
    const f = makeFixture({ approvals: `character,reviewedBy\n${L1[0]},human\n` });
    await expect(buildAllLevels(f.options)).rejects.toThrow(/neither level 2 nor level 3/);
  });

  it('a level 2 override with a reviewer other than human throws', async () => {
    const f = makeFixture({
      overrides2: `character,entryIndex,meaningIndex,reviewedBy\n${L2[0]},0,0,someone\n`,
    });
    await expect(buildAllLevels(f.options)).rejects.toThrow(/prompt-overrides-level2\.csv failed validation/);
  });
});

describe('buildAllLevels output', () => {
  it('level 1 is pretty-printed; levels 2 and 3 are minified and parse equal to a pretty form', async () => {
    const result = await buildOk(makeFixture({ overrides2: OVERRIDES2 }));
    const [b1, b2, b3] = result.levels;
    expect(b1.output).toContain('\n  ');
    expect(b2.output).not.toContain('\n');
    expect(b3.output).not.toContain('\n');
    expect(JSON.parse(JSON.stringify(JSON.parse(b2.output), null, 2))).toEqual(JSON.parse(b2.output));
  });

  it('is deterministic: two builds give identical bytes for every file', async () => {
    const f = makeFixture({ overrides2: OVERRIDES2, approvals: APPROVALS });
    const a = await buildOk(f);
    const b = await buildOk(f);
    expect(b).toEqual(a);
  });

  it('Review_Files have the header and one row per character; reviewedBy is human or empty', async () => {
    const result = await buildOk(makeFixture({ overrides2: OVERRIDES2, approvals: APPROVALS }));
    const csv2 = result.levels[1].promptReviewCsv;
    const csv3 = result.levels[2].promptReviewCsv;
    expect(csv2.split('\n')[0]).toBe(REVIEW_HEADER);
    expect(csv2.trimEnd().split('\n')).toHaveLength(1 + 52);
    expect(csv3.trimEnd().split('\n')).toHaveLength(1 + 55);
    expect(rowOf(csv2, L2[0])).toContain(',override,human,');
    expect(rowOf(csv2, L2[1])).toContain(',default,,');
    expect(rowOf(csv3, L3[0])).toContain(',default,human,');
    expect(rowOf(csv3, L3[1])).toContain(',default,,');
    for (const csv of [csv2, csv3]) {
      for (const line of csv.trimEnd().split('\n').slice(1)) {
        const reviewedBy = line.split(',')[4];
        expect(['human', '']).toContain(reviewedBy);
      }
    }
  });

  it('builds the manifest: three levels in order, counts, files, three example meanings each', async () => {
    const result = await buildOk(makeFixture());
    expect(result.manifest.levels.map((l) => [l.level, l.file, l.count])).toEqual([
      [1, 'characters.json', 4],
      [2, 'characters-level2.json', 52],
      [3, 'characters-level3.json', 55],
    ]);
    for (const info of result.manifest.levels) {
      expect(info.averageStrokes).toBe(1);
      expect(info.exampleMeanings).toEqual(['good', 'good', 'good']);
    }
    expect(JSON.parse(result.manifestJson)).toEqual(result.manifest);
    expect(result.manifestJson.endsWith('\n')).toBe(true);
  });

  it('samples have 50 rows each of that level and the provenance names both seeds', async () => {
    const result = await buildOk(makeFixture());
    for (const level of [2, 3] as const) {
      const lines = result.samples[level].trimEnd().split('\n');
      expect(lines[0]).toBe(REVIEW_HEADER);
      expect(new Set(lines.slice(1)).size).toBe(50);
      const csv = result.levels[level - 1].promptReviewCsv.split('\n');
      for (const line of lines.slice(1)) expect(csv).toContain(line);
    }
    const provenance = JSON.parse(result.provenanceJson) as {
      levels: Record<string, { rows: number; source: string }>;
    };
    expect(provenance.levels['2']).toMatchObject({ rows: 52, source: 'data/prompt-review-level2.csv' });
    expect(provenance.levels['3']).toMatchObject({ rows: 55, source: 'data/prompt-review-level3.csv' });
  });
});

describe('buildAllLevels failures', () => {
  it('a failure in two levels lists both, grouped by level, and returns no output', async () => {
    const f = makeFixture({ skipStrokes: [L2[3], L3[5]] });
    const before = readdirSync(f.dir).sort();
    const result = await buildAllLevels(f.options);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((x) => x.level)).toEqual([2, 3]);
    const text = formatAllLevelsFailures(result.failures);
    expect(text).toMatch(/Level 2:[\s\S]*Level 3:/);
    expect(text).toContain(L2[3]);
    expect(text).toContain(L3[5]);
    expect(text).toContain('No output written.');
    expect(readdirSync(f.dir).sort()).toEqual(before);
    expect(readdirSync(join(f.dir, 'out/data'))).toEqual([]);
  });

  it('a failure in one level still builds and reports the others as not failed', async () => {
    const f = makeFixture({ skipStrokes: [L3[0]] });
    const result = await buildAllLevels(f.options);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((x) => x.level)).toEqual([3]);
  });
});

describe('writeAllLevels and the report', () => {
  it('writes every file, leaves no temp file, and fills the README block and counts module', async () => {
    const f = makeFixture({ overrides2: OVERRIDES2, approvals: APPROVALS });
    const result = await buildOk(f);
    await writeAllLevels(result, f.paths);

    expect(readFileSync(f.paths.datasets[1], 'utf8')).toBe(result.levels[0].output);
    expect(readFileSync(f.paths.datasets[2], 'utf8')).toBe(result.levels[1].output);
    expect(readFileSync(f.paths.datasets[3], 'utf8')).toBe(result.levels[2].output);
    expect(readFileSync(f.paths.manifest, 'utf8')).toBe(result.manifestJson);
    expect(readFileSync(f.paths.reviewFiles[1], 'utf8')).toBe(result.levels[0].promptReviewCsv);
    expect(readFileSync(f.paths.reviewFiles[2], 'utf8')).toBe(result.levels[1].promptReviewCsv);
    expect(readFileSync(f.paths.reviewFiles[3], 'utf8')).toBe(result.levels[2].promptReviewCsv);
    expect(readFileSync(f.paths.samples[2], 'utf8')).toBe(result.samples[2]);
    expect(readFileSync(f.paths.samples[3], 'utf8')).toBe(result.samples[3]);
    expect(readFileSync(f.paths.provenance, 'utf8')).toBe(result.provenanceJson);

    const counts = readFileSync(f.paths.countsModule, 'utf8');
    expect(counts).toContain('export const PROMPT_COUNTS');
    expect(counts).toContain('total: 107');
    const readme = readFileSync(f.paths.readme, 'utf8');
    expect(readme).toContain(result.readmeBlock);
    expect(readme).not.toContain('\nold\n');
    expect(readme.startsWith('# R\n')).toBe(true);

    for (const dir of ['app/public/data', 'app/src/data', 'data']) {
      expect(readdirSync(join(f.dir, 'out', dir)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    }
  });

  it('a README without the markers throws before any file is written', async () => {
    const f = makeFixture();
    const result = await buildOk(f);
    writeFileSync(f.paths.readme, '# no markers\n');
    await expect(writeAllLevels(result, f.paths)).rejects.toThrow(/missing the marker/);
    expect(existsSync(f.paths.datasets[1])).toBe(false);
    expect(existsSync(f.paths.manifest)).toBe(false);
    expect(readdirSync(join(f.dir, 'out/data'))).toEqual([]);
  });

  it('prints per-level Cangjie and summon-ink lines and one line per data file with bytes', async () => {
    const f = makeFixture();
    const result = await buildOk(f);
    const report = formatAllLevelsReport(result, f.paths, join(f.dir, 'out'));
    for (const level of [1, 2, 3]) expect(report).toContain(`Level ${level}:`);
    expect(report.match(/^Cangjie code: /gm)).toHaveLength(3);
    expect(report.match(/^Summon ink: /gm)).toHaveLength(3);
    const fileLines = report.split('\n').filter((l) => / bytes gzip$/.test(l));
    expect(fileLines).toHaveLength(4);
    expect(fileLines[0]).toBe(
      `app/public/data/characters.json  4 records  ${Buffer.byteLength(result.levels[0].output)} bytes  ` +
        `${/\d+(?= bytes gzip$)/.exec(fileLines[0])?.[0]} bytes gzip`,
    );
    expect(fileLines[1]).toMatch(/^app\/public\/data\/characters-level2\.json {2}52 records {2}\d+ bytes {2}\d+ bytes gzip$/);
    expect(fileLines[2]).toMatch(/^app\/public\/data\/characters-level3\.json {2}55 records /);
    expect(fileLines[3]).toMatch(/^app\/public\/data\/levels\.json {2}3 records /);
  });
});
