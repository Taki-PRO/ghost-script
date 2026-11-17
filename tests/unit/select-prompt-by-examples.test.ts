// Unit tests for the Clue_Rule (task 15.1, Requirements 18.3 to 18.8 and 18.14)
// on small hand-built CC-CEDICT fixtures.
import { describe, it, expect } from 'vitest';
import type { CcCedictEntry, CcCedictSense } from '../../scripts/lib/parse-cc-cedict.js';
import {
  containsHan,
  isCrossReferenceGloss,
  normaliseSyllable,
  readingCounts,
  selectPromptByExamples,
  topReading,
} from '../../scripts/lib/select-prompt-by-examples.js';
import { selectPrompt } from '../../scripts/lib/prompt.js';

function entryOf(...senses: CcCedictSense[]): CcCedictEntry {
  return {
    pinyin: [...new Set(senses.map((s) => s.reading))],
    meanings: [...new Set(senses.flatMap((s) => s.meanings))],
    entries: senses,
  };
}

function dict(rows: Record<string, CcCedictSense[]>): Map<string, CcCedictEntry> {
  return new Map(Object.entries(rows).map(([k, v]) => [k, entryOf(...v)]));
}

function sense(reading: string, ...meanings: string[]): CcCedictSense {
  return { reading, meanings };
}

describe('normaliseSyllable', () => {
  it('lower-cases and reads u: and v as ü', () => {
    expect(normaliseSyllable('Lu:4')).toBe('lü4');
    expect(normaliseSyllable('nv3')).toBe('nü3');
    expect(normaliseSyllable('nü3')).toBe('nü3');
  });
});

describe('readingCounts', () => {
  const cc = dict({
    读: [sense('du2', 'to read')],
    读书: [sense('du2 shu1', 'to study')],
    阅读: [sense('yue4 du2', 'to read')],
    句读: [sense('ju4 dou4', 'pause')],
  });

  it('counts the syllable at the first occurrence position', () => {
    const counts = readingCounts('读', ['读', '读书', '阅读', '句读'], cc);
    expect(counts.get('du2')).toBe(3);
    expect(counts.get('dou4')).toBe(1);
  });

  it('skips words without the character or without a dictionary entry', () => {
    const counts = readingCounts('读', ['书', '读者'], cc);
    expect(counts.size).toBe(0);
  });

  it('ignores tone 5 and syllables without a tone digit 1 to 4', () => {
    const c = dict({ 了: [sense('le5', 'particle')], 了解: [sense('liao3 jie3', 'to understand')], 了x: [sense('le x', 'odd')] });
    const counts = readingCounts('了', ['了', '了解', '了x'], c);
    expect([...counts.entries()]).toEqual([['liao3', 1]]);
  });

  it('reads u: and ü as the same syllable', () => {
    const c = dict({ 绿: [sense('lu:4', 'green')], 绿色: [sense('lu:4 se4', 'green')], 叶绿: [sense('ye4 lü4', 'x')] });
    const counts = readingCounts('绿', ['绿', '绿色', '叶绿'], c);
    expect(counts.get('lü4')).toBe(3);
  });

  it('counts each matching entry of one word', () => {
    const c = dict({ 行: [sense('xing2', 'to walk'), sense('hang2', 'row')] });
    const counts = readingCounts('行', ['行'], c);
    expect(counts.get('xing2')).toBe(1);
    expect(counts.get('hang2')).toBe(1);
  });

  it('ignores an entry whose syllable count differs from the word length', () => {
    const c = dict({ 读书: [sense('du2', 'short'), sense('du2 shu1 x1', 'long'), sense('du2 shu1', 'ok')] });
    const counts = readingCounts('读', ['读书'], c);
    expect(counts.get('du2')).toBe(1);
  });
});

describe('topReading', () => {
  it('returns the clear majority', () => {
    expect(topReading(new Map([['du2', 3], ['dou4', 1]]))).toBe('du2');
  });
  it('returns undefined on a tie for the highest count', () => {
    expect(topReading(new Map([['a1', 2], ['b2', 2], ['c3', 1]]))).toBeUndefined();
  });
  it('ignores a tie below the highest count', () => {
    expect(topReading(new Map([['a1', 3], ['b2', 1], ['c3', 1]]))).toBe('a1');
  });
  it('returns undefined with no counts', () => {
    expect(topReading(new Map())).toBeUndefined();
  });
});

describe('isCrossReferenceGloss', () => {
  it.each([
    'variant of 豆[dou4]',
    'old variant of 豆',
    'see 豆',
    'used in 漂亮[piao4 liang5]',
    'surname Wang',
    'abbr. for something',
    'CL:只[zhi1]',
    'also pr. [x]',
    'Taiwan pr. [x]',
    'VARIANT OF x',
    'a thing (Tw)',
    'a thing (archaic)',
  ])('rejects %s', (gloss) => {
    expect(isCrossReferenceGloss(gloss)).toBe(true);
  });
  it('accepts an ordinary gloss', () => {
    expect(isCrossReferenceGloss('bird')).toBe(false);
    expect(isCrossReferenceGloss('to see off')).toBe(false);
  });
});

describe('containsHan', () => {
  it('detects Han characters including 〇', () => {
    expect(containsHan('a 的 b')).toBe(true);
    expect(containsHan('〇')).toBe(true);
    expect(containsHan('bird, ü～')).toBe(false);
  });
});

