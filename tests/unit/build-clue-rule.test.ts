// Unit tests for wiring the Clue_Rule into the build (harder-ghosts task 15.2):
// levels 2 and 3 only, override and approval precedence, the Chinese-character
// gate, and the dataset and Review_File agreeing through one helper.
//
// Requirements: harder-ghosts 18.1, 18.2, 18.7, 18.8, 18.10, 18.11
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDataset, formatError } from '../../scripts/build-data';
import { sha256Hex } from '../../scripts/lib/verify-sha256';
import type { BuildOptions, CharacterRecord } from '../../app/src/data/types';

const unihanPath = fileURLToPath(new URL('../fixtures/unihan/valid.txt', import.meta.url));
const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const OVERRIDE_HEADER = 'character,entryIndex,meaningIndex,reviewedBy';
const CEDICT = [
  '鸟 鸟 [diao3] /penis/',
  '鸟 鸟 [niao3] /bird/',
  '鸟巢 鸟巢 [niao3 chao2] /bird\'s nest/',
  '好 好 [hao3] /good/',
  '好 好 [hao3] /same as 的/',
];
const HSK = 'Hanzi,Level,WritingLevel,Traditional,Freq,Examples\n鸟,1,1,鳥,100,鸟 鸟巢\n好,1,1,好,100,\n';

interface Fixture {
  chars: string[];
  overrides?: string[];
  approvals?: string[];
  level?: 2 | 3;
  withHsk?: boolean;
}

function makeOptions(f: Fixture): BuildOptions {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-script-clue-'));
  tempDirs.push(dir);
  const hanziWriterDataDir = join(dir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDataDir);
  for (const c of f.chars) {
    writeFileSync(
      join(hanziWriterDataDir, `${c}.json`),
      JSON.stringify({ strokes: ['M 1 2 L 3 4'], medians: [[[1, 2], [3, 4]]], radStrokes: [] }),
    );
  }
  const characterListPath = join(dir, 'list.txt');
  writeFileSync(characterListPath, `${f.chars.join('\n')}\n`);
  const makeMeAHanziPath = join(dir, 'dictionary.txt');
  writeFileSync(
    makeMeAHanziPath,
    f.chars.map((c) => JSON.stringify({ character: c, decomposition: '？', radical: c })).join('\n') + '\n',
  );
  const ccCedictPath = join(dir, 'cedict_ts.u8');
  writeFileSync(ccCedictPath, `${CEDICT.join('\n')}\n`);
  const opts: BuildOptions = {
    characterListPath,
    hanziWriterDataDir,
    makeMeAHanziPath,
    ccCedictPath,
    unihanPath,
    unihanSha256: sha256Hex(readFileSync(unihanPath)),
  };
  if (f.overrides !== undefined) {
    opts.promptOverridesPath = join(dir, 'overrides.csv');
    writeFileSync(opts.promptOverridesPath, `${[OVERRIDE_HEADER, ...f.overrides].join('\n')}\n`);
  }
  if (f.approvals !== undefined) {
    opts.promptApprovalsPath = join(dir, 'approvals.csv');
    writeFileSync(opts.promptApprovalsPath, `${['character,reviewedBy', ...f.approvals].join('\n')}\n`);
  }
  if (f.withHsk === true) {
    opts.hskCharsPath = join(dir, 'hsk30-chars.csv');
    writeFileSync(opts.hskCharsPath, HSK);
  }
  if (f.level !== undefined) opts.level = f.level;
  return opts;
}

async function records(opts: BuildOptions): Promise<Record<string, CharacterRecord>> {
  const result = await buildDataset(opts);
  if (!result.ok) throw new Error(`build failed: ${JSON.stringify(result.errors)}`);
  return JSON.parse(result.output) as Record<string, CharacterRecord>;
}

