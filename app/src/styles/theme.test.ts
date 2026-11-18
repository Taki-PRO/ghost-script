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

  describe('Grass token (decorative, aria-hidden)', () => {
    const rgb = (hex: string): number[] => [0, 1, 2].map((i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16));
    const toHex = (c: number[]): string =>
      `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    const mix = (base: string, top: string, a: number): string => {
      const b = rgb(base);
      const t = rgb(top);
      return toHex(b.map((v, i) => v * (1 - a) + t[i] * a));
    };
    const hsl = (hex: string): { h: number; s: number; l: number } => {
      const [r, g, b] = rgb(hex).map((v) => v / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      const d = max - min;
      if (d === 0) return { h: 0, s: 0, l: l * 100 };
      const s = d / (1 - Math.abs(2 * l - 1));
      let h: number;
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      return { h: h * 60, s: s * 100, l: l * 100 };
    };

    it('uses the approved hex value', () => {
      expect(theme.grass).toBe('#30505c');
    });

    it('is a dark teal-blue, not a bright green (hue 180 to 230, saturation <= 35%, lightness <= 30%)', () => {
      const { h, s, l } = hsl(theme.grass);
      expect(h).toBeGreaterThanOrEqual(180);
      expect(h).toBeLessThanOrEqual(230);
      expect(s).toBeLessThanOrEqual(35);
      expect(l).toBeLessThanOrEqual(30);
    });

    const surfaces: Array<[string, string]> = [
      ['hillNear', theme.hillNear],
      ['hillFar', theme.hillFar],
      ['nightMid', theme.nightMid],
      ['nightLow', theme.nightLow],
      ['skyHold', theme.skyHold],
      ['never-met stone', '#14161c'],
      ['stone gradient top', '#2a2d36'],
      ['stone gradient foot', '#1d2028'],
    ];
    for (const [name, hex] of surfaces) {
      it(`grass against ${name} is >= 1.5:1`, () => {
        expect(contrastRatio(theme.grass, hex)).toBeGreaterThanOrEqual(1.5);
      });
    }

    // Under .tablet-rest::before the stone foot (where the tuft stands) and the tuft take the same candle overlay.
    for (const alpha of [0, 0.1, 0.17, 0.2, 0.28]) {
      it(`grass against the stone foot, both under candle at alpha ${alpha}, is >= 1.5:1`, () => {
        const ratio = contrastRatio(mix(theme.grass, theme.candle, alpha), mix('#1d2028', theme.candle, alpha));
        expect(ratio).toBeGreaterThanOrEqual(1.5);
      });
    }

    it('reports the computed ratios', () => {
      const out = surfaces.map(([n, h]) => `${n}=${contrastRatio(theme.grass, h).toFixed(2)}`);
      for (const alpha of [0, 0.1, 0.17, 0.2, 0.28]) {
        out.push(
          `foot@${alpha}=${contrastRatio(mix(theme.grass, theme.candle, alpha), mix('#1d2028', theme.candle, alpha)).toFixed(2)}`,
        );
      }
      console.log(out.join(' '));
      expect(out.length).toBeGreaterThan(0);
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
