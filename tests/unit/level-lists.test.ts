import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (p: string): Buffer => readFileSync(resolve(root, p));

const csvBytes = read('data/raw/hsk30/hsk30-chars.csv');
const csvRows = csvBytes
  .toString('utf8')
  .split('\n')
  .slice(1)
  .filter((l) => l.length > 0)
  .map((l) => l.split(','));

const csvLevel = (level: number): string[] =>
  csvRows.filter((r) => r[2] === String(level)).map((r) => r[0]);

const listFile = (p: string): string[] =>
  read(p)
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('#'));

const lists: Record<number, string[]> = {
  1: listFile('data/character-list.txt'),
  2: listFile('data/character-list-level2.txt'),
  3: listFile('data/character-list-level3.txt'),
};

describe('level lists', () => {
  it.each([1, 2, 3])('level %i list equals the CSV rows of its level in row order', (level) => {
    expect(lists[level]).toEqual(csvLevel(level));
  });

  it('has 300, 400 and 500 characters', () => {
    expect(lists[1]).toHaveLength(300);
    expect(lists[2]).toHaveLength(400);
    expect(lists[3]).toHaveLength(500);
  });

  it('shares no character between the three lists', () => {
    const all = [...lists[1], ...lists[2], ...lists[3]];
    expect(new Set(all).size).toBe(all.length);
  });

  it('every entry is one codepoint in U+4E00 to U+9FFF', () => {
    for (const level of [1, 2, 3]) {
      for (const ch of lists[level]) {
        expect([...ch]).toHaveLength(1);
        const cp = ch.codePointAt(0) as number;
        expect(cp).toBeGreaterThanOrEqual(0x4e00);
        expect(cp).toBeLessThanOrEqual(0x9fff);
      }
    }
  });

  it('the CSV SHA-256 and size equal the values in SOURCES.md', () => {
    const md = read('data/raw/SOURCES.md').toString('utf8');
    const sha = createHash('sha256').update(csvBytes).digest('hex');
    expect(md).toContain(`**SHA-256 (hsk30-chars.csv):** ${sha}`);
    expect(md).toContain(`**Size (hsk30-chars.csv):** ${csvBytes.length.toLocaleString('en-US')} bytes`);
  });

  it('level 2 and 3 files carry the header lines', () => {
    for (const level of [2, 3]) {
      const text = read(`data/character-list-level${level}.txt`).toString('utf8');
      expect(text).toContain(`rows where WritingLevel == ${level}`);
      expect(text).toContain('# Commit: 4ff9e3915ce87baaecd7ebe263085573a4ea3192');
      expect(text).toContain('# Licence: MIT');
    }
  });
});
