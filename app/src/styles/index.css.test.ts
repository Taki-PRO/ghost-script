import { readFileSync, readdirSync, statSync } from 'node:fs';
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

/** The CSS with every top-level @media block removed. */
function withoutMediaBlocks(text: string): string {
  let out = text;
  for (let i = out.indexOf('@media'); i > -1; i = out.indexOf('@media')) {
    out = out.slice(0, i) + out.slice(blockAt(out, i).end);
  }
  return out;
}

describe('index.css', () => {
  it('has exactly one no-preference block and no other media block', () => {
    expect(mediaStart).toBeGreaterThan(-1);
    const conditions = [...css.matchAll(/@media\s*([^{]*)\{/g)].map((m) => m[1].trim().replace(/\s+/g, ' '));
    // Night-polish Requirement 6 AC 7: (hover: hover) appears twice, once for the static hover
    // states and once nested in the Motion_Block. Any other condition still fails.
    expect(conditions.sort()).toEqual(
      [
        '(hover: hover)',
        '(hover: hover)',
        '(hover: hover) and (pointer: fine)',
        '(prefers-reduced-motion: no-preference)',
      ].sort(),
    );
  });

  it('has animations and keyframes only inside the no-preference block', () => {
    expect(outside).not.toMatch(/@keyframes/);
    expect(outside).not.toMatch(/(^|[\s;{])animation(-[a-z-]+)?\s*:/);
    expect(outside).not.toMatch(/(^|[\s;{])transition(-[a-z-]+)?\s*:/);
    for (const name of [
      'ghost-float', 'ghost-smoke', 'ghost-linger', 'ghost-slip', 'ghost-flinch',
      'seal-stamp', 'ink-reveal', 'tablet-glow', 'wisp-rise', 'mist-drift-a', 'mist-drift-b', 'grain-fall',
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
    const AMBIENT = ['ghost-float', 'mist-drift-a', 'mist-drift-b', 'tablet-glow', 'wisp-rise', 'grain-fall'];
    const toMs = (v: string): number => (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000);
    /** Every animation of the CSS as { name, ms, infinite }. */
    const animations = (): Array<{ name: string; ms: number; infinite: boolean }> => {
      const out: Array<{ name: string; ms: number; infinite: boolean }> = [];
      for (const m of css.matchAll(/(?:^|[\s;{])animation\s*:\s*([^;}]+)[;}]/g)) {
        for (const part of m[1].split(',')) {
          const time = part.match(/(?:^|\s)(\d*\.?\d+(?:ms|s))(?=\s|$)/);
          const name = part.match(/(?:^|\s)((?:ghost|seal|ink|tablet|wisp|mist|grain)-[a-z-]+)/);
          expect(time && name, part).toBeTruthy();
          out.push({ name: name![1], ms: toMs(time![1]), infinite: /\binfinite\b/.test(part) });
        }
      }
      return out;
    };

    it('has no animation-duration, animation-name or transition longhand to hide a duration', () => {
      expect(css).not.toMatch(/animation-(duration|name)/);
      // Night-polish Requirement 6 AC 5: transitions exist only in the Motion_Block, as shorthands
      // of 200 ms. Outside the block the word is banned everywhere, and no longhand exists anywhere.
      expect(outside).not.toMatch(/transition/);
      expect(css).not.toMatch(/transition-/);
      const declarations = [...media.body.matchAll(/(?:^|[\s;{])transition\s*:\s*([^;}]+)[;}]/g)];
      expect(declarations.length).toBeGreaterThan(0);
      expect(media.body.match(/transition/g)!.length).toBe(declarations.length);
      for (const d of declarations) {
        const entries = d[1].split(',').map((e) => e.trim());
        for (const entry of entries) expect(entry, entry).toMatch(/(?:^|\s)200ms(?:\s|$)/);
      }
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

  it('keeps the legend ink-in transitions in the motion block and its inked end state static', () => {
    expect(media.body).toMatch(/\.legend-text\s*\{[^}]*transition:\s*color 200ms/);
    expect(media.body).toMatch(/\.legend-ink\s*\{[^}]*transition:\s*opacity 200ms/);
    expect(media.body).toMatch(
      /\[data-legend-phase='loading'\] \.legend-text,\s*\[data-legend-phase='ink'\] \.legend-text\s*\{[^}]*color:\s*transparent/,
    );
    expect(outside).not.toMatch(/\.legend-text/);
    expect(outside).not.toMatch(/data-legend-phase/);
    expect(outside).toMatch(/\[data-legend-state='inked'\] \.legend-ink\s*\{[^}]*opacity:\s*0/);
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
      expect(varValue('--sky-hold')).toBe(theme.skyHold);
      expect(varValue('--mist')).toBe(theme.mist);
      expect(varValue('--moon')).toBe(theme.moon);
      expect(varValue('--candle')).toBe(theme.candle);
    });

    it('--grass equals theme.grass', () => {
      expect(varValue('--grass')).toBe(theme.grass);
    });

    it('mist and moon channel triples equal their hex', () => {
      const [mr, mg, mb] = rgb(theme.mist);
      expect(outside).toContain(`rgb(${mr} ${mg} ${mb} / var(--mist-a-alpha))`);
      expect(outside).toContain(`rgb(${mr} ${mg} ${mb} / var(--mist-b-alpha))`);
      expect(outside).not.toContain('--mist-peak-alpha');
      const [or, og, ob] = rgb(theme.moon);
      expect(outside).toContain(`rgb(${or} ${og} ${ob} / var(--moon-peak-alpha))`);
      expect(outside).not.toMatch(/rgb\((?!91 111 154|114 131 171|236 230 214|10 17 38|5 8 19 \/ var\(--moon-shade-alpha\))\d+ \d+ \d+ \/ var\(--(mist|moon)/);
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
      for (const s of ['body::before', 'body::after', '#root::before', '#root::after', '.moon-glow::before', '.sky-cap']) {
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
      // Night-polish Requirement 6 AC 20: the fill and the border moved to the masked inner layer.
      const inner = blockAt(css, css.search(/\}\s*\.slip-primary::before \{/)).body;
      expect(inner).toMatch(/background-color:\s*var\(--seal\)/);
      expect(inner).toMatch(/border:\s*1px solid var\(--paper\)/);
      expect(primary).toMatch(/border:\s*1px solid transparent/);
      expect(primary).toMatch(/color:\s*var\(--paper-label\)/);
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
    // Sky colour at a height within the first screen: top to mid over 0 to 55%,
    // mid to skyHold over 55 to 88%, skyHold from 88% down (and below the first screen).
    const sky = (y: number): number[] =>
      y <= 55
        ? blend(rgb(theme.nightTop), rgb(theme.nightMid), y / 55)
        : y <= 88
          ? blend(rgb(theme.nightMid), rgb(theme.skyHold), (y - 55) / 33)
          : rgb(theme.skyHold);
    // The grain tint and alpha come from the feColorMatrix in #root::after. Its alpha is
    // scaled by the noise (at most 1), so the matrix alpha is the worst case.
    const grainLayer = (bg: number[]): number[] => {
      const grain = ruleBody('#root::after').match(/values='0 0 0 0 ([\d.]+) 0 0 0 0 ([\d.]+) 0 0 0 0 ([\d.]+) 0 0 0 (0\.\d+) 0'/);
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
      grainLayer(blend(sky(10), rgb(theme.ink), parseFloat(varValue('--moon-halo-alpha'))));
    // Disc composite in paint order: sky at 2%, the halo under the disc, the disc, then the grain.
    const discBg = (): number[] =>
      grainLayer(
        blend(
          blend(sky(2), rgb(theme.ink), parseFloat(varValue('--moon-halo-alpha'))),
          rgb(theme.ink),
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

    it('keeps every text token at 4.5:1 on the held sky below the first screen, with grain', () => {
      for (const t of TEXT) expect(ratioOn(t, grainLayer(sky(100))), t).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps all five text tokens at 4.5:1 on the glow ring, the brightest glow outside the disc', () => {
      // The glow is a linear gradient from the peak alpha at the centre to 0 at 7 rem; at the disc edge
      // (size / 2 from the centre) its alpha is peak x (1 - size / 2 / 7). Paint order: sky, glow, grain.
      const rem = (name: string): number => parseFloat(varValue(name));
      const edgeAlpha = parseFloat(varValue('--moon-halo-alpha')) * (1 - rem('--moon-size') / 2 / 7);
      const ring = grainLayer(blend(sky(2), rgb(theme.ink), edgeAlpha));
      for (const t of TEXT) expect(ratioOn(t, ring), `${t} on the glow ring`).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps text off the disc: the Moon_Room clears the disc and no e2e Moon screen is missing', () => {
      // Unit part: below 992 px #root pads its top by --moon-room, which reaches past the disc bottom.
      const rem = (name: string): number => parseFloat(varValue(name));
      const room = varValue('--moon-room').match(/,\s*([\d.]+)rem\)$/);
      expect(room).not.toBeNull();
      expect(parseFloat(room![1])).toBeGreaterThanOrEqual(rem('--moon-inset-y') + rem('--moon-size') / 2);
      expect(ruleBody('#root')).toMatch(/padding-top:\s*var\(--moon-room\)/);
      expect(ruleBody('.sticky-below-moon')).toMatch(/top:\s*var\(--moon-room\)/);
    });

    describe('moonIntruders coverage in e2e/screenshots.spec.ts (replaces the two disc-contrast tests)', () => {
      const spec = readFileSync(join(here, '..', '..', '..', 'e2e', 'screenshots.spec.ts'), 'utf8');
      const calls = (): string[] => [...spec.matchAll(/expectMoonInside\(page, '([^']+)'\)/g)].map((m) => m[1]);
      // 375 x 812 views run in the VIEWPORTS loop (labels without a width); 320 x 640 views carry ' 320'.
      const AT_375 = ['intro', 'summon', 'write', 'graveyard'];
      const AT_320 = ['intro 320', 'summon 320', 'graveyard 320'];
      const ADDED_IN_6_3_375 = ['sources', 'summary'];
      const ADDED_IN_6_3_320 = ['sources 320', 'summary 320'];

      it('calls expectMoonInside for the screens already covered', () => {
        for (const view of [...AT_375, ...AT_320]) expect(calls(), view).toContain(view);
        expect(spec).toContain('const VIEWPORTS = [');
        expect(spec).toMatch(/\{ width: 375, height: 812 \}/);
        expect(spec).toMatch(/viewport: \{ width: 320, height: 640 \}/);
      });

      it('calls expectMoonInside for Sources & licences and Summary at 375 and 320 (task 6.3)', () => {
        for (const view of [...ADDED_IN_6_3_375, ...ADDED_IN_6_3_320]) expect(calls(), view).toContain(view);
      });
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

    describe('Moon_Shade', () => {
      const remOf = (name: string): number => {
        const v = varValue(name);
        expect(v, name).toMatch(/^[\d.]+rem$/);
        return parseFloat(v);
      };
      // Shade colour is the nightTop ink (5 8 19); paint order: sky at 2%, halo, disc, shade, grain.
      const underShade = (): number[] =>
        blend(
          blend(sky(2), rgb(theme.ink), parseFloat(varValue('--moon-halo-alpha'))),
          rgb(theme.ink),
          parseFloat(varValue('--moon-disc-alpha')),
        );
      const darkestBg = (): number[] =>
        grainLayer(blend(underShade(), rgb(theme.nightTop), parseFloat(varValue('--moon-shade-alpha'))));

      it('defines the three shade properties', () => {
        expect(parseFloat(varValue('--moon-shade-alpha'))).toBe(0.35);
        expect(remOf('--moon-shade-offset')).toBe(0.5);
        expect(remOf('--moon-shade-radius')).toBe(1.25);
        expect(rgb(theme.nightTop)).toEqual([5, 8, 19]);
      });

      it('is the first layer of body::before, above the disc, off-centre to the lower right', () => {
        const body = ruleBody('body::before');
        const shade =
          'radial-gradient(circle var(--moon-shade-radius) at calc(100% - var(--moon-inset-x) + var(--moon-shade-offset)) calc(var(--moon-inset-y) + var(--moon-shade-offset)), rgb(5 8 19 / var(--moon-shade-alpha)) 0, transparent 100%)';
        const bg = body.slice(body.indexOf('background:') + 'background:'.length).trim();
        expect(bg.startsWith(shade)).toBe(true);
        expect(body.indexOf(shade)).toBeLessThan(body.indexOf('var(--moon-disc-alpha)'));
        expect(body.match(/var\(--moon-shade-alpha\)/g)).toHaveLength(1);
      });

      it('stays inside the disc: offset x sqrt(2) + radius is at most half the moon size', () => {
        expect(remOf('--moon-shade-offset') * Math.SQRT2 + remOf('--moon-shade-radius')).toBeLessThanOrEqual(
          remOf('--moon-size') / 2,
        );
      });

      it('shades visibly: lightest to darkest luminance ratio is at least 1.25', () => {
        const ratio = (lum(discBg()) + 0.05) / (lum(darkestBg()) + 0.05);
        expect(ratio).toBeGreaterThanOrEqual(1.25);
      });
    });

    describe('moon', () => {
      const rem = (name: string): number => {
        const v = varValue(name);
        expect(v, name).toMatch(/^[\d.]+rem$/);
        return parseFloat(v);
      };
      /** The maria: ellipse gradients of body::before with their offsets from the disc centre, in rem. */
      const maria = (): Array<{ rx: number; ry: number; dx: number; dy: number; layer: string }> =>
        [...ruleBody('body::before').matchAll(/radial-gradient\(ellipse ([\d.]+)rem ([\d.]+)rem at calc\(100% - var\(--moon-inset-x\) ([-+]) ([\d.]+)rem\) calc\(var\(--moon-inset-y\) ([-+]) ([\d.]+)rem\), [^)]*\)[^)]*\)/g)].map((m) => ({
          rx: parseFloat(m[1]),
          ry: parseFloat(m[2]),
          // The centre x is `100% - inset-x <sign> d`, so d is the signed offset from the disc centre.
          dx: (m[3] === '+' ? 1 : -1) * parseFloat(m[4]),
          dy: (m[5] === '+' ? 1 : -1) * parseFloat(m[6]),
          layer: m[0],
        }));
      // Lit point: the disc over the glow, without shade or mare, then the grain.
      const litBg = (): number[] => discBg();
      const underMare = (): number[] =>
        blend(
          blend(sky(2), rgb(theme.ink), parseFloat(varValue('--moon-halo-alpha'))),
          rgb(theme.ink),
          parseFloat(varValue('--moon-disc-alpha')),
        );

      it('has a warm lit point: red above blue, brighter than the old cool disc', () => {
        const lit = litBg();
        expect(lit[0]).toBeGreaterThan(lit[2]);
        const oldDisc = grainLayer(
          blend(blend(sky(2), rgb(theme.moon), 0.1), rgb(theme.moon), 0.65),
        );
        expect(lum(lit)).toBeGreaterThan(0.1187);
        expect(lum(lit)).toBeGreaterThan(lum(oldDisc));
      });

      it('has three to four maria in nightMid, each inside the disc and darker than the lit point', () => {
        const list = maria();
        expect(list.length).toBeGreaterThanOrEqual(3);
        expect(list.length).toBeLessThanOrEqual(4);
        expect(ruleBody('body::before').match(/rgb\(10 17 38 \/ var\(--moon-mare-alpha\)\)/g)).toHaveLength(list.length);
        expect(rgb(theme.nightMid)).toEqual([10, 17, 38]);
        const mareAlpha = parseFloat(varValue('--moon-mare-alpha'));
        const mare = grainLayer(blend(underMare(), rgb(theme.nightMid), mareAlpha));
        expect(lum(mare)).toBeLessThan(lum(litBg()));
        for (const m of list) {
          expect(Math.hypot(m.dx, m.dy) + Math.max(m.rx, m.ry), m.layer).toBeLessThanOrEqual(rem('--moon-size') / 2 - 0.2);
        }
      });

      it('has a glow of peak alpha at most 0.10 and radius 7 rem falling to transparent', () => {
        expect(parseFloat(varValue('--moon-halo-alpha'))).toBeLessThanOrEqual(0.1);
        const bg = ruleBody('body::before');
        expect(bg).toContain(
          'radial-gradient(circle 7rem at calc(100% - var(--moon-inset-x)) var(--moon-inset-y), rgb(236 230 214 / var(--moon-halo-alpha)) 0, transparent 100%)',
        );
        expect(rgb(theme.ink)).toEqual([236, 230, 214]);
      });

      it('has no flat candle fill, no animation and no transition in body::before', () => {
        const body = ruleBody('body::before');
        expect(body).not.toContain('--candle');
        expect(body).not.toMatch(/animation|transition/);
      });
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
      expect(css.match(/@media[^{]*\{/g)!.join('\n')).not.toContain('992px');
      // The Moon_Room rules sit at the top level, not inside any @media block.
      const topLevelCss = withoutMediaBlocks(css);
      for (const selector of ['#root', '#root > main', '.sticky-below-moon']) {
        expect(topLevelCss, selector).toContain(`${selector} {`);
      }
    });

    it('drops the Moon_Room for the compact séance shell only (design fallback)', () => {
      expect(ruleBody('#root:has(> main.no-moon-room)')).toMatch(/padding-top:\s*0;/);
      const main = ruleBody('#root > main.no-moon-room');
      expect(main).toMatch(/min-height:\s*100vh;/);
      expect(main).toMatch(/min-height:\s*100dvh;/);
    });

    it('keeps only the Moon disc and halo on the fixed body::before', () => {
      const body = ruleBody('body::before');
      expect(body).toMatch(/position:\s*fixed/);
      expect(body).toContain('var(--moon-disc-alpha)');
      expect(body).toContain('var(--moon-halo-alpha)');
      expect(body).not.toContain('linear-gradient(180deg');
      expect(body).not.toContain('var(--night-top)');
      expect(body).not.toContain('var(--vignette-alpha)');
      expect(body).not.toContain('feTurbulence');
      expect(body).not.toMatch(/url\(/);
    });

    it('paints the Canvas_Sky on html and leaves the body without a background (24.1)', () => {
      const html = [...outside.matchAll(/(?:^|\n)html\s*\{([^}]*)\}/g)].map((m) => m[1]).join('\n');
      expect(html).toMatch(/background-color:\s*var\(--sky-hold\)/);
      expect(html).toContain(
        'linear-gradient(180deg, var(--night-top) 0%, var(--night-mid) 55%, var(--sky-hold) 88%, var(--sky-hold) 100%)',
      );
      expect(html).toMatch(/background-size:\s*100% 100vh/);
      expect(html).toMatch(/background-repeat:\s*no-repeat/);
      expect(html.match(/linear-gradient\(/g)).toHaveLength(1);
      const base = blockAt(css, css.indexOf('@layer base')).body;
      const body = blockAt(base, base.indexOf('body {')).body;
      expect(body).not.toMatch(/bg-background|background/);
    });

    it('draws grain over vignette on #root::after, absolute and page-high (24.3)', () => {
      const body = ruleBody('#root::after');
      expect(body).toMatch(/position:\s*absolute/);
      expect(body).toMatch(/top:\s*0;/);
      expect(body).toMatch(/bottom:\s*0;/);
      expect(body).toMatch(/left:\s*0;/);
      expect(body).toMatch(/right:\s*0;/);
      expect(body).toMatch(/z-index:\s*-1/);
      expect(body).toMatch(/pointer-events:\s*none/);
      expect(body.indexOf('feTurbulence')).toBeGreaterThan(-1);
      expect(body.indexOf('feTurbulence')).toBeLessThan(body.indexOf('var(--vignette-alpha)'));
    });

    it('makes both mist layers absolute and repeating once per screen-high tile (24.4)', () => {
      for (const sel of ['body::after', '#root::before']) {
        const body = ruleBody(sel);
        expect(body, sel).toMatch(/position:\s*absolute/);
        expect(body, sel).not.toMatch(/position:\s*fixed/);
        expect(body, sel).toMatch(/top:\s*0;/);
        expect(body, sel).toMatch(/bottom:\s*0;/);
        expect(body, sel).toMatch(/width:\s*200%/);
        expect(body, sel).toMatch(/background-size:\s*100% 100vh/);
        expect(body, sel).toMatch(/background-repeat:\s*repeat-y/);
      }
    });

    it('clips horizontal overflow on the body, with a hidden fallback before it (24.4)', () => {
      const base = blockAt(css, css.indexOf('@layer base')).body;
      const body = blockAt(base, base.indexOf('body {')).body;
      expect(body).toMatch(/position:\s*relative/);
      expect(body).toMatch(/overflow-x:\s*hidden;\s*overflow-x:\s*clip;/);
      // A non-visible html overflow keeps the body value from moving to the viewport,
      // so the body clips the 200% layers and the document width stays the viewport width.
      const html = blockAt(base, base.indexOf('html {')).body;
      expect(html).toMatch(/overflow-x:\s*hidden;\s*overflow-x:\s*clip;/);
    });

    it('sets no will-change on a Document_Layer (24.4)', () => {
      expect(css).not.toContain('will-change');
    });

    it('keeps the moon halo peak at or below 0.10 and the disc brighter than the halo', () => {
      expect(parseFloat(varValue('--moon-halo-alpha'))).toBeLessThanOrEqual(0.1);
      expect(parseFloat(varValue('--moon-peak-alpha'))).toBeLessThanOrEqual(0.1);
      expect(parseFloat(varValue('--moon-disc-alpha'))).toBe(0.8);
      expect(parseFloat(varValue('--moon-disc-alpha'))).toBeGreaterThan(parseFloat(varValue('--moon-halo-alpha')));
    });

    it('uses no image file and adds no DOM rule for the scene', () => {
      const stripped = css.replace(/url\("data:[^"]*"\)/g, 'DATA');
      expect(stripped).not.toMatch(/url\(/);
      expect(stripped).not.toMatch(/\.(png|jpe?g|webp|gif)\b/);
    });
  });

  describe('sky cap', () => {
    const rule = (selector: string): string => {
      const i = outside.indexOf(`${selector} {`);
      expect(i, selector).toBeGreaterThan(-1);
      return blockAt(outside, i).body;
    };
    const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
    const bgList = (body: string): string => {
      const m = body.match(/background(?:-image)?:\s*([^;]+);/);
      expect(m).not.toBeNull();
      return squash(m![1]);
    };
    /** Splits a CSS list at top-level commas (not inside parentheses or quotes). */
    const topLevel = (list: string): string[] => {
      const out: string[] = [];
      let depth = 0;
      let quote = '';
      let start = 0;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (quote) {
          if (c === quote) quote = '';
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (c === ',' && depth === 0) {
          out.push(list.slice(start, i).trim());
          start = i + 1;
        }
      }
      out.push(list.slice(start).trim());
      return out;
    };
    const cap = (): string => rule('.sky-cap');
    const headerZ = (file: string): number => {
      const src = readFileSync(join(here, '..', 'components', file), 'utf8');
      const m = src.match(/<header className="[^"]*\bz-(\d+)\b/);
      expect(m, file).not.toBeNull();
      return parseInt(m![1], 10);
    };

    it('is a fixed, full-width, click-through layer as high as the Moon_Room', () => {
      const body = cap();
      expect(body).toMatch(/position:\s*fixed/);
      expect(body).toMatch(/top:\s*0;/);
      expect(body).toMatch(/left:\s*0;/);
      expect(body).toMatch(/right:\s*0;/);
      expect(body).toMatch(/height:\s*var\(--moon-room\)/);
      expect(body).toMatch(/pointer-events:\s*none/);
      expect(body).not.toMatch(/width:\s*100vw/);
    });

    it('lies above the content and below the sticky headers', () => {
      const z = parseInt(cap().match(/z-index:\s*(\d+)/)![1], 10);
      expect(z).toBeGreaterThan(0);
      expect(headerZ('Graveyard.tsx')).toBe(20);
      expect(headerZ('Credits.tsx')).toBe(20);
      expect(z).toBeLessThan(headerZ('Graveyard.tsx'));
      expect(z).toBeLessThan(headerZ('Credits.tsx'));
    });

    it('adds no media rule for the cap and hides it on the séance shell only', () => {
      expect(outside).not.toMatch(/@media[^{]*\{[^}]*sky-cap/);
      expect(outside).toMatch(/#root:has\(> main\.no-moon-room\) > \.sky-cap\s*\{\s*display:\s*none;\s*\}/);
    });

    it('repeats the Moon layers of body::before verbatim, in the same order', () => {
      const moon = topLevel(bgList(rule('body::before')));
      expect(moon.length).toBeGreaterThanOrEqual(3);
      const layers = topLevel(bgList(cap()));
      const at = layers.indexOf(moon[0]);
      expect(at).toBeGreaterThan(-1);
      expect(layers.slice(at, at + moon.length)).toEqual(moon);
    });

    it('repeats the grain URL of #root::after and the sky gradient of html verbatim', () => {
      const grain = topLevel(bgList(rule('#root::after'))).find((l) => l.startsWith('url('));
      expect(grain).toBeDefined();
      const layers = topLevel(bgList(cap()));
      expect(layers).toContain(grain);
      const html = outside.match(/(?:^|\n)html\s*\{([^}]*)\}/)![1];
      const sky = squash(html.match(/background-image:\s*([^;]+);/)![1]);
      expect(layers).toContain(sky);
      expect(layers[layers.length - 1]).toBe(sky);
    });

    it('has one background-size and one background-repeat entry per background layer', () => {
      const body = cap();
      const layers = topLevel(bgList(body)).length;
      expect(layers).toBeGreaterThanOrEqual(6);
      expect(topLevel(squash(body.match(/background-size:\s*([^;]+);/)![1]))).toHaveLength(layers);
      expect(topLevel(squash(body.match(/background-repeat:\s*([^;]+);/)![1]))).toHaveLength(layers);
    });

    it('tiles the sky at 100vh like html, so the cap shows the scroll-0 sky', () => {
      const sizes = topLevel(squash(cap().match(/background-size:\s*([^;]+);/)![1]));
      expect(sizes[sizes.length - 1]).toBe('100% 100vh');
    });

    it('sets the scroll padding to the Moon_Room plus 7 rem, after a 7 rem fallback', () => {
      const html = outside.match(/(?:^|\n)html\s*\{([^}]*)\}/)![1];
      const values = [...html.matchAll(/scroll-padding-top:\s*([^;]+);/g)].map((m) => m[1].trim());
      expect(values).toEqual(['7rem', 'calc(var(--moon-room) + 7rem)']);
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

    it('has exactly three url(), the bundled WenKai subsets of levels 1, 2 and 3', () => {
      expect(fonts.match(/url\(/g)).toHaveLength(3);
      expect(fonts).toContain('url("../assets/fonts/lxgw-wenkai-subset.woff2") format("woff2")');
      expect(fonts).toContain('url("../assets/fonts/lxgw-wenkai-subset-level2.woff2") format("woff2")');
      expect(fonts).toContain('url("../assets/fonts/lxgw-wenkai-subset-level3.woff2") format("woff2")');
    });

    it('declares the WenKai family with swap and has no media block', () => {
      expect(fonts).toContain('font-family: "LXGW WenKai Subset"');
      expect(fonts).toContain('font-display: swap');
      expect(fonts).not.toContain('@media');
    });
  });
});

describe('cursor rules', () => {
  const pointerStart = css.indexOf('@media (hover: hover) and (pointer: fine)');
  const pointer = blockAt(css, pointerStart);

  it('sits in one pointer media block, outside the Motion_Block', () => {
    expect(pointerStart).toBeGreaterThan(-1);
    expect(css.indexOf('@media (hover: hover) and (pointer: fine)', pointerStart + 1)).toBe(-1);
    expect(pointerStart >= media.end || pointer.end <= mediaStart).toBe(true);
    expect(media.body).not.toMatch(/cursor\s*:/);
  });

  it('sets no outline, box-shadow, --tw-shadow, animation or transition', () => {
    expect(pointer.body).not.toMatch(/outline|box-shadow|--tw-shadow|animation|transition/);
  });

  it('keeps not-allowed on disabled controls and excludes them from the link cursor', () => {
    expect(pointer.body).toMatch(/button:disabled,\s*\[aria-disabled="true"\]\s*\{\s*cursor:\s*not-allowed;\s*\}/);
    expect(pointer.body).toMatch(/button:not\(:disabled\):not\(\[aria-disabled="true"\]\)/);
    expect(pointer.body).toMatch(/\[role="button"\]:not\(\[aria-disabled="true"\]\)/);
    expect(pointer.body).toMatch(/\ba\[href\]/);
    expect(pointer.body).toMatch(/\bsummary\b/);
  });

  it('puts the brush cursor on [data-brush] and its descendants', () => {
    expect(pointer.body).toMatch(/\[data-brush="true"\],\s*\[data-brush="true"\] \*\s*\{/);
  });

  it('uses only data: URIs', () => {
    const urls = [...pointer.body.matchAll(/url\(/g)];
    expect(urls).toHaveLength(3);
    expect(pointer.body.match(/url\("data:image\/svg\+xml,/g)).toHaveLength(3);
  });
});

describe('grass', () => {
  it('has no animation or transition on any selector that mentions grass', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
    const motion = rules.filter((r) => /(^|[\s;])(animation|transition)(-[a-z-]+)?\s*:/.test(r.body));
    expect(motion.length).toBeGreaterThan(0);
    expect(motion.filter((r) => /grass/i.test(r.selector)).map((r) => r.selector)).toEqual([]);
    expect(css).not.toMatch(/@keyframes\s+[^{]*grass/i);
    expect(css).not.toMatch(/animation[^;}]*grass/i);
  });
});

describe('card-slip and keycap are pinned (night-polish, Requirement 6 AC 16)', () => {
  const blockText = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    return css.slice(start, blockAt(css, start).end);
  };

  it('keeps the .card-slip block exactly as it was before the Slip restyle', () => {
    expect(blockText('.card-slip')).toBe(`.card-slip {
    color: var(--ink-on-paper);
    background-color: var(--paper);
    background-image: linear-gradient(160deg, rgba(255, 250, 235, 0.3) 0%, rgba(120, 90, 50, 0.12) 100%);
    border: 1px solid color-mix(in srgb, var(--paper) 55%, var(--ink-on-paper));
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  }`);
  });

  it('keeps the .keycap block exactly as it was before the Slip restyle', () => {
    expect(blockText('.keycap')).toBe(`.keycap {
    min-height: 44px;
    color: var(--ink-on-paper);
    background-color: #d4c8aa;
    background-image:
      radial-gradient(circle at 22% 28%, rgba(60, 40, 20, 0.1) 0, transparent 22%),
      radial-gradient(circle at 78% 70%, rgba(60, 40, 20, 0.08) 0, transparent 26%),
      linear-gradient(180deg, #e9dfc6, #d4c8aa);
    border: 1px solid color-mix(in srgb, var(--paper) 55%, var(--ink-on-paper));
    border-radius: 6px;
    box-shadow:
      inset 0 1px 0 rgba(255, 250, 235, 0.6),
      inset 0 -3px 0 rgba(60, 40, 20, 0.35),
      0 2px 4px rgba(0, 0, 0, 0.5);
  }`);
  });

  it('names neither .card-slip nor .keycap in any rule whose selector contains .slip', () => {
    const rules = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim());
    const slipRules = rules.filter((selector) => /\.slip/.test(selector));
    expect(slipRules.length).toBeGreaterThan(0);
    expect(slipRules.filter((selector) => /card-slip|keycap/.test(selector))).toEqual([]);
  });
});

describe('slips (night-polish, Requirement 6)', () => {
  interface Rule {
    selector: string;
    body: string;
    index: number;
  }
  const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
  /** Every innermost rule of the CSS, with the offset of its selector. */
  const rules: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: squash(m[1]),
    body: m[2],
    index: m.index! + m[1].length - m[1].trimStart().length,
  }));
  const isSlipSelector = (selector: string): boolean => /\.slip(-primary)?(?![\w-])/.test(selector);
  const slipRules = rules.filter((r) => isSlipSelector(r.selector));
  const rule = (selector: string): Rule => {
    const found = rules.find((r) => r.selector === selector);
    expect(found, selector).toBeDefined();
    return found!;
  };
  const rangeOf = (start: number): [number, number] => [start, blockAt(css, start).end];
  const motionRange: [number, number] = [mediaStart, media.end];
  const hoverRanges: Array<[number, number]> = [...css.matchAll(/@media \(hover: hover\) \{/g)].map((m) =>
    rangeOf(m.index!),
  );
  const inside = (index: number, [from, to]: [number, number]): boolean => index > from && index < to;

  it('finds the Slip rules it is about to check', () => {
    expect(slipRules.length).toBeGreaterThanOrEqual(12);
    expect(hoverRanges).toHaveLength(2);
  });

  it('keeps every Slip transform and transition inside the Motion_Block, every transition at 200 ms', () => {
    const withMotion = slipRules.filter((r) => /(^|[\s;])(transform|transition)\s*:/.test(r.body));
    const transforms = withMotion.filter((r) => /(^|[\s;])transform\s*:/.test(r.body));
    const transitions = withMotion.filter((r) => /(^|[\s;])transition\s*:/.test(r.body));
    expect(transforms.map((r) => r.body.match(/transform:\s*([^;]+);/)![1].trim()).sort()).toEqual(
      ['translateY(-2px)', 'translateY(-2px)', 'translateY(1px)'].sort(),
    );
    expect(transitions).toHaveLength(1);
    for (const r of withMotion) expect(inside(r.index, motionRange), r.selector).toBe(true);
    for (const r of transitions) {
      const entries = r.body.match(/transition:\s*([^;]+);/)![1].split(',').map((e) => e.trim());
      expect(entries.map((e) => e.split(/\s+/)[0]).sort()).toEqual(['box-shadow', 'filter', 'transform']);
      for (const e of entries) expect(e, e).toMatch(/(?:^|\s)200ms(?:\s|$)/);
    }
    // No Slip rule outside the block names motion at all.
    for (const r of slipRules.filter((x) => !inside(x.index, motionRange))) {
      expect(r.body, r.selector).not.toMatch(/(^|[\s;])(transform|transition|animation)(-[a-z-]+)?\s*:/);
    }
  });

  it('declares every Slip hover rule only inside @media (hover: hover)', () => {
    const hovered = slipRules.filter((r) => /:hover/.test(r.selector));
    expect(hovered.length).toBe(4);
    for (const r of hovered) {
      expect(
        hoverRanges.some((range) => inside(r.index, range)),
        r.selector,
      ).toBe(true);
    }
    // The cursor block, which tests (pointer: fine) as well, is not a home for Slip rules.
    expect(slipRules.filter((r) => inside(r.index, rangeOf(css.indexOf('@media (hover: hover) and (pointer: fine)'))))).toEqual([]);
  });

  it('puts every state on an enabled Slip only, so a disabled Slip does not lift, glow or sink', () => {
    const states = slipRules.filter((r) => /:(hover|focus-visible|active)/.test(r.selector));
    expect(states.length).toBeGreaterThanOrEqual(10);
    for (const r of states) {
      for (const part of r.selector.split(',').map((s) => s.trim())) {
        expect(part, part).toContain(':not(:disabled)');
      }
    }
    for (const r of slipRules.filter((x) => /:disabled/.test(x.selector) && !/:not\(:disabled\)/.test(x.selector))) {
      expect(r.body, r.selector).not.toMatch(/transform|box-shadow|filter|transition/);
    }
  });

  it('keeps the wax on .slip-primary::before only, with a lightening alpha of 0.12', () => {
    const users = rules.filter((r) => /var\(--wax-(light|dark)\)/.test(r.body));
    expect(users.map((r) => r.selector)).toEqual(['.slip-primary::before']);
    expect(css.match(/--wax-light\s*:/g)).toHaveLength(1);
    expect(css.match(/--wax-dark\s*:/g)).toHaveLength(1);
    expect(css.match(/--wax-(light|dark)/g)!.length).toBe(4); // two definitions, two uses
    const light = decodeURIComponent(css.match(/--wax-light:\s*url\("data:image\/svg\+xml,([^"]+)"\)/)![1]);
    const values = light.match(/feColorMatrix values='([^']+)'/)![1].trim().split(/\s+/).map(Number);
    expect(values).toHaveLength(20);
    expect(values[18]).toBe(0.12);
    expect(light).toMatch(/<filter id='wl'/);
  });

  it('adds no clip-path or overflow to .slip or .slip-primary', () => {
    for (const r of slipRules) expect(r.body, r.selector).not.toMatch(/clip-path|overflow/);
    expect(rule('.slip').body).toMatch(/min-height:\s*44px/);
    expect(rule('.slip').body).toMatch(/border:\s*1px solid transparent/);
    expect(rule('.slip-primary').body).toMatch(/min-height:\s*44px/);
    expect(rule('.slip-primary').body).toMatch(/border:\s*1px solid transparent/);
  });

  it('draws the Deckled_Edge from four fixed 64 x 2 and 2 x 64 tiles, within 2 px of the box', () => {
    const tiles = (['top', 'bottom', 'left', 'right'] as const).map((side) => {
      const m = css.match(new RegExp(`--deckle-${side}:\\s*url\\("data:image/svg\\+xml,([^"]+)"\\)`));
      expect(m, side).not.toBeNull();
      const svg = decodeURIComponent(m![1]);
      const w = Number(svg.match(/\bwidth='([\d.]+)'/)![1]);
      const h = Number(svg.match(/\bheight='([\d.]+)'/)![1]);
      expect(svg).toContain(`viewBox='0 0 ${w} ${h}'`);
      const d = svg.match(/<path d='([^']+)'/)![1];
      const points = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((p) => [Number(p[1]), Number(p[2])] as const);
      return { side, w, h, points };
    });
    for (const t of tiles) {
      const horizontal = t.side === 'top' || t.side === 'bottom';
      expect([t.w, t.h], t.side).toEqual(horizontal ? [64, 2] : [2, 64]);
      for (const [x, y] of t.points) {
        expect(x, `${t.side} x`).toBeGreaterThanOrEqual(0);
        expect(x, `${t.side} x`).toBeLessThanOrEqual(t.w);
        expect(y, `${t.side} y`).toBeGreaterThanOrEqual(0);
        expect(y, `${t.side} y`).toBeLessThanOrEqual(t.h);
      }
      // Equal tile ends: the profile meets itself, so the repeat has no seam.
      const across = (v: number, axis: 0 | 1): number[] =>
        t.points.filter((p) => p[horizontal ? 0 : 1] === v).map((p) => p[axis === 0 ? 1 : 0]);
      const first = across(0, horizontal ? 0 : 1).sort();
      const last = across(horizontal ? t.w : t.h, horizontal ? 0 : 1).sort();
      expect(first.length, t.side).toBeGreaterThan(0);
      expect(first, t.side).toEqual(last);
      // The edge is irregular: the profile takes at least four different depths.
      const depth = new Set(t.points.map((p) => p[horizontal ? 1 : 0]));
      expect(depth.size, t.side).toBeGreaterThanOrEqual(4);
    }
    const mask = rule('.slip::before, .slip-primary::before').body;
    expect(mask).toMatch(/mask-size:\s*64px 2px, 64px 2px, 2px 64px, 2px 64px,/);
    expect(mask).toMatch(/mask-image:\s*var\(--deckle-top\), var\(--deckle-bottom\), var\(--deckle-left\), var\(--deckle-right\)/);
  });

  it('puts no Han character in any data: URI', () => {
    const uris = [...css.matchAll(/data:image\/svg\+xml,[^"')]+/g)].map((m) => m[0]);
    expect(uris.length).toBeGreaterThanOrEqual(8);
    for (const uri of uris) expect(decodeURIComponent(uri)).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('uses the candle only inside box-shadow and gradients on the Slips, and in no candle class', () => {
    for (const r of slipRules) {
      for (const m of r.body.matchAll(/([\w-]+)\s*:\s*([^;]*var\(--candle\)[^;]*);/g)) {
        const ok = m[1] === 'box-shadow' || /gradient\(/.test(m[2]);
        expect(ok, `${r.selector} ${m[1]}`).toBe(true);
      }
    }
    expect(slipRules.some((r) => /var\(--candle\)/.test(r.body))).toBe(true);
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
      }
    };
    walk(join(here, '..'));
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\b(bg|border|text)-candle\b/);
    }
  });

  describe('contrast', () => {
    type Rgb = [number, number, number];
    const rgb = (hex: string): Rgb => [
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
    const ratio = (a: readonly number[], b: readonly number[]): number => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const blend = (base: readonly number[], top: readonly number[], a: number): Rgb =>
      base.map((v, i) => Math.round(v * (1 - a) + top[i] * a)) as Rgb;
    const bright = (c: readonly number[], k: number): Rgb =>
      c.map((v) => Math.min(255, Math.round(v * k))) as Rgb;

    it('keeps paperLabel at 4.5:1 on the lightest wax composite in rest, hover, focus and pressed', () => {
      const light = decodeURIComponent(css.match(/--wax-light:\s*url\("data:image\/svg\+xml,([^"]+)"\)/)![1]);
      const v = light.match(/feColorMatrix values='([^']+)'/)![1].trim().split(/\s+/).map(Number);
      const tint = [v[4], v[9], v[14]].map((c) => Math.round(c * 255));
      expect(tint).toEqual(rgb(theme.sealLight));
      const lightest = blend(rgb(theme.seal), tint, v[18]);
      const label = rgb(theme.paperLabel);
      const hoverFilter = Number(rule('.slip-primary:hover:not(:disabled)').body.match(/filter:\s*brightness\(([\d.]+)\)/)![1]);
      expect(hoverFilter).toBe(1.1);
      expect(rule('.slip-primary:active:not(:disabled)').body).toMatch(/filter:\s*none/);
      for (const r of slipRules.filter((x) => /(^|,\s*)\.slip-primary:focus-visible/.test(x.selector))) {
        expect(r.body, r.selector).not.toMatch(/filter/);
      }
      expect(rule('.slip-primary').body).not.toMatch(/filter/);
      const cases: Array<[string, number]> = [
        ['rest', ratio(label, lightest)],
        ['hover', ratio(bright(label, hoverFilter), bright(lightest, hoverFilter))],
        ['focus', ratio(label, lightest)],
        ['pressed', ratio(label, lightest)],
      ];
      for (const [name, r] of cases) expect(r, name).toBeGreaterThanOrEqual(4.5);
      // Design: 4.60 at rest, focus and pressed, about 4.65 on hover (4.646 with channel rounding).
      expect(cases[0][1]).toBeGreaterThanOrEqual(4.6);
      expect(cases[1][1]).toBeGreaterThanOrEqual(4.64);
    });

    /** Both ends of the paper gradient of a Slip state, composited over `paper`. */
    const paperEnds = (selector: string): [Rgb, Rgb] => {
      const stops = [
        ...rule(selector).body.matchAll(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\) (0|100)%/g),
      ];
      expect(stops, selector).toHaveLength(2);
      return stops.map((s) => blend(rgb(theme.paper), [Number(s[1]), Number(s[2]), Number(s[3])], Number(s[4]))) as [Rgb, Rgb];
    };

    it('keeps inkOnPaper at 4.5:1 on the lightest and the darkest paper of every .slip state', () => {
      const ink = rgb(theme.inkOnPaper);
      const states: Record<string, string> = {
        rest: '.slip::before',
        hover: '.slip:hover:not(:disabled)::before',
        focus: '.slip:focus-visible:not(:disabled)::before',
        pressed: '.slip:active:not(:disabled)::before',
      };
      const seen: string[] = [];
      for (const [name, selector] of Object.entries(states)) {
        const ends = paperEnds(selector);
        for (const end of ends) {
          expect(ratio(ink, end), `${name} ${end}`).toBeGreaterThanOrEqual(4.5);
          seen.push(`${name} ${end}`);
        }
        const [lo, hi] = ends.map(lum).sort((a, b) => a - b);
        expect(hi, name).toBeGreaterThan(lo);
      }
      expect(seen).toHaveLength(8);
      // Disabled: the `disabled:opacity-70` utility lays the Slip over the page background at 0.7.
      const page = rgb(theme.background);
      for (const end of paperEnds(states.rest)) {
        expect(ratio(blend(page, ink, 0.7), blend(page, end, 0.7))).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe('Sound_Toggle placement (night-sounds 10.1)', () => {
  const top = withoutMediaBlocks(css);
  const rule = blockAt(top, top.indexOf('.slip.sound-toggle {')).body;
  const decl = (name: string): string => {
    const m = rule.match(new RegExp(`(?:^|[\\s;])${name}\\s*:\\s*([^;]+);`));
    expect(m, name).not.toBeNull();
    return m![1].trim();
  };
  const rootVar = (name: string): number => {
    const m = css.match(new RegExp(`${name}:\\s*([\\d.]+)rem;`));
    expect(m, name).not.toBeNull();
    return parseFloat(m![1]);
  };
  /** Evaluate a clamp()/calc() length of the rule at a viewport width, in px (1 rem = 16 px). */
  const px = (expr: string, vw: number): number => {
    const js = expr
      .replace(/var\(--moon-inset-x\)/g, `${rootVar('--moon-inset-x')}rem`)
      .replace(/var\(--moon-inset-y\)/g, `${rootVar('--moon-inset-y')}rem`)
      .replace(/var\(--moon-size\)/g, `${rootVar('--moon-size')}rem`)
      .replace(/(\d*\.?\d+)rem/g, '($1*16)')
      .replace(/(\d*\.?\d+)px/g, '$1')
      .replace(/100vw/g, String(vw))
      .replace(/calc\(/g, '(')
      .replace(/clamp\(/g, 'clamp(');
    const clamp = (lo: number, v: number, hi: number): number => Math.max(lo, Math.min(v, hi));
    return new Function('clamp', `return ${js};`)(clamp) as number;
  };
  const box = (vw: number) => {
    const size = px(decl('width'), vw);
    const right = px(decl('right'), vw);
    const topPx = px(decl('top'), vw);
    return { left: vw - right - size, right: vw - right, top: topPx, bottom: topPx + size, size };
  };
  const moon = (vw: number) => {
    const r = (rootVar('--moon-size') * 16) / 2;
    const cx = vw - rootVar('--moon-inset-x') * 16;
    const cy = rootVar('--moon-inset-y') * 16;
    return { left: cx - r, right: cx + r, top: cy - r, bottom: cy + r, cx };
  };

  it('is fixed, above the Sky_Cap (10) and the sticky headers (20), with no transition or animation', () => {
    expect(decl('position')).toBe('fixed');
    expect(Number(decl('z-index'))).toBeGreaterThan(20);
    expect(Number(decl('z-index'))).toBe(30);
    expect(rule).not.toMatch(/transition|animation/);
    expect(top).toContain('.slip.sound-toggle {');
  });

  it('adds no @media condition', () => {
    const conditions = [...css.matchAll(/@media\s*([^{]*)\{/g)].map((m) => m[1].trim().replace(/\s+/g, ' '));
    expect(conditions.sort()).toEqual(
      [
        '(hover: hover)',
        '(hover: hover)',
        '(hover: hover) and (pointer: fine)',
        '(prefers-reduced-motion: no-preference)',
      ].sort(),
    );
  });

  it('is a 44 px square', () => {
    expect(px(decl('width'), 1024)).toBe(44);
    expect(px(decl('height'), 1024)).toBe(44);
  });

  it('lies 16 px left of the Moon disc below 992 px, in the top room', () => {
    for (const vw of [320, 375, 600, 991]) {
      const t = box(vw);
      const m = moon(vw);
      expect(vw - t.right, `${vw} right offset`).toBe(88);
      expect(m.left - t.right, `${vw} gap`).toBe(16);
      expect(t.top, `${vw} top`).toBe(8);
      expect(t.bottom).toBe(52);
    }
  });

  it('lies 16 px below the Moon disc, centred under it, from 992 px', () => {
    for (const vw of [992, 1024, 1440, 1920]) {
      const t = box(vw);
      const m = moon(vw);
      expect(t.top - m.bottom, `${vw} gap`).toBe(16);
      expect(vw - t.right, `${vw} right offset`).toBe(18);
      expect((t.left + t.right) / 2, `${vw} centre`).toBe(m.cx);
      expect(t.top).toBe(88);
      expect(t.bottom).toBe(132);
    }
  });
});
