import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TABLET_TILTS_DEG, tabletTilt, tabletTiltIndex } from './tabletTilt';

describe('tabletTilt', () => {
  it('follows the fixed pattern by position mod 5', () => {
    expect([...TABLET_TILTS_DEG]).toEqual([-3, 1.5, 0, -1.5, 3]);
    expect([1, 2, 3, 4, 5].map(tabletTilt)).toEqual([1.5, 0, -1.5, 3, -3]);
  });

  it('is deterministic and never tilts more than 3 degrees for positions 1 to 300', () => {
    for (let p = 1; p <= 300; p++) {
      expect(tabletTilt(p)).toBe(tabletTilt(p));
      expect(tabletTilt(p)).toBe(TABLET_TILTS_DEG[p % 5]);
      expect(Math.abs(tabletTilt(p))).toBeLessThanOrEqual(3);
      expect(tabletTiltIndex(p)).toBe(p % 5);
    }
  });

  it('matches the .tablet-tilt-N rules of index.css', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(here, '../styles/index.css'), 'utf8');
    TABLET_TILTS_DEG.forEach((deg, n) => {
      const m = css.match(new RegExp(`\\.tablet-tilt-${n}\\s*\\{[^}]*rotate\\((-?[\\d.]+)deg\\)`));
      expect(m, `.tablet-tilt-${n}`).not.toBeNull();
      expect(parseFloat(m![1])).toBe(deg);
    });
  });
});
