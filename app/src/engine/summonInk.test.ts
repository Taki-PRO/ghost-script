import { describe, expect, it } from 'vitest';
import {
  BASE_SHAPE_BY_KEY,
  classifySummonInk,
  isValidSummonInk,
  parseIds,
  summonInkRank,
  type ClassifierInput,
} from './summonInk';

type Matches = ClassifierInput['decomposition']['matches'];

function rec(
  character: string,
  cangjie: string | null,
  strokeCount: number,
  ids: string,
  matches: Matches,
  atomic = false,
): ClassifierInput {
  return { character, cangjie, strokeCount, decomposition: { decomposition: ids, matches, atomic } };
}

describe('classifySummonInk: atomic records (AC 1.3, 1.17)', () => {
  it('atomic character whose single key is its own base shape is transparent with every stroke', () => {
    const r = rec('一', 'M', 1, '一', [null], true);
    expect(classifySummonInk(r)).toEqual({ class: 'transparent', keyStrokes: [[0]] });
  });

  it('lists every stroke index ascending for a multi-stroke atomic self key', () => {
    const r = rec('人', 'O', 2, '人', [null, null], true);
    expect(classifySummonInk(r)).toEqual({ class: 'transparent', keyStrokes: [[0, 1]] });
  });

  it('atomic character with a multi-key code that matches nothing is opaque', () => {
    const r = rec('八', 'HO', 2, '八', [null, null], true);
    expect(classifySummonInk(r)).toEqual({ class: 'opaque' });
  });

  it('atomic self key plus an extra key is partial', () => {
    const r = rec('一', 'MM', 1, '一', [null], true);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0], []] });
  });

  it('ignores matches for an atomic record', () => {
    const r = rec('一', 'M', 1, '一', [[0]], true);
    expect(classifySummonInk(r)).toEqual({ class: 'transparent', keyStrokes: [[0]] });
  });
});

describe('classifySummonInk: non-atomic records', () => {
  it('simple two-part character is transparent', () => {
    const r = rec('明', 'AB', 4, '⿰日月', [[0], [0], [1], [1]]);
    expect(classifySummonInk(r)).toEqual({ class: 'transparent', keyStrokes: [[0, 1], [2, 3]] });
  });

  it('resolves nested paths by the whole path', () => {
    const r = rec('X', 'MAB', 3, '⿱一⿰日月', [[0], [1, 0], [1, 1]]);
    expect(classifySummonInk(r)).toEqual({ class: 'transparent', keyStrokes: [[0], [1], [2]] });
  });

  it('matches a repeated shape in order', () => {
    const r = rec('二', 'MM', 2, '⿱一一', [[0], [1]]);
    expect(classifySummonInk(r)).toEqual({ class: 'transparent', keyStrokes: [[0], [1]] });
  });

  it('a repeated key with only one leaf leaves the second key unmatched', () => {
    const r = rec('一', 'MM', 1, '⿱一？', [[0]]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0], []] });
  });

  it('a null stroke match makes the class partial and leaves the instance with no strokes ineligible', () => {
    const r = rec('明', 'AB', 3, '⿰日月', [[0], [0], null]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0, 1], []] });
  });

  it('a null stroke prevents transparent even when every key matches', () => {
    const r = rec('明', 'AB', 3, '⿰日月', [[0], [1], null]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0], [1]] });
  });

  it('a ？ placeholder leaf never matches a key', () => {
    const r = rec('X', 'AB', 2, '⿰日？', [[0], [1]]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0], []] });
  });

  it('a code that covers only some leaves is partial', () => {
    const r = rec('明', 'A', 2, '⿰日月', [[0], [1]]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0]] });
  });

  it('key X has no shape, stays unmatched and leaves the cursor in place', () => {
    const r = rec('明', 'AXB', 2, '⿰日月', [[0], [1]]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0], [], [1]] });
  });

  it('keys in a different order from the leaves: the cursor only moves forward', () => {
    const r = rec('明', 'BA', 2, '⿰日月', [[0], [1]]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[1], []] });
  });

  it('a path that points at an inner node attributes no stroke', () => {
    const r = rec('X', 'MAB', 3, '⿱一⿰日月', [[0], [1], [1, 1]]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0], [], [2]] });
  });

  it('a path that is out of range or too long attributes no stroke', () => {
    const r = rec('明', 'AB', 3, '⿰日月', [[0], [1], [1, 0]]);
    expect(classifySummonInk(r)).toEqual({ class: 'partial', keyStrokes: [[0], [1]] });
    const r2 = rec('明', 'AB', 2, '⿰日月', [[0], [5]]);
    expect(classifySummonInk(r2)).toEqual({ class: 'partial', keyStrokes: [[0], []] });
  });

  it('matches of the wrong length make every stroke unattributed, so the class is opaque', () => {
    const r = rec('明', 'AB', 2, '⿰日月', [[0]]);
    expect(classifySummonInk(r)).toEqual({ class: 'opaque' });
  });

  it('null matches on a non-atomic record is opaque', () => {
    expect(classifySummonInk(rec('明', 'AB', 2, '⿰日月', null))).toEqual({ class: 'opaque' });
  });

  it('empty code is opaque', () => {
    expect(classifySummonInk(rec('明', '', 2, '⿰日月', [[0], [1]]))).toEqual({ class: 'opaque' });
  });

  it('null code is opaque', () => {
    expect(classifySummonInk(rec('明', null, 2, '⿰日月', [[0], [1]]))).toEqual({ class: 'opaque' });
  });

  it('malformed decomposition strings are opaque', () => {
    expect(classifySummonInk(rec('明', 'AB', 2, '⿰日', [[0], [1]]))).toEqual({ class: 'opaque' });
    expect(classifySummonInk(rec('明', 'AB', 2, '日月', [[0], [1]]))).toEqual({ class: 'opaque' });
    expect(classifySummonInk(rec('明', 'AB', 2, '', [[0], [1]]))).toEqual({ class: 'opaque' });
  });

  it('a malformed string on an atomic record is ignored', () => {
    expect(classifySummonInk(rec('一', 'M', 1, '⿰', [null], true))).toEqual({
      class: 'transparent',
      keyStrokes: [[0]],
    });
  });

  it('is opaque for a stroke count that is not a positive safe integer', () => {
    expect(classifySummonInk(rec('一', 'M', 0, '一', [], true))).toEqual({ class: 'opaque' });
    expect(classifySummonInk(rec('一', 'M', 1.5, '一', [null], true))).toEqual({ class: 'opaque' });
    expect(classifySummonInk(rec('一', 'M', Number.NaN, '一', [null], true))).toEqual({
      class: 'opaque',
    });
  });

  it('does not modify its input and gives the same result twice', () => {
    const r = rec('明', 'AB', 4, '⿰日月', [[0], [0], [1], [1]]);
    const copy = JSON.parse(JSON.stringify(r)) as ClassifierInput;
    const first = classifySummonInk(r);
    const second = classifySummonInk(r);
    expect(r).toEqual(copy);
    expect(second).toEqual(first);
  });

  it('opaque result holds the class only', () => {
    expect(Object.keys(classifySummonInk(rec('八', 'HO', 2, '八', [null, null], true)))).toEqual([
      'class',
    ]);
  });
});

