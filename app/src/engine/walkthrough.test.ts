import { describe, expect, it } from 'vitest';
import characters from '../../public/data/characters.json';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord, SummonInkClass } from '../data/types';
import { CANGJIE_KEYS } from './cangjieRules';
import { learningOrder } from './learningOrder';
import { cleanupMeaning } from './promptCleanup';
import {
  WALKTHROUGH_WRITE_LINE,
  composeFirstSession,
  pickWalkthroughGhost,
  walkthroughSummonLines,
} from './walkthrough';

interface Spec {
  cls?: SummonInkClass;
  code?: string | null;
  ids?: string;
  meaning?: string;
}

function rec(character: string, spec: Spec = {}): CharacterRecord {
  const cls = spec.cls ?? 'transparent';
  return {
    character,
    cangjie: spec.code === undefined ? 'AB' : spec.code,
    decomposition: { decomposition: spec.ids ?? '\u2FF0AB', atomic: false },
    summonInk: cls === 'opaque' ? { class: 'opaque' } : { class: cls, keyStrokes: [[0], [1]] },
    prompt: { meaning: spec.meaning ?? 'thing', pinyin: 'x' },
    strokeCount: 1,
  } as unknown as CharacterRecord;
}

function dataset(records: CharacterRecord[]): CharacterDataset {
  return new Map(records.map((r) => [r.character, r]));
}

describe('pickWalkthroughGhost', () => {
  const good = rec('甲');

  it('picks a record that meets every clause', () => {
    expect(pickWalkthroughGhost(['甲'], dataset([good]))).toBe('甲');
  });

  it.each<[string, Spec]>([
    ['class partial', { cls: 'partial' }],
    ['class opaque', { cls: 'opaque' }],
    ['three keys', { code: 'ABC' }],
    ['one key', { code: 'A' }],
    ['equal keys', { code: 'OO' }],
    ['no code', { code: null }],
    ['code starting with X', { code: 'XA' }],
    ['top operator is not side-by-side', { ids: '\u2FF1AB' }],
    ['atomic ids string', { ids: '\uFF1F' }],
    ['unparseable ids string', { ids: '\u2FF0A' }],
    ['leaf only', { ids: 'A' }],
  ])('skips a record that fails alone: %s', (_name, spec) => {
    expect(pickWalkthroughGhost(['乙'], dataset([rec('乙', spec)]))).toBeNull();
  });

  it('returns the first match in order, not in dataset order', () => {
    const ds = dataset([rec('甲'), rec('乙')]);
    expect(pickWalkthroughGhost(['乙', '甲'], ds)).toBe('乙');
  });

  it('skips non-matching and unknown characters before a match', () => {
    const ds = dataset([rec('乙', { cls: 'partial' }), good]);
    expect(pickWalkthroughGhost(['丙', '乙', '甲'], ds)).toBe('甲');
  });

  it('returns null for an empty order', () => {
    expect(pickWalkthroughGhost([], dataset([good]))).toBeNull();
  });
});

