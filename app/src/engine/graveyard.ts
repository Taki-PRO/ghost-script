import { nextDue } from './scheduler';
import type { ReviewEntry, ReviewHistory } from './scheduler';

/**
 * Graveyard classification. Pure: the clock is passed in as `now`, nothing is
 * read from storage. Req 6.
 */

export type GraveState = 'unmet' | 'restless' | 'at-rest';

/** A character never met. Deliberately has no `char` (Req 6.11). */
export interface UnmetGrave {
  readonly state: 'unmet';
  /** 1-based position in the Learning_Order. */
  readonly position: number;
}

export interface MetGrave {
  readonly state: 'restless' | 'at-rest';
  readonly char: string;
  readonly position: number;
  readonly streak: number;
}

export type Grave = UnmetGrave | MetGrave;

export interface GraveyardModel {
  readonly graves: readonly Grave[];
  readonly counts: Readonly<Record<GraveState, number>>;
}

/**
 * State of one character from its history entry (Req 6.2 to 6.6).
 * A missed ghost is restless; a clean ghost is restless once due
 * (`nextDue <= now`) and at rest before that. A non-finite next-due is 0.
 */
export function classifyEntry(entry: ReviewEntry | undefined, now: number): GraveState {
  if (entry === undefined) return 'unmet';
  if (entry.lastOutcome !== 'clean') return 'restless';
  const d = nextDue(entry);
  const due = Number.isFinite(d) ? d : 0;
  return due <= now ? 'restless' : 'at-rest';
}

/** Trailing run of `clean` attempts (Req 6.7). */
export function cleanStreak(entry: ReviewEntry): number {
  const history = entry.history;
  if (!Array.isArray(history)) return entry.lastOutcome === 'clean' ? 1 : 0;
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].outcome !== 'clean') break;
    streak++;
  }
  return streak;
}

/**
 * Build the model in Learning_Order (Req 6.8, 6.9). Keys of `history` that are
 * not in `order` are ignored; duplicates in `order` are skipped (first wins).
 */
export function buildGraveyard(
  order: readonly string[],
  history: ReviewHistory,
  now: number,
): GraveyardModel {
  const graves: Grave[] = [];
  const counts: Record<GraveState, number> = { unmet: 0, restless: 0, 'at-rest': 0 };
  const seen = new Set<string>();
  for (const ch of order) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    const position = seen.size;
    const entry = Object.prototype.hasOwnProperty.call(history, ch) ? history[ch] : undefined;
    const state = classifyEntry(entry, now);
    counts[state]++;
    if (state === 'unmet' || entry === undefined) {
      graves.push({ state: 'unmet', position });
    } else {
      graves.push({ state, char: ch, position, streak: cleanStreak(entry) });
    }
  }
  return { graves, counts };
}
