// Feature: character-dataset, Property 22: prompt meaning and reading come from the same CC-CEDICT entry
//
// Property 22: For any CharacterRecord in a successfully built characters.json,
// there exists a SINGLE CC-CEDICT entry for that character such that
// `prompt.meaning` is one of that entry's glosses (after an optional single
// leading `(bound form) ` strip) AND
// `prompt.pinyin === numberedToToneMarks(entry.reading)`.
//
// In other words: the clue's meaning and its reading never come from different
// CC-CEDICT senses. An earlier flaw paired a meaning with a reading from a
// different entry (e.g. 了 "to finish" wrongly read as `le`); this property
// locks that door.
//
// Validates: Requirements 6.12
//
// Two angles are exercised, both asserting the SAME invariant:
//
//   (A) Unit-level over selectPrompt — fast, high numRuns (>= 200). Generate a
//       realistic CcCedictEntry, call selectPrompt(char, entry, undefined), and
//       when it succeeds verify that the chosen meaning AND the chosen reading
//       both resolve against the SINGLE entry at `choice.entryIndex`. This is
//       the direct proof of same-entry provenance.
//
//   (B) Build-level end-to-end — fewer runs (>= 100), via the temp-dir
//       materialisation pattern from pipeline-determinism.test.ts. Tiny
//       datasets are built where characters may have MULTIPLE entries with
//       DIFFERENT readings (so a cross-entry bug would be observable). The
//       generated output JSON is parsed, the character's CC-CEDICT entries are
//       reconstructed by re-parsing the generated cedict text with
//       parseCcCedict, and we assert there is EXACTLY ONE entry whose tone-mark
//       reading equals `prompt.pinyin` and whose stripped glosses include
//       `prompt.meaning`.
//
//       To make "exactly one" a sound assertion (not defeated by legitimate
//       ambiguity), each generated character's entries are constrained to have
//       DISTINCT tone-mark readings and NON-OVERLAPPING glosses. Any match is
//       then necessarily unique when the pipeline keeps meaning+reading on one
//       entry, and absent when it splits them — exactly what we want to detect.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';

import type { BuildOptions, StrokeData } from '../../app/src/data/types';
import { buildDataset } from '../../scripts/build-data';
import {
  parseCcCedict,
  type CcCedictEntry,
} from '../../scripts/lib/parse-cc-cedict';
import { numberedToToneMarks, selectPrompt } from '../../scripts/lib/prompt';
import {
  arbitraryCcCedictEntry,
  arbitraryCharacter,
  arbitraryStrokeData,
} from '../helpers/arbitraries';

const BOUND_FORM_PREFIX = '(bound form) ';

/** Strip a single leading `(bound form) ` prefix, then trim (as prompt.ts does). */
function stripBoundForm(gloss: string): string {
  if (gloss.startsWith(BOUND_FORM_PREFIX)) {
    return gloss.slice(BOUND_FORM_PREFIX.length).trim();
  }
  return gloss.trim();
}

// --- Angle (A): unit-level, direct over selectPrompt ------------------------

describe('Property 22 (A): selectPrompt draws meaning and reading from one entry', () => {
  it('the chosen meaning and reading both resolve against the single entry at choice.entryIndex', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryCcCedictEntry(),
        (char: string, entry: CcCedictEntry) => {
          const result = selectPrompt(char, entry, undefined);
          if (!result.ok) {
            return; // no-usable-sense justification is covered in 14.5
          }
          const { choice } = result;

          // There is a single entry at choice.entryIndex...
          const chosen = entry.entries[choice.entryIndex];
          expect(chosen).toBeDefined();

          // ...the reading comes from THAT entry...
          expect(choice.pinyin).toBe(numberedToToneMarks(chosen.reading));

          // ...and the meaning is one of THAT SAME entry's glosses (after an
          // optional single `(bound form) ` strip), and is non-empty.
          expect(choice.meaning.length).toBeGreaterThan(0);
          const candidates = chosen.meanings.map(stripBoundForm);
          expect(candidates).toContain(choice.meaning);
        },
      ),
      { numRuns: 300 },
    );
  });
});

// --- Angle (B): build-level, end-to-end -------------------------------------

