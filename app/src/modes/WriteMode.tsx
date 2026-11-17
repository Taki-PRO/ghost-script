import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import type { CharacterRecord } from '../data/types';
import { makeCharDataLoader, type CharacterDataset } from '../data/charDataLoader';
import type { EngineConfig } from '../engine/config';
import type { Outcome } from '../engine/scheduler';
import { resolveCompletion } from '../engine/outcome';
import { writeSurfaceSize } from '../engine/surfaceSize';
import { moonRoomPx } from '../engine/moonRoom';
import { WRITE_PADDING_PX } from '../engine/sealLayout';
import { theme } from '../styles/theme';
import { InkSurface } from '../components/InkSurface';
import { SealStamp } from '../components/SealStamp';

export interface WriteModeProps {
  record: CharacterRecord;
  dataset: CharacterDataset;
  config: EngineConfig;
  /** Called exactly once per record, at the moment the outcome is reached. */
  onOutcome: (outcome: Outcome) => void;
  /** Height in px reserved for a line above the surface (first-meeting walkthrough). Default 0. */
  reservedPx?: number;
  /** True after a clean outcome: the seal appears on the paper. */
  sealed?: boolean;
}

export { resolveCompletion } from '../engine/outcome';

/**
 * Req 5.4: hanzi-writer 3.7.3 passes `mistakesOnStroke` (already including the
 * current miss) to onMistake and highlights the next stroke when
 * `mistakesOnStroke >= showHintAfterMisses`. We mirror exactly that rule.
 */
export function isHintTriggered(
  mistakesOnStroke: number,
  config: Pick<EngineConfig, 'strokeHintAfterConsecutiveMisses'>,
): boolean {
  return mistakesOnStroke >= config.strokeHintAfterConsecutiveMisses;
}

type Status = 'writing' | 'resolved' | 'failed';

/**
 * Write mode: the player draws the hidden character stroke by stroke, checked
 * live by hanzi-writer's quiz mode. The glyph is never rendered before
 * resolution (Req 5.1).
 *
 * WriteMode reports the outcome immediately (once) and does NOT advance to the
 * next ghost: after resolving it keeps showing the revealed character until the
 * parent changes `record` (SeanceSession owns advancing).
 */
export function WriteMode({ record, dataset, config, onOutcome, reservedPx = 0, sealed = false }: WriteModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const resolvedRef = useRef(false);
  const onOutcomeRef = useRef(onOutcome);
  onOutcomeRef.current = onOutcome;
  const configRef = useRef(config);
  configRef.current = config;

  // Computed once per mount so the surface and hanzi-writer always agree.
  const [side] = useState(() => writeSurfaceSize(window.innerWidth, window.innerHeight, reservedPx + moonRoomPx(window.innerWidth)));
  const [status, setStatus] = useState<Status>('writing');
  const [loading, setLoading] = useState(true);
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState('Draw the first stroke');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    resolvedRef.current = false;
    setStatus('writing');
    setLoading(true);
    setMistakes(0);
    setFeedback('Draw the first stroke');
    container.replaceChildren();

    let mistakeCount = 0;
    let hintShown = false;
    let disposed = false;

    const resolve = (outcome: Outcome, next: Status): boolean => {
      if (resolvedRef.current || disposed) return false;
      resolvedRef.current = true;
      setStatus(next);
      onOutcomeRef.current(outcome);
      return true;
    };
    const fail = () => {
      if (resolve('gave-up', 'failed')) setFeedback('✗ This ghost could not be summoned');
    };

    try {
      const writer = HanziWriter.create(container, record.character, {
        width: side,
        height: side,
        padding: WRITE_PADDING_PX,
        showCharacter: false,
        showOutline: false,
        strokeColor: theme.inkOnPaper,
        outlineColor: theme.gridLine,
        highlightColor: theme.hintInk,
        drawingColor: theme.drawing,
        drawingWidth: 6,
        charDataLoader: makeCharDataLoader(dataset),
        onLoadCharDataError: fail,
      });
      writerRef.current = writer;
      writer
        .quiz({
          showHintAfterMisses: configRef.current.strokeHintAfterConsecutiveMisses,
          onMistake: (data) => {
            if (resolvedRef.current) return;
            mistakeCount += 1;
            setMistakes(mistakeCount);
            if (isHintTriggered(data.mistakesOnStroke, configRef.current)) hintShown = true;
            setFeedback(
              hintShown
                ? '✗ Not that stroke — try again. 💡 Hint: the next stroke is shown'
                : '✗ Not that stroke — try again',
            );
          },
          onCorrectStroke: () => {
            if (resolvedRef.current) return;
            setFeedback('✓ Stroke accepted');
          },
          onComplete: (data) => {
            if (resolvedRef.current) return;
            const total = Math.max(mistakeCount, data.totalMistakes);
            const outcome = resolveCompletion(hintShown, total, configRef.current);
            if (!resolve(outcome, 'resolved')) return;
            setMistakes(total);
            // The result line belongs to SeanceSession (combined Outcome); keep this one empty.
            setFeedback('');
            void writer.showCharacter();
          },
        })
        .then(() => {
          if (!disposed) setLoading(false);
        })
        .catch(fail);
    } catch {
      fail();
    }

    return () => {
      disposed = true;
      writerRef.current?.cancelQuiz();
      writerRef.current = null;
      container.replaceChildren();
    };
    // `side` is fixed for the life of the component.
  }, [record.character, dataset]);

  const handleGiveUp = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true; // (a) later events no longer count
    setStatus('resolved');
    const writer = writerRef.current;
    try {
      writer?.cancelQuiz(); // (b)
      void writer?.animateCharacter()?.catch(() => undefined); // (c)
    } catch {
      /* reveal is best-effort; the outcome below still stands */
    }
    setFeedback('The ghost reveals itself');
    onOutcomeRef.current('gave-up'); // (d)
  };

  return (
    <section aria-label="Write mode" className="flex flex-col items-center gap-2 text-ink">
      <InkSurface
        size={`${side}px`}
        containerRef={containerRef}
        role="group"
        ariaLabel="Writing area: draw the character from memory, stroke by stroke"
        overlay={sealed ? <SealStamp character={record.character} /> : undefined}
      />
      <p role="status" aria-live="polite" className="min-h-[1.5rem] text-center text-ink">
        {feedback}
      </p>
      <p className="text-sm text-muted">Mistakes: {mistakes}</p>
      {status === 'writing' ? (
        <button
          type="button"
          onClick={handleGiveUp}
          disabled={loading}
          className="min-h-[44px] rounded-md border border-muted px-4 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost disabled:opacity-50"
        >
          Give up
        </button>
      ) : null}
    </section>
  );
}
