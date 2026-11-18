import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FAR_RIDGE_PATH,
  HILL_REM_PER_UNIT,
  HILL_SLOTS,
  HILL_TUFTS,
  NEAR_RIDGE_PATH,
  TABLET_TUFTS_SECOND,
  TABLET_TUFT_SCALE,
  TABLET_TUFTS,
  TUFT_HEIGHT,
  TUFT_SHAPES,
  TUFT_WIDTH,
  hillTuft,
  tabletTuft,
  tabletTufts,
} from './grassPattern';

type Pt = readonly [number, number];

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const f = (i: 0 | 1): number =>
    u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
  return [f(0), f(1)];
}

/** Ridge height at x, from the two Bezier segments of a ridge path. */
function ridgeY(x: number, path: string = FAR_RIDGE_PATH): number {
  const nums = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
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

describe('tabletTufts', () => {
  const extent = (shape: number): [number, number] => {
    const nums = (TUFT_SHAPES[shape].match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    return [Math.min(...xs), Math.max(...xs)];
  };
  /** Horizontal extent of a tuft from the tablet centre, px. */
  const span = (t: { shape: number; dx: number }): [number, number] => {
    const [lo, hi] = extent(t.shape);
    const left = t.dx - (TUFT_WIDTH * TABLET_TUFT_SCALE) / 2;
    return [left + lo * TABLET_TUFT_SCALE, left + hi * TABLET_TUFT_SCALE];
  };

  it('scales tablet tufts by 0.8 and has five second tufts', () => {
    expect(TABLET_TUFT_SCALE).toBe(0.8);
    expect(TABLET_TUFTS_SECOND).toHaveLength(5);
  });

  it('returns the first and second tuft by position mod 5, for negatives too', () => {
    for (let p = -5; p <= 20; p++) {
      const [a, b] = tabletTufts(p);
      expect(a).toBe(tabletTuft(p));
      expect(b).toBe(TABLET_TUFTS_SECOND[((p % 5) + 5) % 5]);
    }
  });

  it('gives a pair that differs in shape and sits on opposite sides (right when the first is centred)', () => {
    for (let p = 0; p < 5; p++) {
      const [a, b] = tabletTufts(p);
      expect(b.shape).not.toBe(a.shape);
      if (a.dx === 0) expect(b.dx).toBeGreaterThan(0);
      else expect(Math.sign(b.dx)).toBe(-Math.sign(a.dx));
    }
  });

  it('keeps the blade extents of a pair disjoint', () => {
    for (let p = 0; p < 5; p++) {
      const [a, b] = tabletTufts(p);
      const [a0, a1] = span(a);
      const [b0, b1] = span(b);
      expect(a1 < b0 || b1 < a0).toBe(true);
    }
  });

  it('keeps each tuft box inside the 48 px minimum tablet', () => {
    const half = (TUFT_WIDTH * TABLET_TUFT_SCALE) / 2;
    for (let p = 0; p < 5; p++) {
      for (const t of tabletTufts(p)) expect(Math.abs(t.dx) + half).toBeLessThanOrEqual(24);
      expect(TUFT_HEIGHT * TABLET_TUFT_SCALE).toBeLessThanOrEqual(16);
    }
  });
});

describe('hillTuft', () => {
  it('has 24 slots', () => {
    expect(HILL_SLOTS).toBe(24);
    expect(HILL_TUFTS).toHaveLength(24);
  });

  it('is deterministic and defined for every slot, wrapping past 23', () => {
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
    expect(hillTuft(24)).toBe(HILL_TUFTS[0]);
    expect(hillTuft(-1)).toBe(HILL_TUFTS[23]);
  });

  it('has crestY within 0.05 of the evaluated ridge of its slot (far 0 to 11, near 12 to 23)', () => {
    HILL_TUFTS.forEach((t, i) => {
      const path = i < 12 ? FAR_RIDGE_PATH : NEAR_RIDGE_PATH;
      expect(Math.abs(t.crestY - ridgeY(t.xPercent, path))).toBeLessThanOrEqual(0.05);
    });
  });

  it('keeps slots 0 to 11 equal to the old table', () => {
    expect(HILL_TUFTS.slice(0, 12)).toEqual([
      { shape: 2, xPercent: 7, crestY: 19.61, scale: 1.4 },
      { shape: 0, xPercent: 14, crestY: 18.45, scale: 1.2 },
      { shape: 4, xPercent: 22, crestY: 18.17, scale: 1.5 },
      { shape: 1, xPercent: 30, crestY: 18.37, scale: 1.3 },
      { shape: 3, xPercent: 38, crestY: 18.38, scale: 1.6 },
      { shape: 0, xPercent: 46, crestY: 17.54, scale: 1.2 },
      { shape: 2, xPercent: 54, crestY: 15.44, scale: 1.4 },
      { shape: 4, xPercent: 62, crestY: 14.01, scale: 1.3 },
      { shape: 1, xPercent: 70, crestY: 13.69, scale: 1.5 },
      { shape: 0, xPercent: 78, crestY: 14.16, scale: 1.2 },
      { shape: 3, xPercent: 86, crestY: 14.91, scale: 1.4 },
      { shape: 2, xPercent: 93, crestY: 15.15, scale: 1.3 },
    ]);
  });

  it('puts slots 12 to 23 on the near ridge with scale 1.2 to 1.4', () => {
    for (const t of HILL_TUFTS.slice(12)) {
      expect(t.scale).toBeGreaterThanOrEqual(1.2);
      expect(t.scale).toBeLessThanOrEqual(1.4);
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
