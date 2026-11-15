import { useMemo } from 'react';
import type { CharacterRecord } from '../data/types';
import { maskTarget } from '../engine/mask';
import { cleanupMeaning } from '../engine/promptCleanup';

export interface GhostPromptProps {
  record: CharacterRecord;
}

export { maskTarget };

/**
 * The ghost's clue: cleaned English meaning plus pinyin exactly as stored.
 * The target glyph (record.character) is never rendered, including in
 * attributes (Req 5.1). Pinyin is never passed through cleanup.
 */
export function GhostPrompt({ record }: GhostPromptProps) {
  const rawMeaning = record.prompt.meaning;
  const target = record.character;
  const meaning = useMemo(
    () => maskTarget(cleanupMeaning(rawMeaning), target),
    [rawMeaning, target],
  );

  return (
    <section aria-label="Ghost's clue" className="rounded-lg bg-surface p-4 text-center">
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
