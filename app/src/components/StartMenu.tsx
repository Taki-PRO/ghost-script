export interface StartMenuProps {
  onStartSeance: () => void;
  onReviewLegend: () => void;
}

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Start menu. Shown only OUTSIDE an active Séance (Req 1.5), so re-viewing the
 * legend never interrupts a session (Req 3.6). The component holds no session
 * state; the parent decides when it is rendered.
 */
export function StartMenu({ onStartSeance, onReviewLegend }: StartMenuProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-ink">
      <h1 className="mb-8 text-center text-3xl font-semibold sm:text-4xl">Ghost Script</h1>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <button
          type="button"
          onClick={onStartSeance}
          className={`min-h-[44px] rounded-md bg-ghost px-6 py-3 text-base font-medium text-background ${focusRing}`}
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
      </div>
    </main>
  );
}
