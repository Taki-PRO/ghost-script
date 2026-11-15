// Parser for Unihan_DictionaryLikeData.txt (Unicode Unihan database).
//
// A data line has the form `U+XXXX<TAB>field<TAB>value`. Only `kCangjie`
// lines are kept. Lines starting with `#`, blank lines and every other field
// are skipped. Values are returned exactly as they appear in the source:
// this parser does no validation and never infers or derives a code.

// Codepoint (4 to 6 hex digits), the literal field name, then the raw value.
const KCANGJIE_LINE = /^U\+([0-9A-Fa-f]{4,6})\tkCangjie\t(.*)$/;

/**
 * Parses Unihan_DictionaryLikeData.txt. Keeps only `kCangjie` lines.
 * Returns every value per character, in source order (a character with two
 * `kCangjie` lines gets two values), so the caller can detect duplicates.
 */
export function parseUnihanCangjie(rawText: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const line of rawText.split(/\r?\n/)) {
    if (line.startsWith('#')) continue;
    const match = KCANGJIE_LINE.exec(line);
    if (match === null) continue;
    const codepointHex = match[1];
    const value = match[2];
    if (codepointHex === undefined || value === undefined) continue;
    const character = String.fromCodePoint(parseInt(codepointHex, 16));
    const values = result.get(character);
    if (values === undefined) {
      result.set(character, [value]);
    } else {
      values.push(value);
    }
  }
  return result;
}
