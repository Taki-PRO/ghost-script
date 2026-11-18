import { describe, expect, it } from 'vitest';
import type { Level } from '../data/types';
import { crossLevelLine, isDueAt, otherLevelCounts, type PlannedGhost } from './crossLevel';

function ghosts(n: number, level: Level | null, due = true, prefix = 'g'): PlannedGhost[] {
  return Array.from({ length: n }, (_, i) => ({ character: `${prefix}${level ?? 'x'}${i}`, level, due }));
}

describe('crossLevelLine', () => {
  it('ten ghosts from one level', () => {
    expect(crossLevelLine(ghosts(10, 1), 2, false, false)).toBe('10 ghosts from level 1 return first.');
  });
  it('one ghost', () => {
    expect(crossLevelLine(ghosts(1, 1), 2, false, false)).toBe('1 ghost from level 1 returns first.');
  });
  it('two ghosts', () => {
    expect(crossLevelLine(ghosts(2, 3), 2, false, false)).toBe('2 ghosts from level 3 return first.');
  });
  it('two levels, ascending, with plural return', () => {
    const report = [...ghosts(3, 3), ...ghosts(2, 1)];
    expect(crossLevelLine(report, 2, false, false)).toBe('2 ghosts from level 1 and 3 ghosts from level 3 return first.');
  });
  it('two levels with a count of 1 on each side', () => {
    const report = [...ghosts(1, 1), ...ghosts(1, 3)];
    expect(crossLevelLine(report, 2, false, false)).toBe('1 ghost from level 1 and 1 ghost from level 3 return first.');
  });
  it('two levels with 2 and 1', () => {
    const report = [...ghosts(2, 1), ...ghosts(1, 2)];
    expect(crossLevelLine(report, 3, false, false)).toBe('2 ghosts from level 1 and 1 ghost from level 2 return first.');
  });
  it('null for an empty report', () => {
    expect(crossLevelLine([], 1, false, false)).toBeNull();
  });
  it('null when only Chosen_Level ghosts are planned', () => {
    expect(crossLevelLine(ghosts(5, 2), 2, false, false)).toBeNull();
  });
  it('ignores Chosen_Level ghosts that are due', () => {
    const report = [...ghosts(4, 2, true), ...ghosts(1, 1, true)];
    expect(crossLevelLine(report, 2, false, false)).toBe('1 ghost from level 1 returns first.');
  });
  it('null when other-level ghosts are not due', () => {
    expect(crossLevelLine(ghosts(3, 1, false), 2, false, false)).toBeNull();
  });
  it('counts only the due other-level ghosts', () => {
    const report = [...ghosts(2, 1, true), ...ghosts(3, 1, false, 'n')];
    expect(crossLevelLine(report, 2, false, false)).toBe('2 ghosts from level 1 return first.');
  });
  it('ignores ghosts without a level', () => {
    expect(crossLevelLine(ghosts(3, null), 2, false, false)).toBeNull();
  });
  it('null for a Review_Run', () => {
    expect(crossLevelLine(ghosts(3, 1), 2, false, true)).toBeNull();
  });
  it('null when the séance starts with the Guided_Ghost', () => {
    expect(crossLevelLine(ghosts(3, 1), 2, true, false)).toBeNull();
  });
  it('honours the minimum parameter', () => {
    expect(crossLevelLine(ghosts(1, 1), 2, false, false, 2)).toBeNull();
    expect(crossLevelLine(ghosts(2, 1), 2, false, false, 2)).toBe('2 ghosts from level 1 return first.');
  });
});

describe('otherLevelCounts', () => {
  it('counts due other-level ghosts per level, ascending', () => {
    expect(otherLevelCounts([...ghosts(1, 3), ...ghosts(2, 1), ...ghosts(1, 2)], 2)).toEqual([
      [1, 2],
      [3, 1],
    ]);
  });
});

describe('isDueAt', () => {
  const entry = (nextDue: number) => ({ step: 0, lastOutcome: 'clean' as const, nextDue });
  it('is false without an entry', () => {
    expect(isDueAt(undefined, 100)).toBe(false);
  });
  it('is true at and after nextDue, false before', () => {
    expect(isDueAt(entry(100), 100)).toBe(true);
    expect(isDueAt(entry(100), 101)).toBe(true);
    expect(isDueAt(entry(100), 99)).toBe(false);
  });
  it('treats a non-finite or negative nextDue as due', () => {
    expect(isDueAt(entry(Number.NaN), 0)).toBe(true);
    expect(isDueAt(entry(-5), 0)).toBe(true);
  });
});
