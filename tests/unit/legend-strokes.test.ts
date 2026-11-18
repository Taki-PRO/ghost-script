import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLegendStrokes,
  legendCharacters,
  serialiseLegendStrokes,
} from '../../scripts/lib/legend-strokes';
import { LEGEND_SOURCE } from '../../app/src/data/citations';

const RAW = join(__dirname, '../../data/raw/hanzi-writer-data');

describe('legend strokes (R13.1 to R13.3)', () => {
  const chars = legendCharacters(LEGEND_SOURCE.zh);

  it('lists the six Han characters in legend order and not the comma', () => {
    expect(chars).toEqual(['天', '雨', '粟', '鬼', '夜', '哭']);
  });

  it('has one entry per character, each equal to its source file, none for the comma', () => {
    const built = buildLegendStrokes(RAW, chars);
    expect(Object.keys(built)).toEqual(chars);
    expect('，' in built).toBe(false);
    for (const ch of chars) {
      const source = JSON.parse(readFileSync(join(RAW, `${ch}.json`), 'utf8'));
      expect(built[ch]).toEqual(source);
    }
  });

  it('serialises byte-identically on two runs', () => {
    const a = serialiseLegendStrokes(buildLegendStrokes(RAW, chars));
    const b = serialiseLegendStrokes(buildLegendStrokes(RAW, chars));
    expect(a).toBe(b);
    expect(a.endsWith('}\n')).toBe(true);
  });

  it('throws naming the character when its stroke file is missing', () => {
    const empty = mkdtempSync(join(tmpdir(), 'legend-'));
    expect(() => buildLegendStrokes(empty, ['鬼'])).toThrow(/鬼/);
  });
});
