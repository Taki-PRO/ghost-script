import { describe, expect, it } from 'vitest';
import {
  CANGJIE_KEYS,
  KEY_FACE_CHARACTERS,
  parseKeyEvent,
  type KeyEventLike,
} from './cangjie';

const ev = (over: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key: 'a',
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  repeat: false,
  isComposing: false,
  ...over,
});

describe('CANGJIE_KEYS', () => {
  it('has 25 entries, A to Y, with no Z', () => {
    expect(CANGJIE_KEYS).toHaveLength(25);
    expect(CANGJIE_KEYS.map((k) => k.key).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXY');
    expect(CANGJIE_KEYS.some((k) => (k.key as string) === 'Z')).toBe(false);
  });

  it('maps each key to its shape', () => {
    const expected = '日月金木水火土竹戈十大中一弓人心手口尸廿山女田難卜';
    expect(CANGJIE_KEYS.map((k) => k.shape).join('')).toBe(expected);
    const byKey = Object.fromEntries(CANGJIE_KEYS.map((k) => [k.key, k.shape]));
    expect(byKey.A).toBe('日');
    expect(byKey.M).toBe('一');
    expect(byKey.Y).toBe('卜');
  });

  it('shows X as 難', () => {
    expect(CANGJIE_KEYS.find((k) => k.key === 'X')?.shape).toBe('難');
  });
});

describe('KEY_FACE_CHARACTERS', () => {
  it('contains the key-face characters used by the dataset and 難', () => {
    for (const c of [...'一中人十口大女山手日月木水火', '難']) {
      expect(KEY_FACE_CHARACTERS.has(c)).toBe(true);
    }
  });

  it('has one entry per key and excludes other characters', () => {
    expect(KEY_FACE_CHARACTERS.size).toBe(25);
    expect(KEY_FACE_CHARACTERS.has('我')).toBe(false);
  });
});

describe('parseKeyEvent', () => {
  it('returns the upper-case letter for lower- and upper-case A–Y', () => {
    expect(parseKeyEvent(ev({ key: 'a' }))).toBe('A');
    expect(parseKeyEvent(ev({ key: 'A' }))).toBe('A');
    expect(parseKeyEvent(ev({ key: 'y' }))).toBe('Y');
    expect(parseKeyEvent(ev({ key: 'X' }))).toBe('X');
  });

  it('ignores Z in either case', () => {
    expect(parseKeyEvent(ev({ key: 'z' }))).toBeNull();
    expect(parseKeyEvent(ev({ key: 'Z' }))).toBeNull();
  });

  it('ignores Ctrl, Alt and Meta', () => {
    expect(parseKeyEvent(ev({ ctrlKey: true }))).toBeNull();
    expect(parseKeyEvent(ev({ altKey: true }))).toBeNull();
    expect(parseKeyEvent(ev({ metaKey: true }))).toBeNull();
  });

  it('ignores repeat and composition events', () => {
    expect(parseKeyEvent(ev({ repeat: true }))).toBeNull();
    expect(parseKeyEvent(ev({ isComposing: true }))).toBeNull();
  });

  it('ignores key "Process"', () => {
    expect(parseKeyEvent(ev({ key: 'Process' }))).toBeNull();
  });

  it('ignores non-letters and multi-character key names', () => {
    for (const key of ['1', ' ', 'Enter', 'Shift', 'Backspace', '我', '']) {
      expect(parseKeyEvent(ev({ key }))).toBeNull();
    }
  });
});
