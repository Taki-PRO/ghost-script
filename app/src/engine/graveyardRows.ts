/** Pure functions for the shorter Graveyard (proof-pass Item 12, R12.1 to R12.6, R12.19). */

export const GRAVE_MIN_PX = 48;
export const GRAVE_GAP_PX = 8;
export const GRAVE_PAD_PX = 12;

/** The browser's own `auto-fill` track count for `minmax(48px, 1fr)`, an 8 px gap and 12 px padding. */
export function columnCount(wrapperWidth: number): number {
  const inner = wrapperWidth - 2 * GRAVE_PAD_PX;
  return Math.max(1, Math.floor((inner + GRAVE_GAP_PX) / (GRAVE_MIN_PX + GRAVE_GAP_PX)));
}

/**
 * How many graves to show. `lastMetIndex` is the displayed index of the last
 * met grave, or -1 when none is met. No met ghost: one row. Otherwise every
 * row through the last met grave's row, plus one more row, capped at the total.
 */
export function visibleGraveCount(total: number, columns: number, lastMetIndex: number): number {
  const cols = Math.max(1, Math.floor(columns));
  if (total <= 0) return 0;
  if (lastMetIndex < 0) return Math.min(total, cols);
  return Math.min(total, (Math.floor(lastMetIndex / cols) + 2) * cols);
}

/** The paragraph after the grid: null when nothing is collapsed. */
export function moreGravesText(collapsed: number): string | null {
  if (!(collapsed > 0)) return null;
  return collapsed === 1 ? '1 more grave' : `${collapsed} more graves`;
}
