import { describe, expect, it } from 'vitest';
import {
  CROSS_LEVEL_LINE_PX,
  CROSS_LEVEL_LINE_WRAP_PX,
  WALKTHROUGH_LINE_PX,
  crossLevelReserve,
  summonPaperSize,
  writeSurfaceSize,
} from './surfaceSize';

const VIEWPORTS: Array<[number, number]> = [
  [1024, 768],
  [375, 812],
  [320, 640],
  [1440, 900],
];

describe('summonPaperSize', () => {
  it('gives the budgeted size at the four viewports', () => {
    expect(VIEWPORTS.map(([w, h]) => summonPaperSize(w, h))).toEqual([284, 328, 156, 416]);
  });

  it('gives the approved values with and without a reserved line', () => {
    expect(summonPaperSize(1024, 768, 0)).toBe(284);
    expect(summonPaperSize(1024, 768, 24)).toBe(260);
    expect(summonPaperSize(375, 812)).toBe(328);
    expect(summonPaperSize(320, 640)).toBe(156);
    expect(summonPaperSize(320, 500)).toBe(96);
  });

  it('keeps the 96 floor on a short screen', () => {
    expect(summonPaperSize(1024, 300)).toBe(96);
  });

  it('caps at 560', () => {
    expect(summonPaperSize(4000, 4000)).toBe(560);
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
    expect(VIEWPORTS.map(([w, h]) => summonPaperSize(w, h, 0))).toEqual([284, 328, 156, 416]);
    expect(VIEWPORTS.map(([w, h]) => writeSurfaceSize(w, h, 0))).toEqual([368, 300, 240, 420]);
  });

  it('takes the reserved height from the Summon paper', () => {
    expect(summonPaperSize(1024, 768, WALKTHROUGH_LINE_PX)).toBe(260);
    expect(summonPaperSize(375, 812, WALKTHROUGH_LINE_PX)).toBe(304);
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

describe('crossLevelReserve', () => {
  const short = 'x'.repeat(40);
  const long = 'x'.repeat(41);

  it('exports the two line heights', () => {
    expect(CROSS_LEVEL_LINE_PX).toBe(24);
    expect(CROSS_LEVEL_LINE_WRAP_PX).toBe(44);
  });

  it('reserves one line for a short text at any width', () => {
    expect(crossLevelReserve(short, 320)).toBe(24);
    expect(crossLevelReserve('', 320)).toBe(24);
  });

  it('reserves one line for a long text in a container of 600 px or more', () => {
    expect(crossLevelReserve(long, 600)).toBe(24);
    expect(crossLevelReserve(long, 1024)).toBe(24);
  });

  it('reserves two lines for a long text in a container under 600 px', () => {
    expect(crossLevelReserve(long, 599)).toBe(44);
    expect(crossLevelReserve(long, 375)).toBe(44);
  });

  it('gives the design paper sizes with the reserve inside reservedPx', () => {
    expect(summonPaperSize(1024, 768, crossLevelReserve(long, 1024))).toBe(260);
    expect(summonPaperSize(375, 812, crossLevelReserve(long, 375))).toBe(284);
    expect(summonPaperSize(320, 640, crossLevelReserve(long, 320))).toBe(112);
  });

  it('keeps the 96 floor with a two-line reserve on a short screen', () => {
    expect(summonPaperSize(375, 400, CROSS_LEVEL_LINE_WRAP_PX)).toBe(96);
  });
});
