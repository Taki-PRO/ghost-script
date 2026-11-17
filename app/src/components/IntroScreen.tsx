import { GhostFigure } from './GhostFigure';
export interface IntroScreenProps {
  onBegin: () => void;
  /** Opens the Sources & licences screen; never marks the intro as seen. */
  onOpenSources: () => void;
}

/**
 * Legend intro. Copy states only the premise and the Huainanzi attribution
 * required by Requirement 1.8; no other historical claims.
 */
export function IntroScreen({ onBegin, onOpenSources }: IntroScreenProps) {
  return (
    <main
      aria-labelledby="intro-title"
      className="flex items-center justify-center text-ink"
    >
      <div className="w-full max-w-xl text-center">
        <div className="moon-glow flex flex-col items-center">
          <GhostFigure className="menu-figure mb-1 h-12 w-10 sm:h-24 sm:w-20 text-ghost" />
        </div>
        <h1
          id="intro-title"
          className="mt-1 font-display text-4xl font-semibold leading-[1.1] tracking-wide text-ink sm:text-5xl"
        >
          Ghost Script
        </h1>

        <p className="mt-2 text-base leading-snug text-ink sm:mt-6 sm:text-lg">
          In Chinese legend, Cangjie invented writing. The legend says that when he did, ghosts
          wept in the night.
        </p>
        <p className="mt-2 text-base leading-snug text-ink sm:mt-4 sm:text-lg">
          In this game, characters you have forgotten how to write are ghosts. Type a ghost's shapes to
          summon it, then write it from memory.
        </p>

        <figure className="card-slip mt-3 px-4 py-2.5 sm:mt-8 sm:py-5">
          <blockquote className="ink-reveal">
            <p lang="zh" className="text-3xl sm:text-4xl">
              天雨粟，鬼夜哭
            </p>
            <p className="mt-2 text-base">&ldquo;Heaven rained grain and ghosts wept at night.&rdquo;</p>
          </blockquote>
          <figcaption className="mt-2 text-sm">
            The Huainanzi records this line about the time Cangjie created writing.
          </figcaption>
        </figure>

        <button
          type="button"
          onClick={onBegin}
          className="slip-primary mt-4 min-h-[44px] px-8 py-2 text-lg sm:mt-10 sm:py-3 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Begin the Séance
        </button>
        <div>
          <button
            type="button"
            onClick={onOpenSources}
            className="inline-flex min-h-[44px] items-center text-sm text-ghost underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sources
          </button>
        </div>
      </div>
    </main>
  );
}

export default IntroScreen;
