import { describe, expect, it } from 'vitest';
import { combineOutcomes, resolveCompletion } from './outcome';
import type { Outcome } from './scheduler';

describe('resolveCompletion', () => {
  const config = { cleanMistakeThreshold: 2 };

  it('is clean at the threshold with no hint', () => {
    expect(resolveCompletion(false, 0, config)).toBe('clean');
    expect(resolveCompletion(false, 2, config)).toBe('clean');
  });

  it('is struggled just above the threshold', () => {
    expect(resolveCompletion(false, 3, config)).toBe('struggled');
  });

  it('is struggled whenever a hint was shown, even with zero mistakes', () => {
    expect(resolveCompletion(true, 0, config)).toBe('struggled');
    expect(resolveCompletion(true, 5, config)).toBe('struggled');
  });
});

describe('combineOutcomes truth table', () => {
  const cases: [Outcome | null, Outcome, Outcome][] = [
    [null, 'clean', 'clean'],
    [null, 'struggled', 'struggled'],
    [null, 'gave-up', 'gave-up'],
    ['clean', 'clean', 'clean'],
    ['clean', 'struggled', 'struggled'],
    ['clean', 'gave-up', 'gave-up'],
    ['struggled', 'clean', 'struggled'],
    ['struggled', 'struggled', 'struggled'],
    ['struggled', 'gave-up', 'gave-up'],
    ['gave-up', 'clean', 'gave-up'],
    ['gave-up', 'struggled', 'gave-up'],
    ['gave-up', 'gave-up', 'gave-up'],
  ];

  it.each(cases)('summon=%s, write=%s -> %s', (summon, write, expected) => {
    expect(combineOutcomes(summon, write)).toBe(expected);
  });
});
