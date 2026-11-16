import { describe, expect, it } from 'vitest';
import characters from '../../public/data/characters.json';
import { learningOrder } from './learningOrder';
import { summonInkRank } from './summonInk';

type Rec = { strokeCount: number; summonInk?: unknown };

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

  describe('class order (summon-ink Requirement 7)', () => {
    const T = { class: 'transparent', keyStrokes: [[0]] };
    const P = { class: 'partial', keyStrokes: [[0], []] };
    const O = { class: 'opaque' };
    const recs: [string, number, unknown][] = [
      ['龍', 16, T],
      ['一', 1, O],
      ['人', 2, P],
      ['木', 4, T],
      ['大', 3, P],
      ['天', 4, O],
    ];
    const build = (rows: [string, number, unknown][]) =>
      new Map<string, Rec>(rows.map(([k, n, s]) => [k, { strokeCount: n, summonInk: s }]));

    it('sorts by class, then strokes, then codepoint', () => {
      expect(learningOrder(build(recs))).toEqual(['木', '龍', '人', '大', '一', '天']);
    });

    it('is independent of insertion order', () => {
      expect(learningOrder(build([...recs].reverse()))).toEqual(learningOrder(build(recs)));
    });

    it('ranks a record without summonInk (or an invalid one) as opaque', () => {
      const m = new Map<string, Rec>([
        ['一', { strokeCount: 1 }],
        ['人', { strokeCount: 2, summonInk: { class: 'bogus' } }],
        ['木', { strokeCount: 4, summonInk: T }],
        ['大', { strokeCount: 3, summonInk: P }],
      ]);
      expect(learningOrder(m)).toEqual(['木', '大', '一', '人']);
    });

    it('sorts non-finite strokeCount last within its class', () => {
      const m = build([
        ['木', Number.NaN, T],
        ['龍', 16, T],
        ['一', 1, P],
      ]);
      expect(learningOrder(m)).toEqual(['龍', '木', '一']);
    });
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

    it('has the minimum strokeCount among the first-class characters, and 一 first', () => {
      expect(result[0]).toBe('一');
      expect(dataset.get(result[0])!.strokeCount).toBe(min);
      expect(max).toBeGreaterThan(min);
    });

    // The next two tests read the STORED `summonInk` field. They fail until
    // task 3.5 regenerates characters.json with the field.
    it('lists classes in order, and counts equal the stored classes (needs task 3.5)', () => {
      const classes = result.map((k) => dataset.get(k)!.summonInk as { class: string });
      const ranks = classes.map((c) => summonInkRank(c));
      for (let i = 1; i < ranks.length; i++) expect(ranks[i - 1]).toBeLessThanOrEqual(ranks[i]);
      for (const name of ['transparent', 'partial', 'opaque']) {
        const stored = [...dataset.values()].filter(
          (r) => (r.summonInk as { class?: string } | undefined)?.class === name,
        ).length;
        expect(stored).toBeGreaterThan(0);
        expect(classes.filter((c) => c?.class === name).length).toBe(stored);
      }
    });

    it('is non-decreasing in (class, strokeCount) with codepoint tie-break (needs task 3.5)', () => {
      for (let i = 1; i < result.length; i++) {
        const a = dataset.get(result[i - 1])!;
        const b = dataset.get(result[i])!;
        const ra = summonInkRank(a.summonInk);
        const rb = summonInkRank(b.summonInk);
        expect(ra).toBeLessThanOrEqual(rb);
        if (ra === rb) {
          expect(a.strokeCount).toBeLessThanOrEqual(b.strokeCount);
          if (a.strokeCount === b.strokeCount) expect(cp(result[i - 1])).toBeLessThan(cp(result[i]));
        }
      }
    });
  });
});