describe('selectPromptByExamples', () => {
  const bird = entryOf(
    sense('diao3', 'penis'),
    sense('niao3', 'bird', 'CL:只[zhi1]'),
  );
  const birdCc = dict({ 鸟: [sense('niao3', 'bird')], 鸟巢: [sense('niao3 chao2', "bird's nest")] });

  it('picks the majority reading and its first clean gloss', () => {
    const result = selectPromptByExamples('鸟', bird, ['鸟', '鸟巢'], birdCc);
    expect(result).toEqual({
      ok: true,
      choice: { meaning: 'bird', pinyin: 'niǎo', entryIndex: 1, meaningIndex: 0, fromOverride: false },
    });
  });

  it('keeps the Current_Rule reading on a tie', () => {
    const cc = dict({ 鸟: [sense('niao3', 'x')], 鸟巢: [sense('diao3 chao2', 'y')] });
    const result = selectPromptByExamples('鸟', bird, ['鸟', '鸟巢'], cc);
    expect(result).toEqual(selectPrompt('鸟', bird, undefined));
    expect(result.ok && result.choice.meaning).toBe('penis');
  });

  it('keeps the Current_Rule reading with no usable example', () => {
    expect(selectPromptByExamples('鸟', bird, [], new Map())).toEqual(selectPrompt('鸟', bird, undefined));
  });

  it('ignores neutral-tone examples', () => {
    const e = entryOf(sense('le5', 'particle'), sense('liao3', 'to finish'));
    const cc = dict({ 了: [sense('le5', 'p')], 了解: [sense('liao3 jie3', 'u')] });
    const result = selectPromptByExamples('了', e, ['了', '了解'], cc);
    expect(result.ok && result.choice.pinyin).toBe('liǎo');
  });

  it('matches u: in the entry against ü in the counts', () => {
    const e = entryOf(sense('lu4', 'road'), sense('lu:4', 'green'));
    const cc = dict({ 绿色: [sense('lü4 se4', 'green')] });
    const result = selectPromptByExamples('绿', e, ['绿色'], cc);
    expect(result.ok && result.choice).toMatchObject({ meaning: 'green', pinyin: 'lǜ', entryIndex: 1 });
  });

  it('skips a proper-noun entry even when its reading matches', () => {
    const e = entryOf(sense('Wang2', 'Wang (surname)x', 'Proper'), sense('wang2', 'king'));
    const cc = dict({ 王子: [sense('wang2 zi3', 'prince')] });
    const result = selectPromptByExamples('王', e, ['王子'], cc);
    expect(result.ok && result.choice).toMatchObject({ meaning: 'king', entryIndex: 1 });
  });

  it('skips a cross-reference gloss and takes the next clean gloss', () => {
    const e = entryOf(sense('niao3', 'variant of 鸟', 'see 鸟', 'bird'));
    const cc = dict({ 鸟: [sense('niao3', 'bird')] });
    const result = selectPromptByExamples('鸟', e, ['鸟'], cc);
    expect(result.ok && result.choice).toMatchObject({ meaning: 'bird', meaningIndex: 2 });
  });

  it('skips a gloss with a Han character', () => {
    const e = entryOf(sense('de5', 'equivalent to 的 as particle', 'possessive particle'));
    const cc = dict({ 的: [sense('de5', 'x')], 目的: [sense('mu4 di4', 'aim')] });
    const result = selectPromptByExamples('得', e, ['目的'], cc);
    expect(result.ok && result.choice.meaning).toBe('possessive particle');
  });

  it('keeps a gloss whose only Chinese text is a (CL:...) note, stored raw', () => {
    const e = entryOf(sense('zhi1', 'bird (CL:只[zhi1])'));
    const cc = dict({ 只: [sense('zhi1', 'x')] });
    const result = selectPromptByExamples('只', e, ['只'], cc);
    expect(result.ok && result.choice.meaning).toBe('bird (CL:只[zhi1])');
  });

  it('removes one leading (bound form) from the chosen gloss', () => {
    const e = entryOf(sense('niao3', '(bound form) bird'));
    const cc = dict({ 鸟: [sense('niao3', 'x')] });
    const result = selectPromptByExamples('鸟', e, ['鸟'], cc);
    expect(result.ok && result.choice.meaning).toBe('bird');
  });

  it('uses the next entry with the same reading when the first has no clean gloss', () => {
    const e = entryOf(
      sense('du2', 'variant of 毒'),
      sense('dou4', 'comma'),
      sense('du2', 'to read'),
    );
    const cc = dict({ 读书: [sense('du2 shu1', 's')], 阅读: [sense('yue4 du2', 'r')] });
    const result = selectPromptByExamples('读', e, ['读书', '阅读'], cc);
    expect(result.ok && result.choice).toMatchObject({ meaning: 'to read', entryIndex: 2, meaningIndex: 0 });
  });

  it('falls back to the Current_Rule when no entry with the reading has a clean gloss', () => {
    const e = entryOf(sense('pian1', 'slip'), sense('piao4', 'used in 漂亮[piao4 liang5]'));
    const cc = dict({ 漂亮: [sense('piao4 liang5', 'pretty')] });
    const result = selectPromptByExamples('漂', e, ['漂亮'], cc);
    expect(result).toEqual(selectPrompt('漂', e, undefined));
    expect(result.ok && result.choice.meaning).toBe('slip');
  });

  it('returns the Current_Rule failure unchanged', () => {
    const e = entryOf(sense('Wang2', 'surname Wang'));
    expect(selectPromptByExamples('王', e, ['王'], new Map())).toEqual({ ok: false, reason: 'no-usable-sense' });
  });
});
