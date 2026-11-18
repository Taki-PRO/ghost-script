// Level samples (proof-pass Requirement 11, task 14.1): the pipeline picks one
// sample per level from stroke data. Real data; fixtures only for failures.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CharacterRecord,
  Level,
  LevelManifest,
} from '../../app/src/data/types';
import { learningOrder } from '../../app/src/engine/learningOrder';
import {
  LEVEL_FILES,
  buildManifest,
  chooseSample,
  serialiseManifest,
} from '../../scripts/lib/levels';

const ROOT = resolve(__dirname, '../..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');
const LEVELS: readonly Level[] = [1, 2, 3];

const datasets = Object.fromEntries(
  LEVELS.map((level) => [
    level,
    new Map(
      Object.entries(
        JSON.parse(read(`app/public/data/${LEVEL_FILES[level]}`)) as Record<
          string,
          CharacterRecord
        >,
      ),
    ),
  ]),
) as Record<Level, Map<string, CharacterRecord>>;

const sourceStrokes = (c: string): string[] =>
  (JSON.parse(read(`data/raw/hanzi-writer-data/${c}.json`)) as { strokes: string[] })
    .strokes;

const LIST_FILES: Record<Level, string> = {
  1: 'data/character-list.txt',
  2: 'data/character-list-level2.txt',
  3: 'data/character-list-level3.txt',
};
const lists = Object.fromEntries(
  LEVELS.map((level) => [
    level,
    read(LIST_FILES[level])
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#')),
  ]),
) as Record<Level, string[]>;

const inputsOf = () =>
  LEVELS.map((level) => ({
    level,
    order: lists[level],
    records: datasets[level],
  }));

const build = (): LevelManifest => buildManifest(inputsOf(), sourceStrokes);

describe('level samples, real data', () => {
  const manifest = build();
  const infoOf = (level: Level) => manifest.levels[level - 1];
  const charOf = (level: Level): string => infoOf(level).sample?.character as string;

  it('are 两, 京 and 冒 at positions 64, 68 and 81 with 7, 8 and 9 strokes', () => {
    const expected = { 1: ['两', 64, 7], 2: ['京', 68, 8], 3: ['冒', 81, 9] } as const;
    for (const level of LEVELS) {
      const character = charOf(level);
      const position = learningOrder(datasets[level]).indexOf(character) + 1;
      expect([character, position, datasets[level].get(character)?.strokeCount]).toEqual(
        expected[level],
      );
    }
  });

  it('sit at position 31 or later (1-based), not among the first 30', () => {
    for (const level of LEVELS) {
      const order = learningOrder(datasets[level]);
      expect(order.indexOf(charOf(level)) + 1).toBeGreaterThanOrEqual(31);
      expect(order.slice(0, 30)).not.toContain(charOf(level));
    }
  });

  it('have no candidate closer in stroke count; ties go to the lowest position', () => {
    for (const level of LEVELS) {
      const order = learningOrder(datasets[level]);
      const average = infoOf(level).averageStrokes;
      const diff = (c: string): number =>
        Math.abs((datasets[level].get(c)?.strokeCount as number) - average);
      const chosen = charOf(level);
      const chosenIndex = order.indexOf(chosen);
      order.slice(30).forEach((c, k) => {
        expect(diff(c)).toBeGreaterThanOrEqual(diff(chosen));
        if (diff(c) === diff(chosen)) expect(30 + k).toBeGreaterThanOrEqual(chosenIndex);
      });
    }
  });

  it("come from the level's own dataset", () => {
    for (const level of LEVELS) {
      expect(datasets[level].has(charOf(level))).toBe(true);
      for (const other of LEVELS.filter((l) => l !== level)) {
        expect(datasets[other].has(charOf(level))).toBe(false);
      }
    }
  });

  it('carry the unchanged strokes of the source file, without medians', () => {
    for (const level of LEVELS) {
      const sample = infoOf(level).sample;
      expect(sample?.strokes).toEqual(sourceStrokes(charOf(level)));
      expect(Object.keys(sample ?? {}).sort()).toEqual(['character', 'strokes']);
    }
  });

  it('are deterministic: two builds are equal', () => {
    expect(serialiseManifest(build())).toBe(serialiseManifest(build()));
  });

  it('match the committed levels.json', () => {
    expect(read('app/public/data/levels.json')).toBe(serialiseManifest(manifest));
  });
});

describe('chooseSample', () => {
  const order = Array.from({ length: 35 }, (_, i) => `c${i}`);
  const counts = (f: (i: number) => number) =>
    new Map(order.map((c, i) => [c, f(i)]));

  it('never picks one of the first 30, even when it is exact', () => {
    expect(chooseSample(order, counts((i) => (i < 30 ? 5 : 9)), 5)).toEqual({
      character: 'c30',
      position: 31,
    });
  });

  it('breaks a tie to the lowest position', () => {
    // 4 and 6 are both 1 away from 5; position 33 comes before 35.
    const c = counts((i) => (i === 34 ? 6 : i === 32 ? 4 : 20));
    expect(chooseSample(order, c, 5)).toEqual({ character: 'c32', position: 33 });
  });

  it('returns null with fewer than 31 characters', () => {
    expect(chooseSample(order.slice(0, 30), counts(() => 5), 5)).toBeNull();
  });
});

describe('level sample failures', () => {
  it('names the level when a level has 30 records', () => {
    const inputs = inputsOf();
    const thirty = new Map([...datasets[2]].slice(0, 30));
    inputs[1] = { level: 2, order: lists[2].slice(0, 30), records: thirty };
    expect(() => buildManifest(inputs, sourceStrokes)).toThrow(/level 2/);
  });

  it('names the level and the character when a stroke file is missing', () => {
    const missing = (c: string): string[] => {
      if (c === '冒') throw new Error('no such file');
      return sourceStrokes(c);
    };
    expect(() => buildManifest(inputsOf(), missing)).toThrow(/level 3.*冒/);
  });

  it('rejects an empty strokes array', () => {
    expect(() => buildManifest(inputsOf(), () => [])).toThrow(/level 1/);
  });
});
