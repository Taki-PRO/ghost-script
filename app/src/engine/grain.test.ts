import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GRAINS, GRAIN_COUNT, GRAIN_DURATION_S } from './grain';

describe('GRAINS', () => {
  it('has 24 grains at most', () => {
    expect(GRAINS).toHaveLength(GRAIN_COUNT);
    expect(GRAINS.length).toBeLessThanOrEqual(24);
  });
  it('keeps every field in range', () => {
    for (const g of GRAINS) {
      expect(g.xPercent).toBeGreaterThanOrEqual(0);
      expect(g.xPercent).toBeLessThanOrEqual(100);
      expect(g.sizePx).toBeGreaterThanOrEqual(2);
      expect(g.sizePx).toBeLessThanOrEqual(4);
      expect(g.alpha).toBeGreaterThanOrEqual(0.18);
      expect(g.alpha).toBeLessThanOrEqual(0.35);
      expect(g.delayS).toBeLessThan(0);
      expect(GRAIN_DURATION_S[g.speed]).toBeGreaterThanOrEqual(12);
    }
  });
  it('uses all three speeds and spreads across the page', () => {
    expect(new Set(GRAINS.map((g) => g.speed)).size).toBe(3);
    expect(new Set(GRAINS.map((g) => g.xPercent)).size).toBeGreaterThan(12);
  });
  it('uses no randomness, no clock and no seal or candle colour in the source', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'grain.ts'), 'utf8');
    expect(src).not.toMatch(/Math\.random|Date|performance\.now/);
    expect(src).not.toMatch(/seal|candle|#[0-9a-fA-F]{3,6}/i);
  });
});