describe('parseIds', () => {
  it('parses a single leaf', () => {
    expect(parseIds('日')).toEqual({ leaf: '日' });
  });

  it('parses binary operators', () => {
    expect(parseIds('⿰日月')).toEqual({ op: '⿰', kids: [{ leaf: '日' }, { leaf: '月' }] });
  });

  it('parses ternary operators ⿲ and ⿳', () => {
    expect(parseIds('⿲日月木')).toEqual({
      op: '⿲',
      kids: [{ leaf: '日' }, { leaf: '月' }, { leaf: '木' }],
    });
    expect(parseIds('⿳一二三')).toEqual({
      op: '⿳',
      kids: [{ leaf: '一' }, { leaf: '二' }, { leaf: '三' }],
    });
  });

  it('parses nested trees', () => {
    expect(parseIds('⿱一⿰日月')).toEqual({
      op: '⿱',
      kids: [{ leaf: '一' }, { op: '⿰', kids: [{ leaf: '日' }, { leaf: '月' }] }],
    });
  });

  it('treats ？ as a leaf', () => {
    expect(parseIds('⿰日？')).toEqual({ op: '⿰', kids: [{ leaf: '日' }, { leaf: '？' }] });
  });

  it('rejects missing operands, leftover code points and the empty string', () => {
    expect(parseIds('⿰日')).toBeNull();
    expect(parseIds('⿲日月')).toBeNull();
    expect(parseIds('⿰日月木')).toBeNull();
    expect(parseIds('日月')).toBeNull();
    expect(parseIds('')).toBeNull();
    expect(parseIds('⿰')).toBeNull();
  });
});

