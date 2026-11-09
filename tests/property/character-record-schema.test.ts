// Feature: character-dataset, Property 4: CharacterRecord schema completeness
// Feature: character-dataset, Property 10: sources object has exactly the required keys with valid values
//
// Property 4: For any CharacterRecord produced by the pipeline, the record
// contains EXACTLY the expected keys (character, pinyin, meanings, strokeCount,
// strokeData, decomposition, prompt, sources) and NO unrecognised keys. We
// assert this against the record object itself AND against the pipeline's
// serialised form: each record is placed into a Map, serialised with
// `serialiseDataset`, re-parsed, and the per-character key list is compared to
// the exact ordered design key list.
//
// Property 10: For any CharacterRecord, `sources` has EXACTLY the five keys
// (pinyin, meanings, strokeCount, strokeData, decomposition), each value is a
// valid DatasetId, and each field maps to the dataset the design fixes it to
// (pinyin/meanings → cc-cedict, strokeCount/strokeData → hanzi-writer-data,
// decomposition → make-me-a-hanzi).
//
// Validates: Requirements 4.2, 4.10

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type {
  CharacterRecord,
  DatasetId,
  FieldSources,
} from '../../app/src/data/types';
import { serialiseDataset } from '../../scripts/lib/serialise';
import { arbitraryCharacterRecord } from '../helpers/arbitraries';

/**
 * The exact, ordered top-level key list every serialised CharacterRecord must
 * expose. This mirrors the fixed design order enforced by `serialiseDataset`.
 */
const EXPECTED_RECORD_KEYS = [
  'character',
  'pinyin',
  'meanings',
  'strokeCount',
  'strokeData',
  'decomposition',
  'prompt',
  'sources',
] as const;

/** The exact, ordered key list the `sources` object must expose. */
const EXPECTED_SOURCE_KEYS = [
  'pinyin',
  'meanings',
  'strokeCount',
  'strokeData',
  'decomposition',
] as const;

/** The valid DatasetId values a `sources` field may hold. */
const VALID_DATASET_IDS: ReadonlySet<DatasetId> = new Set<DatasetId>([
  'cc-cedict',
  'hanzi-writer-data',
  'make-me-a-hanzi',
]);

/** The required field → DatasetId mapping the design fixes. */
const REQUIRED_SOURCE_MAPPING: FieldSources = {
  pinyin: 'cc-cedict',
  meanings: 'cc-cedict',
  strokeCount: 'hanzi-writer-data',
  strokeData: 'hanzi-writer-data',
  decomposition: 'make-me-a-hanzi',
};

describe('Property 4: CharacterRecord schema completeness', () => {
  it('a built record has exactly the expected top-level keys — directly and after serialisation', () => {
    fc.assert(
      fc.property(arbitraryCharacterRecord(), (record: CharacterRecord) => {
        // Direct assertion on the record object: its own key set matches the
        // expected set (order-insensitive, since object literal key order is
        // not the contract here — the serialiser fixes order).
        expect(new Set(Object.keys(record))).toEqual(
          new Set(EXPECTED_RECORD_KEYS),
        );

        // Pipeline assertion: run the record through the real serialiser, which
        // reconstructs each record with the fixed design key order, then verify
        // the serialised form exposes EXACTLY the expected keys in order.
        const map = new Map<string, CharacterRecord>([
          [record.character, record],
        ]);
        const json = serialiseDataset(map);
        const parsed = JSON.parse(json) as Record<
          string,
          Record<string, unknown>
        >;

        const serialisedRecord = parsed[record.character];
        expect(serialisedRecord).toBeDefined();
        expect(Object.keys(serialisedRecord)).toEqual([
          ...EXPECTED_RECORD_KEYS,
        ]);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 10: sources object has exactly the required keys with valid values', () => {
  it('sources has exactly the five required keys, each a valid DatasetId matching the fixed mapping', () => {
    fc.assert(
      fc.property(arbitraryCharacterRecord(), (record: CharacterRecord) => {
        const { sources } = record;

        // Exactly the five required keys — no more, no fewer.
        expect(new Set(Object.keys(sources))).toEqual(
          new Set(EXPECTED_SOURCE_KEYS),
        );

        // Every value is a valid DatasetId.
        for (const key of EXPECTED_SOURCE_KEYS) {
          const value = sources[key];
          expect(VALID_DATASET_IDS.has(value)).toBe(true);
        }

        // Each field maps to the dataset the design fixes it to.
        for (const key of EXPECTED_SOURCE_KEYS) {
          expect(sources[key]).toBe(REQUIRED_SOURCE_MAPPING[key]);
        }
      }),
      { numRuns: 100 },
    );
  });
});
