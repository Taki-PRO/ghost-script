// Parser for data/character-list.txt.
//
// Reads the raw text of the character list, strips comment (`#`) and blank
// lines, validates that each remaining entry is a single CJK Unified
// Ideograph (U+4E00–U+9FFF), and detects duplicates. Returns either the
// ordered list of characters or every error encountered.
//
// The result/error types live here rather than in app/src/data/types.ts
// because they are specific to the data pipeline, not the shared record shape.

/** Lower bound of the CJK Unified Ideographs block (U+4E00). */
const CJK_START = 0x4e00;
/** Upper bound of the CJK Unified Ideographs block (U+9FFF). */
const CJK_END = 0x9fff;

/** Reason a character-list line failed validation. */
export interface CharacterListError {
  /** 1-indexed line number in the ORIGINAL raw text. */
  line: number;
  character: string;
  reason: 'not-cjk' | 'duplicate';
}

/** Result of parsing a character list: either every character or every error. */
export type ParseCharacterListResult =
  | { ok: true; characters: string[] }
  | { ok: false; errors: CharacterListError[] };

/**
 * Returns true when `value` is exactly one codepoint in U+4E00–U+9FFF.
 *
 * Uses Array.from so that a surrogate pair (e.g. an emoji) counts as a single
 * codepoint rather than two UTF-16 code units, making the "single codepoint"
 * check correct.
 */
function isSingleCjkCodepoint(value: string): boolean {
  const codepoints = Array.from(value);
  if (codepoints.length !== 1) {
    return false;
  }
  const code = codepoints[0].codePointAt(0);
  if (code === undefined) {
    return false;
  }
  return code >= CJK_START && code <= CJK_END;
}

/**
 * Parse the raw contents of character-list.txt.
 *
 * - Splits on newlines; trims whitespace on each line.
 * - Skips `#`-prefixed comment lines and blank lines.
 * - Emits a `'not-cjk'` error for any remaining line that is not a single
 *   CJK codepoint.
 * - Emits a `'duplicate'` error at the line of each repeat occurrence of a
 *   character already seen.
 * - Line numbers are 1-indexed against the original raw text.
 *
 * Returns `{ ok: true, characters }` only when zero errors are found;
 * otherwise `{ ok: false, errors }` with ALL errors.
 */
export function parseCharacterList(raw: string): ParseCharacterListResult {
  const lines = raw.split('\n');
  const characters: string[] = [];
  const errors: CharacterListError[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const trimmed = lines[i].trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    if (!isSingleCjkCodepoint(trimmed)) {
      errors.push({ line: lineNumber, character: trimmed, reason: 'not-cjk' });
      continue;
    }

    if (seen.has(trimmed)) {
      errors.push({ line: lineNumber, character: trimmed, reason: 'duplicate' });
      continue;
    }

    seen.add(trimmed);
    characters.push(trimmed);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, characters };
}
