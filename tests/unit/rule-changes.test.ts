// Unit tests for the Rule_Changes_File (harder-ghosts task 15.3).
//
// Fixtures are generated into temp directories. Nothing here touches the real
// data files.
//
// Requirements: 18.9, 18.10, 18.13, 18.19
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAllLevels,
  defaultPaths,
  formatAllLevelsReport,
  writeAllLevels,
} from '../../scripts/build-data';
import type { AllLevelsOptions, AllLevelsPaths } from '../../scripts/build-data';
import { LEGEND_SOURCE } from '../../app/src/data/citations';
import { legendCharacters } from '../../scripts/lib/legend-strokes';
import { README_END_MARKER, README_START_MARKER } from '../../scripts/lib/prompt-counts';
import { RULE_CHANGES_HEADER, renderRuleChangesCsv } from '../../scripts/lib/rule-changes';
import { sha256Hex } from '../../scripts/lib/verify-sha256';
import type { RuleChange } from '../../app/src/data/types';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function chars(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCodePoint(start + i));
}
const L1 = chars(0x4e00, 32);
const L2 = chars(0x4f00, 52);
const L3 = chars(0x5000, 55);

/** Characters whose first gloss is a "(Tw)" gloss, which the Clue_Rule skips. */
const TW = new Set([L1[0], L2[0], L2[1], L2[2], L2[3], L3[0], L3[2]]);
/** The second gloss of L2[2] needs CSV quoting. */
const QUOTED = L2[2];

interface Fixture {
  options: AllLevelsOptions;
  paths: AllLevelsPaths;
}

function makeFixture(withTw: boolean): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-script-rule-changes-'));
  tempDirs.push(dir);
  const all = [...L1, ...L2, ...L3];
  const hanziWriterDataDir = join(dir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDataDir);
  for (const c of all) {
    writeFileSync(
      join(hanziWriterDataDir, `${c}.json`),
      JSON.stringify({ strokes: ['M 1 2 L 3 4'], medians: [[[1, 2], [3, 4]]], radStrokes: [] }),
    );
  }
  // The legend line's strokes are built by every all-levels build.
  for (const c of legendCharacters(LEGEND_SOURCE.zh)) {
    if (all.includes(c)) continue;
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
  writeFileSync(
    ccCedictPath,
    all
      .map((c) => {
        if (!withTw || !TW.has(c)) return `${c} ${c} [hao3] /good/`;
        const second = c === QUOTED ? 'good, fine "q"' : 'good';
        return `${c} ${c} [hao3] /(Tw) taiwan thing/${second}/`;
      })
      .join('\n') + '\n',
  );
  const unihanPath = join(dir, 'unihan.txt');
  writeFileSync(
    unihanPath,
    all.map((c) => `U+${(c.codePointAt(0) as number).toString(16).toUpperCase()}\tkCangjie\tMM`).join('\n') + '\n',
  );
  const list = (name: string, items: string[]): string => {
    const path = join(dir, name);
    writeFileSync(path, `${items.join('\n')}\n`);
    return path;
  };
  const overrides2 = join(dir, 'prompt-overrides-level2.csv');
  writeFileSync(overrides2, `character,entryIndex,meaningIndex,reviewedBy\n${L2[0]},0,0,human\n`);
  const approvals = join(dir, 'prompt-approvals.csv');
  writeFileSync(approvals, `character,reviewedBy\n${L3[0]},human\n`);
  const hskCharsPath = join(dir, 'hsk30-chars.csv');
  writeFileSync(hskCharsPath, 'Hanzi,Level,WritingLevel,Traditional,Freq,Examples\n');
  const options: AllLevelsOptions = {
    hanziWriterDataDir,
    makeMeAHanziPath,
    ccCedictPath,
    unihanPath,
    unihanSha256: sha256Hex(readFileSync(unihanPath)),
    promptApprovalsPath: approvals,
    hskCharsPath,
    levels: {
      1: { characterListPath: list('character-list.txt', L1) },
      2: { characterListPath: list('character-list-level2.txt', L2), promptOverridesPath: overrides2 },
      3: { characterListPath: list('character-list-level3.txt', L3) },
    },
  };
  const out = join(dir, 'out');
  mkdirSync(out);
  const paths = defaultPaths(out);
  for (const sub of ['app/public/data', 'app/src/data', 'data']) {
    mkdirSync(join(out, sub), { recursive: true });
  }
  writeFileSync(paths.readme, `# R\n${README_START_MARKER}\nold\n${README_END_MARKER}\nend\n`);
  return { options, paths };
}

