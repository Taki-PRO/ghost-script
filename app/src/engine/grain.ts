/** Grain_Fall: a fixed table of falling grains for the intro. No randomness and no clock, so every render is the same. */
export type GrainSpeed = 'a' | 'b' | 'c';
export type GrainLane = 'left' | 'right';

/**
 * Lanes (proof-pass Item 13 follow-up). The intro's controls are centred in the column, so no
 * grain may fall inside the band centred on the layer that spans CONTROL_HALF_WIDTH_PX plus the
 * 4 px of a Control_Box (hover lift and focus ring) on each side. The two lanes are the side
 * margins outside that band; each grain sits in one lane for its whole fall. The band is a layout
 * constant, never measured at run time; e2e/legend-ink.spec.ts checks it against the real boxes.
 */
/** Half the width of the widest intro control ("Begin the Séance"), in px; the e2e test checks it. */
export const CONTROL_HALF_WIDTH_PX = 112;
/** Extra clearance of a Control_Box on every side, in px. */
export const CONTROL_BOX_MARGIN_PX = 4;
/** Half the width of the grain-free band, in px. */
export const CLEAR_HALF_WIDTH_PX = CONTROL_HALF_WIDTH_PX + CONTROL_BOX_MARGIN_PX;

/** x range [left, right] in px of a grain's whole fall, for a layer `layerWidthPx` wide. */
export function grainSpan(g: { xPercent: number; sizePx: number; lane: GrainLane }, layerWidthPx: number): [number, number] {
  const room = Math.max(0, layerWidthPx / 2 - CLEAR_HALF_WIDTH_PX - g.sizePx);
  const offset = (g.xPercent / 100) * room;
  const left = g.lane === 'left' ? offset : layerWidthPx / 2 + CLEAR_HALF_WIDTH_PX + offset;
  return [left, left + g.sizePx];
}

/** The same position as a CSS `left` value, so the layer needs no script or measurement. */
export function grainLeftCss(g: { xPercent: number; sizePx: number; lane: GrainLane }): string {
  const room = `max(0px, 50% - ${CLEAR_HALF_WIDTH_PX + g.sizePx}px)`;
  const offset = `${g.xPercent / 100} * ${room}`;
  return g.lane === 'left' ? `calc(${offset})` : `calc(50% + ${CLEAR_HALF_WIDTH_PX}px + ${offset})`;
}
export interface Grain {
  /** Position inside its lane, 0 to 100 (0 is the lane's outer edge nearest the page edge or the control band). */
  readonly xPercent: number;
  /** Which side margin the grain falls in: left or right of the controls' band. */
  readonly lane: GrainLane;
  /** 2 to 4. */
  readonly sizePx: number;
  /** 0.18 to 0.35, applied to the `ink` token. */
  readonly alpha: number;
  /** a, b and c take 14, 17 and 20 s per pass (CSS). */
  readonly speed: GrainSpeed;
  /** Negative, so the grain is already falling at first paint. */
  readonly delayS: number;
}
export const GRAIN_COUNT = 24;
/** Seconds per pass for each speed class; each is at least 12. */
export const GRAIN_DURATION_S: Readonly<Record<GrainSpeed, number>> = { a: 14, b: 17, c: 20 };

const SPEEDS: readonly GrainSpeed[] = ['a', 'b', 'c'];
const SIZES: readonly number[] = [2, 3, 4, 3, 2, 4];
const ALPHAS: readonly number[] = [0.18, 0.24, 0.3, 0.35, 0.21, 0.27];

export const GRAINS: readonly Grain[] = Array.from({ length: GRAIN_COUNT }, (_, i) => {
  const speed = SPEEDS[i % 3] as GrainSpeed;
  return {
    xPercent: Math.round(((i * 17 + 5) % 24) * (100 / 24) * 10) / 10 + 2,
    lane: (i % 2 === 0 ? 'left' : 'right') as GrainLane,
    sizePx: SIZES[i % SIZES.length] as number,
    alpha: ALPHAS[(i * 5) % ALPHAS.length] as number,
    speed,
    delayS: -Math.round(((i * 7) % GRAIN_COUNT) * (GRAIN_DURATION_S[speed] / GRAIN_COUNT) * 10) / 10 - 0.5,
  };
});
