// Level helpers for the Level_Manifest (harder-ghosts, Requirements 3.6, 5.1, 5.2).
//
// Pure and Node-free: no file system access. The build writes the files; this
// module only computes the manifest and the report lines.

import type {
  CharacterRecord,
  Level,
  LevelInfo,
  LevelManifest,
  LevelSample,
} from '../../app/src/data/types';
import { learningOrder } from '../../app/src/engine/learningOrder';
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

/** Learning positions before this one (1-based) are never a sample. */
export const SAMPLE_FIRST_POSITION = 31;

/**
 * The sample of a level (proof-pass Requirement 11.6): among the characters at
 * learning position 31 or later (counted from 1), the one whose stroke count is
 * closest to `average`; a tie goes to the lowest position. Returns null when
 * the order has no such character. A character without a stroke count is
 * never closer than one with a count.
 */
export function chooseSample(
  order: readonly string[],
  strokeCount: ReadonlyMap<string, number>,
  average: number,
): { character: string; position: number } | null {
  let best: { character: string; position: number; diff: number } | null = null;
  for (let i = SAMPLE_FIRST_POSITION - 1; i < order.length; i += 1) {
    const count = strokeCount.get(order[i]);
    if (count === undefined) continue;
    const diff = Math.abs(count - average);
    if (best === null || diff < best.diff) {
      best = { character: order[i], position: i + 1, diff };
    }
  }
  return best === null
    ? null
    : { character: best.character, position: best.position };
}

/**
 * Reads the stroke paths (the `strokes` array of hanzi-writer-data, no medians)
 * of a character. Throws when the file is missing or invalid.
 */
export type StrokesOf = (character: string) => string[];

/** What `buildManifest` needs for one level. */
export interface ManifestLevelInput {
  level: Level;
  /** Learning_Order: the level's characters in order. */
  order: readonly string[];
  records: ReadonlyMap<string, CharacterRecord>;
}

/**
 * Builds the Level_Manifest: one entry per level, in level order, whatever the
 * order of `inputs`. Throws, naming the level, when a level is missing, has
 * fewer than three Example_Meanings, has no sample candidate (fewer than 31
 * records), or the stroke file of its sample is missing or invalid. The sample
 * is chosen from the level's own dataset by `chooseSample`.
 */
export function buildManifest(
  inputs: readonly ManifestLevelInput[],
  strokesOf: StrokesOf,
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
    const average = averageStrokes(input.records);
    const counts = new Map<string, number>();
    for (const [character, record] of input.records) {
      counts.set(character, record.strokeCount);
    }
    const chosen = chooseSample(learningOrder(input.records), counts, average);
    if (chosen === null) {
      throw new Error(
        `Level_Manifest: level ${level} has ${input.records.size} records, need at least ${SAMPLE_FIRST_POSITION} for a sample.`,
      );
    }
    let strokes: string[];
    try {
      strokes = strokesOf(chosen.character);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Level_Manifest: level ${level} sample ${chosen.character} has no usable stroke file (${reason}).`,
      );
    }
    if (
      !Array.isArray(strokes) ||
      strokes.length === 0 ||
      !strokes.every((d) => typeof d === 'string' && d.length > 0)
    ) {
      throw new Error(
        `Level_Manifest: level ${level} sample ${chosen.character} has no usable stroke file (empty or invalid strokes).`,
      );
    }
    const sample: LevelSample = { character: chosen.character, strokes };
    return {
      level,
      file: LEVEL_FILES[level],
      count: input.records.size,
      averageStrokes: average,
      exampleMeanings: meanings,
      sample,
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
