import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BUNDLE_BUDGET_BYTES, firstLoad, type SizedFile } from '../../scripts/check-bundle-size';

const root = resolve(__dirname, '../..');
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
const dist = join(root, 'app', 'dist');

const num = (s: string): number => Number(s.replace(/,/g, ''));

function readmeFirstLoad(): { counted: number; level1: number; total: number } {
  const m = readme.match(
    /Real first load[^\n]*?: ([\d,]+) bytes counted \+ ([\d,]+) bytes level 1 dataset = ([\d,]+) bytes\./,
  );
  expect(m, 'README first-load sentence not found').not.toBeNull();
  return { counted: num(m![1]!), level1: num(m![2]!), total: num(m![3]!) };
}

function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

describe('README first load', () => {
  it('adds up and keeps the budget on the counted part only', () => {
    const r = readmeFirstLoad();
    expect(r.counted + r.level1).toBe(r.total);
    expect(r.counted).toBeLessThanOrEqual(BUNDLE_BUDGET_BYTES);
    expect(readme).toContain('The budget is 300,000 bytes and applies to the counted part only');
    expect(readme).toContain('The budget does not count the level 1 dataset.');
  });

  // Building inside a test is too slow and changes files, so this compares with the current
  // app/dist when it exists (run `npm run build -w app` first). It is skipped when dist is absent.
  it.skipIf(!existsSync(dist))('equals the first load computed from the current app/dist', () => {
    const files: SizedFile[] = walk(dist).map((full) => ({
      path: relative(dist, full).split(sep).join('/'),
      gzipBytes: gzipSync(readFileSync(full), { level: 9 }).length,
    }));
    expect(readmeFirstLoad()).toEqual(firstLoad(files));
  });
});
