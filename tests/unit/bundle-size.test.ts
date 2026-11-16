import { describe, expect, it } from 'vitest';
import {
  BUNDLE_BUDGET_BYTES,
  summariseBundle,
  type SizedFile,
} from '../../scripts/check-bundle-size';

const f = (path: string, gzipBytes: number): SizedFile => ({ path, gzipBytes });

describe('summariseBundle', () => {
  it('has a budget of 300,000 bytes', () => {
    expect(BUNDLE_BUDGET_BYTES).toBe(300_000);
  });

  it('is ok when under budget', () => {
    const r = summariseBundle([f('a.js', 100_000), f('b.css', 5)]);
    expect(r.total).toBe(100_005);
    expect(r.ok).toBe(true);
  });

  it('is ok when exactly at budget', () => {
    const r = summariseBundle([f('a.js', 299_999), f('b.css', 1)]);
    expect(r.total).toBe(BUNDLE_BUDGET_BYTES);
    expect(r.ok).toBe(true);
  });

  it('is not ok when one byte over budget', () => {
    const r = summariseBundle([f('a.js', 300_000), f('b.css', 1)]);
    expect(r.total).toBe(300_001);
    expect(r.ok).toBe(false);
  });

  it('excludes data/characters.json from total and list', () => {
    const r = summariseBundle([f('data/characters.json', 900_000), f('a.js', 10)]);
    expect(r.total).toBe(10);
    expect(r.ok).toBe(true);
    expect(r.largest.map((x) => x.path)).toEqual(['a.js']);
  });

  it('keeps only the five largest, biggest first', () => {
    const files = [1, 2, 3, 4, 5, 6, 7].map((n) => f(`f${n}.js`, n * 10));
    const r = summariseBundle(files);
    expect(r.largest.map((x) => x.path)).toEqual(['f7.js', 'f6.js', 'f5.js', 'f4.js', 'f3.js']);
    expect(r.total).toBe(280);
  });

  it('handles an empty list', () => {
    expect(summariseBundle([])).toEqual({ total: 0, ok: true, largest: [] });
  });
});
