// Feature: character-dataset, Property 18: prompt.meaning is a source meaning (after prefix stripping)
// Feature: character-dataset, Property 19: prompt.pinyin is the tone-mark form of a source reading
// Feature: character-dataset, Property 20: no default prompt begins with a skipped prefix
//
// These properties exercise `selectPrompt` under the DEFAULT rule (no override)
// against realistic CC-CEDICT entries produced by `arbitraryCcCedictEntry()`
// (a mix of usable, `(bound form) `-prefixed and skipped-prefix glosses, plus
// occasional proper-noun readings). For every generated entry we select a
// prompt for a generated character and assert:
//
//   Property 18: the chosen meaning is one of the chosen entry's glosses, OR
//     that gloss with a single leading `(bound form) ` stripped, and is
//     non-empty. (Checked against `entry.entries[choice.entryIndex].meanings`.)
//   Property 19: the chosen pinyin is exactly the tone-mark form of the chosen
//     entry's reading (`numberedToToneMarks(entry.entries[choice.entryIndex]
//     .reading)`).
//   Property 20: the chosen meaning (lowercased) does not begin with any of the
//     skipped prefixes.
//
// When selection fails with `{ ok: false, reason: 'no-usable-sense' }`, we
// assert the failure is JUSTIFIED: every entry is either a proper-noun reading
// or has all of its glosses skipped/empty. This guarantees selectPrompt never
// gives up while a usable sense exists.
//
// Bonus (SAME-ENTRY guarantee, Property 22 proper is in 14.7): the chosen
// meaning and reading share `choice.entryIndex`, verified by checking both the
// meaning and the pinyin against that single entry.
//
// Validates: Requirements 6.2, 6.3, 6.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { CcCedictEntry } from '../../scripts/lib/parse-cc-cedict';
import { numberedToToneMarks, selectPrompt } from '../../scripts/lib/prompt';
import {
  arbitraryCcCedictEntry,
  arbitraryCharacter,
} from '../helpers/arbitraries';

// Mirror of SKIPPED_PREFIXES in scripts/lib/prompt.ts (checked case-insensitively
// after a single leading `(bound form) ` prefix is stripped).
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
] as const;

const BOUND_FORM_PREFIX = '(bound form) ';

/** Strip a single leading `(bound form) ` prefix, then trim (as prompt.ts does). */
function stripBoundForm(gloss: string): string {
  if (gloss.startsWith(BOUND_FORM_PREFIX)) {
    return gloss.slice(BOUND_FORM_PREFIX.length).trim();
  }
  return gloss.trim();
}

function hasSkippedPrefix(strippedGloss: string): boolean {
  const lower = strippedGloss.toLowerCase();
  return SKIPPED_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/** Proper-noun reading detector: first alphabetic char is uppercase. */
function isProperNounReading(reading: string): boolean {
  for (const ch of reading) {
    if (/[A-Za-z]/.test(ch)) {
      return ch === ch.toUpperCase() && ch !== ch.toLowerCase();
    }
  }
  return false;
}

/** An entry yields no usable gloss when every gloss strips to empty or skipped. */
function entryHasUsableGloss(meanings: string[]): boolean {
  return meanings.some((gloss) => {
    const stripped = stripBoundForm(gloss);
    return stripped.length > 0 && !hasSkippedPrefix(stripped);
  });
}

describe('Property 18: prompt.meaning is a source meaning (after prefix stripping)', () => {
  it('the chosen meaning is a (bound-form-stripped) gloss of the chosen entry and is non-empty', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryCcCedictEntry(),
        (char: string, entry: CcCedictEntry) => {
          const result = selectPrompt(char, entry, undefined);
          if (!result.ok) {
            return; // covered by the no-usable-sense justification test
          }
          const { choice } = result;
          const chosenEntry = entry.entries[choice.entryIndex];
          expect(chosenEntry).toBeDefined();

          expect(choice.meaning.length).toBeGreaterThan(0);

          // The meaning is one of the chosen entry's glosses, either verbatim
          // or with a single leading `(bound form) ` stripped.
          const candidates = chosenEntry.meanings.map(stripBoundForm);
          expect(candidates).toContain(choice.meaning);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 19: prompt.pinyin is the tone-mark form of a source reading', () => {
  it('the chosen pinyin equals numberedToToneMarks of the chosen entry reading', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryCcCedictEntry(),
        (char: string, entry: CcCedictEntry) => {
          const result = selectPrompt(char, entry, undefined);
          if (!result.ok) {
            return;
          }
          const { choice } = result;
          const chosenEntry = entry.entries[choice.entryIndex];
          expect(chosenEntry).toBeDefined();

          expect(choice.pinyin).toBe(numberedToToneMarks(chosenEntry.reading));
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 20: no default prompt begins with a skipped prefix', () => {
  it('the chosen meaning (lowercased) does not start with any skipped prefix', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryCcCedictEntry(),
        (char: string, entry: CcCedictEntry) => {
          const result = selectPrompt(char, entry, undefined);
          if (!result.ok) {
            return;
          }
          const lower = result.choice.meaning.toLowerCase();
          for (const prefix of SKIPPED_PREFIXES) {
            expect(lower.startsWith(prefix)).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('a no-usable-sense failure is justified: every entry is proper-noun or has no usable gloss', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryCcCedictEntry(),
        (char: string, entry: CcCedictEntry) => {
          const result = selectPrompt(char, entry, undefined);
          if (result.ok) {
            return;
          }
          // Failure must be justified: no entry offers a usable sense.
          for (const sense of entry.entries) {
            const unusable =
              isProperNounReading(sense.reading) ||
              !entryHasUsableGloss(sense.meanings);
            expect(unusable).toBe(true);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Bonus: prompt meaning and reading come from the same entry', () => {
  it('the chosen meaning and pinyin both resolve against choice.entryIndex', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryCcCedictEntry(),
        (char: string, entry: CcCedictEntry) => {
          const result = selectPrompt(char, entry, undefined);
          if (!result.ok) {
            return;
          }
          const { choice } = result;
          const chosenEntry = entry.entries[choice.entryIndex];
          expect(chosenEntry).toBeDefined();

          // Meaning belongs to this entry...
          const candidates = chosenEntry.meanings.map(stripBoundForm);
          expect(candidates).toContain(choice.meaning);
          // ...and the reading belongs to the SAME entry.
          expect(choice.pinyin).toBe(numberedToToneMarks(chosenEntry.reading));
        },
      ),
      { numRuns: 200 },
    );
  });
});
