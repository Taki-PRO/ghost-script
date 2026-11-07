// Parser for Make Me a Hanzi `dictionary.txt` (newline-delimited JSON).
//
// Each line is a JSON object describing one character's decomposition, radical,
// etymology and component matches. This module parses those lines into a
// Map<character, MakeMeAHanziEntry>, computing `atomic` and `components`
// from the IDS decomposition string.
//
// The canonical `Etymology` type lives in the shared types file; it is
// re-exported here for convenience so callers can import it from one place.

import type { Etymology } from '../../app/src/data/types';

export type { Etymology };

export interface MakeMeAHanziEntry {
  /** IDS string, verbatim from source. */
  decomposition: string;
  radical: string;
  etymology: Etymology | null;
  matches: (number[] | null)[] | null;
  /** true when decomposition starts with ？ (U+FF1F). */
  atomic: boolean;
  /** Leaf components; [character] for atomic entries. */
  components: string[];
}

/** The placeholder codepoint used by Make Me a Hanzi for an atomic/unknown part. */
const QUESTION_MARK = '？'; // U+FF1F

/**
 * Raw line shape as it appears in `dictionary.txt`. Only the fields we consume
 * are modelled; extra fields (e.g. `definition`, `pinyin`) are ignored.
 */
interface RawMakeMeAHanziLine {
  character: string;
  decomposition: string;
  radical: string;
  etymology?: Etymology | null;
  matches?: (number[] | null)[] | null;
}

/**
 * Type guard validating the fields of a raw dictionary line that we rely on.
 * `etymology` and `matches` are optional in the source and validated loosely
 * (structure is passed through verbatim; we only confirm the required string
 * fields exist).
 */
function isMakeMeAHanziLine(value: unknown): value is RawMakeMeAHanziLine {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.character === 'string' &&
    typeof obj.decomposition === 'string' &&
    typeof obj.radical === 'string'
  );
}

/**
 * Extract leaf components from an IDS decomposition string.
 *
 * Keeps only codepoints in one of the recognised CJK/radical/stroke blocks:
 *   - CJK Unified Ideographs   U+4E00–U+9FFF
 *   - CJK Extension A          U+3400–U+4DBF
 *   - CJK Radicals Supplement  U+2E80–U+2EFF
 *   - Kangxi Radicals          U+2F00–U+2FDF
 *   - CJK Strokes              U+31C0–U+31EF
 *
 * Skips Ideographic Description Characters (U+2FF0–U+2FFB), the placeholder
 * ？ (U+FF1F) and anything else. De-dupes repeats, keeping first occurrence,
 * and preserves left-to-right order.
 */
export function extractLeafComponents(idsString: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const ch of idsString) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) {
      continue;
    }
    if (!isRecognisedComponentCodepoint(cp)) {
      continue;
    }
    if (seen.has(ch)) {
      continue;
    }
    seen.add(ch);
    result.push(ch);
  }

  return result;
}

function isRecognisedComponentCodepoint(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Extension A
    (cp >= 0x2e80 && cp <= 0x2eff) || // CJK Radicals Supplement
    (cp >= 0x2f00 && cp <= 0x2fdf) || // Kangxi Radicals
    (cp >= 0x31c0 && cp <= 0x31ef) //    CJK Strokes
  );
}

/**
 * Parse the full `dictionary.txt` content into a Map keyed by character.
 *
 * Lines are split on `\n`. Each non-empty line is JSON-parsed as `unknown`,
 * validated with `isMakeMeAHanziLine`, then transformed into a
 * `MakeMeAHanziEntry`. Malformed lines (invalid JSON or failing the guard) are
 * skipped silently — never thrown — so the character is simply absent.
 */
export function parseMakeMeAHanzi(
  rawText: string
): Map<string, MakeMeAHanziEntry> {
  const result = new Map<string, MakeMeAHanziEntry>();

  for (const line of rawText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue; // malformed JSON: skip
    }

    if (!isMakeMeAHanziLine(parsed)) {
      continue; // shape mismatch: skip
    }

    const atomic = parsed.decomposition.startsWith(QUESTION_MARK);
    const components = atomic
      ? [parsed.character]
      : extractLeafComponents(parsed.decomposition);

    result.set(parsed.character, {
      decomposition: parsed.decomposition,
      radical: parsed.radical,
      etymology: parsed.etymology ?? null,
      matches: parsed.matches ?? null,
      atomic,
      components,
    });
  }

  return result;
}
