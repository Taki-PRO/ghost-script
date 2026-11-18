/** Grain_Fall: a fixed table of falling grains for the intro. No randomness and no clock, so every render is the same. */
export type GrainSpeed = 'a' | 'b' | 'c';
export interface Grain {
  /** Across the page, 0 to 100. */
  readonly xPercent: number;
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
    sizePx: SIZES[i % SIZES.length] as number,
    alpha: ALPHAS[(i * 5) % ALPHAS.length] as number,
    speed,
    delayS: -Math.round(((i * 7) % GRAIN_COUNT) * (GRAIN_DURATION_S[speed] / GRAIN_COUNT) * 10) / 10 - 0.5,
  };
});
