// Exhaustive unit test over every record of the generated dataset: the Cangjie
// code is always the verbatim Unihan kCangjie value, never derived.
//
// Requirements: 1.3, 1.4, 1.5, 1.9, 1.10, 9.3
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isPlayableInCangjie } from '../../app/src/engine/cangjieRules';
import { parseUnihanCangjie } from '../../scripts/lib/parse-unihan';

interface Row {
  cangjie: string | null;
  sources: { cangjie: string };
}

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const dataset = JSON.parse(read('../../app/public/data/characters.json')) as Record<string, Row>;
const raw = parseUnihanCangjie(read('../../data/raw/unihan/Unihan_DictionaryLikeData.txt'));
const entries = Object.entries(dataset);

describe('Cangjie codes in characters.json', () => {
  it('has 300 records', () => {
    expect(entries).toHaveLength(300);
  });

  it('every non-null code matches ^[A-Y]{1,5}$ and equals the single raw Unihan value', () => {
    for (const [char, rec] of entries) {
      if (rec.cangjie === null) continue;
      expect(rec.cangjie, `${char} code shape`).toMatch(/^[A-Y]{1,5}$/);
      expect(raw.get(char), `${char} raw value`).toEqual([rec.cangjie]);
    }
  });

  it('a null code has no raw Unihan value', () => {
    for (const [char, rec] of entries) {
      if (rec.cangjie !== null) continue;
      expect(raw.get(char) ?? [], `${char} raw values`).toEqual([]);
    }
  });

  it('sources.cangjie is "unihan" exactly when cangjie is non-null', () => {
    for (const [char, rec] of entries) {
      expect(rec.sources.cangjie, `${char} source`).toBe(
        rec.cangjie !== null ? 'unihan' : 'missing',
      );
    }
  });

  it('298 characters are Playable and the others are exactly 别 and 错', () => {
    const playable = entries.filter(([, rec]) => isPlayableInCangjie(rec.cangjie));
    const others = entries
      .filter(([, rec]) => !isPlayableInCangjie(rec.cangjie))
      .map(([char]) => char)
      .sort();
    expect(playable).toHaveLength(298);
    expect(others).toEqual(['别', '错'].sort());
  });
});

// Levels 2 and 3 (harder-ghosts): the same verbatim-code rules, every record.
const NOT_PLAYABLE_BY_LEVEL: ReadonlyArray<readonly [2 | 3, number, string[]]> = [
  [2, 400, ['广', '换', '压', '灭']],
  [3, 500, ['历', '内', '敌', '锻', '镜', '宽', '亏', '杀', '贡']],
];

describe.each(NOT_PLAYABLE_BY_LEVEL)(
  'Cangjie codes in characters-level%i.json (%i records)',
  (level, count, notPlayable) => {
    const levelData = JSON.parse(
      read(`../../app/public/data/characters-level${level}.json`),
    ) as Record<string, Row>;
    const levelEntries = Object.entries(levelData);

    it(`has ${count} records`, () => {
      expect(levelEntries).toHaveLength(count);
    });

    it('every code is the single raw Unihan value, or null with no raw value', () => {
      for (const [char, rec] of levelEntries) {
        if (rec.cangjie === null) {
          expect(raw.get(char) ?? [], `${char} raw values`).toEqual([]);
        } else {
          expect(rec.cangjie, `${char} code shape`).toMatch(/^[A-Y]{1,5}$/);
          expect(raw.get(char), `${char} raw value`).toEqual([rec.cangjie]);
        }
      }
    });

    it('sources.cangjie is "unihan" exactly when cangjie is non-null', () => {
      for (const [char, rec] of levelEntries) {
        expect(rec.sources.cangjie, `${char} source`).toBe(
          rec.cangjie !== null ? 'unihan' : 'missing',
        );
      }
    });

    it('the not-Playable characters are exactly the named set', () => {
      const others = levelEntries
        .filter(([, rec]) => !isPlayableInCangjie(rec.cangjie))
        .map(([char]) => char)
        .sort();
      expect(others).toEqual([...notPlayable].sort());
    });
  },
);
