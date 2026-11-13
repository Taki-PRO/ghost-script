import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import type { EngineConfig } from '../engine/config';
import type { Outcome } from '../engine/scheduler';
import { WriteMode } from '../modes/WriteMode';
import { GhostPrompt } from './GhostPrompt';
import type { SessionResults } from './SessionSummary';

export interface SeanceSessionProps {
  ghosts: readonly CharacterRecord[];
  dataset: CharacterDataset;
  config: EngineConfig;
  /** Called once per ghost, immediately on its terminal outcome (Req 3.4). */
  onOutcome: (char: string, outcome: Outcome, now: number) => void;
  /** Called exactly once when the séance ends. */
  onComplete: (results: SessionResults) => void;
}

/** Keep the first occurrence of each character (Req 3.5). */
export function dedupeGhosts(ghosts: readonly CharacterRecord[]): CharacterRecord[] {
  const seen = new Set<string>();
  const out: CharacterRecord[] = [];
  for (const g of ghosts) {
    if (seen.has(g.character)) continue;
    seen.add(g.character);
    out.push(g);
  }
  return out;
}

const RESULT_TEXT: Record<Outcome, string> = {
  clean: 'Laid to rest',
  struggled: 'Laid to rest — it will return soon',
  'gave-up': 'The ghost slipped away',
};

/**
 * One séance: walks the player through each ghost in order. Advances only
 * after a terminal outcome and an explicit button press (Req 3.2).
 */
export function SeanceSession({ ghosts, dataset, config, onOutcome, onComplete }: SeanceSessionProps) {
  const list = useMemo(() => dedupeGhosts(ghosts), [ghosts]);
  const total = list.length;

  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Outcome | null>(null);

  const resolvedRef = useRef(false);
  const laidToRestRef = useRef(0);
  const completedRef = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const onOutcomeRef = useRef(onOutcome);
  onOutcomeRef.current = onOutcome;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const record = list[index];

  useEffect(() => {
    if (total === 0 && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current({ total: 0, laidToRest: 0 });
    }
  }, [total]);

  useEffect(() => {
    if (result !== null) nextRef.current?.focus();
  }, [result]);

  const handleOutcome = useCallback(
    (outcome: Outcome) => {
      if (!record || resolvedRef.current) return;
      resolvedRef.current = true;
      if (outcome !== 'gave-up') laidToRestRef.current += 1;
      setResult(outcome);
      onOutcomeRef.current(record.character, outcome, Date.now());
    },
    [record],
  );

  const handleAdvance = useCallback(() => {
    // Guard: only a resolved ghost may advance; blocks double-clicks.
    if (!resolvedRef.current || completedRef.current) return;
    resolvedRef.current = false;
    if (index >= total - 1) {
      completedRef.current = true;
      onCompleteRef.current({ total, laidToRest: laidToRestRef.current });
      return;
    }
    setResult(null);
    setIndex(index + 1);
  }, [index, total]);

  if (!record) {
    return <p className="text-center text-muted">No ghosts tonight.</p>;
  }

  const isLast = index === total - 1;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 p-4">
      <h2 className="text-lg text-ink">
        Ghost {index + 1} of {total}
      </h2>
      <GhostPrompt record={record} />
      <WriteMode record={record} dataset={dataset} config={config} onOutcome={handleOutcome} />
      {result !== null && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-ink">{RESULT_TEXT[result]}</p>
          <button
            ref={nextRef}
            type="button"
            onClick={handleAdvance}
            className="rounded-lg border border-ghost px-5 py-3 text-ink hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost"
          >
            {isLast ? 'Finish the séance' : 'Next ghost'}
          </button>
        </div>
      )}
    </div>
  );
}
