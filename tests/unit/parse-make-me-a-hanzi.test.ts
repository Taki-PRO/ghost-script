import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  extractLeafComponents,
  parseMakeMeAHanzi,
} from '../../scripts/lib/parse-make-me-a-hanzi';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(
  here,
  '../fixtures/make-me-a-hanzi/sample-dictionary.txt'
);
const sampleDictionary = readFileSync(fixturePath, 'utf8');

describe('parseMakeMeAHanzi', () => {
  const entries = parseMakeMeAHanzi(sampleDictionary);

  it('parses a non-atomic entry with a normal IDS decomposition', () => {
    const entry = entries.get('我');
    expect(entry).toBeDefined();
    // Verbatim decomposition string and radical from the source line.
    expect(entry?.decomposition).toBe('⿰扌戈');
    expect(entry?.radical).toBe('戈');
    expect(entry?.atomic).toBe(false);
    // Leaf components extracted left-to-right, IDC ⿰ excluded.
    expect(entry?.components).toEqual(['扌', '戈']);
  });

  it('classifies an entry whose decomposition is ？ as atomic', () => {
    const entry = entries.get('一');
    expect(entry).toBeDefined();
    expect(entry?.decomposition).toBe('？');
    expect(entry?.atomic).toBe(true);
    // Atomic entries have exactly one component equal to the character.
    expect(entry?.components).toEqual(['一']);
  });

  it('excludes an interior ？ from the components of a non-atomic entry', () => {
    const entry = entries.get('㐆');
    expect(entry).toBeDefined();
    // Source decomposition is "⿻尸？" — the interior ？ must not appear.
    expect(entry?.decomposition).toBe('⿻尸？');
    expect(entry?.atomic).toBe(false);
    expect(entry?.components).toEqual(['尸']);
    expect(entry?.components).not.toContain('？');
  });

  it('skips malformed JSON lines (character absent from the Map)', () => {
    const raw = [
      '{"character":"好","decomposition":"⿰女子","radical":"女","matches":null}',
      '{ this is not valid json',
      '', // blank line
      '{"character":"你","decomposition":"⿰亻尔","radical":"亻","matches":null}',
    ].join('\n');

    const parsed = parseMakeMeAHanzi(raw);

    expect(parsed.has('好')).toBe(true);
    expect(parsed.has('你')).toBe(true);
    // The malformed line contributes no entry and does not throw.
    expect(parsed.size).toBe(2);
  });

  it('skips lines that parse to JSON but fail the shape guard', () => {
    const raw = [
      '{"character":"好","decomposition":"⿰女子","radical":"女"}',
      '{"character":"nope","decomposition":123}', // decomposition not a string
      '42', // valid JSON, wrong shape
    ].join('\n');

    const parsed = parseMakeMeAHanzi(raw);

    expect(parsed.size).toBe(1);
    expect(parsed.has('好')).toBe(true);
  });
});

describe('extractLeafComponents', () => {
  it('excludes Ideographic Description Characters (U+2FF0–U+2FFB)', () => {
    // ⿰ (U+2FF0) and ⿱ (U+2FF1) are IDCs and must be dropped.
    expect(extractLeafComponents('⿰扌戈')).toEqual(['扌', '戈']);
    expect(extractLeafComponents('⿱女子')).toEqual(['女', '子']);
  });

  it('excludes the placeholder ？ (U+FF1F)', () => {
    expect(extractLeafComponents('⿻尸？')).toEqual(['尸']);
    expect(extractLeafComponents('？')).toEqual([]);
  });

  it('preserves left-to-right first-occurrence order and de-dupes repeats', () => {
    // Crafted IDS string of real CJK codepoints with IDCs and a repeat.
    // ⿰ and ⿱ are IDCs (skipped); 戈 appears twice (kept once, first position).
    const ids = '⿰戈⿱扌戈尸';
    expect(extractLeafComponents(ids)).toEqual(['戈', '扌', '尸']);
  });

  it('keeps components across the recognised CJK/radical/stroke blocks', () => {
    // 我 U+6211 (CJK Unified), 㐆 U+3406 (CJK Ext A).
    expect(extractLeafComponents('⿰我㐆')).toEqual(['我', '㐆']);
  });
});
