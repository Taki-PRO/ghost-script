import { describe, expect, it } from 'vitest';
import { contrastRatio, theme } from './theme';

describe('theme contrast (WCAG AA)', () => {
  it('computes known extremes', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  const textTokens = ['ink', 'muted', 'ghost', 'success', 'error'] as const;
  const backgrounds = ['background', 'surface'] as const;

  for (const t of textTokens) {
    for (const b of backgrounds) {
      it(`${t} on ${b} is >= 4.5:1`, () => {
        expect(contrastRatio(theme[t], theme[b])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
