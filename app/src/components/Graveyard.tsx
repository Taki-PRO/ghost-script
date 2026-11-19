import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { CharacterDataset } from '../data/charDataLoader';
import type { Level } from '../data/types';
import { buildGraveyard } from '../engine/graveyard';
import type { Grave, GraveState } from '../engine/graveyard';
import { graveyardExplanation, graveyardOrder } from '../engine/graveyardOrder';
import { learningOrder } from '../engine/learningOrder';
import { LEVELS } from '../engine/levels';
import type { ReviewHistory } from '../engine/scheduler';
import { tabletTiltIndex } from '../engine/tabletTilt';
import { pickWalkthroughGhost } from '../engine/walkthrough';
import { theme } from '../styles/theme';
import { GrassTuft } from './GrassTuft';
import {
  FAR_RIDGE_PATH,
  HILL_REM_PER_UNIT,
  HILL_TUFTS,
  NEAR_RIDGE_PATH,
  TABLET_TUFT_SCALE,
  TUFT_WIDTH,
  tabletTufts,
} from '../engine/grassPattern';
import { columnCount, moreGravesText, visibleGraveCount } from '../engine/graveyardRows';

/** Height of the Hillside svg: three rows of tablets at 4 rem (`h-48`). */
const HILL_HEIGHT_REM = 12;

/** What the Graveyard is doing about a level switch; `level` is the level asked for. */
export type GraveyardStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; level: Level }
  | { kind: 'failed'; level: Level };

export interface GraveyardProps {
  /** Dataset of the shown level, or null while it loads. */
  dataset: CharacterDataset | null;
  /** The shown level. */
  level: Level;
  /** The player's chosen level (where séances draw new ghosts from). */
  chosenLevel: Level;
  history: ReviewHistory;
  now: number;
  status: GraveyardStatus;
  onChangeLevel: (level: Level) => void;
  onBack: () => void;
  /** Restless ghosts over all levels; the review slip shows only while this is at least 1. */
  restlessCount?: number;
  /** Starts a Review_Run. */
  onReviewRestless?: () => void;
  /** True after a Review_Run could not start (Req 10.28). */
  reviewError?: boolean;
}

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const MARKER: Record<GraveState, string> = { unmet: '·', restless: '!', 'at-rest': '✓' };
const SHAPE: Record<GraveState, string> = {
  unmet: 'tablet tablet-unmet',
  restless: 'tablet tablet-restless',
  'at-rest': 'tablet tablet-rest',
};
// Every tablet has an arched top (radii in index.css). Outline still differs per state:
// at rest a solid edge, restless a dashed edge, never met no border at all (blank stone).
const OUTLINE: Record<GraveState, string> = {
  unmet: '',
  restless: 'border-2 border-dashed border-ghost',
  'at-rest': 'border-2 border-solid border-ink',
};
const LEGEND: readonly { state: GraveState; label: string }[] = [
  { state: 'unmet', label: 'Never met' },
  { state: 'restless', label: 'Restless' },
  { state: 'at-rest', label: 'At rest' },
];

/**
 * Grid column count of the wrapper, measured before paint and kept current by a
 * ResizeObserver (window resize where there is none). `active` says the wrapper is mounted.
 */
function useGridColumns(ref: RefObject<HTMLElement | null>, active: boolean): number {
  const [columns, setColumns] = useState(() => columnCount(0));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const measure = () => setColumns(columnCount(el.clientWidth));
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [ref, active]);
  return columns;
}

function graveLabel(grave: Grave, total: number): string {
  if (grave.state === 'unmet') return `Ghost ${grave.position} of ${total}, never met`;
  if (grave.state === 'restless') {
    const base = `${grave.char}, restless, due again`;
    return grave.streak > 0 ? `${base}, ${grave.streak} clean in a row` : base;
  }
  return `${grave.char}, at rest, ${grave.streak} clean in a row`;
}

/**
 * Graveyard screen (Req 7, harder-ghosts Req 10). Read-only: history and clock come from the
 * caller, as does the dataset of the shown level. An unmet grave carries no character, so none
 * can be rendered for it.
 */
