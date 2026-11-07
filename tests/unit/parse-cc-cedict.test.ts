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
    // Only the data-line simplified strings are present.
    expect([...map.keys()].sort()).toEqual(
      ['人', '了', '口', '行', '三', '后', '号', '中'].sort(),
    );
  });

  it('omits a character that has no entry from the Map', () => {
    const map = parseCcCedict(sample);

    expect(map.has('龍')).toBe(false);
    expect(map.get('龍')).toBeUndefined();
  });

  it('retains per-entry senses for 了 in source order with their own glosses', () => {
    const map = parseCcCedict(sample);
    const entry = map.get('了');

    expect(entry).toBeDefined();
    // 了 has two source lines in file order: le5 then liao3.
    expect(entry?.entries).toHaveLength(2);

    expect(entry?.entries[0].reading).toBe('le5');
    expect(entry?.entries[0].meanings).toEqual([
      '(completed action marker)',
      '(modal particle indicating change of state, situation now)',
      '(modal particle intensifying preceding clause)',
    ]);

    expect(entry?.entries[1].reading).toBe('liao3');
    expect(entry?.entries[1].meanings).toEqual([
      'to finish',
      '(used with 得[de2] or 不[bu4] after a verb to express (im)possibility, as in 忘不了[wang4 bu5 liao3] "cannot forget")',
      '(literary) (usually followed by a negative such as 無|无[wu2] or 不[bu4]) completely (not); entirely (not); (not) in the least',
      'variant of 瞭|了[liao3]',
    ]);

    // Flat fields remain the deduped union in first-occurrence order.
    expect(entry?.pinyin).toEqual(['le5', 'liao3']);
  });

  it('retains all three per-entry senses for 行 in source order', () => {
    const map = parseCcCedict(sample);
    const entry = map.get('行');

    expect(entry).toBeDefined();
    expect(entry?.entries).toHaveLength(3);

    expect(entry?.entries.map((sense) => sense.reading)).toEqual([
      'hang2',
      'heng2',
      'xing2',
    ]);

    expect(entry?.entries[0].meanings).toEqual([
      '(bound form) row; line',
      '(bound form) line of business; trade; profession',
      '(bound form) commercial firm',
      "(bound form) to rank (first, second etc) among one's siblings (by age)",
      '(in data tables) row; (Tw) column',
      'classifier for rows or lines',
    ]);

    expect(entry?.entries[1].meanings).toEqual(['used in 道行[dao4 heng2]']);

    expect(entry?.entries[2].meanings).toEqual([
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
  });
});