describe('Clue_Rule wiring', () => {
  it('level 2 with the HSK CSV uses the Clue_Rule and the Review_File agrees', async () => {
    const result = await buildDataset(makeOptions({ chars: ['鸟'], level: 2, withHsk: true }));
    if (!result.ok) throw new Error('expected ok');
    const rec = (JSON.parse(result.output) as Record<string, CharacterRecord>)['鸟'];
    expect(rec.prompt).toEqual({ meaning: 'bird', pinyin: 'niǎo' });
    const row = result.promptReviewCsv.split('\n')[1] ?? '';
    expect(row.startsWith('鸟,bird,niǎo,default,,')).toBe(true);
  });

  it('level 2 without the HSK path keeps the Current_Rule', async () => {
    const rec = (await records(makeOptions({ chars: ['鸟'], level: 2 })))['鸟'];
    expect(rec.prompt).toEqual({ meaning: 'penis', pinyin: 'diǎo' });
  });

  it('level 1 ignores the HSK path: output identical with and without it', async () => {
    const withPath = await buildDataset(makeOptions({ chars: ['鸟'], withHsk: true }));
    const without = await buildDataset(makeOptions({ chars: ['鸟'] }));
    if (!withPath.ok || !without.ok) throw new Error('expected ok');
    expect(withPath.output).toBe(without.output);
    expect(withPath.promptReviewCsv).toBe(without.promptReviewCsv);
    expect((JSON.parse(withPath.output) as Record<string, CharacterRecord>)['鸟'].prompt.meaning).toBe('penis');
  });

  it('an override wins over the Clue_Rule, and an approval keeps the Current_Rule prompt', async () => {
    const overridden = await buildDataset(
      makeOptions({ chars: ['鸟'], level: 2, withHsk: true, overrides: ['鸟,0,0,human'] }),
    );
    if (!overridden.ok) throw new Error('expected ok');
    const o = (JSON.parse(overridden.output) as Record<string, CharacterRecord>)['鸟'];
    expect(o.prompt.meaning).toBe('penis');
    expect(o.promptReview).toBe('reviewed');
    expect(overridden.promptReviewCsv.split('\n')[1]).toContain('鸟,penis,diǎo,override,human,');

    const approved = await buildDataset(
      makeOptions({ chars: ['鸟'], level: 2, withHsk: true, approvals: ['鸟,human'] }),
    );
    if (!approved.ok) throw new Error('expected ok');
    const a = (JSON.parse(approved.output) as Record<string, CharacterRecord>)['鸟'];
    expect(a.prompt.meaning).toBe('penis');
    expect(a.promptReview).toBe('reviewed');
    expect(approved.promptReviewCsv.split('\n')[1]).toContain('鸟,penis,diǎo,default,human,');
  });

  it('the dataset prompt equals the Review_File chosen values for every character', async () => {
    const result = await buildDataset(
      makeOptions({ chars: ['鸟', '好'], level: 3, withHsk: true, overrides: ['好,0,0,human'] }),
    );
    if (!result.ok) throw new Error('expected ok');
    const data = JSON.parse(result.output) as Record<string, CharacterRecord>;
    const rows = result.promptReviewCsv.trim().split('\n').slice(1);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const [ch, meaning, pinyin] = row.split(',');
      expect(data[ch].prompt).toEqual({ meaning, pinyin });
    }
  });
});

describe('Chinese-character gate', () => {
  it('fails level 2 naming the character, the level and the override file', async () => {
    const result = await buildDataset(
      makeOptions({ chars: ['好'], level: 2, withHsk: true, overrides: ['好,1,0,human'] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect('output' in result).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.character).toBe('好');
    expect(result.errors[0]?.promptFailure).toBe('chinese-in-meaning');
    const text = formatError(result.errors[0] as never);
    expect(text).toContain('好');
    expect(text).toContain('level 2');
    expect(text).toContain('data/prompt-overrides-level2.csv');
  });

  it('level 1 is not gated', async () => {
    const result = await buildDataset(makeOptions({ chars: ['好'], overrides: ['好,1,0,human-approved'] }));
    expect(result.ok).toBe(true);
  });
});
