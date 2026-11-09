// Feature: character-dataset, Property 2: Pipeline determinism
//
// Property 2: For any set of valid pipeline inputs (character list + raw
// dataset content), running `buildDataset` twice with IDENTICAL inputs produces
// byte-for-byte identical output — the serialised `characters.json` string AND
// the `promptReviewCsv` artefact.
//
// Validates: Requirements 3.4, 5.7
//
// buildDataset reads from FILE PATHS, so to property-test it with generated
// inputs we materialise each generated input set into a fresh temp directory,
// point a BuildOptions at those files, run the build twice against the same
// paths, and assert the two successful results are byte-identical.
//
// The generated inputs are TINY but correctly SHAPED: for every generated
// character we emit all three sources (hanzi-writer-data JSON file, a Make Me a
// Hanzi dictionary line, a CC-CEDICT line) plus a guaranteed-usable gloss, so
// the build SUCCEEDS and the success path (the one we care about) is exercised.
// The real large datasets are never touched here — the property is about the
// determinism of the transform, not about real content.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';

import type { BuildOptions } from '../../app/src/data/types';
import { buildDataset } from '../../scripts/build-data';
import {
  arbitraryCharacter,
  arbitraryStrokeData,
} from '../helpers/arbitraries';
import type { StrokeData } from '../../app/src/data/types';

// --- Generated input model --------------------------------------------------

/**
 * A complete, build-succeeding input bundle for ONE character: stroke data, a
 * decomposition (atomic sentinel to keep it trivially valid), a CC-CEDICT
 * reading, and a non-empty, non-skipped gloss so prompt selection succeeds.
 */
interface GeneratedCharInput {
  character: string;
  strokeData: StrokeData;
  decomposition: string; // IDS string for the Make Me a Hanzi line
  radical: string;
  reading: string; // numbered pinyin, e.g. "wo3"
  meaning: string; // a plain, usable gloss
}

/** Usable glosses — none begins with a skipped prefix, so selection succeeds. */
const USABLE_GLOSSES = [
  'three',
  'mouth',
  'water',
  'fire',
  'to walk',
  'heart',
] as const;

/** Plain numbered readings (lowercase onset → not a proper-noun skip). */
const READINGS = ['wo3', 'kou3', 'shui3', 'huo3', 'zou3', 'xin1'] as const;

/** A radical component drawn from the CJK block (valid single codepoint). */
function arbitraryRadical(): fc.Arbitrary<string> {
  return arbitraryCharacter();
}

/**
 * One character's full input bundle. The decomposition is the atomic sentinel
 * `？`, which the Make Me a Hanzi parser classifies as atomic (components =
 * [character]) — a valid, build-succeeding shape that needs no interior
 * components.
 */
function arbitraryGeneratedCharInput(
  character: string,
): fc.Arbitrary<GeneratedCharInput> {
  return fc.record({
    character: fc.constant(character),
    strokeData: arbitraryStrokeData(),
    decomposition: fc.constant('？'),
    radical: arbitraryRadical(),
    reading: fc.constantFrom(...READINGS),
    meaning: fc.constantFrom(...USABLE_GLOSSES),
  });
}

/**
 * A small set (1..8) of DISTINCT characters, each with a full input bundle.
 * Distinct characters keep the character list valid (no duplicates) and keep
 * each source file keyed uniquely.
 */
function arbitraryInputBundle(): fc.Arbitrary<GeneratedCharInput[]> {
  return fc
    .uniqueArray(arbitraryCharacter(), { minLength: 1, maxLength: 8 })
    .chain((characters) =>
      fc.tuple(
        ...characters.map((character) =>
          arbitraryGeneratedCharInput(character),
        ),
      ),
    )
    .map((tuple) => [...tuple]);
}

// --- Materialisation --------------------------------------------------------

/** All temp dirs created during the run, cleaned up in afterEach. */
const tempDirs: string[] = [];

/**
 * Write a generated input bundle into a fresh temp directory and return a
 * BuildOptions pointing at the materialised files.
 */
function materialise(inputs: GeneratedCharInput[]): BuildOptions {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-'));
  tempDirs.push(dir);

  const hanziWriterDir = join(dir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDir, { recursive: true });

  // character-list.txt: a comment header + one character per line.
  const characterListPath = join(dir, 'character-list.txt');
  const listBody = inputs.map((i) => i.character).join('\n');
  writeFileSync(
    characterListPath,
    `# generated test list\n${listBody}\n`,
    'utf8',
  );

  // hanzi-writer-data/<char>.json: verbatim { strokes, medians, radStrokes }.
  for (const input of inputs) {
    writeFileSync(
      join(hanziWriterDir, `${input.character}.json`),
      JSON.stringify(input.strokeData),
      'utf8',
    );
  }

  // make-me-a-hanzi dictionary.txt: newline-delimited JSON, one object per line.
  const makeMeAHanziPath = join(dir, 'dictionary.txt');
  const mmhLines = inputs.map((input) =>
    JSON.stringify({
      character: input.character,
      decomposition: input.decomposition,
      radical: input.radical,
    }),
  );
  writeFileSync(makeMeAHanziPath, `${mmhLines.join('\n')}\n`, 'utf8');

  // cc-cedict cedict_ts.u8: `Trad Simp [reading] /meaning/`.
  const ccCedictPath = join(dir, 'cedict_ts.u8');
  const cedictLines = inputs.map(
    (input) =>
      `${input.character} ${input.character} [${input.reading}] /${input.meaning}/`,
  );
  writeFileSync(
    ccCedictPath,
    `# CC-CEDICT generated test header\n${cedictLines.join('\n')}\n`,
    'utf8',
  );

  // prompt-overrides.csv: header only (no overrides).
  const promptOverridesPath = join(dir, 'prompt-overrides.csv');
  writeFileSync(
    promptOverridesPath,
    'character,entryIndex,meaningIndex,reviewedBy\n',
    'utf8',
  );

  return {
    characterListPath,
    hanziWriterDataDir: hanziWriterDir,
    makeMeAHanziPath,
    ccCedictPath,
    promptOverridesPath,
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

describe('Property 2: pipeline determinism', () => {
  it('buildDataset produces byte-for-byte identical output for identical inputs', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInputBundle(), async (inputs) => {
        const opts = materialise(inputs);

        const first = await buildDataset(opts);
        const second = await buildDataset(opts);

        // The generated bundle is designed to always build successfully; if it
        // ever fails, determinism must STILL hold (both runs fail identically),
        // so we assert equality of the whole result either way.
        expect(first.ok).toBe(second.ok);

        if (first.ok && second.ok) {
          // Primary assertion: byte-for-byte identical serialised JSON and the
          // prompt-review CSV artefact.
          expect(second.output).toBe(first.output);
          expect(second.promptReviewCsv).toBe(first.promptReviewCsv);
        } else {
          // Failure outputs must also be deterministic.
          expect(second).toStrictEqual(first);
        }
      }),
      { numRuns: 100 },
    );
  });
});
