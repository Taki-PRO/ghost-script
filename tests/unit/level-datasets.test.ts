// Plain unit tests over the three Level_Datasets, the Level_Lists, the
// Review_Files and the Level_Manifest (harder-ghosts, task 5.4).
//
// Requirements: 3.1, 3.3, 3.4, 3.8, 3.9, 3.10, 3.11, 3.12, 4.4, 4.6, 5.1
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CharacterRecord, Level } from '../../app/src/data/types';
import { isPlayableInCangjie } from '../../app/src/engine/cangjieRules';
import { classifySummonInk, isValidSummonInk } from '../../app/src/engine/summonInk';
import { buildManifest, LEVEL_FILES, serialiseManifest } from '../../scripts/lib/levels';
import { numberedToToneMarks } from '../../scripts/lib/prompt';
import { parseUnihanCangjie } from '../../scripts/lib/parse-unihan';
import { parseCsv } from '../helpers/csv';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const LEVELS: readonly Level[] = [1, 2, 3];
const COUNTS: Record<Level, number> = { 1: 300, 2: 400, 3: 500 };
const LIST_FILES: Record<Level, string> = {
  1: 'data/character-list.txt',
  2: 'data/character-list-level2.txt',
  3: 'data/character-list-level3.txt',
};
const REVIEW_FILES: Record<Level, string> = {
  1: 'data/prompt-review.csv',
  2: 'data/prompt-review-level2.csv',
  3: 'data/prompt-review-level3.csv',
};
const NOT_PLAYABLE: Record<Level, string[]> = {
  1: ['别', '错'],
  2: ['广', '换', '压', '灭'],
  3: ['历', '内', '敌', '锻', '镜', '宽', '亏', '杀', '贡'],
};

const fileText: Record<Level, string> = {
  1: read(`app/public/data/${LEVEL_FILES[1]}`),
  2: read(`app/public/data/${LEVEL_FILES[2]}`),
  3: read(`app/public/data/${LEVEL_FILES[3]}`),
};
const datasets = {
  1: JSON.parse(fileText[1]) as Record<string, CharacterRecord>,
  2: JSON.parse(fileText[2]) as Record<string, CharacterRecord>,
  3: JSON.parse(fileText[3]) as Record<string, CharacterRecord>,
} satisfies Record<Level, Record<string, CharacterRecord>>;
const lists: Record<Level, string[]> = {
  1: readList(LIST_FILES[1]),
  2: readList(LIST_FILES[2]),
  3: readList(LIST_FILES[3]),
};
const unihan = parseUnihanCangjie(read('data/raw/unihan/Unihan_DictionaryLikeData.txt'));

function readList(rel: string): string[] {
  return read(rel)
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'));
}

/** Pinyin readings of a record's entries in tone-mark form, lower and as written. */
function toneReadings(rec: CharacterRecord): Set<string> {
  return new Set(rec.pinyin.map((reading) => numberedToToneMarks(reading)));
}

