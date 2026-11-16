import { GhostFigure } from './GhostFigure';

export interface StartMenuProps {
  onStartSeance: () => void;
  onReviewLegend: () => void;
  onReviewCangjieGuide: () => void;
  onOpenGraveyard: () => void;
  onOpenCredits: () => void;
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
}: StartMenuProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 text-ink">
      <div className="moon-glow mb-8 flex flex-col items-center">
        <GhostFigure className="menu-figure mb-4 h-24 w-20 text-ghost" />
        <h1 className="text-center font-display text-5xl font-semibold tracking-wide sm:text-7xl">
          Ghost Script
        </h1>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <button
          type="button"
          onClick={onStartSeance}
          className={`min-h-[44px] rounded-md bg-candle px-6 py-3 text-base font-medium text-background shadow-candle hover:brightness-110 ${focusRing}`}
        >
          Begin a Nightly Séance
        </button>
        <button
          type="button"
          onClick={onReviewLegend}
          className={`min-h-[44px] rounded-md border border-muted bg-surface px-6 py-3 text-base text-ink ${focusRing}`}
        >
          Read the legend again
        </button>
        <button
          type="button"
          onClick={onReviewCangjieGuide}
          className={`min-h-[44px] rounded-md border border-muted bg-surface px-6 py-3 text-base text-ink ${focusRing}`}
        >
          How Cangjie works
        </button>
        <button
          type="button"
          onClick={onOpenGraveyard}
          className={`min-h-[44px] rounded-md border border-muted bg-surface px-6 py-3 text-base text-ink ${focusRing}`}
        >
          Graveyard
        </button>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpenCredits}
            aria-describedby="menu-sources-hint"
            className={`min-h-[44px] rounded-md border border-muted bg-surface px-6 py-3 text-base text-ink ${focusRing}`}
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
