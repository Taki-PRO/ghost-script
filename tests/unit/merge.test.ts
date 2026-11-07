// Unit tests for mergeCharacter (scripts/lib/merge.ts).
//
// These are logic tests: the parser entry objects are hand-built in-memory
// values conforming to the parser types, not dataset fixtures. They verify the
// pure merge behaviour — required-field detection and correct record wiring.

import { describe, it, expect } from 'vitest';

import { mergeCharacter } from '../../scripts/lib/merge';
import type { HanziWriterEntry } from '../../scripts/lib/parse-hanzi-writer-data';
import type { MakeMeAHanziEntry } from '../../scripts/lib/parse-make-me-a-hanzi';
import type { CcCedictEntry } from '../../scripts/lib/parse-cc-cedict';
import type { Prompt } from '../../app/src/data/types';

const CHAR = '好';
const PROMPT: Prompt = { meaning: 'good', pinyin: 'hǎo' };

function makeHanziWriter(): HanziWriterEntry {
  return {
    strokes: ['M 100 200 L 300 400', 'M 400 500 L 600 700', 'M 10 20 L 30 40'],
    medians: [
      [
        [100, 200],
        [300, 400],
      ],
      [
        [400, 500],
        [600, 700],
      ],
      [
        [10, 20],
        [30, 40],
      ],
    ],
    radStrokes: [0, 1],
  };
}

function makeMakeMeAHanzi(): MakeMeAHanziEntry {
  return {
    decomposition: '⿰女子',
    radical: '女',
    etymology: { type: 'ideographic', hint: 'woman and child' },
    matches: [[0], [1]],
    atomic: false,
    components: ['女', '子'],
  };
}

function makeCcCedict(): CcCedictEntry {
  return {
    pinyin: ['hao3', 'hao4'],
    meanings: ['good', 'to like'],
    entries: [
      { reading: 'hao3', meanings: ['good'] },
      { reading: 'hao4', meanings: ['to like'] },
    ],
  };
}

describe('mergeCharacter', () => {
  it('returns ok with a fully-wired record and correct sources when all fields present', () => {
    const hw = makeHanziWriter();
    const mm = makeMakeMeAHanzi();
    const cc = makeCcCedict();

    const result = mergeCharacter(CHAR, hw, mm, cc, PROMPT);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok result');
    }

    const { record } = result;

    // prompt is placed into the record verbatim.
    expect(record.prompt).toEqual(PROMPT);

    // sources must be exactly the required mapping.
    expect(record.sources).toEqual({
      pinyin: 'cc-cedict',
      meanings: 'cc-cedict',
      strokeCount: 'hanzi-writer-data',
      strokeData: 'hanzi-writer-data',
      decomposition: 'make-me-a-hanzi',
    });

    // Top-level wiring.
    expect(record.character).toBe(CHAR);
    expect(record.pinyin).toEqual(['hao3', 'hao4']);
    expect(record.meanings).toEqual(['good', 'to like']);

    // strokeCount derives from strokes.length.
    expect(record.strokeCount).toBe(hw.strokes.length);
    expect(record.strokeCount).toBe(3);

    // strokeData wired verbatim from the hanzi-writer entry.
    expect(record.strokeData).toEqual({
      strokes: hw.strokes,
      medians: hw.medians,
      radStrokes: hw.radStrokes,
    });

    // decomposition wired verbatim from the make-me-a-hanzi entry.
    expect(record.decomposition).toEqual({
      decomposition: mm.decomposition,
      radical: mm.radical,
      etymology: mm.etymology,
      matches: mm.matches,
      atomic: mm.atomic,
      components: mm.components,
    });
  });

  it('returns failure listing pinyin and meanings when ccCedict is missing', () => {
    const result = mergeCharacter(CHAR, makeHanziWriter(), makeMakeMeAHanzi(), undefined, PROMPT);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure result');
    }
    expect(result.missingFields).toEqual(['pinyin', 'meanings']);
  });

  it('returns failure listing strokeCount and strokeData when hanziWriter is missing', () => {
    const result = mergeCharacter(CHAR, undefined, makeMakeMeAHanzi(), makeCcCedict(), PROMPT);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure result');
    }
    expect(result.missingFields).toEqual(['strokeCount', 'strokeData']);
  });

  it('returns failure listing decomposition when makeMeAHanzi is missing', () => {
    const result = mergeCharacter(CHAR, makeHanziWriter(), undefined, makeCcCedict(), PROMPT);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure result');
    }
    expect(result.missingFields).toEqual(['decomposition']);
  });

  it('lists all five required fields in stable order when all three entries are undefined', () => {
    const result = mergeCharacter(CHAR, undefined, undefined, undefined, PROMPT);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure result');
    }
    expect(result.missingFields).toEqual([
      'pinyin',
      'meanings',
      'strokeCount',
      'strokeData',
      'decomposition',
    ]);
  });

  it('treats an empty pinyin array as a missing pinyin field', () => {
    const cc: CcCedictEntry = {
      pinyin: [],
      meanings: ['good'],
      entries: [{ reading: '', meanings: ['good'] }],
    };
    const result = mergeCharacter(CHAR, makeHanziWriter(), makeMakeMeAHanzi(), cc, PROMPT);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure result');
    }
    expect(result.missingFields).toEqual(['pinyin']);
  });

  it('treats empty strokes as missing strokeCount and strokeData', () => {
    const hw: HanziWriterEntry = { strokes: [], medians: [], radStrokes: [] };
    const result = mergeCharacter(CHAR, hw, makeMakeMeAHanzi(), makeCcCedict(), PROMPT);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure result');
    }
    expect(result.missingFields).toEqual(['strokeCount', 'strokeData']);
  });
});
