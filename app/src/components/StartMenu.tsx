import type { Level } from '../data/types';
import { GhostFigure } from './GhostFigure';

export interface StartMenuProps {
  onStartSeance: () => void;
  onReviewLegend: () => void;
  onReviewCangjieGuide: () => void;
  onOpenGraveyard: () => void;
  onOpenCredits: () => void;
  /** The Chosen_Level, named on the level slip. */
  level: Level;
  /** Opens the Level_Screen. */
  onChooseLevel: () => void;
  /** Set while the Chosen_Level is a Finished_Level; `moveOn` is absent at level 3. */
  finishedNotice: { text: string; moveOn?: { label: string; onClick: () => void } } | null;
  /** Restless ghosts over all levels; the review slip shows only while this is at least 1. */
  restlessCount?: number;
  /** Starts a Review_Run. */
  onReviewRestless?: () => void;
  /** True after a Review_Run could not start (Req 10.28). */
  reviewError?: boolean;
}

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Start menu. Shown only OUTSIDE an active Séance (Req 1.5), so re-viewing the
 * legend never interrupts a session (Req 3.6). The component holds no session
 * state; the parent decides when it is rendered.
 */
export function StartMenu({
  onStartSeance,
  onReviewLegend,
  onReviewCangjieGuide,
  onOpenGraveyard,
  onOpenCredits,
  level,
  onChooseLevel,
  finishedNotice,
  restlessCount = 0,
  onReviewRestless,
  reviewError = false,
}: StartMenuProps) {
  return (
    <main className="flex flex-col items-center justify-center px-4 py-4 text-ink">
      <div className="moon-glow mb-4 flex sm:mb-6 flex-col items-center">
        <GhostFigure className="menu-figure mb-2 h-14 w-12 text-ghost sm:h-20 sm:w-16" />
        <h1 className="text-center font-display text-5xl font-semibold tracking-wide sm:text-7xl">
          Ghost Script
        </h1>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <button
          type="button"
          onClick={onStartSeance}
          className={`slip-primary min-h-[44px] px-6 py-2 text-base font-medium ${focusRing}`}
        >
          Begin a Nightly Séance
        </button>
        <button
          type="button"
          onClick={onChooseLevel}
          className={`slip min-h-[44px] px-6 py-2 text-base ${focusRing}`}
        >
          Starting level: {level}
        </button>
        {restlessCount >= 1 && onReviewRestless && (
          <button
            type="button"
            onClick={onReviewRestless}
            className={`slip min-h-[44px] px-6 py-2 text-base ${focusRing}`}
          >
            Review restless ghosts ({restlessCount})
          </button>
        )}
        {reviewError && (
          <p role="alert" className="text-center text-sm text-ink">
            The review could not start. Check your connection and try again.
          </p>
        )}
        {finishedNotice && (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm text-ghost">{finishedNotice.text}</p>
            {finishedNotice.moveOn && (
              <button
                type="button"
                onClick={finishedNotice.moveOn.onClick}
                className={`slip min-h-[44px] px-6 py-2 text-base ${focusRing}`}
              >
                {finishedNotice.moveOn.label}
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onReviewLegend}
          className={`slip min-h-[44px] px-6 py-2 text-base ${focusRing}`}
        >
          Read the legend again
        </button>
        <button
          type="button"
          onClick={onReviewCangjieGuide}
          className={`slip min-h-[44px] px-6 py-2 text-base ${focusRing}`}
        >
          How Cangjie works
        </button>
        <button
          type="button"
          onClick={onOpenGraveyard}
          className={`slip min-h-[44px] px-6 py-2 text-base ${focusRing}`}
        >
          Graveyard
        </button>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpenCredits}
            aria-describedby="menu-sources-hint"
            className={`slip min-h-[44px] px-6 py-2 text-base ${focusRing}`}
          >
            Sources &amp; licences
          </button>
          <p id="menu-sources-hint" className="text-center text-sm text-muted">
            Where the words, strokes, codes and fonts come from.
          </p>
        </div>
      </div>
    </main>
  );
}
