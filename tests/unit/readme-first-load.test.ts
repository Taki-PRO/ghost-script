import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLE_BUDGET_BYTES, parseReadmeFirstLoad, roundedKb } from '../../scripts/check-bundle-size';

const root = resolve(__dirname, '../..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

describe('README first load', () => {
  it('adds up and keeps the budget on the counted part only', () => {
    const r = parseReadmeFirstLoad(readme);
    expect(r, 'README first-load figures not found').not.toBeNull();
    expect(r!.counted + r!.level1).toBe(r!.total);
    expect(r!.counted).toBeLessThanOrEqual(BUNDLE_BUDGET_BYTES);
    expect(readme).toContain('The budget is 300,000 bytes and applies to the counted part only');
    expect(readme).toContain('The budget does not count the level 1 dataset.');
  });

  it('states each rounded figure as the nearest kB of the exact figure', () => {
    const r = parseReadmeFirstLoad(readme)!;
    expect(r.totalKb).toBe(roundedKb(r.total));
    expect(r.countedKb).toBe(roundedKb(r.counted));
  });
});
