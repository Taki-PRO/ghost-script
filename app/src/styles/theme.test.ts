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

  it('skyHold equals the old sky at 88% (nightMid to nightLow at 33/45), within 1 per channel', () => {
    const ch = (hex: string, i: number): number => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
    for (let i = 0; i < 3; i++) {
      const expected = ch(theme.nightMid, i) + (ch(theme.nightLow, i) - ch(theme.nightMid, i)) * (33 / 45);
      expect(Math.abs(ch(theme.skyHold, i) - expected), `channel ${i}`).toBeLessThanOrEqual(1);
    }
  });

  for (const t of ['ink', 'error', 'ghost', 'muted', 'success'] as const) {
    it(`${t} on skyHold is >= 4.5:1`, () => {
      expect(contrastRatio(theme[t], theme.skyHold)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('nightTop is the darkest and nightLow the lightest sky stop', () => {
    const l = (c: string) => contrastRatio(c, '#000000');
    expect(l(theme.nightTop)).toBeLessThan(l(theme.nightMid));
    expect(l(theme.nightMid)).toBeLessThan(l(theme.nightLow));
  });

  describe('Hillside tokens (decorative, aria-hidden)', () => {
    const ch = (hex: string, i: number): number => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
    // Sky at 30% of the viewport: nightTop to nightMid, stops at 0% and 55%.
    const skyAt30 = (): string => {
      const t = 30 / 55;
      const parts = [0, 1, 2].map((i) =>
        Math.round(ch(theme.nightTop, i) + (ch(theme.nightMid, i) - ch(theme.nightTop, i)) * t),
      );
      return `#${parts.map((p) => p.toString(16).padStart(2, '0')).join('')}`;
    };

    it('uses the approved hex values', () => {
      expect(theme.hillFar).toBe('#202c4c');
      expect(theme.hillNear).toBe('#161e38');
    });

    it('hillFar against the sky at the crest is at least 1.3:1 (about 1.41)', () => {
      expect(contrastRatio(theme.hillFar, skyAt30())).toBeGreaterThanOrEqual(1.3);
    });

    it('hillNear against hillFar is at least 1.1:1 (about 1.20)', () => {
      expect(contrastRatio(theme.hillFar, theme.hillNear)).toBeGreaterThanOrEqual(1.1);
    });
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
