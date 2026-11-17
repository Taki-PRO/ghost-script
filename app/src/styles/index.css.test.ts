import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import tailwind from '../../tailwind.config';
import { contrastRatio, theme } from './theme';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const FALLBACK_STACK =
  '"PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Serif CJK SC", sans-serif';
const STACK = `"LXGW WenKai Subset", ${FALLBACK_STACK}`;

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
    expect(outside).not.toMatch(/(^|[\s;{])transition(-[a-z-]+)?\s*:/);
    for (const name of [
      'ghost-float', 'ghost-smoke', 'ghost-linger', 'ghost-slip', 'ghost-flinch',
      'seal-stamp', 'ink-reveal', 'tablet-glow', 'wisp-rise', 'mist-drift-a', 'mist-drift-b',
    ]) {
      expect(media.body).toContain(`@keyframes ${name}`);
    }
  });

  it('removes the old fade, flicker, drift and grave-flicker keyframes', () => {
    for (const name of ['ghost-fade', 'ghost-flicker', 'ghost-drift', 'grave-flicker']) {
      expect(css).not.toContain(name);
    }
  });

  it('lets a struggled ghost move to the right and stay at opacity 0.5 (Requirement 14.2)', () => {
    const k = blockAt(media.body, media.body.indexOf('@keyframes ghost-linger')).body;
    expect(k).toMatch(/to\s*\{[^}]*opacity:\s*0\.5;[^}]*translateX\(min\(36vw, 9rem\)\)/);
    const end = outside.match(/\[data-ghost-state='flickering'\] \.ghost-figure\s*\{([^}]*)\}/);
    expect(end![1]).toMatch(/opacity:\s*0\.5/);
    expect(end![1]).toMatch(/transform:\s*translateX\(min\(36vw, 9rem\)\)/);
    expect(media.body).toMatch(/\[data-ghost-state='flickering'\] \.ghost-figure\s*\{[^}]*ghost-linger 600ms[^}]*forwards/);
  });

  it('gives clean and gave-up ghosts a transparent end state', () => {
    expect(outside).toMatch(/\[data-ghost-state='faded'\] \.ghost-figure\s*\{[^}]*translateY\(-14px\)[^}]*blur\(2px\)/);
    expect(outside).toMatch(/\[data-ghost-state='drifted'\] \.ghost-figure\s*\{[^}]*translate\(16px, 12px\)/);
    expect(media.body).toMatch(/ghost-smoke 600ms/);
    expect(media.body).toMatch(/ghost-slip 600ms/);
  });

  describe('motion durations', () => {
    const AMBIENT = ['ghost-float', 'mist-drift-a', 'mist-drift-b', 'tablet-glow', 'wisp-rise'];
    const toMs = (v: string): number => (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000);
    /** Every animation of the CSS as { name, ms, infinite }. */
    const animations = (): Array<{ name: string; ms: number; infinite: boolean }> => {
      const out: Array<{ name: string; ms: number; infinite: boolean }> = [];
      for (const m of css.matchAll(/(?:^|[\s;{])animation\s*:\s*([^;}]+)[;}]/g)) {
        for (const part of m[1].split(',')) {
          const time = part.match(/(?:^|\s)(\d*\.?\d+(?:ms|s))(?=\s|$)/);
          const name = part.match(/(?:^|\s)((?:ghost|seal|ink|tablet|wisp|mist)-[a-z-]+)/);
          expect(time && name, part).toBeTruthy();
          out.push({ name: name![1], ms: toMs(time![1]), infinite: /\binfinite\b/.test(part) });
        }
      }
      return out;
    };

    it('has no animation-duration, animation-name or transition longhand to hide a duration', () => {
      expect(css).not.toMatch(/animation-(duration|name)/);
      expect(css).not.toMatch(/transition/);
    });

    it('runs every non-ambient animation between 200 ms and 600 ms', () => {
      const causal = animations().filter((a) => !AMBIENT.includes(a.name));
      expect([...new Set(causal.map((a) => a.name))].sort()).toEqual(
        ['ghost-flinch', 'ghost-linger', 'ghost-slip', 'ghost-smoke', 'ink-reveal', 'seal-stamp'].sort(),
      );
      for (const a of causal) {
        expect(a.ms, a.name).toBeGreaterThanOrEqual(200);
        expect(a.ms, a.name).toBeLessThanOrEqual(600);
        expect(a.infinite, a.name).toBe(false);
      }
      const byName = Object.fromEntries(causal.map((a) => [a.name, a.ms]));
      expect(byName).toMatchObject({
        'ghost-smoke': 600, 'ghost-linger': 600, 'ghost-slip': 600,
        'ghost-flinch': 400, 'seal-stamp': 300, 'ink-reveal': 600,
      });
    });

    it('lets only the named ambient animations run longer than 600 ms, and they loop', () => {
      const slow = animations().filter((a) => a.ms > 600);
      expect([...new Set(slow.map((a) => a.name))].sort()).toEqual([...AMBIENT].sort());
      for (const a of slow) expect(a.infinite, a.name).toBe(true);
    });

    it('uses every keyframe in an animation', () => {
      const used = new Set(animations().map((a) => a.name));
      for (const m of css.matchAll(/@keyframes\s+([\w-]+)/g)) expect(used.has(m[1]), m[1]).toBe(true);
    });
  });

  it('draws keycaps 44 px high in ink on paper, with the candle only as glow', () => {
    const cap = blockAt(css, css.indexOf('.keycap {')).body;
    expect(cap).toMatch(/min-height:\s*44px/);
    expect(cap).toMatch(/color:\s*var\(--ink-on-paper\)/);
    expect(cap).toContain('linear-gradient(180deg, #e9dfc6, #d4c8aa)');
    expect(cap).toContain('inset 0 1px 0 rgba(255, 250, 235, 0.6)');
    expect(cap).toContain('inset 0 -3px 0 rgba(60, 40, 20, 0.35)');
    expect(cap.match(/radial-gradient\(/g)).toHaveLength(2);
    expect(cap).not.toContain('--candle');
    const next = blockAt(css, css.indexOf('.keycap-next {')).body;
    expect(next).toMatch(/--tw-shadow:[^;]*var\(--candle\)/);
    expect(contrastRatio(theme.inkOnPaper, '#d4c8aa')).toBeGreaterThanOrEqual(4.5);
  });

  it('defines the tablet look, the rest glow and the restless wisp outside the media block', () => {
    for (const s of ['.tablet {', '.tablet-unmet {', '.tablet-rest {', '.tablet-rest::before {', '.tablet-restless::after {']) {
      expect(outside).toContain(s);
    }
    expect(outside).not.toMatch(/\.grave\b|\.grave-/);
    for (const s of ['.tablet-rest::before', '.tablet-restless::after']) {
      expect(blockAt(outside, outside.indexOf(`${s} {`)).body).toMatch(/pointer-events:\s*none/);
    }
    expect(media.body).toMatch(/\.tablet-rest::before\s*\{[^}]*tablet-glow/);
    expect(media.body).toMatch(/\.tablet-restless::after\s*\{[^}]*wisp-rise/);
  });

  it('tilts tablets by a static pattern and leaves never-met stone without a border', () => {
    const pattern = [-3, 1.5, 0, -1.5, 3];
    pattern.forEach((deg, n) => {
      const body = blockAt(outside, outside.indexOf(`.tablet-tilt-${n} {`)).body;
      expect(body).toMatch(new RegExp(`transform:\\s*rotate\\(${deg}deg\\)`));
      expect(body).toMatch(/transform-origin:\s*50% 100%/);
    });
    expect(media.body).not.toContain('tablet-tilt');
    const unmet = blockAt(outside, outside.indexOf('.tablet-unmet {')).body;
    expect(unmet).toMatch(/border:\s*0/);
    expect(unmet).toContain('#14161c');
    expect(unmet).not.toMatch(/dotted|dashed/);
    const tablet = blockAt(outside, outside.indexOf('.tablet {')).body;
    expect(tablet).toContain('border-radius: 50% 50% 3px 3px / 36% 36% 3px 3px');
    expect(tablet).toContain('linear-gradient(180deg, #2a2d36, #1d2028)');
  });

  it('keeps the legend wipe and the seal stamp animation inside the motion block only', () => {
    expect(media.body).toMatch(/\.ink-reveal\s*\{[^}]*ink-reveal 600ms/);
    expect(media.body).toMatch(/\.seal-stamp\s*\{[^}]*seal-stamp 300ms/);
    expect(outside).not.toMatch(/\.ink-reveal|\.seal-stamp/);
  });

  it('plays the Flinch for a nonzero count only while the ghost haunts', () => {
    expect(media.body).toMatch(
      /\[data-ghost-state='haunting'\]:not\(\[data-ghost-flinch='0'\]\) \.ghost-figure\s*\{[^}]*ghost-flinch 400ms/,
    );
  });

  it('palette variables equal theme.ts', () => {
    const pairs: Record<string, string> = {
      '--paper': theme.paper,
      '--ink-on-paper': theme.inkOnPaper,
      '--drawing': theme.drawing,
      '--seal': theme.seal,
      '--grid-line': theme.gridLine,
      '--ink': theme.ink,
      '--ghost': theme.ghost,
      '--error': theme.error,
      '--paper-label': theme.paperLabel,
      '--seal-light': theme.sealLight,
      '--success': theme.success,
      '--hint-ink': theme.hintInk,
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
    for (const c of ['.tablet-unmet', '.tablet-rest', '.tablet-restless']) expect(outside).toContain(c);
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
      expect(outside).toContain(`rgb(${mr} ${mg} ${mb} / var(--mist-a-alpha))`);
      expect(outside).toContain(`rgb(${mr} ${mg} ${mb} / var(--mist-b-alpha))`);
      expect(outside).not.toContain('--mist-peak-alpha');
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

    it('draws every focus ring in aged paper with a candle glow', () => {
      const body = ruleBody('*:focus-visible');
      expect(body).toMatch(/--tw-ring-color:\s*var\(--ink\)\s*!important/);
      expect(body).not.toMatch(/--tw-ring-color:\s*var\(--candle\)/);
      expect(body).toMatch(/--tw-shadow:[^;]*var\(--candle\)/);
      expect(theme.ink).toBe('#ece6d6');
      expect(contrastRatio(theme.ink, theme.background)).toBeGreaterThanOrEqual(3);
    });

    it('uses the candle only inside box-shadow and gradient values', () => {
      const uses = [...outside.matchAll(/([\w-]+)\s*:\s*([^;{}]*var\(--candle\)[^;{}]*);/g)];
      expect(uses.length).toBeGreaterThan(0);
      for (const [, prop, value] of uses) {
        const ok = ['box-shadow', '--tw-shadow'].includes(prop) || /gradient\(/.test(value);
        expect(ok, `${prop}: ${value}`).toBe(true);
      }
      expect(css).not.toMatch(/(?:^|[;{\s])(?:color|background-color|border(?:-[a-z]+)?-color|fill|stroke)\s*:\s*var\(--candle\)/);
    });

    it('defines .slip, .slip-primary and .card-slip at least 44 px high where they are buttons', () => {
      expect(css).toMatch(/@layer components\s*\{/);
      const slip = blockAt(css, css.indexOf('.slip {')).body;
      expect(slip).toMatch(/min-height:\s*44px/);
      expect(slip).toMatch(/color:\s*var\(--ink-on-paper\)/);
      const primary = blockAt(css, css.indexOf('.slip-primary {')).body;
      expect(primary).toMatch(/min-height:\s*44px/);
      expect(primary).toMatch(/background-color:\s*var\(--seal\)/);
      expect(primary).toMatch(/color:\s*var\(--paper-label\)/);
      expect(primary).toMatch(/border:\s*1px solid var\(--paper\)/);
      expect(primary).toMatch(/box-shadow:[^;]*var\(--candle\)/);
      expect(blockAt(css, css.indexOf('.card-slip {')).body).toMatch(/background-color:\s*var\(--paper\)/);
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

    /** Vertical extents (percent of height) of the ellipses of each mist band, by layer. */
    const bandExtents = (sel: string): Array<[number, number]> =>
      [...ruleBody(sel).matchAll(/ellipse (\d+)% (\d+)% at \d+% (\d+)%/g)].map((m) => {
        const ry = parseFloat(m[2]);
        const cy = parseFloat(m[3]);
        return [cy - 0.7 * ry, cy + 0.7 * ry];
      });
    const bandCentre = (sel: string): number => {
      const c = [...ruleBody(sel).matchAll(/ellipse \d+% \d+% at \d+% (\d+)%/g)].map((m) => parseFloat(m[1]));
      expect(new Set(c).size, sel).toBe(1);
      return c[0];
    };
    // Sky colour at a height: top to mid over 0 to 55%, mid to low over 55 to 100%.
    const sky = (y: number): number[] =>
      y <= 55
        ? blend(rgb(theme.nightTop), rgb(theme.nightMid), y / 55)
        : blend(rgb(theme.nightMid), rgb(theme.nightLow), (y - 55) / 45);
    // The grain tint and alpha come from the feColorMatrix in body::before. Its alpha is
    // scaled by the noise (at most 1), so the matrix alpha is the worst case.
    const grainLayer = (bg: number[]): number[] => {
      const grain = ruleBody('body::before').match(/values='0 0 0 0 ([\d.]+) 0 0 0 0 ([\d.]+) 0 0 0 0 ([\d.]+) 0 0 0 (0\.\d+) 0'/);
      expect(grain).not.toBeNull();
      return blend(bg, [1, 2, 3].map((n) => Math.round(parseFloat(grain![n]) * 255)), parseFloat(grain![4]));
    };
    const ratioOn = (token: string, bg: number[]): number => {
      const fl = lum(rgb(theme[token as 'ink']));
      return (Math.max(fl, lum(bg)) + 0.05) / (Math.min(fl, lum(bg)) + 0.05);
    };
    const TEXT = ['ink', 'muted', 'ghost', 'success', 'error'];
    // The vignette only darkens, so it cannot lower contrast for light text; it is left out.
    const bandBg = (sel: string, alphaVar: string): number[] =>
      grainLayer(blend(sky(bandCentre(sel)), rgb(theme.mist), parseFloat(varValue(alphaVar))));
    const haloBg = (): number[] =>
      grainLayer(blend(sky(10), rgb(theme.moon), parseFloat(varValue('--moon-halo-alpha'))));
    // Disc composite in paint order: sky at 2%, the halo under the disc, the disc, then the grain.
    const discBg = (): number[] =>
      grainLayer(
        blend(
          blend(sky(2), rgb(theme.moon), parseFloat(varValue('--moon-halo-alpha'))),
          rgb(theme.moon),
          parseFloat(varValue('--moon-disc-alpha')),
        ),
      );

    it('the two mist bands never overlap vertically and lie in the lower third', () => {
      const a = bandExtents('body::after');
      const b = bandExtents('#root::before');
      expect(a).toHaveLength(2);
      expect(b).toHaveLength(2);
      const [aLo, aHi] = [Math.min(...a.map((e) => e[0])), Math.max(...a.map((e) => e[1]))];
      const [bLo, bHi] = [Math.min(...b.map((e) => e[0])), Math.max(...b.map((e) => e[1]))];
      expect(bLo).toBeGreaterThanOrEqual(66.6);
      expect(aLo).toBeGreaterThanOrEqual(66.6);
      expect(aLo).toBeGreaterThan(bHi);
      expect(bLo).toBeLessThan(bHi);
      expect(aHi).toBeLessThanOrEqual(100);
      expect(bandCentre('body::after')).toBe(88);
      expect(bandCentre('#root::before')).toBe(72);
    });

    it('has band A at 0.18, band B at 0.10 and A at least 1.5 times B', () => {
      expect(parseFloat(varValue('--mist-a-alpha'))).toBe(0.18);
      expect(parseFloat(varValue('--mist-b-alpha'))).toBe(0.1);
      expect(parseFloat(varValue('--mist-a-alpha'))).toBeGreaterThanOrEqual(1.5 * parseFloat(varValue('--mist-b-alpha')));
      expect(ruleBody('body::after')).toContain('var(--mist-a-alpha)');
      expect(ruleBody('#root::before')).toContain('var(--mist-b-alpha)');
    });

    it('text tokens keep 4.5:1 on band A at 88%, band B at 72% and the halo composite', () => {
      const cases: Array<[string, number[]]> = [
        ['band A', bandBg('body::after', '--mist-a-alpha')],
        ['band B', bandBg('#root::before', '--mist-b-alpha')],
        ['halo', haloBg()],
      ];
      for (const [name, bg] of cases) {
        for (const t of TEXT) expect(ratioOn(t, bg), `${t} on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('keeps ink and error at 4.5:1 on the disc composite', () => {
      for (const t of ['ink', 'error']) expect(ratioOn(t, discBg()), t).toBeGreaterThanOrEqual(4.5);
    });

    it('sizes the moon from custom properties, a full disc inside the viewport', () => {
      const rem = (name: string): number => {
        const v = varValue(name);
        expect(v, name).toMatch(/^[\d.]+rem$/);
        return parseFloat(v);
      };
      expect(rem('--moon-size')).toBeGreaterThanOrEqual(4);
      expect(rem('--moon-inset-x')).toBeGreaterThanOrEqual(rem('--moon-size') / 2);
      expect(rem('--moon-inset-y')).toBeGreaterThanOrEqual(rem('--moon-size') / 2);
      const body = ruleBody('body::before');
      expect(body).toContain('circle calc(var(--moon-size) / 2) at calc(100% - var(--moon-inset-x)) var(--moon-inset-y)');
      expect(body).toContain('circle 7rem at calc(100% - var(--moon-inset-x)) var(--moon-inset-y)');
      expect(body).not.toMatch(/at 82% 0%/);
    });

    it('leaves a Moon_Room below 992 px with a clamp() and no media rule', () => {
      const room = varValue('--moon-room');
      expect(room).toContain('clamp(');
      expect(room).toContain('992px');
      expect(room).toContain('4.75rem');
      expect(ruleBody('#root')).toMatch(/padding-top:\s*var\(--moon-room\)/);
      expect(ruleBody('#root > main')).toMatch(/min-height:\s*calc\(100vh - var\(--moon-room\)\)/);
      expect(ruleBody('#root > main')).toMatch(/min-height:\s*calc\(100dvh - var\(--moon-room\)\)/);
      expect(ruleBody('.sticky-below-moon')).toMatch(/top:\s*var\(--moon-room\)/);
      expect(css.match(/@media/g)).toHaveLength(1);
    });

    it('drops the Moon_Room for the compact séance shell only (design fallback)', () => {
      expect(ruleBody('#root:has(> main.no-moon-room)')).toMatch(/padding-top:\s*0;/);
      const main = ruleBody('#root > main.no-moon-room');
      expect(main).toMatch(/min-height:\s*100vh;/);
      expect(main).toMatch(/min-height:\s*100dvh;/);
    });

    it('layers the night scene: sky, moon disc and halo, vignette, grain on body::before', () => {
      const body = ruleBody('body::before');
      expect(body).toContain('var(--night-top)');
      expect(body).toContain('var(--moon-disc-alpha)');
      expect(body).toContain('var(--moon-halo-alpha)');
      expect(body).toContain('var(--vignette-alpha)');
      expect(body).toContain('feTurbulence');
      expect(body).toMatch(/position:\s*fixed/);
    });

    it('keeps the moon halo peak at or below 0.10 and the disc brighter than the halo', () => {
      expect(parseFloat(varValue('--moon-halo-alpha'))).toBeLessThanOrEqual(0.1);
      expect(parseFloat(varValue('--moon-peak-alpha'))).toBeLessThanOrEqual(0.1);
      expect(parseFloat(varValue('--moon-disc-alpha'))).toBe(0.65);
      expect(parseFloat(varValue('--moon-disc-alpha'))).toBeGreaterThan(parseFloat(varValue('--moon-halo-alpha')));
    });

    it('uses no image file and adds no DOM rule for the scene', () => {
      const stripped = css.replace(/url\("data:[^"]*"\)/g, 'DATA');
      expect(stripped).not.toMatch(/url\(/);
      expect(stripped).not.toMatch(/\.(png|jpe?g|webp|gif)\b/);
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

  it("[lang='zh'] holds the WenKai font first and the system stack after it, equal to the Tailwind hanzi family", () => {
    const m = outside.match(/\[lang='zh'\]\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1].trim()).toBe(`font-family: ${STACK};`);
    expect(m![1]).toContain(FALLBACK_STACK);
    const hanzi = (tailwind.theme.extend.fontFamily.hanzi as string[]).join(', ');
    expect(hanzi).toBe(STACK);
  });

  describe('fonts.css', () => {
    const fonts = readFileSync(join(here, 'fonts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    it('has exactly one url(), the bundled WenKai subset', () => {
      expect(fonts.match(/url\(/g)).toHaveLength(1);
      expect(fonts).toContain('url("../assets/fonts/lxgw-wenkai-subset.woff2") format("woff2")');
    });

    it('declares the WenKai family with swap and has no media block', () => {
      expect(fonts).toContain('font-family: "LXGW WenKai Subset"');
      expect(fonts).toContain('font-display: swap');
      expect(fonts).not.toContain('@media');
    });
  });
});
