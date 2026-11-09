// Feature: character-dataset, Property 11: Output record count equals character-list entry count
// Feature: character-dataset, Property 12: Every list character is a key in the output, exactly once
//
// Property 11: For a character-list.txt with N valid (non-empty, non-comment)
// lines, a SUCCESSFUL build produces a characters.json whose top-level object
// has EXACTLY N keys.
//
// Property 12: Every character on a non-comment line appears as a key in the
// output exactly once, and no key in the output is absent from the list — i.e.
// the output keys form a bijection with the generated character set.
//
// Validates: Requirements 4.12, 5.1
//
// buildDataset reads from FILE PATHS, so — like pipeline-determinism.test.ts —
// we materialise each generated input set into a fresh temp directory, point a
// BuildOptions at those files, and run the build. The generated inputs are TINY
// but correctly SHAPED (every character gets hanzi-writer stroke data, a Make
// Me a Hanzi line, and a CC-CEDICT line with a usable gloss + lowercase
// reading) so the build SUCCEEDS and the success-path count/bijection
// invariants are the thing under test.
//
// The character-list.txt we write interleaves comment (`#`) and blank lines
// among the real characters to prove they DON'T affect the count or key set.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';

import type { BuildOptions, StrokeData } from '../../app/src/data/types';
import { buildDataset } from '../../scripts/build-data';
import { arbitraryCharacter, arbitraryStrokeData } from '../helpers/arbitraries';

// --- Generated input model --------------------------------------------------

/**
 * A complete, build-succeeding input bundle for ONE character: stroke data, an
 * atomic decomposition sentinel (trivially valid), a CC-CEDICT reading, and a
 * plain usable gloss so prompt selection succeeds.
 */
interface GeneratedCharInput {
  character: string;
  strokeData: StrokeData;
  reading: string; // numbered pinyin, lowercase onset → not a proper-noun skip
  meaning: string; // a plain, usable gloss (no skipped prefix)
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

/** One character's full, build-succeeding input bundle. */
function arbitraryGeneratedCharInput(
  character: string,
): fc.Arbitrary<GeneratedCharInput> {
  return fc.record({
    character: fc.constant(character),
    strokeData: arbitraryStrokeData(),
    reading: fc.constantFrom(...READINGS),
    meaning: fc.constantFrom(...USABLE_GLOSSES),
  });
}

/**
 * A set (1..10) of DISTINCT characters, each with a full input bundle. Distinct
 * characters keep the list valid (no duplicates) and each source keyed
 * uniquely.
 */
function arbitraryInputBundle(): fc.Arbitrary<GeneratedCharInput[]> {
  return fc
    .uniqueArray(arbitraryCharacter(), { minLength: 1, maxLength: 10 })
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
 *
 * The character-list.txt interleaves comment and blank lines among the real
 * characters so the test proves they are ignored by the count/bijection.
 */
function materialise(inputs: GeneratedCharInput[]): BuildOptions {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-'));
  tempDirs.push(dir);

  const hanziWriterDir = join(dir, 'hanzi-writer-data');
  mkdirSync(hanziWriterDir, { recursive: true });

  // character-list.txt: comment header + one character per line, with extra
  // comment and blank lines interleaved to prove they don't affect the count.
  const characterListPath = join(dir, 'character-list.txt');
  const listLines: string[] = ['# generated test list'];
  for (const input of inputs) {
    listLines.push(input.character);
    // Sprinkle a blank line and a mid-list comment between entries.
    listLines.push('');
    listLines.push('# mid-list comment');
  }
  writeFileSync(characterListPath, `${listLines.join('\n')}\n`, 'utf8');

  // hanzi-writer-data/<char>.json: verbatim { strokes, medians, radStrokes }.
  for (const input of inputs) {
    writeFileSync(
      join(hanziWriterDir, `${input.character}.json`),
      JSON.stringify(input.strokeData),
      'utf8',
    );
  }

  // make-me-a-hanzi dictionary.txt: newline-delimited JSON, one per line. The
  // atomic sentinel `？` keeps each decomposition trivially valid.
  const makeMeAHanziPath = join(dir, 'dictionary.txt');
  const mmhLines = inputs.map((input) =>
    JSON.stringify({
      character: input.character,
      decomposition: '？',
      radical: input.character,
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

describe('Property 11 & 12: output count and bijection with the character list', () => {
  it('a successful build produces exactly N keys that bijection-match the list characters', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInputBundle(), async (inputs) => {
        const opts = materialise(inputs);

        const result = await buildDataset(opts);

        // The generated bundle is designed to always build successfully.
        expect(result.ok).toBe(true);
        if (!result.ok) {
          return;
        }

        const parsed: unknown = JSON.parse(result.output);
        expect(typeof parsed).toBe('object');
        expect(parsed).not.toBeNull();

        const outputKeys = Object.keys(parsed as Record<string, unknown>);
        const expectedChars = inputs.map((i) => i.character);

        // Property 11: exactly N top-level keys (N = real, non-comment lines).
        expect(outputKeys.length).toBe(expectedChars.length);

        // Property 12: bijection — every list character is a key exactly once,
        // and no output key is absent from the list.
        expect(new Set(outputKeys)).toStrictEqual(new Set(expectedChars));
        // Each expected char appears exactly once as a key.
        for (const char of expectedChars) {
          const occurrences = outputKeys.filter((k) => k === char).length;
          expect(occurrences).toBe(1);
        }
      }),
      { numRuns: 100 },
    );
  });
});
