/** hanzi-writer padding in the Write step, in CSS pixels. Leaves a margin for the seal. */
export const WRITE_PADDING_PX = 40;

/** Seal box width and height, in CSS pixels. */
export const SEAL_SIZE_PX = 32;

/** Distance of the seal from the right and bottom edges of the paper, in CSS pixels. */
export const SEAL_INSET_PX = 4;

/** Seal glyph font size, in CSS pixels (18 pt). */
export const SEAL_GLYPH_PX = 24;

/** Gap between the seal and the drawing area: padding minus (size + inset). */
export const SEAL_CLEARANCE_PX = WRITE_PADDING_PX - (SEAL_SIZE_PX + SEAL_INSET_PX);
