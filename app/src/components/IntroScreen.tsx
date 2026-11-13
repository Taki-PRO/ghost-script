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
      className="min-h-screen bg-background text-ink flex items-center justify-center px-6 py-10"
    >
      <div className="w-full max-w-xl text-center">
        <h1 id="intro-title" className="text-4xl font-semibold tracking-wide text-ink">
          Ghost Script
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-ink">
          In Chinese legend, Cangjie invented writing. The legend says that when he did, ghosts
          wept in the night.
        </p>
        <p className="mt-4 text-lg leading-relaxed text-ink">
          In this game, characters you have forgotten how to write are ghosts. You lay each one to
          rest by writing it.
        </p>

        <figure className="mt-8 rounded-lg bg-surface px-5 py-4">
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
          className="mt-10 min-h-[44px] rounded-lg border border-ghost bg-surface px-8 py-3 text-lg font-medium text-ink hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Begin the Séance
        </button>
      </div>
    </main>
  );
}

export default IntroScreen;
