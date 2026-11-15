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
