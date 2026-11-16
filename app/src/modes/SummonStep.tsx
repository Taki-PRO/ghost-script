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
import { summonPaperSize } from '../engine/surfaceSize';
import { InkSurface } from '../components/InkSurface';
import { theme } from '../styles/theme';

/** Time the formed character stays on screen before it fades (Req 2.4). */
export const SUMMON_HOLD_MS = 1500;
/** Duration of the fade-out (Req 2.4). */
export const SUMMON_FADE_MS = 1500;

export interface SummonStepProps {
  record: CharacterRecord;
  dataset: CharacterDataset;
  config: EngineConfig;
  /** Called exactly once, after the character has formed, been held, faded and been removed. */
  onDone: (stepResult: Outcome) => void;
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
export function SummonStep({ record, dataset, config, onDone }: SummonStepProps) {
  const code = record.cangjie ?? '';
  const lettersOnly = KEY_FACE_CHARACTERS.has(record.character);

  const stateRef = useRef<SummonState>(startSummon(code));
  const [state, setState] = useState<SummonState>(stateRef.current);
  const [phase, setPhase] = useState<Phase>('typing');
  const [feedback, setFeedback] = useState('Type the first key of the code');
  const [fallback, setFallback] = useState(false);
  const [side] = useState(() => summonPaperSize(window.innerWidth, window.innerHeight));

  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const timersRef = useRef<number[]>([]);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const configRef = useRef(config);
  configRef.current = config;

  const finished = state.status !== 'active';

  const commit = useCallback((next: SummonState, message: string | null) => {
    stateRef.current = next;
    setState(next);
    if (message !== null) setFeedback(message);
    if (next.status !== 'active') setPhase('forming');
  }, []);

  const enterKey = useCallback(
    (key: CangjieKey) => {
      const prev = stateRef.current;
      if (prev.status !== 'active') return;
      const next = applyKeyEntry(prev, key, configRef.current);
      commit(next, describe(prev, next));
    },
    [commit],
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
      commit(next, describe(prev, next));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commit]);

  const handleGiveUp = () => {
    const prev = stateRef.current;
    if (prev.status !== 'active') return;
    commit(giveUpSummon(prev), 'The ghost is summoned for you');
  };

  const started = phase !== 'typing';

  // Forming, holding and fading. No hanzi-writer instance exists before this.
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

    return () => {
      disposed = true;
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      writerRef.current = null;
      container.replaceChildren();
    };
  }, [started, record.character, dataset, side]);

  const hintVisible = isKeyHintVisible(state, config);
  const hintKey = hintVisible ? nextExpectedKey(state) : null;
  const hintShape = hintKey ? SHAPE_BY_KEY.get(hintKey) ?? '' : '';
  const hintText = hintKey
    ? lettersOnly
      ? `Hint: press ${hintKey}`
      : `Hint: press ${hintKey} (${maskTarget(hintShape, record.character)})`
    : null;

  const shapeFor = (shape: string) => (finished ? shape : maskTarget(shape, record.character));

  const slots = Array.from({ length: code.length }, (_, i) => {
    const letter = code[i] as CangjieKey;
    const filled = finished || i < state.filled;
    const shape = SHAPE_BY_KEY.get(letter) ?? '';
    const isHint = hintKey !== null && i === state.filled;
    return (
      <li
        key={i}
        aria-label={filled ? undefined : `Slot ${i + 1}, empty`}
        className={`flex h-12 w-11 flex-col items-center justify-center rounded-md border text-ink ${
          isHint ? 'border-ghost ring-2 ring-ghost' : 'border-muted'
        } bg-surface`}
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
        ) : null}
      </li>
    );
  });

  const fading = phase === 'fading';
  const reduced = prefersReducedMotion();

  return (
    <section aria-label="Summon step" className="flex flex-col items-center gap-2 text-ink">
      <ol aria-label="Cangjie code" className="flex flex-nowrap justify-center gap-2">
        {slots}
      </ol>

      <div className="relative">
        <InkSurface
          size={`${side}px`}
          containerRef={containerRef}
          hidden={phase === 'typing'}
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
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={lettersOnly ? `Key ${key}` : `Key ${key}, ${shapeFor(shape)}`}
                  disabled={finished}
                  onClick={() => enterKey(key)}
                  className={`flex min-h-[44px] w-full min-w-0 flex-col items-center justify-center rounded-md border px-0 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost disabled:opacity-50 ${
                    isHint ? 'border-ghost ring-2 ring-ghost' : 'border-muted'
                  }`}
                >
                  <span aria-hidden="true" className="text-sm font-semibold">
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
          className="min-h-[44px] rounded-md border border-muted px-4 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost"
        >
          Give up
        </button>
      ) : null}
    </section>
  );
}

function describe(prev: SummonState, next: SummonState): string {
  if (next.filled > prev.filled) {
    return next.status === 'active' ? '✓ Key accepted' : '✓ Code complete';
  }
  return '✗ Not that key';
}
