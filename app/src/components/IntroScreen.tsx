import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import { GhostFigure } from './GhostFigure';
import { LEGEND_SOURCE } from '../data/citations';
import type { HanziWriterCharData } from '../data/charDataLoader';
import { loadLegendStrokes } from '../data/legendStrokes';
import { LEGEND_TOTAL_CAP_MS, planLegendInk, type LegendPlan } from '../engine/legendInk';
import { GRAINS, grainLeftCss } from '../engine/grain';
import { prefersReducedMotion } from '../engine/motion';
import { theme } from '../styles/theme';

/** `#rrggbb` as `rgba(r, g, b, alpha)`. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${alpha})`;
}

/** The wipe of the fallback path ends on animationend or, if frames are throttled, after this many ms. */
const WIPE_FALLBACK_MS = 700;

type LegendPhase = 'loading' | 'ink' | 'wipe' | 'done';

interface LegendReveal {
  phase: LegendPhase;
  /** `inking` until the line is done, then `inked` and never another value. */
  state: 'inking' | 'inked';
  plan: LegendPlan | null;
  strokes: Readonly<Record<string, HanziWriterCharData>> | null;
  /** True when the loader failed and the existing wipe was used. */
  fellBack: boolean;
  finish: () => void;
  wipeEnded: () => void;
}

