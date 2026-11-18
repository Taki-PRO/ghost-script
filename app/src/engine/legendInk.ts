/**
 * Timing plan for the intro's legend line inking itself in (pure, no clock, no DOM).
 * hanzi-writer 3.7.3 animates a stroke in (len + 600) / (3 * speed) ms, where len is the
 * summed length of the stroke's median points. With no delay between strokes and no fade,
 * a character takes the sum over its strokes.
 */
import type { HanziWriterCharData } from '../data/charDataLoader';

/** Time budget of one character, ms (the limit is 900). */
export const LEGEND_CHAR_BUDGET_MS = 720;
/** Longest time of one stroke, ms (the limit is under 200). */
export const LEGEND_STROKE_CAP_MS = 199;
/** The existing ink-reveal wipe used for a character without stroke data, ms. */
export const LEGEND_WIPE_MS = 600;
/** Upper bound for the whole plan, ms. */
export const LEGEND_TOTAL_CAP_MS = 6000;

const STROKE_OVERHEAD = 600;

export interface InkStep {
  readonly kind: 'ink';
  readonly char: string;
  /** hanzi-writer strokeAnimationSpeed. */
  readonly speed: number;
  readonly strokeMs: readonly number[];
  readonly totalMs: number;
}
export interface WipeStep {
  readonly kind: 'wipe';
  readonly char: string;
  readonly ms: number;
}
export type LegendStep = InkStep | WipeStep;
export interface LegendPlan {
  readonly steps: readonly LegendStep[];
  readonly totalMs: number;
}

function medianLength(median: readonly (readonly number[])[]): number {
  let len = 0;
  for (let i = 1; i < median.length; i += 1) {
    const [x0, y0] = median[i - 1] as readonly number[];
    const [x1, y1] = median[i] as readonly number[];
    len += Math.hypot((x1 ?? 0) - (x0 ?? 0), (y1 ?? 0) - (y0 ?? 0));
  }
  return len;
}

/** One step per character of `line`, in order; a character with no usable entry (such as the comma) is a wipe. */
export function planLegendInk(
  line: string,
  data: Readonly<Record<string, HanziWriterCharData>>,
): LegendPlan {
  const steps: LegendStep[] = [];
  for (const char of line) {
    const entry = data[char];
    if (!entry || entry.medians.length === 0) {
      steps.push({ kind: 'wipe', char, ms: LEGEND_WIPE_MS });
      continue;
    }
    const weights = entry.medians.map((m) => medianLength(m) + STROKE_OVERHEAD);
    const sum = weights.reduce((a, b) => a + b, 0);
    const speed = Math.max(sum / (3 * LEGEND_CHAR_BUDGET_MS), Math.max(...weights) / (3 * LEGEND_STROKE_CAP_MS));
    const strokeMs = weights.map((w) => w / (3 * speed));
    steps.push({ kind: 'ink', char, speed, strokeMs, totalMs: strokeMs.reduce((a, b) => a + b, 0) });
  }
  const totalMs = steps.reduce((a, s) => a + (s.kind === 'ink' ? s.totalMs : s.ms), 0);
  return { steps, totalMs };
}
