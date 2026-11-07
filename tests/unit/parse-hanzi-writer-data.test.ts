// Unit tests for parseHanziWriterData.
//
// Fixtures live in tests/fixtures/hanzi-writer-data/:
//   - 我.json      copied verbatim from data/raw/hanzi-writer-data/我.json
//                  (hanzi-writer-data@2.0.1, Arphic Public License)
//   - broken.json  synthetic malformed JSON for the no-throw test
// See tests/fixtures/README.md.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseHanziWriterData,
  type HanziWriterEntry,
} from '../../scripts/lib/parse-hanzi-writer-data';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'hanzi-writer-data');

/** The real fixture we assert against. */
const FIXTURE_CHAR = '我';

/** Read the fixture file directly to derive expectations from the real data. */
function readFixtureRaw(): {
  strokes: string[];
  medians: number[][][];
  radStrokes: number[];
} {
  const raw = readFileSync(join(fixtureDir, `${FIXTURE_CHAR}.json`), 'utf8');
  return JSON.parse(raw) as {
    strokes: string[];
    medians: number[][][];
    radStrokes: number[];
  };
}

describe('parseHanziWriterData', () => {
  it('reads a fixture file and populates the Map with strokes, medians, radStrokes', () => {
    const result = parseHanziWriterData(fixtureDir, [FIXTURE_CHAR]);

    expect(result.has(FIXTURE_CHAR)).toBe(true);
    const entry = result.get(FIXTURE_CHAR) as HanziWriterEntry;
    const expected = readFixtureRaw();

    // strokes.length matches the real file.
    expect(entry.strokes.length).toBe(expected.strokes.length);
    // Values are kept verbatim.
    expect(entry.strokes).toEqual(expected.strokes);
    expect(entry.medians).toEqual(expected.medians);
    expect(entry.radStrokes).toEqual(expected.radStrokes);
    // Sanity: this fixture has a non-empty radStrokes array.
    expect(entry.radStrokes.length).toBeGreaterThan(0);
  });

  it('omits a character with no file on disk (no throw)', () => {
    // 不 has no fixture file in the fixture dir.
    const absentChar = '不';
    const run = (): Map<string, HanziWriterEntry> =>
      parseHanziWriterData(fixtureDir, [absentChar]);

    expect(run).not.toThrow();
    const result = run();
    expect(result.has(absentChar)).toBe(false);
    expect(result.size).toBe(0);
  });

  it('omits a character whose JSON is malformed (no throw)', () => {
    // The fixture file is named `broken.json`, so the character "broken"
    // maps to it. Its contents are deliberately invalid JSON.
    const brokenChar = 'broken';
    const run = (): Map<string, HanziWriterEntry> =>
      parseHanziWriterData(fixtureDir, [brokenChar]);

    expect(run).not.toThrow();
    const result = run();
    expect(result.has(brokenChar)).toBe(false);
    expect(result.size).toBe(0);
  });

  it('includes only characters that resolve, skipping missing/malformed ones', () => {
    const result = parseHanziWriterData(fixtureDir, [
      FIXTURE_CHAR,
      '不',
      'broken',
    ]);
    expect(result.size).toBe(1);
    expect(result.has(FIXTURE_CHAR)).toBe(true);
  });
});
