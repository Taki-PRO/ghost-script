import { describe, expect, it } from 'vitest';
import { luminance, luminanceRatio } from '../../e2e/colour';

describe('e2e colour helpers', () => {
  it('luminance of black is 0 and of white is 1', () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 10);
  });

  it('black on white is 21:1, in either argument order', () => {
    expect(luminanceRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 6);
    expect(luminanceRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 6);
  });

  it('equal colours give 1:1', () => {
    expect(luminanceRatio([16, 28, 56], [16, 28, 56])).toBe(1);
  });
});
