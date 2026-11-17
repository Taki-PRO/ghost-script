import { describe, expect, it } from 'vitest';
import type { CharacterRecord } from '../data/types';
import { buildReturnRows, formatReturn } from './formatReturn';
import type { ReviewEntry } from './scheduler';

// Every timestamp is built from local calendar fields, so the tests pass in any time zone.
const at = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number =>
  new Date(y, mo - 1, d, h, mi, s, ms).getTime();

// Local clock of the design's worked examples: 20 Nov 2026 22:00.
const NOW = at(2026, 11, 20, 22, 0);
const MIN = 60_000;

describe('formatReturn', () => {
  it('worked examples from the design', () => {
    expect(formatReturn(at(2026, 11, 20, 22, 10), NOW)).toBe('returns in 10 minutes');
    expect(formatReturn(at(2026, 11, 21, 6, 0), NOW)).toBe('returns in 8 hours');
    expect(formatReturn(at(2026, 11, 21, 22, 0), NOW)).toBe('returns tomorrow');
    expect(formatReturn(at(2026, 11, 22, 1, 0), NOW)).toBe('returns in 2 days');
    expect(formatReturn(at(2026, 11, 23, 22, 0), NOW)).toBe('returns in 3 days');
  });

  it('returns now for zero and negative differences', () => {
    expect(formatReturn(NOW, NOW)).toBe('returns now');
    expect(formatReturn(NOW - 1, NOW)).toBe('returns now');
    expect(formatReturn(NOW - 5 * 24 * 60 * MIN, NOW)).toBe('returns now');
  });

  it('rounds minutes up and uses the singular', () => {
    expect(formatReturn(NOW + 1, NOW)).toBe('returns in 1 minute');
    expect(formatReturn(NOW + MIN, NOW)).toBe('returns in 1 minute');
    expect(formatReturn(NOW + MIN + 1, NOW)).toBe('returns in 2 minutes');
    expect(formatReturn(NOW + 59 * MIN, NOW)).toBe('returns in 59 minutes');
  });

  it('switches from minutes to hours at 59 min 59 s (ceil gives 60)', () => {
    expect(formatReturn(NOW + 59 * MIN + 59_000, NOW)).toBe('returns in 1 hour');
    expect(formatReturn(NOW + 60 * MIN, NOW)).toBe('returns in 1 hour');
    expect(formatReturn(NOW + 60 * MIN + 1, NOW)).toBe('returns in 2 hours');
  });

  it('uses hours up to exactly 23 hours', () => {
    expect(formatReturn(at(2026, 11, 21, 21, 0), NOW)).toBe('returns in 23 hours');
  });

  it('uses the day rule just over 23 hours', () => {
    expect(formatReturn(at(2026, 11, 21, 21, 0, 0, 1), NOW)).toBe('returns tomorrow');
  });

  it('calls a ghost due the next calendar day "tomorrow" even when it is under 24 hours of that day', () => {
    // 23 h 30 min ahead lands on the next calendar day.
    expect(formatReturn(at(2026, 11, 21, 21, 30), NOW)).toBe('returns tomorrow');
    // Due at 06:00 the next calendar day, more than 23 hours after a 06:30 clock.
    expect(formatReturn(at(2026, 11, 22, 6, 0), at(2026, 11, 21, 6, 30))).toBe('returns tomorrow');
  });

  it('counts a 27-hour gap across midnight as 2 days', () => {
    expect(formatReturn(NOW + 27 * 60 * MIN, NOW)).toBe('returns in 2 days');
  });

  it('handles long gaps', () => {
    expect(formatReturn(at(2027, 1, 19, 22, 0), NOW)).toBe('returns in 60 days');
  });

  it('counts calendar days across a month and year boundary', () => {
    expect(formatReturn(at(2027, 1, 2, 9, 0), at(2026, 12, 30, 9, 0))).toBe('returns in 3 days');
  });

  it('counts whole days in local time across a daylight-saving period', () => {
    expect(formatReturn(at(2026, 3, 30, 12, 0), at(2026, 3, 27, 12, 0))).toBe('returns in 3 days');
    expect(formatReturn(at(2026, 11, 3, 12, 0), at(2026, 10, 30, 12, 0))).toBe('returns in 4 days');
  });

  it('returns soon for non-finite input', () => {
    expect(formatReturn(Number.NaN, NOW)).toBe('returns soon');
    expect(formatReturn(Number.POSITIVE_INFINITY, NOW)).toBe('returns soon');
    expect(formatReturn(NOW, Number.NaN)).toBe('returns soon');
    expect(formatReturn(NOW, Number.NEGATIVE_INFINITY)).toBe('returns soon');
  });
});

function ghost(character: string, pinyin: string, meaning: string): CharacterRecord {
  return { character, prompt: { pinyin, meaning } } as unknown as CharacterRecord;
}

function entry(nextDue: number): ReviewEntry {
  return { step: 0, lastOutcome: 'clean', nextDue };
}

describe('buildReturnRows', () => {
  const a = ghost('一', 'yī', 'one');
  const b = ghost('二', 'èr', 'two (CL:個|个[ge4])');
  const c = ghost('三', 'sān', 'three');

  it('keeps the order of the ghosts, not of the map', () => {
    const entries = new Map<string, ReviewEntry>([
      ['三', entry(3)],
      ['一', entry(1)],
      ['二', entry(2)],
    ]);
    const rows = buildReturnRows([a, b, c], entries);
    expect(rows.map((r) => r.character)).toEqual(['一', '二', '三']);
    expect(rows.map((r) => r.nextDue)).toEqual([1, 2, 3]);
    expect(rows[0]).toEqual({ character: '一', pinyin: 'yī', meaning: 'one', nextDue: 1 });
  });

  it('skips ghosts without an entry', () => {
    const entries = new Map<string, ReviewEntry>([['三', entry(9)]]);
    expect(buildReturnRows([a, b, c], entries).map((r) => r.character)).toEqual(['三']);
  });

  it('cleans the meaning but does not mask the target', () => {
    const d = ghost('四', 'sì', 'four; the number 四');
    const entries = new Map<string, ReviewEntry>([
      ['二', entry(2)],
      ['四', entry(4)],
    ]);
    const rows = buildReturnRows([b, d], entries);
    expect(rows[0]?.meaning).toBe('two');
    expect(rows[1]?.meaning).toBe('four; the number 四');
  });

  it('returns no rows for no ghosts or an empty map', () => {
    expect(buildReturnRows([], new Map([['一', entry(1)]]))).toEqual([]);
    expect(buildReturnRows([a], new Map())).toEqual([]);
  });
});
