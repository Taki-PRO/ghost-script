// Parser for data/prompt-approvals.csv.
//
// The approvals file lets a human accept the default ghost clue of a level 2 or
// 3 character without changing it. The CSV header MUST be exactly:
//
//   character,reviewedBy
//
// Each data row names a single CJK character and the reviewer, which must be
// exactly `human`.
//
// Like parse-prompt-overrides.ts, this parser only validates the SHAPE of the
// CSV. Whether the character belongs to a level list (`unknown-character`) is
// checked by the build, which reuses the same error shape.

/** Reason an approval row (or the file as a whole) failed validation. */
export interface PromptApprovalError {
  /** 1-indexed line number in the ORIGINAL raw CSV text. */
  line: number;
  character: string;
  reason:
    | 'unknown-character' // (reported by the build, not this parser)
    | 'invalid-reviewer'
    | 'malformed-row'
    | 'duplicate-character';
}

/** Result of parsing the approvals CSV: either the set or every error. */
export type ParsePromptApprovalsResult =
  | { ok: true; approvals: Set<string> }
  | { ok: false; errors: PromptApprovalError[] };

const EXPECTED_HEADER = ['character', 'reviewedBy'];

/** The only accepted reviewer value. */
const REQUIRED_REVIEWER = 'human';

/** Lower/upper bounds of the CJK Unified Ideographs block (U+4E00–U+9FFF). */
const CJK_START = 0x4e00;
const CJK_END = 0x9fff;

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
 * Parse the raw contents of data/prompt-approvals.csv.
 *
 * - The first non-empty line MUST be the exact header `character,reviewedBy`;
 *   otherwise a `malformed-row` error is emitted at line 1.
 * - Each data row must have exactly two comma-separated columns and a single
 *   CJK codepoint in the first (else `malformed-row`).
 * - `reviewedBy` must be exactly `human` (after trimming the cell); anything
 *   else, including an empty cell, is `invalid-reviewer`.
 * - A repeated character yields `duplicate-character` at the later line.
 * - Blank lines are skipped; line numbers are 1-indexed.
 *
 * Returns `{ ok: true, approvals }` only when zero errors are found; otherwise
 * `{ ok: false, errors }` with ALL errors.
 */
export function parsePromptApprovals(rawCsv: string): ParsePromptApprovalsResult {
  const lines = rawCsv.split('\n');
  const errors: PromptApprovalError[] = [];
  const approvals = new Set<string>();

  let headerSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const trimmed = lines[i].trim();

    if (trimmed === '') {
      continue;
    }

    if (!headerSeen) {
      headerSeen = true;
      const headerColumns = trimmed.split(',').map((column) => column.trim());
      const headerMatches =
        headerColumns.length === EXPECTED_HEADER.length &&
        EXPECTED_HEADER.every((expected, index) => headerColumns[index] === expected);
      if (!headerMatches) {
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
    const reviewedBy = columns[1].trim();

    if (!isSingleCjkCodepoint(character)) {
      errors.push({ line: lineNumber, character, reason: 'malformed-row' });
      continue;
    }

    if (reviewedBy !== REQUIRED_REVIEWER) {
      errors.push({ line: lineNumber, character, reason: 'invalid-reviewer' });
      continue;
    }

    if (approvals.has(character)) {
      errors.push({ line: lineNumber, character, reason: 'duplicate-character' });
      continue;
    }

    approvals.add(character);
  }

  if (!headerSeen) {
    errors.push({ line: 1, character: '', reason: 'malformed-row' });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, approvals };
}
