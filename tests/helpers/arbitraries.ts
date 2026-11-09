// Shared fast-check arbitraries for the character-dataset property tests.
//
// These factories model VALID *inputs* to the data pipeline (parsed source
// entries, stroke data, decompositions) and VALID assembled records. They are
// deliberately realistic — real-looking pinyin syllables, real IDS/IDC
// characters, real gloss prefixes — so the property tests in 13.2+ genuinely
// exercise the correctness properties (1–22) rather than bouncing off random
// noise that the code trivially rejects.
//
// Consistency notes (see property set in design.md):
//   - CC-CEDICT flat `pinyin`/`meanings` are DERIVED from `entries` here
//     (first-occurrence dedup) exactly as the real parser produces them
//     (Property 5), so generated entries are internally consistent.
//   - Decomposition `components` are computed with the real
//     `extractLeafComponents` (non-atomic) or `[character]` (atomic), matching
//     the pipeline rule the invariants in Properties 8, 9 and 16 depend on.
//   - A `CharacterRecord`'s `strokeCount` equals `strokeData.strokes.length`
//     and `sources` uses the fixed DatasetId mapping, so valid records satisfy
//     Properties 4, 10, 13, 14, 15 by construction — without over-constraining,
//     since the arbitraries model inputs while the properties assert the
//     pipeline/record invariants.

import fc from 'fast-check';

import type {
  CharacterRecord,
  Decomposition,
  Etymology,
  FieldSources,
  Prompt,
  StrokeData,
} from '../../app/src/data/types';
import type {
  CcCedictEntry,
  CcCedictSense,
} from '../../scripts/lib/parse-cc-cedict';
import { extractLeafComponents } from '../../scripts/lib/parse-make-me-a-hanzi';

// --- Characters & components ------------------------------------------------

/** A single codepoint in CJK Unified Ideographs (U+4E00–U+9FFF). */
export function arbitraryCharacter(): fc.Arbitrary<string> {
  return fc
    .integer({ min: 0x4e00, max: 0x9fff })
    .map((cp) => String.fromCodePoint(cp));
}

/**
 * A single codepoint drawn from the five allowed component blocks:
 *   - CJK Unified Ideographs   U+4E00–U+9FFF
 *   - CJK Extension A          U+3400–U+4DBF
 *   - CJK Radicals Supplement  U+2E80–U+2EFF
 *   - Kangxi Radicals          U+2F00–U+2FDF
 *   - CJK Strokes              U+31C0–U+31EF
 *
 * Used by the decomposition/components properties (8, 16).
 */
export function arbitraryComponentCharacter(): fc.Arbitrary<string> {
  return fc
    .oneof(
      fc.integer({ min: 0x4e00, max: 0x9fff }),
      fc.integer({ min: 0x3400, max: 0x4dbf }),
      fc.integer({ min: 0x2e80, max: 0x2eff }),
      fc.integer({ min: 0x2f00, max: 0x2fdf }),
      fc.integer({ min: 0x31c0, max: 0x31ef }),
    )
    .map((cp) => String.fromCodePoint(cp));
}

/** A non-empty, de-duplicated list of CJK characters (1..320). */
export function arbitraryCharacterList(): fc.Arbitrary<string[]> {
  return fc.uniqueArray(arbitraryCharacter(), { minLength: 1, maxLength: 320 });
}

// --- Pinyin -----------------------------------------------------------------

/** Real pinyin onsets (initials). An empty onset models a zero-initial syllable. */
const PINYIN_ONSETS = [
  '',
  'b',
  'p',
  'm',
  'f',
  'd',
  't',
  'n',
  'l',
  'g',
  'k',
  'h',
  'j',
  'q',
  'x',
  'zh',
  'ch',
  'sh',
  'r',
  'z',
  'c',
  's',
  'y',
  'w',
] as const;

/** Real pinyin finals. */
const PINYIN_FINALS = [
  'a',
  'o',
  'e',
  'i',
  'u',
  'ai',
  'ei',
  'ao',
  'ou',
  'an',
  'en',
  'ang',
  'eng',
  'ong',
  'ian',
  'uan',
  'ing',
  'uo',
  'ie',
  'iu',
  'in',
  'un',
] as const;

