/**
 * Display-only cleanup of dictionary-style notes in a prompt meaning.
 * Pure, idempotent, and additive-free.
 */

/** Opening of a parenthetical note that is removed as a whole (balanced). */
const NOTE_PAREN_START = /\((?:CL:|e\.g\.|Taiwan pr\.)/;

/** Bare classifier note: `CL:` at the start or after a non-alphanumeric char. */
const BARE_CL_START = /(^|[^A-Za-z0-9])CL:/;

/** `Taiwan pr. [...]`, `also pr. [...]`, `colloquial pr. [...]` (bracket required). */
const PR_NOTE = /(?:[A-Za-z]+\s+)?pr\.\s*\[[^\]]*\]/g;

/** Any remaining bracketed pinyin reference such as `[shen2 me5]`. */
const BRACKET_REF = /\[[^[\]]*\]/g;

/**
 * Index just past the parenthetical that opens at `open` (balanced), or the
 * string length when it never closes.
 */
function endOfParenthetical(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return s.length;
}

/**
 * Index where a bare `CL:` clause ends: the next `;` or unmatched `)` at
 * nesting depth 0 (not consumed), or the end of the string.
 */
function endOfClause(s: string, from: number): number {
  let depth = 0;
  for (let i = from; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') {
      if (depth === 0) {
        if (c === ')') return i;
      } else depth--;
    } else if (c === ';' && depth === 0) return i;
  }
  return s.length;
}

function removeParentheticals(s: string): string {
  let out = s;
  for (let m = NOTE_PAREN_START.exec(out); m !== null; m = NOTE_PAREN_START.exec(out)) {
    out = out.slice(0, m.index) + out.slice(endOfParenthetical(out, m.index));
  }
  return out;
}

function removeBareClassifiers(s: string): string {
  let out = s;
  for (let m = BARE_CL_START.exec(out); m !== null; m = BARE_CL_START.exec(out)) {
    const start = m.index + (m[1]?.length ?? 0);
    out = out.slice(0, start) + out.slice(endOfClause(out, start + 3));
  }
  return out;
}

/** Collapse each whitespace run to its first character (never adds a char). */
function collapseWhitespace(s: string): string {
  return s.replace(/\s+/gu, (run) => run.charAt(0));
}

/** One full pass: remove notes, then tidy. Only ever deletes characters. */
function step(s: string): string {
  let out = removeParentheticals(s);
  out = removeBareClassifiers(out);
  out = out.replace(PR_NOTE, '').replace(BRACKET_REF, '').replace(/\(\s*\)/gu, '');
  out = collapseWhitespace(out);
  out = out.replace(/;(?:\s*;)+/gu, ';'); // "; ;" -> ";"
  out = out.replace(/^[\s;,]+/u, '').replace(/[\s;,]+$/u, '');
  return out;
}

/**
 * Remove dictionary-style notes from a prompt meaning for DISPLAY ONLY.
 *
 * Removes `(CL:...)`, bare `CL:...` (to the end of the clause), `[pin1 yin1]`
 * references, `(e.g. ...)` clauses, and `Taiwan pr. [...]`, `(Taiwan pr. ...)`,
 * `also pr. [...]` notes. Then trims, collapses whitespace runs to the first
 * whitespace character of the run, and drops dangling `;`/`,` separators.
 *
 * Guarantees: output is built only by deleting characters from the input, so it
 * never contains a character absent from the input; removal is repeated to a
 * fixpoint, so the function is idempotent; when cleanup would leave nothing
 * (empty/whitespace-only), the original `raw` is returned unchanged, so a
 * non-empty input never yields an empty output.
 *
 * Never mutates characters.json or any record. `prompt.pinyin` is displayed as
 * stored and must NEVER be passed through this function.
 */
export function cleanupMeaning(raw: string): string {
  let current = raw;
  for (;;) {
    const next = step(current);
    if (next === current) break;
    current = next;
  }
  return current.trim() === '' ? raw : current;
}
