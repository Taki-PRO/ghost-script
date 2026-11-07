import { describe, it, expect } from 'vitest';
import {
  parseCharacterList,
  type CharacterListError,
} from '../../scripts/lib/parse-character-list';

describe('parseCharacterList', () => {
  it('returns ok: true with the correct character array for a valid list', () => {
    const result = parseCharacterList('我\n你\n好\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.characters).toEqual(['我', '你', '好']);
    }
  });

  it('strips comment (#) and blank lines', () => {
    const raw = ['# HSK 3.0 handwriting characters', '', '我', '  ', '# another comment', '你', ''].join('\n');
    const result = parseCharacterList(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.characters).toEqual(['我', '你']);
    }
  });

  it('accepts real lines read from the shipped character list shape', () => {
    // Mirrors the header + body shape of data/character-list.txt (real characters).
    const raw = ['# Source: ivankra/hsk30', '# Licence: MIT', '爱', '八', '爸'].join('\n');
    const result = parseCharacterList(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.characters).toEqual(['爱', '八', '爸']);
    }
  });

  it('returns a not-cjk error at the right line for a non-CJK codepoint', () => {
    // Line 1: 我, line 2: "a" (Latin, not CJK), line 3: 好
    const result = parseCharacterList('我\na\n好');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<CharacterListError[]>([
        { line: 2, character: 'a', reason: 'not-cjk' },
      ]);
    }
  });

  it('flags a multi-character line as not-cjk', () => {
    const result = parseCharacterList('我\n你好');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<CharacterListError[]>([
        { line: 2, character: '你好', reason: 'not-cjk' },
      ]);
    }
  });

  it('returns a duplicate error at the line of the repeat occurrence', () => {
    // Line 1: 我, line 2: 你, line 3: 我 (duplicate)
    const result = parseCharacterList('我\n你\n我');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<CharacterListError[]>([
        { line: 3, character: '我', reason: 'duplicate' },
      ]);
    }
  });

  it('returns ALL errors for mixed valid and multiple invalid input', () => {
    // 1: 我 (ok), 2: x (not-cjk), 3: 你 (ok), 4: 我 (duplicate), 5: 1 (not-cjk)
    const raw = ['我', 'x', '你', '我', '1'].join('\n');
    const result = parseCharacterList(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual<CharacterListError[]>([
        { line: 2, character: 'x', reason: 'not-cjk' },
        { line: 4, character: '我', reason: 'duplicate' },
        { line: 5, character: '1', reason: 'not-cjk' },
      ]);
    }
  });
});
