import { GHOST_EYE_PATHS, GHOST_PATH } from '../components/GhostFigure';
import { theme } from './theme';

/**
 * Pure builder of the pointer cursors (spec night-polish, Part 2). The values in
 * `index.css` are printed by `cursorDeclaration` and compared with it in `cursors.test.ts`.
 * Each cursor is a flat SVG: no filter, no gradient, no text, no reference to anything outside it.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface CursorImage {
  /** Raw SVG text, single-quoted attributes. */
  readonly svg: string;
  /** CSS px; also the `width` attribute of the root svg. */
  readonly width: number;
  readonly height: number;
  /** Whole pixels, inside the image. */
  readonly hotspot: Point;
  readonly fallback: 'auto' | 'crosshair';
  /** The body colour (ghost) or the arm colour (brush). */
  readonly fill: string;
  /** The outline colour (ghost) or the casing colour (brush). */
  readonly outline: string;
}

/** The 64 x 80 viewBox shown at 24 x 30 px. */
export const GHOST_CURSOR_SCALE = 0.375;
export const GHOST_CURSOR_WIDTH = 24;
export const GHOST_CURSOR_HEIGHT = 30;
/** Outline stroke in viewBox units (1.8 px, 0.9 px outside the silhouette). */
export const GHOST_OUTLINE_WIDTH = 4.8;
/** The Link_Cursor eyes are scaled about their own bounding-box centre. */
export const LINK_EYE_SCALE = 1.4;

export const BRUSH_SIZE = 20;
export const BRUSH_HOTSPOT: Point = { x: 10, y: 10 };
export const BRUSH_ARM_WIDTH = 2;
export const BRUSH_CASING_WIDTH = 4;
/** Arm centre lines (butt caps), in image pixels. */
export const BRUSH_ARMS: readonly { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }[] = [
  { x1: 1, y1: 10, x2: 6, y2: 10 },
  { x1: 14, y1: 10, x2: 19, y2: 10 },
  { x1: 10, y1: 1, x2: 10, y2: 6 },
  { x1: 10, y1: 14, x2: 10, y2: 19 },
];

const NS = "xmlns='http://www.w3.org/2000/svg'";

/** Bounding box of every coordinate pair (the control hull) of an absolute M/C/Z path. */
export function pathBounds(d: string): Bounds {
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i] as number;
    const y = nums[i + 1] as number;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** Percent-encodes the characters a double-quoted `data:` URI cannot carry raw. */
export function encodeSvg(svg: string): string {
  return svg.replace(/%/g, '%25').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23');
}

function eyeTransform(d: string): string {
  const b = pathBounds(d);
  const cx = Number(((b.minX + b.maxX) / 2).toFixed(3));
  const cy = Number(((b.minY + b.maxY) / 2).toFixed(3));
  return `translate(${cx} ${cy}) scale(${LINK_EYE_SCALE}) translate(${-cx} ${-cy})`;
}

export function ghostCursor(variant: 'default' | 'link'): CursorImage {
  const link = variant === 'link';
  const fill = link ? theme.paper : theme.ink;
  const outline = link ? theme.inkOnPaper : theme.background;
  const eyes = GHOST_EYE_PATHS.map((d) =>
    link
      ? `<path d='${d}' fill='${outline}' transform='${eyeTransform(d)}'/>`
      : `<path d='${d}' fill='${outline}'/>`,
  ).join('');
  const svg =
    `<svg ${NS} width='${GHOST_CURSOR_WIDTH}' height='${GHOST_CURSOR_HEIGHT}' viewBox='0 0 64 80'>` +
    `<path d='${GHOST_PATH}' fill='${outline}' stroke='${outline}' stroke-width='${GHOST_OUTLINE_WIDTH}' stroke-linejoin='round'/>` +
    `<path d='${GHOST_PATH}' fill='${fill}'/>` +
    eyes +
    `</svg>`;
  const b = pathBounds(GHOST_PATH);
  return {
    svg,
    width: GHOST_CURSOR_WIDTH,
    height: GHOST_CURSOR_HEIGHT,
    hotspot: {
      x: Math.round(((b.minX + b.maxX) / 2) * GHOST_CURSOR_SCALE),
      y: Math.round(b.minY * GHOST_CURSOR_SCALE),
    },
    fallback: 'auto',
    fill,
    outline,
  };
}

export function brushCursor(): CursorImage {
  const d = BRUSH_ARMS.map((a) => `M${a.x1} ${a.y1}${a.y1 === a.y2 ? 'H' + a.x2 : 'V' + a.y2}`).join('');
  const svg =
    `<svg ${NS} width='${BRUSH_SIZE}' height='${BRUSH_SIZE}' viewBox='0 0 ${BRUSH_SIZE} ${BRUSH_SIZE}'>` +
    `<g stroke='${theme.paper}' stroke-width='${BRUSH_CASING_WIDTH}' fill='none'><path d='${d}'/></g>` +
    `<g stroke='${theme.inkOnPaper}' stroke-width='${BRUSH_ARM_WIDTH}' fill='none'><path d='${d}'/></g>` +
    `</svg>`;
  return {
    svg,
    width: BRUSH_SIZE,
    height: BRUSH_SIZE,
    hotspot: BRUSH_HOTSPOT,
    fallback: 'crosshair',
    fill: theme.inkOnPaper,
    outline: theme.paper,
  };
}

/** The value of a `cursor` declaration: url("data:image/svg+xml,...") X Y, fallback */
export function cursorDeclaration(image: CursorImage): string {
  return `url("data:image/svg+xml,${encodeSvg(image.svg)}") ${image.hotspot.x} ${image.hotspot.y}, ${image.fallback}`;
}
