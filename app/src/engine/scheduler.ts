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
