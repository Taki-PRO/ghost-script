/**
 * Display order of the Graveyard. Display only: `learningOrder`, session order,
 * history and `classifyEntry` are not touched.
 *
 * On level 1 the Guided_Ghost (what `pickWalkthroughGhost` returns for the level 1
 * order) is shown first, because a brand-new player meets it first. The other
 * graves keep their relative `learningOrder`. Levels 2 and 3 are unchanged.
 */
import type { CharacterDataset } from '../data/charDataLoader';
import type { Level } from '../data/types';
import { pickWalkthroughGhost } from './walkthrough';

export function graveyardOrder(
  level: Level,
  order: readonly string[],
  dataset: CharacterDataset,
): string[] {
  if (level !== 1) return [...order];
  const guided = pickWalkthroughGhost(order, dataset);
  if (guided === null) return [...order];
  return [guided, ...order.filter((c) => c !== guided)];
}

/** The sentence under the level buttons. `hasGuided` only matters on level 1. */
export function graveyardExplanation(level: Level, hasGuided: boolean): string {
  if (level === 1 && hasGuided) {
    return 'These graves are the ghosts of level 1. The guided first ghost comes first, then the rest in the order you will meet them. A ghost you have not met stays hidden.';
  }
  return `These graves are the ghosts of level ${level}, in the order you will meet them. A ghost you have not met stays hidden.`;
}