describe.each(LEVELS)('level %i dataset', (level) => {
  const data = datasets[level];
  const entries = Object.entries(data);

  it(`has ${COUNTS[level]} records`, () => {
    expect(entries).toHaveLength(COUNTS[level]);
  });

  it('agrees with its Level_List character for character, in order', () => {
    // The dataset file is keyed in code point order, not list order.
    expect(Object.keys(data).sort()).toEqual([...lists[level]].sort());
    for (const [char, rec] of entries) expect(rec.character, char).toBe(char);
  });

  it('has every required field', () => {
    for (const [char, rec] of entries) {
      expect(rec.pinyin.length, `${char} pinyin`).toBeGreaterThan(0);
      expect(rec.meanings.length, `${char} meanings`).toBeGreaterThan(0);
      expect(Number.isInteger(rec.strokeCount) && rec.strokeCount >= 1, `${char} strokes`).toBe(true);
      expect(rec.strokeData.strokes.length, `${char} strokeData`).toBe(rec.strokeCount);
      expect(rec.decomposition, `${char} decomposition`).toBeTruthy();
      expect(rec.prompt.meaning, `${char} prompt meaning`).not.toBe('');
      expect(rec.prompt.pinyin, `${char} prompt pinyin`).not.toBe('');
      expect(rec.sources, `${char} sources`).toBeTruthy();
      expect(rec.cangjie === null || typeof rec.cangjie === 'string', char).toBe(true);
    }
  });

  it('has valid components', () => {
    for (const [char, rec] of entries) {
      const { components, atomic, decomposition } = rec.decomposition;
      for (const c of components) {
        expect(Array.from(c), `${char} component ${c}`).toHaveLength(1);
        if (!atomic) expect(decomposition, `${char} component ${c} is in the IDS`).toContain(c);
      }
      if (atomic) expect(components, `${char} atomic`).toEqual([char]);
      // Empty only when the IDS has no known leaf (every leaf is ？).
      const leaves = Array.from(decomposition).filter(
        (c) => !/[\u2FF0-\u2FFB]/.test(c) && c !== '？',
      );
      if (leaves.length > 0) expect(components.length, `${char} components`).toBeGreaterThan(0);
    }
  });

  it('every cangjie equals the verbatim Unihan value and sources.cangjie is right', () => {
    for (const [char, rec] of entries) {
      const raw = unihan.get(char) ?? [];
      if (rec.cangjie === null) {
        expect(raw, `${char} raw`).toEqual([]);
        expect(rec.sources.cangjie, `${char} source`).toBe('missing');
      } else {
        expect(rec.cangjie, `${char} shape`).toMatch(/^[A-Y]{1,5}$/);
        expect(raw, `${char} raw`).toEqual([rec.cangjie]);
        expect(rec.sources.cangjie, `${char} source`).toBe('unihan');
      }
    }
  });

  it('the not-Playable characters are exactly the named set', () => {
    const others = entries
      .filter(([, rec]) => !isPlayableInCangjie(rec.cangjie))
      .map(([char]) => char);
    expect(others.sort()).toEqual([...NOT_PLAYABLE[level]].sort());
  });

  it('summonInk is valid and equals the classifier for every record', () => {
    for (const [char, rec] of entries) {
      expect(isValidSummonInk(rec.summonInk, rec.cangjie, rec.strokeCount), char).toBe(true);
      expect(rec.summonInk, char).toEqual(classifySummonInk(rec));
    }
  });

  it(level === 1 ? 'has no promptReview on any record' : 'has promptReview on every record', () => {
    for (const [char, rec] of entries) {
      if (level === 1) {
        expect(rec.promptReview, char).toBeUndefined();
      } else {
        expect(['reviewed', 'unreviewed'], char).toContain(rec.promptReview);
      }
    }
  });

  it('every prompt is one of the record\'s own meanings with a reading of the same entry', () => {
    for (const [char, rec] of entries) {
      const meanings = rec.meanings.map((m) => m.replace(/^\(bound form\) /, '').trim());
      expect(meanings, `${char} prompt meaning`).toContain(rec.prompt.meaning);
      expect(toneReadings(rec), `${char} prompt pinyin`).toContain(rec.prompt.pinyin);
    }
  });

  it('its Review_File has the header and one row per character in list order', () => {
    const rows = parseCsv(read(REVIEW_FILES[level]));
    expect(rows[0]).toEqual([
      'character',
      'chosenMeaning',
      'chosenPinyin',
      'source',
      'reviewedBy',
      'alternatives',
    ]);
    const body = rows.slice(1);
    expect(body.map((r) => r[0])).toEqual(lists[level]);
    for (const row of body) {
      expect(row, row[0]).toHaveLength(6);
      expect(row[1], `${row[0]} meaning`).toBe(data[row[0]].prompt.meaning);
      expect(row[2], `${row[0]} pinyin`).toBe(data[row[0]].prompt.pinyin);
    }
  });
});

describe('the three levels together', () => {
  it('share no character', () => {
    const all = [...lists[1], ...lists[2], ...lists[3]];
    expect(new Set(all).size).toBe(1200);
  });

  it('levels.json equals what buildManifest returns for the files', () => {
    const manifest = buildManifest(
      LEVELS.map((level) => ({
        level,
        order: lists[level],
        records: new Map(Object.entries(datasets[level])),
      })),
      (c) => JSON.parse(read(`data/raw/hanzi-writer-data/${c}.json`)).strokes,
    );
    expect(read('app/public/data/levels.json')).toBe(serialiseManifest(manifest));
  });
});

describe('file layout', () => {
  it('level 2 and 3 files are minified and parse equal to the pretty form', () => {
    for (const level of [2, 3] as const) {
      expect(fileText[level].includes('\n'), `level ${level} newline`).toBe(false);
      const pretty = JSON.stringify(datasets[level], null, 2);
      expect(JSON.parse(pretty)).toEqual(JSON.parse(fileText[level]));
      expect(fileText[level]).toBe(JSON.stringify(datasets[level]));
    }
  });

  it('characters.json is still pretty-printed', () => {
    expect(fileText[1].includes('\n')).toBe(true);
    expect(fileText[1].startsWith('{\n  "')).toBe(true);
    expect(fileText[1].trimEnd()).toBe(JSON.stringify(datasets[1], null, 2));
  });
});
