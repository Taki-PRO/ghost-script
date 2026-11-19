import { reviewCountLine } from '../engine/review';
import { formatReturn, type ReturnRow } from '../engine/formatReturn';
import type { Outcome } from '../engine/scheduler';
import { GhostFigure } from './GhostFigure';
import { SealStamp } from './SealStamp';

/** Outcome in words: visible label and the lower-case form used in the accessible name. */
const OUTCOME_WORDS: Record<Outcome, { label: string; spoken: string }> = {
  clean: { label: 'Laid to rest', spoken: 'laid to rest' },
  struggled: { label: 'Struggled', spoken: 'struggled' },
  'gave-up': { label: 'Gave up', spoken: 'gave up' },
};

/** Outcome words of a Review_Run: nothing is "laid to rest" there (Req 10.21). */
const REVIEW_OUTCOME_WORDS: Record<Outcome, { label: string; spoken: string }> = {
  ...OUTCOME_WORDS,
  clean: { label: 'Remembered', spoken: 'remembered' },
};

/** Accessible name of a Ghost_Tile: the meaning appears only here. */
function tileName(
  row: ReturnRow,
  finishedAt: number,
  words: Record<Outcome, { label: string; spoken: string }>,
): string {
  return [
    row.character,
    row.pinyin,
    row.meaning,
    words[row.outcome].spoken,
    formatReturn(row.nextDue, finishedAt),
  ].join(', ');
}

/**
 * Results of a finished Séance.
 *
 * `laidToRest` counts ghosts whose outcome was `clean` or `struggled` (both
 * are laid to rest visually). `gave-up` ghosts are NOT counted. In a review
 * (`mode: 'review'`) it counts the `clean` ghosts only (the remembered ones).
 */
export interface SessionResults {
  readonly total: number;
  readonly laidToRest: number;
  /** One row per ghost with a recorded entry; optional so callers without it keep working. */
  readonly returns?: readonly ReturnRow[];
  /** Time the Séance finished (ms); needed together with `returns`. */
  readonly finishedAt?: number;
  /** Kind of séance that ended; absent means 'nightly'. */
  readonly mode?: 'nightly' | 'review';
}

export interface SessionSummaryProps {
  results: SessionResults;
  onPlayAgain: () => void;
  /** Review summary only: returns to the Start menu. */
  onBackToMenu?: () => void;
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

export function SessionSummary({ results, onPlayAgain, onBackToMenu }: SessionSummaryProps) {
  const { total, laidToRest } = normalise(results);
  const rows = results.returns ?? [];
  const finishedAt =
    typeof results.finishedAt === 'number' && Number.isFinite(results.finishedAt) ? results.finishedAt : null;
  const isReview = results.mode === 'review';
  const words = isReview ? REVIEW_OUTCOME_WORDS : OUTCOME_WORDS;
  const countText =
    total === 0
      ? 'No ghosts appeared this time'
      : isReview
        ? reviewCountLine(laidToRest, total)
        : `${laidToRest} of ${total} ${total === 1 ? 'ghost' : 'ghosts'} laid to rest`;

  return (
    <main aria-labelledby="summary-title" className="text-ink flex items-center justify-center px-2 py-2">
      <div className="w-full max-w-3xl text-center">
        <h1
          id="summary-title"
          className="font-display text-3xl font-semibold tracking-wide text-ink sm:text-5xl"
        >
          {isReview ? 'The review is over' : 'The séance is over'}
        </h1>

        <p role="status" className="card-slip mt-2 px-5 py-2 text-lg">
          {countText}
        </p>

        {rows.length > 0 && finishedAt !== null && (
          <section className="mt-3 text-left">
            <h2 className="text-base font-semibold text-ink">Ghosts that will return</h2>
            <ul
              aria-label="Ghosts that will return"
              className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2"
            >
              {rows.map((row) => (
                <li
                  key={row.character}
                  aria-label={tileName(row, finishedAt, words)}
                  className="card-slip flex min-w-0 flex-col items-center px-1 py-1 text-center"
                >
                  <span className="relative flex h-14 w-full items-center justify-center sm:h-[72px]">
                    {row.outcome === 'clean' ? (
                      <SealStamp character={row.character} placement="flow" size={40} />
                    ) : (
                      <>
                        <GhostFigure className="absolute inset-0 m-auto h-12 w-10 text-ghost opacity-30" />
                        <span lang="zh" className="relative text-3xl">
                          {row.character}
                        </span>
                      </>
                    )}
                  </span>
                  <span lang="zh-Latn-pinyin" className="text-xs sm:text-sm">
                    {row.pinyin}
                  </span>
                  <span className="text-xs font-medium">{words[row.outcome].label}</span>
                  <span className="min-w-0 break-words text-xs">{formatReturn(row.nextDue, finishedAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button
          type="button"
          onClick={isReview ? onBackToMenu : onPlayAgain}
          className="slip-primary mt-3 min-h-[44px] px-8 py-2 text-lg font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isReview ? 'Back to menu' : 'Begin another Séance'}
        </button>
      </div>
    </main>
  );
}

export default SessionSummary;
