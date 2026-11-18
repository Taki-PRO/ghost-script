import type { EngineConfig } from './config';
import { classifyEntry } from './graveyard';
import { applyReview, selectSession } from './scheduler';
import type { Outcome, ReviewEntry, ReviewHistory } from './scheduler';

/**
 * Review of restless ghosts outside the nightly schedule (proof-pass Req 10).
 * Pure: the clock is passed in as `now`, nothing is read from storage.
 */

function hasEntry(history: ReviewHistory, ch: string): boolean {
  return Object.prototype.hasOwnProperty.call(history, ch);
}

/**
 * Characters of `history` that are restless now, by the Graveyard's own
 * definition (`classifyEntry`). A character without an entry is never
 * restless. When `known` is given, only characters in it count, so stale
 * history keys cannot inflate the result. Req 10.1.
 */
export function restlessCharacters(
  history: ReviewHistory,
  now: number,
  known?: ReadonlySet<string>,
): string[] {
  const result: string[] = [];
  for (const ch of Object.keys(history)) {
    if (known !== undefined && !known.has(ch)) continue;
    if (classifyEntry(history[ch], now) === 'restless') result.push(ch);
  }
  return result;
}

export function restlessCount(
  history: ReviewHistory,
  now: number,
  known?: ReadonlySet<string>,
): number {
  return restlessCharacters(history, now, known).length;
}

/**
 * The Review_Run pool: the restless characters of the given learning orders,
 * which the caller passes in ascending level order. No duplicates. Req 10.10.
 */
export function reviewPool(
  orders: readonly (readonly string[])[],
  history: ReviewHistory,
  now: number,
): string[] {
  const pool: string[] = [];
  const seen = new Set<string>();
  for (const order of orders) {
    for (const ch of order) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      if (hasEntry(history, ch) && classifyEntry(history[ch], now) === 'restless') {
        pool.push(ch);
      }
    }
  }
  return pool;
}

/**
 * Ghosts of one Review_Run: `selectSession` over the pool. Due first, most
 * overdue first, then not-yet-due soonest first, at most `sessionSize`.
 * Req 10.11.
 */
export function planReview(
  orders: readonly (readonly string[])[],
  history: ReviewHistory,
  now: number,
  config: EngineConfig,
): string[] {
  return selectSession(history, reviewPool(orders, history, now), now, config);
}

/**
 * What to store after a ghost of a Review_Run. A clean review stores nothing
 * (`null`), a miss stores `applyReview`, and a ghost with no prior entry never
 * gets one. Req 10.15, 10.16, 10.18.
 */
export function recordReview(
  prior: ReviewEntry | undefined,
  outcome: Outcome,
  now: number,
  config: EngineConfig,
): ReviewEntry | null {
  if (prior === undefined) return null;
  if (outcome === 'clean') return null;
  return applyReview(prior, outcome, now, config);
}

/** Result texts of a Review_Run (Req 10.19, 10.20). */
export const REVIEW_RESULT_TEXT: Readonly<Record<Outcome, string>> = {
  clean: 'Remembered. It rests after its next séance.',
  struggled: 'Still restless. It will return soon.',
  'gave-up': 'The ghost slipped away',
};

/** Summary count line of a Review_Run (Req 10.21). */
export function reviewCountLine(remembered: number, total: number): string {
  return `${remembered} of ${total} ${total === 1 ? 'ghost' : 'ghosts'} remembered`;
}
