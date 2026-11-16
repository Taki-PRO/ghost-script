// Unit tests for the Cangjie part of the build: the lists returned on success,
// the summary text, the failure report, and the hash checks.
//
// Requirements: 1.3, 1.4, 1.5, 1.9, 1.10, 2.6, 9.3
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildDataset,
  formatCangjieErrors,
  formatCangjieSummary,
  formatSummonInkSummary,
} from '../../scripts/build-data';
import {
  Sha256MismatchError,
  readRecordedSha256,
  sha256Hex,
} from '../../scripts/lib/verify-sha256';
import type { BuildOptions } from '../../app/src/data/types';

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../fixtures/unihan/${name}.txt`, import.meta.url));

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Writes minimal complete sources for `chars` and returns build options. */
function makeOptions(
  chars: string[],
  unihanPath: string,
  unihanSha256: string = sha256Hex(readFileSync(unihanPath)),
): { options: BuildOptions; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-script-summary-'));
  tempDirs.push(dir);
  const hanziWriterDataDir = join(dir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDataDir);
  for (const c of chars) {
    writeFileSync(
      join(hanziWriterDataDir, `${c}.json`),
      JSON.stringify({ strokes: ['M 1 2 L 3 4'], medians: [[[1, 2], [3, 4]]], radStrokes: [] }),
    );
  }
  const characterListPath = join(dir, 'character-list.txt');
  writeFileSync(characterListPath, `${chars.join('\n')}\n`);
  const makeMeAHanziPath = join(dir, 'dictionary.txt');
  writeFileSync(
    makeMeAHanziPath,
    chars.map((c) => JSON.stringify({ character: c, decomposition: '？', radical: c })).join('\n') + '\n',
  );
  const ccCedictPath = join(dir, 'cedict_ts.u8');
  writeFileSync(ccCedictPath, chars.map((c) => `${c} ${c} [hao3] /good/`).join('\n') + '\n');
  return {
    options: { characterListPath, hanziWriterDataDir, makeMeAHanziPath, ccCedictPath, unihanPath, unihanSha256 },
    dir,
  };
}

describe('build result lists', () => {
  it('cangjieMissing lists characters without a value; none are Playable-excluded by it', async () => {
    const { options } = makeOptions(['人', '一'], fixture('missing-character'));
    const result = await buildDataset(options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cangjieMissing).toEqual(['人']);
    expect(result.notPlayable).toEqual(['人']);
    const records = JSON.parse(result.output) as Record<string, { cangjie: string | null }>;
    expect(records['人']?.cangjie).toBeNull();
    expect(records['一']?.cangjie).toBe('M');
  });

  it('reports no missing and no unplayable characters for the valid fixture', async () => {
    const { options } = makeOptions(['我', '一', '人', '口'], fixture('valid'));
    const result = await buildDataset(options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cangjieMissing).toEqual([]);
    expect(result.notPlayable).toEqual([]);
  });

  it('notPlayable lists X-prefixed codes (synthetic input)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ghost-script-unihan-'));
    tempDirs.push(dir);
    const unihanPath = join(dir, 'synthetic.txt');
    writeFileSync(unihanPath, 'U+6211\tkCangjie\tHQI\nU+522B\tkCangjie\tXCTA\n');
    const { options } = makeOptions(['我', '别'], unihanPath);
    const result = await buildDataset(options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.notPlayable).toEqual(['别']);
    expect(result.cangjieMissing).toEqual([]);
  });
});

describe('summary text', () => {
  it('states coverage, characters without a code, the Playable count and the not-Playable list', () => {
    expect(formatCangjieSummary(300, [], ['别', '错'])).toBe(
      'Cangjie code: 300 of 300 characters have one.\n' +
        'Without a Cangjie code: none\n' +
        'Playable in Cangjie: 298 of 300\n' +
        'Not playable in Cangjie: 别 错\n',
    );
  });

  it('lists every character without a code and says "none" for an empty not-Playable list', () => {
    expect(formatCangjieSummary(4, ['人', '口'], [])).toBe(
      'Cangjie code: 2 of 4 characters have one.\n' +
        'Without a Cangjie code: 人 口\n' +
        'Playable in Cangjie: 4 of 4\n' +
        'Not playable in Cangjie: none\n',
    );
  });
});

describe('summon ink summary', () => {
  it('prints the three class counts on one line', () => {
    expect(formatSummonInkSummary({ transparent: 15, partial: 95, opaque: 190 })).toBe(
      'Summon ink: transparent 15, partial 95, opaque 190\n',
    );
  });

  it('the build returns counts that add up to the record count and match the stored classes', async () => {
    const { options } = makeOptions(['我', '一', '人', '口'], fixture('valid'));
    const result = await buildDataset(options);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const records = JSON.parse(result.output) as Record<string, { summonInk: { class: string } }>;
    const { transparent, partial, opaque } = result.summonInkCounts;
    expect(transparent + partial + opaque).toBe(Object.keys(records).length);
    for (const cls of ['transparent', 'partial', 'opaque'] as const) {
      expect(result.summonInkCounts[cls]).toBe(
        Object.values(records).filter((r) => r.summonInk.class === cls).length,
      );
    }
  });
});

describe('invalid Cangjie values fail the build', () => {
  it('a malformed value fails, naming the character and value, with no output', async () => {
    const { options, dir } = makeOptions(['我', '一', '人', '口'], fixture('malformed-value'));
    const result = await buildDataset(options);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cangjieErrors).toEqual([
      { character: '一', values: ['m1'], reason: 'invalid-format' },
      { character: '人', values: [''], reason: 'invalid-format' },
      { character: '口', values: ['R S'], reason: 'invalid-format' },
    ]);
    expect(formatCangjieErrors(result.cangjieErrors)).toContain('一: m1 (invalid-format)');
    expect(readdirSync(dir)).not.toContain('characters.json');
  });

  it('a duplicate value fails, naming the character and both values', async () => {
    const { options } = makeOptions(['我', '一'], fixture('duplicate-value'));
    const result = await buildDataset(options);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.cangjieErrors).toEqual([
      { character: '我', values: ['HQI', 'HQIO'], reason: 'multiple-values' },
    ]);
    expect(formatCangjieErrors(result.cangjieErrors)).toBe('我: HQI, HQIO (multiple-values)');
  });
});

describe('Unihan hash check', () => {
  it('a hash mismatch rejects with Sha256MismatchError and returns no output', async () => {
    const wrong = '0'.repeat(64);
    const { options, dir } = makeOptions(['我'], fixture('valid'), wrong);
    const before = readdirSync(dir).sort();
    await expect(buildDataset(options)).rejects.toBeInstanceOf(Sha256MismatchError);
    expect(readdirSync(dir).sort()).toEqual(before);
  });

  it('a missing recorded hash is reported as null so the build cannot start', () => {
    const sourcesMd = '# Sources\n\n- **SHA-256 (Unihan.zip):** ' + 'a'.repeat(64) + '\n';
    expect(readRecordedSha256(sourcesMd, 'Unihan_DictionaryLikeData.txt')).toBeNull();
  });
});
