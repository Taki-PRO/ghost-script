import type { CharacterRecord } from '../data/types';

/**
 * The Learning order (Req 6.12): the dataset's keys sorted by `strokeCount`
 * ascending, ties broken by Unicode codepoint ascending (full codepoint
 * sequence for multi-codepoint keys, so the order is total and deterministic).
 *
 * The App passes this list as the character list to `selectSession`, so NEW
 * characters and ties are introduced from the fewest-strokes characters upward.
 *
 * Pure: does not mutate the input, and the result is independent of the Map's
 * insertion order. A non-finite or non-number `strokeCount` is treated as
 * +Infinity (sorts after all finite counts) and never throws.
 */
export function learningOrder(
  dataset: ReadonlyMap<string, Pick<CharacterRecord, 'strokeCount'>>,
): string[] {
  const entries: { key: string; strokes: number; cps: number[] }[] = [];
  for (const [key, record] of dataset) {
    const raw: unknown = record?.strokeCount;
    const strokes =
      typeof raw === 'number' && Number.isFinite(raw) ? raw : Number.POSITIVE_INFINITY;
    const cps: number[] = [];
    for (const ch of key) cps.push(ch.codePointAt(0) ?? 0);
    entries.push({ key, strokes, cps });
  }

  entries.sort((a, b) => {
    if (a.strokes !== b.strokes) return a.strokes < b.strokes ? -1 : 1;
    const n = Math.min(a.cps.length, b.cps.length);
    for (let i = 0; i < n; i++) {
      if (a.cps[i] !== b.cps[i]) return a.cps[i] < b.cps[i] ? -1 : 1;
    }
    return a.cps.length - b.cps.length;
  });

  return entries.map((e) => e.key);
}
