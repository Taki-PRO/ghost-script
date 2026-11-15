import { describe, expect, it } from 'vitest';
import {
  applyKeyEntry,
  applyKeyEvent,
  giveUpSummon,
  isKeyHintVisible,
  nextExpectedKey,
  startSummon,
  type CangjieKey,
  type KeyEventLike,
  type SummonState,
} from './cangjie';
import { DEFAULT_CONFIG } from './config';

const cfg = DEFAULT_CONFIG;

function enter(state: SummonState, keys: string): SummonState {
  return [...keys].reduce((s, k) => applyKeyEntry(s, k as CangjieKey, cfg), state);
}

const ev = (over: Partial<KeyEventLike>): KeyEventLike => ({
  key: 'a',
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  isComposing: false,
  ...over,
});

describe('Summon reducer', () => {
  it('starts active with nothing filled', () => {
    const s = startSummon('HQI');
    expect(s).toEqual({
      code: 'HQI', filled: 0, mistakes: 0, missesOnSlot: 0, hintShown: false, status: 'active',
    });
    expect(nextExpectedKey(s)).toBe('H');
  });

  it('full correct entry is clean and resolves', () => {
    const s = enter(startSummon('HQI'), 'HQI');
    expect(s.status).toBe('clean');
    expect(s.filled).toBe(3);
    expect(nextExpectedKey(s)).toBeNull();
  });

  it('single-key code resolves on one key', () => {
    expect(enter(startSummon('R'), 'R').status).toBe('clean');
  });

  it('a wrong key adds one mistake and one miss, leaving slots unchanged', () => {
    const before = startSummon('HQI');
    const after = applyKeyEntry(before, 'A', cfg);
    expect(after.mistakes).toBe(1);
    expect(after.missesOnSlot).toBe(1);
    expect(after.filled).toBe(0);
    expect(after.status).toBe('active');
    expect(before.mistakes).toBe(0);
  });

  it('a correct key resets missesOnSlot', () => {
    const s = enter(startSummon('HQI'), 'AAH');
    expect(s.missesOnSlot).toBe(0);
    expect(s.mistakes).toBe(2);
    expect(s.filled).toBe(1);
  });

  it('Key hint is hidden after 2 consecutive misses and visible after 3', () => {
    const two = enter(startSummon('HXH'), 'AA');
    expect(isKeyHintVisible(two, cfg)).toBe(false);
    expect(two.hintShown).toBe(false);
    const three = enter(two, 'A');
    expect(isKeyHintVisible(three, cfg)).toBe(true);
    expect(three.hintShown).toBe(true);
  });

  it('non-consecutive misses do not show the hint', () => {
    const s = enter(startSummon('HXH'), 'AAHAA');
    expect(isKeyHintVisible(s, cfg)).toBe(false);
    expect(s.hintShown).toBe(false);
  });

  it('hint disappears once the slot is filled but still gives struggled', () => {
    let s = enter(startSummon('HXH'), 'AAA');
    expect(isKeyHintVisible(s, cfg)).toBe(true);
    s = enter(s, 'H');
    expect(isKeyHintVisible(s, cfg)).toBe(false);
    expect(s.hintShown).toBe(true);
    expect(enter(s, 'XH').status).toBe('struggled');
  });

  it('mistakes at the threshold stay clean, above it give struggled', () => {
    const atThreshold = enter(startSummon('HQI'), 'AHBQI');
    expect(atThreshold.mistakes).toBe(2);
    expect(atThreshold.status).toBe('clean');
    const above = enter(startSummon('HQI'), 'AHBQCI');
    expect(above.mistakes).toBe(3);
    expect(above.status).toBe('struggled');
  });

  it('Give up gives gave-up and later entries change nothing', () => {
    const gave = giveUpSummon(enter(startSummon('HQI'), 'H'));
    expect(gave.status).toBe('gave-up');
    expect(isKeyHintVisible(gave, cfg)).toBe(false);
    expect(nextExpectedKey(gave)).toBeNull();
    expect(applyKeyEntry(gave, 'Q', cfg)).toBe(gave);
    expect(applyKeyEntry(gave, 'A', cfg)).toBe(gave);
    expect(giveUpSummon(gave)).toBe(gave);
  });

  it('entries after the Step result change nothing', () => {
    const done = enter(startSummon('R'), 'R');
    expect(applyKeyEntry(done, 'A', cfg)).toBe(done);
    expect(applyKeyEntry(done, 'R', cfg)).toBe(done);
    expect(giveUpSummon(done)).toBe(done);
  });

  it('applyKeyEvent advances on a plain letter, either case', () => {
    expect(applyKeyEvent(startSummon('HQI'), ev({ key: 'h' }), cfg).filled).toBe(1);
    expect(applyKeyEvent(startSummon('HQI'), ev({ key: 'H' }), cfg).filled).toBe(1);
  });

  it('applyKeyEvent returns the same state for Z and modified keys', () => {
    const s = startSummon('HQI');
    expect(applyKeyEvent(s, ev({ key: 'z' }), cfg)).toBe(s);
    expect(applyKeyEvent(s, ev({ key: 'h', ctrlKey: true }), cfg)).toBe(s);
    expect(applyKeyEvent(s, ev({ key: 'h', metaKey: true }), cfg)).toBe(s);
    expect(applyKeyEvent(s, ev({ key: 'h', altKey: true }), cfg)).toBe(s);
    expect(applyKeyEvent(s, ev({ key: 'h', repeat: true }), cfg)).toBe(s);
    expect(applyKeyEvent(s, ev({ key: 'Process', isComposing: true }), cfg)).toBe(s);
  });
});
