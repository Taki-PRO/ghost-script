import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FAR_RIDGE_PATH,
  HILL_REM_PER_UNIT,
  HILL_SLOTS,
  HILL_TUFTS,
  TABLET_TUFTS,
  TUFT_HEIGHT,
  TUFT_SHAPES,
  TUFT_WIDTH,
  hillTuft,
  tabletTuft,
} from './grassPattern';

type Pt = readonly [number, number];

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const f = (i: 0 | 1): number =>
    u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
  return [f(0), f(1)];
}

/** Ridge height at x, from the two Bezier segments of FAR_RIDGE_PATH. */
function ridgeY(x: number): number {
  const nums = (FAR_RIDGE_PATH.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const m: Pt = [nums[0], nums[1]];
  const seg1: Pt[] = [m, [nums[2], nums[3]], [nums[4], nums[5]], [nums[6], nums[7]]];
  const seg2: Pt[] = [seg1[3], [nums[8], nums[9]], [nums[10], nums[11]], [nums[12], nums[13]]];
  const seg = x <= seg1[3][0] ? seg1 : seg2;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(seg[0], seg[1], seg[2], seg[3], mid)[0] < x) lo = mid;
    else hi = mid;
  }
  return bezier(seg[0], seg[1], seg[2], seg[3], (lo + hi) / 2)[1];
}

describe('tabletTuft', () => {
  it('follows the table by position mod 5', () => {
    expect(TABLET_TUFTS).toHaveLength(5);
    expect([0, 1, 2, 3, 4].map((p) => tabletTuft(p).shape)).toEqual([0, 3, 1, 4, 2]);
    expect([0, 1, 2, 3, 4].map((p) => tabletTuft(p).dx)).toEqual([-5, 4, 0, -3, 5]);
  });

  it('is deterministic and defined for positions 0 to 500', () => {
    for (let p = 0; p <= 500; p++) {
      const t = tabletTuft(p);
      expect(t).toEqual(tabletTuft(p));
      expect(t).toBe(TABLET_TUFTS[p % 5]);
      expect(Number.isInteger(t.shape)).toBe(true);
      expect(t.shape).toBeGreaterThanOrEqual(0);
      expect(t.shape).toBeLessThan(TUFT_SHAPES.length);
      expect(Number.isFinite(t.dx)).toBe(true);
    }
  });

  it('uses all five shapes', () => {
    expect(new Set(TABLET_TUFTS.map((t) => t.shape)).size).toBe(5);
  });

  it('is defined for negative positions', () => {
    expect(tabletTuft(-1)).toBe(TABLET_TUFTS[4]);
  });
});

describe('hillTuft', () => {
  it('has 12 slots', () => {
    expect(HILL_SLOTS).toBe(12);
    expect(HILL_TUFTS).toHaveLength(12);
  });

  it('is deterministic and defined for every slot, wrapping past 11', () => {
    for (let s = 0; s < HILL_SLOTS; s++) {
      const t = hillTuft(s);
      expect(t).toEqual(hillTuft(s));
      expect(t).toBe(HILL_TUFTS[s]);
      expect(t.shape).toBeGreaterThanOrEqual(0);
      expect(t.shape).toBeLessThan(TUFT_SHAPES.length);
      expect(t.scale).toBeGreaterThanOrEqual(1.2);
      expect(t.scale).toBeLessThanOrEqual(1.6);
      expect(t.xPercent).toBeGreaterThan(0);
      expect(t.xPercent).toBeLessThan(100);
    }
    expect(hillTuft(12)).toBe(HILL_TUFTS[0]);
    expect(hillTuft(-1)).toBe(HILL_TUFTS[11]);
  });

  it('has crestY within 0.05 of the evaluated far ridge', () => {
    for (const t of HILL_TUFTS) {
      expect(Math.abs(t.crestY - ridgeY(t.xPercent))).toBeLessThanOrEqual(0.05);
    }
  });

  it('keeps every tuft box inside the wrapper at 296 px', () => {
    for (const t of HILL_TUFTS) {
      expect(t.xPercent * 2.96).toBeGreaterThanOrEqual((TUFT_WIDTH * t.scale) / 2);
      expect((100 - t.xPercent) * 2.96).toBeGreaterThanOrEqual((TUFT_WIDTH * t.scale) / 2);
    }
  });

  it('puts the ridge in rem at 0.25 per unit', () => {
    expect(HILL_REM_PER_UNIT).toBe(0.25);
  });
});

describe('TUFT_SHAPES', () => {
  it('has five non-empty shapes', () => {
    expect(TUFT_SHAPES).toHaveLength(5);
    for (const d of TUFT_SHAPES) expect(d.trim().length).toBeGreaterThan(0);
  });

  it('starts with M, closes every blade with Z, stays inside the 24 x 9 box', () => {
    for (const d of TUFT_SHAPES) {
      expect(d.startsWith('M')).toBe(true);
      const blades = d.split('M').filter((b) => b.length > 0);
      for (const blade of blades) expect(blade.trim().endsWith('Z')).toBe(true);
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      expect(nums.length % 2).toBe(0);
      for (let i = 0; i < nums.length; i += 2) {
        expect(nums[i]).toBeGreaterThanOrEqual(0);
        expect(nums[i]).toBeLessThanOrEqual(TUFT_WIDTH);
        expect(nums[i + 1]).toBeGreaterThanOrEqual(0);
        expect(nums[i + 1]).toBeLessThanOrEqual(TUFT_HEIGHT);
      }
    }
  });

  it('contains no Han character', () => {
    for (const d of TUFT_SHAPES) expect(/\p{Script=Han}/u.test(d)).toBe(false);
  });
});

describe('module source', () => {
  it('contains neither Math.random nor Date', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'grassPattern.ts'), 'utf8');
    expect(src).not.toContain('Math.random');
    expect(src).not.toContain('Date');
  });
});
