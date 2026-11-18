/**
 * Drawing-surface sizes that keep one rite on one screen.
 *
 * Summon: the paper is as wide as the page allows (the viewport width minus
 * 32 px of page padding) and as tall as the height left after all other Summon
 * content (`SUMMON_OTHER_PX`, the target height of that content at the
 * tightest card, from the proof-pass design budget). It has a 96 px floor and
 * a 560 px ceiling (the séance column's inner width).
 *
 * Write: the constant 400 comes from the "Height budget" of the
 * visual-identity design: the same sum for the Write step with a result block
 * (about 300 px plus the result block and slack). The 200 px floor keeps the
 * surface usable on short screens.
 */

/** Height in CSS px that the Walkthrough_Line takes from the drawing surface. */
export const WALKTHROUGH_LINE_PX = 24;

/** Height in CSS px of a one-line cross-level line. */
export const CROSS_LEVEL_LINE_PX = 24;

/** Height in CSS px of a cross-level line that wraps to two lines (two lines of 20 px plus the 4 px gap). */
export const CROSS_LEVEL_LINE_WRAP_PX = 44;

/**
 * Height the cross-level line reserves inside `reservedPx`: one line when the
 * container is at least 600 px wide or the text has at most 40 characters,
 * two lines otherwise.
 */
export function crossLevelReserve(text: string, width: number): number {
  return width >= 600 || text.length <= 40 ? CROSS_LEVEL_LINE_PX : CROSS_LEVEL_LINE_WRAP_PX;
}

/** Column width of the séance: 560 px inner width at max-w-xl. */
export const SUMMON_PAPER_MAX_PX = 560;

/** Height of all other Summon content at the tightest card (target; see the proof-pass design budget). */
export const SUMMON_OTHER_PX = 484;

/** Side of the Summon paper in CSS px for a viewport of `width` × `height`, after `reservedPx` is taken from the height. */
export function summonPaperSize(width: number, height: number, reservedPx = 0): number {
  return Math.max(
    96,
    Math.min(Math.floor(Math.min(width - 32, height - reservedPx - SUMMON_OTHER_PX)), SUMMON_PAPER_MAX_PX),
  );
}

/** Side of the Write surface in CSS px for a viewport of `width` × `height`, after `reservedPx` is taken from the height. */
export function writeSurfaceSize(width: number, height: number, reservedPx = 0): number {
  return Math.round(Math.max(200, Math.min(0.8 * width, 420, height - reservedPx - 400)));
}
