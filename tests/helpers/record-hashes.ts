// Pure SHA-256 helpers for the proof-pass fixtures (Item 2).
import { createHash } from 'node:crypto';

export type HashableRecord = Record<string, unknown>;

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** SHA-256 of JSON.stringify(record), key order as in the file. */
export function hashRecord(record: HashableRecord): string {
  return sha256(JSON.stringify(record));
}

/** Same hash after omitting `prompt` and `promptReview` (levels 2 and 3 carry the latter). */
export function hashRecordWithoutPrompt(record: HashableRecord): string {
  const { prompt: _prompt, promptReview: _promptReview, ...rest } = record;
  return hashRecord(rest);
}
