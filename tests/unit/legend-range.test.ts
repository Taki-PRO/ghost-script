import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEGEND_SOURCE } from '../../app/src/data/citations';

/**
 * Reads the `unicode-range` of the first `@font-face` block of fonts.css (the
 * level 1 font) and expands "U+4E00,U+4E09-4E0B" into [start, end] pairs.
 */
function firstRange(css: string): Array<[number, number]> {
  const block = css.match(/@font-face\s*\{[^}]*\}/);
  const decl = block?.[0].match(/unicode-range:\s*([^;]+);/);
  if (!decl) throw new Error('first @font-face has no unicode-range');
  return decl[1].split(',').map((part): [number, number] => {
    const m = part.trim().match(/^U\+([0-9A-F]+)(?:-([0-9A-F]+))?$/i);
    if (!m) throw new Error(`bad unicode-range item: ${part}`);
    const start = parseInt(m[1], 16);
    return [start, m[2] ? parseInt(m[2], 16) : start];
  });
}

describe('Legend_Line and the level 1 font (R13.15)', () => {
  it('has its seven code points inside the first @font-face unicode-range', () => {
    const css = readFileSync(
      join(__dirname, '../../app/src/styles/fonts.css'),
      'utf8',
    );
    const ranges = firstRange(css);
    const points = [...LEGEND_SOURCE.zh].map((c) => c.codePointAt(0) as number);
    expect(points).toHaveLength(7);
    for (const cp of points) {
      expect(
        ranges.some(([lo, hi]) => cp >= lo && cp <= hi),
        `U+${cp.toString(16).toUpperCase()}`,
      ).toBe(true);
    }
  });
});
