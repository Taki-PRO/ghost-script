import type { ReviewHistory } from './scheduler';

/**
 * First-meeting helpers. Pure: no clock, no I/O, no mutation of the inputs.
 * Own-property checks only, so a key such as "constructor" never reads the prototype.
 */

function has(history: ReviewHistory, character: string): boolean {
  return Object.prototype.hasOwnProperty.call(history, character);
}

/** True when the history has no entry at all (own properties only). */
export function isBrandNewPlayer(history: ReviewHistory): boolean {
  return Object.keys(history).length === 0;
}

/** The characters from `characters` that have no own-property entry in `history`. */
export function firstMeetingSet(
  history: ReviewHistory,
  characters: readonly string[],
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const character of characters) {
    if (!has(history, character)) out.add(character);
  }
  return out;
}
