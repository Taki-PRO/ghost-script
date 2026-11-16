import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import tailwind from '../../tailwind.config';
import { theme } from './theme';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const STACK =
  '"PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Serif CJK SC", sans-serif';

/** Returns the body of the block that starts at the first `{` after `start`. */
function blockAt(text: string, start: number): { body: string; end: number } {
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return { body: text.slice(open + 1, i), end: i + 1 };
  }
  throw new Error('unbalanced braces');
}

const mediaStart = css.indexOf('@media (prefers-reduced-motion: no-preference)');
const media = blockAt(css, mediaStart);
const outside = css.slice(0, mediaStart) + css.slice(media.end);

describe('index.css', () => {
  it('has exactly one no-preference block and no other media block', () => {
    expect(mediaStart).toBeGreaterThan(-1);
    expect(css.match(/@media/g)).toHaveLength(1);
  });

  it('has animations and keyframes only inside the no-preference block', () => {
    expect(outside).not.toMatch(/@keyframes/);
    expect(outside).not.toMatch(/(^|[\s;{])animation(-[a-z-]+)?\s*:/);
    for (const name of ['ghost-float', 'ghost-fade', 'ghost-flicker', 'ghost-drift', 'grave-flicker']) {
      expect(media.body).toContain(`@keyframes ${name}`);
    }
    expect(media.body).toMatch(/ghost-fade 1\.5s/);
    expect(media.body).toMatch(/ghost-flicker 1\.2s/);
    expect(media.body).toMatch(/ghost-drift 2s/);
  });

  it('ends the flicker at opacity 0.5', () => {
    const k = blockAt(media.body, media.body.indexOf('@keyframes ghost-flicker')).body;
    expect(k).toMatch(/100%\s*\{\s*opacity:\s*0\.5;?\s*\}/);
  });

  it('palette variables equal theme.ts', () => {
    const pairs: Record<string, string> = {
      '--paper': theme.paper,
      '--ink-on-paper': theme.inkOnPaper,
      '--drawing': theme.drawing,
      '--seal': theme.seal,
      '--grid-line': theme.gridLine,
      '--grave-restless': theme.graveRestless,
      '--grave-rest': theme.graveRest,
      '--grave-wisp': theme.graveWisp,
    };
    for (const [name, hex] of Object.entries(pairs)) {
      expect(outside).toContain(`${name}: ${hex};`);
    }
  });

  it('defines static end states outside the media block', () => {
    expect(outside).toMatch(/\[data-ghost-state='faded'\] \.ghost-figure\s*\{\s*opacity:\s*0;/);
    expect(outside).toMatch(/\[data-ghost-state='flickering'\] \.ghost-figure\s*\{\s*opacity:\s*0\.5;/);
    expect(outside).toMatch(/\[data-ghost-state='drifted'\] \.ghost-figure\s*\{[^}]*opacity:\s*0;/);
    for (const c of ['.grave-wisp', '.grave-restless', '.grave-rest']) expect(outside).toContain(c);
  });

  it('has a paper with an inline data: noise and no external image', () => {
    expect(outside).toMatch(/\.ink-paper\s*\{/);
    expect(outside).toMatch(/url\("data:image\/svg\+xml,/);
    expect(outside).toContain('feTurbulence');
    const withoutDataUris = outside.replace(/url\("data:[^"]*"\)/g, '');
    expect(withoutDataUris).not.toMatch(/url\(/);
  });

  describe('night scene', () => {
    const rgb = (hex: string): [number, number, number] => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const lum = (c: readonly number[]): number => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const blend = (base: number[], top: number[], a: number): number[] =>
      base.map((v, i) => v * (1 - a) + top[i] * a);
    const varValue = (name: string): string => {
      const m = outside.match(new RegExp(`${name}:\\s*([^;]+);`));
      expect(m, name).not.toBeNull();
      return m![1].trim();
    };
    const ruleBody = (selector: string): string => {
      const i = outside.indexOf(`${selector} {`);
      expect(i, selector).toBeGreaterThan(-1);
      return blockAt(outside, i).body;
    };

    it('night variables equal the theme tokens', () => {
      expect(varValue('--night-top')).toBe(theme.nightTop);
      expect(varValue('--night-mid')).toBe(theme.nightMid);
      expect(varValue('--night-low')).toBe(theme.nightLow);
      expect(varValue('--mist')).toBe(theme.mist);
      expect(varValue('--moon')).toBe(theme.moon);
      expect(varValue('--candle')).toBe(theme.candle);
    });

    it('mist and moon channel triples equal their hex', () => {
      const [mr, mg, mb] = rgb(theme.mist);
      expect(outside).toContain(`rgb(${mr} ${mg} ${mb} / var(--mist-peak-alpha))`);
      const [or, og, ob] = rgb(theme.moon);
      expect(outside).toContain(`rgb(${or} ${og} ${ob} / var(--moon-peak-alpha))`);
      expect(outside).not.toMatch(/rgb\((?!91 111 154|114 131 171)\d+ \d+ \d+ \/ var\(--(mist|moon)/);
    });

    it('every url( is followed by data:', () => {
      // A url( inside a data: URI (the SVG filter reference) is part of the inline data.
      const stripped = css.replace(/url\("data:[^"]*"\)|url\('data:[^']*'\)/g, 'DATA').replace(/url\(data:[^)]*\)/g, 'DATA');
      expect(stripped).toContain('DATA');
      expect(stripped).not.toMatch(/url\(/);
    });

    it('keeps scroll padding for the sticky header', () => {
      const m = outside.match(/html\s*\{[^}]*scroll-padding-top:\s*([\d.]+)rem/);
      expect(m).not.toBeNull();
      expect(parseFloat(m![1])).toBeGreaterThanOrEqual(4);
    });

    it('scene pseudo-elements ignore pointer events', () => {
      for (const s of ['body::before', 'body::after', '#root::before', '.moon-glow::before']) {
        expect(ruleBody(s)).toMatch(/pointer-events:\s*none/);
      }
      expect(ruleBody('#root')).toMatch(/position:\s*relative/);
      expect(ruleBody('#root')).toMatch(/z-index:\s*1/);
    });

    it('colours every focus ring with the candle', () => {
      expect(ruleBody('*:focus-visible')).toMatch(/--tw-ring-color:\s*var\(--candle\)\s*!important/);
    });

    it('mist animations are in the motion block and take at least 90 s', () => {
      const a = media.body.match(/mist-drift-a\s+(\d+(?:\.\d+)?)s/);
      const b = media.body.match(/mist-drift-b\s+(\d+(?:\.\d+)?)s/);
      expect(a && parseFloat(a[1])).toBeGreaterThanOrEqual(90);
      expect(b && parseFloat(b[1])).toBeGreaterThanOrEqual(90);
      expect(media.body).toContain('@keyframes mist-drift-a');
      expect(media.body).toContain('@keyframes mist-drift-b');
      expect(media.body).toMatch(/\.menu-figure\s*\{[^}]*ghost-float/);
    });

    it('text tokens keep 4.5:1 on the worst-case composite background', () => {
      const mistA = parseFloat(varValue('--mist-peak-alpha'));
      const moonA = parseFloat(varValue('--moon-peak-alpha'));
      let bg = rgb(theme.nightLow) as number[];
      bg = blend(bg, rgb(theme.mist), mistA);
      bg = blend(bg, rgb(theme.mist), mistA);
      bg = blend(bg, rgb(theme.moon), moonA);
      const bgL = lum(bg);
      for (const t of ['ink', 'muted', 'ghost', 'success', 'error'] as const) {
        const fl = lum(rgb(theme[t]));
        const ratio = (Math.max(fl, bgL) + 0.05) / (Math.min(fl, bgL) + 0.05);
        expect(ratio, t).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  describe('.summon-keys', () => {
    const body = (): string => {
      const i = outside.indexOf('.summon-keys {');
      expect(i).toBeGreaterThan(-1);
      return blockAt(outside, i).body;
    };
    const share = 'calc((100vw - 2rem - 18px) / 10)';

    it('defines --key-w from the shared width, capped at 48 px', () => {
      const m = body().match(/--key-w:\s*([^;]+);/);
      expect(m).not.toBeNull();
      expect(m![1].trim()).toBe(`clamp(min(32px, ${share}), ${share}, 48px)`);
    });

    it('keeps the 32 px floor only while the shared width is at least 32 px', () => {
      // Evaluate the formula: floor = min(32, share), value = clamp(floor, share, 48).
      const key = (vw: number): number => {
        const s = (vw - 32 - 18) / 10;
        return Math.min(Math.max(Math.min(32, s), s), 48);
      };
      expect(key(375)).toBeCloseTo(32.5);
      expect(key(1440)).toBe(48);
      expect(key(320)).toBeCloseTo(27);
      // Row 1 (ten keys, nine 2 px gaps) fits inside the page padding at every width.
      for (const vw of [320, 340, 359, 360, 365, 375]) expect(10 * key(vw) + 18).toBeLessThanOrEqual(vw - 32 + 1e-9);
    });

    it('adds no animation and no url()', () => {
      expect(body()).not.toMatch(/animation|url\(/);
    });
  });

  it('sets no scroll-behavior anywhere', () => {
    expect(css).not.toMatch(/scroll-behavior/);
  });

  it("[lang='zh'] holds the exact Chinese font stack, equal to the Tailwind hanzi family", () => {
    const m = outside.match(/\[lang='zh'\]\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1].trim()).toBe(`font-family: ${STACK};`);
    const hanzi = (tailwind.theme.extend.fontFamily.hanzi as string[]).join(', ');
    expect(hanzi).toBe(STACK);
  });
});