describe('renderRuleChangesCsv', () => {
  const change = (over: Partial<RuleChange>): RuleChange => ({
    character: 'A',
    level: 2,
    oldPinyin: 'a',
    oldMeaning: 'old',
    newPinyin: 'b',
    newMeaning: 'new',
    ...over,
  });

  it('writes only the fixed header when there are no changes', () => {
    expect(RULE_CHANGES_HEADER).toBe('character,level,oldPinyin,oldMeaning,newPinyin,newMeaning');
    expect(renderRuleChangesCsv([])).toBe(`${RULE_CHANGES_HEADER}\n`);
  });

  it('keeps the given order and ends every line with a newline', () => {
    const csv = renderRuleChangesCsv([
      change({ character: 'B', level: 2 }),
      change({ character: 'A', level: 3 }),
    ]);
    expect(csv).toBe(`${RULE_CHANGES_HEADER}\nB,2,a,old,b,new\nA,3,a,old,b,new\n`);
  });

  it('quotes commas, quotes and newlines like the Review_Files', () => {
    const csv = renderRuleChangesCsv([
      change({ oldMeaning: 'x, y', newMeaning: 'say "hi"', oldPinyin: 'l1\nl2' }),
    ]);
    expect(csv).toBe(`${RULE_CHANGES_HEADER}\nA,2,"l1\nl2","x, y",b,"say ""hi"""\n`);
  });

  it('gives identical bytes on two runs', () => {
    const changes = [change({ newMeaning: 'a,b' }), change({ character: 'C', level: 3 })];
    expect(renderRuleChangesCsv(changes)).toBe(renderRuleChangesCsv(changes));
  });
});

describe('buildAllLevels ruleChangesCsv', () => {
  it('lists changed level 2 then level 3 characters in list order, with quoting', async () => {
    const f = makeFixture(true);
    const result = await buildAllLevels(f.options);
    if (!result.ok) throw new Error('build failed');
    expect(result.ruleChangesCsv).toBe(
      [
        RULE_CHANGES_HEADER,
        `${L2[1]},2,hǎo,(Tw) taiwan thing,hǎo,good`,
        `${L2[2]},2,hǎo,(Tw) taiwan thing,hǎo,"good, fine ""q"""`,
        `${L2[3]},2,hǎo,(Tw) taiwan thing,hǎo,good`,
        `${L3[0]},3,hǎo,(Tw) taiwan thing,hǎo,good`,
        `${L3[2]},3,hǎo,(Tw) taiwan thing,hǎo,good`,
        '',
      ].join('\n'),
    );
  });

  it('has no row for level 1 or an override character, and keeps an approval character', async () => {
    const f = makeFixture(true);
    const result = await buildAllLevels(f.options);
    if (!result.ok) throw new Error('build failed');
    for (const c of [L1[0], L2[0]]) {
      expect(result.ruleChangesCsv).not.toContain(`${c},`);
    }
    expect(result.ruleChangesCsv).toContain(`${L3[0]},3,`);
  });

  it('has no row when the Clue_Rule leaves every prompt as it was', async () => {
    const f = makeFixture(false);
    const result = await buildAllLevels(f.options);
    if (!result.ok) throw new Error('build failed');
    expect(result.ruleChangesCsv).toBe(`${RULE_CHANGES_HEADER}\n`);
  });

  it('is identical on two builds', async () => {
    const f = makeFixture(true);
    const a = await buildAllLevels(f.options);
    const b = await buildAllLevels(f.options);
    if (!a.ok || !b.ok) throw new Error('build failed');
    expect(Buffer.from(b.ruleChangesCsv).equals(Buffer.from(a.ruleChangesCsv))).toBe(true);
  });

  it('is written with the other files, and the report prints the counts', async () => {
    const f = makeFixture(true);
    const result = await buildAllLevels(f.options);
    if (!result.ok) throw new Error('build failed');
    await writeAllLevels(result, f.paths);
    expect(readFileSync(f.paths.ruleChanges, 'utf8')).toBe(result.ruleChangesCsv);
    expect(f.paths.ruleChanges.endsWith('data/prompt-rule-changes.csv')).toBe(true);
    expect(formatAllLevelsReport(result, f.paths, '/')).toContain(
      'Prompt rule changes: level 2: 3, level 3: 2, total: 5\n',
    );
  });

  it('writes nothing when a level fails to build', async () => {
    const f = makeFixture(true);
    rmSync(join(f.options.hanziWriterDataDir, `${L2[5]}.json`));
    const result = await buildAllLevels(f.options);
    expect(result.ok).toBe(false);
    expect(existsSync(f.paths.ruleChanges)).toBe(false);
  });
});
