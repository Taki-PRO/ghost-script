// Feature: summon-ink, Property 1: Classification invariants
// **Validates: Requirements 1.3, 1.4, 1.6, 1.8, 1.9, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CANGJIE_KEYS } from './cangjieRules';
import { classifySummonInk, type ClassifierInput } from './summonInk';
import type { SummonInk } from '../data/types';

// ---- independent model pieces (do not use anything from summonInk.ts except the function under test)

const SHAPE_OF = new Map<string, string>(
  CANGJIE_KEYS.filter((k) => k.key !== 'X').map((k) => [k.key as string, k.shape]),
);
const KEY_OF = new Map<string, string>(
  CANGJIE_KEYS.filter((k) => k.key !== 'X').map((k) => [k.shape, k.key as string]),
);
const SHAPES = Array.from(SHAPE_OF.values());
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');
const BINARY_OPS = ['⿰', '⿱', '⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿻'];
const TERNARY_OPS = ['⿲', '⿳'];
const RANK: Record<SummonInk['class'], number> = { transparent: 0, partial: 1, opaque: 2 };

type Tree = { leaf: string } | { op: string; kids: Tree[] };
type Path = number[];

const leafArb: fc.Arbitrary<Tree> = fc
  .oneof(
    { weight: 6, arbitrary: fc.constantFrom(...SHAPES) },
    { weight: 1, arbitrary: fc.constantFrom('乂', '亻') },
    { weight: 1, arbitrary: fc.constant('？') },
  )
  .map((leaf) => ({ leaf }));

function treeArb(depth: number): fc.Arbitrary<Tree> {
  if (depth <= 0) return leafArb;
  const sub = treeArb(depth - 1);
  return fc.oneof(
    { weight: 2, arbitrary: leafArb },
    {
      weight: 4,
      arbitrary: fc
        .tuple(fc.constantFrom(...BINARY_OPS), sub, sub)
        .map(([op, a, b]): Tree => ({ op, kids: [a, b] })),
    },
    {
      weight: 1,
      arbitrary: fc
        .tuple(fc.constantFrom(...TERNARY_OPS), sub, sub, sub)
        .map(([op, a, b, c]): Tree => ({ op, kids: [a, b, c] })),
    },
  );
}

function print(t: Tree): string {
  return 'leaf' in t ? t.leaf : t.op + t.kids.map(print).join('');
}

function walk(t: Tree, path: Path, leaves: { glyph: string; path: Path }[], inner: Path[]): void {
  if ('leaf' in t) {
    leaves.push({ glyph: t.leaf, path });
    return;
  }
  inner.push(path);
  t.kids.forEach((k, i) => walk(k, [...path, i], leaves, inner));
}

const key = (p: readonly number[]): string => p.join(',');

interface ModelInstance {
  glyph: string;
  strokes: number[];
}

/** Leaves (or the atomic character) with at least one stroke, left to right, plus the attributed count. */
function modelInstances(input: ClassifierInput): { list: ModelInstance[]; attributed: number } {
  const n = input.strokeCount;
  if (input.decomposition.atomic) {
    return {
      list: [{ glyph: input.character, strokes: Array.from({ length: n }, (_, i) => i) }],
      attributed: n,
    };
  }
  // The generated IDS string is always a valid tree, so parse it again here, independently.
  const pts = Array.from(input.decomposition.decomposition);
  let pos = 0;
  const leaves: { glyph: string; path: Path }[] = [];
  const parse = (path: Path): void => {
    const ch = pts[pos++];
    if (BINARY_OPS.includes(ch)) {
      parse([...path, 0]);
      parse([...path, 1]);
    } else if (TERNARY_OPS.includes(ch)) {
      parse([...path, 0]);
      parse([...path, 1]);
      parse([...path, 2]);
    } else {
      leaves.push({ glyph: ch, path });
    }
  };
  parse([]);
  const m = input.decomposition.matches;
  const list: ModelInstance[] = [];
  let attributed = 0;
  for (const leaf of leaves) {
    const strokes: number[] = [];
    if (m !== null && m.length === n) {
      m.forEach((p, i) => {
        if (p !== null && key(p) === key(leaf.path)) strokes.push(i);
      });
    }
    if (strokes.length > 0) {
      list.push({ glyph: leaf.glyph, strokes });
      attributed += strokes.length;
    }
  }
  return { list, attributed };
}