/**
 * A realistic NUMBERED pinyin syllable: onset + final + tone digit (1–5).
 *
 * Occasionally emits a `u:` / `v` final (e.g. `lu:4`, `lv4`) so the ü
 * normalisation path is exercised, and occasionally capitalises the onset
 * (proper-noun reading, e.g. `San1`) so prompt selection's proper-noun skip is
 * exercised. Output is lowercase except for the optional proper-noun capital.
 */
export function arbitraryPinyinSyllable(): fc.Arbitrary<string> {
  return fc
    .record({
      onset: fc.constantFrom(...PINYIN_ONSETS),
      final: fc.oneof(
        { weight: 9, arbitrary: fc.constantFrom(...PINYIN_FINALS) },
        // ü-bearing finals, in both CC-CEDICT spellings.
        { weight: 1, arbitrary: fc.constantFrom('u:', 'v', 'u:e', 've') },
      ),
      tone: fc.integer({ min: 1, max: 5 }),
      properNoun: fc.boolean(),
    })
    .map(({ onset, final, tone, properNoun }) => {
      const body = `${onset}${final}`;
      const cased =
        properNoun && body.length > 0
          ? body.charAt(0).toUpperCase() + body.slice(1)
          : body;
      return `${cased}${tone}`;
    });
}

/** A possibly multi-syllable numbered reading, space-joined (1..3 syllables). */
function arbitraryReading(): fc.Arbitrary<string> {
  return fc
    .array(arbitraryPinyinSyllable(), { minLength: 1, maxLength: 3 })
    .map((syllables) => syllables.join(' '));
}

// --- Meanings / glosses -----------------------------------------------------

/** Plain, usable glosses. */
const PLAIN_GLOSSES = [
  'three',
  'mouth',
  'to walk',
  'water',
  'fire',
  'big',
  'small',
  'to eat',
  'person',
  'heart',
  'mountain',
  'to see',
] as const;

/**
 * Leading prefixes that prompt selection skips (after `(bound form) `
 * stripping). Kept in sync with SKIPPED_PREFIXES in scripts/lib/prompt.ts so
 * Property 20 is genuinely exercised.
 */
const SKIPPED_GLOSSES = [
  'surname Zhang',
  'variant of 三[san1]',
  'old variant of 三[san1]',
  'used in 瑪瑙|玛瑙',
  'see 中國|中国[Zhong1 guo2]',
  'abbr. for something',
  'CL:個|个[ge4]',
  'also pr. [shi2]',
  'Taiwan pr. [xie2]',
] as const;

/**
 * A realistic gloss string. Mixes plain glosses, plain glosses with a leading
 * `(bound form) ` prefix, and glosses beginning with a skipped prefix. Plain
 * usable glosses appear with higher weight so an entry usually has at least one
 * usable sense.
 */
export function arbitraryMeaning(): fc.Arbitrary<string> {
  return fc.oneof(
    { weight: 6, arbitrary: fc.constantFrom(...PLAIN_GLOSSES) },
    {
      weight: 2,
      arbitrary: fc
        .constantFrom(...PLAIN_GLOSSES)
        .map((g) => `(bound form) ${g}`),
    },
    { weight: 2, arbitrary: fc.constantFrom(...SKIPPED_GLOSSES) },
  );
}

// --- CC-CEDICT --------------------------------------------------------------

/** A single CC-CEDICT sense: one reading + its glosses (1..5). */
export function arbitraryCcCedictSense(): fc.Arbitrary<CcCedictSense> {
  return fc.record({
    reading: arbitraryReading(),
    meanings: fc.array(arbitraryMeaning(), { minLength: 1, maxLength: 5 }),
  });
}

/** De-dupe preserving first-occurrence order (matches the real parser). */
function distinctInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

/**
 * A full CC-CEDICT entry for one simplified character.
 *
 * The flat `pinyin` and `meanings` arrays are DERIVED from `entries` by
 * first-occurrence dedup, exactly as parseCcCedict builds them, so the
 * generated entry is internally consistent (Property 5) and usable by the
 * prompt + schema properties.
 */
export function arbitraryCcCedictEntry(): fc.Arbitrary<CcCedictEntry> {
  return fc
    .array(arbitraryCcCedictSense(), { minLength: 1, maxLength: 5 })
    .map((entries) => {
      const pinyin = distinctInOrder(
        entries.map((e) => e.reading).filter((r) => r.length > 0),
      );
      const meanings = distinctInOrder(entries.flatMap((e) => e.meanings));
      return { pinyin, meanings, entries };
    });
}

