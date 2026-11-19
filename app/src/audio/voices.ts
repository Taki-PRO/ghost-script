// Pure voice limiter and rate limiter for the night sounds.
// No AudioContext, no DOM, no React, no random, no clock read: time is passed in.

export type SoundId =
  | 'key-tap'
  | 'key-wrong'
  | 'ink-sweep'
  | 'seal-thud'
  | 'rest-clean'
  | 'rest-struggled'
  | 'rest-gave-up';

/** Most effect voices at once (R7.1). */
export const MAX_VOICES = 4;
/** Most voices at once for key-tap, key-wrong and ink-sweep together; the fourth place is for an outcome (R7.2). */
export const MAX_KEY_INK_VOICES = 3;
/** Most voices at once of one key or ink id (R7.3). */
export const MAX_PER_ID = 2;
/** Minimum milliseconds between two accepted requests of the same id (R7.4, R7.5). */
export const SPACING_MS: Readonly<Partial<Record<SoundId, number>>> = {
  'key-tap': 40,
  'key-wrong': 40,
  'ink-sweep': 80,
};

/** The ids that count toward the group and per-id limits. */
export const KEY_INK_IDS: readonly SoundId[] = ['key-tap', 'key-wrong', 'ink-sweep'];

export interface Voice {
  readonly id: SoundId;
  readonly end: number;
}

export interface PlannerState {
  readonly active: readonly Voice[];
  /** Time of the last accepted request per id. */
  readonly last: Readonly<Partial<Record<SoundId, number>>>;
}

export type DropReason = 'spacing' | 'per-id' | 'group' | 'total';

export type Decision =
  | { readonly accept: true }
  | { readonly accept: false; readonly reason: DropReason };

export const EMPTY_PLANNER: PlannerState = { active: [], last: {} };

function isKeyOrInk(id: SoundId): boolean {
  return KEY_INK_IDS.includes(id);
}

/**
 * Pure. Prunes voices with end <= now, then decides: spacing, then per-id and
 * group (key and ink ids only), then total. A dropped request is discarded and
 * returns only the pruned state; nothing is queued.
 */
export function plan(
  state: PlannerState,
  id: SoundId,
  now: number,
  durationMs: number,
): { state: PlannerState; decision: Decision } {
  const active = state.active.filter((v) => v.end > now);
  const pruned: PlannerState = { active, last: state.last };
  const drop = (reason: DropReason) => ({
    state: pruned,
    decision: { accept: false, reason } as Decision,
  });

  const spacing = SPACING_MS[id];
  const last = state.last[id];
  if (spacing !== undefined && last !== undefined && now - last < spacing) {
    return drop('spacing');
  }
  if (isKeyOrInk(id)) {
    if (active.filter((v) => v.id === id).length >= MAX_PER_ID) return drop('per-id');
    if (active.filter((v) => isKeyOrInk(v.id)).length >= MAX_KEY_INK_VOICES) return drop('group');
  }
  if (active.length >= MAX_VOICES) return drop('total');

  return {
    state: {
      active: [...active, { id, end: now + durationMs }],
      last: { ...state.last, [id]: now },
    },
    decision: { accept: true },
  };
}

/** Wraps plan() with a state variable and an injected clock. */
export function createLimiter(
  clock: () => number,
  durations: Readonly<Record<SoundId, number>>,
): { accept(id: SoundId): Decision; reset(): void } {
  let state: PlannerState = EMPTY_PLANNER;
  return {
    accept(id: SoundId): Decision {
      const result = plan(state, id, clock(), durations[id]);
      state = result.state;
      return result.decision;
    },
    reset(): void {
      state = EMPTY_PLANNER;
    },
  };
}
