import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { hashRecord, hashRecordWithoutPrompt } from './record-hashes';

describe('record hashes', () => {
  const record = { character: '本', prompt: { text: 'a' }, promptReview: { x: 1 }, strokeCount: 5 };

  it('hashRecord is the SHA-256 of the JSON text', () => {
    const expected = createHash('sha256').update(JSON.stringify(record)).digest('hex');
    expect(hashRecord(record)).toBe(expected);
  });

  it('hashRecordWithoutPrompt ignores prompt and promptReview only', () => {
    const other = { ...record, prompt: { text: 'b' }, promptReview: { x: 2 } };
    expect(hashRecordWithoutPrompt(other)).toBe(hashRecordWithoutPrompt(record));
    expect(hashRecordWithoutPrompt({ ...record, strokeCount: 6 })).not.toBe(hashRecordWithoutPrompt(record));
    expect(hashRecord(other)).not.toBe(hashRecord(record));
  });

  it('key order matters', () => {
    expect(hashRecord({ a: 1, b: 2 })).not.toBe(hashRecord({ b: 2, a: 1 }));
  });
});
