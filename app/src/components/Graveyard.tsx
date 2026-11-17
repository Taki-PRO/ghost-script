import { useMemo } from 'react';
import type { CharacterDataset } from '../data/charDataLoader';
import { buildGraveyard } from '../engine/graveyard';
import type { Grave, GraveState } from '../engine/graveyard';
import { learningOrder } from '../engine/learningOrder';
import type { ReviewHistory } from '../engine/scheduler';
import { tabletTiltIndex } from '../engine/tabletTilt';

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
        <p className="text-base text-ink">
          Every ghost in the game, in the order you will meet them. A ghost you have not met stays
          hidden.
        </p>
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
        <div className="relative isolate overflow-hidden rounded-md">
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            data-testid="hillside"
          >
            <path d="M0 62 C20 48 38 58 56 46 C74 36 88 50 100 42 L100 100 L0 100 Z" fill="#161a24" />
            <path d="M0 80 C18 70 34 78 52 70 C72 62 86 74 100 68 L100 100 L0 100 Z" fill="#0f1118" />
          </svg>
          <ul
            aria-label="Graves"
            className="relative grid gap-2 p-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' }}
          >
            {model.graves.map((grave) => (
              <li
                key={grave.position}
                aria-label={graveLabel(grave, total)}
                className={`${SHAPE[grave.state]} ${OUTLINE[grave.state]} tablet-tilt-${tabletTiltIndex(grave.position)} relative flex min-h-[56px] flex-col items-center justify-center text-ink`}
              >
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
      </div>
    </main>
  );
}
