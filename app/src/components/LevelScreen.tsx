import type { Level, LevelInfo, LevelManifest } from '../data/types';

export interface LevelScreenProps {
  /** null: not loaded or failed. */
  manifest: LevelManifest | null;
  manifestFailed: boolean;
  /** null on first run. */
  currentLevel: Level | null;
  status:
    | { kind: 'idle' }
    | { kind: 'loading'; level: Level }
    | { kind: 'failed'; level: Level };
  onChoose: (level: Level) => void;
  /** Present when the screen is opened from the Start menu. */
  onBack?: () => void;
}

const LEVEL_ORDER: readonly Level[] = [1, 2, 3];

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** `"a"`, `"a" and "b"`, `"a", "b" and "c"`. */
function joinMeanings(meanings: readonly string[]): string {
  const quoted = meanings.map((m) => `"${m}"`);
  if (quoted.length <= 1) return quoted.join('');
  return `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
}

/** The description line of Requirement 6.3, built from one manifest entry. */
export function describeLevel(info: LevelInfo): string {
  const examples = joinMeanings(info.exampleMeanings);
  const base = `${info.count} characters, about ${Math.round(info.averageStrokes)} strokes each.`;
  return examples === '' ? base : `${base} For example: ${examples}.`;
}

/**
 * Level screen: three paper slips, no Primary_Action. Renders no Chinese
 * character; the example meanings come from the manifest and are English.
 */
export function LevelScreen({
  manifest,
  manifestFailed,
  currentLevel,
  status,
  onChoose,
  onBack,
}: LevelScreenProps) {
  const loading = status.kind === 'loading';
  const infoFor = (level: Level): LevelInfo | undefined =>
    manifest?.levels.find((l) => l.level === level);

  return (
    <main
      aria-labelledby="level-title"
      className="flex w-full flex-col items-center justify-center text-ink"
    >
      <div className="w-full max-w-3xl text-center">
        <h1
          id="level-title"
          className="font-display text-3xl font-semibold tracking-wide sm:text-5xl"
        >
          Where will you begin?
        </h1>
        <p className="mt-2 text-sm sm:text-base">Choose the level you want to write from.</p>
        <ul className="mt-4 flex flex-col gap-2">
          {LEVEL_ORDER.map((level) => {
            const info = infoFor(level);
            const current = currentLevel === level;
            return (
              <li key={level}>
                <button
                  type="button"
                  disabled={loading}
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onChoose(level)}
                  className={`slip block min-h-[44px] w-full px-4 py-2 text-left disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
                >
                  <span className="block text-base font-medium">Level {level}</span>
                  {current ? <span className="block text-sm">Current level</span> : null}
                  {info ? <span className="block text-sm">{describeLevel(info)}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`slip mt-3 min-h-[44px] px-6 py-2 text-base ${focusRing}`}
          >
            Back to menu
          </button>
        ) : null}
        <div className="mt-3 min-h-[1.5rem] text-sm">
          {loading ? <p role="status">Loading level {status.level}…</p> : null}
          {status.kind === 'failed' ? (
            <p role="alert">
              Level {status.level} could not be loaded. Check your connection and try again.
            </p>
          ) : null}
          {manifestFailed ? <p role="alert">The level descriptions could not be loaded.</p> : null}
        </div>
      </div>
    </main>
  );
}
