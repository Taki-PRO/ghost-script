// Exact-match guard for the human-approved clue corrections (spec proof-pass,
// Item 2). Each correction names a character, its level and the exact clue
// text. The build refuses to run unless the override row of the character
// selects a CC-CEDICT pair whose gloss (after stripBoundForm) equals the text
// and no other pair of that character has the same text. 么 has no entry here
// on purpose: its stored clue does not change.

import type { Level } from '../../app/src/data/types';
import type { CcCedictEntry } from './parse-cc-cedict';
import { stripBoundForm } from './prompt';
import type { PromptOverride } from './prompt';

export interface ClueCorrection {
  character: string;
  level: Level;
  text: string;
}

export const CLUE_CORRECTIONS: readonly ClueCorrection[] = [
  { character: '本', level: 1, text: 'root; stem' },
  { character: '天', level: 1, text: 'sky' },
  { character: '云', level: 2, text: 'cloud' },
  { character: '刚', level: 2, text: 'just; only a short while ago' },
  { character: '获', level: 3, text: 'to reap; to harvest' },
];

/** Every (entry, meaning) pair of `entry` whose stripped gloss equals `text`. */
export function matchingPairs(
  entry: CcCedictEntry,
  text: string,
): { entryIndex: number; meaningIndex: number }[] {
  const pairs: { entryIndex: number; meaningIndex: number }[] = [];
  entry.entries.forEach((sense, entryIndex) => {
    sense.meanings.forEach((gloss, meaningIndex) => {
      if (stripBoundForm(gloss) === text) {
        pairs.push({ entryIndex, meaningIndex });
      }
    });
  });
  return pairs;
}

/**
 * Check every correction of `level` whose character is in `characters`.
 * Returns one message per failure (character, text, number of matching pairs,
 * or "no override row"); an empty array means all pass.
 */
export function checkClueCorrections(
  level: Level,
  characters: ReadonlySet<string>,
  cc: ReadonlyMap<string, CcCedictEntry>,
  overrides: ReadonlyMap<string, PromptOverride>,
  corrections: readonly ClueCorrection[] = CLUE_CORRECTIONS,
): string[] {
  const failures: string[] = [];
  for (const correction of corrections) {
    if (correction.level !== level || !characters.has(correction.character)) {
      continue;
    }
    const { character, text } = correction;
    const entry = cc.get(character);
    const pairs = entry === undefined ? [] : matchingPairs(entry, text);
    if (pairs.length !== 1) {
      failures.push(
        `${character}: text "${text}" matches ${pairs.length} pairs, expected exactly 1`,
      );
      continue;
    }
    const override = overrides.get(character);
    if (override === undefined) {
      failures.push(`${character}: text "${text}" has no override row`);
      continue;
    }
    const [pair] = pairs;
    if (
      override.entryIndex !== pair.entryIndex ||
      override.meaningIndex !== pair.meaningIndex
    ) {
      failures.push(
        `${character}: text "${text}" matches 1 pair (${pair.entryIndex},${pair.meaningIndex}) but the override row selects (${override.entryIndex},${override.meaningIndex})`,
      );
    }
  }
  return failures;
}
