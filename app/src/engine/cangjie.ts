/**
 * Cangjie key table, key-event parsing and the Summon reducer (pure, no I/O).
 */

import type { EngineConfig } from './config';
import { resolveCompletion } from './outcome';
import type { Outcome } from './scheduler';

export type CangjieKey =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y';

export interface CangjieKeyInfo {
  readonly key: CangjieKey;
  readonly shape: string;
}

/** 25 entries, A–Y. X is shown as 難. There is no Z. */
export const CANGJIE_KEYS: readonly CangjieKeyInfo[] = [
  { key: 'A', shape: '日' },
  { key: 'B', shape: '月' },
  { key: 'C', shape: '金' },
  { key: 'D', shape: '木' },
  { key: 'E', shape: '水' },
  { key: 'F', shape: '火' },
  { key: 'G', shape: '土' },
  { key: 'H', shape: '竹' },
  { key: 'I', shape: '戈' },
  { key: 'J', shape: '十' },
  { key: 'K', shape: '大' },
  { key: 'L', shape: '中' },
  { key: 'M', shape: '一' },
  { key: 'N', shape: '弓' },
  { key: 'O', shape: '人' },
  { key: 'P', shape: '心' },
  { key: 'Q', shape: '手' },
  { key: 'R', shape: '口' },
  { key: 'S', shape: '尸' },
  { key: 'T', shape: '廿' },
  { key: 'U', shape: '山' },
  { key: 'V', shape: '女' },
  { key: 'W', shape: '田' },
  { key: 'X', shape: '難' },
  { key: 'Y', shape: '卜' },
];

/** Every key face: the 24 base shapes plus 難. */
export const KEY_FACE_CHARACTERS: ReadonlySet<string> = new Set(
  CANGJIE_KEYS.map((k) => k.shape),
);

export interface KeyEventLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly isComposing: boolean;
}

const KEY_LETTERS: ReadonlySet<string> = new Set(CANGJIE_KEYS.map((k) => k.key));

/** A single letter A–Y (either case); null for everything else (Z, "Process", modifiers, repeat, composition). */
export function parseKeyEvent(e: KeyEventLike): CangjieKey | null {
  if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || e.isComposing) return null;
  if (e.key === 'Process') return null;
  if (e.key.length !== 1) return null;
  const upper = e.key.toUpperCase();
  return KEY_LETTERS.has(upper) ? (upper as CangjieKey) : null;
}

export type SummonStatus = 'active' | Outcome;

export interface SummonState {
  readonly code: string;
  readonly filled: number;
  readonly mistakes: number;
  readonly missesOnSlot: number;
  readonly hintShown: boolean;
  readonly status: SummonStatus;
}

type SummonConfig = Pick<
  EngineConfig,
  'cleanMistakeThreshold' | 'strokeHintAfterConsecutiveMisses'
>;

export function startSummon(code: string): SummonState {
  return { code, filled: 0, mistakes: 0, missesOnSlot: 0, hintShown: false, status: 'active' };
}

/** The key the player must press next; null once the step is resolved. */
export function nextExpectedKey(state: SummonState): CangjieKey | null {
  if (state.status !== 'active' || state.filled >= state.code.length) return null;
  return state.code[state.filled] as CangjieKey;
}

export function isKeyHintVisible(
  state: SummonState,
  config: Pick<EngineConfig, 'strokeHintAfterConsecutiveMisses'>,
): boolean {
  return (
    state.status === 'active' &&
    state.missesOnSlot >= config.strokeHintAfterConsecutiveMisses
  );
}

export function applyKeyEntry(
  state: SummonState,
  key: CangjieKey,
  config: SummonConfig,
): SummonState {
  if (state.status !== 'active') return state;
  if (key === state.code[state.filled]) {
    const filled = state.filled + 1;
    const done = filled === state.code.length;
    return {
      ...state,
      filled,
      missesOnSlot: 0,
      status: done ? resolveCompletion(state.hintShown, state.mistakes, config) : 'active',
    };
  }
  const missesOnSlot = state.missesOnSlot + 1;
  return {
    ...state,
    mistakes: state.mistakes + 1,
    missesOnSlot,
    hintShown:
      state.hintShown || missesOnSlot >= config.strokeHintAfterConsecutiveMisses,
  };
}

/** parseKeyEvent then applyKeyEntry; returns `state` itself when the event is ignored. */
export function applyKeyEvent(
  state: SummonState,
  e: KeyEventLike,
  config: SummonConfig,
): SummonState {
  const key = parseKeyEvent(e);
  return key === null ? state : applyKeyEntry(state, key, config);
}

export function giveUpSummon(state: SummonState): SummonState {
  return state.status === 'active' ? { ...state, status: 'gave-up' } : state;
}
