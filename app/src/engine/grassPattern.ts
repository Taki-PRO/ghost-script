/**
 * Fixed Grass pattern of the Graveyard: tufts by tablet position mod 5 and 24 hill-crest slots.
 * Pure tables, no randomness and no clock, so every render draws the same grass.
 */

export interface Tuft {
  /** Index into TUFT_SHAPES, 0 to 4. */
  readonly shape: number;
  /** Horizontal offset from the tablet's centre, px. */
  readonly dx: number;
}

export interface HillTuft {
  readonly shape: number;
  /** Across the hillside wrapper, 0 to 100. */
  readonly xPercent: number;
  /** Far-ridge height at xPercent in the 48-unit hillside viewBox. */
  readonly crestY: number;
  /** 1.2 to 1.6. */
  readonly scale: number;
}

/** Tuft viewBox is 0 0 24 9, in px at scale 1. */
export const TUFT_WIDTH = 24;
export const TUFT_HEIGHT = 9;

/** Five tuft shapes, blades only, base on y = 9. */
export const TUFT_SHAPES: readonly string[] = [
  'M3 9 C3.4 6 2.6 3.6 1.4 1.6 C4.2 3 5.6 5.8 6 9 Z M9.5 9 C9.5 5.6 10 2.8 11.4 0.4 C13 3 13.4 6 13.2 9 Z M16.5 9 C17 6.6 18.4 4 21 2.4 C19.6 4.8 19.2 7 19.4 9 Z',
  'M5 9 C5 6 6 3.2 8.6 1 C8 4 8.4 6.6 9.4 9 Z M13 9 C13.4 5.6 15.2 2.8 17.6 1.6 C16.8 4.4 17 6.8 17.6 9 Z',
  'M2.5 9 C2.6 7 2 5.2 1.2 3.6 C3.4 4.8 4.4 6.8 4.6 9 Z M7 9 C7.2 6 7.8 3.6 9 1.8 C10.2 4 10.4 6.6 10 9 Z M13 9 C13 6.4 13.6 4 15 2.2 C16 4.4 16.2 6.8 15.8 9 Z M18.6 9 C19 7.2 19.8 5.4 21.8 4 C21 6 21 7.6 21.4 9 Z',
  'M10 9 C10 5 10.8 2.2 12.4 0.2 C13.6 3 14 6 14 9 Z M5 9 C5.2 7 5.8 5.2 7.2 3.8 C7.4 5.6 7.8 7.4 8.2 9 Z M16 9 C16.6 7.4 17.8 6 19.6 5.2 C19 6.6 19 7.8 19.2 9 Z',
  'M4 9 C4.6 6.4 6.4 3.8 9.4 2 C8.2 4.6 8 6.8 8.4 9 Z M10.5 9 C11.4 6 13.4 3.6 16.6 2.2 C15.2 4.6 14.8 6.8 15 9 Z M17.4 9 C18 7.4 19.4 6 21.6 5.2 C20.6 6.6 20.4 7.8 20.6 9 Z',
];

/** Tablet tufts by position mod 5. */
export const TABLET_TUFTS: readonly Tuft[] = [
  { shape: 0, dx: -5 },
  { shape: 3, dx: 4 },
  { shape: 1, dx: 0 },
  { shape: 4, dx: -3 },
  { shape: 2, dx: 5 },
];

/** Second tuft of each tablet: another shape, on the other side of the centre from the first. */
export const TABLET_TUFTS_SECOND: readonly Tuft[] = [
  { shape: 1, dx: 10 },
  { shape: 1, dx: -9 },
  { shape: 3, dx: 13 },
  { shape: 1, dx: 13 },
  { shape: 1, dx: -11 },
];

/** Tablet tufts are drawn at this scale: 19.2 x 7.2 px. */
export const TABLET_TUFT_SCALE = 0.8;

/** Slots 0 to 11 sit on the far ridge, slots 12 to 23 on the near ridge. */
export const HILL_SLOTS = 24;

/** Hill-crest tufts by slot, left to right. */
export const HILL_TUFTS: readonly HillTuft[] = [
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
  { shape: 1, xPercent: 5, crestY: 34.25, scale: 1.2 },
  { shape: 3, xPercent: 10.5, crestY: 32.88, scale: 1.2 },
  { shape: 0, xPercent: 18, crestY: 31.78, scale: 1.4 },
  { shape: 4, xPercent: 26, crestY: 31.3, scale: 1.2 },
  { shape: 2, xPercent: 34, crestY: 31.07, scale: 1.3 },
  { shape: 1, xPercent: 42, crestY: 30.53, scale: 1.4 },
  { shape: 3, xPercent: 50, crestY: 29.15, scale: 1.2 },
  { shape: 0, xPercent: 58, crestY: 26.99, scale: 1.3 },
  { shape: 4, xPercent: 66, crestY: 26.03, scale: 1.4 },
  { shape: 2, xPercent: 74, crestY: 26.3, scale: 1.2 },
  { shape: 1, xPercent: 82, crestY: 27.27, scale: 1.3 },
  { shape: 3, xPercent: 89.5, crestY: 27.98, scale: 1.4 },
];

/** The far-ridge outline of the hillside (viewBox 0 0 100 48), shared with Graveyard.tsx. */
export const FAR_RIDGE_PATH = 'M0 22 C18 14 34 22 52 16 C72 10 88 18 100 14 L100 48 L0 48 Z';

/** The near-ridge outline of the hillside (viewBox 0 0 100 48), shared with Graveyard.tsx. */
export const NEAR_RIDGE_PATH = 'M0 36 C20 28 36 34 54 28 C74 22 88 32 100 26 L100 48 L0 48 Z';

/** The hillside is 12 rem tall over 48 viewBox units. */
export const HILL_REM_PER_UNIT = 0.25;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Tuft of the tablet at a position. Defined for every integer. */
export function tabletTuft(position: number): Tuft {
  return TABLET_TUFTS[mod(position, TABLET_TUFTS.length)];
}

/** The two tufts of the tablet at a position, first then second. */
export function tabletTufts(position: number): readonly [Tuft, Tuft] {
  const i = mod(position, TABLET_TUFTS.length);
  return [TABLET_TUFTS[i], TABLET_TUFTS_SECOND[i]];
}

/** Hill tuft of a slot. Defined for every integer. */
export function hillTuft(slot: number): HillTuft {
  return HILL_TUFTS[mod(slot, HILL_SLOTS)];
}
