import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import type { EngineConfig } from '../engine/config';
import type { Outcome } from '../engine/scheduler';
import { isPlayableInCangjie } from '../engine/cangjieRules';
import { combineOutcomes } from '../engine/outcome';
import { SummonStep } from '../modes/SummonStep';
import { WriteMode } from '../modes/WriteMode';
import { GhostPrompt } from './GhostPrompt';
import { scrollToTop } from './scrollToTop';
import type { SessionResults } from './SessionSummary';

export interface SeanceSessionProps {
  ghosts: readonly CharacterRecord[];
  dataset: CharacterDataset;
  config: EngineConfig;
  /** Called once per ghost, immediately on its terminal outcome (Req 3.4). */
  onOutcome: (char: string, outcome: Outcome, now: number) => void;
  /** Called exactly once when the séance ends. */
  onComplete: (results: SessionResults) => void;
  /** Called once when the player confirms leaving. Records nothing for the current ghost. */
  onLeave: () => void;
  /** False when a write failed in this browser; changes the Leave prompt text. */
  savingWorks: boolean;
}

export const LEAVE_TEXT_SAVED = "Leave now? Ghosts you've finished are saved.";
export const LEAVE_TEXT_NOT_SAVING =
  "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost.";

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

type Step = 'summon' | 'write';

function initialStep(record: CharacterRecord | undefined): Step {
  return record && isPlayableInCangjie(record.cangjie) ? 'summon' : 'write';
}

const BTN =
  'min-h-[44px] rounded-md border border-muted bg-surface px-4 py-2 text-base text-ink hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost';

const RESULT_TEXT: Record<Outcome, string> = {
  clean: 'Laid to rest',
  struggled: 'Laid to rest — it will return soon',
  'gave-up': 'The ghost slipped away',
};

/**
 * One séance: walks the player through each ghost in order. Advances only
 * after a terminal outcome and an explicit button press (Req 3.2).
 */
export function SeanceSession({ ghosts, dataset, config, onOutcome, onComplete, onLeave, savingWorks }: SeanceSessionProps) {
  const list = useMemo(() => dedupeGhosts(ghosts), [ghosts]);
  const total = list.length;

  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Outcome | null>(null);
  const [step, setStep] = useState<Step>(() => initialStep(list[0]));
  const summonResultRef = useRef<Outcome | null>(null);

  const resolvedRef = useRef(false);
  const laidToRestRef = useRef(0);
  const completedRef = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const onOutcomeRef = useRef(onOutcome);
  onOutcomeRef.current = onOutcome;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const leaveBtnRef = useRef<HTMLButtonElement>(null);
  const stayBtnRef = useRef<HTMLButtonElement>(null);
  const leftRef = useRef(false);
  const confirmingRef = useRef(false);
  confirmingRef.current = confirmingLeave;
  const wasConfirmingRef = useRef(false);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  const record = list[index];

  useEffect(() => {
    if (confirmingLeave) stayBtnRef.current?.focus();
    else if (wasConfirmingRef.current) leaveBtnRef.current?.focus();
    wasConfirmingRef.current = confirmingLeave;
  }, [confirmingLeave]);

  useEffect(() => {
    if (total === 0 && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current({ total: 0, laidToRest: 0 });
    }
  }, [total]);

  useEffect(() => {
    if (result !== null && !confirmingRef.current) nextRef.current?.focus();
  }, [result]);

  const handleOutcome = useCallback(
    (outcome: Outcome) => {
      if (!record || resolvedRef.current || leftRef.current) return;
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
    scrollToTop();
    summonResultRef.current = null;
    setResult(null);
    setStep(initialStep(list[index + 1]));
    setIndex(index + 1);
  }, [index, total, list]);

  const handleSummonDone = useCallback((summonResult: Outcome) => {
    if (leftRef.current) return;
    summonResultRef.current = summonResult;
    setStep('write');
  }, []);

  const handleWriteOutcome = useCallback(
    (writeResult: Outcome) => {
      handleOutcome(combineOutcomes(summonResultRef.current, writeResult));
    },
    [handleOutcome],
  );

  const openLeave = () => setConfirmingLeave(true);
  const stay = () => setConfirmingLeave(false);
  const leave = () => {
    if (leftRef.current) return;
    leftRef.current = true;
    onLeaveRef.current();
  };

  if (!record) {
    return <p className="text-center text-muted">No ghosts tonight.</p>;
  }

  const isLast = index === total - 1;
  const hasSummon = isPlayableInCangjie(record.cangjie);
  const stepLabel = !hasSummon
    ? 'Lay to rest'
    : step === 'summon'
      ? 'Step 1 of 2: Summon'
      : 'Step 2 of 2: Lay to rest';

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-2 p-2">
      <div className="flex w-full items-center justify-between gap-3">
        <button
          ref={leaveBtnRef}
          type="button"
          aria-expanded={confirmingLeave}
          aria-controls="leave-prompt"
          onClick={openLeave}
          className={BTN}
        >
          Leave séance
        </button>
        <h2 className="text-lg text-ink">
          Ghost {index + 1} of {total}
        </h2>
      </div>
      {confirmingLeave && (
        <div
          id="leave-prompt"
          role="group"
          aria-labelledby="leave-question"
          onKeyDown={(e) => {
            if (e.key === 'Escape') stay();
          }}
          className="w-full rounded-lg border border-candle bg-surface p-4 text-center"
        >
          <p id="leave-question" className="text-ink">
            {savingWorks ? LEAVE_TEXT_SAVED : LEAVE_TEXT_NOT_SAVING}
          </p>
          <div className="mt-3 flex justify-center gap-3">
            <button type="button" onClick={leave} className={BTN}>
              Leave
            </button>
            <button ref={stayBtnRef} type="button" onClick={stay} className={BTN}>
              Stay
            </button>
          </div>
        </div>
      )}
      <GhostPrompt record={record} outcome={result} compact />
      <p className="text-sm text-muted">{stepLabel}</p>
      {step === 'summon' ? (
        <SummonStep
          key={record.character}
          record={record}
          dataset={dataset}
          config={config}
          onDone={handleSummonDone}
        />
      ) : (
        <WriteMode record={record} dataset={dataset} config={config} onOutcome={handleWriteOutcome} />
      )}
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
