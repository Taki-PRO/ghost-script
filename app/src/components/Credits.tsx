import { CODE_LICENCE, COMBINED_WORK_NOTE, DATA_SOURCES, FONTS } from '../data/credits';
import { CANGJIE_CITATIONS, LEGEND_SOURCE } from '../data/citations';
import { SOFTWARE_CREDITS } from '../data/software';

export interface CreditsProps {
  onBack: () => void;
  /** Where Back leads; sets the button label. */
  backTo: 'menu' | 'intro';
}

const H2 = 'text-xl font-semibold text-ink font-display';
const TH = 'px-3 py-2 text-left text-sm font-semibold text-ink';
const WRAP = '[overflow-wrap:anywhere]';
const TD = `px-3 py-2 align-top text-sm text-ink ${WRAP}`;
const DT = "text-xs font-semibold uppercase tracking-wide text-muted after:content-[':']";
const DD = `text-sm text-ink ${WRAP}`;

/** Credits screen (Requirement 9, 13.2, 16.11). URLs are text; the only link is the notices file. */
export function Credits({ onBack, backTo }: CreditsProps) {
  const backLabel = backTo === 'intro' ? 'Back to the intro' : 'Back to menu';
  const noticesHref = `${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`;

  return (
    <main
      aria-labelledby="credits-title"
      className="min-h-screen text-ink px-4 pb-10 pt-0 flex justify-center"
    >
      <div className="w-full max-w-3xl">
        <header className="sticky sticky-below-moon z-20 -mx-4 flex min-h-[64px] items-center justify-between gap-3 border-b border-muted/40 bg-night-top px-4 py-2">
          <h1
            id="credits-title"
            className="min-w-0 font-display text-2xl font-semibold tracking-wide text-ink sm:text-3xl"
          >
            Sources &amp; licences
          </h1>
          <button
            type="button"
            onClick={onBack}
            aria-label={backLabel}
            className="slip min-h-[44px] shrink-0 whitespace-nowrap px-4 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {backLabel}
          </button>
        </header>

        <section aria-labelledby="credits-sources" className="mt-8">
          <h2 id="credits-sources" className={H2}>
            Data sources
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table aria-labelledby="credits-sources" className="hidden w-full border-collapse sm:table">
              <thead>
                <tr className="border-b border-muted">
                  <th scope="col" className={TH}>Name</th>
                  <th scope="col" className={TH}>Version or commit</th>
                  <th scope="col" className={TH}>Use</th>
                  <th scope="col" className={TH}>Licence</th>
                  <th scope="col" className={TH}>URL</th>
                </tr>
              </thead>
              <tbody>
                {DATA_SOURCES.map((s) => (
                  <tr key={s.name} className="border-b border-muted/40">
                    <th scope="row" className={`${TD} text-left font-medium`}>{s.name}</th>
                    <td className={TD}>{s.version}</td>
                    <td className={TD}>{s.use}</td>
                    <td className={TD}>{s.licence}</td>
                    <td className={TD}>{s.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul aria-labelledby="credits-sources" className="mt-3 flex flex-col gap-3 sm:hidden">
            {DATA_SOURCES.map((s) => (
              <li key={s.name} className="rounded-md border border-muted/40 bg-surface p-3">
                <dl className="flex flex-col gap-2">
                  <div><dt className={DT}>Name</dt><dd className={`${DD} font-medium`}>{s.name}</dd></div>
                  <div><dt className={DT}>Version or commit</dt><dd className={DD}>{s.version}</dd></div>
                  <div><dt className={DT}>Use</dt><dd className={DD}>{s.use}</dd></div>
                  <div><dt className={DT}>Licence</dt><dd className={DD}>{s.licence}</dd></div>
                  <div><dt className={DT}>URL</dt><dd className={DD}>{s.url}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="credits-licensing" className="mt-8">
          <h2 id="credits-licensing" className={H2}>
            Licensing
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink">{COMBINED_WORK_NOTE}</p>
          <p className="mt-3 text-base leading-relaxed text-ink">
            The code of Ghost Script is licensed {CODE_LICENCE}.
          </p>
        </section>

        <section aria-labelledby="credits-legend" className="mt-8">
          <h2 id="credits-legend" className={H2}>
            The legend
          </h2>
          <p lang="zh" className="mt-3 text-2xl text-ink">
            {LEGEND_SOURCE.zh}
          </p>
          <p className="mt-2 text-base text-ink">{LEGEND_SOURCE.english}</p>
          <p className={`mt-2 text-sm text-muted ${WRAP}`}>
            The English rendering is our own. Source: {LEGEND_SOURCE.citation}
          </p>
        </section>

        <section aria-labelledby="credits-cangjie" className="mt-8">
          <h2 id="credits-cangjie" className={H2}>
            Cangjie
          </h2>
          <p className="mt-3 text-base text-ink">Sources (English Wikipedia):</p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-ink">
            {CANGJIE_CITATIONS.map((c) => (
              <li key={c.url} className={WRAP}>
                &ldquo;{c.title}&rdquo; {c.url}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="credits-fonts" className="mt-8">
          <h2 id="credits-fonts" className={H2}>
            Fonts
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-base text-ink">
            {FONTS.map((f) => (
              <li key={f.name} className={WRAP}>
                {f.name}
                {f.url ? ` ${f.version}` : ''}, {f.licence}. {f.copyright}
                {f.copyright.endsWith('.') ? '' : '.'}
                {f.url ? ` Source: ${f.url}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-base text-ink">
            Chinese characters are drawn with LXGW WenKai (subset to the characters in this game). Any other Chinese text uses fonts already installed on the device.
          </p>
        </section>

        <section aria-labelledby="credits-software" className="mt-8">
          <h2 id="credits-software" className={H2}>
            Software
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table aria-labelledby="credits-software" className="hidden w-full border-collapse sm:table">
              <thead>
                <tr className="border-b border-muted">
                  <th scope="col" className={TH}>Name</th>
                  <th scope="col" className={TH}>Version</th>
                  <th scope="col" className={TH}>Licence</th>
                </tr>
              </thead>
              <tbody>
                {SOFTWARE_CREDITS.map((p) => (
                  <tr key={p.name} className="border-b border-muted/40">
                    <th scope="row" className={`${TD} text-left font-medium`}>{p.name}</th>
                    <td className={TD}>{p.version}</td>
                    <td className={TD}>{p.licence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul aria-labelledby="credits-software" className="mt-3 flex flex-col gap-3 sm:hidden">
            {SOFTWARE_CREDITS.map((p) => (
              <li key={p.name} className="rounded-md border border-muted/40 bg-surface p-3">
                <dl className="flex flex-col gap-2">
                  <div><dt className={DT}>Name</dt><dd className={`${DD} font-medium`}>{p.name}</dd></div>
                  <div><dt className={DT}>Version</dt><dd className={DD}>{p.version}</dd></div>
                  <div><dt className={DT}>Licence</dt><dd className={DD}>{p.licence}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-base">
            <a
              href={noticesHref}
              className="text-ghost underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Full licence texts (THIRD_PARTY_NOTICES.txt)
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
export default Credits;
