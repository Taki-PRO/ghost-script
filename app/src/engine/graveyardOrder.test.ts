import { describe, expect, it } from 'vitest';
import level1 from '../../public/data/characters.json';
import level2 from '../../public/data/characters-level2.json';
import level3 from '../../public/data/characters-level3.json';
import type { CharacterDataset } from '../data/charDataLoader';
import type { CharacterRecord } from '../data/types';
import { graveyardExplanation, graveyardOrder } from './graveyardOrder';
import { learningOrder } from './learningOrder';
import { pickWalkthroughGhost } from './walkthrough';

function load(json: unknown): CharacterDataset {
  return new Map(Object.entries(json as Record<string, CharacterRecord>));
}

const ds1 = load(level1);
const ds2 = load(level2);
const ds3 = load(level3);

describe('graveyardOrder, level 1 with real data', () => {
  const order = learningOrder(ds1);
  const guided = pickWalkthroughGhost(order, ds1);
  const shown = graveyardOrder(1, order, ds1);

  it('has a Guided_Ghost and puts it at index 0', () => {
    expect(guided).not.toBeNull();
    expect(shown[0]).toBe(guided);
  });

  it('keeps 300 graves with no duplicate', () => {
    expect(order).toHaveLength(300);
    expect(shown).toHaveLength(300);
    expect(new Set(shown).size).toBe(300);
  });

  it('keeps the other 299 in learningOrder relative order', () => {
    expect(shown.slice(1)).toEqual(order.filter((c) => c !== guided));
  });

  it('does not change the input order', () => {
    expect(order).toEqual(learningOrder(ds1));
  });

  it('gives learningOrder when no ghost qualifies', () => {
    const none: CharacterDataset = new Map();
    expect(graveyardOrder(1, order, none)).toEqual(order);
  });
});

describe('graveyardOrder, levels 2 and 3', () => {
  it('equals learningOrder for level 2', () => {
    const order = learningOrder(ds2);
    expect(graveyardOrder(2, order, ds2)).toEqual(order);
  });

  it('equals learningOrder for level 3', () => {
    const order = learningOrder(ds3);
    expect(graveyardOrder(3, order, ds3)).toEqual(order);
  });
});

describe('graveyardExplanation', () => {
  it('names the guided first ghost on level 1 with one', () => {
    expect(graveyardExplanation(1, true)).toBe(
      'These graves are the ghosts of level 1. The guided first ghost comes first, then the rest in the order you will meet them. A ghost you have not met stays hidden.',
    );
  });

  it('uses the plain sentence on level 1 without one and on levels 2 and 3', () => {
    expect(graveyardExplanation(1, false)).toBe(
      'These graves are the ghosts of level 1, in the order you will meet them. A ghost you have not met stays hidden.',
    );
    expect(graveyardExplanation(2, true)).toBe(
      'These graves are the ghosts of level 2, in the order you will meet them. A ghost you have not met stays hidden.',
    );
    expect(graveyardExplanation(3, false)).toBe(
      'These graves are the ghosts of level 3, in the order you will meet them. A ghost you have not met stays hidden.',
    );
  });
});
