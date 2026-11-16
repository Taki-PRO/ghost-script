// Unit tests for prompt-override failures in the build: out-of-range indices and
// unknown characters fail the build with no output, and the error text tells the
// reader which file and column to fix.
//
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.3
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { buildDataset, formatError } from '../../scripts/build-data';
import { sha256Hex } from '../../scripts/lib/verify-sha256';
import type { BuildOptions } from '../../app/src/data/types';

const unihanPath = fileURLToPath(new URL('../fixtures/unihan/valid.txt', import.meta.url));

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const HEADER = 'character,entryIndex,meaningIndex,reviewedBy';

/** Builds minimal complete sources for 我 and 一 (one CC-CEDICT entry, one meaning each). */
function makeOptions(overrideRows: string[]): BuildOptions {
  const chars = ['我', '一'];
  const dir = mkdtempSync(join(tmpdir(), 'ghost-script-override-'));
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
  const promptOverridesPath = join(dir, 'prompt-overrides.csv');
  writeFileSync(promptOverridesPath, `${[HEADER, ...overrideRows].join('\n')}\n`);
  return {
    characterListPath,
    hanziWriterDataDir,
    makeMeAHanziPath,
    ccCedictPath,
    unihanPath,
    unihanSha256: sha256Hex(readFileSync(unihanPath)),
    promptOverridesPath,
  };
}

describe('override errors fail the build', () => {
  it('entryIndex too large: fails with entry-index-out-of-range and no output', async () => {
    const result = await buildDataset(makeOptions(['我,5,0,human-approved']));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect('output' in result).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.character).toBe('我');
    expect(result.errors[0]?.overrideError).toBe('entry-index-out-of-range');
  });

  it('meaningIndex too large: fails with meaning-index-out-of-range and no output', async () => {
    const result = await buildDataset(makeOptions(['我,0,7,human-approved']));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect('output' in result).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.character).toBe('我');
    expect(result.errors[0]?.overrideError).toBe('meaning-index-out-of-range');
  });

  it('unknown character: fails with unknown-character and no output', async () => {
    const result = await buildDataset(makeOptions(['口,0,0,human-approved']));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect('output' in result).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.character).toBe('口');
    expect(result.errors[0]?.overrideError).toBe('unknown-character');
  });

  it('negative entryIndex is rejected when the CSV is parsed, before any range check', async () => {
    // The CSV parser accepts only non-negative integers, so a negative index
    // never reaches the build's range check; the build throws and writes nothing.
    await expect(buildDataset(makeOptions(['我,-1,0,human-approved']))).rejects.toThrow(
      /prompt-overrides\.csv failed validation[\s\S]*我[\s\S]*malformed-row/,
    );
  });

  it('a valid override still builds', async () => {
    const result = await buildDataset(makeOptions(['我,0,0,human-approved']));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const records = JSON.parse(result.output) as Record<string, { prompt: { meaning: string } }>;
    expect(records['我']?.prompt.meaning).toBe('good');
  });
});

describe('formatError for override failures', () => {
  it('entry-index-out-of-range names the character, reason, CSV file and column', () => {
    const text = formatError({
      character: '我',
      missingFields: [],
      overrideError: 'entry-index-out-of-range',
    });
    expect(text).toContain('我');
    expect(text).toContain('entry-index-out-of-range');
    expect(text).toContain('data/prompt-overrides.csv');
    expect(text).toContain('entryIndex');
  });

  it('meaning-index-out-of-range names the character, reason, CSV file and column', () => {
    const text = formatError({
      character: '我',
      missingFields: [],
      overrideError: 'meaning-index-out-of-range',
    });
    expect(text).toContain('我');
    expect(text).toContain('meaning-index-out-of-range');
    expect(text).toContain('data/prompt-overrides.csv');
    expect(text).toContain('meaningIndex');
  });

  it('unknown-character names the character, reason and the CSV file', () => {
    const text = formatError({
      character: '口',
      missingFields: [],
      overrideError: 'unknown-character',
    });
    expect(text).toContain('口');
    expect(text).toContain('unknown-character');
    expect(text).toContain('data/prompt-overrides.csv');
    expect(text).toContain('data/character-list.txt');
  });
});
