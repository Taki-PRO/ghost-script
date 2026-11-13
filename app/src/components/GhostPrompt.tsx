import { useMemo } from 'react';
import type { CharacterRecord } from '../data/types';
import { cleanupMeaning } from '../engine/promptCleanup';

export interface GhostPromptProps {
  record: CharacterRecord;
}

/**
 * Replace every occurrence of the target character in a DISPLAYED meaning with
 * the full-width tilde "～" (the headword convention in Chinese dictionaries).
 *
 * Display-only: applied AFTER `cleanupMeaning`, never to stored data or pinyin.
 * Needed because some meanings quote their own character (e.g. 么, 第), which
 * would give away the answer (Req 5.1). Splits on the exact char string, so it
 * is codepoint-safe and changes nothing else.
 */
export function maskTarget(text: string, char: string): string {
  if (char === '') return text;
  return text.split(char).join('\uFF5E');
}

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