describe('isValidSummonInk', () => {
  const ok = (v: unknown, code: string | null, n: number) => isValidSummonInk(v, code, n);

  it('accepts a valid opaque value', () => {
    expect(ok({ class: 'opaque' }, 'AB', 4)).toBe(true);
    expect(ok({ class: 'opaque' }, null, 4)).toBe(true);
  });

  it('accepts valid transparent and partial values', () => {
    expect(ok({ class: 'transparent', keyStrokes: [[0, 1], [2, 3]] }, 'AB', 4)).toBe(true);
    expect(ok({ class: 'partial', keyStrokes: [[0, 1], []] }, 'AB', 4)).toBe(true);
  });

  it('rejects a missing value, a non-object, an array, and a missing or unknown class', () => {
    expect(ok(undefined, 'AB', 4)).toBe(false);
    expect(ok(null, 'AB', 4)).toBe(false);
    expect(ok('opaque', 'AB', 4)).toBe(false);
    expect(ok([], 'AB', 4)).toBe(false);
    expect(ok({}, 'AB', 4)).toBe(false);
    expect(ok({ class: 'clear' }, 'AB', 4)).toBe(false);
    expect(ok({ class: 7 }, 'AB', 4)).toBe(false);
  });

  it('rejects keyStrokes on an opaque value, even an empty one', () => {
    expect(ok({ class: 'opaque', keyStrokes: [] }, 'AB', 4)).toBe(false);
    expect(ok({ class: 'opaque', keyStrokes: [[0]] }, 'AB', 4)).toBe(false);
    expect(ok({ class: 'opaque', keyStrokes: undefined }, 'AB', 4)).toBe(false);
  });

  it('rejects an ink class without keyStrokes or with keyStrokes that are not arrays of arrays', () => {
    expect(ok({ class: 'transparent' }, 'A', 1)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: 'x' }, 'A', 1)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [0] }, 'A', 1)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [null] }, 'A', 1)).toBe(false);
  });

  it('rejects entries that are not integers', () => {
    expect(ok({ class: 'partial', keyStrokes: [[0.5]] }, 'A', 2)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [['0']] }, 'A', 2)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [[Number.NaN]] }, 'A', 2)).toBe(false);
  });

  it('rejects a keyStrokes length different from the code length', () => {
    expect(ok({ class: 'partial', keyStrokes: [[0]] }, 'AB', 4)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [[0], [], []] }, 'AB', 4)).toBe(false);
  });

  it('rejects an ink class when the code is null', () => {
    expect(ok({ class: 'partial', keyStrokes: [[0]] }, null, 4)).toBe(false);
    expect(ok({ class: 'transparent', keyStrokes: [] }, null, 0)).toBe(false);
  });

  it('rejects stroke indexes outside 0 to strokeCount - 1', () => {
    expect(ok({ class: 'partial', keyStrokes: [[-1]] }, 'A', 4)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [[4]] }, 'A', 4)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [[3]] }, 'A', 4)).toBe(true);
  });

  it('rejects indexes that are not ascending within a key, including repeats', () => {
    expect(ok({ class: 'partial', keyStrokes: [[1, 0]] }, 'A', 4)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [[1, 1]] }, 'A', 4)).toBe(false);
  });

  it('rejects an index that appears under two keys', () => {
    expect(ok({ class: 'partial', keyStrokes: [[0, 1], [1]] }, 'AB', 4)).toBe(false);
  });

  it('rejects transparent when the union is not every stroke', () => {
    expect(ok({ class: 'transparent', keyStrokes: [[0, 1], [2]] }, 'AB', 4)).toBe(false);
    expect(ok({ class: 'transparent', keyStrokes: [[0, 1], [2, 3]] }, 'AB', 4)).toBe(true);
  });

  it('rejects partial when every entry is empty', () => {
    expect(ok({ class: 'partial', keyStrokes: [[], []] }, 'AB', 4)).toBe(false);
  });

  it('rejects an ink class when strokeCount is not a safe non-negative integer', () => {
    expect(ok({ class: 'partial', keyStrokes: [[0]] }, 'A', Number.NaN)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [[0]] }, 'A', 1.5)).toBe(false);
    expect(ok({ class: 'partial', keyStrokes: [[0]] }, 'A', -1)).toBe(false);
  });

  it('treats a hostile object as data and does not read inherited class', () => {
    const inherited = Object.create({ class: 'opaque' }) as unknown;
    expect(ok(inherited, 'AB', 4)).toBe(false);
    const parsed: unknown = JSON.parse('{"class":"opaque","__proto__":{"keyStrokes":[]}}');
    expect(() => ok(parsed, 'AB', 4)).not.toThrow();
  });

  it('agrees with the classifier on its own output', () => {
    const r = rec('明', 'AB', 3, '⿰日月', [[0], [0], null]);
    expect(ok(classifySummonInk(r), 'AB', 3)).toBe(true);
  });
});

describe('summonInkRank', () => {
  it('ranks transparent 0, partial 1, opaque 2', () => {
    expect(summonInkRank({ class: 'transparent', keyStrokes: [[0]] })).toBe(0);
    expect(summonInkRank({ class: 'partial', keyStrokes: [[0]] })).toBe(1);
    expect(summonInkRank({ class: 'opaque' })).toBe(2);
  });

  it('ranks anything else as opaque', () => {
    expect(summonInkRank(undefined)).toBe(2);
    expect(summonInkRank(null)).toBe(2);
    expect(summonInkRank('transparent')).toBe(2);
    expect(summonInkRank({})).toBe(2);
    expect(summonInkRank({ class: 'other' })).toBe(2);
  });
});

describe('BASE_SHAPE_BY_KEY', () => {
  it('has 24 entries and no X', () => {
    expect(BASE_SHAPE_BY_KEY.size).toBe(24);
    expect(BASE_SHAPE_BY_KEY.has('X')).toBe(false);
    expect(BASE_SHAPE_BY_KEY.get('A')).toBe('日');
    expect(BASE_SHAPE_BY_KEY.get('B')).toBe('月');
    expect(BASE_SHAPE_BY_KEY.get('M')).toBe('一');
  });
});
