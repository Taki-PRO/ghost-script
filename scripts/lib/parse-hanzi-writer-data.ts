// Parser for hanzi-writer-data per-character JSON files.
//
// Each file lives at `<dataDir>/<char>.json`, named by the Unicode character
// itself (e.g. `data/raw/hanzi-writer-data/我.json`). Each file has the shape
// `{ strokes, medians, radStrokes? }`. Values are kept verbatim.
//
// Characters whose file is missing, malformed, or fails the type guard are
// simply absent from the returned Map — this parser never throws. Treatment of
// missing fields happens later in merge.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Verbatim stroke data for one character, as parsed from hanzi-writer-data. */
export interface HanziWriterEntry {
  /** SVG path data, one per stroke. */
  strokes: string[];
  /** Stroke medians (same order as strokes). */
  medians: number[][][];
  /** Indices of radical strokes (absent in source → defaults to []). */
  radStrokes: number[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number');
}

/** medians: number[][][] — array of strokes, each an array of [x, y] points. */
function isMedians(value: unknown): value is number[][][] {
  return (
    Array.isArray(value) &&
    value.every(
      (stroke) =>
        Array.isArray(stroke) && stroke.every((point) => isNumberArray(point)),
    )
  );
}

/**
 * Type guard for a parsed hanzi-writer-data JSON object.
 *
 * `strokes` and `medians` are required. `radStrokes` is optional: if present it
 * must be a number[]; if absent it is allowed (the caller defaults it to []).
 */
function isHanziWriterRaw(
  value: unknown,
): value is { strokes: string[]; medians: number[][][]; radStrokes?: number[] } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (!isStringArray(obj.strokes)) {
    return false;
  }
  if (!isMedians(obj.medians)) {
    return false;
  }
  if (obj.radStrokes !== undefined && !isNumberArray(obj.radStrokes)) {
    return false;
  }
  return true;
}

/**
 * Reads and parses hanzi-writer-data for the given characters.
 *
 * @param dataDir    Directory containing per-character `<char>.json` files.
 * @param characters Characters to attempt to load.
 * @returns          Map from character to its parsed entry. Characters whose
 *                   file is missing, malformed, or invalid are absent.
 */
export function parseHanziWriterData(
  dataDir: string,
  characters: string[],
): Map<string, HanziWriterEntry> {
  const result = new Map<string, HanziWriterEntry>();

  for (const char of characters) {
    let raw: string;
    try {
      raw = readFileSync(join(dataDir, `${char}.json`), 'utf8');
    } catch {
      // File does not exist (or cannot be read) → character absent.
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Malformed JSON → character absent.
      continue;
    }

    if (!isHanziWriterRaw(parsed)) {
      // Failed type guard → character absent.
      continue;
    }

    result.set(char, {
      strokes: parsed.strokes,
      medians: parsed.medians,
      radStrokes: parsed.radStrokes ?? [],
    });
  }

  return result;
}
