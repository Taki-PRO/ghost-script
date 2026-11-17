import type { Level } from '../data/types';
import type { ReviewHistory } from './scheduler';

/** The writing levels in ascending order. */
export const LEVELS: readonly Level[] = [1, 2, 3];

export function isLevel(value: unknown): value is Level {
  return value === 1 || value === 2 || value === 3;
}

function has(history: ReviewHistory, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(history, key);
}

/**
 * The Session_Pool: the chosen level's order, then the characters with a
 * history entry from the other levels (ascending level, each in its own
 * order). No duplicates. Never-met characters of other levels are left out.
 */
export function sessionCharacterList(
  chosenOrder: readonly string[],
  history: ReviewHistory,
  otherOrders: readonly (readonly string[])[],
): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const ch of chosenOrder) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    pool.push(ch);
  }
  for (const order of otherOrders) {
    for (const ch of order) {
      if (seen.has(ch) || !has(history, ch)) continue;
      seen.add(ch);
      pool.push(ch);
    }
  }
  return pool;
}

/** True when `order` is non-empty and every character has an own history entry. */
export function isLevelFinished(order: readonly string[], history: ReviewHistory): boolean {
  return order.length > 0 && order.every((ch) => has(history, ch));
}

/** History keys that no loaded dataset contains (own keys only). */
export function unplacedHistoryKeys(
  history: ReviewHistory,
  loaded: readonly ReadonlySet<string>[],
): string[] {
  return Object.keys(history).filter((key) => !loaded.some((keys) => keys.has(key)));
}

/** The next level to load at start-up, or null. */
export function nextLevelToLoad(
  chosen: Level,
  loaded: ReadonlySet<Level>,
  unplaced: readonly string[],
): Level | null {
  if (!loaded.has(1)) return 1;
  if (!loaded.has(chosen)) return chosen;
  if (unplaced.length > 0) {
    for (const level of LEVELS) {
      if (!loaded.has(level)) return level;
    }
  }
  return null;
}

/** Level after `level`, or null for level 3. */
export function nextLevel(level: Level): Level | null {
  if (level === 1) return 2;
  if (level === 2) return 3;
  return null;
}
