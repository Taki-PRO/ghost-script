import type { CharacterRecord } from '../data/types';
import { summonInkRank } from './summonInk';

/**
 * The Learning order (ghost-game-core AC 6.12, amended by summon-ink
 * Requirement 7): the dataset's keys sorted by summon-ink class (transparent,
 * then partial, then opaque), then `strokeCount` ascending, ties broken by
 * Unicode codepoint ascending (full codepoint sequence for multi-codepoint
 * keys, so the order is total and deterministic). A record without a valid
 * `summonInk` ranks as opaque.
 *
 * The App passes this list as the character list to `selectSession`, so NEW
 * characters and ties are introduced class by class, fewest strokes first.
 *
 * Pure: does not mutate the input, and the result is independent of the Map's
 * insertion order. A non-finite or non-number `strokeCount` is treated as
 * +Infinity (sorts after all finite counts) and never throws.
 */
export function learningOrder(
  dataset: ReadonlyMap<string, Pick<CharacterRecord, 'strokeCount'> & { summonInk?: unknown }>,
): string[] {
  const entries: { key: string; rank: number; strokes: number; cps: number[] }[] = [];
  for (const [key, record] of dataset) {
    const raw: unknown = record?.strokeCount;
    const strokes =
      typeof raw === 'number' && Number.isFinite(raw) ? raw : Number.POSITIVE_INFINITY;
    const cps: number[] = [];
    for (const ch of key) cps.push(ch.codePointAt(0) ?? 0);
    entries.push({ key, rank: summonInkRank(record?.summonInk), strokes, cps });
  }

  entries.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.strokes !== b.strokes) return a.strokes < b.strokes ? -1 : 1;
    const n = Math.min(a.cps.length, b.cps.length);
    for (let i = 0; i < n; i++) {
      if (a.cps[i] !== b.cps[i]) return a.cps[i] < b.cps[i] ? -1 : 1;
    }
    return a.cps.length - b.cps.length;
  });

  return entries.map((e) => e.key);
}