// --- Stroke data ------------------------------------------------------------

/** An SVG-path-looking string, e.g. `M 123 45 L 67 890`. */
function arbitrarySvgPath(): fc.Arbitrary<string> {
  const coord = fc.integer({ min: 0, max: 1024 });
  return fc
    .record({ mx: coord, my: coord, lx: coord, ly: coord })
    .map(({ mx, my, lx, ly }) => `M ${mx} ${my} L ${lx} ${ly}`);
}

/** A median: an array of [x, y] number pairs (2..8 points). */
function arbitraryMedian(): fc.Arbitrary<number[][]> {
  return fc.array(
    fc.tuple(
      fc.integer({ min: 0, max: 1024 }),
      fc.integer({ min: 0, max: 1024 }),
    ),
    { minLength: 2, maxLength: 8 },
  ).map((points) => points.map(([x, y]) => [x, y]));
}

/**
 * Verbatim-shaped stroke data: a non-empty `strokes` array, `medians` of the
 * SAME length as `strokes`, and `radStrokes` holding in-range stroke indices
 * (possibly empty).
 */
export function arbitraryStrokeData(): fc.Arbitrary<StrokeData> {
  return fc
    .integer({ min: 1, max: 8 })
    .chain((strokeCount) =>
      fc.record({
        strokes: fc.array(arbitrarySvgPath(), {
          minLength: strokeCount,
          maxLength: strokeCount,
        }),
        medians: fc.array(arbitraryMedian(), {
          minLength: strokeCount,
          maxLength: strokeCount,
        }),
        radStrokes: fc.uniqueArray(
          fc.integer({ min: 0, max: strokeCount - 1 }),
          { minLength: 0, maxLength: strokeCount },
        ),
      }),
    );
}

// --- Decomposition ----------------------------------------------------------

/** Ideographic Description Characters U+2FF0–U+2FFB. */
const IDC_CHARS = [
  '\u2FF0', // ⿰
  '\u2FF1', // ⿱
  '\u2FF2', // ⿲
  '\u2FF3', // ⿳
  '\u2FF4', // ⿴
  '\u2FF5', // ⿵
  '\u2FF6', // ⿶
  '\u2FF7', // ⿷
  '\u2FF8', // ⿸
  '\u2FF9', // ⿹
  '\u2FFA', // ⿺
  '\u2FFB', // ⿻
] as const;

const QUESTION_MARK = '\uFF1F'; // ？ U+FF1F

/** A valid Etymology variant, or null. */
function arbitraryEtymology(): fc.Arbitrary<Etymology | null> {
  return fc.oneof(
    fc.constant<Etymology | null>(null),
    fc.record({
      type: fc.constantFrom<'ideographic' | 'pictographic'>(
        'ideographic',
        'pictographic',
      ),
      hint: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    fc.record({
      type: fc.constant<'pictophonetic'>('pictophonetic'),
      hint: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
        nil: null,
      }),
      phonetic: fc.option(arbitraryComponentCharacter(), { nil: null }),
      semantic: fc.option(arbitraryComponentCharacter(), { nil: null }),
    }),
  );
}

/**
 * A realistic decomposition. Two shapes are generated:
 *   - atomic: `decomposition === '？'`, `atomic === true`, `components` is set
 *     to `[character]` (same rule as the pipeline).
 *   - compound: an IDS string `<IDC><2–3 component chars>`, occasionally with a
 *     `？` interior placeholder; `components` is computed with the real
 *     `extractLeafComponents` so Properties 8 and 16 are satisfied by the same
 *     rule the pipeline guarantees.
 *
 * Because `components` depends on the generated `character` in the atomic case,
 * the character is generated here with `arbitraryCharacter()`; callers that
 * need the record's `character` to match should build the decomposition from a
 * shared character (see `arbitraryCharacterRecord`).
 */
export function arbitraryDecomposition(): fc.Arbitrary<Decomposition> {
  return arbitraryCharacter().chain((character) =>
    arbitraryDecompositionFor(character),
  );
}

/**
 * Decomposition for a GIVEN character, keeping `components === [character]` in
 * the atomic case consistent with that character (used by the record builder).
 */
