// The Clue_Rule: the default ghost-prompt rule of levels 2 and 3.
//
// 1. Reading: count the syllable of the character in every CC-CEDICT entry of
//    its HSK example words; the single most frequent reading wins. A tie or no
//    usable example keeps the reading of the Current_Rule (`selectPrompt`).
// 2. Meaning: the first gloss, in source order, of an entry with that reading
//    that is not empty, not a cross-reference and has no Han character once
//    `cleanupMeaning` has run. Otherwise the Current_Rule's choice.
//
// Pure: no I/O. Meaning and pinyin always come from one CC-CEDICT entry.

import { cleanupMeaning } from '../../app/src/engine/promptCleanup';
import type { CcCedictEntry } from './parse-cc-cedict';
import {
  isProperNounReading,
  numberedToToneMarks,
  selectPrompt,
  stripBoundForm,
} from './prompt';
import type { PromptSelectionResult } from './prompt';

/** Lower-case a numbered syllable and read `u:` and `v` as `ü`. */
export function normaliseSyllable(s: string): string {
  return s.toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
}

function normaliseReading(reading: string): string {
  return reading
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map(normaliseSyllable)
    .join(' ');
}

/**
 * Count readings of `char` over its example words. For each word containing
 * `char`, each CC-CEDICT entry of exactly that word whose reading has one
 * syllable per character adds one count to the syllable at the position of the
 * first occurrence of `char`. Tone 5 and syllables without a digit 1 to 4 are
 * not counted.
 */
export function readingCounts(
  char: string,
  exampleWords: readonly string[],
  cc: ReadonlyMap<string, CcCedictEntry>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of exampleWords) {
    const letters = Array.from(word);
    const position = letters.indexOf(char);
    if (position === -1) {
      continue;
    }
    const found = cc.get(word);
    if (found === undefined) {
      continue;
    }
    for (const entry of found.entries) {
      const syllables = entry.reading.trim().split(/\s+/).filter((s) => s.length > 0);
      if (syllables.length !== letters.length) {
        continue;
      }
      const syllable = normaliseSyllable(syllables[position]);
      if (!/[1-4]$/.test(syllable)) {
        continue;
      }
      counts.set(syllable, (counts.get(syllable) ?? 0) + 1);
    }
  }
  return counts;
}

/** The reading with the highest count, or undefined on a tie or no counts. */
export function topReading(counts: ReadonlyMap<string, number>): string | undefined {
  let best: string | undefined;
  let bestCount = 0;
  let tied = false;
  for (const [reading, count] of counts) {
    if (count > bestCount) {
      best = reading;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  return tied ? undefined : best;
}

const CROSS_REFERENCE_PREFIXES = [
  'variant of',
  'old variant of',
  'see ',
  'used in',
  'surname ',
  'abbr.',
  'cl:',
  'also pr.',
  'taiwan pr.',
];

/**
 * True for a gloss that is not a standalone clue. `stripped` is the gloss after
 * a single leading `(bound form) ` has been removed.
 */
export function isCrossReferenceGloss(stripped: string): boolean {
  const lower = stripped.toLowerCase();
  return (
    CROSS_REFERENCE_PREFIXES.some((prefix) => lower.startsWith(prefix)) ||
    lower.includes('(tw)') ||
    lower.includes('(archaic)')
  );
}

/** True when `text` contains a Han character. */
export function containsHan(text: string): boolean {
  return /\p{Script=Han}/u.test(text);
}

/**
 * Choose the ghost clue for `char` by the Clue_Rule. Falls back to the
 * Current_Rule's result when no entry with the chosen reading has a clean
 * gloss; a Current_Rule failure is returned unchanged.
 */
export function selectPromptByExamples(
  char: string,
  entry: CcCedictEntry,
  exampleWords: readonly string[],
  cc: ReadonlyMap<string, CcCedictEntry>,
): PromptSelectionResult {
  const current = selectPrompt(char, entry, undefined);
  if (!current.ok) {
    return current;
  }
  const wanted =
    topReading(readingCounts(char, exampleWords, cc)) ??
    normaliseReading(entry.entries[current.choice.entryIndex].reading);

  for (let entryIndex = 0; entryIndex < entry.entries.length; entryIndex++) {
    const sense = entry.entries[entryIndex];
    if (isProperNounReading(sense.reading)) {
      continue;
    }
    if (normaliseReading(sense.reading) !== wanted) {
      continue;
    }
    for (let meaningIndex = 0; meaningIndex < sense.meanings.length; meaningIndex++) {
      const meaning = stripBoundForm(sense.meanings[meaningIndex]);
      if (
        meaning.length === 0 ||
        isCrossReferenceGloss(meaning) ||
        containsHan(cleanupMeaning(meaning))
      ) {
        continue;
      }
      return {
        ok: true,
        choice: {
          meaning,
          pinyin: numberedToToneMarks(sense.reading),
          entryIndex,
          meaningIndex,
          fromOverride: false,
        },
      };
    }
  }
  return current;
}
