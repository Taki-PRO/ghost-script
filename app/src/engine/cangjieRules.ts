/**
 * Shared Cangjie rules. Imports nothing so that `scripts/` can import this
 * file by relative path as well as the app.
 */

/** One to five keys, each an upper-case letter A-Y (Z is not a Cangjie key). */
export const CANGJIE_CODE_PATTERN: RegExp = /^[A-Y]{1,5}$/;

export function isValidCangjieCode(value: string): boolean {
  return CANGJIE_CODE_PATTERN.test(value);
}

/** Playable in Cangjie mode: non-null and does not start with "X". */
export function isPlayableInCangjie(code: string | null): boolean {
  return code !== null && !code.startsWith('X');
}

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
