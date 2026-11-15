// Unit tests for parseUnihanCangjie.
//
// valid.txt holds lines copied verbatim from
// data/raw/unihan/Unihan_DictionaryLikeData.txt (Unicode 18.0.0); the other
// fixtures are synthetic. See tests/fixtures/README.md for provenance.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseUnihanCangjie } from '../../scripts/lib/parse-unihan.js';

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../fixtures/unihan/${name}`, import.meta.url)),
    'utf8',
  );
}

describe('parseUnihanCangjie', () => {
  it('returns the verbatim kCangjie values from real Unihan lines', () => {
    const map = parseUnihanCangjie(fixture('valid.txt'));
    expect(map.get('我')).toEqual(['HQI']);
    expect(map.get('一')).toEqual(['M']);
    expect(map.get('人')).toEqual(['O']);
    expect(map.get('口')).toEqual(['R']);
    expect(map.get('了')).toEqual(['NN']);
    expect(map.get('三')).toEqual(['MMM']);
    expect(map.get('中')).toEqual(['L']);
    expect(map.get('后')).toEqual(['HMR']);
    expect(map.get('号')).toEqual(['RMVS']);
    expect(map.get('行')).toEqual(['HOMMN']);
    expect(map.get('㐆')).toEqual(['HSMS']);
  });

  it('keeps only characters that have a kCangjie line', () => {
    const map = parseUnihanCangjie(fixture('valid.txt'));
    expect(map.size).toBe(11);
  });

  it('skips comment lines and lines for other fields', () => {
    const text = '# U+6211\tkCangjie\tZZZ\nU+6211\tkFenn\t338A\nU+6211\tkCangjie\tHQI\n';
    const map = parseUnihanCangjie(text);
    expect([...map.keys()]).toEqual(['我']);
    expect(map.get('我')).toEqual(['HQI']);
  });

  it('collects duplicate lines for one character in source order', () => {
    const map = parseUnihanCangjie(fixture('duplicate-value.txt'));
    expect(map.get('我')).toEqual(['HQI', 'HQIO']);
    expect(map.get('一')).toEqual(['M']);
  });

  it('returns malformed values unchanged, without validating them', () => {
    const map = parseUnihanCangjie(fixture('malformed-value.txt'));
    expect(map.get('一')).toEqual(['m1']);
    expect(map.get('人')).toEqual(['']);
    expect(map.get('口')).toEqual(['R S']);
  });

  it('does not infer a code for a character with no kCangjie line', () => {
    const map = parseUnihanCangjie(fixture('missing-character.txt'));
    expect(map.has('人')).toBe(false);
    expect(map.get('一')).toEqual(['M']);
  });

  it('returns an empty map for empty input', () => {
    expect(parseUnihanCangjie('').size).toBe(0);
  });

  it('handles CRLF line endings', () => {
    const map = parseUnihanCangjie('U+4E00\tkCangjie\tM\r\nU+4EBA\tkCangjie\tO\r\n');
    expect(map.get('一')).toEqual(['M']);
    expect(map.get('人')).toEqual(['O']);
  });

  it('converts codepoints beyond the BMP with String.fromCodePoint', () => {
    const map = parseUnihanCangjie('U+20000\tkCangjie\tABC\n');
    expect(map.get('\u{20000}')).toEqual(['ABC']);
  });
});
