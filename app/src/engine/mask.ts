/**
 * Replace every occurrence of the target character in a DISPLAYED string with
 * the full-width tilde "～" (the headword convention in Chinese dictionaries).
 *
 * Display-only: applied AFTER `cleanupMeaning`, never to stored data or pinyin.
 * Needed because some meanings quote their own character (e.g. 么, 第), which
 * would give away the answer (Req 5.1). Splits on the exact char string, so it
 * is codepoint-safe and changes nothing else.
 */
export function maskTarget(text: string, char: string): string {
  if (char === '') return text;
  return text.split(char).join('\uFF5E');
}
