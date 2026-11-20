import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterRecord } from '../data/types';
import type { CharacterDataset } from '../data/charDataLoader';
import type { EngineConfig } from '../engine/config';
import type { Outcome } from '../engine/scheduler';
import { isPlayableInCangjie } from '../engine/cangjieRules';
import { combineOutcomes } from '../engine/outcome';
import { WALKTHROUGH_LINE_PX, crossLevelReserve } from '../engine/surfaceSize';
import { WALKTHROUGH_WRITE_LINE, walkthroughSummonLines } from '../engine/walkthrough';
import { REVIEW_RESULT_TEXT } from '../engine/review';
import { SummonStep } from '../modes/SummonStep';
import { WriteMode } from '../modes/WriteMode';
import { outcomeSounds } from '../audio/recipes';
import { useSound } from '../audio/SoundProvider';
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
  /** Characters met for the first time: their Summon step shows the faint code. Default: none. */
  firstMeeting?: ReadonlySet<string>;
  /** The guided first ghost, or null. Default: null. */
  walkthroughChar?: string | null;
  /** Line shown once above the first ghost when due ghosts of another level come first. Default: none. */
  crossLevelLine?: string | null;
  /**
   * 'review' for a Review_Run (every ghost is a returning ghost, review result
   * texts, and `laidToRest` of the results counts the clean ghosts). Default 'nightly'.
   */
  mode?: 'nightly' | 'review';
}

const NO_FIRST_MEETING: ReadonlySet<string> = new Set<string>();

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

const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const BTN = `slip min-h-[44px] px-4 py-2 text-base ${FOCUS}`;
const BTN_PRIMARY = `slip-primary min-h-[44px] px-4 py-2 text-base font-medium ${FOCUS}`;

const RESULT_TEXT: Record<Outcome, string> = {
  clean: 'Laid to rest',
  struggled: 'Laid to rest — it will return soon',
  'gave-up': 'The ghost slipped away',
};

/**
 * One séance: walks the player through each ghost in order. Advances only
 * after a terminal outcome and an explicit button press (Req 3.2).
 */
export function SeanceSession({
  ghosts,
  dataset,
  config,
  onOutcome,
  onComplete,
  onLeave,
  savingWorks,
  firstMeeting = NO_FIRST_MEETING,
  walkthroughChar = null,
  crossLevelLine = null,
  mode = 'nightly',
}: SeanceSessionProps) {
  const list = useMemo(() => dedupeGhosts(ghosts), [ghosts]);
  const total = list.length;

  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Outcome | null>(null);
  const [step, setStep] = useState<Step>(() => initialStep(list[0]));
  const [flinch, setFlinch] = useState(0);
  const summonResultRef = useRef<Outcome | null>(null);

  const resolvedRef = useRef(false);
  const laidToRestRef = useRef(0);
  const completedRef = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const onOutcomeRef = useRef(onOutcome);
  onOutcomeRef.current = onOutcome;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const { play } = useSound();
  const playRef = useRef(play);
  playRef.current = play;

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
  const isWalkthrough = record !== undefined && walkthroughChar !== null && record.character === walkthroughChar;
  // The line belongs to the first ghost only; it is gone once `index` moves on (R5.5, R5.6).
  const shownLine = index === 0 ? crossLevelLine : null;
  // Fixed at the first render of the session so the paper size never changes under the player.
  const [lineReserve] = useState(() => (crossLevelLine ? crossLevelReserve(crossLevelLine, window.innerWidth) : 0));
  const reservedPx = isWalkthrough ? WALKTHROUGH_LINE_PX : shownLine ? lineReserve : 0;
  const walkthroughLines = useMemo(
    () => (isWalkthrough && record ? walkthroughSummonLines(record, dataset) : undefined),
    [isWalkthrough, record, dataset],
  );

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
      if (mode === 'review' ? outcome === 'clean' : outcome !== 'gave-up') laidToRestRef.current += 1;
      setResult(outcome);
      onOutcomeRef.current(record.character, outcome, Date.now());
      try {
        outcomeSounds(outcome).forEach((id) => playRef.current(id));
      } catch {
        // A failing sound never blocks play.
      }
    },
    [record, mode],
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
    setFlinch(0);
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

  const handleWrongKey = useCallback(() => setFlinch((n) => n + 1), []);

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
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-1 px-2 py-1">
      <div className="flex w-full items-center justify-between gap-3 pr-[4.5rem]">
        <button
          ref={leaveBtnRef}
          type="button"
          aria-expanded={confirmingLeave}
          aria-controls="leave-prompt"
          onClick={openLeave}
          className={`${BTN} max-[359px]:px-3 max-[359px]:text-sm`}
        >
          Leave séance
        </button>
      </div>
      {confirmingLeave && (
        <div
          id="leave-prompt"
          role="group"
          aria-labelledby="leave-question"
          onKeyDown={(e) => {
            if (e.key === 'Escape') stay();
          }}
          className="w-full rounded-lg border border-muted bg-surface p-4 text-center"
        >
          <p id="leave-question" className="text-ink">
            {savingWorks ? LEAVE_TEXT_SAVED : LEAVE_TEXT_NOT_SAVING}
          </p>
          <div className="mt-3 flex justify-center gap-3">
            <button type="button" onClick={leave} className={BTN}>
              Leave
            </button>
            <button ref={stayBtnRef} type="button" onClick={stay} className={BTN_PRIMARY}>
              Stay
            </button>
          </div>
        </div>
      )}
      {shownLine !== null && (
        <p data-testid="cross-level-line" className="min-h-6 text-center text-sm text-ink">
          {shownLine}
        </p>
      )}
      <div className="flex flex-row-reverse items-center justify-center gap-3">
        <div className="flex flex-col items-start gap-0.5">
          <h2 className="text-lg text-ink max-[359px]:whitespace-nowrap max-[359px]:text-sm">
            Ghost {index + 1} of {total}
          </h2>
          <p className="text-xs text-muted sm:text-sm">{stepLabel}</p>
        </div>
        <GhostPrompt record={record} outcome={result} compact flinch={flinch} />
      </div>
      {step === 'summon' ? (
        <SummonStep
          key={record.character}
          record={record}
          dataset={dataset}
          config={config}
          onDone={handleSummonDone}
          onWrongKey={handleWrongKey}
          firstMeeting={firstMeeting.has(record.character)}
          walkthroughLines={walkthroughLines}
          reservedPx={reservedPx}
        />
      ) : (
        <>
          {isWalkthrough && result === null && (
            <p data-testid="walkthrough-write-line" className="text-center text-ink">
              {WALKTHROUGH_WRITE_LINE}
            </p>
          )}
          <WriteMode
            record={record}
            dataset={dataset}
            config={config}
            onOutcome={handleWriteOutcome}
            reservedPx={reservedPx}
            sealed={result === 'clean'}
          />
        </>
      )}
      {result !== null && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-ink">{(mode === 'review' ? REVIEW_RESULT_TEXT : RESULT_TEXT)[result]}</p>
          <button
            ref={nextRef}
            type="button"
            onClick={handleAdvance}
            className={`${confirmingLeave ? 'slip' : 'slip-primary font-medium'} min-h-[44px] px-5 py-3 ${FOCUS}`}
          >
            {isLast ? 'Finish the séance' : 'Next ghost'}
          </button>
        </div>
      )}
    </div>
  );
}
