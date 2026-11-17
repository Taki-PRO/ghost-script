/**
 * Pure formatter for the first-ghosts report (harder-ghosts, task 12.3,
 * Requirement 17.8). It orders a level's records with the app's own
 * `learningOrder` and prints the first ten ghosts. Nothing is typed.
 */
import type { CharacterRecord } from '../../app/src/data/types';
import { learningOrder } from '../../app/src/engine/learningOrder';

export const FIRST_GHOST_COUNT = 10;

type ReportRecord = Pick<CharacterRecord, 'strokeCount' | 'prompt' | 'summonInk'>;

/** One row per ghost: its position (from 1), character, prompt and summon-ink. */
export function formatFirstGhosts(
  level: number,
  records: Readonly<Record<string, ReportRecord>>,
  count: number = FIRST_GHOST_COUNT,
): string {
  const dataset = new Map(Object.entries(records));
  const order = learningOrder(dataset).slice(0, count);
  const lines = [`Level ${level}: first ${order.length} of ${dataset.size} ghosts`];
  order.forEach((key, i) => {
    const r = records[key];
    lines.push(
      `${i + 1}. ${key}  meaning: ${r.prompt.meaning}  pinyin: ${r.prompt.pinyin}  summonInk: ${JSON.stringify(r.summonInk)}`,
    );
  });
  return lines.join('\n');
}
