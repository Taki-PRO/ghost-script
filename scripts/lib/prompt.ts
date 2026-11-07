// Ghost-prompt selection and numbered-pinyin → tone-mark conversion.
//
// `selectPrompt` chooses the English meaning and reading shown on a ghost for a
// character. Selection is ENTRY-BASED: the meaning and reading always come from
// the SAME CC-CEDICT entry (see Requirement 6, esp. 6.4, 6.8, 6.12). This fixes
// an earlier flaw where a meaning could be paired with a reading from a
// different entry (e.g. 了 "to finish" wrongly paired with the `le5` reading).
//
// `PromptOverride` is defined canonically HERE and imported as a type by
// scripts/lib/parse-prompt-overrides.ts.
//
// Both functions are pure and deterministic: no I/O, no throwing on a selection
// failure (a failure returns `{ ok: false, reason: 'no-usable-sense' }`).

import type { CcCedictEntry } from './parse-cc-cedict';

/**
 * A human-authored selection, by index only, of which CC-CEDICT sense to use
 * for a character's ghost prompt. Never carries free-text meaning or pinyin.
 */
export interface PromptOverride {
  character: string;
  /** Index into `ccCedict.entries`. */
  entryIndex: number;
  /** Index into `ccCedict.entries[entryIndex].meanings`. */
  meaningIndex: number;
  reviewedBy: string;
}

/** The resolved ghost clue: meaning + reading drawn from a single entry. */
export interface PromptChoice {
  /** Chosen gloss after a single leading `(bound form) ` prefix is stripped. */
  meaning: string;
  /** Tone-mark form of the chosen entry's reading. */
  pinyin: string;
  /** Index of the chosen entry within `ccCedict.entries`. */
  entryIndex: number;
  /** Index of the chosen gloss within that entry's `meanings`. */
  meaningIndex: number;
  /** True when the choice came from an override rather than the default rule. */
  fromOverride: boolean;
}

/** Outcome of prompt selection: a choice, or a single collapsed failure. */
export type PromptSelectionResult =
  | { ok: true; choice: PromptChoice }
  | { ok: false; reason: 'no-usable-sense' };

/**
 * Case-insensitive gloss prefixes that are NOT usable standalone ghost clues.
 * Checked AFTER a single leading `(bound form) ` prefix is stripped.
 */
const SKIPPED_PREFIXES = [
  'surname ',
  'variant of',
  'old variant of',
  'used in',
  'see ',
  'abbr.',
  'cl:',
  'also pr.',
  'taiwan pr.',
];

const BOUND_FORM_PREFIX = '(bound form) ';

/**
 * Strip a SINGLE leading `(bound form) ` prefix from a gloss, then trim. Used
 * for both comparison against the skip list and for the emitted meaning.
 */
function stripBoundForm(gloss: string): string {
  if (gloss.startsWith(BOUND_FORM_PREFIX)) {
    return gloss.slice(BOUND_FORM_PREFIX.length).trim();
  }
  return gloss.trim();
}

