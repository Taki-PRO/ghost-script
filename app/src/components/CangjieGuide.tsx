import type { CharacterDataset } from '../data/charDataLoader';
import { CANGJIE_KEYS } from '../engine/cangjie';
import { isPlayableInCangjie } from '../engine/cangjieRules';
import { learningOrder } from '../engine/learningOrder';

export interface CangjieGuideProps {
  dataset: CharacterDataset;
  onContinue: () => void;
}

/**
 * LAST character in learningOrder(dataset) that is Playable and has a code of
 * 2 or 3 keys; null when none. Late in the order, so a new player has not met it
 * yet (Answer_Leak). The code is read from the record, never written by hand.
 */
export function pickGuideExample(
  dataset: CharacterDataset,
): { character: string; code: string } | null {
  const order = learningOrder(dataset);
  for (let i = order.length - 1; i >= 0; i--) {
    const character = order[i];
    const code = dataset.get(character)?.cangjie ?? null;
    if (code !== null && isPlayableInCangjie(code) && (code.length === 2 || code.length === 3)) {
      return { character, code };
    }
  }
  return null;
}

const CITATIONS: readonly { title: string; url: string }[] = [
  { title: 'Cangjie input method', url: 'https://en.wikipedia.org/wiki/Cangjie_input_method' },
  { title: 'Chu Bong-Foo', url: 'https://en.wikipedia.org/wiki/Chu_Bong-Foo' },
];

/**
 * "How Cangjie works" screen (Requirement 6). History claims are limited to the
 * four in content-accuracy.md; no statistics and no other historical claims.
 */
export function CangjieGuide({ dataset, onContinue }: CangjieGuideProps) {
  const example = pickGuideExample(dataset);
  const shapeOf = (key: string): string =>
    CANGJIE_KEYS.find((k) => k.key === key)?.shape ?? '';

  return (
    <main
      aria-labelledby="guide-title"
      className="min-h-screen bg-background text-ink flex items-center justify-center px-6 py-10"
    >
      <div className="w-full max-w-xl">
        <h1 id="guide-title" className="text-3xl font-semibold tracking-wide text-ink">
          How Cangjie works
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-ink">
          Each ghost is summoned by typing its Cangjie code. A code is one to five keys, typed in
          order.
        </p>
        <p className="mt-3 text-lg leading-relaxed text-ink">
          Each key stands for a family of related shapes. Only the base shape of the family is
          shown on the key.
        </p>

        <ul
          aria-label="The 25 Cangjie keys"
          className="mt-6 grid grid-cols-5 gap-2 sm:grid-cols-5"
        >
          {CANGJIE_KEYS.map(({ key, shape }) => (
            <li
              key={key}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-surface px-2 py-2"
            >
              <span className="font-mono text-base text-muted">{key}</span>
              <span lang="zh" className="text-xl text-ghost">
                {shape}
              </span>
            </li>
          ))}
        </ul>

        {example && (
          <p className="mt-6 text-lg leading-relaxed text-ink" data-testid="guide-example">
            Example: the code for <span lang="zh">{example.character}</span> is{' '}
            <span className="font-mono">{example.code}</span>, typed as{' '}
            {Array.from(example.code).map((k, i) => (
              <span key={i}>
                {i > 0 ? ', ' : ''}
                <span className="font-mono">{k}</span> (<span lang="zh">{shapeOf(k)}</span>)
              </span>
            ))}
            .
          </p>
        )}

        <section aria-labelledby="guide-history" className="mt-8">
          <h2 id="guide-history" className="text-xl font-semibold text-ink">
            Where it comes from
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink">
            <li>Cangjie was developed in the 1970s by Chu Bong-Foo.</li>
            <li>It is named after Cangjie, the legendary inventor of Chinese writing.</li>
            <li>It was the first Chinese input method to use the standard QWERTY keyboard.</li>
            <li>It was released to the public in 1982.</li>
          </ul>
          <p className="mt-3 text-sm text-muted">
            Sources for the statements about keys, shapes and history above (English Wikipedia):{' '}
            {CITATIONS.map((c, i) => (
              <span key={c.url}>
                {i > 0 ? '; ' : ''}
                &ldquo;{c.title}&rdquo; {c.url}
              </span>
            ))}
          </p>
        </section>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          The codes in this game follow the Unicode Unihan kCangjie field. Unihan marks that field
          provisional, so some typists know different codes for some characters.
        </p>

        <button
          type="button"
          onClick={onContinue}
          aria-label="Continue"
          className="mt-10 min-h-[44px] rounded-lg border border-ghost bg-surface px-8 py-3 text-lg font-medium text-ink hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Continue
        </button>
      </div>
    </main>
  );
}
export default CangjieGuide;
