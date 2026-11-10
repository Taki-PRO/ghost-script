import { describe, expect, it } from 'vitest';
import { DAY_MS, DEFAULT_CONFIG } from './config';

describe('DEFAULT_CONFIG', () => {
  it('has the documented default values', () => {
    expect(DAY_MS).toBe(86_400_000);
    expect(DEFAULT_CONFIG.cleanMistakeThreshold).toBe(2);
    expect(DEFAULT_CONFIG.strokeHintAfterConsecutiveMisses).toBe(3);
    expect(DEFAULT_CONFIG.relearnDelayMs).toBe(600_000);
    expect(DEFAULT_CONFIG.newPerSessionCap).toBe(5);
    expect(DEFAULT_CONFIG.sessionSize).toBe(10);
  });

  it('has a 6-step strictly ascending ladder of 1,3,7,14,30,60 days', () => {
    const ladder = DEFAULT_CONFIG.intervalLadderMs;
    expect(ladder).toHaveLength(6);
    expect(ladder.map((ms) => ms / DAY_MS)).toEqual([1, 3, 7, 14, 30, 60]);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]).toBeGreaterThan(ladder[i - 1]);
    }
  });
});
