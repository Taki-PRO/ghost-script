// Unit tests for the pure parts of the Source_Check (harder-ghosts, task 1.1).
// The run against the real files is reported, not asserted.
//
// Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1
import { describe, expect, it } from 'vitest';
import {
  CSV_BYTES,
  CSV_LINES,
  CSV_SHA256,
  EXPECTED_NOT_PLAYABLE,
  EXPECTED_ROWS,
  SOURCE_NAMES,
  compareToExpected,
  findOverlap,
  formatDifference,
  formatReport,
  isSingleValidCangjie,
  parseHsk30Csv,
  splitByLevel,
  splitCsvLine,
  type CharacterFacts,
  type CheckedLevel,
  type SourceReport,
} from '../../scripts/check-level-sources';

function allPresent(character: string): CharacterFacts {
  const present = Object.fromEntries(SOURCE_NAMES.map((s) => [s, true])) as CharacterFacts['present'];
  return { character, present, cangjie: 'A' };
}

function equalReport(): SourceReport {
  return {
    csvBytes: CSV_BYTES,
    csvLines: CSV_LINES,
    csvSha256: CSV_SHA256,
    rows: { ...EXPECTED_ROWS },
    level1EqualsList: true,
    overlap: [],
    facts: { 2: [allPresent('广')], 3: [allPresent('历')] },
    notPlayable: {
      1: ['别', '错'],
      2: [...EXPECTED_NOT_PLAYABLE[2]],
      3: [...EXPECTED_NOT_PLAYABLE[3]],
    },
    summonInk: {
      1: { transparent: 1, partial: 2, opaque: 3 },
      2: { transparent: 9, partial: 116, opaque: 275 },
      3: { transparent: 7, partial: 140, opaque: 353 },
    },
  };
}

describe('CSV parsing and level split', () => {
  const csv = [
    'Hanzi,Level,WritingLevel,Traditional,Freq,Examples',
    '爱,1,1,愛,20,"爱 爱好, 爱情"',
    '广,2,2,廣,5,广 广场',
    '历,3,3,歷,5,历史',
    '啊,1,,啊,5,啊',
    '八,1,1,八,7,八',
    '',
  ].join('\n');

  it('splits a line with quoted commas', () => {
    expect(splitCsvLine('a,"b,c","d""e",')).toEqual(['a', 'b,c', 'd"e', '']);
  });

  it('parses Hanzi and WritingLevel, empty level as null', () => {
    const rows = parseHsk30Csv(csv);
    expect(rows).toHaveLength(5);
    expect(rows[3]).toEqual({ hanzi: '啊', level: null });
  });

  it('rejects a header without WritingLevel', () => {
    expect(() => parseHsk30Csv('Hanzi,Level\n爱,1')).toThrow();
  });

  it('splits by level in row order and ignores empty levels', () => {
    expect(splitByLevel(parseHsk30Csv(csv))).toEqual({ 1: ['爱', '八'], 2: ['广'], 3: ['历'] });
  });

  it('finds a character in two levels', () => {
    expect(findOverlap({ 1: ['爱'], 2: ['广', '爱'], 3: ['历', '广'] })).toEqual(['爱', '广']);
    expect(findOverlap({ 1: ['爱'], 2: ['广'], 3: ['历'] })).toEqual([]);
  });
});

describe('isSingleValidCangjie', () => {
  it('accepts exactly one A-Y value of 1 to 5 letters', () => {
    expect(isSingleValidCangjie(['MC'])).toBe(true);
    expect(isSingleValidCangjie(undefined)).toBe(false);
    expect(isSingleValidCangjie([])).toBe(false);
    expect(isSingleValidCangjie(['MC', 'ND'])).toBe(false);
    expect(isSingleValidCangjie(['MCNDEF'])).toBe(false);
    expect(isSingleValidCangjie(['Zz'])).toBe(false);
  });
});

describe('compareToExpected', () => {
  it('returns nothing for an equal report', () => {
    expect(compareToExpected(equalReport())).toEqual([]);
  });

  it('reports a wrong CSV size, line count and checksum', () => {
    const r = { ...equalReport(), csvBytes: 1, csvLines: 2, csvSha256: 'x' };
    expect(compareToExpected(r).map((d) => d.item)).toEqual(['csv bytes', 'csv lines', 'csv sha256']);
  });

  it('reports a wrong row count with expected and found', () => {
    const r = equalReport();
    r.rows = { 1: 300, 2: 399, 3: 500 };
    expect(compareToExpected(r)).toEqual([
      {
        item: 'rows level 2',
        level: null,
        character: null,
        source: 'hsk30-chars.csv',
        expected: '400',
        found: '399',
      },
    ]);
  });

  it('reports level 1 not equal to the list', () => {
    const r = { ...equalReport(), level1EqualsList: false };
    const diffs = compareToExpected(r);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.level).toBe(1);
  });

  it('reports an overlapping character', () => {
    const diffs = compareToExpected({ ...equalReport(), overlap: ['爱'] });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.character).toBe('爱');
  });

  it('reports each missing source for a character', () => {
    const r = equalReport();
    const bad = allPresent('换');
    r.facts[2 as CheckedLevel] = [{ ...bad, present: { ...bad.present, 'cc-cedict': false, 'font-glyph': false } }];
    const diffs = compareToExpected(r);
    expect(diffs.map((d) => [d.level, d.character, d.source, d.found])).toEqual([
      [2, '换', 'cc-cedict', 'missing'],
      [2, '换', 'font-glyph', 'missing'],
    ]);
  });

  it('reports a not-Playable character that is missing and one that is extra', () => {
    const r = equalReport();
    r.notPlayable[3] = EXPECTED_NOT_PLAYABLE[3].filter((c) => c !== '贡').concat('爱');
    const diffs = compareToExpected(r);
    expect(diffs.map((d) => [d.level, d.character, d.expected, d.found])).toEqual([
      [3, '贡', 'not Playable', 'Playable'],
      [3, '爱', 'Playable', 'not Playable'],
    ]);
  });
});

describe('formatting', () => {
  it('names every field of a difference', () => {
    const line = formatDifference({
      item: 'source lacks character',
      level: 2,
      character: '广',
      source: 'cc-cedict',
      expected: 'present',
      found: 'missing',
    });
    for (const part of ['source lacks character', '2', '广', 'cc-cedict', 'present', 'missing']) {
      expect(line).toContain(part);
    }
  });

  it('prints rows, overlap, not-Playable and summon-ink counts', () => {
    const text = formatReport(equalReport());
    expect(text).toContain('level 2 = 400 (expected 400)');
    expect(text).toContain('Characters in two levels: none');
    expect(text).toContain('Not Playable, level 2: 4 (广 换 压 灭)');
    expect(text).toContain('Summon-ink level 3: transparent 7 / partial 140 / opaque 353');
  });
});
