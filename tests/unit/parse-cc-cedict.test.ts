// Unit tests for parseCcCedict.
//
// Fixtures are real CC-CEDICT lines copied verbatim from
// data/raw/cc-cedict/cedict_ts.u8 (release 2026-11-06). See
// tests/fixtures/README.md for provenance. No dictionary data is invented.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseCcCedict } from '../../scripts/lib/parse-cc-cedict.js';

const fixturePath = fileURLToPath(
  new URL('../fixtures/cc-cedict/sample-cedict.u8', import.meta.url),
);
const sample = readFileSync(fixturePath, 'utf8');

describe('parseCcCedict', () => {
  it('parses a single entry into correct pinyin and meanings arrays', () => {
    const map = parseCcCedict(sample);
    const entry = map.get('口');

    expect(entry).toBeDefined();
    expect(entry?.pinyin).toEqual(['kou3']);
    expect(entry?.meanings).toEqual([
      'mouth',
      'classifier for things with mouths (people, domestic animals, cannons, wells etc)',
      'classifier for bites or mouthfuls',
    ]);
  });

  it('deduplicates pinyin/meanings across multiple entries, preserving first-occurrence order', () => {
    const map = parseCcCedict(sample);
    const entry = map.get('行');

    expect(entry).toBeDefined();
    // 行 has three source entries in file order: hang2, heng2, xing2.
    expect(entry?.pinyin).toEqual(['hang2', 'heng2', 'xing2']);

    // Meanings accumulate across all three entries in first-occurrence order
    // with no duplicates.
    expect(entry?.meanings).toEqual([
      '(bound form) row; line',
      '(bound form) line of business; trade; profession',
      '(bound form) commercial firm',
      "(bound form) to rank (first, second etc) among one's siblings (by age)",
      '(in data tables) row; (Tw) column',
      'classifier for rows or lines',
      'used in 道行[dao4 heng2]',
      '(bound form) to walk; to go; to travel',
      '(literary) trip; journey; visit',
      '(bound form) temporary; makeshift',
      '(bound form) current; in circulation',
      '(bound form) to do; to perform',
      'capable; competent',
      'all right; OK!; will do',
      'behavior; conduct (Taiwan pr. [xing4])',
      '(literary) about to; soon',
    ]);

    // No duplicates survived.
    expect(new Set(entry?.meanings).size).toBe(entry?.meanings.length);
    expect(new Set(entry?.pinyin).size).toBe(entry?.pinyin.length);
  });

  it('skips comment lines', () => {
    const map = parseCcCedict(sample);

    // The fixture header has several `#`-prefixed lines; none should become keys.
    for (const key of map.keys()) {
      expect(key.startsWith('#')).toBe(false);
    }
    // Only the four data-line simplified strings are present.
    expect([...map.keys()].sort()).toEqual(['人', '口', '行'].sort());
  });

  it('omits a character that has no entry from the Map', () => {
    const map = parseCcCedict(sample);

    expect(map.has('龍')).toBe(false);
    expect(map.get('龍')).toBeUndefined();
  });
});
