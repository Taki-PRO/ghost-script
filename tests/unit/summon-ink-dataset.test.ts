// Exhaustive unit test over every record of the generated dataset: the stored
// `summonInk` equals the classifier's output and is structurally valid.
//
// Requirements: 1.17, 8.3, 9.3, 9.4, 9.5
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CANGJIE_KEYS } from '../../app/src/engine/cangjieRules';
import {
  classifySummonInk,
  isValidSummonInk,
  parseIds,
  type IdsNode,
} from '../../app/src/engine/summonInk';

interface Row {
  character: string;
  strokeCount: number;
  cangjie: string | null;
  summonInk: { class: string; keyStrokes?: number[][] };
  decomposition: {
    decomposition: string;
    matches: (number[] | null)[] | null;
    atomic: boolean;
    components: string[];
  };
}

const path = fileURLToPath(new URL('../../app/public/data/characters.json', import.meta.url));
const text = readFileSync(path, 'utf8');
const dataset = JSON.parse(text) as Record<string, Row>;
const entries = Object.entries(dataset);

function leavesOf(node: IdsNode): string[] {
  return 'leaf' in node ? [node.leaf] : node.kids.flatMap(leavesOf);
}

describe('summonInk in characters.json', () => {
  it('has 300 records', () => {
    expect(entries).toHaveLength(300);
  });

  it('stored value equals the classifier recomputed from the record', () => {
    for (const [char, rec] of entries) {
      expect(rec.summonInk, char).toEqual(classifySummonInk(rec));
    }
  });

  it('every stored value passes isValidSummonInk', () => {
    for (const [char, rec] of entries) {
      expect(isValidSummonInk(rec.summonInk, rec.cangjie, rec.strokeCount), char).toBe(true);
    }
  });

  it('every leaf of a non-atomic record is a component or ？', () => {
    for (const [char, rec] of entries) {
      if (rec.decomposition.atomic) continue;
      const tree = parseIds(rec.decomposition.decomposition);
      if (tree === null) continue;
      for (const leaf of leavesOf(tree)) {
        const ok = leaf === '？' || rec.decomposition.components.includes(leaf);
        expect(ok, `${char} leaf ${leaf}`).toBe(true);
      }
    }
  });

  it('summonInk is the key right before sources', () => {
    for (const [char, rec] of entries) {
      const keys = Object.keys(rec);
      const at = keys.indexOf('summonInk');
      expect(at, char).toBeGreaterThan(-1);
      expect(keys[at + 1], char).toBe('sources');
      expect(keys[at - 1], char).toBe('cangjie');
    }
  });

  it('atomic records: 一 人 女 手 are transparent, 八 又 牛 而 身 are opaque', () => {
    for (const c of ['一', '人', '女', '手']) {
      expect(dataset[c].decomposition.atomic, c).toBe(true);
      expect(dataset[c].summonInk.class, c).toBe('transparent');
    }
    for (const c of ['八', '又', '牛', '而', '身']) {
      expect(dataset[c].decomposition.atomic, c).toBe(true);
      expect(dataset[c].summonInk.class, c).toBe('opaque');
    }
  });

  it('class counts add up to 300 and each class is non-empty', () => {
    const counts = { transparent: 0, partial: 0, opaque: 0 };
    for (const [, rec] of entries) counts[rec.summonInk.class as keyof typeof counts] += 1;
    expect(counts.transparent + counts.partial + counts.opaque).toBe(300);
    expect(counts.transparent).toBeGreaterThan(0);
    expect(counts.partial).toBeGreaterThan(0);
    expect(counts.opaque).toBeGreaterThan(0);
  });

  it.each(['明', '早', '天', '果', '里', '本', '下', '干'])(
    'spot check %s: transparent, key shapes equal components, strokes partitioned',
    (c) => {
      const rec = dataset[c];
      expect(rec.cangjie).not.toBeNull();
      expect(rec.summonInk.class).toBe('transparent');
      const code = Array.from(rec.cangjie as string);
      const keyStrokes = rec.summonInk.keyStrokes as number[][];
      expect(keyStrokes).toHaveLength(code.length);
      const shapeOf = new Map(CANGJIE_KEYS.map((k) => [k.key as string, k.shape]));
      code.forEach((key, i) => {
        expect(shapeOf.get(key), `${c} key ${key}`).toBe(rec.decomposition.components[i]);
        const m = rec.decomposition.matches as (number[] | null)[];
        // Every stroke of this key belongs to the component at the same position.
        const paths = new Set(keyStrokes[i].map((s) => JSON.stringify(m[s])));
        expect(paths.size, `${c} key ${key} paths`).toBe(1);
      });
      const all = keyStrokes.flat().sort((a, b) => a - b);
      expect(all).toEqual(Array.from({ length: rec.strokeCount }, (_, i) => i));
    },
  );
});

// Levels 2 and 3 (harder-ghosts): the same checks over every record.
describe.each([
  [2, 400],
  [3, 500],
] as const)('summonInk in characters-level%i.json (%i records)', (level, count) => {
  const levelPath = fileURLToPath(
    new URL(`../../app/public/data/characters-level${level}.json`, import.meta.url),
  );
  const levelData = JSON.parse(readFileSync(levelPath, 'utf8')) as Record<string, Row>;
  const levelEntries = Object.entries(levelData);

  it(`has ${count} records`, () => {
    expect(levelEntries).toHaveLength(count);
  });

  it('stored value equals the classifier recomputed from the record', () => {
    for (const [char, rec] of levelEntries) {
      expect(rec.summonInk, char).toEqual(classifySummonInk(rec));
    }
  });

  it('every stored value passes isValidSummonInk', () => {
    for (const [char, rec] of levelEntries) {
      expect(isValidSummonInk(rec.summonInk, rec.cangjie, rec.strokeCount), char).toBe(true);
    }
  });

  it('every leaf of a non-atomic record is a component or ？', () => {
    for (const [char, rec] of levelEntries) {
      if (rec.decomposition.atomic) continue;
      const tree = parseIds(rec.decomposition.decomposition);
      if (tree === null) continue;
      for (const leaf of leavesOf(tree)) {
        const ok = leaf === '？' || rec.decomposition.components.includes(leaf);
        expect(ok, `${char} leaf ${leaf}`).toBe(true);
      }
    }
  });

  it('class counts add up and summonInk sits between cangjie and sources', () => {
    const counts = { transparent: 0, partial: 0, opaque: 0 };
    for (const [char, rec] of levelEntries) {
      counts[rec.summonInk.class as keyof typeof counts] += 1;
      const keys = Object.keys(rec);
      const at = keys.indexOf('summonInk');
      expect(keys[at - 1], char).toBe('cangjie');
      expect(keys[at + 1], char).toBe('sources');
    }
    expect(counts.transparent + counts.partial + counts.opaque).toBe(count);
  });
});
