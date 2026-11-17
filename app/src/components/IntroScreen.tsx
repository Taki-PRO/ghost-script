import { GhostFigure } from './GhostFigure';

export interface IntroScreenProps {
  onBegin: () => void;
}

/**
 * Legend intro. Copy states only the premise and the Huainanzi attribution
 * required by Requirement 1.8; no other historical claims.
 */
export function IntroScreen({ onBegin }: IntroScreenProps) {
  return (
    <main
      aria-labelledby="intro-title"
      className="flex min-h-screen items-center justify-center px-6 py-10 text-ink"
    >
      <div className="w-full max-w-xl text-center">
        <div className="moon-glow flex flex-col items-center">
          <GhostFigure className="menu-figure mb-4 h-24 w-20 text-ghost" />
        </div>
        <h1
          id="intro-title"
          className="mt-2 font-display text-5xl font-semibold tracking-wide text-ink"
        >
          Ghost Script
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-ink">
          In Chinese legend, Cangjie invented writing. The legend says that when he did, ghosts
          wept in the night.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          In this game, characters you have forgotten how to write are ghosts. Type a ghost's shapes to
          summon it, then write it from memory.
        </p>

        <figure className="ink-reveal mt-8 rounded-lg bg-surface px-5 py-4">
          <blockquote>
            <p lang="zh" className="text-2xl text-ghost">
              天雨粟，鬼夜哭
            </p>
            <p className="mt-2 text-muted">&ldquo;Heaven rained grain and ghosts wept at night.&rdquo;</p>
          </blockquote>
          <figcaption className="mt-2 text-sm text-muted">
            The Huainanzi records this line about the time Cangjie created writing.
          </figcaption>
        </figure>

        <button
          type="button"
          onClick={onBegin}
          className="slip-primary mt-10 min-h-[44px] px-8 py-3 text-lg font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Begin the Séance
        </button>
      </div>
    </main>
  );
}

export default IntroScreen;
