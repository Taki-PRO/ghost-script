import { formatReturn, type ReturnRow } from '../engine/formatReturn';

/**
 * Results of a finished Séance.
 *
 * `laidToRest` counts ghosts whose outcome was `clean` or `struggled` (both
 * are laid to rest visually). `gave-up` ghosts are NOT counted.
 */
export interface SessionResults {
  readonly total: number;
  readonly laidToRest: number;
  /** One row per ghost with a recorded entry; optional so callers without it keep working. */
  readonly returns?: readonly ReturnRow[];
  /** Time the Séance finished (ms); needed together with `returns`. */
  readonly finishedAt?: number;
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
  const rows = results.returns ?? [];
  const finishedAt = results.finishedAt;
  const showReturns = rows.length > 0 && typeof finishedAt === 'number' && Number.isFinite(finishedAt);
  const countText =
    total === 0
      ? 'No ghosts appeared this time'
      : `${laidToRest} of ${total} ${total === 1 ? 'ghost' : 'ghosts'} laid to rest`;

  return (
    <main
      aria-labelledby="summary-title"
      className="min-h-screen text-ink flex items-center justify-center px-6 py-10"
    >
      <div className="w-full max-w-xl text-center">
        <h1 id="summary-title" className="text-3xl font-semibold tracking-wide text-ink">
          The séance is over
        </h1>

        <p role="status" className="mt-6 rounded-lg bg-surface px-5 py-4 text-xl text-ink">
          {countText}
        </p>

        {showReturns && (
          <section className="mt-8 text-left">
            <h2 className="text-lg font-semibold text-ink">Ghosts that will return</h2>
            <ul aria-label="Ghosts that will return" className="mt-3 space-y-2">
              {rows.map((row) => (
                <li
                  key={row.character}
                  className="flex min-w-0 items-baseline gap-3 rounded-lg bg-surface px-4 py-3 text-ink"
                >
                  <span lang="zh" className="shrink-0 text-2xl">
                    {row.character}
                  </span>
                  <span className="min-w-0 break-words">
                    <span lang="zh-Latn-pinyin">{row.pinyin}</span>
                    {', '}
                    <span>{row.meaning}</span>
                    {': '}
                    <span>{formatReturn(row.nextDue, finishedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
