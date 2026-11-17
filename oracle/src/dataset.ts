import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CharacterRecord } from '../../app/src/data/types';

/** Raised when the dataset file is missing, is not valid JSON, or has the wrong shape. */
export class OracleDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OracleDataError';
  }
}

export function defaultDatasetPath(): string {
  return fileURLToPath(new URL('../../app/public/data/characters.json', import.meta.url));
}

/** Power_Data path, resolved against this file (the bundle in the Power root), never the working directory. */
export function powerDatasetPath(): string {
  return fileURLToPath(new URL('./data/oracle-data.json', import.meta.url));
}

/** The three Level_Datasets, level 1 first. Level 1 stays in `characters.json`. */
export function defaultDatasetPaths(): string[] {
  return ['characters.json', 'characters-level2.json', 'characters-level3.json'].map((name) =>
    fileURLToPath(new URL(`../../app/public/data/${name}`, import.meta.url)),
  );
}

function isRecordLike(value: unknown): value is CharacterRecord {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  const d = r.decomposition as Record<string, unknown> | null | undefined;
  return (
    typeof r.character === 'string' &&
    (r.cangjie === null || typeof r.cangjie === 'string') &&
    typeof r.sources === 'object' &&
    r.sources !== null &&
    typeof d === 'object' &&
    d !== null &&
    typeof d.decomposition === 'string' &&
    typeof d.atomic === 'boolean' &&
    typeof d.radical === 'string' &&
    Array.isArray(d.components)
  );
}

/** Reads one dataset file and returns its records keyed by character. */
function loadFile(path: string): Map<string, CharacterRecord> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new OracleDataError(`Cannot read dataset file ${path}: ${reason}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new OracleDataError(`Dataset file ${path} is not valid JSON: ${reason}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new OracleDataError(`Dataset file ${path} must be a JSON object of character records`);
  }
  const map = new Map<string, CharacterRecord>();
  for (const [key, value] of Object.entries(parsed)) {
    if (!isRecordLike(value) || value.character !== key) {
      throw new OracleDataError(`Dataset file ${path} has an invalid record for key "${key}"`);
    }
    map.set(key, value);
  }
  return map;
}

/**
 * Reads one or more dataset files and merges them. With no argument it reads all three
 * Level_Datasets (1,200 characters). Throws an OracleDataError if a file is missing or
 * invalid, or if a character appears in more than one file.
 */
export function loadDataset(
  paths: string | readonly string[] = defaultDatasetPaths(),
): Map<string, CharacterRecord> {
  const list = typeof paths === 'string' ? [paths] : paths;
  const merged = new Map<string, CharacterRecord>();
  const firstSeen = new Map<string, string>();
  for (const path of list) {
    for (const [key, value] of loadFile(path)) {
      const earlier = firstSeen.get(key);
      if (earlier !== undefined) {
        throw new OracleDataError(`Character "${key}" appears twice: in ${earlier} and in ${path}`);
      }
      firstSeen.set(key, path);
      merged.set(key, value);
    }
  }
  return merged;
}
