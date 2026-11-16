import { useMemo } from 'react';
import type { CharacterRecord } from '../data/types';
import { maskTarget } from '../engine/mask';
import { cleanupMeaning } from '../engine/promptCleanup';
import { ghostStateFor } from '../engine/ghostVisual';
import type { Outcome } from '../engine/scheduler';
import { GhostFigure } from './GhostFigure';

export interface GhostPromptProps {
  record: CharacterRecord;
  /** The ghost's Outcome once resolved; null or omitted while it haunts. */
  outcome?: Outcome | null;
  /** One-row card for the one-screen rite; the labels stay for screen readers. */
  compact?: boolean;
}

export { maskTarget };

/**
 * The ghost's clue: cleaned English meaning plus pinyin exactly as stored.
 * The target glyph (record.character) is never rendered, including in
 * attributes (Req 5.1). Pinyin is never passed through cleanup.
 */
export function GhostPrompt({ record, outcome = null, compact = false }: GhostPromptProps) {
  const rawMeaning = record.prompt.meaning;
  const target = record.character;
  const meaning = useMemo(
    () => maskTarget(cleanupMeaning(rawMeaning), target),
    [rawMeaning, target],
  );

  if (compact) {
    return (
      <section
        aria-label="Ghost's clue"
        data-ghost-state={ghostStateFor(outcome)}
        className="ghost-card flex items-center gap-3 rounded-lg bg-surface p-2 text-left"
      >
        <GhostFigure className="ghost-figure h-10 w-9 shrink-0 text-ghost" />
        <div className="min-w-0">
          <p className="sr-only">Meaning</p>
          <p className="text-xl text-ink">{meaning}</p>
          <p className="sr-only">Pronunciation</p>
          <p lang="zh-Latn-pinyin" className="text-lg text-ghost">
            {record.prompt.pinyin}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Ghost's clue"
      data-ghost-state={ghostStateFor(outcome)}
      className="ghost-card rounded-lg bg-surface p-4 text-center"
    >
      <GhostFigure className="ghost-figure mx-auto mb-2 h-16 w-14 text-ghost" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">Meaning</p>
        <p className="text-2xl text-ink">{meaning}</p>
      </div>
      <div className="mt-3">
        <p className="text-xs uppercase tracking-wide text-muted">Pronunciation</p>
        <p lang="zh-Latn-pinyin" className="text-xl text-ghost">
          {record.prompt.pinyin}
        </p>
      </div>
    </section>
  );
}
