/**
 * Summon-ink classifier: compares a character's Cangjie keys with the leaves of
 * its decomposition tree and says how many keys can ink their part.
 *
 * Pure. Imports only the key table and types, so `scripts/` can import this
 * file by relative path.
 */
import { CANGJIE_KEYS } from './cangjieRules';
import type { SummonInk } from '../data/types';

/** The fields of a CharacterRecord that the rule reads. A full record fits. */
export interface ClassifierInput {
  readonly character: string;
  readonly cangjie: string | null;
  readonly strokeCount: number;
  readonly decomposition: {
    readonly decomposition: string;
    readonly matches: ReadonlyArray<ReadonlyArray<number> | null> | null;
    readonly atomic: boolean;
  };
}

export type IdsNode =
  | { readonly leaf: string }
  | { readonly op: string; readonly kids: readonly IdsNode[] };

const IDS_FIRST = 0x2ff0;
const IDS_LAST = 0x2ffb;
const IDS_TERNARY: ReadonlySet<number> = new Set([0x2ff2, 0x2ff3]);

/**
 * The tree of an IDS string, or null unless the string is exactly one complete
 * tree. Operators are U+2FF0..U+2FFB; U+2FF2 and U+2FF3 take three operands,
 * the others two. Every other code point is a leaf.
 */
export function parseIds(ids: string): IdsNode | null {
  if (typeof ids !== 'string') return null;
  const points = Array.from(ids);
  let pos = 0;

  const parseNode = (): IdsNode | null => {
    if (pos >= points.length) return null;
    const ch = points[pos];
    pos += 1;
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < IDS_FIRST || cp > IDS_LAST) return { leaf: ch };
    const arity = IDS_TERNARY.has(cp) ? 3 : 2;
    const kids: IdsNode[] = [];
    for (let i = 0; i < arity; i += 1) {
      const kid = parseNode();
      if (kid === null) return null;
      kids.push(kid);
    }
    return { op: ch, kids };
  };

  const tree = parseNode();
  if (tree === null || pos !== points.length) return null;
  return tree;
}

/** The Base_Shape of each key A..Y except X (24 entries). */
export const BASE_SHAPE_BY_KEY: ReadonlyMap<string, string> = new Map(
  CANGJIE_KEYS.filter((k) => k.key !== 'X').map((k) => [k.key as string, k.shape]),
);

const OPAQUE: SummonInk = { class: 'opaque' };

interface Instance {
  readonly glyph: string;
  readonly path: readonly number[];
  readonly strokes: number[];
}

function collectLeaves(node: IdsNode, path: readonly number[], out: Instance[]): void {
  if ('leaf' in node) {
    out.push({ glyph: node.leaf, path, strokes: [] });
    return;
  }
  node.kids.forEach((kid, i) => collectLeaves(kid, [...path, i], out));
}

function samePath(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function instancesOf(input: ClassifierInput): Instance[] | null {
  const { atomic, decomposition, matches } = input.decomposition;
  const strokeCount = input.strokeCount;
  if (atomic) {
    const all = Array.from({ length: strokeCount }, (_, i) => i);
    return [{ glyph: input.character, path: [], strokes: all }];
  }
  const tree = parseIds(decomposition);
  if (tree === null) return null;
  const instances: Instance[] = [];
  collectLeaves(tree, [], instances);
  if (Array.isArray(matches) && matches.length === strokeCount) {
    for (let stroke = 0; stroke < strokeCount; stroke += 1) {
      const path = matches[stroke];
      if (!Array.isArray(path)) continue;
      const hit = instances.find((x) => samePath(x.path, path));
      if (hit !== undefined) hit.strokes.push(stroke);
    }
  }
  return instances;
}

export function classifySummonInk(input: ClassifierInput): SummonInk {
  const code = input.cangjie;
  if (typeof code !== 'string' || code.length === 0) return OPAQUE;
  if (!Number.isSafeInteger(input.strokeCount) || input.strokeCount < 1) return OPAQUE;
  const instances = instancesOf(input);
  if (instances === null) return OPAQUE;

  let cursor = 0;
  let matched = 0;
  let keys = 0;
  const covered = new Set<number>();
  const keyStrokes: number[][] = [];
  for (const key of code) {
    keys += 1;
    const shape = BASE_SHAPE_BY_KEY.get(key);
    let hit = -1;
    if (shape !== undefined) {
      for (let j = cursor; j < instances.length; j += 1) {
        if (instances[j].strokes.length > 0 && instances[j].glyph === shape) {
          hit = j;
          break;
        }
      }
    }
    if (hit < 0) {
      keyStrokes.push([]);
      continue;
    }
    cursor = hit + 1;
    matched += 1;
    const strokes = [...instances[hit].strokes];
    keyStrokes.push(strokes);
    for (const s of strokes) covered.add(s);
  }
  if (matched === 0) return OPAQUE;
  const all = matched === keys && covered.size === input.strokeCount;
  return { class: all ? 'transparent' : 'partial', keyStrokes };
}

function has(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** Structural validity of one record's `summonInk` (Requirements 3.3 to 3.7). */
export function isValidSummonInk(
  value: unknown,
  code: string | null,
  strokeCount: number,
): value is SummonInk {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  if (!has(value, 'class')) return false;
  const cls = (value as { class?: unknown }).class;
  if (cls === 'opaque') return !has(value, 'keyStrokes');
  if (cls !== 'transparent' && cls !== 'partial') return false;
  if (!has(value, 'keyStrokes')) return false;
  const ks = (value as { keyStrokes?: unknown }).keyStrokes;
  if (!Array.isArray(ks) || typeof code !== 'string') return false;
  if (!Number.isSafeInteger(strokeCount) || strokeCount < 0) return false;
  if (ks.length !== Array.from(code).length) return false;

  const seen = new Set<number>();
  let nonEmpty = false;
  for (const entry of ks as unknown[]) {
    if (!Array.isArray(entry)) return false;
    let prev = -1;
    for (const s of entry as unknown[]) {
      if (typeof s !== 'number' || !Number.isInteger(s)) return false;
      if (s < 0 || s >= strokeCount) return false;
      if (s <= prev) return false;
      if (seen.has(s)) return false;
      prev = s;
      seen.add(s);
      nonEmpty = true;
    }
  }
  if (cls === 'transparent') return seen.size === strokeCount;
  return nonEmpty;
}

/** transparent 0, partial 1, opaque 2; anything else 2. */
export function summonInkRank(value: unknown): 0 | 1 | 2 {
  if (typeof value === 'object' && value !== null && has(value, 'class')) {
    const cls = (value as { class?: unknown }).class;
    if (cls === 'transparent') return 0;
    if (cls === 'partial') return 1;
  }
  return 2;
}
