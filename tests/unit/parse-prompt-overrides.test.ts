import { describe, it, expect } from 'vitest';
import {
  parsePromptOverrides,
  type PromptOverrideError,
} from '../../scripts/lib/parse-prompt-overrides';

const HEADER = 'character,entryIndex,meaningIndex,reviewedBy';

describe('parsePromptOverrides', () => {
  it('parses a valid CSV (header + 2 rows) into a map keyed by character', () => {
    const raw = [HEADER, '三,0,1,alice', '后,2,0,bob', ''].join('\n');
    const result = parsePromptOverrides(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.overrides.size).toBe(2);
      expect(result.overrides.get('三')).toEqual({
        character: '三',
        entryIndex: 0,
        meaningIndex: 1,
        reviewedBy: 'alice',
      });
      expect(result.overrides.get('后')).toEqual({
        character: '后',
        entryIndex: 2,
        meaningIndex: 0,
        reviewedBy: 'bob',
      });
    }
  });

  it('flags a malformed row with the wrong column count', () => {
    const raw = [HEADER, '三,0,alice'].join('\n');
    const result = parsePromptOverrides(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<PromptOverrideError[]>([
        { line: 2, character: '三,0,alice', reason: 'malformed-row' },
      ]);
    }
  });

  it('flags a malformed row with a non-integer index', () => {
    const raw = [HEADER, '三,x,1,alice'].join('\n');
    const result = parsePromptOverrides(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<PromptOverrideError[]>([
        { line: 2, character: '三', reason: 'malformed-row' },
      ]);
    }
  });

  it('flags a missing reviewer (empty 4th column)', () => {
    const raw = [HEADER, '三,0,1,'].join('\n');
    const result = parsePromptOverrides(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<PromptOverrideError[]>([
        { line: 2, character: '三', reason: 'missing-reviewer' },
      ]);
    }
  });

  it('flags a duplicate character at the repeat occurrence line', () => {
    const raw = [HEADER, '三,0,1,alice', '三,1,0,bob'].join('\n');
    const result = parsePromptOverrides(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<PromptOverrideError[]>([
        { line: 3, character: '三', reason: 'duplicate-character' },
      ]);
    }
  });

  it('flags a wrong header as malformed-row at line 1', () => {
    const raw = ['character,entry,meaning,reviewer', '三,0,1,alice'].join('\n');
    const result = parsePromptOverrides(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.line === 1 && e.reason === 'malformed-row')).toBe(true);
    }
  });

  it('flags a missing header (empty file) as malformed-row at line 1', () => {
    const result = parsePromptOverrides('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<PromptOverrideError[]>([
        { line: 1, character: '', reason: 'malformed-row' },
      ]);
    }
  });
});
