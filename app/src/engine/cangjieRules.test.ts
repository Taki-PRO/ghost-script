import { describe, expect, it } from 'vitest';
import {
  CANGJIE_CODE_PATTERN,
  CANGJIE_KEYS,
  isPlayableInCangjie,
  isValidCangjieCode,
} from './cangjieRules';

describe('isValidCangjieCode', () => {
  it.each(['A', 'HXH', 'XRSLN', 'YYYYY', 'HQI'])('accepts %s', (code) => {
    expect(isValidCangjieCode(code)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['six keys', 'ABCDEF'],
    ['lower case', 'hxh'],
    ['mixed case', 'Hxh'],
    ['contains Z', 'AZ'],
    ['only Z', 'Z'],
    ['digit', 'A1'],
    ['space', 'A B'],
    ['trailing newline', 'A\n'],
  ])('rejects %s', (_label, code) => {
    expect(isValidCangjieCode(code)).toBe(false);
  });

  it('exposes the pattern', () => {
    expect(CANGJIE_CODE_PATTERN.source).toBe('^[A-Y]{1,5}$');
  });
});

describe('isPlayableInCangjie', () => {
  it('is true for HXH', () => {
    expect(isPlayableInCangjie('HXH')).toBe(true);
  });

  it('is false for codes starting with X', () => {
    expect(isPlayableInCangjie('XRSLN')).toBe(false);
    expect(isPlayableInCangjie('XCTA')).toBe(false);
  });

  it('is false for null', () => {
    expect(isPlayableInCangjie(null)).toBe(false);
  });

  it('is true when X is not the first key', () => {
    expect(isPlayableInCangjie('AX')).toBe(true);
  });
});

describe('CANGJIE_KEYS', () => {
  it('has 25 entries, X is 難 and the other 24 shapes are distinct', () => {
    expect(CANGJIE_KEYS).toHaveLength(25);
    expect(CANGJIE_KEYS.find((k) => k.key === 'X')?.shape).toBe('難');
    const others = CANGJIE_KEYS.filter((k) => k.key !== 'X').map((k) => k.shape);
    expect(others).toHaveLength(24);
    expect(new Set(others).size).toBe(24);
  });
});
