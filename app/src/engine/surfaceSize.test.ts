import { describe, expect, it } from 'vitest';
import { summonPaperSize, writeSurfaceSize } from './surfaceSize';

const VIEWPORTS: Array<[number, number]> = [
  [1024, 768],
  [375, 812],
  [320, 640],
  [1440, 900],
];

describe('summonPaperSize', () => {
  it('gives the budgeted size at the four viewports', () => {
    expect(VIEWPORTS.map(([w, h]) => summonPaperSize(w, h))).toEqual([160, 150, 96, 160]);
  });

  it('keeps the 96 floor on a short screen', () => {
    expect(summonPaperSize(1024, 300)).toBe(96);
  });

  it('caps at 160', () => {
    expect(summonPaperSize(4000, 4000)).toBe(160);
  });

  it('returns integers', () => {
    expect(Number.isInteger(summonPaperSize(333, 777))).toBe(true);
    expect(Number.isInteger(summonPaperSize(375.5, 812.5))).toBe(true);
  });
});

describe('writeSurfaceSize', () => {
  it('gives the budgeted size at the four viewports', () => {
    expect(VIEWPORTS.map(([w, h]) => writeSurfaceSize(w, h))).toEqual([368, 300, 240, 420]);
  });

  it('keeps the 200 floor on a short screen', () => {
    expect(writeSurfaceSize(1024, 300)).toBe(200);
  });

  it('caps at 420', () => {
    expect(writeSurfaceSize(4000, 4000)).toBe(420);
  });

  it('returns integers', () => {
    expect(Number.isInteger(writeSurfaceSize(333, 777))).toBe(true);
    expect(Number.isInteger(writeSurfaceSize(375.5, 812.5))).toBe(true);
  });
});