function arbitraryDecompositionFor(
  character: string,
): fc.Arbitrary<Decomposition> {
  const atomic: fc.Arbitrary<Decomposition> = fc
    .record({
      radical: arbitraryComponentCharacter(),
      etymology: arbitraryEtymology(),
      matches: arbitraryMatches(),
    })
    .map(({ radical, etymology, matches }) => ({
      decomposition: QUESTION_MARK,
      radical,
      etymology,
      matches,
      atomic: true,
      components: [character],
    }));

  const compound: fc.Arbitrary<Decomposition> = fc
    .record({
      idc: fc.constantFrom(...IDC_CHARS),
      parts: fc.array(
        fc.oneof(
          { weight: 5, arbitrary: arbitraryComponentCharacter() },
          { weight: 1, arbitrary: fc.constant(QUESTION_MARK) },
        ),
        { minLength: 2, maxLength: 3 },
      ),
      radical: arbitraryComponentCharacter(),
      etymology: arbitraryEtymology(),
      matches: arbitraryMatches(),
    })
    .map(({ idc, parts, radical, etymology, matches }) => {
      const ids = idc + parts.join('');
      return {
        decomposition: ids,
        radical,
        etymology,
        matches,
        atomic: false,
        components: extractLeafComponents(ids),
      };
    });

  return fc.oneof({ weight: 3, arbitrary: compound }, { weight: 1, arbitrary: atomic });
}

/** `matches`: null, or an array of (number[] | null) entries. */
function arbitraryMatches(): fc.Arbitrary<(number[] | null)[] | null> {
  return fc.option(
    fc.array(
      fc.option(fc.array(fc.integer({ min: 0, max: 10 }), { maxLength: 4 }), {
        nil: null,
      }),
      { maxLength: 4 },
    ),
    { nil: null },
  );
}

// --- Prompt -----------------------------------------------------------------

/**
 * A generic `Prompt` for schema-level properties: a non-empty gloss meaning and
 * a tone-mark pinyin string. The same-entry invariant (Property 22) is tested
 * in 14.x against selectPrompt directly, not against this arbitrary.
 */
export function arbitraryPrompt(): fc.Arbitrary<Prompt> {
  return fc.record({
    meaning: fc.constantFrom(...PLAIN_GLOSSES),
    pinyin: fc.constantFrom('sān', 'kǒu', 'zǒu', 'shuǐ', 'huǒ', 'dà', 'xīn'),
  });
}

// --- CharacterRecord --------------------------------------------------------

const RECORD_SOURCES: FieldSources = {
  pinyin: 'cc-cedict',
  meanings: 'cc-cedict',
  strokeCount: 'hanzi-writer-data',
  strokeData: 'hanzi-writer-data',
  decomposition: 'make-me-a-hanzi',
};

/**
 * A full, valid `CharacterRecord`.
 *
 * Invariants kept by construction (so valid records satisfy Properties 4, 10,
 * 13, 14, 15):
 *   - `pinyin` and `meanings` are non-empty arrays of non-empty strings.
 *   - `strokeCount === strokeData.strokes.length` (always ≥ 1).
 *   - `sources` is the fixed DatasetId mapping, exactly five keys.
 *   - the decomposition is built for this record's `character`, so an atomic
 *     record's `components` is `[character]` (Property 9).
 */
export function arbitraryCharacterRecord(): fc.Arbitrary<CharacterRecord> {
  return arbitraryCharacter().chain((character) =>
    fc
      .record({
        pinyin: fc.uniqueArray(
          arbitraryReading().filter((r) => r.length > 0),
          { minLength: 1, maxLength: 4 },
        ),
        meanings: fc.uniqueArray(fc.constantFrom(...PLAIN_GLOSSES), {
          minLength: 1,
          maxLength: 4,
        }),
        strokeData: arbitraryStrokeData(),
        decomposition: arbitraryDecompositionFor(character),
        prompt: arbitraryPrompt(),
      })
      .map(({ pinyin, meanings, strokeData, decomposition, prompt }) => ({
        character,
        pinyin,
        meanings,
        strokeCount: strokeData.strokes.length,
        strokeData,
        decomposition,
        prompt,
        sources: RECORD_SOURCES,
      })),
  );
}
