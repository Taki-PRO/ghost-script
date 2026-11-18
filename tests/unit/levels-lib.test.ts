// Unit tests for the level helpers (scripts/lib/levels.ts).
// Records are hand-built logic fixtures, not real dataset entries.

import { describe, it, expect } from 'vitest';
import type { CharacterRecord } from '../../app/src/data/types';
import {
  LEVEL_FILES,
  averageStrokes,
  buildManifest,
  exampleMeanings,
  formatFileReport,
  serialiseManifest,
} from '../../scripts/lib/levels';

function makeRecord(
  character: string,
  meaning: string,
  strokeCount = 2,
): CharacterRecord {
  return {
    character,
    pinyin: ['pin1'],
    meanings: [meaning],
    strokeCount,
    strokeData: { strokes: ['M 0 0'], medians: [[[0, 0]]], radStrokes: [0] },
    decomposition: {
      decomposition: '？',
      radical: character,
      etymology: null,
      matches: null,
      atomic: true,
      components: [character],
    },
    prompt: { meaning, pinyin: 'pīn' },
    cangjie: null,
    summonInk: { class: 'opaque' },
    sources: {
      pinyin: 'cc-cedict',
      meanings: 'cc-cedict',
      strokeCount: 'hanzi-writer-data',
      strokeData: 'hanzi-writer-data',
      decomposition: 'make-me-a-hanzi',
      cangjie: 'missing',
    },
  };
}

/** Characters are the keys "c0", "c1", ... so the order is easy to read. */
function build(
  meanings: readonly string[],
  strokes: (i: number) => number = () => 2,
): { order: string[]; records: Map<string, CharacterRecord> } {
  const order = meanings.map((_, i) => `c${i}`);
  const records = new Map(
    order.map((c, i) => [c, makeRecord(c, meanings[i], strokes(i))]),
  );
  return { order, records };
}

const words = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `word ${String.fromCharCode(97 + i)}`);

/** Letters-only meanings, also for more than 26 records ("word aa", "word ab", ...). */
const manyWords = (n: number): string[] =>
  Array.from(
    { length: n },
    (_, i) =>
      `word ${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`,
  );
describe('LEVEL_FILES', () => {
  it('names the three files', () => {
    expect(LEVEL_FILES).toEqual({
      1: 'characters.json',
      2: 'characters-level2.json',
      3: 'characters-level3.json',
    });
  });
});

describe('averageStrokes', () => {
  it('rounds the mean to one decimal', () => {
    const { records } = build(words(3), (i) => [7, 8, 8][i]); // 7.666...
    expect(averageStrokes(records)).toBe(7.7);
  });

  it('keeps an exact mean', () => {
    const { records } = build(words(2), (i) => [6, 8][i]);
    expect(averageStrokes(records)).toBe(7);
  });

  it('is 0 for no records', () => {
    expect(averageStrokes(new Map())).toBe(0);
  });
});

