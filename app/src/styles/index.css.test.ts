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

  it("[lang='zh'] holds the exact Chinese font stack, equal to the Tailwind hanzi family", () => {
    const m = outside.match(/\[lang='zh'\]\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1].trim()).toBe(`font-family: ${STACK};`);
    const hanzi = (tailwind.theme.extend.fontFamily.hanzi as string[]).join(', ');
    expect(hanzi).toBe(STACK);
  });
});
