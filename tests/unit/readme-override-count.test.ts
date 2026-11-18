// The README's level 1 override count equals the data rows of data/prompt-overrides.csv
// (proof-pass, Requirement 2.19).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

describe('README override count', () => {
  it('states the number of data rows of data/prompt-overrides.csv', () => {
    const rows = read('data/prompt-overrides.csv')
      .split('\n')
      .slice(1)
      .filter((line) => line.trim() !== '');
    const match = /\((\d+) overrides;/.exec(read('README.md'));
    expect(match, 'README has no "(N overrides;" sentence').not.toBeNull();
    expect(Number(match?.[1])).toBe(rows.length);
    expect(rows.length).toBe(49);
  });
});
