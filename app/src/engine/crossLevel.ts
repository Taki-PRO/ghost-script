import type { Level } from '../data/types';
import type { ReviewEntry } from './scheduler';

/** One ghost of a planned séance: its level (null without a scope) and whether it was due at planning time. */
export interface PlannedGhost {
  readonly character: string;
  readonly level: Level | null;
  readonly due: boolean;
}

/**
 * The scheduler's due rule, restated here so that `scheduler.ts` stays unchanged:
 * an entry exists and its (clamped, finite) `nextDue` is at or before `now`.
 */
export function isDueAt(entry: ReviewEntry | undefined, now: number): boolean {
  return entry !== undefined && (Number.isFinite(entry.nextDue) ? Math.max(0, entry.nextDue) : 0) <= now;
}

/** Due ghosts of levels other than `chosen`, counted per level, ascending by level. */
export function otherLevelCounts(report: readonly PlannedGhost[], chosen: Level): [Level, number][] {
  const counts = new Map<Level, number>();
  for (const ghost of report) {
    if (!ghost.due || ghost.level === null || ghost.level === chosen) continue;
    counts.set(ghost.level, (counts.get(ghost.level) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]);
}

function part(level: Level, n: number): string {
  return `${n} ${n === 1 ? 'ghost' : 'ghosts'} from level ${level}`;
}

/**
 * The line shown above the first ghost when due ghosts of another level come first.
 * Null for a Review_Run, a séance that starts with the Guided_Ghost, or fewer than
 * `minimum` such ghosts.
 */
export function crossLevelLine(
  report: readonly PlannedGhost[],
  chosen: Level,
  guided: boolean,
  review: boolean,
  minimum = 1,
): string | null {
  if (review || guided) return null;
  const counts = otherLevelCounts(report, chosen);
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  if (total === 0 || total < minimum) return null;
  if (counts.length === 1) {
    const [level, n] = counts[0];
    return `${part(level, n)} ${n === 1 ? 'returns' : 'return'} first.`;
  }
  return `${counts.map(([level, n]) => part(level, n)).join(' and ')} return first.`;
}
