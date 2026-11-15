import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Sha256MismatchError,
  readRecordedSha256,
  sha256Hex,
  verifyFileSha256,
} from '../../scripts/lib/verify-sha256';

const ABC_HASH = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const HEX_A = '4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e';
const HEX_B = 'a'.repeat(64);

describe('sha256Hex', () => {
  it('hashes known bytes', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe(ABC_HASH);
  });
});

describe('verifyFileSha256', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'verify-sha256-'));
    file = join(dir, 'data.txt');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('passes when the hash matches', async () => {
    await writeFile(file, 'abc');
    await expect(verifyFileSha256(file, ABC_HASH)).resolves.toBeUndefined();
  });

  it('throws Sha256MismatchError when one byte changes', async () => {
    await writeFile(file, 'abd');
    const error: unknown = await verifyFileSha256(file, ABC_HASH).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Sha256MismatchError);
    const mismatch = error as Sha256MismatchError;
    expect(mismatch.path).toBe(file);
    expect(mismatch.expected).toBe(ABC_HASH);
    expect(mismatch.actual).toBe(sha256Hex(new TextEncoder().encode('abd')));
    expect(mismatch.actual).not.toBe(ABC_HASH);
  });
});

describe('readRecordedSha256', () => {
  const md = [
    '## Unihan',
    `- **SHA-256 (Unihan.zip):** ${HEX_A}`,
    `- **SHA-256 (Unihan_DictionaryLikeData.txt):** ${HEX_B}`,
    '',
  ].join('\n');

  it('finds the hash for each label', () => {
    expect(readRecordedSha256(md, 'Unihan.zip')).toBe(HEX_A);
    expect(readRecordedSha256(md, 'Unihan_DictionaryLikeData.txt')).toBe(HEX_B);
  });

  it('returns null when the label is absent', () => {
    expect(readRecordedSha256(md, 'Other.txt')).toBeNull();
    expect(readRecordedSha256('', 'Unihan.zip')).toBeNull();
  });

  it('does not treat the label dot as a wildcard', () => {
    expect(readRecordedSha256(md, 'UnihanXzip')).toBeNull();
  });

  it('returns null for malformed lines', () => {
    const bad = (line: string): string | null => readRecordedSha256(line, 'X');
    expect(bad(`- **SHA-256 (X):** ${'a'.repeat(63)}`)).toBeNull();
    expect(bad(`- **SHA-256 (X):** ${'a'.repeat(65)}`)).toBeNull();
    expect(bad(`- **SHA-256 (X):** ${'g'.repeat(64)}`)).toBeNull();
    expect(bad(`- SHA-256 (X): ${HEX_B}`)).toBeNull();
    expect(bad('- **SHA-256 (X):**')).toBeNull();
  });
});
