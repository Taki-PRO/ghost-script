// Feature: character-dataset, Property 1: CJK range validation rejects non-CJK codepoints
//
// **Validates: Requirements 1.4**
//
// Property 1 (design.md): For any string containing at least one codepoint
// OUTSIDE U+4E00–U+9FFF (as a line in the list), `parseCharacterList` returns
// `{ ok: false }` identifying each offending line with a `not-cjk` error at the
// correct 1-indexed line number — while comment (`#`) and blank lines are
// ignored. The inverse mini-property: an all-valid, duplicate-free list returns
// `{ ok: true }`.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  parseCharacterList,
  type CharacterListError,
} from '../../scripts/lib/parse-character-list';
import { arbitraryCharacter } from '../helpers/arbitraries';

// A single codepoint that is NOT a CJK Unified Ideograph (outside U+4E00–U+9FFF)
// and that survives the parser's `trim()` + comment filter: it must be a single
// visible, non-whitespace character that does not start with `#`. We mix real
// non-CJK categories (Latin letters, digits, punctuation, emoji) with
// codepoints just outside the CJK block boundaries (U+4DFF, U+A000) so the test
// exercises near-boundary cases rather than only far-away noise.
function arbitraryNonCjkCodepoint(): fc.Arbitrary<string> {
  return fc.oneof(
    // Latin letters A–Z, a–z
    fc
      .oneof(
        fc.integer({ min: 0x41, max: 0x5a }),
        fc.integer({ min: 0x61, max: 0x7a }),
      )
      .map((cp) => String.fromCodePoint(cp)),
    // Digits 0–9
    fc.integer({ min: 0x30, max: 0x39 }).map((cp) => String.fromCodePoint(cp)),
    // ASCII punctuation (excluding '#' U+0023, which would be read as a comment)
    fc
      .constantFrom('!', '$', '%', '&', '*', '+', '-', '/', '?', '@', '.', ',')
      .filter((c) => c !== '#'),
    // Emoji / astral-plane codepoints (single codepoint, surrogate pair in UTF-16)
    fc
      .constantFrom(0x1f47b, 0x1f480, 0x1f4a9, 0x1f600, 0x2603)
      .map((cp) => String.fromCodePoint(cp)),
    // Codepoints just outside the CJK Unified Ideographs block boundaries.
    //   U+4DFF: one below the block start (U+4E00)
    //   U+A000: one above the block end (U+9FFF)
    //   U+3000: CJK-adjacent but not an ideograph (ideographic space is
    //           whitespace, so use the Yijing/Kangxi-adjacent non-ideographs)
    fc
      .constantFrom(0x4dff, 0xa000, 0x3007, 0x2e80, 0x3400)
      .map((cp) => String.fromCodePoint(cp)),
  );
}

// A line "slot" in the generated raw text. Either:
//   - a valid CJK character (contributes to a potentially-ok list),
//   - an injected non-CJK character (MUST produce a not-cjk error), or
//   - an ignorable comment / blank line (MUST be skipped by the parser).
type Slot =
  | { kind: 'cjk'; value: string }
  | { kind: 'bad'; value: string }
  | { kind: 'ignored'; value: string };

function arbitrarySlot(): fc.Arbitrary<Slot> {
  return fc.oneof(
    { weight: 4, arbitrary: arbitraryCharacter().map((value) => ({ kind: 'cjk' as const, value })) },
    { weight: 3, arbitrary: arbitraryNonCjkCodepoint().map((value) => ({ kind: 'bad' as const, value })) },
    {
      weight: 2,
      arbitrary: fc
        .constantFrom('', '   ', '# comment', '#', '  # indented comment')
        .map((value) => ({ kind: 'ignored' as const, value })),
    },
  );
}

describe('Property 1: CJK range validation', () => {
  it('rejects any list containing a non-CJK codepoint, flagging each offending line', () => {
    fc.assert(
      fc.property(
        // A sequence of slots that is GUARANTEED to contain at least one bad
        // line: generate an arbitrary list of slots plus at least one bad slot,
        // then shuffle so the bad line can appear anywhere.
        fc
          .tuple(
            fc.array(arbitrarySlot(), { minLength: 0, maxLength: 20 }),
            fc.array(arbitraryNonCjkCodepoint(), { minLength: 1, maxLength: 5 }),
          )
          .chain(([slots, badValues]) => {
            const guaranteedBad: Slot[] = badValues.map((value) => ({
              kind: 'bad' as const,
              value,
            }));
            const all = [...slots, ...guaranteedBad];
            return fc
              .shuffledSubarray(all, { minLength: all.length, maxLength: all.length })
              .map((shuffled) => shuffled);
          }),
        (slots: Slot[]) => {
          const raw = slots.map((s) => s.value).join('\n');

          // Expected not-cjk errors: every 'bad' slot, at its 1-indexed line.
          // The parser trims each line; a bad value never trims to '' and never
          // starts with '#', so each bad line yields exactly one not-cjk error.
          const expectedBad = slots
            .map((slot, index) => ({ slot, line: index + 1 }))
            .filter(({ slot }) => slot.kind === 'bad')
            .map(({ slot, line }) => ({
              line,
              character: slot.value,
              reason: 'not-cjk' as const,
            }));

          const result = parseCharacterList(raw);

          // At least one bad line is guaranteed, so the result must be a failure.
          expect(result.ok).toBe(false);
          if (result.ok) {
            return;
          }

          // Every injected non-CJK line appears as a not-cjk error with the
          // correct 1-indexed line number and the verbatim offending value.
          const notCjkErrors: CharacterListError[] = result.errors.filter(
            (e) => e.reason === 'not-cjk',
          );
          expect(notCjkErrors).toEqual(expectedBad);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('inverse: an all-valid, duplicate-free list returns ok: true', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(arbitraryCharacter(), { minLength: 1, maxLength: 320 }),
        (chars: string[]) => {
          const raw = chars.join('\n');
          const result = parseCharacterList(raw);
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.characters).toEqual(chars);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
