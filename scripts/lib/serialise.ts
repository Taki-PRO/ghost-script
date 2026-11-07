// Deterministic serialiser for the character dataset.
//
// Produces a human-readable JSON string from a Map of CharacterRecords:
//   - records are sorted by Unicode codepoint ascending (char.codePointAt(0))
//   - each record's keys are emitted in a FIXED order
//     (character, pinyin, meanings, strokeCount, strokeData, decomposition, sources)
//   - nested strokeData / decomposition / sources objects use the design's
//     field order
//
// The function is pure and deterministic: the same Map always yields a
// byte-for-byte identical string.

import type {
  CharacterRecord,
  Decomposition,
  FieldSources,
  StrokeData,
} from '../../app/src/data/types';

/**
 * Serialises a Map of CharacterRecords to a deterministic, human-readable JSON
 * string.
 *
 * Records are sorted by Unicode codepoint ascending. Within each record, keys
 * are emitted in the fixed design order, and nested objects (strokeData,
 * decomposition, sources) are reconstructed with explicit field order so the
 * output does not depend on the insertion order of the input records or their
 * sub-objects.
 *
 * @param records map of character → CharacterRecord
 * @returns deterministic JSON string (2-space indented)
 */
export function serialiseDataset(
  records: Map<string, CharacterRecord>,
): string {
  const sortedChars = [...records.keys()].sort((a, b) => {
    const ca = a.codePointAt(0) ?? 0;
    const cb = b.codePointAt(0) ?? 0;
    return ca - cb;
  });

  const obj: Record<string, OrderedRecord> = {};
  for (const char of sortedChars) {
    // The character is guaranteed present because it came from records.keys().
    const record = records.get(char) as CharacterRecord;
    obj[char] = orderRecord(record);
  }

  return JSON.stringify(obj, null, 2);
}

/** A CharacterRecord with its keys reconstructed in fixed design order. */
interface OrderedRecord {
  character: string;
  pinyin: string[];
  meanings: string[];
  strokeCount: number;
  strokeData: StrokeData;
  decomposition: Decomposition;
  sources: FieldSources;
}

/** Rebuilds a record with keys in the fixed design order. */
function orderRecord(record: CharacterRecord): OrderedRecord {
  return {
    character: record.character,
    pinyin: record.pinyin,
    meanings: record.meanings,
    strokeCount: record.strokeCount,
    strokeData: {
      strokes: record.strokeData.strokes,
      medians: record.strokeData.medians,
      radStrokes: record.strokeData.radStrokes,
    },
    decomposition: {
      decomposition: record.decomposition.decomposition,
      radical: record.decomposition.radical,
      etymology: record.decomposition.etymology,
      matches: record.decomposition.matches,
      atomic: record.decomposition.atomic,
      components: record.decomposition.components,
    },
    sources: {
      pinyin: record.sources.pinyin,
      meanings: record.sources.meanings,
      strokeCount: record.sources.strokeCount,
      strokeData: record.sources.strokeData,
      decomposition: record.sources.decomposition,
    },
  };
}
