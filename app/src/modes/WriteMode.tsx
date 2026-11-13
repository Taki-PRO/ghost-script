import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import type { CharacterRecord } from '../data/types';
import { makeCharDataLoader, type CharacterDataset } from '../data/charDataLoader';
import type { EngineConfig } from '../engine/config';
import type { Outcome } from '../engine/scheduler';
import { theme } from '../styles/theme';

export interface WriteModeProps {
  record: CharacterRecord;
  dataset: CharacterDataset;
  config: EngineConfig;
  /** Called exactly once per record, at the moment the outcome is reached. */
  onOutcome: (outcome: Outcome) => void;
}

/** Req 5.5 / 5.6: clean iff no hint was shown AND mistakes <= clean threshold. */
export function resolveCompletion(
  hintShown: boolean,
  mistakes: number,
  config: Pick<EngineConfig, 'cleanMistakeThreshold'>,
): Outcome {
  return !hintShown && mistakes <= config.cleanMistakeThreshold ? 'clean' : 'struggled';
}

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

/** Pixel size handed to hanzi-writer: matches CSS `min(80vw, 420px)`. */
export function surfaceSize(viewportWidth: number): number {
  return Math.round(Math.min(viewportWidth * 0.8, 420));
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
export function WriteMode({ record, dataset, config, onOutcome }: WriteModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const resolvedRef = useRef(false);
  const onOutcomeRef = useRef(onOutcome);
  onOutcomeRef.current = onOutcome;
  const configRef = useRef(config);
  configRef.current = config;

  const [status, setStatus] = useState<Status>('writing');
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState('Draw the first stroke');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    resolvedRef.current = false;
    setStatus('writing');
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
      const size = surfaceSize(window.innerWidth);
      const writer = HanziWriter.create(container, record.character, {
        width: size,
        height: size,
        padding: 12,
        showCharacter: false,
        showOutline: false,
        strokeColor: theme.ink,
        highlightColor: theme.ghost,
        drawingColor: theme.ghost,
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
            setFeedback(
              outcome === 'clean'
                ? '✓ Laid to rest'
                : '✓ Laid to rest — but this ghost will return soon',
            );
            void writer.showCharacter();
          },
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
    <section aria-label="Write mode" className="flex flex-col items-center gap-3 text-ink">
      <div
        ref={containerRef}
        role="group"
        aria-label="Writing area: draw the character from memory, stroke by stroke"
        className="touch-none rounded-lg bg-surface"
        style={{ touchAction: 'none', width: 'min(80vw, 420px)', aspectRatio: '1 / 1' }}
      />
      <p role="status" aria-live="polite" className="min-h-[1.5rem] text-center text-ink">
        {feedback}
      </p>
      <p className="text-sm text-muted">Mistakes: {mistakes}</p>
      <button
        type="button"
        onClick={handleGiveUp}
        disabled={status !== 'writing'}
        className="rounded-md border border-muted px-4 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost disabled:opacity-50"
      >
        Give up
      </button>
    </section>
  );
}
