/**
 * Drawing-surface sizes that keep one rite on one screen.
 *
 * The constants 600 and 400 come from the "Height budget" of the
 * visual-identity design: 600 is the sum of everything else in the Summon step
 * and its session at the tightest card (about 592 px, rounded up); 400 is the
 * same sum for the Write step with a result block (about 300 px plus the
 * result block and slack). The floors keep the surface usable on short screens.
 */

/** Side of the Summon paper in CSS px for a viewport of `width` × `height`. */
export function summonPaperSize(width: number, height: number): number {
  return Math.round(Math.max(96, Math.min(0.4 * width, 160, height - 600)));
}

/** Side of the Write surface in CSS px for a viewport of `width` × `height`. */
export function writeSurfaceSize(width: number, height: number): number {
  return Math.round(Math.max(200, Math.min(0.8 * width, 420, height - 400)));
}