/** True when the stripped gloss begins (case-insensitively) with a skip prefix. */
function hasSkippedPrefix(strippedGloss: string): boolean {
  const lower = strippedGloss.toLowerCase();
  return SKIPPED_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * True when a reading's first alphabetic character is uppercase. CC-CEDICT
 * capitalises proper-noun readings (e.g. `San`, `Wang`, `Zhong`), so such a
 * reading marks the whole entry as a proper noun to be skipped by default.
 */
function isProperNounReading(reading: string): boolean {
  for (const ch of reading) {
    if (/[A-Za-z]/.test(ch)) {
      return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
    }
  }
  return false;
}

/**
 * Choose the ghost clue for `char`.
 *
 * Default rule (no override): walk `ccCedict.entries` in source order. Skip any
 * entry whose reading is a proper-noun reading. Otherwise scan that entry's
 * glosses in order; the first gloss that, after `(bound form) ` stripping, is
 * non-empty and does not begin with a skipped prefix wins. The meaning and
 * reading then both come from that same entry.
 *
 * Override rule: take the entry and gloss by index from `ccCedict.entries`,
 * apply `(bound form) ` stripping to the gloss, and use that entry's reading.
 * Index validity is checked upstream in the build; here we code defensively and
 * return `{ ok: false, reason: 'no-usable-sense' }` rather than throwing if the
 * indices are out of range or the gloss strips to empty.
 */
export function selectPrompt(
  char: string,
  ccCedict: CcCedictEntry,
  override: PromptOverride | undefined,
): PromptSelectionResult {
  if (override !== undefined) {
    return selectFromOverride(ccCedict, override);
  }
  return selectDefault(ccCedict);
}

function selectFromOverride(
  ccCedict: CcCedictEntry,
  override: PromptOverride,
): PromptSelectionResult {
  const entry = ccCedict.entries[override.entryIndex];
  if (entry === undefined) {
    return { ok: false, reason: 'no-usable-sense' };
  }
  const rawGloss = entry.meanings[override.meaningIndex];
  if (rawGloss === undefined) {
    return { ok: false, reason: 'no-usable-sense' };
  }
  const meaning = stripBoundForm(rawGloss);
  if (meaning.length === 0) {
    return { ok: false, reason: 'no-usable-sense' };
  }
  return {
    ok: true,
    choice: {
      meaning,
      pinyin: numberedToToneMarks(entry.reading),
      entryIndex: override.entryIndex,
      meaningIndex: override.meaningIndex,
      fromOverride: true,
    },
  };
}

function selectDefault(ccCedict: CcCedictEntry): PromptSelectionResult {
  for (let entryIndex = 0; entryIndex < ccCedict.entries.length; entryIndex++) {
    const entry = ccCedict.entries[entryIndex];
    if (isProperNounReading(entry.reading)) {
      continue;
    }
    for (let meaningIndex = 0; meaningIndex < entry.meanings.length; meaningIndex++) {
      const meaning = stripBoundForm(entry.meanings[meaningIndex]);
      if (meaning.length === 0 || hasSkippedPrefix(meaning)) {
        continue;
      }
      return {
        ok: true,
        choice: {
          meaning,
          pinyin: numberedToToneMarks(entry.reading),
          entryIndex,
          meaningIndex,
          fromOverride: false,
        },
      };
    }
  }
  return { ok: false, reason: 'no-usable-sense' };
}

// --- Numbered pinyin → tone marks -----------------------------------------

/**
 * Toned forms of each base vowel for tones 1–4 (index 0..3). Tone 5 (neutral)
 * carries no diacritic and is handled by stripping the digit.
 */
const TONED_VOWELS: Record<string, [string, string, string, string]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

/**
 * Convert a numbered-pinyin reading to its tone-mark form. The reading may be a
 * single syllable or several syllables separated by whitespace (e.g.
 * `pin1 yin1`); each whitespace-separated syllable is converted independently
 * and rejoined with single spaces.
 */
export function numberedToToneMarks(numberedPinyin: string): string {
  const syllables = numberedPinyin.trim().split(/\s+/).filter((s) => s.length > 0);
  return syllables.map(convertSyllable).join(' ');
}

/**
 * Convert one syllable. If it has no trailing tone digit it is returned
 * unchanged (after `u:`/`v` → `ü` normalisation, which only triggers when a
 * tone digit is present so untoned text is untouched).
 */
function convertSyllable(syllable: string): string {
  const match = /^(.*?)([1-5])$/.exec(syllable);
  if (match === null) {
    // No trailing tone digit — leave unchanged.
    return syllable;
  }
  const body = match[1];
  const tone = Number.parseInt(match[2], 10);

  // Normalise CC-CEDICT's `u:` and `v` spellings of ü (preserving case).
  const normalised = body
    .replace(/u:/g, 'ü')
    .replace(/U:/g, 'Ü')
    .replace(/v/g, 'ü')
    .replace(/V/g, 'Ü');

  // Tone 5 (neutral): strip the digit, no diacritic.
  if (tone === 5) {
    return normalised;
  }

  const markIndex = vowelToMarkIndex(normalised);
  if (markIndex === -1) {
    // No vowel to mark — return normalised body without the digit.
    return normalised;
  }

  const target = normalised[markIndex];
  const lower = target.toLowerCase();
  const tonedLower = TONED_VOWELS[lower]?.[tone - 1];
  if (tonedLower === undefined) {
    return normalised;
  }
  const toned = target === target.toUpperCase() && target !== target.toLowerCase()
    ? tonedLower.toUpperCase()
    : tonedLower;

  return normalised.slice(0, markIndex) + toned + normalised.slice(markIndex + 1);
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ü']);

/**
 * Index (into the syllable body) of the vowel that receives the tone mark,
 * using the standard rule: an `a` wins; else an `e`; else in `ou` the `o`;
 * else the LAST vowel. Returns -1 when the syllable has no vowel.
 */
function vowelToMarkIndex(body: string): number {
  const lower = body.toLowerCase();

  const aIndex = lower.indexOf('a');
  if (aIndex !== -1) {
    return aIndex;
  }
  const eIndex = lower.indexOf('e');
  if (eIndex !== -1) {
    return eIndex;
  }
  const ouIndex = lower.indexOf('ou');
  if (ouIndex !== -1) {
    return ouIndex; // the `o` of `ou`
  }

  // Otherwise the last vowel among a/e/i/o/u/ü.
  for (let i = lower.length - 1; i >= 0; i--) {
    if (VOWELS.has(lower[i])) {
      return i;
    }
  }
  return -1;
}
