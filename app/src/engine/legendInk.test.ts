import { describe, expect, it } from 'vitest';
import realFile from '../../public/data/legend-strokes.json';
import type { HanziWriterCharData } from '../data/charDataLoader';
import { LEGEND_SOURCE } from '../data/citations';
import {
  LEGEND_CHAR_BUDGET_MS,
  LEGEND_STROKE_CAP_MS,
  LEGEND_TOTAL_CAP_MS,
  LEGEND_WIPE_MS,
  planLegendInk,
  type InkStep,
} from './legendInk';

const data = realFile as unknown as Record<string, HanziWriterCharData>;
const plan = planLegendInk(LEGEND_SOURCE.zh, data);
const inkSteps = plan.steps.filter((s): s is InkStep => s.kind === 'ink');

describe('planLegendInk with the real legend strokes', () => {
  it('follows the line order, with a wipe for the comma', () => {
    expect(plan.steps.map((s) => s.char).join('')).toBe(LEGEND_SOURCE.zh);
    const wipes = plan.steps.filter((s) => s.kind === 'wipe');
    expect(wipes).toHaveLength(1);
    expect(wipes[0]?.char).toBe('，');
    expect(wipes[0]).toMatchObject({ ms: LEGEND_WIPE_MS });
  });
  it('plans 51 strokes in the six characters', () => {
    expect(inkSteps.map((s) => s.strokeMs.length)).toEqual([4, 8, 12, 9, 8, 10]);
    expect(inkSteps.reduce((n, s) => n + s.strokeMs.length, 0)).toBe(51);
  });
  it('keeps every stroke under 200 ms', () => {
    for (const s of inkSteps) for (const ms of s.strokeMs) expect(ms).toBeLessThanOrEqual(LEGEND_STROKE_CAP_MS + 1e-9);
  });
  it('keeps every character within 720 ms, under the 900 ms limit', () => {
    for (const s of inkSteps) {
      expect(s.totalMs).toBeLessThanOrEqual(LEGEND_CHAR_BUDGET_MS + 1e-9);
      expect(s.totalMs).toBeLessThan(900);
    }
  });
  it('totals under 5,600 ms, inside the 6,000 ms cap', () => {
    expect(plan.totalMs).toBeLessThan(5600);
    expect(plan.totalMs).toBeLessThanOrEqual(LEGEND_TOTAL_CAP_MS);
    expect(plan.totalMs).toBeCloseTo(inkSteps.reduce((a, s) => a + s.totalMs, 0) + LEGEND_WIPE_MS, 6);
  });
  it('is deterministic', () => {
    expect(planLegendInk(LEGEND_SOURCE.zh, data)).toEqual(plan);
  });
  it('wipes a character that has no entry', () => {
    const partial = planLegendInk('天雨', { 天: data['天'] as HanziWriterCharData });
    expect(partial.steps.map((s) => s.kind)).toEqual(['ink', 'wipe']);
  });
});
