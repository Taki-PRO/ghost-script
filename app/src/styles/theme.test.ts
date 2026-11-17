import { describe, expect, it } from 'vitest';
import { contrastRatio, theme } from './theme';

describe('theme contrast (WCAG AA)', () => {
  it('computes known extremes', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  const textTokens = ['ink', 'muted', 'ghost', 'success', 'error', 'sealLight'] as const;
  const darkBackgrounds = ['background', 'surface', 'nightTop', 'nightMid', 'nightLow'] as const;

  for (const t of textTokens) {
    for (const b of darkBackgrounds) {
      it(`${t} on ${b} is >= 4.5:1`, () => {
        expect(contrastRatio(theme[t], theme[b])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  for (const t of ['inkOnPaper', 'drawing', 'hintInk'] as const) {
    it(`${t} on paper is >= 4.5:1`, () => {
      expect(contrastRatio(theme[t], theme.paper)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('success is an alias of sealLight', () => {
    expect(theme.success).toBe(theme.sealLight);
  });

  it('paperLabel on seal is >= 4.5:1', () => {
    expect(contrastRatio(theme.paperLabel, theme.seal)).toBeGreaterThanOrEqual(4.5);
  });

  it('seal on paper is >= 3:1 (graphic, no text)', () => {
    expect(contrastRatio(theme.seal, theme.paper)).toBeGreaterThanOrEqual(3);
  });

  it('the Seal_Stamp inner border (paperLabel) on seal is >= 3:1', () => {
    expect(contrastRatio(theme.paperLabel, theme.seal)).toBeGreaterThanOrEqual(3);
  });

  it('the primary button border (paper) on nightLow is >= 3:1', () => {
    expect(contrastRatio(theme.paper, theme.nightLow)).toBeGreaterThanOrEqual(3);
  });

  it('uses the approved hex values', () => {
    expect(theme.seal).toBe('#b3361f');
    expect(theme.paperLabel).toBe('#f3ead2');
    expect(theme.sealLight).toBe('#ec7a64');
    expect(theme.hintInk).toBe('#2c3e5a');
    expect(theme.ghost).toBe('#bdb7a6');
    expect(theme.error).toBe('#e6dcc3');
    expect(theme.gridLine).toBe('#7a6a4f');
    expect(theme.candle).toBe('#f0b866');
  });

  it('ink and muted on nightTop are >= 4.5:1', () => {
    expect(contrastRatio(theme.ink, theme.nightTop)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.muted, theme.nightTop)).toBeGreaterThanOrEqual(4.5);
  });

  it('nightTop is the darkest and nightLow the lightest sky stop', () => {
    const l = (c: string) => contrastRatio(c, '#000000');
    expect(l(theme.nightTop)).toBeLessThan(l(theme.nightMid));
    expect(l(theme.nightMid)).toBeLessThan(l(theme.nightLow));
  });

  const graves = ['graveRestless', 'graveRest', 'graveWisp'] as const;
  for (const t of ['ink', 'ghost'] as const) {
    for (const g of graves) {
      it(`${t} on ${g} is >= 4.5:1`, () => {
        expect(contrastRatio(theme[t], theme[g])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