function model(input: ClassifierInput): SummonInk {
  const code = input.cangjie;
  if (code === null || code.length === 0) return { class: 'opaque' };
  const { list, attributed } = modelInstances(input);
  const shapes = Array.from(code).map((k) => SHAPE_OF.get(k) ?? null);
  let cursor = 0;
  let matched = 0;
  const keyStrokes: number[][] = [];
  for (const shape of shapes) {
    let hit = -1;
    if (shape !== null) {
      for (let j = cursor; j < list.length; j += 1) {
        if (list[j].glyph === shape) {
          hit = j;
          break;
        }
      }
    }
    if (hit < 0) {
      keyStrokes.push([]);
    } else {
      cursor = hit + 1;
      matched += 1;
      keyStrokes.push([...list[hit].strokes]);
    }
  }
  if (matched === 0) return { class: 'opaque' };
  const sameSequence =
    shapes.length === list.length && shapes.every((s, i) => s === list[i].glyph);
  const transparent = sameSequence && attributed === input.strokeCount;
  return { class: transparent ? 'transparent' : 'partial', keyStrokes };
}

function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const c of Object.values(v)) deepFreeze(c);
  }
  return v;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ---- record generator

const letterArb = fc.constantFrom(...LETTERS);

const rawArb = fc.record({
  atomic: fc.integer({ min: 0, max: 3 }).map((n) => n === 0),
  tree: treeArb(3),
  strokeCount: fc.integer({ min: 1, max: 12 }),
  picks: fc.array(fc.tuple(fc.integer({ min: 0, max: 9 }), fc.nat(1000)), {
    minLength: 12,
    maxLength: 12,
  }),
  matchMode: fc.constantFrom('cover', 'cover', 'random', 'random', 'random', 'short', 'long', 'null'),
  codeMode: fc.constantFrom('random', 'seeded', 'seeded', 'seeded', 'null'),
  randomCode: fc.array(letterArb, { minLength: 0, maxLength: 5 }),
  doDrop: fc.boolean(),
  dropAt: fc.nat(20),
  extra: fc.option(letterArb, { nil: null }),
  doSwap: fc.boolean(),
  swapA: fc.nat(20),
  swapB: fc.nat(20),
  atomicChar: fc.oneof(
    { weight: 4, arbitrary: fc.constantFrom(...SHAPES) },
    { weight: 1, arbitrary: fc.constantFrom('乂', '亻') },
  ),
});

type Raw = typeof rawArb extends fc.Arbitrary<infer R> ? R : never;

