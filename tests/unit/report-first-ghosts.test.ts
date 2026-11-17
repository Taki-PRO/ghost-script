// Unit tests for the first-ghosts formatter (harder-ghosts, task 12.3).
//
// Requirements: 17.8
import { describe, expect, it } from 'vitest';
import type { CharacterRecord } from '../../app/src/data/types';
import { formatFirstGhosts } from '../../scripts/lib/report-first-ghosts';

type Rec = Pick<CharacterRecord, 'strokeCount' | 'prompt' | 'summonInk'>;

const rec = (strokeCount: number, meaning: string, pinyin: string): Rec => ({
  strokeCount,
  prompt: { meaning, pinyin },
  summonInk: { class: 'opaque' },
});

// Distinct stroke counts, all opaque, so learningOrder sorts by strokes.
const CHARS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千'];
const many: Record<string, Rec> = {};
[...CHARS].reverse().forEach((c, i) => {
  many[c] = rec(CHARS.length - i, `meaning-${c}`, `py-${c}`);
});

describe('formatFirstGhosts', () => {
  it('prints exactly ten rows, in learning order, with every field', () => {
    const lines = formatFirstGhosts(2, many).split('\n');
    expect(lines[0]).toBe('Level 2: first 10 of 12 ghosts');
    expect(lines).toHaveLength(11);
    expect(lines[1]).toBe(
      '1. 一  meaning: meaning-一  pinyin: py-一  summonInk: {"class":"opaque"}',
    );
    expect(lines[10].startsWith('10. 十  ')).toBe(true);
    expect(lines.join('\n')).not.toContain('百');
  });

  it('keeps the learning order, not the insertion order', () => {
    const lines = formatFirstGhosts(3, {
      乙: rec(5, 'm5', 'p5'),
      甲: rec(2, 'm2', 'p2'),
    }).split('\n');
    expect(lines[1].startsWith('1. 甲')).toBe(true);
    expect(lines[2].startsWith('2. 乙')).toBe(true);
  });

  it('prints every record when there are fewer than ten', () => {
    const lines = formatFirstGhosts(3, { 乙: rec(1, 'm', 'p') }).split('\n');
    expect(lines).toEqual([
      'Level 3: first 1 of 1 ghosts',
      '1. 乙  meaning: m  pinyin: p  summonInk: {"class":"opaque"}',
    ]);
  });
});
