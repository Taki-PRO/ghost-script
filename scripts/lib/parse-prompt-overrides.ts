// Parser for data/prompt-overrides.csv.
//
// The overrides file lets a human pin the ghost-clue meaning and reading for a
// character by index, instead of relying on the default selection rule. The
// CSV header MUST be exactly:
//
//   character,entryIndex,meaningIndex,reviewedBy
//
// Each data row names a single CJK character, the index of the CC-CEDICT entry
// (sense) to use, the index of the gloss within that entry, and the reviewer
// who vetted the choice.
//
// This parser only validates the SHAPE of the CSV: header correctness, column
// count, a single-codepoint character, non-negative integer indices, and a
// non-empty reviewer. It also rejects duplicate characters. It does NOT check
// whether the indices are in range for the character's merged CC-CEDICT data —
// that requires the parsed dictionary and happens in the build (task 11.1).
// The `PromptOverrideError` reason union still enumerates those build-time
// reasons so the build can reuse the same error shape.

// `PromptOverride` is defined canonically in ./prompt (written in parallel).
// Shape: { character: string; entryIndex: number; meaningIndex: number; reviewedBy: string }
import type { PromptOverride } from './prompt';

/** Reason a prompt-override row (or the file as a whole) failed validation. */
export interface PromptOverrideError {
  /** 1-indexed line number in the ORIGINAL raw CSV text. */
  line: number;
  character: string;
  reason:
    | 'unknown-character' // (reported by the build, not this parser)
    | 'entry-index-out-of-range' // (reported by the build)
    | 'meaning-index-out-of-range' // (reported by the build)
    | 'missing-reviewer'
    | 'malformed-row'
    | 'duplicate-character';
}

/** Result of parsing the overrides CSV: either the map or every error. */
export type ParsePromptOverridesResult =
  | { ok: true; overrides: Map<string, PromptOverride> }
  | { ok: false; errors: PromptOverrideError[] };

/** The exact required header, split into its four columns. */
const EXPECTED_HEADER = ['character', 'entryIndex', 'meaningIndex', 'reviewedBy'];

/** Lower/upper bounds of the CJK Unified Ideographs block (U+4E00–U+9FFF). */
const CJK_START = 0x4e00;
const CJK_END = 0x9fff;

/**
 * Returns true when `value` is exactly one codepoint in U+4E00–U+9FFF.
 *
 * Uses Array.from so that a surrogate pair counts as a single codepoint rather
 * than two UTF-16 code units.
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
 * Returns the parsed non-negative integer for `value`, or null when `value` is
 * not a plain non-negative integer (no sign, no decimal, no extra characters).
 */
function parseNonNegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

/**
 * Parse the raw contents of data/prompt-overrides.csv.
 *
 * - The first non-empty line MUST be the exact header
 *   `character,entryIndex,meaningIndex,reviewedBy`; otherwise a `malformed-row`
 *   error is emitted at line 1.
 * - Each data row must have exactly four comma-separated columns.
 * - `character` must be a single CJK codepoint; `entryIndex` and `meaningIndex`
 *   must be non-negative integers (else `malformed-row`).
 * - `reviewedBy` must be non-empty after trimming (else `missing-reviewer`).
 * - A character repeated across rows yields a `duplicate-character` error at the
 *   second (and any later) occurrence's line.
 * - Blank lines are skipped; a trailing newline is allowed.
 * - Line numbers are 1-indexed against the original CSV text.
 *
 * Range validation (`unknown-character`, `entry-index-out-of-range`,
 * `meaning-index-out-of-range`) is NOT performed here — it needs merged
 * CC-CEDICT data and happens in the build.
 *
 * Returns `{ ok: true, overrides }` only when zero errors are found; otherwise
 * `{ ok: false, errors }` with ALL errors.
 */
export function parsePromptOverrides(rawCsv: string): ParsePromptOverridesResult {
  const lines = rawCsv.split('\n');
  const errors: PromptOverrideError[] = [];
  const overrides = new Map<string, PromptOverride>();

  let headerSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const trimmed = lines[i].trim();

    // Skip blank lines (including an optional trailing newline).
    if (trimmed === '') {
      continue;
    }

    // The first non-empty line must be the exact header.
    if (!headerSeen) {
      headerSeen = true;
      const headerColumns = trimmed.split(',').map((column) => column.trim());
      const headerMatches =
        headerColumns.length === EXPECTED_HEADER.length &&
        EXPECTED_HEADER.every((expected, index) => headerColumns[index] === expected);
      if (!headerMatches) {
        // Report the bad header at line 1 as specified, regardless of where the
        // first non-empty line actually fell.
        errors.push({ line: 1, character: '', reason: 'malformed-row' });
      }
      continue;
    }

    const columns = trimmed.split(',');
    if (columns.length !== EXPECTED_HEADER.length) {
      errors.push({ line: lineNumber, character: trimmed, reason: 'malformed-row' });
      continue;
    }

    const character = columns[0].trim();
    const entryIndexRaw = columns[1].trim();
    const meaningIndexRaw = columns[2].trim();
    const reviewedBy = columns[3].trim();

    if (!isSingleCjkCodepoint(character)) {
      errors.push({ line: lineNumber, character, reason: 'malformed-row' });
      continue;
    }

    const entryIndex = parseNonNegativeInteger(entryIndexRaw);
    const meaningIndex = parseNonNegativeInteger(meaningIndexRaw);
    if (entryIndex === null || meaningIndex === null) {
      errors.push({ line: lineNumber, character, reason: 'malformed-row' });
      continue;
    }

    if (reviewedBy === '') {
      errors.push({ line: lineNumber, character, reason: 'missing-reviewer' });
      continue;
    }

    if (overrides.has(character)) {
      errors.push({ line: lineNumber, character, reason: 'duplicate-character' });
      continue;
    }

    overrides.set(character, { character, entryIndex, meaningIndex, reviewedBy });
  }

  // A file with no header line at all is malformed.
  if (!headerSeen) {
    errors.push({ line: 1, character: '', reason: 'malformed-row' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, overrides };
}
