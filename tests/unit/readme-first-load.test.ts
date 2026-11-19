import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLE_BUDGET_BYTES } from '../../scripts/check-bundle-size';

const root = resolve(__dirname, '../..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

const num = (s: string): number => Number(s.replace(/,/g, ''));

function readmeFirstLoad(): { counted: number; level1: number; total: number } {
  const m = readme.match(
    /Real first load[^\n]*?: ([\d,]+) bytes counted \+ ([\d,]+) bytes level 1 dataset = ([\d,]+) bytes\./,
  );
  expect(m, 'README first-load sentence not found').not.toBeNull();
  return { counted: num(m![1]!), level1: num(m![2]!), total: num(m![3]!) };
}

describe('README first load', () => {
  it('adds up and keeps the budget on the counted part only', () => {
    const r = readmeFirstLoad();
    expect(r.counted + r.level1).toBe(r.total);
    expect(r.counted).toBeLessThanOrEqual(BUNDLE_BUDGET_BYTES);
    expect(readme).toContain('The budget is 300,000 bytes and applies to the counted part only');
    expect(readme).toContain('The budget does not count the level 1 dataset.');
  });
});
