// Level 1 protection (harder-ghosts, task 4.2). The three level 1 files are
// recorded by SHA-256 before any pipeline change; the test fails when one differs.
//
// Requirements: 2.4, 3.9, 17.4
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');

export const LEVEL1_SHA256: Readonly<Record<string, string>> = {
  'app/public/data/characters.json': 'c7207b9b5ff4a7f951ef0b5ca84c7e7129d316feba2d4a248e5cf9687345736e',
  'data/prompt-review.csv': '2a11a5906b16ddb3e47fa8397974f9be040a656cdafbdd5ff98ca729d5aa1573',
  'data/character-list.txt': '531ecd05c2e998f11e7f0e9f1b7c17427cf789f7acf8ecd96f8b125b5a79bc3c',
};

describe('level 1 files are protected', () => {
  for (const [file, expected] of Object.entries(LEVEL1_SHA256)) {
    it(`${file} is byte for byte unchanged`, () => {
      const actual = createHash('sha256').update(readFileSync(resolve(ROOT, file))).digest('hex');
      expect(
        actual,
        `${file} changed (expected ${expected}, got ${actual}). Changing level 1 needs the human's decision.`,
      ).toBe(expected);
    });
  }
});