/** Drives the legend line: load the stroke file, then ink (success) or wipe (any failure). */
function useLegendReveal(reduced: boolean): LegendReveal {
  const [phase, setPhase] = useState<LegendPhase>(reduced ? 'done' : 'loading');
  const [plan, setPlan] = useState<LegendPlan | null>(null);
  const [strokes, setStrokes] = useState<Readonly<Record<string, HanziWriterCharData>> | null>(null);
  const [fellBack, setFellBack] = useState(false);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    const safety = window.setTimeout(() => setPhase('done'), LEGEND_TOTAL_CAP_MS);
    void loadLegendStrokes().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        const next = planLegendInk(LEGEND_SOURCE.zh, result.strokes);
        setStrokes(result.strokes);
        setPlan(next);
        setPhase((p) => (p === 'loading' ? 'ink' : p));
      } else {
        setFellBack(true);
        setPhase((p) => (p === 'loading' ? 'wipe' : p));
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
  }, [reduced]);

  useEffect(() => {
    if (phase !== 'wipe') return;
    const t = window.setTimeout(() => setPhase('done'), WIPE_FALLBACK_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  return {
    phase,
    state: phase === 'done' ? 'inked' : 'inking',
    plan,
    strokes,
    fellBack,
    finish: () => setPhase('done'),
    wipeEnded: () => setPhase((p) => (p === 'wipe' ? 'done' : p)),
  };
}

type CellState = 'pending' | 'active' | 'done';

interface LegendInkProps {
  plan: LegendPlan;
  strokes: Readonly<Record<string, HanziWriterCharData>>;
  onDone: () => void;
  className?: string;
}

/**
 * The strokes of the legend line, drawn one character at a time over the (transparent) text.
 * Hidden from assistive technology: the text string in the paragraph is the only reading.
 * hanzi-writer draws each cell's SVG in its own coordinate convention (1024 units, flipped y).
 */
function LegendInk({ plan, strokes, onDone, className = '' }: LegendInkProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const hostRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [cells, setCells] = useState<CellState[]>(() => plan.steps.map(() => 'pending'));
  const [wiped, setWiped] = useState<boolean[]>(() => plan.steps.map((s) => s.kind === 'wipe'));
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });
    const setCell = (i: number, v: CellState) =>
      setCells((prev) => prev.map((c, j) => (j === i ? v : c)));
    const markWiped = (i: number) => setWiped((prev) => prev.map((w, j) => (j === i ? true : w)));

    const run = async () => {
      const parsed = parseFloat(rowRef.current ? getComputedStyle(rowRef.current).fontSize : '');
      const px = Number.isFinite(parsed) && parsed > 0 ? parsed : 36;
      for (let i = 0; i < plan.steps.length; i += 1) {
        if (cancelled) return;
        const step = plan.steps[i];
        if (!step) continue;
        setCell(i, 'active');
        if (step.kind === 'wipe') {
          await sleep(step.ms);
        } else {
          const host = hostRefs.current[i];
          let failed: (() => void) | null = null;
          const failure = new Promise<'failed'>((resolve) => {
            failed = () => resolve('failed');
          });
          let outcome: 'ok' | 'failed' = 'failed';
          try {
            if (host) {
              const writer = HanziWriter.create(host, step.char, {
                width: px,
                height: px,
                padding: 0,
                showCharacter: false,
                showOutline: false,
                strokeColor: theme.inkOnPaper,
                strokeAnimationSpeed: step.speed,
                delayBetweenStrokes: 0,
                strokeFadeDuration: 0,
                charDataLoader: (char, onLoad, onError) => {
                  const data = strokes[char];
                  if (data) onLoad(data);
                  else onError(new Error('no legend stroke data'));
                },
                onLoadCharDataError: () => failed?.(),
              });
              outcome = await Promise.race([
                writer.animateCharacter().then(() => 'ok' as const),
                failure,
              ]);
            }
          } catch {
            outcome = 'failed';
          }
          if (cancelled) return;
          if (outcome === 'failed') {
            markWiped(i);
            await sleep(600);
          }
        }
        if (cancelled) return;
        setCell(i, 'done');
      }
      if (!cancelled) onDoneRef.current();
    };
    void run();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [plan, strokes]);

  return (
    <div
      ref={rowRef}
      aria-hidden="true"
      className={`legend-ink pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
    >
      {plan.steps.map((step, i) => {
        const state = cells[i] ?? 'pending';
        const isWipe = wiped[i] === true;
        return (
          <span
            key={`${step.char}-${i}`}
            ref={(el) => {
              hostRefs.current[i] = el;
            }}
            data-legend-cell={step.char}
            data-ink={state}
            className={isWipe && state !== 'pending' ? 'ink-reveal' : undefined}
            style={{
              display: 'inline-block',
              width: '1em',
              height: '1em',
              lineHeight: 1,
              opacity: isWipe && state === 'pending' ? 0 : 1,
            }}
          >
            {isWipe ? <span lang="zh">{step.char}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

export interface IntroScreenProps {
  onBegin: () => void;
  /** Opens the Sources & licences screen; never marks the intro as seen. */
  onOpenSources: () => void;
}

/**
 * Legend intro. Copy states only the premise and the Huainanzi attribution
 * required by Requirement 1.8; no other historical claims.
 */
export function IntroScreen({ onBegin, onOpenSources }: IntroScreenProps) {
  const reduced = prefersReducedMotion();
  const legend = useLegendReveal(reduced);
  const quoteWipes = legend.phase === 'wipe' || (legend.phase === 'done' && legend.fellBack);
  return (
    <main
      aria-labelledby="intro-title"
      className="relative isolate flex items-center justify-center text-ink"
    >
      {reduced ? null : (
        <div className="legend-grain" aria-hidden="true" data-testid="legend-grain">
          {GRAINS.map((g, i) => (
            <span
              key={i}
              className={`grain grain-${g.speed}`}
              data-grain=""
              style={{
                left: grainLeftCss(g),
                width: `${g.sizePx}px`,
                height: `${g.sizePx}px`,
                backgroundColor: rgba(theme.ink, g.alpha),
                animationDelay: `${g.delayS}s`,
              }}
            />
          ))}
        </div>
      )}
      <div className="w-full max-w-xl text-center">
        <div className="moon-glow flex flex-col items-center">
          <GhostFigure className="menu-figure mb-1 h-12 w-10 sm:h-24 sm:w-20 text-ghost" />
        </div>
        <h1
          id="intro-title"
          className="mt-1 font-display text-4xl font-semibold leading-[1.1] tracking-wide text-ink sm:text-5xl"
        >
          Ghost Script
        </h1>

        <p className="mt-2 text-base leading-snug text-ink sm:mt-6 sm:text-lg">
          In Chinese legend, Cangjie invented writing. The legend says that when he did, ghosts
          wept in the night.
        </p>
        <p className="mt-2 text-base leading-snug text-ink sm:mt-4 sm:text-lg">
          In this game, characters you have forgotten how to write are ghosts. Type a ghost's shapes to
          summon it, then write it from memory.
        </p>

        <figure
          data-legend-state={legend.state}
          data-legend-phase={legend.phase}
          className="card-slip mt-3 px-4 py-2.5 sm:mt-8 sm:py-5"
        >
          <blockquote
            className={quoteWipes ? 'ink-reveal' : undefined}
            onAnimationEnd={legend.wipeEnded}
          >
            <div className="relative">
              <p lang="zh" className="legend-text text-3xl sm:text-4xl">
                天雨粟，鬼夜哭
              </p>
              {(legend.phase === 'ink' || legend.phase === 'done') && legend.plan && legend.strokes ? (
                <LegendInk
                  plan={legend.plan}
                  strokes={legend.strokes}
                  onDone={legend.finish}
                  className="text-3xl sm:text-4xl"
                />
              ) : null}
            </div>
            <p className="mt-2 text-base">&ldquo;Heaven rained grain and ghosts wept at night.&rdquo;</p>
          </blockquote>
          <figcaption className="mt-2 text-sm">
            The Huainanzi records this line about the time Cangjie created writing.
          </figcaption>
        </figure>

        <button
          type="button"
          onClick={onBegin}
          className="slip-primary mt-4 min-h-[44px] px-8 py-2 text-lg sm:mt-10 sm:py-3 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Begin the Séance
        </button>
        <div>
          <button
            type="button"
            onClick={onOpenSources}
            className="inline-flex min-h-[44px] items-center text-sm text-ghost underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sources
          </button>
        </div>
      </div>
    </main>
  );
}

export default IntroScreen;
