// No Han_Character in any Displayed_Meaning of level 2 and level 3
// (harder-ghosts, task 15.6). Plain exhaustive loops over every record.
//
// Requirements: 18.12, 18.19
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CharacterRecord } from '../../app/src/data/types';
import { maskTarget } from '../../app/src/engine/mask';
import { cleanupMeaning } from '../../app/src/engine/promptCleanup';

const ROOT = resolve(__dirname, '..', '..');
const DATA = resolve(ROOT, 'app', 'public', 'data');
const HAN = /\p{Script=Han}/u;

const FILES = [
  { level: 2, file: 'characters-level2.json' },
  { level: 3, file: 'characters-level3.json' },
] as const;

interface Manifest {
  levels: { level: number; exampleMeanings: string[] }[];
}

describe('Displayed_Meaning has no Han character (levels 2 and 3)', () => {
  for (const { level, file } of FILES) {
    const records = JSON.parse(readFileSync(resolve(DATA, file), 'utf8')) as Record<
      string,
      CharacterRecord
    >;

    it(`level ${level}: cleaned, masked and unmasked meanings are Chinese-free`, () => {
      const entries = Object.values(records);
      expect(entries.length).toBeGreaterThan(0);
      const failures: string[] = [];
      for (const record of entries) {
        const cleaned = cleanupMeaning(record.prompt.meaning);
        const masked = maskTarget(cleaned, record.character);
        if (HAN.test(cleaned)) {
          failures.push(`${record.character} (level ${level}): cleaned meaning "${cleaned}"`);
        }
        if (HAN.test(masked)) {
          failures.push(`${record.character} (level ${level}): masked meaning "${masked}"`);
        }
      }
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }

  it('levels.json exampleMeanings of levels 2 and 3 are Chinese-free', () => {
    const manifest = JSON.parse(readFileSync(resolve(DATA, 'levels.json'), 'utf8')) as Manifest;
    const failures: string[] = [];
    for (const level of [2, 3]) {
      const entry = manifest.levels.find((l) => l.level === level);
      expect(entry, `level ${level} missing from levels.json`).toBeDefined();
      expect(entry?.exampleMeanings.length ?? 0).toBeGreaterThan(0);
      for (const meaning of entry?.exampleMeanings ?? []) {
        if (HAN.test(meaning)) failures.push(`level ${level}: example meaning "${meaning}"`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
