/**
 * Results of a finished Séance.
 *
 * `laidToRest` counts ghosts whose outcome was `clean` or `struggled` (both
 * are laid to rest visually). `gave-up` ghosts are NOT counted.
 */
export interface SessionResults {
  readonly total: number;
  readonly laidToRest: number;
}

export interface SessionSummaryProps {
  results: SessionResults;
  onPlayAgain: () => void;
}

/**
 * Defensive normalisation for display only: non-finite values become 0,
 * values are floored to integers and clamped to >= 0, and laidToRest is
 * clamped to <= total. Never throws.
 */
function normalise(results: SessionResults): { total: number; laidToRest: number } {
  const toCount = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
  const total = toCount(results.total);
  const laidToRest = Math.min(toCount(results.laidToRest), total);
  return { total, laidToRest };
}

export function SessionSummary({ results, onPlayAgain }: SessionSummaryProps) {
  const { total, laidToRest } = normalise(results);
  const countText =
    total === 0
      ? 'No ghosts appeared this time'
      : `${laidToRest} of ${total} ${total === 1 ? 'ghost' : 'ghosts'} laid to rest`;

  return (
    <main
      aria-labelledby="summary-title"
      className="min-h-screen bg-background text-ink flex items-center justify-center px-6 py-10"
    >
      <div className="w-full max-w-xl text-center">
        <h1 id="summary-title" className="text-3xl font-semibold tracking-wide text-ink">
          The séance is over
        </h1>

        <p role="status" className="mt-6 rounded-lg bg-surface px-5 py-4 text-xl text-ink">
          {countText}
        </p>

        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-10 min-h-[44px] rounded-lg border border-ghost bg-surface px-8 py-3 text-lg font-medium text-ink hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Begin another Séance
        </button>
      </div>
    </main>
  );
}

export default SessionSummary;
