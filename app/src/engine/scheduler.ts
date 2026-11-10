import type { EngineConfig } from './config';

/**
 * Haunting scheduler. Pure functions only: the clock is injected via `now`
 * (ms), the module never calls Date.now() and performs no I/O (Req 6.1, 6.11).
 */

/** Terminal result of one ghost attempt. */
export type Outcome = 'clean' | 'struggled' | 'gave-up';

/** One recorded attempt. */
export interface AttemptRecord {
  readonly outcome: Outcome;
  readonly at: number;
}

/** Per-character scheduler state. */
export interface ReviewEntry {
  /** Ladder index (0..top). */
  readonly step: number;
  readonly lastOutcome: Outcome;
  /** Timestamp (ms) when the character is next due. */
  readonly nextDue: number;
  readonly history?: readonly AttemptRecord[];
}

/** character -> entry. */
export type ReviewHistory = Readonly<Record<string, ReviewEntry>>;

/**
 * Apply one review result. Pure.
 *
 * Step model:
 * - A new character (no prior entry) or one whose last outcome was a miss
 *   (struggled / gave-up) lands on step 0 on its next clean review
 *   (interval ladder[0], e.g. 1 day).
 * - Otherwise clean (Req 6.2) advances by exactly one:
 *   newStep = min(priorStep + 1, top); nextDue = now + ladder[newStep].
 * - Struggled / gave-up (Req 6.3): step = 0; nextDue = now + relearnDelayMs.
 * - Offsets are clamped to be non-negative (Req 6.4); an empty ladder yields 0.
 * - A corrupt prior step is clamped into [0, top] before advancing.
 */
export function applyReview(
  prior: ReviewEntry | undefined,
  outcome: Outcome,
  now: number,
  config: EngineConfig,
): ReviewEntry {
  const ladder = config.intervalLadderMs;
  const top = Math.max(0, ladder.length - 1);

  let step: number;
  let offset: number;
  if (outcome === 'clean') {
    const afterMiss = prior !== undefined && prior.lastOutcome !== 'clean';
    const priorStep =
      prior && !afterMiss
        ? Math.min(Math.max(Number.isFinite(prior.step) ? Math.trunc(prior.step) : 0, 0), top)
        : -1;
    step = Math.min(priorStep + 1, top);
    offset = ladder[step] ?? 0;
  } else {
    step = 0;
    offset = config.relearnDelayMs;
  }
  const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;

  const history: readonly AttemptRecord[] = [...(prior?.history ?? []), { outcome, at: now }];

  return { step, lastOutcome: outcome, nextDue: now + safeOffset, history };
}

/** Next-due timestamp of an entry, never negative (Req 6.4). */
export function nextDue(entry: ReviewEntry): number {
  return Math.max(0, entry.nextDue);
}

/**
 * Choose the characters for one Nightly Séance. Pure and deterministic: the
 * clock is injected via `now`, inputs are never mutated, and the result does
 * not depend on the key insertion order of `history` (Req 6.1, 6.6).
 *
 * Works over the DISTINCT characters of `characterList` (first occurrence
 * wins; "list position" is the index in that deduped list). History entries
 * for characters not in the list are ignored. A character is NEW when it has
 * no history entry, DUE when its next-due time is <= `now`, otherwise
 * NOT-YET-DUE. A non-finite next-due value is treated as 0 (due, maximally
 * overdue).
 *
 * Bands, appended in this order until `config.sessionSize` is reached (Req 6.5):
 *  (a) DUE characters, most overdue first (largest `now - nextDue`); ties by
 *      list position.
 *  (b) NEW characters in list order, capped at `config.newPerSessionCap`
 *      unless nothing in the list is due, in which case there is no cap.
 *  (c) NOT-YET-DUE characters, soonest first (smallest `nextDue - now`); ties
 *      by list position.
 *  (d) remaining NEW characters in list order, ignoring the cap. So when due
 *      plus not-yet-due characters cannot fill the session, the NEW count can
 *      exceed `newPerSessionCap` even though something is due.
 *
 * The result never exceeds `sessionSize` (a band is truncated), never contains
 * duplicates, and is shorter than `sessionSize` only when the list has fewer
 * distinct characters. A non-finite or non-positive `sessionSize` yields [];
 * a fractional one is floored. Never throws. Req 3.1, 6.5–6.7, 6.10.
 */
export function selectSession(
  history: ReviewHistory,
  characterList: readonly string[],
  now: number,
  config: EngineConfig,
): string[] {
  const size = Number.isFinite(config.sessionSize) ? Math.floor(config.sessionSize) : 0;
  if (size <= 0) return [];
  const cap = Number.isFinite(config.newPerSessionCap)
    ? Math.max(0, Math.floor(config.newPerSessionCap))
    : 0;

  interface Candidate {
    readonly ch: string;
    readonly pos: number;
    readonly due: number;
  }
  const dueList: Candidate[] = [];
  const futureList: Candidate[] = [];
  const newList: string[] = [];

  const seen = new Set<string>();
  for (const ch of characterList) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    const pos = seen.size - 1;
    if (!Object.prototype.hasOwnProperty.call(history, ch)) {
      newList.push(ch);
      continue;
    }
    const raw = history[ch].nextDue;
    const due = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    (due <= now ? dueList : futureList).push({ ch, pos, due });
  }

  // Most overdue first == smallest nextDue first; ties by list position.
  dueList.sort((a, b) => a.due - b.due || a.pos - b.pos);
  // Soonest first == smallest nextDue first; ties by list position.
  futureList.sort((a, b) => a.due - b.due || a.pos - b.pos);

  const result: string[] = [];
  const room = (): number => size - result.length;

  for (const c of dueList.slice(0, room())) result.push(c.ch);

  const bandBCount = Math.min(dueList.length === 0 ? newList.length : cap, newList.length);
  const bandB = newList.slice(0, Math.min(bandBCount, room()));
  result.push(...bandB);

  for (const c of futureList.slice(0, room())) result.push(c.ch);

  result.push(...newList.slice(bandB.length, bandB.length + room()));

  return result;
}
