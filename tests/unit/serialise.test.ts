// Unit tests for serialiseDataset (scripts/lib/serialise.ts).
//
// Fixtures here are hand-built valid CharacterRecord shapes (logic fixtures,
// not real dataset entries). Records are inserted into the Map OUT of codepoint
// order so the sort is exercised.

import { describe, it, expect } from 'vitest';
import type { CharacterRecord } from '../../app/src/data/types';
import { serialiseDataset } from '../../scripts/lib/serialise';

/** Builds a minimal, valid CharacterRecord for the given character. */
function makeRecord(
  character: string,
  overrides: Partial<CharacterRecord> = {},
): CharacterRecord {
  return {
    character,
    pinyin: ['pin1'],
    meanings: ['meaning'],
    strokeCount: 2,
    strokeData: {
      strokes: ['M 0 0', 'M 1 1'],
      medians: [[[0, 0]], [[1, 1]]],
      radStrokes: [0],
    },
    decomposition: {
      decomposition: '？',
      radical: character,
      etymology: null,
      matches: null,
      atomic: true,
      components: [character],
    },
    prompt: {
      meaning: 'meaning',
      pinyin: 'pīn',
    },
    cangjie: null,
    summonInk: { class: 'opaque' },
    sources: {
      pinyin: 'cc-cedict',
      meanings: 'cc-cedict',
      strokeCount: 'hanzi-writer-data',
      strokeData: 'hanzi-writer-data',
      decomposition: 'make-me-a-hanzi',
      cangjie: 'missing',
    },
    ...overrides,
  };
}

// Three characters with known, distinct codepoints:
//   我 U+6211, 口 U+53E3, 人 U+4EBA
// Sorted ascending by codepoint: 人 (4EBA), 口 (53E3), 我 (6211).
const WO = makeRecord('我', { pinyin: ['wo3'], meanings: ['I', 'me', 'my'] });
const KOU = makeRecord('口', { pinyin: ['kou3'], meanings: ['mouth'] });
const REN = makeRecord('人', { pinyin: ['ren2'], meanings: ['person'] });

/** Returns a Map with records inserted OUT of codepoint order. */
function outOfOrderMap(): Map<string, CharacterRecord> {
  const m = new Map<string, CharacterRecord>();
  m.set('我', WO); // 6211
  m.set('人', REN); // 4EBA
  m.set('口', KOU); // 53E3
  return m;
}

describe('serialiseDataset', () => {
  it('produces valid JSON that round-trips back to the record values', () => {
    const json = serialiseDataset(outOfOrderMap());
    const parsed = JSON.parse(json) as Record<string, CharacterRecord>;

    expect(parsed['我']).toEqual(WO);
    expect(parsed['口']).toEqual(KOU);
    expect(parsed['人']).toEqual(REN);
  });

  it('orders top-level keys by codepoint ascending', () => {
    const json = serialiseDataset(outOfOrderMap());
    const parsed = JSON.parse(json) as Record<string, CharacterRecord>;

    // 人 U+4EBA, 口 U+53E3, 我 U+6211
    expect(Object.keys(parsed)).toEqual(['人', '口', '我']);
  });

  it('orders keys within a record in the fixed design order', () => {
    const json = serialiseDataset(outOfOrderMap());
    const parsed = JSON.parse(json) as Record<string, CharacterRecord>;

    for (const char of Object.keys(parsed)) {
      expect(Object.keys(parsed[char])).toEqual([
        'character',
        'pinyin',
        'meanings',
        'strokeCount',
        'strokeData',
        'decomposition',
        'prompt',
        'cangjie',
        'summonInk',
        'sources',
      ]);
    }
  });

  it('emits summonInk keys as { class } or { class, keyStrokes } in that order', () => {
    const map = new Map<string, CharacterRecord>();
    map.set('人', REN);
    map.set(
      '口',
      makeRecord('口', {
        cangjie: 'R',
        // keys deliberately inserted out of order
        summonInk: { keyStrokes: [[0, 1]], class: 'transparent' },
      }),
    );
    const json = serialiseDataset(map);
    const parsed = JSON.parse(json) as Record<string, CharacterRecord>;

    expect(Object.keys(parsed['人'].summonInk)).toEqual(['class']);
    expect(Object.keys(parsed['口'].summonInk)).toEqual(['class', 'keyStrokes']);
    expect(parsed['口'].summonInk).toEqual({ class: 'transparent', keyStrokes: [[0, 1]] });
  });

  it('orders the six keys within sources in the fixed design order', () => {
    const json = serialiseDataset(outOfOrderMap());
    const parsed = JSON.parse(json) as Record<string, CharacterRecord>;

    for (const char of Object.keys(parsed)) {
      expect(Object.keys(parsed[char].sources)).toEqual([
        'pinyin',
        'meanings',
        'strokeCount',
        'strokeData',
        'decomposition',
        'cangjie',
      ]);
    }
  });

  it('serialises cangjie: null as null and keeps a string code verbatim', () => {
    const map = new Map<string, CharacterRecord>();
    map.set('口', makeRecord('口', { cangjie: 'R', sources: { ...KOU.sources, cangjie: 'unihan' } }));
    map.set('人', REN);
    const json = serialiseDataset(map);
    const parsed = JSON.parse(json) as Record<string, CharacterRecord>;

    expect(parsed['人'].cangjie).toBeNull();
    expect(json).toContain('"cangjie": null');
    expect(parsed['口'].cangjie).toBe('R');
    expect(parsed['口'].sources.cangjie).toBe('unihan');
  });

  it('is deterministic: same Map yields byte-for-byte identical strings', () => {
    const map = outOfOrderMap();
    const first = serialiseDataset(map);
    const second = serialiseDataset(map);

    expect(first === second).toBe(true);
  });
});

describe('serialiseDataset promptReview and minify', () => {
  it('writes promptReview after sources when the record has it', () => {
    const m = new Map<string, CharacterRecord>();
    m.set('人', makeRecord('人', { promptReview: 'unreviewed' }));
    const parsed = JSON.parse(serialiseDataset(m)) as Record<string, CharacterRecord>;
    const keys = Object.keys(parsed['人']);
    expect(keys[keys.length - 1]).toBe('promptReview');
    expect(keys[keys.length - 2]).toBe('sources');
    expect(parsed['人'].promptReview).toBe('unreviewed');
  });

  it('writes no promptReview key when the record has none', () => {
    const m = new Map<string, CharacterRecord>();
    m.set('人', makeRecord('人'));
    expect(serialiseDataset(m)).not.toContain('promptReview');
  });

  it('minified output has no newline and parses equal to the pretty form', () => {
    const m = outOfOrderMap();
    m.set('人', makeRecord('人', { promptReview: 'reviewed' }));
    const pretty = serialiseDataset(m);
    const minified = serialiseDataset(m, { minify: true });
    expect(minified).not.toContain('\n');
    expect(minified.length).toBeLessThan(pretty.length);
    expect(JSON.parse(minified)).toEqual(JSON.parse(pretty));
    expect(serialiseDataset(m, { minify: false })).toBe(pretty);
  });
});
