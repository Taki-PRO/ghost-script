import { useMemo } from 'react';
import type { CharacterDataset } from '../data/charDataLoader';
import { buildGraveyard } from '../engine/graveyard';
import type { Grave, GraveState } from '../engine/graveyard';
import { learningOrder } from '../engine/learningOrder';
import type { ReviewHistory } from '../engine/scheduler';

export interface GraveyardProps {
  dataset: CharacterDataset;
  history: ReviewHistory;
  now: number;
  onBack: () => void;
}

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const MARKER: Record<GraveState, string> = { unmet: '·', restless: '!', 'at-rest': '✓' };
const SHAPE: Record<GraveState, string> = {
  unmet: 'grave-wisp',
  restless: 'grave-restless',
  'at-rest': 'grave-rest',
};
const LEGEND: readonly { state: GraveState; label: string }[] = [
  { state: 'unmet', label: 'Never met' },
  { state: 'restless', label: 'Restless' },
  { state: 'at-rest', label: 'At rest' },
];

function graveLabel(grave: Grave, total: number): string {
  if (grave.state === 'unmet') return `Ghost ${grave.position} of ${total}, never met`;
  if (grave.state === 'restless') {
    const base = `${grave.char}, restless, due again`;
    return grave.streak > 0 ? `${base}, ${grave.streak} clean in a row` : base;
  }
  return `${grave.char}, at rest, ${grave.streak} clean in a row`;
}

/**
 * Graveyard screen (Req 7). Read-only: history and clock come from the caller.
 * An unmet grave carries no character, so none can be rendered for it.
 */
export function Graveyard({ dataset, history, now, onBack }: GraveyardProps) {
  const model = useMemo(
    () => buildGraveyard(learningOrder(dataset), history, now),
    [dataset, history, now],
  );
  const total = model.graves.length;
  const noneMet = model.counts.unmet === total;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="font-display text-3xl font-semibold">Graveyard</h1>
        <p className="text-base text-ink">
          Every ghost in the game, in the order you will meet them. A ghost you have not met stays
          hidden.
        </p>
        <ul aria-label="Legend" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
          {LEGEND.map(({ state, label }) => (
            <li key={state} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`grave ${SHAPE[state]} inline-flex h-8 w-8 items-center justify-center`}
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
        <ul
          aria-label="Graves"
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' }}
        >
          {model.graves.map((grave) => (
            <li
              key={grave.position}
              aria-label={graveLabel(grave, total)}
              className={`grave ${SHAPE[grave.state]} flex min-h-[56px] flex-col items-center justify-center text-ink`}
            >
              {grave.state !== 'unmet' && (
                <span lang="zh" className="text-xl leading-none">
                  {grave.char}
                </span>
              )}
              <span aria-hidden="true" className="text-xs leading-none">
                {MARKER[grave.state]}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onBack}
          className={`min-h-[44px] self-start rounded-md border border-muted bg-surface px-6 py-3 text-base text-ink ${focusRing}`}
        >
          Back to menu
        </button>
      </div>
    </main>
  );
}
