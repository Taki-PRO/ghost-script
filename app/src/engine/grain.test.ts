import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio, theme } from '../styles/theme';
import {
  CLEAR_HALF_WIDTH_PX,
  CONTROL_BOX_MARGIN_PX,
  CONTROL_HALF_WIDTH_PX,
  GRAINS,
  GRAIN_COUNT,
  GRAIN_DURATION_S,
  grainLeftCss,
  grainSpan,
} from './grain';

describe('GRAINS', () => {
  it('has 24 grains at most', () => {
    expect(GRAINS).toHaveLength(GRAIN_COUNT);
    expect(GRAINS.length).toBeLessThanOrEqual(24);
  });
  it('keeps every field in range', () => {
    for (const g of GRAINS) {
      expect(g.xPercent).toBeGreaterThanOrEqual(0);
      expect(g.xPercent).toBeLessThanOrEqual(100);
      expect(g.sizePx).toBeGreaterThanOrEqual(2);
      expect(g.sizePx).toBeLessThanOrEqual(4);
      expect(g.alpha).toBeGreaterThanOrEqual(0.18);
      expect(g.alpha).toBeLessThanOrEqual(0.35);
      expect(g.delayS).toBeLessThan(0);
      expect(GRAIN_DURATION_S[g.speed]).toBeGreaterThanOrEqual(12);
    }
  });
  it('uses all three speeds and spreads across the page', () => {
    expect(new Set(GRAINS.map((g) => g.speed)).size).toBe(3);
    expect(new Set(GRAINS.map((g) => g.xPercent)).size).toBeGreaterThan(12);
  });
  it('uses no randomness, no clock and no seal or candle colour in the source', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'grain.ts'), 'utf8');
    expect(src).not.toMatch(/Math\.random|Date|performance\.now/);
    expect(src).not.toMatch(/seal|candle|#[0-9a-fA-F]{3,6}/i);
  });

  describe('lanes keep the grain clear of every control (proof-pass 13.32 to 13.36)', () => {
    // Controls are centred in the column; each Control_Box is the control's box plus 4 px on every side.
    const controlBox = (layerWidth: number): [number, number] => {
      const half = CONTROL_HALF_WIDTH_PX + CONTROL_BOX_MARGIN_PX;
      return [layerWidth / 2 - half, layerWidth / 2 + half];
    };
    for (const width of [320, 375, 1024, 1440]) {
      it(`no Grain_Path meets a Control_Box at ${width} px`, () => {
        const [boxL, boxR] = controlBox(width);
        for (const g of GRAINS) {
          const [l, r] = grainSpan(g, width);
          expect(l, `grain at ${g.xPercent} ${g.lane}`).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(width);
          expect(r <= boxL || l >= boxR, `grain ${g.lane} ${g.xPercent}: ${l}..${r} vs ${boxL}..${boxR}`).toBe(true);
        }
      });
    }
    it('uses both lanes and the CSS position names the same band', () => {
      expect(new Set(GRAINS.map((g) => g.lane)).size).toBe(2);
      for (const g of GRAINS) expect(grainLeftCss(g)).toContain(`50% - ${CLEAR_HALF_WIDTH_PX + g.sizePx}px`);
    });
    it('keeps the intro ink text at 4.5:1 over a grain at 0.35 alpha, and ghost text only on controls', () => {
      const hex = (h: string) => [0, 2, 4].map((i) => parseInt(h.slice(1).slice(i, i + 2), 16));
      const over = (ground: string) =>
        '#' + hex(theme.ink).map((c, k) => Math.round(c * 0.35 + (hex(ground)[k] ?? 0) * 0.65).toString(16).padStart(2, '0')).join('');
      for (const ground of [theme.background, theme.nightLow]) {
        expect(contrastRatio(theme.ink, over(ground)), ground).toBeGreaterThanOrEqual(4.5);
      }
      // ghost text falls below 4.5:1 over a grain, so it may only appear where no grain can be: the Sources control.
      expect(contrastRatio(theme.ghost, over(theme.background))).toBeLessThan(4.5);
      const dir = dirname(fileURLToPath(import.meta.url));
      const intro = readFileSync(join(dir, '..', 'components', 'IntroScreen.tsx'), 'utf8');
      const ghostLines = intro.split('\n').filter((l) => /text-(ghost|muted)/.test(l));
      for (const l of ghostLines) expect(l, l).toMatch(/GhostFigure|text-sm text-ghost underline/);
    });
  });
});
