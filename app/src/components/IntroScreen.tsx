import { GhostFigure } from './GhostFigure';
import { CANGJIE_CITATIONS, LEGEND_SOURCE } from '../data/citations';

/** Lets long unbreakable text (URLs) wrap at 375 px, as in Credits.tsx. */
const WRAP = '[overflow-wrap:anywhere]';

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
        <p className={`mt-2 text-sm text-ghost ${WRAP}`} data-testid="intro-citations">
          Source: English Wikipedia,{' '}
          {CANGJIE_CITATIONS.map((c, i) => (
            <span key={c.url}>
              {i > 0 ? '; ' : ''}&ldquo;{c.title}&rdquo; ({c.url})
            </span>
          ))}
          .
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          In this game, characters you have forgotten how to write are ghosts. Type a ghost's shapes to
          summon it, then write it from memory.
        </p>

        <figure className="card-slip mt-8 px-5 py-5">
          <blockquote className="ink-reveal">
            <p lang="zh" className="text-3xl sm:text-4xl">
              天雨粟，鬼夜哭
            </p>
            <p className="mt-2 text-base">&ldquo;Heaven rained grain and ghosts wept at night.&rdquo;</p>
          </blockquote>
          <figcaption className="mt-2 text-sm">
            The Huainanzi records this line about the time Cangjie created writing.{' '}
            <span className={`block mt-1 text-xs ${WRAP}`} data-testid="legend-citation">
              {LEGEND_SOURCE.citation}
            </span>
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
