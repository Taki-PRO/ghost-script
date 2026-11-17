/**
 * The guided first ghost: the rule that picks it, the composition of a first
 * session, and the instruction lines. Pure; no React.
 *
 * Every meaning and shape in a line comes from the dataset and the Cangjie key
 * table, never from this file.
 */
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { CANGJIE_KEYS, isPlayableInCangjie } from './cangjieRules';
import { maskTarget } from './mask';
import { cleanupMeaning } from './promptCleanup';
import { parseIds } from './summonInk';

export const WALKTHROUGH_WRITE_LINE = 'Now write it from memory';

const SIDE_BY_SIDE = '\u2FF0'; // ⿰
const MEANING_WORD = /^[A-Za-z]+$/;

function meetsRule(record: CharacterRecord): boolean {
  if (record.summonInk.class !== 'transparent') return false;
  const code = record.cangjie;
  if (code === null || code.length !== 2 || code[0] === code[1]) return false;
  if (!isPlayableInCangjie(code)) return false;
  const tree = parseIds(record.decomposition.decomposition);
  return tree !== null && 'op' in tree && tree.op === SIDE_BY_SIDE;
}

/**
 * The first character of `order` that is transparent, has a code of exactly two
 * different keys that is playable in Cangjie mode, and has the top IDS operator
 * ⿰. Null when none exists.
 */
export function pickWalkthroughGhost(
  order: readonly string[],
  dataset: CharacterDataset,
): string | null {
  for (const character of order) {
    const record = dataset.get(character);
    if (record !== undefined && meetsRule(record)) return character;
  }
  return null;
}

/** The walkthrough ghost first, then `ghosts` without it, cut to `size`. */
export function composeFirstSession(
  ghosts: readonly CharacterRecord[],
  walkthrough: CharacterRecord,
  size: number,
): CharacterRecord[] {
  if (!Number.isFinite(size) || size <= 0) return [];
  const rest = ghosts.filter((g) => g.character !== walkthrough.character);
  return [walkthrough, ...rest].slice(0, Math.floor(size));
}

/** One line per key of the record's code. */
export function walkthroughSummonLines(
  record: CharacterRecord,
  dataset: CharacterDataset,
): string[] {
  const code = record.cangjie ?? '';
  return Array.from(code).map((key) => {
    const shape = CANGJIE_KEYS.find((k) => k.key === key)?.shape ?? '';
    const shapeRecord = dataset.get(shape);
    let line: string;
    if (shapeRecord === undefined) {
      line = `Press ${key}: ${shape}`;
    } else {
      const meaning = cleanupMeaning(shapeRecord.prompt.meaning);
      line = MEANING_WORD.test(meaning)
        ? `Press ${key}: the ${meaning} ${shape}`
        : `Press ${key}: ${shape} (${meaning})`;
    }
    return maskTarget(line, record.character);
  });
}
