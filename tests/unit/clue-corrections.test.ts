// Unit tests for the exact-match guard of the approved clue corrections
// (proof-pass task 5.2). Fixtures only; no real dictionary data.
//
// Requirements: proof-pass 2.1, 2.2, 2.3
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDataset } from '../../scripts/build-data';
import {
  CLUE_CORRECTIONS,
  checkClueCorrections,
  matchingPairs,
} from '../../scripts/lib/clue-corrections';
import type { ClueCorrection } from '../../scripts/lib/clue-corrections';
import { parseCcCedict } from '../../scripts/lib/parse-cc-cedict';
import type { PromptOverride } from '../../scripts/lib/prompt';
import { sha256Hex } from '../../scripts/lib/verify-sha256';
import type { BuildOptions } from '../../app/src/data/types';

const unihanPath = fileURLToPath(new URL('../fixtures/unihan/valid.txt', import.meta.url));
const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const FIXTURE_CORRECTION: ClueCorrection = { character: '本', level: 1, text: 'root; stem' };
const ONE_PAIR = ['本 本 [ben3] /(bound form) root; stem/classifier/', '本 本 [ben3] /this/'];
const ZERO_PAIRS = ['本 本 [ben3] /book/'];
const TWO_PAIRS = ['本 本 [ben3] /root; stem/', '本 本 [ben3] /(bound form) root; stem/'];

const cedict = (lines: string[]) => parseCcCedict(`${lines.join('\n')}\n`);
const override = (entryIndex: number, meaningIndex: number): Map<string, PromptOverride> =>
  new Map([['本', { character: '本', entryIndex, meaningIndex, reviewedBy: 'human' }]]);
const level1 = new Set(['本']);

describe('matchingPairs', () => {
  it('finds one pair and strips the bound-form prefix', () => {
    const entry = cedict(ONE_PAIR).get('本')!;
    expect(matchingPairs(entry, 'root; stem')).toEqual([{ entryIndex: 0, meaningIndex: 0 }]);
  });
  it('finds no pair for a different text', () => {
    expect(matchingPairs(cedict(ZERO_PAIRS).get('本')!, 'root; stem')).toEqual([]);
  });
  it('finds two pairs when two glosses strip to the text', () => {
    expect(matchingPairs(cedict(TWO_PAIRS).get('本')!, 'root; stem')).toHaveLength(2);
  });
});

describe('checkClueCorrections', () => {
  const run = (lines: string[], overrides: Map<string, PromptOverride>) =>
    checkClueCorrections(1, level1, cedict(lines), overrides, [FIXTURE_CORRECTION]);

  it('passes with exactly one pair and the matching override', () => {
    expect(run(ONE_PAIR, override(0, 0))).toEqual([]);
  });
  it('fails with zero pairs, naming the character, the text and the count', () => {
    const [msg] = run(ZERO_PAIRS, override(0, 0));
    expect(msg).toContain('本');
    expect(msg).toContain('root; stem');
    expect(msg).toContain('matches 0 pairs');
  });
  it('fails with two pairs, naming the count', () => {
    const [msg] = run(TWO_PAIRS, override(0, 0));
    expect(msg).toContain('matches 2 pairs');
  });
  it('fails when the override row is missing', () => {
    expect(run(ONE_PAIR, new Map())[0]).toContain('no override row');
  });
  it('fails when the override selects another pair', () => {
    expect(run(ONE_PAIR, override(0, 1))[0]).toContain('override row selects (0,1)');
  });
  it('skips characters outside the level list and other levels', () => {
    const none = checkClueCorrections(1, new Set(['我']), cedict(ZERO_PAIRS), new Map(), [FIXTURE_CORRECTION]);
    const other = checkClueCorrections(2, level1, cedict(ZERO_PAIRS), new Map(), [FIXTURE_CORRECTION]);
    expect(none).toEqual([]);
    expect(other).toEqual([]);
  });
});

describe('CLUE_CORRECTIONS', () => {
  it('lists exactly the five approved corrections and not 么', () => {
    expect(CLUE_CORRECTIONS.map((c) => `${c.character}:${c.level}:${c.text}`)).toEqual([
      '本:1:root; stem',
      '天:1:sky',
      '云:2:cloud',
      '刚:2:just; only a short while ago',
      '获:3:to reap; to harvest',
    ]);
  });
});

describe('buildDataset guard', () => {
  function makeOptions(lines: string[], overrides: string[]): { opts: BuildOptions; dir: string } {
    const dir = mkdtempSync(join(tmpdir(), 'ghost-script-clue-guard-'));
    tempDirs.push(dir);
    const hanziWriterDataDir = join(dir, 'hanzi-writer-data');
    mkdirSync(hanziWriterDataDir);
    writeFileSync(
      join(hanziWriterDataDir, '本.json'),
      JSON.stringify({ strokes: ['M 1 2 L 3 4'], medians: [[[1, 2], [3, 4]]], radStrokes: [] }),
    );
    const characterListPath = join(dir, 'list.txt');
    writeFileSync(characterListPath, '本\n');
    const makeMeAHanziPath = join(dir, 'dictionary.txt');
    writeFileSync(makeMeAHanziPath, `${JSON.stringify({ character: '本', decomposition: '？', radical: '木' })}\n`);
    const ccCedictPath = join(dir, 'cedict_ts.u8');
    writeFileSync(ccCedictPath, `${lines.join('\n')}\n`);
    const promptOverridesPath = join(dir, 'overrides.csv');
    writeFileSync(promptOverridesPath, `${['character,entryIndex,meaningIndex,reviewedBy', ...overrides].join('\n')}\n`);
    return {
      dir,
      opts: {
        characterListPath,
        hanziWriterDataDir,
        makeMeAHanziPath,
        ccCedictPath,
        unihanPath,
        unihanSha256: sha256Hex(readFileSync(unihanPath)),
        promptOverridesPath,
      },
    };
  }

  it('throws naming the character, text and count, and writes no file', async () => {
    const { opts, dir } = makeOptions(TWO_PAIRS, ['本,0,0,human']);
    const before = readdirSync(dir).sort();
    await expect(buildDataset(opts)).rejects.toThrow(/本.*root; stem.*matches 2 pairs/);
    expect(readdirSync(dir).sort()).toEqual(before);
  });

  it('throws when the override row is missing', async () => {
    const { opts } = makeOptions(ONE_PAIR, []);
    await expect(buildDataset(opts)).rejects.toThrow(/no override row/);
  });
});
