// Level helpers for the Level_Manifest (harder-ghosts, Requirements 3.6, 5.1, 5.2).
//
// Pure and Node-free: no file system access. The build writes the files; this
// module only computes the manifest and the report lines.

import type {
  CharacterRecord,
  Level,
  LevelInfo,
  LevelManifest,
} from '../../app/src/data/types';
import { cleanupMeaning } from '../../app/src/engine/promptCleanup';

/** File name of each Level_Dataset inside app/public/data/. */
export const LEVEL_FILES: Readonly<Record<Level, string>> = {
  1: 'characters.json',
  2: 'characters-level2.json',
  3: 'characters-level3.json',
};

/** The levels in order. */
export const LEVELS: readonly Level[] = [1, 2, 3];

/** Longest allowed Example_Meaning, in characters. */
export const EXAMPLE_MEANING_MAX_LENGTH = 24;

/** Letters, spaces and hyphens only; at least one character. */
const EXAMPLE_MEANING_PATTERN = /^[\p{L} -]+$/u;

/** Mean of `strokeCount`, rounded to one decimal. 0 for no records. */
export function averageStrokes(
  records: ReadonlyMap<string, CharacterRecord>,
): number {
  if (records.size === 0) return 0;
  let sum = 0;
  for (const record of records.values()) sum += record.strokeCount;
  return Math.round((sum / records.size) * 10) / 10;
}

/**
 * Example_Meanings of a level (Requirement 5.2). Takes the positions
 * floor(n/4), floor(n/2) and floor(3n/4) of `order` (n = order.length). For each
 * position it takes the first record at or after it whose cleaned meaning is at
 * most 24 characters long and contains only letters, spaces and hyphens, skipping
 * a record that is already chosen. Returns fewer than three meanings when the
 * order has too few usable records.
 */
export function exampleMeanings(
  order: readonly string[],
  records: ReadonlyMap<string, CharacterRecord>,
): string[] {
  const n = order.length;
  const starts = [Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4)];
  const chosen = new Set<string>();
  const meanings: string[] = [];
  for (const start of starts) {
    for (let i = start; i < n; i += 1) {
      const character = order[i];
      if (chosen.has(character)) continue;
      const record = records.get(character);
      if (record === undefined) continue;
      const meaning = cleanupMeaning(record.prompt.meaning);
      if (
        meaning.length <= EXAMPLE_MEANING_MAX_LENGTH &&
        EXAMPLE_MEANING_PATTERN.test(meaning)
      ) {
        chosen.add(character);
        meanings.push(meaning);
        break;
      }
    }
  }
  return meanings;
}

/** What `buildManifest` needs for one level. */
export interface ManifestLevelInput {
  level: Level;
  /** Learning_Order: the level's characters in order. */
  order: readonly string[];
  records: ReadonlyMap<string, CharacterRecord>;
}

/**
 * Builds the Level_Manifest: one entry per level, in level order, whatever the
 * order of `inputs`. Throws when a level is missing or has fewer than three
 * Example_Meanings.
 */
export function buildManifest(
  inputs: readonly ManifestLevelInput[],
): LevelManifest {
  const levels: LevelInfo[] = LEVELS.map((level) => {
    const input = inputs.find((candidate) => candidate.level === level);
    if (input === undefined) {
      throw new Error(`Level_Manifest: no input for level ${level}.`);
    }
    const meanings = exampleMeanings(input.order, input.records);
    if (meanings.length !== 3) {
      throw new Error(
        `Level_Manifest: level ${level} has ${meanings.length} usable example meanings, need 3.`,
      );
    }
    return {
      level,
      file: LEVEL_FILES[level],
      count: input.records.size,
      averageStrokes: averageStrokes(input.records),
      exampleMeanings: meanings,
    };
  });
  return { levels };
}

/** The manifest as JSON text: 2-space indent, one trailing newline. */
export function serialiseManifest(manifest: LevelManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * One report line for a written data file:
 * `<path>  <n> records  <raw> bytes  <gzip> bytes gzip`.
 */
export function formatFileReport(
  path: string,
  records: number,
  raw: number,
  gzip: number,
): string {
  return `${path}  ${records} records  ${raw} bytes  ${gzip} bytes gzip`;
}