/**
 * One CC-CEDICT sense in a generated character: a numbered reading and a single
 * gloss. Generated so that, within a character, readings and glosses are unique
 * (enforced in the bundle builder) — this keeps the per-record "exactly one
 * matching entry" assertion sound.
 */
interface GeneratedSense {
  reading: string; // numbered pinyin, e.g. "liao3"
  gloss: string; // a plain, usable gloss (no skipped prefix)
}

interface GeneratedCharInput {
  character: string;
  strokeData: StrokeData;
  senses: GeneratedSense[];
}

/**
 * Candidate numbered readings with DISTINCT tone-mark forms. Lowercase onsets
 * so none is treated as a proper-noun reading (which the default rule skips).
 */
const READINGS = [
  'liao3',
  'le5',
  'zhong1',
  'zhong4',
  'hao3',
  'hao4',
  'chong2',
  'xing2',
  'hang2',
  'shang4',
] as const;

/**
 * Plain, usable glosses — none begins with a skipped prefix, so the default
 * rule always finds a usable sense. Each is distinct so the per-character
 * non-overlap constraint is easy to satisfy.
 */
const GLOSSES = [
  'to finish',
  'particle',
  'middle',
  'to hit',
  'good',
  'to like',
  'again',
  'to walk',
  'row',
  'above',
  'water',
  'fire',
  'mouth',
  'heart',
] as const;

/** A single sense: a reading paired with a gloss. */
function arbitrarySense(): fc.Arbitrary<GeneratedSense> {
  return fc.record({
    reading: fc.constantFrom(...READINGS),
    gloss: fc.constantFrom(...GLOSSES),
  });
}

/**
 * One character's input bundle: stroke data plus 1..4 senses whose tone-mark
 * readings AND glosses are each unique within the character. Uniqueness makes
 * the later "exactly one matching entry" check sound: a correct pipeline yields
 * exactly one match, a cross-entry bug yields zero.
 */
function arbitraryGeneratedCharInput(
  character: string,
): fc.Arbitrary<GeneratedCharInput> {
  return fc
    .record({
      strokeData: arbitraryStrokeData(),
      senses: fc.array(arbitrarySense(), { minLength: 1, maxLength: 4 }),
    })
    .map(({ strokeData, senses }) => {
      // Keep only senses with a tone-mark reading AND a gloss not yet seen in
      // this character, preserving source order.
      const seenToneReadings = new Set<string>();
      const seenGlosses = new Set<string>();
      const unique: GeneratedSense[] = [];
      for (const sense of senses) {
        const tone = numberedToToneMarks(sense.reading);
        if (seenToneReadings.has(tone) || seenGlosses.has(sense.gloss)) {
          continue;
        }
        seenToneReadings.add(tone);
        seenGlosses.add(sense.gloss);
        unique.push(sense);
      }
      // At least one sense always survives (the first is always unique).
      return { character, strokeData, senses: unique };
    });
}

/** 1..6 DISTINCT characters, each with its own unique-sense bundle. */
function arbitraryInputBundle(): fc.Arbitrary<GeneratedCharInput[]> {
  return fc
    .uniqueArray(arbitraryCharacter(), { minLength: 1, maxLength: 6 })
    .chain((characters) =>
      fc.tuple(
        ...characters.map((character) =>
          arbitraryGeneratedCharInput(character),
        ),
      ),
    )
    .map((tuple) => [...tuple]);
}

/** All temp dirs created during the run, cleaned up in afterEach. */
const tempDirs: string[] = [];

/**
 * Materialise a bundle into a fresh temp dir and return BuildOptions plus the
 * exact CC-CEDICT text written (so the test reconstructs entries from the SAME
 * source the build consumed).
 */