describe('composeFirstSession', () => {
  const [w, a, b, c] = ['甲', '乙', '丙', '丁'].map((ch) => rec(ch));
  const chars = (list: CharacterRecord[]): string[] => list.map((r) => r.character);

  it('puts the walkthrough ghost first and cuts to size', () => {
    expect(chars(composeFirstSession([a, b, c], w, 3))).toEqual(['甲', '乙', '丙']);
  });

  it('removes a duplicate of the walkthrough ghost', () => {
    expect(chars(composeFirstSession([a, w, b], w, 5))).toEqual(['甲', '乙', '丙']);
  });

  it('keeps all when the list is shorter than size', () => {
    expect(chars(composeFirstSession([a], w, 10))).toEqual(['甲', '乙']);
  });

  it('handles size 1, size 0 and non-finite sizes', () => {
    expect(chars(composeFirstSession([a, b], w, 1))).toEqual(['甲']);
    expect(composeFirstSession([a, b], w, 0)).toEqual([]);
    expect(composeFirstSession([a, b], w, Number.NaN)).toEqual([]);
    expect(composeFirstSession([a, b], w, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('does not change the input list', () => {
    const input = [a, b];
    composeFirstSession(input, w, 2);
    expect(chars(input)).toEqual(['乙', '丙']);
  });
});

describe('walkthroughSummonLines', () => {
  it('uses the "the" form for a one-word meaning', () => {
    const ds = dataset([rec('日', { meaning: 'sun' }), rec('月', { meaning: 'moon' })]);
    const target = rec('甲', { code: 'AB' });
    expect(walkthroughSummonLines(target, ds)).toEqual([
      'Press A: the sun 日',
      'Press B: the moon 月',
    ]);
  });

  it('uses the parenthesis form for a longer meaning', () => {
    const ds = dataset([rec('人', { meaning: 'person; people' })]);
    expect(walkthroughSummonLines(rec('甲', { code: 'O' }), ds)).toEqual([
      'Press O: 人 (person; people)',
    ]);
  });

  it('uses the plain form when the shape has no dataset entry', () => {
    expect(walkthroughSummonLines(rec('甲', { code: 'XA' }), dataset([]))).toEqual([
      'Press X: 難',
      'Press A: 日',
    ]);
  });

  it('cleans the meaning before choosing the form', () => {
    const ds = dataset([rec('山', { meaning: 'mountain; hill (CL:座[zuo4])' })]);
    const [line] = walkthroughSummonLines(rec('甲', { code: 'U' }), ds);
    expect(line).toBe(`Press U: 山 (${cleanupMeaning('mountain; hill (CL:座[zuo4])')})`);
  });

  it('masks the target character in every line', () => {
    const ds = dataset([rec('日', { meaning: 'sun' })]);
    const lines = walkthroughSummonLines(rec('日', { code: 'AA' }), ds);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).not.toContain('日');
  });

  it('returns one line per key and none without a code', () => {
    expect(walkthroughSummonLines(rec('甲', { code: 'ABC' }), dataset([]))).toHaveLength(3);
    expect(walkthroughSummonLines(rec('甲', { code: null }), dataset([]))).toEqual([]);
  });
});

describe('WALKTHROUGH_WRITE_LINE', () => {
  it('is the approved text', () => {
    expect(WALKTHROUGH_WRITE_LINE).toBe('Now write it from memory');
  });
});

describe('real dataset', () => {
  const real: CharacterDataset = new Map(
    Object.entries(characters as unknown as Record<string, CharacterRecord>),
  );

  it('picks the approved walkthrough ghost and builds its lines', () => {
    const picked = pickWalkthroughGhost(learningOrder(real), real);
    expect(picked).toBe('明');
    const lines = walkthroughSummonLines(real.get(picked as string) as CharacterRecord, real);
    expect(lines).toEqual(['Press A: the sun 日', 'Press B: the moon 月']);
  });

  it('builds a line for every key A-Y from the key table and the dataset', () => {
    for (const { key, shape } of CANGJIE_KEYS) {
      // A record whose character cannot equal any shape, so nothing is masked.
      const probe = { ...rec('甲', { code: key }), character: '\u4E00\u0000' } as CharacterRecord;
      const [line] = walkthroughSummonLines(probe, real);
      const shapeRecord = real.get(shape);
      expect(line.startsWith(`Press ${key}: `)).toBe(true);
      if (shapeRecord === undefined) {
        expect(line).toBe(`Press ${key}: ${shape}`);
      } else {
        const meaning = cleanupMeaning(shapeRecord.prompt.meaning);
        expect(line).toMatch(
          new RegExp(
            `^Press ${key}: (the ${meaning} ${shape}|${shape} \\(${meaning.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\))$`,
          ),
        );
      }
    }
  });
});
