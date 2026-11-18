import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GHOST_EYE_PATHS, GHOST_PATH } from '../components/GhostFigure';
import {
  BRUSH_ARM_WIDTH,
  BRUSH_ARMS,
  BRUSH_CASING_WIDTH,
  GHOST_CURSOR_SCALE,
  brushCursor,
  cursorDeclaration,
  encodeSvg,
  ghostCursor,
  pathBounds,
  type CursorImage,
} from './cursors';
import { contrastRatio, theme } from './theme';

const ghost = ghostCursor('default');
const link = ghostCursor('link');
const brush = brushCursor();
const all: readonly [string, CursorImage][] = [
  ['ghost', ghost],
  ['link', link],
  ['brush', brush],
];

/** Attribute values `d='...'` of every path in an SVG text, in order. */
function pathDs(svg: string): string[] {
  return [...svg.matchAll(/<path d='([^']*)'/g)].map((m) => m[1] as string);
}

/** Topmost point of an absolute M/C/Z path, found by sampling each cubic. */
function topOfPath(d: string): { x: number; y: number } {
  const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  let cx = n[0] as number;
  let cy = n[1] as number;
  let best = { x: cx, y: cy };
  for (let i = 2; i + 5 < n.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = n.slice(i, i + 6) as [number, number, number, number, number, number];
    for (let s = 0; s <= 200; s++) {
      const t = s / 200;
      const u = 1 - t;
      const y = u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
      if (y < best.y) {
        best = {
          x: u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          y,
        };
      }
    }
    cx = x3;
    cy = y3;
  }
  return best;
}

describe('pathBounds and encodeSvg', () => {
  it('reads the control hull of GHOST_PATH', () => {
    const b = pathBounds(GHOST_PATH);
    expect(b.minX).toBeCloseTo(7.2, 5);
    expect(b.maxX).toBeCloseTo(57.2, 5);
    expect(b.minY).toBeCloseTo(3.8, 5);
    expect(b.maxY).toBeCloseTo(76.4, 5);
  });

  it('encodes the four characters a double-quoted URI cannot carry', () => {
    expect(encodeSvg('<a b="#" 5%>')).toBe('%3Ca b="%23" 5%25%3E');
  });
});

