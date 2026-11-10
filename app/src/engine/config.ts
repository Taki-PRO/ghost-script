/** Milliseconds in one day, used to express the interval ladder. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** All tunable game constants. Nothing in engine or UI hard-codes these. */
export interface EngineConfig {
  /** Max total mistakes for a clean outcome (default 2). Req 5.5, 5.8. */
  readonly cleanMistakeThreshold: number;
  /** Consecutive misses of the same stroke before a stroke hint (default 3). Req 5.4, 5.8. */
  readonly strokeHintAfterConsecutiveMisses: number;
  /** Interval ladder in ms: [1,3,7,14,30,60] days (steps 0–5). Req 6.2. */
  readonly intervalLadderMs: readonly number[];
  /** Delay applied on a missed review, in ms (10 minutes). Req 6.3. */
  readonly relearnDelayMs: number;
  /** Max NEW characters per session when something is due (default 5). Req 6.5. */
  readonly newPerSessionCap: number;
  /** Target ghosts per Nightly Séance (default 10). Req 3.1, 6.7. */
  readonly sessionSize: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  cleanMistakeThreshold: 2,
  strokeHintAfterConsecutiveMisses: 3,
  intervalLadderMs: [1 * DAY_MS, 3 * DAY_MS, 7 * DAY_MS, 14 * DAY_MS, 30 * DAY_MS, 60 * DAY_MS],
  relearnDelayMs: 10 * 60 * 1000,
  newPerSessionCap: 5,
  sessionSize: 10,
};
