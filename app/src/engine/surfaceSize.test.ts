import { describe, expect, it } from 'vitest';
import { WALKTHROUGH_LINE_PX, summonPaperSize, writeSurfaceSize } from './surfaceSize';

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

describe('reserved height', () => {
  it('exports the walkthrough line height', () => {
    expect(WALKTHROUGH_LINE_PX).toBe(24);
  });

  it('keeps today\'s values when reservedPx is 0', () => {
    expect(VIEWPORTS.map(([w, h]) => summonPaperSize(w, h, 0))).toEqual([160, 150, 96, 160]);
    expect(VIEWPORTS.map(([w, h]) => writeSurfaceSize(w, h, 0))).toEqual([368, 300, 240, 420]);
  });

  it('takes the reserved height from the Summon paper', () => {
    expect(summonPaperSize(1024, 768, WALKTHROUGH_LINE_PX)).toBe(144);
    expect(summonPaperSize(375, 812, WALKTHROUGH_LINE_PX)).toBe(150);
  });

  it('takes the reserved height from the Write surface', () => {
    expect(writeSurfaceSize(1024, 768, WALKTHROUGH_LINE_PX)).toBe(344);
    expect(writeSurfaceSize(375, 812, WALKTHROUGH_LINE_PX)).toBe(300);
  });

  it('keeps the floors with a reserved height', () => {
    expect(summonPaperSize(1024, 300, WALKTHROUGH_LINE_PX)).toBe(96);
    expect(writeSurfaceSize(1024, 300, WALKTHROUGH_LINE_PX)).toBe(200);
  });
});