describe('exampleMeanings', () => {
  it('takes positions floor(n/4), floor(n/2) and floor(3n/4)', () => {
    const { order, records } = build(words(10)); // 2, 5, 7
    expect(exampleMeanings(order, records)).toEqual([
      'word c',
      'word f',
      'word h',
    ]);
  });

  it('skips a long meaning and a meaning with a non-letter', () => {
    const list = words(8); // positions 2, 4, 6
    list[2] = 'a meaning that is much too long to show';
    list[4] = 'number 7';
    const { order, records } = build(list);
    expect(exampleMeanings(order, records)).toEqual([
      'word d',
      'word f',
      'word g',
    ]);
  });

  it('accepts a hyphen and a space, and exactly 24 characters', () => {
    const list = words(8);
    list[2] = 'well-known thing';
    list[4] = 'abcdefghij klmnopqrstuvwx'.slice(0, 24);
    const { order, records } = build(list);
    const result = exampleMeanings(order, records);
    expect(result[0]).toBe('well-known thing');
    expect(result[1]).toHaveLength(24);
  });

  it('rejects 25 characters', () => {
    const list = words(8);
    list[2] = 'a'.repeat(25);
    const { order, records } = build(list);
    expect(exampleMeanings(order, records)[0]).toBe('word d');
  });

  it('never repeats a record when positions collide', () => {
    const { order, records } = build(words(4)); // positions 1, 2, 3
    const list = build(['x one', 'x two', 'x three', 'x four']);
    expect(exampleMeanings(order, records)).toHaveLength(3);
    expect(new Set(exampleMeanings(list.order, list.records)).size).toBe(3);
  });

  it('does not choose a record twice when an earlier search runs onto a later start', () => {
    const list = words(8); // positions 2, 4, 6
    list[2] = 'bad 1';
    list[3] = 'bad 2';
    list[4] = 'bad 3';
    list[5] = 'bad 4';
    const { order, records } = build(list);
    // first search: 6 ("word g"); second: 6 taken, so 7; third: nothing left.
    expect(exampleMeanings(order, records)).toEqual(['word g', 'word h']);
  });

  it('returns fewer than three when there are too few usable records', () => {
    const { order, records } = build(['one', '1', '2', '3', '4', '5', '6', '7']);
    expect(exampleMeanings(order, records).length).toBeLessThan(3);
  });

  it('uses the cleaned meaning', () => {
    const list = words(8);
    list[2] = 'clean me (CL:ge4)';
    const { order, records } = build(list);
    expect(exampleMeanings(order, records)[0]).toBe('clean me');
  });
});

describe('buildManifest and serialiseManifest', () => {
  // 40 + level records, so that every level has a sample candidate (position 31+).
  const inputs = [3, 1, 2].map((level) => ({
    level: level as 1 | 2 | 3,
    ...build(manyWords(40 + level), () => level + 5),
  }));
  const strokesOf = (c: string): string[] => [`M 0 0 ${c}`, 'M 1 1'];

  it('lists levels in order with file, count, average, meanings and sample', () => {
    const manifest = buildManifest(inputs, strokesOf);
    expect(manifest.levels.map((l) => l.level)).toEqual([1, 2, 3]);
    // All records have the same stroke count, so the learning order is by code
    // point and the lowest candidate position (31) wins.
    const sampleChar = [...inputs[2].order].sort()[30];
    const level2 = manifest.levels[1];
    expect(level2).toMatchObject({
      level: 2,
      file: 'characters-level2.json',
      count: 42,
      averageStrokes: 7,
      sample: { character: sampleChar, strokes: strokesOf(sampleChar) },
    });
    expect(level2.exampleMeanings).toHaveLength(3);
  });

  it('throws when a level has fewer than three usable records', () => {
    const bad = build(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(() =>
      buildManifest([inputs[1], inputs[2], { level: 3, ...bad }], strokesOf),
    ).toThrow(/level 3/);
  });

  it('throws when a level is missing', () => {
    expect(() => buildManifest([inputs[1]], strokesOf)).toThrow(/level 2/);
  });

  it('serialises with 2 spaces and one trailing newline, deterministically', () => {
    const a = serialiseManifest(buildManifest(inputs, strokesOf));
    const b = serialiseManifest(buildManifest([...inputs].reverse(), strokesOf));
    expect(a.indexOf('"sample"')).toBeGreaterThan(a.indexOf('"exampleMeanings"'));
    expect(a).toBe(b);
    expect(a.startsWith('{\n  "levels": [\n    {\n      "level": 1,')).toBe(true);
    expect(a.endsWith('}\n')).toBe(true);
    expect(a.endsWith('\n\n')).toBe(false);
    expect(JSON.parse(a)).toEqual(buildManifest(inputs, strokesOf));
  });
});

describe('formatFileReport', () => {
  it('prints path, record count, raw bytes and gzip bytes', () => {
    expect(formatFileReport('characters-level2.json', 400, 123456, 45678)).toBe(
      'characters-level2.json  400 records  123456 bytes  45678 bytes gzip',
    );
  });
});
