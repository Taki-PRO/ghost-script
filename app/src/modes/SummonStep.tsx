import { useCallback, useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import type { CharacterRecord } from '../data/types';
import { makeCharDataLoader, type CharacterDataset } from '../data/charDataLoader';
import type { EngineConfig } from '../engine/config';
import type { Outcome } from '../engine/scheduler';
import {
  CANGJIE_KEYS,
  KEY_FACE_CHARACTERS,
  applyKeyEntry,
  applyKeyEvent,
  giveUpSummon,
  isKeyHintVisible,
  nextExpectedKey,
  startSummon,
  type CangjieKey,
  type SummonState,
} from '../engine/cangjie';
import { maskTarget } from '../engine/mask';
import { WALKTHROUGH_LINE_PX, summonPaperSize } from '../engine/surfaceSize';
import { InkSurface } from '../components/InkSurface';
import { theme } from '../styles/theme';

/** Time the formed character stays on screen before it fades (Req 2.4). */
export const SUMMON_HOLD_MS = 1500;
/** Duration of the fade-out (Req 2.4). */
export const SUMMON_FADE_MS = 1500;
/** hanzi-writer strokeAnimationSpeed while ink strokes are drawn (about half the default drawing time). */
export const SUMMON_INK_SPEED = 2;
/** Reduced motion: a stroke finishes within one animation frame. */
const SUMMON_REDUCED_SPEED = 1000;

/** Status-line text for a correct key whose shape the game does not ink (partial characters only). */
export const INKLESS_KEY_TEXT = "This key's shape is one the game doesn't show yet.";
/** Static note for characters whose code inks nothing (opaque characters only). */
export const OPAQUE_NOTE = "This code uses shapes the game doesn't show yet.";

export interface SummonStepProps {
  record: CharacterRecord;
  dataset: CharacterDataset;
  config: EngineConfig;
  /** Called exactly once, after the character has formed, been held, faded and been removed. */
  onDone: (stepResult: Outcome) => void;
  /** True when the ghost has no saved history: show the faint code and the next-key highlight. Default false. */
  firstMeeting?: boolean;
  /** One line per key (Walkthrough_Ghost only); the line for the first unfilled key shows while typing. */
  walkthroughLines?: readonly string[];
  /** Called once for each wrong key that the engine counts as a miss, and for no other event. */
  onWrongKey?: () => void;
}

type Phase = 'typing' | 'forming' | 'fading';

const KEY_ROWS: readonly string[] = ['QWERTYUIOP', 'ASDFGHJKL', 'XCVBNM'];
const SHAPE_BY_KEY: ReadonlyMap<string, string> = new Map(
  CANGJIE_KEYS.map((k) => [k.key, k.shape]),
);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  const attr = target.getAttribute('contenteditable');
  return attr !== null && attr !== 'false';
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Summon step: the player types the ghost's Cangjie code; once the code is
 * complete (or the player gives up) the character forms in ink, is held,
 * fades and is removed. The target character is never in the DOM before that.
 */
export function SummonStep({
  record,
  dataset,
  config,
  onDone,
  firstMeeting = false,
  walkthroughLines,
  onWrongKey,
}: SummonStepProps) {
  const code = record.cangjie ?? '';
  const lettersOnly = KEY_FACE_CHARACTERS.has(record.character);

  const stateRef = useRef<SummonState>(startSummon(code));
  const [state, setState] = useState<SummonState>(stateRef.current);
  const [phase, setPhase] = useState<Phase>('typing');
  const [feedback, setFeedback] = useState(
    firstMeeting ? 'Copy the faint letters, one key at a time' : 'Type the first key of the code',
  );
  const [fallback, setFallback] = useState(false);
  const [side] = useState(() =>
    summonPaperSize(
      window.innerWidth,
      window.innerHeight,
      walkthroughLines ? WALKTHROUGH_LINE_PX : 0,
    ),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const timersRef = useRef<number[]>([]);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onWrongKeyRef = useRef(onWrongKey);
  onWrongKeyRef.current = onWrongKey;
  const configRef = useRef(config);
  configRef.current = config;

  const finished = state.status !== 'active';

  const keyStrokes = record.summonInk.class === 'opaque' ? null : record.summonInk.keyStrokes;
  const inks = keyStrokes !== null && code !== '';
  const strokeCount = record.strokeCount;

  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const queuedRef = useRef<Set<number>>(new Set());
  const brokenRef = useRef(false);
  const disposedRef = useRef(false);

  /** Queue strokes; each animateStroke call is awaited before the next starts. */
  const enqueueInk = useCallback((strokes: readonly number[]) => {
    const writer = writerRef.current;
    for (const s of strokes) {
      if (queuedRef.current.has(s)) continue;
      queuedRef.current.add(s);
      chainRef.current = chainRef.current
        .then(async () => {
          if (disposedRef.current || brokenRef.current || writer === null) return;
          await writer.animateStroke(s);
        })
        .catch(() => {
          brokenRef.current = true;
        });
    }
  }, []);

  /** Ink the key's strokes and build the status message for a key press. */
  const afterKey = useCallback(
    (prev: SummonState, next: SummonState): string => {
      const accepted = next.filled > prev.filled;
      let inkless = false;
      if (accepted && keyStrokes !== null) {
        const strokes = keyStrokes[prev.filled] ?? [];
        inkless = record.summonInk.class === 'partial' && strokes.length === 0;
        if (inks) enqueueInk(strokes);
      }
      return describe(prev, next, inkless);
    },
    [keyStrokes, inks, enqueueInk, record.summonInk.class],
  );

  const commit = useCallback((next: SummonState, message: string | null) => {
    stateRef.current = next;
    setState(next);
    if (message !== null) setFeedback(message);
    if (next.status !== 'active') setPhase('forming');
  }, []);
  /** Report a counted miss (the engine's mistake count went up). */
  const reportMiss = useCallback((prev: SummonState, next: SummonState) => {
    if (next.mistakes > prev.mistakes) onWrongKeyRef.current?.();
  }, []);

  const enterKey = useCallback(
    (key: CangjieKey) => {
      const prev = stateRef.current;
      if (prev.status !== 'active') return;
      const next = applyKeyEntry(prev, key, configRef.current);
      commit(next, afterKey(prev, next));
      reportMiss(prev, next);
    },
    [commit, afterKey, reportMiss],
  );

  // Physical keyboard.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const prev = stateRef.current;
      if (prev.status !== 'active') return;
      const next = applyKeyEvent(prev, e, configRef.current);
      if (next === prev) return;
      e.preventDefault();
      commit(next, afterKey(prev, next));
      reportMiss(prev, next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commit, afterKey, reportMiss]);

  // Ink classes: the writer exists from the start, with no stroke visible.
  useEffect(() => {
    if (!inks) return;
    const container = containerRef.current;
    if (!container) return;
    disposedRef.current = false;
    brokenRef.current = false;
    queuedRef.current = new Set();
    chainRef.current = Promise.resolve();
    try {
      writerRef.current = HanziWriter.create(container, record.character, {
        width: side,
        height: side,
        padding: 12,
        showCharacter: false,
        showOutline: false,
        strokeColor: theme.inkOnPaper,
        strokeAnimationSpeed: prefersReducedMotion() ? SUMMON_REDUCED_SPEED : SUMMON_INK_SPEED,
        charDataLoader: makeCharDataLoader(dataset),
        onLoadCharDataError: () => {
          brokenRef.current = true;
        },
      });
    } catch {
      brokenRef.current = true;
      writerRef.current = null;
    }
    return () => {
      disposedRef.current = true;
      writerRef.current = null;
      container.replaceChildren();
    };
  }, [inks, record.character, dataset, side]);

  const handleGiveUp = () => {
    const prev = stateRef.current;
    if (prev.status !== 'active') return;
    commit(giveUpSummon(prev), 'The ghost is summoned for you');
  };

  const started = phase !== 'typing';

  // Forming, holding and fading. Opaque characters get their hanzi-writer instance here.
  useEffect(() => {
    if (!started) return;
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let advanced = false;

    const later = (fn: () => void, ms: number) => {
      timersRef.current.push(window.setTimeout(fn, ms));
    };
    const finish = () => {
      if (disposed || doneRef.current) return;
      doneRef.current = true;
      container.replaceChildren();
      writerRef.current = null;
      setFallback(false);
      const status = stateRef.current.status;
      if (status !== 'active') onDoneRef.current(status);
    };
    const holdAndFade = () => {
      if (disposed || advanced) return;
      advanced = true;
      later(() => {
        if (disposed) return;
        if (prefersReducedMotion()) {
          finish();
          return;
        }
        setPhase('fading');
        later(finish, SUMMON_FADE_MS);
      }, SUMMON_HOLD_MS);
    };
    const useFallback = () => {
      if (disposed || advanced) return;
      container.replaceChildren();
      setFallback(true);
      holdAndFade();
    };

    if (inks) {
      // Draw every stroke not yet inked, in ascending order, then hold and fade.
      if (writerRef.current === null || brokenRef.current) {
        useFallback();
      } else {
        enqueueInk(Array.from({ length: strokeCount }, (_, i) => i));
        chainRef.current.then(() => {
          if (disposed) return;
          if (brokenRef.current) useFallback();
          else holdAndFade();
        });
      }
    } else {
      try {
        const writer = HanziWriter.create(container, record.character, {
          width: side,
          height: side,
          padding: 12,
          showCharacter: false,
          showOutline: false,
          strokeColor: theme.inkOnPaper,
          charDataLoader: makeCharDataLoader(dataset),
          onLoadCharDataError: useFallback,
        });
        writerRef.current = writer;
        writer.animateCharacter().then(holdAndFade, useFallback);
      } catch {
        useFallback();
      }
    }

    return () => {
      disposed = true;
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      if (!inks) writerRef.current = null;
      container.replaceChildren();
    };
  }, [started, inks, strokeCount, enqueueInk, record.character, dataset, side]);

  const hintVisible = isKeyHintVisible(state, config);
  const hintKey = hintVisible ? nextExpectedKey(state) : null;
  const hintShape = hintKey ? SHAPE_BY_KEY.get(hintKey) ?? '' : '';
  const hintText = hintKey
    ? lettersOnly
      ? `Hint: press ${hintKey}`
      : `Hint: press ${hintKey} (${maskTarget(hintShape, record.character)})`
    : null;

  const teach = firstMeeting && phase === 'typing' && state.status === 'active';
  const nextKey: CangjieKey | null =
    teach && state.filled < code.length ? (code[state.filled] as CangjieKey) : null;
  const walkthroughLine =
    phase === 'typing' && walkthroughLines ? walkthroughLines[state.filled] ?? '' : '';

  const shapeFor = (shape: string) => (finished ? shape : maskTarget(shape, record.character));

  const slots = Array.from({ length: code.length }, (_, i) => {
    const letter = code[i] as CangjieKey;
    const filled = finished || i < state.filled;
    const shape = SHAPE_BY_KEY.get(letter) ?? '';
    const isHint = hintKey !== null && i === state.filled;
    const isNext = nextKey !== null && i === state.filled;
    const faint = teach && !filled;
    return (
      <li
        key={i}
        aria-label={
          filled ? undefined : faint ? `Slot ${i + 1}, type ${letter}` : `Slot ${i + 1}, empty`
        }
        aria-current={isNext ? 'true' : undefined}
        className={`flex h-12 w-11 flex-col items-center justify-center rounded-md border text-ink ${
          isHint || isNext ? 'border-ghost ring-2 ring-ghost' : 'border-muted'
        } ${faint && !isNext ? 'border-dashed' : ''} bg-surface`}
      >
        {filled ? (
          <>
            <span className="text-xs text-muted">
              {letter}
            </span>
            <span lang="zh" className="text-xl">
              {shapeFor(shape)}
            </span>
          </>
        ) : faint ? (
          <span aria-hidden="true" className="text-sm text-muted">
            {letter}
          </span>
        ) : null}
      </li>
    );
  });

  const fading = phase === 'fading';
  const reduced = prefersReducedMotion();

  return (
    <section aria-label="Summon step" className="flex flex-col items-center gap-2 text-ink">
      {walkthroughLines ? (
        <p
          data-testid="walkthrough-line"
          className="min-h-6 whitespace-nowrap text-center text-sm text-ink"
        >
          {walkthroughLine}
        </p>
      ) : null}

      <ol aria-label="Cangjie code" className="flex flex-nowrap justify-center gap-2">
        {slots}
      </ol>

      {record.summonInk.class === 'opaque' && phase === 'typing' ? (
        <p data-testid="opaque-note" className="text-center text-sm text-muted">
          {OPAQUE_NOTE}
        </p>
      ) : null}

      <div className="relative">
        <InkSurface
          size={`${side}px`}
          containerRef={containerRef}
          hidden={phase === 'typing' && !inks}
          style={{
            opacity: fading ? 0 : 1,
            transition: fading && !reduced ? `opacity ${SUMMON_FADE_MS}ms linear` : 'none',
          }}
        />
        {fallback ? (
          <p
            lang="zh"
            className="absolute inset-0 flex items-center justify-center text-6xl"
            style={{
              color: theme.inkOnPaper,
              opacity: fading ? 0 : 1,
              transition: fading && !reduced ? `opacity ${SUMMON_FADE_MS}ms linear` : 'none',
            }}
          >
            {record.character}
          </p>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="min-h-[2.5rem] text-center text-sm text-ink">
        {hintText ? `${feedback} · ${hintText}` : feedback}
        {' · '}
        {`Mistakes: ${state.mistakes}`}
      </p>

      <div className="summon-keys flex flex-col items-center gap-[2px]">
        {KEY_ROWS.map((row, i) => (
          <div
            key={row}
            role="group"
            data-row={i}
            className="grid justify-center gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${row.length}, var(--key-w))` }}
          >
            {row.split('').map((letter) => {
              const key = letter as CangjieKey;
              const shape = SHAPE_BY_KEY.get(key) ?? '';
              const isHint = hintKey === key;
              const isNext = nextKey === key;
              const baseName = lettersOnly ? `Key ${key}` : `Key ${key}, ${shapeFor(shape)}`;
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={isNext ? `${baseName}, next` : baseName}
                  disabled={finished}
                  onClick={() => enterKey(key)}
                  className={`flex min-h-[44px] w-full min-w-0 flex-col items-center justify-center keycap px-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost disabled:opacity-50 ${
                    isHint || isNext ? 'ring-2 ring-ghost' : ''
                  } ${isNext ? 'keycap-next' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`text-sm font-semibold ${isNext ? 'font-bold underline' : ''}`}
                  >
                    {key}
                  </span>
                  {lettersOnly ? null : (
                    <span aria-hidden="true" lang="zh" className="text-xs">
                      {shapeFor(shape)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-muted">
        If typed letters do not appear, turn off your system Chinese input method.
      </p>
      <p className="text-center text-xs text-muted">Codes: Unicode Unihan kCangjie</p>

      {phase === 'typing' ? (
        <button
          type="button"
          onClick={handleGiveUp}
          className="slip min-h-[44px] px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost"
        >
          Give up
        </button>
      ) : null}
    </section>
  );
}

function describe(prev: SummonState, next: SummonState, inkless: boolean): string {
  if (next.filled > prev.filled) {
    const base = next.status === 'active' ? '✓ Key accepted' : '✓ Code complete';
    return inkless ? `${base} ${INKLESS_KEY_TEXT}` : base;
  }
  return '✗ Not that key';
}
