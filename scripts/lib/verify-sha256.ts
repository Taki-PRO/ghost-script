import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/** Lower-case hex SHA-256 of the given bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reads the hash recorded for `label` in SOURCES.md, from a line of the form
 * `- **SHA-256 (<label>):** <64 hex digits>`. Returns null when the line is
 * absent or the value is not exactly 64 hex digits.
 */
export function readRecordedSha256(sourcesMd: string, label: string): string | null {
  const pattern = new RegExp(
    `^- \\*\\*SHA-256 \\(${escapeRegExp(label)}\\):\\*\\* ([0-9a-fA-F]{64})[ \\t]*$`,
    'm',
  );
  const match = pattern.exec(sourcesMd.replace(/\r\n/g, '\n'));
  return match ? match[1].toLowerCase() : null;
}

export class Sha256MismatchError extends Error {
  readonly path: string;
  readonly expected: string;
  readonly actual: string;

  constructor(path: string, expected: string, actual: string) {
    super(`SHA-256 mismatch for ${path}: expected ${expected}, actual ${actual}`);
    this.name = 'Sha256MismatchError';
    this.path = path;
    this.expected = expected;
    this.actual = actual;
  }
}

/** Throws Sha256MismatchError when the file's hash differs from `expected`. */
export async function verifyFileSha256(path: string, expected: string): Promise<void> {
  const actual = sha256Hex(await readFile(path));
  if (actual !== expected.trim().toLowerCase()) {
    throw new Sha256MismatchError(path, expected, actual);
  }
}
