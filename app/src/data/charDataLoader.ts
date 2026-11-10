import type { CharDataLoaderFn } from 'hanzi-writer';
import type { CharacterRecord, StrokeData } from './types';

/** In-memory dataset keyed by character (insertion order = JSON key order). */
export type CharacterDataset = ReadonlyMap<string, CharacterRecord>;

/** Shape hanzi-writer quiz mode expects (structurally its `CharacterJson`). */
export interface HanziWriterCharData {
  readonly strokes: string[];
  readonly medians: number[][][];
  readonly radStrokes?: number[];
}

export type LoadResult =
  | { ok: true; dataset: CharacterDataset }
  | { ok: false; reason: 'fetch-failed' | 'parse-failed' | 'invalid-shape' };

/** Default location of the generated dataset, honouring Vite's base path. */
export function defaultDatasetUrl(): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  return `${base}data/characters.json`;
}

// ---------------------------------------------------------------------------
// Validation helpers (JSON boundary: everything is `unknown`)
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isNonEmptyStringArray(v: unknown): v is string[] {
  return isStringArray(v) && v.length > 0 && v.every((x) => x.length > 0);
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x));
}

function isMedians(v: unknown): v is number[][][] {
  return (
    Array.isArray(v) &&
    v.every((stroke) => Array.isArray(stroke) && stroke.every((pt) => isNumberArray(pt)))
  );
}

function isStrokeData(v: unknown): v is StrokeData {
  if (!isPlainObject(v)) return false;
  const { strokes, medians, radStrokes } = v;
  return (
    isNonEmptyStringArray(strokes) &&
    isMedians(medians) &&
    medians.length === strokes.length &&
    isNumberArray(radStrokes)
  );
}

function isDecomposition(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.decomposition === 'string' &&
    typeof v.radical === 'string' &&
    typeof v.atomic === 'boolean' &&
    isStringArray(v.components) &&
    (v.etymology === null || isPlainObject(v.etymology)) &&
    (v.matches === null || Array.isArray(v.matches))
  );
}

function isPrompt(v: unknown): boolean {
  return isPlainObject(v) && isNonEmptyString(v.meaning) && isNonEmptyString(v.pinyin);
}

function isCharacterRecord(v: unknown): v is CharacterRecord {
  if (!isPlainObject(v)) return false;
  return (
    isNonEmptyString(v.character) &&
    isNonEmptyStringArray(v.pinyin) &&
    isNonEmptyStringArray(v.meanings) &&
    typeof v.strokeCount === 'number' &&
    Number.isInteger(v.strokeCount) &&
    v.strokeCount > 0 &&
    isStrokeData(v.strokeData) &&
    isDecomposition(v.decomposition) &&
    isPrompt(v.prompt) &&
    isPlainObject(v.sources)
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch and validate characters.json. Never throws: failures are returned as
 * `{ ok: false, reason }`. The parsed data is not modified (Req 2.2).
 */
export async function loadDataset(url: string = defaultDatasetUrl()): Promise<LoadResult> {
  let text: string;
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, reason: 'fetch-failed' };
    text = await response.text();
  } catch {
    return { ok: false, reason: 'fetch-failed' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'parse-failed' };
  }

  if (!isPlainObject(parsed)) return { ok: false, reason: 'invalid-shape' };

  const dataset = new Map<string, CharacterRecord>();
  for (const [key, value] of Object.entries(parsed)) {
    if (FORBIDDEN_KEYS.has(key)) return { ok: false, reason: 'invalid-shape' };
    if (!isCharacterRecord(value) || value.character !== key) {
      return { ok: false, reason: 'invalid-shape' };
    }
    dataset.set(key, value);
  }
  return { ok: true, dataset };
}

/** Typed lookup. Returns undefined when the character is absent. */
export function getRecord(dataset: CharacterDataset, char: string): CharacterRecord | undefined {
  return dataset.get(char);
}

/**
 * Pure projection of a record's strokeData into hanzi-writer's character data.
 * Returns a NEW object; the `strokes`/`medians`/`radStrokes` arrays are shared
 * with the input (not copied), and the input is never mutated.
 */
export function toHanziWriterData(strokeData: StrokeData): HanziWriterCharData {
  return {
    strokes: strokeData.strokes,
    medians: strokeData.medians,
    radStrokes: strokeData.radStrokes,
  };
}

/**
 * Build the charDataLoader passed to HanziWriter.create(...). Known characters
 * call `onLoad` synchronously with data from OUR dataset; unknown characters
 * call `onError` (never `onLoad`). Never touches the network (Req 8.3).
 */
export function makeCharDataLoader(dataset: CharacterDataset): CharDataLoaderFn {
  return (char, onLoad, onError) => {
    const record = dataset.get(char);
    if (record === undefined) {
      onError(new Error(`No stroke data for character "${char}" in the dataset`));
      return;
    }
    onLoad(toHanziWriterData(record.strokeData));
  };
}
