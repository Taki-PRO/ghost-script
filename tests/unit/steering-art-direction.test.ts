import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ink-and-candlelight Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7

const repoRoot = resolve(__dirname, '..', '..');
const text = readFileSync(resolve(repoRoot, '.kiro/steering/art-direction.md'), 'utf8');

describe('art-direction steering file', () => {
  it('starts with front matter whose inclusion is always', () => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    expect(match).not.toBeNull();
    expect(match?.[1]).toMatch(/^inclusion: always$/m);
  });

  it.each(['## Direction', '## Palette', '### Primary action per screen', '## The ghost', '## Motion', '## Cultural care', '## Sound'])(
    'has the heading %s',
    (heading) => {
      expect(text).toContain(`\n${heading}\n`);
    },
  );

  it('has the screenshot-review rules (approved by the human)', () => {
    expect(text).toContain(
      'The Moon is a pale warm disc of 4 rem in the top right, with soft maria, a soft shade toward the lower right and a faint glow of at most 0.10 alpha that fades out over 7 rem. It never lies under text, so no text token has to meet 4.5:1 on the disc itself; the end-to-end check `moonIntruders` proves that no text lies on it on every screen that calls `expectMoonInside`. Text beside the glow keeps 4.5:1. Below 992 px every screen keeps a top room of 4.75 rem for it.',
    );
    expect(text).not.toMatch(/Moon is a full disc of 4 rem/);
    expect(text).toMatch(/never lies under text/);
    expect(text).toMatch(/top room of 4\.75 rem/);
    expect(text).toMatch(/992 px/);
    expect(text).toMatch(/0\.18 at 88% and 0\.10 at 72%/);
    expect(text).toMatch(/ghost is an ink wash/);
    expect(text).toMatch(/same shape at every size/);
    expect(text).toMatch(/seal sits in the paper margin and covers no stroke/);
  });

  it('has the intro-fix rules (approved by the human)', () => {
    expect(text).toMatch(/Moon disc has a soft off-centre shade, darker toward the lower right/);
    expect(text).toMatch(/night sky, the grain and the mist cover the full page height/);
    expect(text).toMatch(/mist repeats once per screen-high tile/);
    expect(text).toMatch(/intro shows no raw citation/);
    expect(text).toMatch(/small "Sources" link/);
    expect(text).toMatch(/not a Primary_Action/);
  });

  it('keeps the Primary_Action table', () => {
    expect(text).toContain('| Intro | Begin the Séance |');
    expect(text).toContain('| Summary | Begin another Séance |');
  });

  it('lists the Level screen with no Primary_Action (harder-ghosts, approved by the human)', () => {
    expect(text).toContain('| Level screen | none |');
  });

  it('allows flat ghost copies for the favicon and the pointer cursors (night-polish A2, approved by the human)', () => {
    expect(text).toContain(
      'drawn by `GhostFigure`. Flat copies of the same silhouette are also allowed: the favicon and the pointer cursors. Each copy is built from the exported `GHOST_PATH` and `GHOST_EYE_PATHS`, has no filter, no gradient and no text, and is a standalone SVG that does not reference the `GhostFigure` component or its filter.',
    );
    expect(text).not.toContain('drawn only by `GhostFigure`');
  });
  it('exempts decorative graphics from 3:1 and sets the Grass visibility floor (night-polish A4, approved by the human)', () => {
    expect(text).toContain(
      'Graphics keep 3:1, except graphics that are `aria-hidden` and convey no information: the hillside, the Grass, the mist, the Moon glow, the grain, the Wax_Texture and the Deckled_Edge. The Grass keeps its own visibility floor: its tufts keep a luminance ratio of at least 1.3:1 against the stone and the hill behind them.',
    );
    expect(text).not.toMatch(/Graphics keep 3:1\.(\s|$)/);
  });
  it('keeps cursor images and meaningful graphics at 3:1, right after the A4 sentence (night-polish A11, approved by the human)', () => {
    expect(text).toContain(
      'against the stone and the hill behind them. The cursor images and every graphic that carries meaning keep the 3:1 rule.',
    );
  });
  it('has the Slip rule right after the secondary-button line (night-polish A5, approved by the human)', () => {
    expect(text).toContain(
      'Buttons stay at least 44 px high.\n- Slips (`.slip` and `.slip-primary`; not `.card-slip` or `.keycap`) lift 2 px and gain a candle glow on hover and keyboard focus, and sink 1 px when pressed. Slips have a Deckled_Edge, a torn-paper edge that stays within 2 px of the box. The Primary_Slip has a faint Wax_Texture in tones of `seal`, at most 0.12 lightening alpha. The transitions run 200 ms inside the reduced-motion block and need no motion exemption.',
    );
  });
  it('has the Sky_Cap sentence right after the Moon line, once (night-polish A6, approved by the human)', () => {
    const sentence =
      'Below 992 px a fixed Sky_Cap keeps the top room free of scrolling content on every screen.';
    expect(text).toContain(
      'Below 992 px every screen keeps a top room of 4.75 rem for it.\n- ' + sentence + '\n',
    );
    expect(text.split(sentence).length - 1).toBe(1);
  });
  it('has the Pointer section between Motion and Cultural care (night-polish A9, approved by the human)', () => {
    const section =
      '## Pointer\nCursors apply only to devices whose primary input matches `(hover: hover) and (pointer: fine)`; touch devices keep the default cursor. The Ghost_Cursor and the Link_Cursor are flat ghost silhouettes, each at most 32 by 32 px, a `data:` SVG with an `auto` fallback. The Link_Cursor differs from the Ghost_Cursor in shape (wider eyes) and not only in colour. The Brush_Cursor is a thin crosshair with an open centre, at most 24 by 24 px, a `data:` SVG with a `crosshair` fallback, used on the Writing_Paper of the Write step only.\n';
    expect(text).toContain('\n' + section + '\n## Cultural care\n');
    expect(text.split('\n## Pointer\n').length - 1).toBe(1);
    expect(text.indexOf('\n## Motion\n')).toBeLessThan(text.indexOf('\n## Pointer\n'));
  });
  it('Pointer limits cover the shipped cursor sizes (night-polish A9)', () => {
    const css = readFileSync(resolve(repoRoot, 'app/src/styles/cursors.ts'), 'utf8');
    expect(css).toMatch(/GHOST_CURSOR_WIDTH = 24;/);
    expect(css).toMatch(/GHOST_CURSOR_HEIGHT = 30;/);
    expect(css).toMatch(/BRUSH_SIZE = 20;/);
    expect(css).toMatch(/BRUSH_ARM_WIDTH = 2;/);
    expect(css).toMatch(/BRUSH_CASING_WIDTH = 4;/);
    expect(css).toContain("fallback: 'auto'");
    expect(css).toContain("fallback: 'crosshair'");
  });
  it('says the Moon uses only existing tokens (night-polish A10, approved by the human)', () => {
    expect(text).toContain(
      '- The Moon uses only existing tokens: `ink` for the disc and the glow, `nightMid` for the maria and `nightTop` for the shade. The `moon` token stays for the mist-coloured heading glow.\n',
    );
    const start = text.indexOf('## Moon, mist and seal placement');
    const end = text.indexOf('\n## Intro fix');
    const moonSection = text.slice(start, end);
    expect(moonSection).toContain('The Moon uses only existing tokens');
    expect(text.split('The Moon uses only existing tokens').length - 1).toBe(1);
  });
  it('has the grass palette row after hintInk, equal to theme.grass (night-polish A10, approved by the human)', () => {
    const row =
      '| `grass` | `#30505c` | Graveyard Grass tufts (decorative, `aria-hidden`; at least 1.3:1 against the stone and the hill) |';
    expect(text).toContain('| `hintInk` | `#2c3e5a` | hanzi-writer stroke hint on paper |\n' + row + '\n');
    expect(text.split(row).length - 1).toBe(1);
    const themeSrc = readFileSync(resolve(repoRoot, 'app/src/styles/theme.ts'), 'utf8');
    const themeGrass = /^\s*grass:\s*'(#[0-9a-fA-F]{6})'/m.exec(themeSrc)?.[1];
    const tableGrass = /^\| `grass` \| `(#[0-9a-fA-F]{6})` \|/m.exec(text)?.[1];
    expect(themeGrass).toBeDefined();
    expect(tableGrass?.toLowerCase()).toBe(themeGrass?.toLowerCase());
  });
  it('names the ambient and rite-timing exemptions', () => {
    expect(text).toMatch(/Ambient exemption/);
    expect(text).toMatch(/Rite-timing exemption/);
  });
});
