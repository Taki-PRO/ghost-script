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

/** Reads characters.json and returns its records keyed by character. */
export function loadDataset(path: string = defaultDatasetPath()): Map<string, CharacterRecord> {
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
