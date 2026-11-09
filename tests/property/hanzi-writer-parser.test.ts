// Feature: character-dataset, Property 6: Stroke data extraction round-trip
//
// **Validates: Requirements 4.5**
//
// Property 6 (design.md): For any hanzi-writer-data JSON object with a
// non-empty `strokes` array, the extractor sets `strokeCount = strokes.length`
// and `strokeData` deep-equals the input (verbatim pass-through).
//
// `parseHanziWriterData(dataDir, characters)` reads from disk, so each run:
//   1. creates a fresh temp dir,
//   2. generates an arbitraryStrokeData() object + a character,
//   3. writes it as `<char>.json`,
//   4. parses it back and asserts the returned entry deep-equals the input
//      (strokes, medians, radStrokes verbatim),
//   5. feeds the parsed entry through mergeCharacter and asserts
//      `record.strokeCount === strokes.length` and `record.strokeData`
//      deep-equals the input.
//
// A second property covers the `radStrokes`-absent case: a JSON object written
// WITHOUT `radStrokes` must default to `[]`.

import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseHanziWriterData } from '../../scripts/lib/parse-hanzi-writer-data';
import { mergeCharacter } from '../../scripts/lib/merge';
import type { MakeMeAHanziEntry } from '../../scripts/lib/parse-make-me-a-hanzi';
import type { CcCedictEntry } from '../../scripts/lib/parse-cc-cedict';
import type { Prompt } from '../../app/src/data/types';
import {
  arbitraryCharacter,
  arbitraryStrokeData,
} from '../helpers/arbitraries';

// Track temp dirs created during the run so they are always cleaned up, even if
// an assertion throws mid-property.
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ghost-hwd-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Dummy-but-valid Make Me a Hanzi + CC-CEDICT entries so mergeCharacter
// succeeds and we can assert strokeCount via the merged record. These are not
// under test here; they only need to satisfy the required-field checks.
function dummyMakeMeAHanzi(character: string): MakeMeAHanziEntry {
  return {
    decomposition: '\uFF1F', // ？ atomic
    radical: character,
    etymology: null,
    matches: null,
    atomic: true,
    components: [character],
  };
}

function dummyCcCedict(): CcCedictEntry {
  return {
    pinyin: ['yi1'],
    meanings: ['one'],
    entries: [{ reading: 'yi1', meanings: ['one'] }],
  };
}

const DUMMY_PROMPT: Prompt = { meaning: 'one', pinyin: 'yī' };

describe('Property 6: stroke data extraction round-trip', () => {
  it('parses stroke data verbatim and sets strokeCount = strokes.length (via merge)', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryStrokeData(),
        (character, strokeData) => {
          const dir = makeTempDir();
          writeFileSync(
            join(dir, `${character}.json`),
            JSON.stringify(strokeData),
            'utf8',
          );

          const parsed = parseHanziWriterData(dir, [character]);
          const entry = parsed.get(character);

          // The character's file exists and is valid, so it must be present.
          expect(entry).toBeDefined();
          if (entry === undefined) {
            return;
          }

          // Verbatim pass-through: strokes, medians, radStrokes deep-equal input.
          expect(entry.strokes).toEqual(strokeData.strokes);
          expect(entry.medians).toEqual(strokeData.medians);
          expect(entry.radStrokes).toEqual(strokeData.radStrokes);
          expect(entry).toEqual(strokeData);

          // Flow through the merge: strokeCount and strokeData must round-trip.
          const merged = mergeCharacter(
            character,
            entry,
            dummyMakeMeAHanzi(character),
            dummyCcCedict(),
            DUMMY_PROMPT,
          );

          expect(merged.ok).toBe(true);
          if (!merged.ok) {
            return;
          }

          expect(merged.record.strokeCount).toBe(strokeData.strokes.length);
          expect(merged.record.strokeData).toEqual(strokeData);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('defaults radStrokes to [] when absent from the source JSON', () => {
    fc.assert(
      fc.property(
        arbitraryCharacter(),
        arbitraryStrokeData(),
        (character, strokeData) => {
          const dir = makeTempDir();

          // Write the object WITHOUT a radStrokes field.
          const withoutRadStrokes = {
            strokes: strokeData.strokes,
            medians: strokeData.medians,
          };
          writeFileSync(
            join(dir, `${character}.json`),
            JSON.stringify(withoutRadStrokes),
            'utf8',
          );

          const parsed = parseHanziWriterData(dir, [character]);
          const entry = parsed.get(character);

          expect(entry).toBeDefined();
          if (entry === undefined) {
            return;
          }

          expect(entry.strokes).toEqual(strokeData.strokes);
          expect(entry.medians).toEqual(strokeData.medians);
          // radStrokes absent in source → defaults to [].
          expect(entry.radStrokes).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
