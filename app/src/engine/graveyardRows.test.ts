import { describe, expect, it } from 'vitest';
import { columnCount, notYetMetText, visibleGraveCount } from './graveyardRows';

describe('visibleGraveCount (R12.1 to R12.3, R12.19, R12.20)', () => {
  it('shows exactly one blank row when no ghost is met', () => {
    expect(visibleGraveCount(300, 6, -1)).toBe(6);
  });

  it('shows the first row plus one row when the met ghost is in the first row', () => {
    expect(visibleGraveCount(300, 6, 0)).toBe(12);
    expect(visibleGraveCount(300, 6, 5)).toBe(12);
  });

  it('shows every row through a met ghost in a later row, plus one', () => {
    expect(visibleGraveCount(300, 6, 6)).toBe(18);
    expect(visibleGraveCount(300, 6, 39)).toBe(48);
  });

  it('shows all graves when the met ghost is in the last row', () => {
    expect(visibleGraveCount(24, 6, 23)).toBe(24);
    expect(visibleGraveCount(24, 6, 18)).toBe(24);
  });

  it('caps at the total when the last row is not full', () => {
    expect(visibleGraveCount(20, 6, 14)).toBe(20); // rows 1-3 plus a partial 4th
    expect(visibleGraveCount(20, 6, 19)).toBe(20);
    expect(visibleGraveCount(20, 6, 5)).toBe(12);
  });

  it('works with one column', () => {
    expect(visibleGraveCount(10, 1, -1)).toBe(1);
    expect(visibleGraveCount(10, 1, 0)).toBe(2);
    expect(visibleGraveCount(10, 1, 4)).toBe(6);
    expect(visibleGraveCount(10, 1, 9)).toBe(10);
  });

  it('shows all graves when there are fewer than one row', () => {
    expect(visibleGraveCount(4, 6, -1)).toBe(4);
    expect(visibleGraveCount(4, 6, 2)).toBe(4);
  });

  it('treats an empty level and a bad column count safely', () => {
    expect(visibleGraveCount(0, 6, -1)).toBe(0);
    expect(visibleGraveCount(10, 0, -1)).toBe(1);
  });
});

describe('columnCount', () => {
  it('matches the auto-fill track count at 296, 343 and 768 px', () => {
    expect(columnCount(296)).toBe(5); // inner 272, (272 + 8) / 56 = 5
    expect(columnCount(343)).toBe(5);
    expect(columnCount(768)).toBe(13);
  });

  it('never returns less than one', () => {
    expect(columnCount(0)).toBe(1);
    expect(columnCount(30)).toBe(1);
  });
});

describe('notYetMetText (R12.4 to R12.6)', () => {
  it('has no text for 0', () => {
    expect(notYetMetText(0)).toBeNull();
  });
  it('uses the singular for 1', () => {
    expect(notYetMetText(1)).toBe('1 ghost not yet met');
  });
  it('uses the plural for 2 or more', () => {
    expect(notYetMetText(2)).toBe('2 ghosts not yet met');
    expect(notYetMetText(288)).toBe('288 ghosts not yet met');
  });
});