function materialise(inputs: GeneratedCharInput[]): {
  opts: BuildOptions;
  cedictText: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-same-entry-'));
  tempDirs.push(dir);

  const hanziWriterDir = join(dir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDir, { recursive: true });

  // character-list.txt: comment header + one character per line.
  const characterListPath = join(dir, 'character-list.txt');
  const listBody = inputs.map((i) => i.character).join('\n');
  writeFileSync(
    characterListPath,
    `# generated test list\n${listBody}\n`,
    'utf8',
  );

  // hanzi-writer-data/<char>.json: verbatim stroke data.
  for (const input of inputs) {
    writeFileSync(
      join(hanziWriterDir, `${input.character}.json`),
      JSON.stringify(input.strokeData),
      'utf8',
    );
  }

  // make-me-a-hanzi dictionary.txt: atomic sentinel keeps decomposition valid.
  const makeMeAHanziPath = join(dir, 'dictionary.txt');
  const mmhLines = inputs.map((input) =>
    JSON.stringify({
      character: input.character,
      decomposition: '？',
      radical: input.character,
    }),
  );
  writeFileSync(makeMeAHanziPath, `${mmhLines.join('\n')}\n`, 'utf8');

  // cc-cedict cedict_ts.u8: ONE line per sense, so a character with multiple
  // senses has multiple entries with DIFFERENT readings.
  const cedictLines: string[] = [];
  for (const input of inputs) {
    for (const sense of input.senses) {
      cedictLines.push(
        `${input.character} ${input.character} [${sense.reading}] /${sense.gloss}/`,
      );
    }
  }
  const cedictText = `# CC-CEDICT generated test header\n${cedictLines.join('\n')}\n`;
  const ccCedictPath = join(dir, 'cedict_ts.u8');
  writeFileSync(ccCedictPath, cedictText, 'utf8');

  // prompt-overrides.csv: header only (default rule exercised).
  const promptOverridesPath = join(dir, 'prompt-overrides.csv');
  writeFileSync(
    promptOverridesPath,
    'character,entryIndex,meaningIndex,reviewedBy\n',
    'utf8',
  );

  return {
    opts: {
      characterListPath,
      hanziWriterDataDir: hanziWriterDir,
      makeMeAHanziPath,
      ccCedictPath,
      promptOverridesPath,
    },
    cedictText,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

/** Minimal shape of a serialised record we read back from the output JSON. */
interface OutputRecord {
  character: string;
  prompt: { meaning: string; pinyin: string };
}

/** Type guard for the parsed output JSON (a map of character → record). */
function isOutputMap(value: unknown): value is Record<string, OutputRecord> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  for (const record of Object.values(value)) {
    if (typeof record !== 'object' || record === null) {
      return false;
    }
    const prompt = (record as { prompt?: unknown }).prompt;
    if (typeof prompt !== 'object' || prompt === null) {
      return false;
    }
    const { meaning, pinyin } = prompt as {
      meaning?: unknown;
      pinyin?: unknown;
    };
    if (typeof meaning !== 'string' || typeof pinyin !== 'string') {
      return false;
    }
  }
  return true;
}

describe('Property 22 (B): built prompt matches exactly one CC-CEDICT entry', () => {
  it('each record prompt (meaning + pinyin) resolves against exactly one source entry', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInputBundle(), async (inputs) => {
        const { opts, cedictText } = materialise(inputs);

        const result = await buildDataset(opts);
        // The generated bundle is designed to always build successfully.
        expect(result.ok).toBe(true);
        if (!result.ok) {
          return;
        }

        const parsed: unknown = JSON.parse(result.output);
        expect(isOutputMap(parsed)).toBe(true);
        if (!isOutputMap(parsed)) {
          return;
        }

        // Reconstruct the character → entries map from the SAME cedict text the
        // build consumed.
        const cedict = parseCcCedict(cedictText);

        for (const record of Object.values(parsed)) {
          const entry = cedict.get(record.character);
          expect(entry).toBeDefined();
          if (entry === undefined) {
            continue;
          }

          // Count entries whose tone-mark reading equals prompt.pinyin AND
          // whose stripped glosses include prompt.meaning. Because each
          // character's readings and glosses are unique, a correct pipeline
          // yields exactly one such entry; a cross-entry bug yields zero.
          const matching = entry.entries.filter((sense) => {
            const readingMatches =
              numberedToToneMarks(sense.reading) === record.prompt.pinyin;
            const meaningMatches = sense.meanings
              .map(stripBoundForm)
              .includes(record.prompt.meaning);
            return readingMatches && meaningMatches;
          });

          expect(matching).toHaveLength(1);
        }
      }),
      { numRuns: 100 },
    );
  });
});
