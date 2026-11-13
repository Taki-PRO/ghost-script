import { describe, expect, it } from 'vitest';
import characters from '../../public/data/characters.json';
import { learningOrder } from './learningOrder';

type Rec = { strokeCount: number };

const cp = (s: string): number => s.codePointAt(0) ?? 0;

function mapOf(entries: [string, number][]): Map<string, Rec> {
  return new Map(entries.map(([k, n]) => [k, { strokeCount: n }]));
}

function expected(entries: [string, number][]): string[] {
  return [...entries].sort((a, b) => a[1] - b[1] || cp(a[0]) - cp(b[0])).map(([k]) => k);
}

describe('learningOrder (Req 6.12)', () => {
  const scrambled: [string, number][] = [
    ['龍', 16],
    ['人', 2],
    ['木', 4],
    ['一', 1],
    ['大', 3],
    ['天', 4],
    ['水', 4],
    ['十', 2],
    ['女', 3],
    ['乙', 1],
  ];

  it('sorts by strokeCount ascending, ties by codepoint ascending', () => {
    const result = learningOrder(mapOf(scrambled));
    expect(result).toEqual(expected(scrambled));
    expect(result).toHaveLength(scrambled.length);
    expect(result[0]).toBe('一');
    expect(result[result.length - 1]).toBe('龍');
  });

  it('breaks ties by codepoint when inserted in reverse codepoint order', () => {
    const same = ['天', '水', '木', '大', '人'].map((c): [string, number] => [c, 4]);
    const reversed = [...same].sort((a, b) => cp(b[0]) - cp(a[0]));
    const result = learningOrder(mapOf(reversed));
    const asc = [...same].map(([c]) => c).sort((a, b) => cp(a) - cp(b));
    expect(result).toEqual(asc);
  });

  it('returns [] for an empty dataset', () => {
    expect(learningOrder(new Map())).toEqual([]);
  });

  it('returns [key] for a single entry', () => {
    expect(learningOrder(mapOf([['人', 2]]))).toEqual(['人']);
  });

  it('does not mutate the input Map', () => {
    const m = mapOf(scrambled);
    const keysBefore = [...m.keys()];
    const valuesBefore = [...m.values()];
    const sizeBefore = m.size;
    learningOrder(m);
    expect([...m.keys()]).toEqual(keysBefore);
    expect(m.size).toBe(sizeBefore);
    const valuesAfter = [...m.values()];
    valuesAfter.forEach((v, i) => expect(v).toBe(valuesBefore[i]));

    const frozen = new Map(scrambled.map(([k, n]) => [k, Object.freeze({ strokeCount: n })]));
    expect(() => learningOrder(frozen)).not.toThrow();
    expect(learningOrder(frozen)).toEqual(expected(scrambled));
  });

  it('is independent of insertion order', () => {
    const a = learningOrder(mapOf(scrambled));
    const b = learningOrder(mapOf([...scrambled].reverse()));
    const c = learningOrder(mapOf([...scrambled.slice(5), ...scrambled.slice(0, 5)]));
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('sorts non-finite strokeCounts after finite ones, tie-broken by codepoint', () => {
    const m = mapOf([
      ['木', Number.NaN],
      ['人', 2],
      ['天', Number.POSITIVE_INFINITY],
      ['一', 1],
      ['大', Number.NaN],
    ]);
    let result: string[] = [];
    expect(() => {
      result = learningOrder(m);
    }).not.toThrow();
    const nonFinite = ['木', '天', '大'].sort((a, b) => cp(a) - cp(b));
    expect(result).toEqual(['一', '人', ...nonFinite]);
  });

  describe('real data (characters.json)', () => {
    const data = characters as unknown as Record<string, Rec>;
    const dataset = new Map(Object.entries(data));
    const result = learningOrder(dataset);
    const counts = [...dataset.values()].map((r) => r.strokeCount);
    const min = Math.min(...counts);
    const max = Math.max(...counts);

    it('has length 300 and is a permutation of all keys', () => {
      expect(result).toHaveLength(300);
      expect(new Set(result).size).toBe(300);
      expect(new Set(result)).toEqual(new Set(dataset.keys()));
    });

    it('starts at the minimum strokeCount and ends at the maximum', () => {
      expect(dataset.get(result[0])!.strokeCount).toBe(min);
      expect(dataset.get(result[result.length - 1])!.strokeCount).toBe(max);
    });

    it('is non-decreasing in strokeCount with codepoint tie-break', () => {
      for (let i = 1; i < result.length; i++) {
        const p = dataset.get(result[i - 1])!.strokeCount;
        const q = dataset.get(result[i])!.strokeCount;
        expect(p).toBeLessThanOrEqual(q);
        if (p === q) expect(cp(result[i - 1])).toBeLessThan(cp(result[i]));
      }
    });

    it('begins with 一 when it is the unique 1-stroke character', () => {
      const ones = [...dataset.entries()].filter(([, r]) => r.strokeCount === min);
      if (min === 1 && ones.length === 1 && ones[0][0] === '一') {
        expect(result[0]).toBe('一');
      } else {
        // Data does not confirm a unique '一'; the minimum check above covers it.
        expect(ones.map(([k]) => k)).toContain(result[0]);
      }
    });
  });
});
