// Feature: character-dataset, Property 13: Non-null pinyin contains at least one non-empty string
// Feature: character-dataset, Property 14: Non-null meanings contains at least one non-empty string
// Feature: character-dataset, Property 15: strokeCount is a positive integer
//
// Property 13: For any CharacterRecord in a successfully built characters.json,
// the `pinyin` array has length >= 1 and every element is a non-empty string.
//
// Property 14: For any CharacterRecord in a successfully built characters.json,
// the `meanings` array has length >= 1 and every element is a non-empty string.
//
// Property 15: For any CharacterRecord in a successfully built characters.json,
// `strokeCount` is an integer greater than zero. The pipeline derives
// strokeCount from the stroke data, so we additionally assert it equals
// `strokeData.strokes.length` (Property 6's consequence carried into the
// record).
//
// Each property is asserted twice: against the record object directly AND
// against the pipeline's SERIALISED form (record placed into a Map, run through
// `serialiseDataset`, then JSON-parsed back). The second assertion catches any
// serialiser that drops or alters these fields.
//
// Validates: Requirements 5.2, 5.3, 5.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { CharacterRecord } from '../../app/src/data/types';
import { serialiseDataset } from '../../scripts/lib/serialise';
import { arbitraryCharacterRecord } from '../helpers/arbitraries';

/** Shape of a single record after JSON round-trip through the serialiser. */
interface SerialisedRecord {
  pinyin: unknown;
  meanings: unknown;
  strokeCount: unknown;
  strokeData: { strokes: unknown };
}

/**
 * Serialises a single record through the real pipeline serialiser and parses it
 * back, returning the re-parsed record for that character.
 */
function roundTrip(record: CharacterRecord): SerialisedRecord {
  const map = new Map<string, CharacterRecord>([[record.character, record]]);
  const json = serialiseDataset(map);
  const parsed = JSON.parse(json) as Record<string, SerialisedRecord>;
  const serialised = parsed[record.character];
  expect(serialised).toBeDefined();
  return serialised;
}

/** Asserts a value is an array of >= 1 non-empty strings. */
function assertNonEmptyStringArray(value: unknown): void {
  expect(Array.isArray(value)).toBe(true);
  const arr = value as unknown[];
  expect(arr.length).toBeGreaterThanOrEqual(1);
  for (const element of arr) {
    expect(typeof element).toBe('string');
    expect((element as string).length).toBeGreaterThanOrEqual(1);
  }
}

describe('Property 13: Non-null pinyin contains at least one non-empty string', () => {
  it('pinyin has length >= 1 and every element is a non-empty string — directly and after serialisation', () => {
    fc.assert(
      fc.property(arbitraryCharacterRecord(), (record: CharacterRecord) => {
        // Direct assertion on the record.
        assertNonEmptyStringArray(record.pinyin);

        // Pipeline assertion: the serialised form preserves the invariant.
        const serialised = roundTrip(record);
        assertNonEmptyStringArray(serialised.pinyin);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 14: Non-null meanings contains at least one non-empty string', () => {
  it('meanings has length >= 1 and every element is a non-empty string — directly and after serialisation', () => {
    fc.assert(
      fc.property(arbitraryCharacterRecord(), (record: CharacterRecord) => {
        // Direct assertion on the record.
        assertNonEmptyStringArray(record.meanings);

        // Pipeline assertion: the serialised form preserves the invariant.
        const serialised = roundTrip(record);
        assertNonEmptyStringArray(serialised.meanings);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 15: strokeCount is a positive integer', () => {
  it('strokeCount is an integer > 0 equal to strokeData.strokes.length — directly and after serialisation', () => {
    fc.assert(
      fc.property(arbitraryCharacterRecord(), (record: CharacterRecord) => {
        // Direct assertion on the record.
        expect(Number.isInteger(record.strokeCount)).toBe(true);
        expect(record.strokeCount).toBeGreaterThan(0);
        // The pipeline derives strokeCount from the stroke data.
        expect(record.strokeCount).toBe(record.strokeData.strokes.length);

        // Pipeline assertion: the serialised form preserves the invariant.
        const serialised = roundTrip(record);
        expect(Number.isInteger(serialised.strokeCount)).toBe(true);
        expect(serialised.strokeCount as number).toBeGreaterThan(0);
        expect(serialised.strokeCount).toBe(
          (serialised.strokeData.strokes as unknown[]).length,
        );
      }),
      { numRuns: 100 },
    );
  });
});
