import type { CharacterRecord } from '../data/types';
import { cleanupMeaning } from './promptCleanup';
import type { Outcome, ReviewEntry } from './scheduler';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Whole-day number of a timestamp's local calendar day (DST-safe through Date.UTC). */
function dayNumber(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/**
 * Plain-language text for when a ghost returns. Pure: the clock is injected
 * through `now` (ms). The day rule uses local calendar days.
 */
export function formatReturn(nextDue: number, now: number): string {
  if (!Number.isFinite(nextDue) || !Number.isFinite(now)) return 'returns soon';
  const d = nextDue - now;
  if (d <= 0) return 'returns now';

  const m = Math.ceil(d / MINUTE_MS);
  if (m < 60) return m === 1 ? 'returns in 1 minute' : `returns in ${m} minutes`;

  const h = Math.ceil(d / HOUR_MS);
  if (h < 24) return h === 1 ? 'returns in 1 hour' : `returns in ${h} hours`;

  const days = dayNumber(nextDue) - dayNumber(now);
  return days <= 1 ? 'returns tomorrow' : `returns in ${days} days`;
}

export interface ReturnRow {
  readonly character: string;
  readonly pinyin: string;
  /** cleanupMeaning(prompt.meaning), not masked: the ghost is finished. */
  readonly meaning: string;
  /** nextDue of the saved entry. */
  readonly nextDue: number;
  /** How this ghost ended: the session's outcome, else the entry's lastOutcome. */
  readonly outcome: Outcome;
}

/**
 * One row per ghost, in the order given, skipping ghosts without an entry.
 * `outcomes` (this session's results) wins over `entry.lastOutcome`.
 */
export function buildReturnRows(
  ghosts: readonly CharacterRecord[],
  entries: ReadonlyMap<string, ReviewEntry>,
  outcomes?: ReadonlyMap<string, Outcome>,
): ReturnRow[] {
  const rows: ReturnRow[] = [];
  for (const ghost of ghosts) {
    const entry = entries.get(ghost.character);
    if (!entry) continue;
    rows.push({
      character: ghost.character,
      pinyin: ghost.prompt.pinyin,
      meaning: cleanupMeaning(ghost.prompt.meaning),
      nextDue: entry.nextDue,
      outcome: outcomes?.get(ghost.character) ?? entry.lastOutcome,
    });
  }
  return rows;
}