function build(raw: Raw): ClassifierInput {
  const n = raw.strokeCount;
  let character = '字';
  let decomposition: string;
  let matches: (number[] | null)[] | null;

  if (raw.atomic) {
    character = raw.atomicChar;
    decomposition = character;
    matches = Array.from({ length: n }, () => null);
  } else {
    const leaves: { glyph: string; path: Path }[] = [];
    const inner: Path[] = [];
    walk(raw.tree, [], leaves, inner);
    decomposition = print(raw.tree);
    const pickPath = (kind: number, r: number): number[] | null => {
      if (kind <= 5) return leaves[r % leaves.length].path;
      if (kind === 6) return null;
      const bad: Path[] = [
        ...(inner.length > 0 ? [inner[r % inner.length]] : []),
        [...leaves[r % leaves.length].path, 0],
        [9],
        [0, 0, 0, 0],
      ];
      return bad[r % bad.length];
    };
    const randomMatches = (len: number): (number[] | null)[] =>
      Array.from({ length: len }, (_, i) => {
        const [kind, r] = raw.picks[i % raw.picks.length];
        return pickPath(kind, r);
      });
    switch (raw.matchMode) {
      case 'cover':
        matches =
          leaves.length <= n
            ? Array.from({ length: n }, (_, i) => leaves[Math.floor((i * leaves.length) / n)].path)
            : randomMatches(n);
        break;
      case 'short':
        matches = randomMatches(n - 1);
        break;
      case 'long':
        matches = randomMatches(n + 1);
        break;
      case 'null':
        matches = null;
        break;
      default:
        matches = randomMatches(n);
    }
  }

  const base: ClassifierInput = {
    character,
    cangjie: null,
    strokeCount: n,
    decomposition: { decomposition, matches, atomic: raw.atomic },
  };

  let code: string | null;
  if (raw.codeMode === 'null') {
    code = null;
  } else if (raw.codeMode === 'random') {
    code = raw.randomCode.join('');
  } else {
    const keys = modelInstances(base).list.map((inst) => KEY_OF.get(inst.glyph) ?? 'X');
    if (raw.doDrop && keys.length > 0) keys.splice(raw.dropAt % keys.length, 1);
    if (raw.extra !== null) keys.push(raw.extra);
    if (raw.doSwap && keys.length >= 2) {
      const a = raw.swapA % keys.length;
      const b = raw.swapB % keys.length;
      [keys[a], keys[b]] = [keys[b], keys[a]];
    }
    code = keys.slice(0, 5).join('');
  }
  return { ...base, cangjie: code };
}

const recordArb = rawArb.map(build);

describe('summonInk classification property', () => {
  it('satisfies the classification invariants for any generated record', () => {
    fc.assert(
      fc.property(recordArb, (input) => {
        const result = classifySummonInk(clone(input));
        const n = input.strokeCount;
        const keyCount = input.cangjie === null ? 0 : Array.from(input.cangjie).length;

        // 1. Shape
        if (result.class === 'opaque') {
          expect('keyStrokes' in result).toBe(false);
        } else {
          expect(result.keyStrokes).toHaveLength(keyCount);
        }

        // 2. Index invariants
        if (result.class !== 'opaque') {
          const seen = new Set<number>();
          for (const entry of result.keyStrokes) {
            let prev = -1;
            for (const s of entry) {
              expect(Number.isInteger(s)).toBe(true);
              expect(s).toBeGreaterThanOrEqual(0);
              expect(s).toBeLessThan(n);
              expect(s).toBeGreaterThan(prev);
              expect(seen.has(s)).toBe(false);
              prev = s;
              seen.add(s);
            }
          }
          if (result.class === 'partial') {
            expect(result.keyStrokes.some((e) => e.length > 0)).toBe(true);
          } else {
            expect(seen.size).toBe(n);
          }
        }

        // 3. Model agreement
        expect(result).toEqual(model(input));

        // 4. Monotone under an extra X key
        if (input.cangjie !== null) {
          const extended = classifySummonInk({ ...clone(input), cangjie: `${input.cangjie}X` });
          expect(RANK[extended.class]).toBeGreaterThanOrEqual(RANK[result.class]);
          if (result.class !== 'opaque' && extended.class !== 'opaque') {
            expect(extended.keyStrokes.slice(0, keyCount)).toEqual(result.keyStrokes);
          }
        }

        // 5. Purity on a deep-frozen copy
        const frozen = deepFreeze(clone(input));
        expect(classifySummonInk(frozen)).toEqual(result);
        expect(classifySummonInk(frozen)).toEqual(result);

        // 6. Atomic self key
        if (input.decomposition.atomic && input.cangjie !== null) {
          const keys = Array.from(input.cangjie);
          if (keys.length === 1 && SHAPE_OF.get(keys[0]) === input.character) {
            expect(result).toEqual({
              class: 'transparent',
              keyStrokes: [Array.from({ length: n }, (_, i) => i)],
            });
          } else if (keys.length >= 2) {
            expect(result.class).not.toBe('transparent');
          }
        }
      }),
      { numRuns: 300 },
    );
  });
});