export function Graveyard({
  dataset,
  level,
  chosenLevel,
  history,
  now,
  status,
  onChangeLevel,
  onBack,
  restlessCount = 0,
  onReviewRestless,
  reviewError = false,
}: GraveyardProps) {
  const { model, hasGuided } = useMemo(() => {
    if (!dataset) return { model: null, hasGuided: false };
    const order = learningOrder(dataset);
    return {
      model: buildGraveyard(graveyardOrder(level, order, dataset), history, now),
      hasGuided: level === 1 && pickWalkthroughGhost(order, dataset) !== null,
    };
  }, [dataset, level, history, now]);
  const total = model ? model.graves.length : 0;
  const noneMet = model !== null && model.counts.unmet === total;
  const loading = status.kind === 'loading';
  const wrapperRef = useRef<HTMLDivElement>(null);
  const columns = useGridColumns(wrapperRef, model !== null);
  const shown = useMemo(() => {
    if (!model) return 0;
    let lastMetIndex = -1;
    model.graves.forEach((g, i) => {
      if (g.state !== 'unmet') lastMetIndex = i;
    });
    return visibleGraveCount(model.graves.length, columns, lastMetIndex);
  }, [model, columns]);
  const collapsedText = moreGravesText(total - shown);

  return (
    <main className="min-h-screen px-4 pb-8 text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="sticky-below-moon sticky z-20 -mx-4 flex min-h-[64px] items-center justify-between gap-3 border-b border-muted/40 bg-night-top px-4 py-2">
          <h1 className="min-w-0 font-display text-2xl font-semibold sm:text-3xl">Graveyard</h1>
          <button
            type="button"
            onClick={onBack}
            className={`slip min-h-[44px] shrink-0 whitespace-nowrap px-6 py-2 text-base ${focusRing}`}
          >
            Back to menu
          </button>
        </header>
        <div role="group" aria-label="Level" className="flex flex-wrap items-center gap-3">
          {LEVELS.map((n) => {
            const shown = n === level;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={shown}
                disabled={loading}
                onClick={() => onChangeLevel(n)}
                className={`slip min-h-[44px] px-5 py-2 text-base ${shown ? 'border-2 border-solid font-semibold' : ''} ${focusRing}`}
              >
                Level {n}
                {shown && (
                  <span aria-hidden="true" className="ml-2 text-sm">
                    showing
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-ink">{`Your séances draw new ghosts from level ${chosenLevel}.`}</p>
        {restlessCount >= 1 && onReviewRestless && (
          <button
            type="button"
            onClick={onReviewRestless}
            className={`slip min-h-[44px] self-start px-6 py-2 text-base ${focusRing}`}
          >
            Review restless ghosts ({restlessCount})
          </button>
        )}
        {reviewError && (
          <p role="alert" className="text-base text-ink">
            The review could not start. Check your connection and try again.
          </p>
        )}
        {status.kind === 'loading' && (
          <p role="status" className="text-base text-ink">
            {`Loading level ${status.level}…`}
          </p>
        )}
        {status.kind === 'failed' && (
          <p role="alert" className="text-base text-ink">
            {`Level ${status.level} could not be loaded. Check your connection and try again.`}
          </p>
        )}
        <p className="text-base text-ink">
          {graveyardExplanation(level, hasGuided)}
        </p>
        {model && (
          <>
            <ul aria-label="Legend" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
              {LEGEND.map(({ state, label }) => (
                <li key={state} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`${SHAPE[state]} ${OUTLINE[state]} relative inline-flex h-8 w-8 items-center justify-center`}
                  >
                    {MARKER[state]}
                  </span>
                  <span>{`${label}: ${model.counts[state]}`}</span>
                </li>
              ))}
            </ul>
            {noneMet && (
              <p className="text-base text-ink">
                No ghost has been met yet. Begin a séance to wake the first one.
              </p>
            )}
            <div
              ref={wrapperRef}
              className="relative isolate overflow-hidden rounded-md"
              style={{
                backgroundImage: `linear-gradient(to bottom, transparent ${HILL_HEIGHT_REM}rem, ${theme.hillNear} ${HILL_HEIGHT_REM}rem)`,
              }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 100 48"
                preserveAspectRatio="none"
                className="absolute left-0 top-0 h-48 w-full"
                data-testid="hillside"
              >
                <path d={FAR_RIDGE_PATH} fill={theme.hillFar} />
                <path d={NEAR_RIDGE_PATH} fill={theme.hillNear} />
              </svg>
              {HILL_TUFTS.map((t, slot) => (
                <span
                  key={slot}
                  aria-hidden="true"
                  data-grass="hill"
                  className="pointer-events-none absolute"
                  style={{
                    left: `${t.xPercent}%`,
                    top: `${t.crestY * HILL_REM_PER_UNIT}rem`,
                    transform: 'translate(-50%, calc(-100% + 2px))',
                  }}
                >
                  <GrassTuft shape={t.shape} scale={t.scale} />
                </span>
              ))}
              <ul
                aria-label="Graves"
                className="relative grid gap-2 p-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' }}
              >
                {model.graves.slice(0, shown).map((grave) => (
                  <li
                    key={grave.position}
                    aria-label={graveLabel(grave, total)}
                    className={`${SHAPE[grave.state]} ${OUTLINE[grave.state]} tablet-tilt-${tabletTiltIndex(grave.position)} relative flex min-h-[56px] flex-col items-center justify-center text-ink`}
                  >
                    {tabletTufts(grave.position).map((tuft, k) => (
                      <span
                        key={k}
                        aria-hidden="true"
                        data-grass="tablet"
                        className="pointer-events-none absolute bottom-0 -z-10"
                        style={{
                          left: '50%',
                          marginLeft: `${tuft.dx - (TUFT_WIDTH * TABLET_TUFT_SCALE) / 2}px`,
                        }}
                      >
                        <GrassTuft shape={tuft.shape} scale={TABLET_TUFT_SCALE} />
                      </span>
                    ))}
                    {grave.state !== 'unmet' && (
                      <span lang="zh" className="text-xl leading-none">
                        {grave.char}
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className={`text-xs leading-none ${grave.state === 'at-rest' ? 'text-seal-light' : ''}`}
                    >
                      {MARKER[grave.state]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {collapsedText && <p className="text-sm text-ink">{collapsedText}</p>}
          </>
        )}
      </div>
    </main>
  );
}