describe('cursor images', () => {
  it.each(all)('%s: the URL is double-quoted and round-trips to the SVG text', (_name, image) => {
    const declaration = cursorDeclaration(image);
    const m = /^url\("data:image\/svg\+xml,([^"]*)"\) (\d+) (\d+), (auto|crosshair)$/.exec(declaration);
    expect(m).not.toBeNull();
    const encoded = m?.[1] ?? '';
    expect(encoded).not.toMatch(/[<>#"]/);
    expect(decodeURIComponent(encoded)).toBe(image.svg);
    expect(Number(m?.[2])).toBe(image.hotspot.x);
    expect(Number(m?.[3])).toBe(image.hotspot.y);
  });

  it.each(all)('%s: width and height attributes match the image and stay within the limit', (name, image) => {
    expect(image.svg).toContain(`width='${image.width}' height='${image.height}'`);
    const limit = name === 'brush' ? 24 : 32;
    expect(image.width).toBeLessThanOrEqual(limit);
    expect(image.height).toBeLessThanOrEqual(limit);
  });

  it('uses the sizes of the decisions: ghost 24 x 30, brush 20 x 20', () => {
    expect([ghost.width, ghost.height]).toEqual([24, 30]);
    expect([link.width, link.height]).toEqual([24, 30]);
    expect([brush.width, brush.height]).toEqual([20, 20]);
  });

  it.each(all)('%s: the hotspot is a whole pixel inside the image', (_name, image) => {
    const { x, y } = image.hotspot;
    expect(Number.isInteger(x)).toBe(true);
    expect(Number.isInteger(y)).toBe(true);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(image.width);
    expect(y).toBeLessThan(image.height);
  });

  it('hotspots are (12, 1) for the ghosts and (10, 10) for the brush', () => {
    expect(ghost.hotspot).toEqual({ x: 12, y: 1 });
    expect(link.hotspot).toEqual({ x: 12, y: 1 });
    expect(brush.hotspot).toEqual({ x: 10, y: 10 });
  });

  it('the ghost hotspots lie within 2 px of the scaled true top of GHOST_PATH', () => {
    const top = topOfPath(GHOST_PATH);
    const tx = top.x * GHOST_CURSOR_SCALE;
    const ty = top.y * GHOST_CURSOR_SCALE;
    for (const image of [ghost, link]) {
      expect(Math.hypot(image.hotspot.x - tx, image.hotspot.y - ty)).toBeLessThanOrEqual(2);
    }
  });

  it('the silhouette d equals GHOST_PATH and the eye d equal GHOST_EYE_PATHS', () => {
    for (const image of [ghost, link]) {
      const ds = pathDs(image.svg);
      expect(ds).toEqual([GHOST_PATH, GHOST_PATH, ...GHOST_EYE_PATHS]);
    }
  });

  it('the Link_Cursor eyes carry a transform and the Ghost_Cursor eyes do not', () => {
    const eyeTags = (svg: string) => [...svg.matchAll(/<path d='([^']*)'[^>]*>/g)].slice(2).map((m) => m[0]);
    expect(eyeTags(ghost.svg)).toHaveLength(GHOST_EYE_PATHS.length);
    for (const tag of eyeTags(ghost.svg)) expect(tag).not.toContain('transform');
    expect(eyeTags(link.svg)).toHaveLength(GHOST_EYE_PATHS.length);
    for (const tag of eyeTags(link.svg)) expect(tag).toMatch(/transform='translate\([^)]*\) scale\(1\.4\) translate\([^)]*\)'/);
  });

  it.each(all)('%s: no filter, gradient, text, href or url() inside the SVG', (_name, image) => {
    expect(image.svg).not.toMatch(/filter|Gradient|<text|href|url\(/i);
  });

  it.each(all)('%s: no Han character in the SVG', (_name, image) => {
    expect(image.svg).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('fallbacks are auto for the ghosts and crosshair for the brush', () => {
    expect(ghost.fallback).toBe('auto');
    expect(link.fallback).toBe('auto');
    expect(brush.fallback).toBe('crosshair');
    expect(cursorDeclaration(ghost)).toMatch(/, auto$/);
    expect(cursorDeclaration(brush)).toMatch(/, crosshair$/);
  });
});

describe('cursor contrast', () => {
  const best = (image: CursorImage, ground: string) =>
    Math.max(contrastRatio(image.fill, ground), contrastRatio(image.outline, ground));

  it.each([
    ['ghost', ghost],
    ['link', link],
  ] as const)('%s: fill or outline is at least 3:1 on background, surface, paper and inkOnPaper', (_n, image) => {
    for (const ground of [theme.background, theme.surface, theme.paper, theme.inkOnPaper]) {
      expect(best(image, ground), ground).toBeGreaterThanOrEqual(3);
    }
  });

  it('brush: arm or casing is at least 3:1 on paper and inkOnPaper', () => {
    for (const ground of [theme.paper, theme.inkOnPaper]) {
      expect(best(brush, ground), ground).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('brush cursor geometry', () => {
  it('arms are at most 2 px wide and the casing is the allowed 4 px', () => {
    expect(BRUSH_ARM_WIDTH).toBeLessThanOrEqual(2);
    expect(BRUSH_CASING_WIDTH).toBe(4);
    expect(brush.svg).toContain(`stroke='${theme.inkOnPaper}' stroke-width='${BRUSH_ARM_WIDTH}'`);
    expect(brush.svg).toContain(`stroke='${theme.paper}' stroke-width='${BRUSH_CASING_WIDTH}'`);
  });

  it('does not draw the ghost silhouette', () => {
    expect(brush.svg).not.toContain(GHOST_PATH);
  });

  it('uses no seal red and no candle amber', () => {
    const svg = brush.svg.toLowerCase();
    for (const colour of [theme.seal, theme.sealLight, theme.candle]) {
      expect(svg).not.toContain(colour.toLowerCase());
    }
  });

  it('leaves the 6 px circle around the hotspot unpainted (nearest paint at least 3.5 px away)', () => {
    const { x: hx, y: hy } = brush.hotspot;
    const half = BRUSH_CASING_WIDTH / 2;
    const distances = BRUSH_ARMS.map((a) => {
      // The stroked arm is an axis-aligned rectangle with butt caps.
      const horizontal = a.y1 === a.y2;
      const minX = horizontal ? Math.min(a.x1, a.x2) : a.x1 - half;
      const maxX = horizontal ? Math.max(a.x1, a.x2) : a.x1 + half;
      const minY = horizontal ? a.y1 - half : Math.min(a.y1, a.y2);
      const maxY = horizontal ? a.y1 + half : Math.max(a.y1, a.y2);
      const dx = Math.max(minX - hx, 0, hx - maxX);
      const dy = Math.max(minY - hy, 0, hy - maxY);
      return Math.hypot(dx, dy);
    });
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(3.5);
  });
});

describe('index.css cursor declarations', () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const declarations = [...css.matchAll(/cursor:\s*(url\([^;]*);/g)].map((m) => m[1] as string);

  it('contains exactly the three declarations the builder prints, in order', () => {
    const expected = [cursorDeclaration(ghost), cursorDeclaration(link), cursorDeclaration(brush)];
    expect(declarations, `expected declarations:\n${expected.join('\n')}`).toEqual(expected);
  });

  it('double-quotes each data:image/svg+xml URL and follows it with an auto or crosshair fallback', () => {
    expect(declarations).toHaveLength(3);
    for (const d of declarations) {
      expect(d).toMatch(/^url\("data:image\/svg\+xml,[^"<>#]*"\) \d+ \d+, (auto|crosshair)$/);
    }
    expect(declarations.map((d) => d.split(', ').pop())).toEqual(['auto', 'auto', 'crosshair']);
  });
});
