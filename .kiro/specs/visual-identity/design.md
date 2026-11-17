# Design Document: visual-identity

## Overview

This feature is visual only. It adds one pure engine module for the Graveyard, one tiny pure module for ghost states, a handful of presentational components, CSS in `index.css`, and a size check script. It changes no game rule (Requirement 14).

Amended after tester feedback (approved by the human): the section "Amendments from tester feedback (Requirements 18 to 23)" at the end of this document adds a Leave séance control, sticky headers, the "Sources & licences" name, a night scene and a menu entrance. Where it conflicts with an earlier section (the bottom "Back to menu" button, the name "Credits", the flat background, the five-button menu text), the amendment wins.

Amended again after a second browser check (approved by the human): the section "Amendment: the Rite fits one screen, scroll reset, 320 px and names (Requirements 25 to 31)" at the end adds one-screen sizes for the Summon and Write steps, a scroll reset, the 320 px fix, e2e height checks and the removal of a personal name from repo files. It wins over earlier sizes.

Property-based testing does not apply. The work is presentation, small mapping functions and copy, and the project decided on Nov 15 (`tech.md`) to add no new property tests. The Correctness Properties section is omitted on purpose (the format validator's warning about it is expected). Pure functions get unit tests with concrete cases; components get component tests.

### Kiro features used

| Part | Kiro feature | Why |
| --- | --- | --- |
| Whole feature | Specs | Requirements, design and tasks agreed before code (`structure.md`). |
| Never-reveal, licences, legend source, Cangjie citations | Steering (`content-accuracy.md`, `product.md`, `tech.md`) | Credits copy is copied from steering, not written from memory. |
| Cangjie codes in tests and tasks | MCP server `cangjie-oracle` (`lookup`, `decompose`) | Codes come from verified data, never from the model or by hand. |
| New copy review | Custom agent `accuracy-reviewer` (read-only) | Catches unsourced claims in Credits, Graveyard and README text. |
| Hooks | `data-check-on-save` (unchanged) | Not triggered: no watched input is edited. |

### Research summary

- **hanzi-writer 3.7.3** accepts `strokeColor`, `outlineColor`, `highlightColor`, `drawingColor`, `drawingWidth` and `radicalColor` at creation. It renders into an SVG inside the given container, with a transparent background, so a grid can sit behind the container.
- **Reduced motion.** Putting animations only inside `@media (prefers-reduced-motion: no-preference)` and giving the end state as ordinary static CSS means the reduced-motion user gets the end state with no JavaScript. The existing SummonStep fade keeps its JS check; it is not changed.
- **Fonts, measured.** `@fontsource/cormorant-garamond` 5.3.0 (licence OFL-1.1, copyright "The Cormorant Project Authors"): `cormorant-garamond-latin-600-normal.woff2` is 23,396 bytes (measured from the packed npm tarball). `woff2` is already Brotli-compressed, so gzip adds nothing.
- **Fonts, estimated (not measured).** `@fontsource/noto-serif-sc` 5.3.1 is 87 MB unpacked for 7 weights in 1,695 files, which is about 4 to 6 MB of `woff2` per weight for several thousand glyphs. That suggests roughly 0.3 to 0.5 kB per common glyph. The game uses 300 characters plus about 30 other glyphs, so one subset weight would be roughly 100 to 170 kB.

### Decisions

1. **Fonts.** A Latin display font (Cormorant Garamond, 600, Latin subset, 23.4 kB) for headings and the title. No CJK font file. Chinese text uses the Chinese_Font_Stack (system fonts). Reasons:
   - Size. Current JS is 66,304 B gzip and CSS 2,840 B gzip (measured from `app/dist`). Adding about 10 kB of new JS and CSS and the 23.4 kB font gives about 103 kB, well under 300,000 B. A CJK subset would add an estimated 100 to 170 kB and still leave the budget met, but with little room, for one weight only.
   - Effort. A reproducible CJK subset needs an OFL source font file, a subsetting tool (for example fonttools or `subset-font`) and a script with a pinned input. That is about half a day of the 1.5 days for a gain that we expect to be small, because we assume most phones and laptops already have a Chinese font. We have not verified this.
   - Risk. A device without a Chinese font would show fallback boxes instead of characters. We have not checked which devices these are. This is accepted (see Decisions, "Approved decisions").
2. **Practice grid and paper as components, not hanzi-writer internals.** An `InkSurface` wrapper draws Paper and the Practice_Grid and hosts the hanzi-writer container. Both modes use it, so the grid is identical in Summon and Write.
3. **Ghost state from the Outcome only.** `ghostStateFor(outcome)` has no access to the character, so no animation can depend on it (Requirement 4.7).
4. **Animations on the figure, not on the text.** The clue text stays at full opacity so it stays readable and keeps its contrast (Requirement 3.4).
5. **Graveyard unmet graves carry no character.** The model type for an unmet grave has no `char` field (Requirement 6.11).
6. **Bundle check as a script plus a pure function.** The function is unit tested; the script reads `app/dist`.
7. **Third-party notices are committed, not generated at build time.** `app/public/THIRD_PARTY_NOTICES.txt` is produced by `scripts/build-notices.ts` and committed. A unit test fails when the committed file differs from a fresh run. Reasons: the static host serves `app/public` as it is, the deploy workflow needs no extra step or dev tool, and the file is reviewable in the repository by judges. A build-time generation step would add `tsx` to the build path for no gain.

### Approved decisions

Each of these is approved by the human. None is open.

| # | Decision | Effect |
| --- | --- | --- |
| 1 | Chinese text uses the Chinese_Font_Stack: `"PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Serif CJK SC", sans-serif`. No other CJK stack. | Requirement 12.3; `hanzi` font family; `[lang='zh']` rule. |
| 2 | Cormorant Garamond, weight 600, Latin subset, `font-display: swap`. | Requirement 12.2; task 1.2. |
| 3 | Bibliographic names in citations and credits are allowed, as `.kiro/steering/structure.md` says. | The Huainanzi and Wikipedia citations may name authors and historical figures (for example Chu Bong-Foo, D. C. Lau, Michael Puett, Cangjie). Personal names stay out of repo files, except "approved by the human". |
| 4 | The Credits_Screen gains a "Software" section, and the Notices_File is committed and linked. | Requirement 16; tasks 3.2, 3.3, 6.2. |
| 5 | The proposed Ink_Palette and grave colours are accepted. Task 1.1 adjusts a hex only to reach 4.5:1. | Theme tokens table. |
| 6 | A human checks the phone layout at 375, 768 and 1440 px. Kiro does not run or log this check. | Task 10.1. |
| 7 | One flicker (1200 ms) on the `struggled` outcome, then the figure stays at opacity 0.5. | Requirement 4.2. |
| 8 | 300 kB means 300,000 bytes (gzip, `BUNDLE_BUDGET_BYTES`). | Requirement 12.6, `check-bundle-size.ts`. |

## Architecture

```mermaid
flowchart LR
    Menu[StartMenu] -->|onOpenGraveyard| App
    Menu -->|onOpenCredits| App
    App --> GY[Graveyard]
    App --> CR[Credits]
    GY --> EG[engine/graveyard.ts]
    EG --> SCH[engine/scheduler.ts nextDue, types]
    EG --> LO[engine/learningOrder.ts]
    App -->|loadState history, Date.now| GY
    CR --> CD[data/credits.ts]
    CR --> CI[data/citations.ts]
    CR --> SW[data/software.ts]
    CR -.->|link| NF[public/THIRD_PARTY_NOTICES.txt]
    NS[scripts/build-notices.ts] -->|writes| NF
    Guide[CangjieGuide] --> CI
    SS[SeanceSession] -->|outcome| GP[GhostPrompt]
    GP --> EV[engine/ghostVisual.ts]
    WM[WriteMode] --> IS[InkSurface]
    SU[SummonStep] --> IS
    IS --> PG[PracticeGrid]
    CSS[index.css: paper, keyframes, reduced-motion] -.-> IS
    CSS -.-> GP
    CSS -.-> GY
```

### Directory layout of new and changed files

```
app/src/
  engine/graveyard.ts            NEW  pure classification
  engine/ghostVisual.ts          NEW  Outcome -> GhostState
  data/citations.ts              NEW  Cangjie citations + legend source (shared)
  data/credits.ts                NEW  data sources, fonts, licences (matches README)
  data/software.ts               NEW  Software_List: runtime packages, versions, licences
  ../public/THIRD_PARTY_NOTICES.txt  NEW  generated, committed licence texts
  components/PracticeGrid.tsx    NEW
  components/InkSurface.tsx      NEW
  components/Graveyard.tsx       NEW
  components/Credits.tsx         NEW
  components/GhostPrompt.tsx     CHANGED  figure + state
  components/SeanceSession.tsx   CHANGED  passes the outcome to GhostPrompt
  components/CangjieGuide.tsx    CHANGED  wording, imports citations
  components/StartMenu.tsx       CHANGED  two buttons
  modes/WriteMode.tsx            CHANGED  InkSurface, Ink_Palette colours
  modes/SummonStep.tsx           CHANGED  layout
  styles/theme.ts, index.css     CHANGED  tokens, paper, keyframes
  App.tsx                        CHANGED  two views
  main.tsx                       CHANGED  font import
app/tailwind.config.ts           CHANGED  colours, font families
app/package.json                 CHANGED  one font dependency
scripts/check-bundle-size.ts     NEW
scripts/build-notices.ts         NEW  writes app/public/THIRD_PARTY_NOTICES.txt
package.json (root)              CHANGED  scripts check:bundle, build:notices
tsconfig.json (root)             CHANGED  include credits.ts, citations.ts, software.ts for the root tests
tests/unit/                      NEW  bundle-size test, credits-vs-README test, third-party-notices test
README.md, kiro-log.md           CHANGED
```

## Components and Interfaces

### `engine/graveyard.ts` (Requirement 6)

```ts
import type { ReviewEntry, ReviewHistory } from './scheduler';

export type GraveState = 'unmet' | 'restless' | 'at-rest';

/** A character never met. Deliberately has no `char`. */
export interface UnmetGrave { readonly state: 'unmet'; readonly position: number } // 1-based, Learning_Order
export interface MetGrave {
  readonly state: 'restless' | 'at-rest';
  readonly char: string;
  readonly position: number;
  readonly streak: number;
}
export type Grave = UnmetGrave | MetGrave;
export interface GraveyardModel {
  readonly graves: readonly Grave[];
  readonly counts: Readonly<Record<GraveState, number>>;
}

export function classifyEntry(entry: ReviewEntry | undefined, now: number): GraveState;
export function cleanStreak(entry: ReviewEntry): number;
export function buildGraveyard(order: readonly string[], history: ReviewHistory, now: number): GraveyardModel;
```

**State definitions** (the precise rule, from the existing saved data):

| State | Rule | Why |
| --- | --- | --- |
| `unmet` | no own property `char` in the Review_History (the scheduler's NEW) | Entries are written only when a ghost reaches an Outcome, so "no entry" means the ghost never finished a rite. |
| `restless` | entry exists and (`lastOutcome` is `struggled` or `gave-up`, **or** the next-due time is `<= now`) | A miss, or a clean ghost that is due again (the scheduler's DUE). A missed ghost is restless even before its 10-minute delay ends. |
| `at-rest` | entry exists, `lastOutcome` is `clean`, and next-due time is `> now` | Laid to rest cleanly and not yet due. |

- Next-due: `const d = nextDue(entry); const due = Number.isFinite(d) ? d : 0;` (`nextDue` from `scheduler.ts` already clamps negatives; the finite check mirrors `selectSession`).
- Own-property lookup: `Object.prototype.hasOwnProperty.call(history, ch)`, as `selectSession` and `App.priorEntry` do.
- `cleanStreak`: count the trailing `outcome === 'clean'` items of `entry.history`; with no `history` array, `lastOutcome === 'clean' ? 1 : 0`.
- `buildGraveyard` walks `order` (the caller passes `learningOrder(dataset)`), so entries for characters outside the dataset are ignored by construction. Duplicates in `order` are skipped (first wins).
- Scheduler code is only imported (`nextDue`, types). No scheduler file changes.

### `engine/ghostVisual.ts` (Requirement 4.7)

```ts
export type GhostState = 'haunting' | 'faded' | 'flickering' | 'drifted';
export function ghostStateFor(outcome: Outcome | null): GhostState;
// null -> haunting, clean -> faded, struggled -> flickering, gave-up -> drifted
```

### `components/PracticeGrid.tsx` (Requirement 1)

An inline SVG, `viewBox="0 0 100 100"`, `width/height 100%`, `aria-hidden="true"`, `pointer-events-none`, `absolute inset-0`. Five groups: `<rect>` border, vertical line, horizontal line, two diagonals. Dashed centre and diagonal lines (`stroke-dasharray`), colour `currentColor` from the Ink_Palette grid token at `opacity` 0.25 (at most 0.35). Takes no props, so it cannot depend on a character.

### `components/InkSurface.tsx` (Requirements 1, 2, 8.4, 8.5)

```tsx
interface InkSurfaceProps {
  size: string;               // CSS length, e.g. 'min(80vw, 420px)'
  containerRef: React.RefObject<HTMLDivElement>;
  role?: string; ariaLabel?: string;
  hidden?: boolean;           // visually empty but still reserves space (Summon typing phase)
  style?: React.CSSProperties; // opacity/transition for the fade
}
```

Renders `<div class="ink-paper relative" style={{width:size, aspectRatio:'1/1', touchAction:'none'}}>` containing `<PracticeGrid/>` and the hanzi-writer container (`relative`, transparent, same size). The Paper look is the `.ink-paper` class in `index.css`. The container never uses `display: none`, so the space is always reserved. During the typing phase the paper and grid show and the container stays empty.

### `modes/WriteMode.tsx` changes (Requirement 2)

Replace the surface `<div>` with `InkSurface`, size `min(80vw, 420px)` *(amended, Requirement 26.2: now the pixel value of `writeSurfaceSize`)*. Pass `strokeColor: theme.inkOnPaper`, `outlineColor: theme.gridLine`, `highlightColor: theme.seal`, `drawingColor: theme.drawing`, `drawingWidth: 5`. `showOutline` stays `false`. Nothing else changes: not the quiz options, callbacks, outcome logic, or messages.

### `modes/SummonStep.tsx` changes (Requirement 8)

- **Keyboard.** Each row becomes a CSS grid, not a wrapping flex row:
  ```tsx
  <div role="group" data-row={i} className="grid justify-center gap-[2px]"
       style={{ gridTemplateColumns: `repeat(${row.length}, var(--key-w))` }}>
  ```
  with `--key-w` defined once on the keyboard wrapper as `clamp(32px, calc((100vw - 2rem - 18px) / 10), 48px)`. *(Amended, Requirement 25.9: the variable moves to the CSS class `.summon-keys`, and below 370 px it is `calc((100vw - 2rem - 18px) / 10)`. As built in task 24.3: one `clamp(min(32px, calc((100vw - 2rem - 18px) / 10)), calc((100vw - 2rem - 18px) / 10), 48px)`, with no media query.)* At 375 px wide that is (375 - 32 - 18) / 10 = 32.5 px, so row 1 (10 keys, nine 2 px gaps) fits inside the Shell's `px-4` padding. Rows 2 and 3 use the same column width and are centred, which gives the staggered keyboard shape. Key buttons keep `min-h-[44px]`, `w-full`, `min-w-0`, and the same `aria-label`s. No `flex-wrap`.
- **Fixed surface.** `InkSurface` is rendered in every phase with size `min(60vw, 240px)`. *(Amended (approved by the human), Requirement 25: the size is now the pixel value of `summonPaperSize`, at most 160 px; see "Amendment: the Rite fits one screen".)* It replaces `hidden` on the container. `surfaceSize()` in the file stays and still feeds hanzi-writer.
- **Slots.** The code slot list uses `flex-nowrap`; 5 slots of 48 px plus gaps is 272 px, less than 343 px.
- **Status area.** *(Amended, Requirement 25.7: `min-h-[2.5rem]` with `text-sm`, still two lines.)* The `role="status"` paragraph gets `min-h-[3rem]` (two lines at the current text size), so a longer message does not push the keyboard.
- **Plain-text fallback.** The fallback character paragraph is moved inside the reserved surface (absolutely centred) instead of below it, so it does not change the height either.
- Behaviour, timers, hint rules, reducer calls and `aria-label`s are unchanged.

### `components/GhostPrompt.tsx` and `SeanceSession.tsx` (Requirements 3, 4, 5)

`GhostPrompt` gets an optional prop `outcome?: Outcome | null` (default `null`) and renders:

```tsx
<section aria-label="Ghost's clue" data-ghost-state={ghostStateFor(outcome)} className="ghost-card ...">
  <svg aria-hidden="true" className="ghost-figure" viewBox="0 0 64 80"> ...path and two eyes... </svg>
  ...existing meaning and pinyin, unchanged...
</section>
```

The silhouette path (ours): `M8 76 V32 C8 14 20 4 32 4 C44 4 56 14 56 32 V76 L48 68 L40 76 L32 68 L24 76 L16 68 Z`, two eye circles, no `<text>`. The CSS selects on `[data-ghost-state]` to animate `.ghost-figure`. `SeanceSession` passes its existing `result` state as `outcome`; nothing else in it changes. The existing masking of the target in the meaning text is unchanged.

### `styles/index.css` (Requirements 2, 3, 4, 7.9, 13.1)

- `:root` custom properties for the Ink_Palette (same hex values as `theme.ts`; a test checks they match).
- `.ink-paper`: layered `background` of a warm base colour, a soft radial vignette, and one inline SVG `feTurbulence` noise as a `data:` URI at low opacity. Authored here, so no image file.
- State end styles (static, always applied): `[data-ghost-state='faded'] .ghost-figure { opacity: 0 }`, `flickering` → `opacity: .5`, `drifted` → `opacity: 0; transform: translate(12px, -24px)`.
- Animations, all inside `@media (prefers-reduced-motion: no-preference)`: `ghost-float` (haunting, 4 s, translateY ±6 px alternate), `ghost-fade` (1.5 s, forwards), `ghost-flicker` (1.2 s, steps, ends at .5), `ghost-drift` (2 s, forwards), `grave-flicker` (restless graves, 2.5 s infinite, opacity .75 to 1).
- `.grave` shapes: `.grave-wisp` (dashed outline, rounded), `.grave-restless` (double border, wavy top via `border-radius` and `clip-path`), `.grave-rest` (solid, rounded top).

### `components/Graveyard.tsx` (Requirement 7)

```tsx
interface GraveyardProps {
  dataset: CharacterDataset;
  history: ReviewHistory;
  now: number;
  onBack: () => void;
}
```

`useMemo(() => buildGraveyard(learningOrder(dataset), history, now), [...])`. Renders:

- `<h1>Graveyard</h1>`, one intro line, the legend with counts (`Never met: n`, `Restless: n`, `At rest: n`) in text.
- A `<ul>` using `grid-template-columns: repeat(auto-fill, minmax(48px, 1fr))` with `gap-2`. Each `<li class="grave grave-…">`:
  - unmet: no glyph, marker `·`, `aria-label="Ghost 17 of 300, never met"` (uses `position`, not a character);
  - restless: glyph with `lang="zh"`, marker `!`, `aria-label="<glyph>, restless, due again"`, plus the streak when more than 0;
  - at rest: glyph, marker `✓`, `aria-label="<glyph>, at rest, 3 clean in a row"`.
- When all graves are unmet: `<p>No ghost has been met yet. Begin a séance to wake the first one.</p>`.
- `Back to menu` button (44 px, focus ring).

Because `UnmetGrave` has no `char`, the component cannot read a glyph for it; a test also scans the rendered HTML of an all-unmet graveyard for any of the 300 characters.

### `components/Credits.tsx` and the data modules (Requirement 9)

`data/credits.ts` exports:

```ts
export interface DataSourceCredit { name: string; version: string; use: string; licence: string; url: string }
export const DATA_SOURCES: readonly DataSourceCredit[];   // the five README rows, same wording
export const COMBINED_WORK_NOTE: string;                   // characters.json carries each source's terms
export const CODE_LICENCE = 'MIT';
export interface FontCredit { name: string; licence: string }
export const FONTS: readonly FontCredit[];                 // [{ name: 'Cormorant Garamond', licence: 'SIL Open Font License 1.1' }]
```

`data/citations.ts` exports `CANGJIE_CITATIONS` (moved from `CangjieGuide`, same two entries) and `LEGEND_SOURCE`: the zh line `天雨粟，鬼夜哭`, the English rendering already in `IntroScreen`, and the citation string copied exactly from the "Approved legend line" section of `content-accuracy.md`. Bibliographic names in the citation (authors, historical figures) are allowed in credits and citations (approved decision 3, as `structure.md` says); the citation text lives in `data/citations.ts` and is copied from `content-accuracy.md`, not retyped.

`Credits` renders sections: Data sources (a `<table>` with `scope="col"` headers, or a definition list on narrow screens), Licensing (combined-work note, MIT), Legend, Cangjie, Fonts (including "Chinese text uses fonts already installed on your device"), Software, and a `Back to menu` button. URLs are text, not links. The one link is in the Software section: "Full licence texts (THIRD_PARTY_NOTICES.txt)", with `href={import.meta.env.BASE_URL + 'THIRD_PARTY_NOTICES.txt'}` so it works under the `/ghost-script/` base of the production build.

README cross-check test (`tests/unit/credits-readme.test.ts`, root node project): parse the README table rows under "Data and licences", and for each compare name, version/commit, use, licence and URL with `DATA_SOURCES`; check the `Fonts` line in the README names the same font and licence as `FONTS`; check `LEGEND_SOURCE.citation` appears in `content-accuracy.md` and in the README.

### Software credits and third-party notices (Requirement 16)

**Which packages.** The Runtime_Dependency tree of `app/package.json` as installed. At the pinned versions this is `react`, `react-dom`, `hanzi-writer`, `scheduler` (a dependency of `react-dom`), `loose-envify` and `js-tokens` (dependencies of `react`, `react-dom` and `scheduler`), and `@fontsource/cormorant-garamond` (the font package, once task 1.2 adds it). The script lists the whole tree, not only what ends up in the JavaScript bundle, because it cannot tell which packages Vite keeps; listing a package that is dropped is harmless, omitting one that is kept would not be. Development dependencies (Vite, Tailwind, Vitest, Testing Library, TypeScript) are not listed because they are not shipped.

**Script** `scripts/build-notices.ts` (Node + TypeScript, run with `tsx`, ESM direct-execution guard like `data-check.ts`):

```ts
export interface LicenceFile { readonly fileName: string; readonly text: string }
export interface NoticePackage {
  readonly name: string; readonly version: string; readonly licence: string; // SPDX id from package.json
  readonly files: readonly LicenceFile[];
}
export function collectRuntimePackages(appDir: string): NoticePackage[]; // sorted by name
export function renderNotices(packages: readonly NoticePackage[]): string;
export function runtimeSummary(packages: readonly NoticePackage[]): { name: string; version: string; licence: string }[];
```

- `collectRuntimePackages` reads `<appDir>/package.json`, walks `dependencies` and `optionalDependencies` recursively, and resolves each package the way Node does: look in `node_modules` of the requiring package's directory, then in each parent directory up to the filesystem root (npm hoists workspace dependencies to the root `node_modules`). It tracks visited `name@version` pairs, so cycles end. It never reads `devDependencies` or `peerDependencies`.
- Licence files: every regular file in the package directory whose name matches `/^(licen[cs]e|copying)(\..*)?$/i`. This takes `LICENSE`, `LICENSE.md`, `LICENCE`, and `COPYING.md` (which `hanzi-writer` ships next to its MIT `LICENSE`, with an Arphic note). The text is read as UTF-8 and kept byte for byte.
- Licence identifier: the `license` string in `package.json`; a legacy `licenses` array or object form is not accepted. A missing identifier or no licence file throws an error naming the package (Requirement 16.5); `main()` catches it, prints it, exits 1 and does not write the file, because rendering happens before the write.
- `renderNotices` output, in this exact layout:

```
Third-party notices for the runtime dependencies of Ghost Script.
Generated by scripts/build-notices.ts. Do not edit by hand.

================================================================================
react 18.3.1
Licence: MIT
File: LICENSE
================================================================================
<licence text, verbatim; one "\n" is added only if the text does not end with one>

================================================================================
react-dom 18.3.1
...
```

  Packages are sorted with a plain code-unit comparison of the name (not `localeCompare`), licence files likewise by file name. Line endings are LF in the added lines; the verbatim text is not altered, so a licence file with CRLF keeps its CRLF. There is no date, path or hostname anywhere in the output.
- `main()` computes the output, then writes `app/public/THIRD_PARTY_NOTICES.txt` with `fs.writeFileSync`. Root script: `"build:notices": "tsx scripts/build-notices.ts"`.

**Credits Software list.** `app/src/data/software.ts` exports `SOFTWARE_CREDITS: readonly { name: string; version: string; licence: string }[]`, in ascending name order, one entry per package of the notices file (including `@fontsource/cormorant-garamond` with licence `OFL-1.1`). It is written by hand; the test below forces it to stay in step with the notices, so a dependency change makes a test fail until both the file and the list are updated. `Credits` renders a table (name, version, licence) and the link.

**Why committed, not generated at build time.** Stated in Decision 7: the static host serves the committed file; the unit test replaces the build step as the guard. The file counts toward the Bundle_Budget (it is copied into `app/dist`); the licence texts are a few tens of kilobytes of text, compressing to a few kilobytes, and the final checkpoint's `check:bundle` confirms the total.

**Tests** (`tests/unit/third-party-notices.test.ts`, root node project):

1. *Up to date.* `renderNotices(collectRuntimePackages('app'))` equals the committed file's text exactly. The failure message tells the reader to run `npm run build:notices`.
2. *Deterministic.* Two consecutive runs give identical strings.
3. *Complete.* For each package of `collectRuntimePackages('app')`, the committed file contains its header (name, version, licence id) and the full text of each of its licence files. The package list contains `react`, `react-dom`, `hanzi-writer`, `scheduler` and `@fontsource/cormorant-garamond`, and no package from `devDependencies` of `app/package.json` that is not also a runtime package.
4. *Font licence.* The font package's licence text starts with the SIL Open Font License heading and appears in the file.
5. *Credits match.* `SOFTWARE_CREDITS` (name, version, licence) equals the packages parsed from the headers of the committed file, as a set and in order.
6. *Script behaviour on a fixture tree* (a temporary directory built by the test with a few small packages): dev dependencies are skipped; a hoisted dependency is found in the parent `node_modules`; a cycle terminates; a missing licence file throws an error naming the package; a missing `license` field throws; a package with two licence files prints both, sorted by file name; `renderNotices` on shuffled input gives the same string.

`Credits.test.tsx` also checks the Software table shows every `SOFTWARE_CREDITS` row and that the link `href` ends with `THIRD_PARTY_NOTICES.txt` and starts with the base URL (in tests `import.meta.env.BASE_URL` is `/`).

### `components/CangjieGuide.tsx` (Requirement 10)

- Sentence: "Each ghost is summoned by typing its Cangjie code. In this game, a code is one to five keys, typed in order."
- The `<ul aria-label="The 25 Cangjie keys">` gets a visible `<h2 id="guide-keys">The 25 keys in this game</h2>` and `aria-labelledby="guide-keys"`.
- `CITATIONS` is imported from `data/citations.ts`.
- `CangjieGuide.test.tsx` assertions are updated to the new strings.

### `components/StartMenu.tsx` and `App.tsx` (Requirement 11)

`StartMenuProps` gains `onOpenGraveyard` and `onOpenCredits` (both required). Two buttons with the same classes as the other secondary buttons are added after "How Cangjie works". `App.View` gains `{ screen: 'graveyard'; dataset }` and `{ screen: 'credits'; dataset }`. The graveyard case renders `<Graveyard dataset history={loadState().history} now={Date.now()} onBack>`; reading the state and clock happens in the `App` case, not in the component, so the component stays pure to test. Back goes to `menu`.

### Theme tokens (`styles/theme.ts`, `tailwind.config.ts`)

Added tokens (proposed; the theme test confirms each pair at 4.5:1 or better and the task may adjust a hex to pass):

| Token | Proposed hex | Used for |
| --- | --- | --- |
| `paper` | `#e6dcc3` | surface background |
| `inkOnPaper` | `#1c1914` | completed strokes, text on paper |
| `drawing` | `#3a342a` | the stroke being drawn |
| `seal` | `#a3301f` | hint highlight (red seal colour) |
| `gridLine` | `#a3301f` | Practice_Grid lines, shown at opacity 0.25 (decorative) |
| `graveRestless`, `graveRest`, `graveWisp` | dark tints of `surface` | Grave backgrounds; text on them `ink` or `ghost` |

These values are accepted (approved decision 5).

Tailwind `fontFamily`: `display: ['"Cormorant Garamond"', 'Georgia', 'serif']` and `hanzi: ['"PingFang SC"', '"Hiragino Sans GB"', '"Songti SC"', '"Microsoft YaHei"', '"Noto Sans CJK SC"', '"Noto Serif CJK SC"', 'sans-serif']` (the Chinese_Font_Stack, exactly this order). Elements with `lang="zh"` use `font-hanzi` through one rule in `index.css` (`[lang='zh'] { font-family: "PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Serif CJK SC", sans-serif; }`). The `index.css` test checks that the rule contains this exact list and that the Tailwind `hanzi` family equals it.

### Fonts (Requirement 12)

`npm install -w app --save-exact @fontsource/cormorant-garamond@5.3.0`; in `main.tsx`, `import '@fontsource/cormorant-garamond/latin-600.css'`. That file declares one `@font-face` with `font-display: swap`, `unicode-range` for Latin, and a self-hosted `woff2`. Only weight 600 and the Latin subset are imported. No network request to another host. The headings (`h1`, `h2`) and the "Ghost Script" title use `font-display`. README records (the OFL text itself is in the Notices_File, Requirement 16.3): Cormorant Garamond, package `@fontsource/cormorant-garamond` 5.3.0, SIL OFL 1.1 (SPDX `OFL-1.1`), copyright "2015 The Cormorant Project Authors".

### `scripts/check-bundle-size.ts` (Requirement 12.6 to 12.8)

```ts
export interface SizedFile { readonly path: string; readonly gzipBytes: number }
export const BUNDLE_BUDGET_BYTES = 300_000;
export interface BundleReport { readonly total: number; readonly ok: boolean; readonly largest: readonly SizedFile[] }
export function summariseBundle(files: readonly SizedFile[], budget?: number): BundleReport; // excludes data/characters.json, top 5 largest
```

`main()` (only under the ESM direct-execution guard, like `data-check.ts`) walks `app/dist`, gzips each file with `zlib.gzipSync(buf, { level: 9 })`, prints the total and the five largest, and sets exit code 1 when over budget or when `app/dist` is missing (message: run `npm run build -w app` first). Root script: `"check:bundle": "tsx scripts/check-bundle-size.ts"`.

## Data Models

No stored data changes. `PersistedState` stays at schema 2. New in-memory types: `Grave`, `GraveyardModel`, `GhostState`, `DataSourceCredit`, `FontCredit`, `SizedFile`, `BundleReport`. `characters.json` is read-only for this feature.

## Error Handling

| Situation | Behaviour |
| --- | --- |
| Storage unavailable or corrupt | `loadState()` already returns the empty default; the Graveyard shows all wisps and the "no ghost met" line. |
| History entry with a non-finite `nextDue` | Treated as 0 (due), so `restless`; no throw. |
| History key for a character outside the dataset | Ignored. |
| Font file fails to load | `font-display: swap` keeps the fallback serif visible; no layout dependency on the font. |
| Device without a Chinese font | Fallback boxes instead of glyphs; an unverified risk, accepted (approved decision 1). |
| A runtime dependency has no licence file or no `license` field | `build:notices` prints the package name, exits 1 and leaves the committed file as it was. |
| Committed notices differ from a fresh run | The unit test fails and says to run `npm run build:notices`. |
| `app/dist` missing when running the Bundle_Check | Exit 1 with a message to build first. |
| Reduced motion | Static end states from CSS; no JavaScript branch needed. |

## Testing Strategy

Unit tests and component tests only (Vitest, Testing Library). No property-based tests and no mutation tests are added, per the Nov 15 decision; the existing property tests stay and must still pass.

### New unit tests

- `engine/graveyard.test.ts`: `classifyEntry` for each rule row, built with the real `applyReview` (clean, struggled, gave-up) and fixed `now`; boundary `nextDue === now` is `restless`, `nextDue === now + 1` with `clean` is `at-rest`; non-finite and negative `nextDue`; `cleanStreak` cases (3 clean after a miss, a miss last, no `history`); `buildGraveyard` order equals `learningOrder`, counts sum to the dataset size, unknown history keys ignored, duplicate order entries skipped, unmet graves have no `char` property, keys like `constructor` do not hit the prototype.
- `engine/ghostVisual.test.ts`: the four mappings.
- `data/credits.test.ts`: every `DATA_SOURCES` entry has non-empty fields and an `https://` URL; the citations constants have the two titles and URLs.
- `styles/index.css.test.ts`: read `index.css` as text; the `[lang='zh']` rule holds the exact Chinese_Font_Stack, equal to the Tailwind `hanzi` family; every `animation` declaration sits inside a `prefers-reduced-motion: no-preference` block; the `:root` palette values equal `theme.ts`; the `[data-ghost-state]` end states exist for `faded`, `flickering`, `drifted`.
- `styles/theme.test.ts` (extended): contrast of `inkOnPaper`, `drawing`, `seal` on `paper`; text tokens on the grave backgrounds.
- `tests/unit/bundle-size.test.ts`: `summariseBundle` under, at and over budget; `data/characters.json` excluded; only the five largest listed.
- `tests/unit/credits-readme.test.ts`: as above.
- `tests/unit/third-party-notices.test.ts`: described in "Software credits and third-party notices".

### New and updated component tests

- `PracticeGrid.test.tsx`: five groups, `aria-hidden`, no `<text>`, `pointer-events-none`, line opacity at most 0.35.
- `InkSurface.test.tsx`: renders the grid and the container; the container is never `display: none`; same size in every state.
- `Graveyard.test.tsx`: one `<li>` per dataset record; with an empty history the HTML contains none of the characters and the "no ghost met" line; with a mixed history the Met glyphs appear and each state has its marker and accessible name; legend counts; Back button; unmet grave labels contain no glyph; `now` boundaries.
- `Credits.test.tsx`: every `DATA_SOURCES` row visible with its URL; combined-work note; legend line and citation; both Wikipedia titles and URLs as text; font entry and the installed-fonts sentence; Back button; no `<a>` elements.
- `GhostPrompt.test.tsx` (extended): `data-ghost-state` for each outcome; the target character is absent from `container.innerHTML` for every state; the figure has no `<text>`; the clue text elements have no opacity style.
- `SeanceSession.test.tsx` (extended): after an outcome the card state matches and the result text and Next button are present at once.
- `WriteMode.test.tsx` (extended): the mocked `HanziWriter.create` receives the palette colours.
- `SummonStep.test.tsx` (extended): the keyboard has three row groups of 10, 9 and 6 buttons in the given order, no `flex-wrap` class, key classes include `min-h-[44px]`, the `--key-w` clamp has a 32px lower bound; the surface wrapper has the same `width` style in the typing, forming and fading phases; the status element has `min-h-[3rem]`; existing never-reveal tests are untouched.
- `CangjieGuide.test.tsx`: new strings present, old strings absent.
- `StartMenu.test.tsx`: five buttons in order; the two new callbacks fire once; the existing three still fire theirs.
- `App.test.tsx`: Menu to Graveyard to Back, Menu to Credits to Back.

jsdom has no layout, so pixel widths (32 px keys at 375 px) are checked through the computed style tokens in tests and by the human check at 375, 768 and 1440 px before deploy (task 10.1; approved decision 6).

### Test notes

- When a test needs a Cangjie code or a decomposition, call the `cangjie-oracle` tools (`lookup`, `decompose`) and copy the verified value; never type a code from memory.
- Existing tests that assert `toHaveLength(3)` for the menu buttons, the guide strings or the `hidden` class on the summon container must be updated by the task that changes the component.

## Impact on existing code and tests

- `scheduler.ts`, `config.ts`, `outcome.ts`, `learningOrder.ts`, `cangjie.ts` and `characters.json` stay untouched, and `storage.ts` gains only `isSavingWorking()` (Requirement 14.1 as amended; checked with `git diff --stat` in the final checkpoint).
- The `hidden` class on the Summon container goes away; tests that look for it are updated.
- `CangjieGuide`'s `CITATIONS` constant moves to `data/citations.ts`; the rendered output is unchanged.
- `app/package.json` gains one dependency; the root lockfile changes with it.
- `app/public/THIRD_PARTY_NOTICES.txt` is a new committed file; the root `package.json` gains `build:notices`. Adding or upgrading a runtime dependency now needs `npm run build:notices` and an update of `software.ts`, or a test fails.

## Post-outcome polish (Requirement 17)

Requested by the human. No game rule changes.

**Single result line.** `SeanceSession` already shows the result line from `RESULT_TEXT` for the combined Outcome ("Laid to rest", "Laid to rest — it will return soon", "The ghost slipped away"). `WriteMode`'s `onComplete` currently also sets a status line ("✓ Laid to rest" or "✓ Laid to rest — but this ghost will return soon"). That text only reflects the write step, so it can disagree with the combined Outcome (summon struggled, write clean). Change: `onComplete` still reports the outcome through `onOutcome` but sets the status line to the empty string. The Give-up message "The ghost reveals itself" describes the reveal animation, not the result, and stays.

**Give up button.**
- `WriteMode`: render the button only while no outcome has been reached. It stays rendered and disabled during loading, before writing starts. Once the outcome is reached the button is not in the DOM.
- `SummonStep`: render the button only in the typing phase. In the forming and fading phases it is not in the DOM.
- Layout: the button sits in a controls row below the surface, so removing it moves no keyboard, surface or status element that the player is using at that moment (the Summon surface and status area keep their reserved size, Requirement 8).

**Focus.** If the hidden button had focus, nothing else changes in this task. `SeanceSession` already moves focus to "Next ghost" after the outcome, so focus is not lost for the Lay-to-rest step. For the Summon step, the step ends by unmounting after the fade, as before. No new focus code is added.

**Unchanged.** The never-reveal rule, Outcome values, hint rules, `SUMMON_HOLD_MS` and `SUMMON_FADE_MS`, and every file in Requirement 14.1.

**Tests (unit and component only).**
- `WriteMode.test.tsx`: the status line is empty after completion (clean and struggled); the "Give up" button is disabled while loading, enabled while writing, absent after the outcome; the "The ghost reveals itself" message still appears after Give up.
- `SummonStep.test.tsx`: the "Give up" button is present while typing and absent in the forming and fading phases; the existing never-reveal, hint and timing tests pass unchanged.
- `SeanceSession.test.tsx` and `App.test.tsx`: replace assertions that find the old WriteMode "Laid to rest" text, or a disabled Give up, with assertions on the `SeanceSession` result line (exactly one result line on screen) and on the absence of the button.

## Amendments from tester feedback (Requirements 18 to 23)

Approved by the human. Presentation and navigation only: no scheduler, Outcome, timing or storage change (Requirement 23.1). Research for this section was done by reading the current code: `App.tsx`, `SeanceSession.tsx`, `StartMenu.tsx`, `Graveyard.tsx`, `Credits.tsx`, `IntroScreen.tsx`, `GhostPrompt.tsx`, `styles/theme.ts`, `styles/index.css` and `tailwind.config.ts`.

### Facts found in the current code

- `App.Shell` wraps every screen in a `<main class="min-h-screen ... bg-background ...">`; `StartMenu`, `Graveyard`, `Credits`, `IntroScreen`, `CangjieGuide` and `SessionSummary` each add their own `<main class="min-h-screen bg-background">`. These opaque wrappers would hide any page background, so they must become transparent (Requirement 21.11). The nested `<main>` elements already exist and are left as they are.
- Outcomes are recorded inside `App.handleOutcome`, called through `SeanceSession.onOutcome` at the moment a ghost's Outcome is reached. The summon result is only held in `summonResultRef` inside `SeanceSession` until the Write step ends. So leaving needs no storage code: a ghost that has no Outcome has no record.
- `SeanceSession` has an effect that moves focus to "Next ghost" when `result` becomes non-null. This would steal focus from an open Leave_Prompt, so it needs a guard.
- The only test that encodes the old rule is `SeanceSession.test.tsx`, "has no legend or menu control during the session" (it looks for a button named `/legend|menu/i`).
- The ghost figure SVG lives inline in `GhostPrompt.tsx` (path in a `64 x 80` viewBox, two eye circles filled `#0b0b10`).
- `index.css` already holds one `@media (prefers-reduced-motion: no-preference)` block and one `url("data:image/svg+xml...")` (the paper noise). `index.html` has `<div id="root">`.
- Tailwind ring utilities read `--tw-ring-color`; components use `focus-visible:ring-ghost`.

### Decisions

| # | Decision | Reason |
| --- | --- | --- |
| A1 | The Leave_Prompt is an inline `role="group"` named by its question. Focus goes to "Stay" (the safe choice), not to the group. Escape means "Stay". It is not `alertdialog`. | `alertdialog` promises modal behaviour (focus trap, inert background). The prompt does not trap focus, so a plain labelled group is the honest role. Focusing "Stay" lets a screen reader read the group name and the button, and a stray Enter cannot leave. |
| A2 | The Leave_Button stays visible while the prompt is open, with `aria-expanded` and `aria-controls`. | The state is announced, and the prompt sits right after it in reading order. |
| A3 | The Sources_Caption goes under the menu button, not under the heading. | The tester was confused before opening the screen ("what is the credits button for?"). The screen's own sections already explain themselves. |
| A4 | Internal names stay: view `credits`, file `Credits.tsx`, `CreditsProps`, `onOpenCredits`, `data/credits.ts`, ids `credits-*`. Only user-facing text changes. | The README cross-check test and the spec history use these names; renaming adds churn with no user effect. |
| A5 | One global rule makes every focus ring candle-coloured: `:focus-visible { --tw-ring-color: var(--candle) !important; }`. | One place, no sweep over twenty `ring-ghost` classes, testable as CSS text. |
| A6 | The Night_Scene is three fixed pseudo-elements, no extra DOM: `body::before` (sky), `body::after` (mist A), `#root::before` (mist B). `#root` gets `position: relative; z-index: 1`. | CSS only, hidden from assistive technology, no pointer events. Fixed pseudo-elements avoid the iOS Safari problem with `background-attachment: fixed`. |
| A7 | Mist moves with `transform: translateX` on a 200%-wide fixed layer, not by animating `background-position`. | Transforms animate without repainting. Slow periods (120 s and 180 s). |
| A8 | The Moon_Glow is a class `.moon-glow` on the menu hero wrapper, drawn by `::before`. It is not part of the page-wide scene. | The brief says "behind the title". |
| A9 | The page wrapper `<main>` elements drop `bg-background`. `body` keeps `bg-background` as the fallback colour. | Requirement 21.11. |

### 18. Leave séance (Requirement 18)

**Props and state (`SeanceSession.tsx`).** New required props `onLeave: () => void` and `savingWorks: boolean` (the text of the Leave_Prompt follows it). New state `confirmingLeave: boolean`. New refs: `leaveBtnRef`, `stayBtnRef`, `leftRef` (set to `true` when the player leaves), `confirmingRef` (mirror of the state for the focus effect).

**Layout.** The first element of the session is a top row:

```tsx
<div className="flex w-full items-center justify-between gap-3">
  <button ref={leaveBtnRef} type="button" aria-expanded={confirmingLeave}
          aria-controls="leave-prompt" onClick={openLeave}
          className="min-h-[44px] rounded-md border border-muted bg-surface px-4 py-2 text-base text-ink ...focus ring">
    Leave séance
  </button>
  <h2 className="text-lg text-ink">Ghost {index + 1} of {total}</h2>
</div>
{confirmingLeave && (
  <div id="leave-prompt" role="group" aria-labelledby="leave-question" onKeyDown={escapeIsStay}
       className="w-full rounded-lg border border-candle bg-surface p-4 text-center">
    <p id="leave-question" className="text-ink">{savingWorks ? LEAVE_TEXT_SAVED : LEAVE_TEXT_NOT_SAVING}</p>
    <div className="mt-3 flex justify-center gap-3">
      <button type="button" onClick={leave} className="min-h-[44px] ...">Leave</button>
      <button ref={stayBtnRef} type="button" onClick={stay} className="min-h-[44px] ...">Stay</button>
    </div>
  </div>
)}
```

Two constants hold the texts, exactly as in Requirement 18.2a and 18.2b: `LEAVE_TEXT_SAVED = "Leave now? Ghosts you've finished are saved."` and `LEAVE_TEXT_NOT_SAVING = "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost."`. `aria-labelledby="leave-question"` points at the same `<p>`, so the group's accessible name follows the text shown. The texts use a straight apostrophe, exactly as in the requirement. The button names are exactly "Leave séance", "Leave" and "Stay"; tests must match them exactly (a regex `/leave/i` would match two buttons).

**Behaviour.**

| Event | Effect |
| --- | --- |
| Press "Leave séance" | `setConfirmingLeave(true)`; an effect moves focus to `stayBtnRef` when the prompt mounts. |
| Press "Stay", or Escape with focus inside the group (`onKeyDown` on the group, `event.key === 'Escape'`) | `setConfirmingLeave(false)`; an effect returns focus to `leaveBtnRef` when the prompt unmounts. Nothing else changes, and timers keep running (the prompt does not pause the game). |
| Press "Leave" | `leftRef.current = true`, then `onLeave()` once. No call to `onOutcome` or `onComplete`. |
| Outcome reached while the prompt is open | `handleOutcome` records it as usual (`onOutcome`), sets `result`, but the focus effect for "Next ghost" is skipped while `confirmingRef.current` is true. Focus stays on the prompt. After "Stay", focus returns to the Leave_Button as in every case. |
| Late event after leaving (a Write quiz callback or a Summon timer) | `handleOutcome` and `handleSummonDone` return at once when `leftRef.current` is true. The Summon step also unmounts, which clears its timers. |

**Why nothing is recorded for the current ghost.** `onOutcome` is the only path to storage and it is called only from `handleOutcome`. A ghost that has not reached an Outcome has not called it. The summon result lives in `summonResultRef` and is dropped with the component. Leaving writes nothing.

**Storage note (amended, approved by the human).** The claim "Ghosts you've finished are saved" is true only when the last write succeeded. `saveState` catches a failed write (quota, disabled storage) and keeps nothing, and `App.handleOutcome` ignores the return value of `recordOutcome`, so the player would be told something false. The one allowed change to `storage.ts` is a read-only flag, with no schema change and no change to any existing signature:

```ts
// in createStore
let saveFailedThisSession = false;           // sticky: starts false, never cleared
// saveState: no backend -> saveFailedThisSession = true; setItem throws -> saveFailedThisSession = true; a successful setItem changes nothing
// Store gains:  isSavingWorking(): boolean   // returns !saveFailedThisSession
// module level: export const isSavingWorking = (): boolean => defaultStore.isSavingWorking();
```

`recordOutcome`, `setIntroSeen` and `setCangjieIntroSeen` go through `saveState`, so they update the flag; `loadState` and `resetToDefaults` do not. The flag is per store and lives in memory only. It is sticky for the page session: once a write fails it stays false even if a later write succeeds, because the failed write's Outcome was never persisted (an earlier version followed only the latest write, so "Ghosts you've finished are saved" could be shown after ghost 1 failed and ghost 2 saved; an accuracy finding, fixed). A new page session creates a new store and starts true again. Before any write it is true, so on a browser that cannot save, the first Leave_Prompt before any write may still show the saved text. At that point no ghost is finished, so the text promises nothing that is lost. Once the intro flag or the first Outcome is written, the flag is correct for every write so far. The wording of the not-saving text says "may be lost" because a write can fail after earlier Outcomes were saved (resolving an accuracy finding; approved option kept).

**App wiring (`App.tsx`).** `<SeanceSession ... savingWorks={savingWorks} onLeave={() => setView({ screen: 'menu', dataset })} />`. `savingWorks` is state in `App` (it can only go from true to false during a visit, because the storage flag is sticky), initialised from `isSavingWorking()` and refreshed with `setSavingWorks(isSavingWorking())` at these points: on mount (the initial state), right after `setIntroSeen(true)`, right after `setCangjieIntroSeen(true)`, in `startSeance` when a séance begins, and in `handleOutcome` right after `recordOutcome`. Every write the App makes is followed by a refresh, so the value is current whenever the prompt opens. The `key={sessionId}` already forces a fresh session next time. The summary screen is not shown.

**The superseded rule.** `.kiro/specs/ghost-game-core/requirements.md` AC 1.5 and the matching line of its design carry an "Amended (approved by the human)" note that points to Requirement 18. In `SeanceSession.test.tsx`, the test "has no legend or menu control during the session" is replaced by two tests: the Leave_Button is present in every state; and no button named like the legend, the Cangjie guide, the Graveyard, Sources & licences or "Back to menu" is present, before and after an Outcome.

**Tests (component, jsdom).**
- `SeanceSession.test.tsx`: Leave_Button is the first button in the DOM and is present while summoning, while writing and after an Outcome; pressing it shows the prompt text and two buttons and no `window.confirm` call (spy); the group's accessible name is the question; `aria-expanded` toggles; focus is on "Stay"; "Stay" and Escape close the prompt, restore focus to the Leave_Button and keep `onOutcome` and `onComplete` uncalled; "Leave" calls `onLeave` once; after "Leave" a late outcome emit calls neither callback; leaving after the summon step finished (real SummonStep with fake timers, as in the existing two-step suite) calls `onOutcome` zero times; an Outcome reached while the prompt is open is reported once and focus stays inside the prompt; the 44 px classes.
- `App.test.tsx`: start a séance, finish ghost 1 (stub WriteMode as the existing tests do), start ghost 2, press Leave séance, then Leave; the menu shows; `loadState().history` has an entry for ghost 1 and none for ghost 2; pressing "Stay" instead keeps the séance on screen.

### 19. Sticky header on Graveyard and Sources & licences (Requirement 19)

**Structure.** In both screens the `<header>` is the first child of the content container (the element as tall as the whole screen, so `position: sticky` has room to stick), and the bottom "Back to menu" button is deleted.

```tsx
<header className="sticky top-0 z-20 -mx-4 flex min-h-[64px] items-center justify-between gap-3 border-b border-muted/40 bg-night-top px-4 py-2">
  <h1 className="min-w-0 font-display text-2xl font-semibold sm:text-3xl">Graveyard</h1>
  <button type="button" onClick={onBack} className="min-h-[44px] shrink-0 whitespace-nowrap rounded-md border border-muted bg-surface px-4 py-2 text-base text-ink ...focus ring">Back to menu</button>
</header>
```

- `bg-night-top` is the opaque darkest sky colour (token from task 13.1), so no content shows through and the header text contrast is the token-on-token ratio checked in the theme test (Requirement 19.8). `z-20` sits above the graves (`.grave` is `position: relative`; the restless grave also has `clip-path` and an animation, which create stacking contexts at the default level). `-mx-4 px-4` extends the bar to the edge of the 16 px page padding.
- The `<main>` loses its top padding (`pt-0`) so the header sits flush when stuck. The Sources screen does the same (`py-10` becomes `pb-10`) and keeps its `h1` id `credits-title` for `aria-labelledby`, now with the text "Sources & licences".
- Height: 44 px button plus 2 x 8 px padding is 60 px; `min-h-[64px]` makes it 64 px, within the 72 px limit. At 375 px the title at `text-2xl` (24 px, Cormorant, "Sources & licences" about 180 px) and a 140 px button fit in 343 px; the title has `min-w-0` and may shrink, never the button. jsdom cannot measure this, so the human check of task 19.2 covers it.
- **Scroll padding.** `html { scroll-padding-top: 5rem; }` in `index.css` (80 px, above the 64 px header) so a focused or scrolled-to element does not hide behind the stuck header (Requirement 19.6). It is global and harmless on other screens.
- The Graveyard keeps its existing intro line, legend, empty-history line and grid; only the title and the button move.

**Tests.** `Graveyard.test.tsx` and `Credits.test.tsx`: exactly one "Back to menu" button; it is inside the same `<header>` as the `h1`; the header class list contains `sticky`, `top-0` and an opaque `bg-night-top` (no `/` opacity suffix); the button is not the last focusable element; `onBack` called once; 44 px class and focus ring classes. `index.css.test.ts` (task 13.2): `scroll-padding-top` is at least 4rem.

### 20. Sources & licences (Requirement 20)

- `StartMenu.tsx`: the fifth button text and accessible name become "Sources & licences" (written as the JSX text `Sources &amp; licences`, which renders the ampersand). It is wrapped with the caption:

```tsx
<div className="flex flex-col gap-2">
  <button type="button" onClick={onOpenCredits} aria-describedby="menu-sources-hint" className={...}>Sources &amp; licences</button>
  <p id="menu-sources-hint" className="text-center text-sm text-muted">Where the words, strokes, codes and fonts come from.</p>
</div>
```

  The caption is exactly "Where the words, strokes, codes and fonts come from." The words come from CC-CEDICT, the strokes from hanzi-writer-data, the codes from Unihan, and the fonts from the font package: each is listed on the screen, so the line makes no claim beyond the screen's content. The button's accessible name stays "Sources & licences"; the caption is its description.
- `Credits.tsx`: the `h1` text and the landmark name (`aria-labelledby` points to the `h1`) become "Sources & licences". Section headings, table and the Software link are unchanged. The old `aria-label="Back to menu"` on the button stays.
- Internal names stay (decision A4). The glossary note in the requirements says so.
- A search for the word "Credits" over `StartMenu.tsx` and `Credits.tsx` user-facing strings must find nothing; code comments and identifiers may keep it.
- **Tests.** `StartMenu.test.tsx`: the five names in order end with "Sources & licences"; the button has the accessible description of the caption; the caption text is exact; the callback fires once and no other. `Credits.test.tsx`: heading and landmark name; the rendered text has no `/\bcredits\b/i` match. `App.test.tsx`: the flow opens by the new name and finds the heading "Sources & licences".

### 21. Night scene (Requirement 21)

**Tokens (`theme.ts`, `tailwind.config.ts`; proposed, task 13.1 may adjust a hex only to pass its contrast test; no text token changes).**

| Token | Proposed | Use |
| --- | --- | --- |
| `nightTop` | `#050813` | darkest sky stop; header background |
| `nightMid` | `#0a1126` | middle sky stop |
| `nightLow` | `#12203f` | lightest sky stop |
| `mist` | `#5b6f9a` | mist colour (dim, so it cannot lift the background much) |
| `moon` | `#7283ab` | moon glow colour (dim, same reason) |
| `candle` | `#f0b866` | main button, focus ring |

Tailwind adds `night-top`, `night-mid`, `night-low`, `candle` (and `mist`, `moon`) colours and a `boxShadow.candle` of `0 0 20px rgba(240, 184, 102, 0.35)`. The existing `background` (`#0e0f13`) stays as the body fallback, the `text-background` colour on the candle button and the ring-offset colour.

**CSS (`index.css`).** New `:root` variables, same hex as the tokens (a test checks it): `--night-top`, `--night-mid`, `--night-low`, `--mist`, `--moon`, `--candle`, plus `--mist-peak-alpha: 0.05` and `--moon-peak-alpha: 0.06`.

```css
html { scroll-padding-top: 5rem; }
body::before {            /* sky */
  content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background: linear-gradient(180deg, var(--night-top) 0%, var(--night-mid) 55%, var(--night-low) 100%);
}
body::after {             /* mist layer A */
  content: ''; position: fixed; top: 0; bottom: 0; left: 0; width: 200%; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 30% 22% at 15% 70%, rgb(91 111 154 / var(--mist-peak-alpha)), transparent 70%),
    radial-gradient(ellipse 26% 18% at 60% 40%, rgb(91 111 154 / var(--mist-peak-alpha)), transparent 70%);
}
#root { position: relative; z-index: 1; }
#root::before {           /* mist layer B */
  content: ''; position: fixed; top: 0; bottom: 0; left: 0; width: 200%; z-index: -1; pointer-events: none;
  background: radial-gradient(ellipse 34% 20% at 35% 80%, rgb(91 111 154 / var(--mist-peak-alpha)), transparent 70%),
              radial-gradient(ellipse 28% 16% at 80% 25%, rgb(91 111 154 / var(--mist-peak-alpha)), transparent 70%);
}
.moon-glow { position: relative; isolation: isolate; }
.moon-glow::before {
  content: ''; position: absolute; z-index: -1; pointer-events: none;
  left: 50%; top: 40%; width: min(90vw, 28rem); aspect-ratio: 1; transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgb(114 131 171 / var(--moon-peak-alpha)) 0%, transparent 65%);
}
*:focus-visible { --tw-ring-color: var(--candle) !important; }
@media (prefers-reduced-motion: no-preference) {
  @keyframes mist-drift-a { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes mist-drift-b { from { transform: translateX(-50%); } to { transform: translateX(0); } }
  body::after { animation: mist-drift-a 120s linear infinite alternate; will-change: transform; }
  #root::before { animation: mist-drift-b 180s linear infinite alternate; will-change: transform; }
  .menu-figure { animation: ghost-float 4s ease-in-out infinite alternate; }
}
```

(The existing `@media` block is extended, not duplicated, so there is one block.) The rgb values above are the `mist` and `moon` tokens written as channel triples because CSS cannot split a hex custom property; the test derives the triple from the token and compares. The `rgb(r g b / var(...))` syntax keeps the peak alpha in one variable the test can read. Reduced motion: the layers stay at their start position, static.

**Page wrappers.** `bg-background` is removed from the wrapper `<main>` of `App.Shell` (task 17.2), `StartMenu` (15.2), `Graveyard` (16.2), `Credits` (16.1), and from `IntroScreen`, `CangjieGuide` and `SessionSummary` (18.1). Buttons, cards and graves keep `bg-surface` and the grave tokens. `hover:bg-background` and `ring-offset-background` stay.

**Candle accent.** The main button changes from `bg-ghost` to `bg-candle text-background shadow-candle`. The global focus rule colours every ring. Ring width, offset and `focus-visible` behaviour are unchanged, so rings remain visible; the offset colour `background` separates the ring from the button.

**Contrast tests.**
- `theme.test.ts` (task 13.1): each text token (`ink`, `muted`, `ghost`, `success`, `error`) at least 4.5:1 against `nightTop`, `nightMid` and `nightLow`; `candle` at least 3:1 against `nightTop`, `nightLow` and `background`; `background` text on `candle` at least 4.5:1; `ink`/`muted` on `nightTop` (header) at least 4.5:1; the darkest stop is `nightTop` and the lightest is `nightLow` (by luminance).
- `index.css.test.ts` (task 13.2): the worst-case composite is computed in the test: start from `nightLow`, blend `mist` at `--mist-peak-alpha` twice (both layers overlap), then blend `moon` at `--moon-peak-alpha`; every text token must reach 4.5:1 on that colour. Hand calculation with the proposed values gives a worst-case background relative luminance of about 0.041, which puts `muted` (the tightest token, luminance about 0.386) at about 4.8:1; if a run fails, the task lowers the alpha variables or darkens `mist` or `moon`, never changes a text token.
- Motion: every `animation` property and every `@keyframes` lies inside the `prefers-reduced-motion: no-preference` block; the file has exactly one such block.
- `url()`: every match of `url(` in `index.css` is followed by `"data:`, `'data:` or `data:`.
- Variables equal tokens; `scroll-padding-top` at least `4rem`; `pointer-events: none` on the three scene pseudo-elements; the `:focus-visible` rule sets `--tw-ring-color` to `var(--candle)`.

**Bundle.** About 1.5 kB of CSS (about 0.6 kB gzip); no new dependency, no file. Checked by `check:bundle` at the final checkpoint.

### 22. Menu entrance (Requirement 22)

**`components/GhostFigure.tsx` (new).**

```tsx
export interface GhostFigureProps { className?: string }
export function GhostFigure({ className = '' }: GhostFigureProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 64 80" className={className}>
      <path d="M8 76 V32 C8 14 20 4 32 4 C44 4 56 14 56 32 V76 L48 68 L40 76 L32 68 L24 76 L16 68 Z" fill="currentColor" />
      <circle cx="24" cy="34" r="4" fill={theme.background} />
      <circle cx="40" cy="34" r="4" fill={theme.background} />
    </svg>
  );
}
```

The path is the one already in `GhostPrompt`; moving it changes nothing visible. The eye fill comes from the theme token (it was the literal `#0b0b10`; `theme.background` is `#0e0f13`, a one-step difference on a 4 px eye that is not user-visible, and the token is the one place to change). `GhostPrompt` renders `<GhostFigure className="ghost-figure mx-auto mb-2 h-16 w-14 text-ghost" />`; `data-ghost-state` and the CSS selectors do not change.

**`StartMenu.tsx` hero.**

```tsx
<div className="moon-glow flex flex-col items-center">
  <GhostFigure className="menu-figure mb-4 h-24 w-20 text-ghost" />
  <h1 className="mb-10 text-center font-display text-5xl font-semibold tracking-wide sm:text-7xl">Ghost Script</h1>
</div>
```

`text-5xl` is 3rem (48 px) and `sm:text-7xl` is 4.5rem. The existing five buttons follow in the same order; the main button uses `bg-candle text-background shadow-candle`. The wrapper `<main>` drops `bg-background`. The menu figure has no `data-ghost-state`, so only its own float animation applies; the float is in the `no-preference` block.

**Tests.** `GhostFigure.test.tsx`: `aria-hidden="true"`, `focusable="false"`, no `<text>`, same path in two renders. `GhostPrompt.test.tsx` (existing): still passes unchanged (figure present, no text element, state attribute). `StartMenu.test.tsx`: the `h1` "Ghost Script" has class `font-display` and `text-5xl`; the figure appears before the `h1` in document order; the figure is `aria-hidden`; only one `h1`; the main button has `bg-candle`; five buttons in order.

### Impact on existing code and tests

| Item | Change | Task |
| --- | --- | --- |
| `SeanceSession.test.tsx` "has no legend or menu control during the session" | replaced | 17.1 |
| `StartMenu.test.tsx` name list ends with "Credits" | now "Sources & licences" | 15.1 |
| `Credits.test.tsx` heading and bottom button tests | new heading; button in header | 16.1 |
| `Graveyard.test.tsx` button tests | button in header | 16.2 |
| `App.test.tsx` "Menu -> Credits -> Back" | new names; plus Leave tests | 17.2 |
| `GhostPrompt.test.tsx` | unchanged, must pass | 14.1 |
| Files of Requirement 14.1 (except `storage.ts`), `characters.json` | untouched | all |
| `storage.ts` | one addition, `isSavingWorking()` (sticky for the session); existing assertions unchanged | 14.1, 18.2d |

### Testing strategy for the amendments

Unit tests and component tests only (Vitest, Testing Library, and plain Node file reads for CSS and tokens). Property-based testing does not apply: the work is presentation, focus handling and copy, and the Nov 15 decision forbids new property tests. jsdom cannot lay out or animate, so the sticky behaviour, the one-row header at 375 px and the look of the night scene are checked by class and CSS-text tests plus the human check of task 19.2.

## Amendment: Sources & licences fits a phone (Requirement 24)

Bug fix approved by the human. It fixes Requirement 9 (the Credits_Screen) at 375 px and relates to the manual task 10.1 (the human phone check, which found it). Presentation and test tooling only: no scheduler, Outcome, timing, storage or dataset change, and no file of Requirement 14.1 is touched. Research was done by reading `Credits.tsx`, `Graveyard.tsx`, `CangjieGuide.tsx`, `SeanceSession.tsx`, `SummonStep.tsx`, `WriteMode.tsx`, `StartMenu.tsx`, `App.tsx`, `storage.ts`, `app/vite.config.ts`, `index.css`, the three Vitest configs, the root `tsconfig.json` and `package.json`, and `.github/workflows/deploy.yml`.

### Root cause

`App.Shell` is a flex row (`<main class="flex items-center justify-center">`) that holds a `w-full max-w-3xl` flex column, and the Credits content sits in a `w-full max-w-3xl` block inside it. A flex item has `min-width: auto`, which is its min-content width. The min-content width of that block includes the widest descendant. The two tables have unbreakable values (commit hashes, URLs), and the cells use `break-words` (`overflow-wrap: break-word`), which does not lower min-content width. So the table is about 975 px wide, the flex item refuses to shrink below a width that depends on it, and the page grows (588 px at 375 px; the `overflow-x-auto` wrapper clips only its own box, not the min-content width it adds to its ancestors). `overflow-wrap: anywhere` does lower min-content width, because it allows a break at any character when the intrinsic size is computed. That is why the fix uses `anywhere` and not `break-word`. It also covers a viewport just above 640 px, where a table with `anywhere` cells can shrink instead of widening the page.

### Decisions

| # | Decision | Reason |
| --- | --- | --- |
| B1 | Both layouts stay in the DOM. Tables get `hidden sm:table`, the card lists get `sm:hidden`. | Pure CSS, no `matchMedia` hook, no hydration or resize state, no flash. Exactly one is shown at each width (Tailwind `sm` is 640 px: `min-width: 640px`). |
| B2 | Accessibility of the duplicate: `display: none` removes the hidden layout from the accessibility tree, so a screen reader reads each row once. Both layouts carry the same accessible name through `aria-labelledby` to the section's `h2` (a `<ul>` for the cards, a `<table>` for the tables). | `display: none` (Tailwind `hidden`) is skipped by assistive technology. `sr-only` or `invisible` would not be. |
| B3 | Card markup: `<ul aria-labelledby="credits-sources">` with one `<li>` per row, and inside each `<li>` a `<dl>` of `<div>` groups, each with one `<dt>` (label) and one `<dd>` (value). The label shows a colon through CSS (`after:content-[':']`), not through text. | `<div>` groups inside `<dl>` are valid HTML. A CSS colon keeps the `<dt>` text equal to the column label, so tests and screen readers see "Name", not "Name:". |
| B4 | The name of a source or package is the first line of its card (label "Name"), as in the table. No extra heading level. | Same content in both layouts (Requirement 24.5). |
| B5 | Wrap utility: the Tailwind arbitrary property `[overflow-wrap:anywhere]`, held in one constant `WRAP` in `Credits.tsx`. No `.wrap-anywhere` class in `index.css`, so there is no CSS task. | Tailwind 3.4 supports arbitrary properties, the build already scans `.tsx`, and a class name in the component is directly assertable in jsdom. A second place (CSS) would add a file for no gain. |
| B6 | The `WRAP` class replaces `break-words` on table cells and Cangjie citation items, and is added to the legend citation paragraph (it holds a long URL). `overflow-wrap` is inherited, but each element carries the class itself, so a test can check it. | A reviewer can see the rule on the element; the inherited value is only a bonus. |
| B7 | The `overflow-x-auto` wrapper `<div>` around each table stays. | It keeps an intentional scroll box if a table is still wider than its column at 640 px to 700 px. |
| B8 | Playwright, not jsdom, measures width (see "Why jsdom cannot measure layout"). | jsdom has no layout engine. |
| B9 | `e2e/` has its own `playwright.config.ts` and no `e2e/tsconfig.json`. `e2e/**/*.ts` is added to the `include` of the root `tsconfig.json`. | The root config is already the one the checkpoint runs (`npx tsc -p tsconfig.json`), it has `types: ["node"]` and the default libraries (which include DOM for the `page.evaluate` callbacks), so `e2e/` is checked with no new command. A second tsconfig would need a new checkpoint command and could drift. |
| B10 | No CI step now. | Out of scope (Requirement 24.15). Follow-up: add a job to `deploy.yml` or a separate workflow that runs `npm ci`, `npm run test:e2e:install` (with `--with-deps` on Linux) and `npm run test:e2e`, and decide whether it blocks deployment. |
| B11 | `@playwright/test` is a root devDependency, pinned exactly (`1.65.1`, the version `npm view` returned when this amendment was written; the task re-checks it). It is not in `app/package.json`. | The notices script and the Software_List read only the `app` runtime tree, so a root devDependency adds nothing to `THIRD_PARTY_NOTICES.txt`, `software.ts` or the bundle. `npm ci` in the deploy workflow installs it but downloads no browser, because the browser is a separate `playwright install`. |

### Why jsdom cannot measure layout

The component tests run in jsdom. jsdom builds a DOM and a CSSOM but has no layout engine: `getBoundingClientRect()` returns all zeros, `scrollWidth` and `clientWidth` are 0, and media queries such as `sm` (`min-width: 640px`) are not evaluated against a real viewport. The test setup also does not load the Tailwind stylesheet, so the classes `hidden` and `sm:table` have no effect: in jsdom both layouts are in the DOM and both count as visible. A jsdom test can therefore check only which classes and which text exist (Requirement 24.13), never that a table fits 375 px, that one layout is hidden at that width, or that a long URL wraps. Those three facts need a real browser with real CSS, which is what the E2E_Suite adds. The existing note of this spec ("Pixel checks cannot run in jsdom") stays true for everything else.

### `Credits.tsx` markup (Requirements 24.1 to 24.6)

```tsx
const WRAP = '[overflow-wrap:anywhere]';
const TD = `px-3 py-2 align-top text-sm text-ink ${WRAP}`;     // replaces break-words
const DT = "text-xs font-semibold uppercase tracking-wide text-muted after:content-[':']";   // label, colon from CSS
const DD = `text-sm text-ink ${WRAP}`;

// Data sources
<h2 id="credits-sources" ...>Data sources</h2>
<div className="mt-3 overflow-x-auto">
  <table aria-labelledby="credits-sources" className="hidden w-full border-collapse sm:table"> …unchanged rows, cells use TD… </table>
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
```

The Software section is the same with `credits-software`, the labels "Name", "Version", "Licence", and `SOFTWARE_CREDITS`. The `<dt>` and `<dd>` text colours reuse the existing tokens (`muted`, `ink`) on `surface`, which the theme tests already cover for text; the card background `bg-surface` is the existing token. The legend citation `<p>` and each Cangjie citation `<li>` get `WRAP`. The card `<ul>` has `list-none` through Tailwind's preflight (no bullets). Mixing `hidden` with `sm:table` on a `<table>` sets `display: none` below 640 px and `display: table` from 640 px, which restores the default table display.

### Component tests (`Credits.test.tsx`, jsdom; Requirements 24.3 to 24.6, 24.13)

- Both layouts exist: two `<table>` elements with the classes `hidden` and `sm:table`, and two card `<ul>` elements with `sm:hidden` (found through `aria-labelledby` or the section headings).
- Every `DATA_SOURCES` row appears in the Source_Table (scoped with `within(table)`) and as a card with the five labels and values; every `SOFTWARE_CREDITS` row appears in the Software_Table and as a card with the three labels and values.
- Each `<dt>` text equals a column label; each card is a `<dl>`.
- Long-value elements carry `[overflow-wrap:anywhere]`: every `<td>` and `<th scope="row">` of both tables, every `<dd>`, the legend citation paragraph and each Cangjie citation item.
- Existing tests that read the document text or call `getByText` still pass because the text now appears twice: queries that must find one element are scoped to the table (`within(table)`), and `document.body.textContent` checks (`toContain`) are unchanged. The Software-row test already scopes to the `Software` section and uses `getByRole('rowheader')`, which exists only in the table, so its intent is kept. The "exactly one `<a>`" test stays valid, because the cards contain no link.

### E2E suite (Requirements 24.7 to 24.12, 24.15)

**Files.**

```
e2e/
├── playwright.config.ts
└── no-horizontal-overflow.spec.ts
```

**`playwright.config.ts`.**

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4173;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 375, height: 812 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npm run build -w app && npm run preview -w app -- --host 127.0.0.1 --port ${PORT} --strictPort --base /ghost-script/`,
    cwd: ROOT,
    url: `http://127.0.0.1:${PORT}/ghost-script/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
```

- **Base path.** `app/vite.config.ts` sets `base: '/ghost-script/'` only for the `build` command; `vite preview` resolves the config with the `serve` command, so without a flag it would mount `dist` at `/` while `index.html` asks for `/ghost-script/assets/...` and every asset would 404. The flag `--base /ghost-script/` fixes the mount point. Tests open `/ghost-script/`.
- **Fixed port, loopback only.** Port 4173 with `--strictPort` (a busy port fails loudly) and `--host 127.0.0.1` (the README rule: never expose the server on the network).
- **`reuseExistingServer: false`.** A stale preview of an older build would hide a regression.
- **Chromium only.** One project, one browser. Desktop emulation at 375 × 812 (no `isMobile`), because the requirement is a 375 px layout width; headless Chromium hides scrollbars, so the layout width is 375.
- **Output folders.** The default `test-results/` (next to the config, so `e2e/test-results/`) and `playwright-report/` are ignored through `.gitignore` entries `test-results/` and `playwright-report/`, which match at any depth. `.kiro/` is never added to `.gitignore`.
- **Offline.** The app makes no external request at runtime, so the suite needs no network after the browser install.

**How each screen is reached (through the UI of the built app).** A helper `seed(page, state)` calls `page.addInitScript` with the key `ghost-script:state` and a blob `{ schemaVersion: 2, introSeen, cangjieIntroSeen, history }` (the shape in `storage.ts`). The script sets the key only when it is absent, so a reload inside a test never overwrites progress written by the app. Playwright gives every test a fresh browser context, so nothing leaks between tests.

| Screen | Seed | Steps | Ready when |
| --- | --- | --- | --- |
| Sources & licences | `introSeen: true`, `cangjieIntroSeen: true`, empty history | open `/ghost-script/`, click the button "Sources & licences" | `h1` "Sources & licences" is visible |
| Graveyard | same, plus history for the first three keys of `app/public/data/characters.json` (read with `node:fs` in the spec): one `struggled` with `nextDue: 0`, one `clean` with a far-future `nextDue`, one `gave-up` | open, click "Graveyard" | `h1` "Graveyard" is visible |
| How Cangjie works | `introSeen: true`, `cangjieIntroSeen: false` | open, click "How Cangjie works" | `h1` "How Cangjie works" is visible |
| Séance, Summon_Step | both flags `true` | open, click "Begin a Nightly Séance" | region "Summon step" is visible |
| Séance, Write_Mode | continue from the Summon step | click "Give up" in the Summon step, wait through the forming and fading phases (about 3 s, `SUMMON_HOLD_MS` + `SUMMON_FADE_MS`) | region "Write mode" is visible (timeout 10 s) |

- **Reaching the write step without handwriting.** "Give up" in the Summon step is allowed in the typing phase and ends the Summon step with the character formed for the player, then the session moves to the Write step. No code needs to be known, so no Cangjie code is typed by hand in the test (content-accuracy). The Write_Mode surface loads its stroke data from the dataset (no network), so the step is reachable offline. No stroke is drawn.
- **First ghost.** The first ghost of a new séance is the first character of the Learning_Order. The test requires the Summon step to appear and fails with a clear message if it does not (for example, if a dataset change makes the first ghost unplayable), rather than skipping.
- **Seeded rows.** The three Graveyard seeds make the grid show one grave of each state and a long list of wisps.
- **Why not the first-visit path (intro, then guide, then séance).** It is a valid route (the intro button "Begin the Séance" leads to the guide when `cangjieIntroSeen` is false), but it chains three screens in one test and hides which one failed. The seeded menu start gives one test per screen with the same real UI clicks. The intro screen itself is not in the four screens of the requirement.

**The Width_Check helper** `findOverflow(page)` returns a list of strings, empty when the screen fits:

1. Wait for fonts: `await page.evaluate(() => document.fonts.ready)`, so the `swap` font does not change widths after the measure.
2. Read `document.documentElement.scrollWidth`; when it is greater than 375, add `scrollWidth 588 > 375` (with the measured value).
3. For every element under `document.body` (and `body` itself): skip when `getComputedStyle(el).display === 'none'`; read `getBoundingClientRect()`; when `right > 375.5` or `left < -0.5`, add a line with a selector and the rounded left and right values.
4. The selector is `tag#id.class1.class2` (first three classes), plus `[aria-label="…"]` when present, plus the nearest ancestor with an id or `aria-label` as `in <that>`. The failure message of the test is the joined list, so the log names the element.

- **Skipped on purpose.** Elements with `display: none` (they have no box). Nothing else is skipped: no allow-list at the start. If a real element is wider by design (it must be one inside an intentional scroll container), the task adds a narrow, commented exception for that selector, not a general rule.
- **The mist layers.** `body::after` and `#root::before` are `position: fixed` and 200 % wide by design. They are pseudo-elements, and `querySelectorAll` and `getBoundingClientRect` work on elements only, so the loop never sees them; fixed-position boxes also add nothing to the document `scrollWidth`. The `scrollWidth` check still catches a real page that grows sideways. The helper does not call `getComputedStyle(el, '::before')`.
- **A guard against a check that always passes.** One extra test opens the menu, appends a `div` 600 px wide to `document.body` with `page.evaluate`, and expects `findOverflow` to return a non-empty list that names the `div`. That proves the helper can fail.
- **Viewport precondition.** Each test first checks `page.viewportSize()` equals 375 × 812.
- **Motion.** The default motion setting is kept, so the real animations run; the largest transform (the ghost drift, 12 px by 24 px) cannot reach the edge from the 16 px padding. If a test ever flakes on animation, the task may set `reducedMotion: 'reduce'` in the config.

### Vitest isolation (Requirement 24.12)

`vitest.workspace.ts` lists three projects, and each has an explicit `include`: the root `vitest.config.ts` has `tests/**/*.test.ts`; `app/vitest.config.ts` has `**/*.test.{ts,tsx}` (relative to `app/`, so `e2e/` at the repository root is outside it); `oracle/vitest.config.ts` has `tests/**/*.test.ts`. None matches a file named `*.spec.ts` under `e2e/`. Because every project sets `include`, Vitest's default pattern (which would match `*.spec.ts`) does not apply. `npm test` stays `vitest run`. Playwright's `testMatch` is `**/*.spec.ts` and its `testDir` is `e2e/`, so Playwright does not pick up the Vitest `*.test.*` files either. The checkpoint confirms that `npm test` output lists no `e2e/` file.

### Scripts, ignore rules and docs

- Root `package.json`: `"test:e2e": "playwright test -c e2e/playwright.config.ts"`, `"test:e2e:install": "playwright install chromium"`, and `"@playwright/test": "1.65.1"` in `devDependencies` (added with `npm install --save-dev --save-exact @playwright/test@1.65.1`; the lockfile changes with it).
- `.gitignore`: add `test-results/` and `playwright-report/` under a new comment. `!.kiro/` stays.
- Root `tsconfig.json`: add `"e2e/**/*.ts"` to `include`.
- `README.md`, "Run the tests" under Usage: a short subsection "Check the layout width in a real browser": run `npm run test:e2e:install` once (it downloads Chromium), then `npm run test:e2e` (it builds the app, serves it with `vite preview` on port 4173 and checks four screens at 375 px); `npm test` does not run it.
- `.github/workflows`: unchanged (follow-up B10).
- `kiro-log.md` and its tasks: not touched by this amendment.

### Impact on existing code and tests

| Item | Change | Task |
| --- | --- | --- |
| `Credits.tsx` | cards added, tables get `hidden sm:table`, `WRAP` replaces `break-words` | 22.1 |
| `Credits.test.tsx` | new layout tests; table-row queries scoped to the table | 22.2 |
| `package.json` (root), `package-lock.json`, `.gitignore` | Playwright devDependency, two scripts, two ignore lines | 22.3 |
| `e2e/playwright.config.ts`, root `tsconfig.json` | new config; `e2e/**/*.ts` in `include` | 22.4 |
| `e2e/no-horizontal-overflow.spec.ts` | new spec | 22.5 |
| `README.md` | new e2e note | 22.6 |
| `CangjieGuide.tsx`, `CangjieGuide.test.tsx` | `WRAP` class on the citation line and long values (fix found by the e2e check) | 22.7 |
| `index.css`, `Graveyard.tsx`, `SeanceSession.tsx`, `SummonStep.tsx`, `WriteMode.tsx`, `App.tsx`, `vite.config.ts`, `deploy.yml` | unchanged (read only). If the spec finds an overflow on a screen other than Sources & licences, the task that finds it stops and reports it instead of changing the file silently. | none |
| Files of Requirement 14.1, `characters.json` | untouched | all |

Property-based testing does not apply to this amendment: it is markup, CSS classes and a browser check, and the Nov 15 decision forbids new property tests. The E2E_Suite is neither a unit test nor a component test; it is a separate, opt-in check.

## Amendment: the Rite fits one screen, scroll reset, 320 px and names (Requirements 25 to 31)

Approved by the human. Presentation, scrolling, test tooling and names only: no scheduler, Outcome, timing, hint rule, storage or dataset change, and no file of Requirement 14.1 is touched (Requirement 31.1). Research was done by reading `App.tsx` (the `Shell` and the `view` switch), `SeanceSession.tsx`, `GhostPrompt.tsx`, `Credits.tsx`, `InkSurface.tsx`, `PracticeGrid.tsx`, `SummonStep.tsx`, `WriteMode.tsx`, `index.css`, `e2e/playwright.config.ts` and `e2e/no-horizontal-overflow.spec.ts`, and the tests that assert the old sizes (`SummonStep.test.tsx` lines about `min(60vw, 240px)`, `WriteMode.test.tsx` about `min(80vw, 420px)` and `surfaceSize`, `InkSurface.test.tsx`).

### Facts found in the current code

- `Shell` is `<main class="min-h-screen flex items-center justify-center px-4 py-6">`: 48 px of vertical padding and 32 px of horizontal padding.
- `SeanceSession` root is `flex flex-col gap-4 p-4 max-w-xl`: 32 px of vertical padding and 16 px gaps. Its children are the header row (the Leave_Button is `min-h-[44px]`), the Ghost_Card, the step label (`text-base`, 24 px), the step, and after a result a block with the result line and the "Next ghost" button (`py-3`, about 50 px).
- `GhostPrompt` is `p-4` with a `h-16 w-14` figure and `mb-2`, a "Meaning" label (`text-xs`), the meaning (`text-2xl`), `mt-3`, a "Pronunciation" label and the pinyin (`text-xl`): about 208 px for a one-line meaning.
- `SummonStep` is a column with `gap-3` and seven children: slots (`h-14`, 56 px), the surface (`min(60vw, 240px)`), the status (`min-h-[3rem]`), the keyboard (3 rows of 44 px with 2 px gaps: 136 px), two note lines, and "Give up" (`py-2`, about 42 px). Its keyboard width variable `--key-w` is `clamp(32px, calc((100vw - 2rem - 18px) / 10), 48px)`, written for a 2rem page margin although the real horizontal padding is 4rem.
- `WriteMode` is a column with `gap-3`: the surface (`min(80vw, 420px)`), the status (`min-h-[1.5rem]`), "Mistakes" (`text-sm`) and "Give up" (about 42 px).
- Both steps give hanzi-writer a pixel size from `surfaceSize(window.innerWidth)` that mirrors the CSS string. A height rule in CSS alone would make the paper smaller than the SVG that hanzi-writer draws, so the CSS and the SVG must use one number.
- `index.css` has no `scroll-behavior` declaration (only `scroll-padding-top`). `window.scrollTo(0, 0)` is therefore instant. No component calls `scrollTo` today.
- At 320 px, ten 32 px keys and nine 2 px gaps are 338 px wide, wider than the viewport.

### Height budget (CSS pixels)

| Part | Old | New |
| --- | --- | --- |
| Page padding (top and bottom) | 48 | 16 |
| Seance_Session padding | 32 | 16 |
| Header row (Leave_Button) | 44 | 44 |
| Ghost_Card | 208 | 72 (one-line meaning), 100 (two lines) |
| Step label | 24 | 20 |
| Gaps between those four parts | 48 | 24 |
| Slots | 56 | 48 |
| Summon_Surface | 240 | 160 at 1024 × 768, 150 at 375 × 812 |
| Status area | 48 | 40 |
| Keyboard (three rows) | 136 | 136 |
| Two note lines | 40 (one line each at 1024) | 36 at 1024, 48 at 375 (the first note wraps) |
| "Give up" | 42 | 44 |
| Gaps inside the Summon_Step (6) | 72 | 48 |
| **Total, Summon step** | about 1080 | about 704 at 1024 × 768 (64 spare), about 734 at 375 × 812 (78 spare) |

*(Amended (approved by the human): see first-meeting Requirement 10.3: while a Walkthrough_Line is shown, the Summon_Surface and the Writing_Surface formulas subtract a reserved `WALKTHROUGH_LINE_PX` (24) from the viewport height first, so the line takes room from the drawing surface and not from the controls; the table above is the budget without a Walkthrough_Line.)*

The Write step needs the surface plus 112 px (status 24, "Mistakes" 20, "Give up" 44, gaps 24): at 1024 × 768 the surface is 368 and the total is 192 + 368 + 112 = 672 (700 with a two-line card); at 375 × 812 it is 300. After a result, "Give up" is replaced by the result block (about 86 px plus a gap): the total is 714 at 1024 × 768 and 674 at 375 × 812, so "Next ghost" is visible too. The spare space is smallest in the Write step with a result and a two-line card at 1024 × 768: 742 of 768 px, so 26 px spare. At 375 × 812 the same step uses 674 of 812 px (138 spare), and the Summon step uses 734 (78 spare), which allows a three-line meaning.

### Decisions

| # | Decision | Reason |
| --- | --- | --- |
| F1 | The sizes are two pure functions in `app/src/engine/surfaceSize.ts`: `summonPaperSize(w, h) = round(max(96, min(0.4 * w, 160, h - 600)))` and `writeSurfaceSize(w, h) = round(max(200, min(0.8 * w, 420, h - 400)))`. Both the surface `div` (inline `width` in px) and hanzi-writer (`width`, `height`) read the value, computed once when the step mounts (`useState` initialiser or `useMemo`). | One number for the paper and the SVG. The paper still needs only to hold the forming character, so 160 px is enough (it was 240). Computing once matches today's behaviour (hanzi-writer is not recreated on resize). |
| F2 | The Summon constant 600 is the sum of everything else in the Summon step and its session at the tightest card (about 592 px, rounded up); the Write constant 400 is the same sum for the Write step with a result (about 300 px plus the result block and slack). The floors 96 and 200 keep the paper usable on very short screens. | They come from the budget table, not from a guess. On a screen shorter than the sum (for example 375 × 667) the page scrolls a little instead of shrinking the paper below a usable size. Only the two Rite_Viewports are required to fit. |
| F3 | `GhostPrompt` gets an optional prop `compact` (default `false`). `SeanceSession` passes `compact`. The non-compact markup stays as it is. | Existing `GhostPrompt` tests and any other caller keep working. The Compact_Card is a layout change, not a content change. |
| F4 | Compact_Card markup: a flex row with the figure (`h-10 w-9 shrink-0`) at the left and a text column (`min-w-0`) at the right; the labels "Meaning" and "Pronunciation" become `sr-only` paragraphs; meaning `text-xl`, pinyin `text-lg`. | The labels cost 32 px of height and carry no information that the position and the `lang` attribute do not. They stay in the accessibility tree. Meaning (20 px) and pinyin (18 px) stay readable. The ghost state classes (`data-ghost-state`, `.ghost-figure`) are unchanged, so the animations still work. |
| F5 | `Shell` gets a prop `compact`, set only for the `seance` screen: `px-2 py-2` and `min-h-[100dvh]` instead of `px-4 py-6` and `min-h-screen`. | With `px-2` and the session's `p-2`, the total horizontal padding is 32 px, which is the `2rem` that the `--key-w` formula already assumes. `100dvh` avoids the iOS Safari case where `100vh` is taller than the visible area and creates a scroll by itself. Other screens keep their padding. |
| F6 | The keyboard width variable moves from an inline style to the CSS class `.summon-keys` in `index.css`: `--key-w: clamp(32px, calc((100vw - 2rem - 18px) / 10), 48px)`, and below 370 px it is `calc((100vw - 2rem - 18px) / 10)`. **As built in task 24.3; approved by the human (narrower keys only below the width where 32px keys fit):** one rule, `.summon-keys { --key-w: clamp(min(32px, calc((100vw - 2rem - 18px) / 10)), calc((100vw - 2rem - 18px) / 10), 48px); }`, with no `@media (max-width: 359px)` block. | A media query cannot override an inline style, and a Tailwind arbitrary property with nested `calc` is hard to read. The existing `index.css.test.ts` requires exactly one `@media` block, so the narrow case is inside the `clamp` (its lower bound is the smaller of 32 px and the shared width). The file is already tested by `index.css.test.ts`, so the rule gets a test. No animation or `url()` is added, so the existing rules of Requirement 23.4 still hold. |
| F7 | **Deviation, as built in task 24.3; approved by the human (narrower keys only below the width where 32px keys fit).** Below 370 px the 32 px key width cannot hold: ten 32 px keys and nine gaps are 338 px, and the row has `100vw - 2rem` (328 px at 360 px). The keys then share the available width (27 px at 320 px, still above the 24 px minimum target size of WCAG 2.2 criterion 2.5.8; the height stays 44 px, in three rows). From 370 px up, the 32 px minimum of Requirement 8.3 holds, and the 375 px target keeps 32.5 px keys. | The Narrow_Phone width check must pass for the Summon step. Any alternative (a two-row layout, a horizontal scroll) would break the three-row shape of Requirement 8.1 and 8.2. |
| F8 | Scroll reset is one helper, `scrollToTop()` in `app/src/components/scrollToTop.ts`: it returns at once when `window.scrollTo` is not a function, else calls `window.scrollTo(0, 0)`. | One place to mock in tests, and the guard for Requirement 27.4. |
| F9 | Instant scrolling, always. The helper passes no `behavior`, and `index.css` has no `scroll-behavior`, so every motion setting gets an instant jump. A test reads `index.css` and fails if `scroll-behavior` appears. | A smooth scroll to the top on each screen change is motion that the player did not ask for, and Reduced_Motion users would need a second code path. A jump needs none. |
| F10 | `App` calls `scrollToTop()` in a `useLayoutEffect` keyed on `view.screen`. `SeanceSession` calls it inside `handleAdvance` for a "Next ghost" press (not for "Finish the séance", which ends in a screen change). | A parent layout effect runs after the children's layout effects and before every passive effect, so the new screen's `useEffect` focus moves run after the reset, and the focused control is not scrolled away. The existing focus moves stay as they are (Requirement 27.5). The reset on the initial `loading` render is harmless. |
| F11 | The Credits fix starts with a diagnosis at 320 × 640, as task 22.7 did. Likely suspects, to be checked and not assumed: the Fonts list items (the copyright text can hold a long URL; the `<li>` has no `WRAP`), the two Licensing paragraphs, and the header row (the `whitespace-nowrap` "Back to menu" button next to the title). The fix goes on the element the diagnosis names. | The cause is unknown (341 px measured). If the cause is in `App.tsx` (`Shell`), the task stops and reports, because `App.tsx` belongs to another task of the same group. |
| F12 | E2E: parameterised tests, not a second Playwright project. The width spec loops over `[375 × 812, 320 × 640]` and sets `test.use({ viewport })` inside each `describe`; the new height spec loops over `[1024 × 768, 375 × 812]`. The config file stays unchanged, with its 375 × 812 default. | The existing 375 test titles stay the same, a project would run every spec at both sizes (the height spec at 320 is meaningless), and the config needs no edit. |
| F13 | Shared helpers move to `e2e/helpers.ts` (`seed`, `seedState`, `datasetKeys`, `findOverflow(page, width)`, `boxInside`). `findOverflow` takes the limit as a parameter and keeps its thresholds (`> width + 0.5`, `< -0.5`, `scrollWidth > width`). | The two spec files would otherwise copy the helpers. Moving code with the same thresholds loosens nothing. |
| F14 | The scroll test needs something to scroll. Because the one-screen fit leaves no scrollable page, the test appends a 2000 px `div#scroll-spacer` to `document.body` (outside `#root`, so React never removes it), scrolls to 500 and first asserts `scrollY > 0`. | Without the spacer `scrollY` is 0 before and after, and the test could not fail. The precondition proves the spacer works. Height tests run without a spacer. |
| F15 | Names: `.kiro/specs/**/*.md` were changed with one replace of the approval phrase, `tasks.meta.json` untouched. The name token in tests is assembled from parts (for example `['Tak', 'shil'].join('')`), so the test files contain no name. | The rule has no exception, and a test that names the person to forbid the name would break it. |

### Size decisions in one place

| Viewport | `summonPaperSize` | `writeSurfaceSize` |
| --- | --- | --- |
| 1024 × 768 | 160 (40% of width 410, cap 160, height rule 168) | 368 (80% of width 819, cap 420, height rule 368) |
| 375 × 812 | 150 (40% of width 150) | 300 (80% of width 300) |
| 320 × 640 | 96 (floor; height rule 40) | 240 (height rule 240) |
| 1440 × 900 | 160 | 420 |

### Component changes

**`GhostPrompt.tsx`** (Requirements 25.4, 25.5):

```tsx
<section aria-label="Ghost's clue" data-ghost-state={ghostStateFor(outcome)}
  className={compact ? 'ghost-card flex items-center gap-3 rounded-lg bg-surface p-2 text-left'
                     : 'ghost-card rounded-lg bg-surface p-4 text-center'}>
  <GhostFigure className={compact ? 'ghost-figure h-10 w-9 shrink-0 text-ghost'
                                  : 'ghost-figure mx-auto mb-2 h-16 w-14 text-ghost'} />
  {compact ? (
    <div className="min-w-0">
      <p className="sr-only">Meaning</p>
      <p className="text-xl text-ink">{meaning}</p>
      <p className="sr-only">Pronunciation</p>
      <p lang="zh-Latn-pinyin" className="text-lg text-ghost">{record.prompt.pinyin}</p>
    </div>
  ) : ( /* existing markup */ )}
</section>
```

The never-reveal rule is unchanged: the masked meaning and the pinyin are the only text.

**`SeanceSession.tsx`** (Requirements 25.6, 27.2): root `gap-2 p-2`, `<GhostPrompt compact …>`, step label `text-sm`, and `scrollToTop()` as the first statement after the guard in `handleAdvance`'s next-ghost branch. The header, the Leave_Prompt, the focus effects and the result block are unchanged. The result block keeps its markup.

**`SummonStep.tsx`** (Requirements 25.2, 25.3, 25.7 to 25.9): `const [side] = useState(() => summonPaperSize(window.innerWidth, window.innerHeight))`; `InkSurface size={`${side}px`}`; hanzi-writer `width: side, height: side`; remove the local `surfaceSize`; root `gap-2`; slots `h-12 w-11`; status `min-h-[2.5rem] text-sm`; the two notes `text-xs`; "Give up" `min-h-[44px]`; the keyboard wrapper gets the class `summon-keys` instead of the inline `--key-w`. The fallback character stays inside the paper; its size `text-7xl` (72 px) is reduced to `text-6xl` (60 px) so it fits the smaller paper.

**`WriteMode.tsx`** (Requirements 26.2 to 26.5): the same pattern with `writeSurfaceSize`; root `gap-2`; "Give up" `min-h-[44px]`; `export function surfaceSize` is removed and its test moves to `surfaceSize.test.ts`.

**`App.tsx`** (Requirements 27.1, 25.6): `Shell` gets `compact`; `case 'seance'` renders `<Shell compact>`; `useLayoutEffect(() => { scrollToTop(); }, [view.screen])`.

**`index.css`** (Requirement 25.9): the `.summon-keys` rule and its media query, as F6.

**`Credits.tsx`** (Requirement 28): per F11, after the diagnosis.

### Tests (Vitest, jsdom; no property tests)

- `surfaceSize.test.ts`: the worked values of both functions at the four viewports above; the floors (very small heights give 96 and 200); the caps (very large viewports give 160 and 420); results are whole numbers; the paper never exceeds 40% of the width unless the floor applies.
- `scrollToTop.test.ts`: calls `window.scrollTo` once with `(0, 0)`; does nothing and does not throw when `window.scrollTo` is undefined.
- `index.css.test.ts`: `.summon-keys` holds the single `--key-w` clamp (as built in task 24.3: no `max-width: 359px` media query, because the test requires exactly one `@media` block); the file contains no `scroll-behavior`; the existing animation, `url()` and token tests pass unchanged.
- `GhostPrompt.test.tsx`: with `compact`, the section has the compact classes, the figure is `h-10`, "Meaning" and "Pronunciation" exist as `sr-only` text, the pinyin keeps its `lang`, and the target character never appears; without `compact`, every existing assertion passes unchanged.
- `SummonStep.test.tsx`: the surface width is `${summonPaperSize(innerWidth, innerHeight)}px` and hanzi-writer receives the same number as `width` and `height` (set `window.innerWidth` and `innerHeight` for two viewports); the keyboard wrapper has the class `summon-keys`; the status area has `min-h-[2.5rem]`; "Give up" has `min-h-[44px]`. Hold, fade, hint and never-reveal assertions are unchanged (Requirement 31.3).
- `WriteMode.test.tsx`: the same for `writeSurfaceSize`; "Give up" has `min-h-[44px]`.
- `SeanceSession.test.tsx`: `window.scrollTo` is mocked; pressing "Next ghost" calls it once with `(0, 0)`; finishing the last ghost does not call it from the session; the Compact_Card is used (`ghost-card` has `p-2`); the focus tests pass unchanged.
- `App.test.tsx`: `window.scrollTo` is mocked; each screen change (menu, graveyard, back to menu, séance) adds a call with `(0, 0)`, asserted as a relative increase so that the session's own calls do not break the count; the séance screen's `main` has `px-2`.
- `Credits.test.tsx`: the element named by the diagnosis carries the Wrap_Class.
- jsdom cannot lay out or scroll, so the real fit is checked by the E2E_Suite.

### E2E extension (Requirements 29.1 to 29.9)

```
e2e/
├── playwright.config.ts            (unchanged)
├── helpers.ts                      (new: seed, seedState, datasetKeys, findOverflow(page, width), boxInside)
├── no-horizontal-overflow.spec.ts  (loops over 375 × 812 and 320 × 640)
└── fits-one-screen.spec.ts         (new: heights and scroll reset at 1024 × 768 and 375 × 812)
```

- **Width spec.** The five screen tests and the guard test move inside `for (const vp of [375 × 812, 320 × 640])` with `test.use({ viewport: vp })`. The describe title keeps the form "no horizontal overflow at 375 px", so the existing 375 test names do not change. `expectViewport` compares with the loop's `vp`. At 320 the Summon step needs the F6 rule and the Credits fix; if another screen overflows at 320 (the Graveyard grid or the Cangjie_Guide are the likely ones), the task stops and reports it instead of changing the app.
- **Height spec.** For each of `1024 × 768` and `375 × 812`:
  1. *Summon step fits.* Seed both intro flags, open the menu, press "Begin a Nightly Séance", wait for the region "Summon step". Without scrolling, check with `boxInside` (top ≥ 0, bottom ≤ `innerHeight`, left ≥ 0, right ≤ `innerWidth`) the button "Leave séance", the text "Step 1 of 2: Summon", the region "Ghost's clue", the list "Cangjie code", `getByTestId('ink-surface')`, every button inside `[data-row="2"]`, and the "Give up" button of the Summon step. The last row's bottom is the one the requirement names. Also `document.documentElement.scrollHeight <= innerHeight`.
  2. *Write step fits.* Press "Give up" in the Summon step, wait for the region "Write mode" (timeout 10 s), and check "Leave séance", the write `ink-surface`, the "Give up" button, and `scrollHeight <= innerHeight`.
  3. *Next ghost fits.* Press "Give up" in the Write step (wait until it is enabled), wait for "Next ghost", and check it is inside the viewport.
  4. *Scroll reset.* Seed, start the séance, append `div#scroll-spacer` (2000 px) to `document.body`, `window.scrollTo(0, 500)`, assert `scrollY > 0`, press "Give up" in both steps, press "Next ghost", and assert `scrollY === 0` (poll with `expect.poll` for up to 2 s, because the reset runs in the click handler and the assertion could otherwise race the re-render).
- **Guard.** The existing guard test stays and runs in the width loop.
- **Nothing loosened.** Existing thresholds (`375.5`, `-0.5`, `scrollWidth > width`) and the five screen tests keep their behaviour. The new `scrollHeight` check is an addition.
- **README.** The e2e subsection is reworded to "five screens at 375 and 320 px and the one-screen fit at 1024 × 768 and 375 × 812" (Requirement 29.9). It stays free of claims about download size or run time.

### Names cleanup (Requirement 30)

- **Specs (done in this pass).** Every `approved by <name>` in `.kiro/specs/**/*.md` now reads `approved by the human`. `tasks.meta.json` files are not edited. Task IDs are derived from titles, so a title that changed gets a new ID: the three top-level titles of this spec's `tasks.md` (groups 13, 21 and 22) changed, and the old IDs stay in `tasks.meta.json` as orphans until Kiro rewrites the file. No title of another spec changed (the other replacements are in requirements, design and notes).
- **Data and tests (a task).** `data/prompt-overrides.csv` (49 rows, column `reviewedBy`) and the rows built in `tests/unit/build-override-errors.test.ts` change to `human-approved`; `data/prompt-review.csv` is regenerated by `npm run build:data` and changes only in `reviewedBy`; `app/public/data/characters.json` must be byte-identical (SHA-256 before and after). `tests/unit/oracle-power.test.ts` keeps its "personal names" test with a token assembled from parts. A new `tests/unit/no-personal-names.test.ts` lists the tracked files with `git ls-files`, skips `kiro-log.md`, `.kiro/steering/**` and `tasks.meta.json`, and fails if any other text file contains the token (case-insensitive).
- **Not touched.** `kiro-log.md` and the steering files (the human edits them), and any `tasks.meta.json`.

### Impact on existing code and tests

| Item | Change | Task |
| --- | --- | --- |
| `app/src/engine/surfaceSize.ts` and test | new | 24.1 |
| `app/src/components/scrollToTop.ts` and test | new | 24.2 |
| `index.css`, `index.css.test.ts` | `.summon-keys` rule; no `scroll-behavior` test | 24.3 |
| `GhostPrompt.tsx`, `GhostPrompt.test.tsx` | `compact` prop | 24.4 |
| `SummonStep.tsx`, `SummonStep.test.tsx` | pixel size, spacing, key class; size assertions change | 24.5 |
| `WriteMode.tsx`, `WriteMode.test.tsx` | pixel size, spacing; `surfaceSize` assertions move | 24.6 |
| `SeanceSession.tsx`, tests | compact card, spacing, scroll reset | 24.7 |
| `App.tsx`, `App.test.tsx` | `Shell compact`, layout effect | 24.8 |
| `Credits.tsx`, `Credits.test.tsx` | 320 px fix | 24.9 |
| `data/prompt-overrides.csv`, `data/prompt-review.csv`, three test files | names | 24.10 |
| `e2e/helpers.ts`, `e2e/no-horizontal-overflow.spec.ts` | shared helpers, 320 loop | 24.11 |
| `e2e/fits-one-screen.spec.ts`, `README.md` | new height spec, README wording | 24.12 |
| `InkSurface.tsx`, `PracticeGrid.tsx`, `e2e/playwright.config.ts`, `kiro-log.md`, files of Requirement 14.1, `characters.json` | unchanged | none |

`InkSurface.test.tsx` keeps its test with the string `min(60vw, 240px)`, because the component still accepts any CSS length; only the two modes stop passing that string.

Property-based testing does not apply to this amendment: the sizes are simple arithmetic checked by example at the four viewports, the rest is markup, scrolling and a browser check, and the Nov 15 decision forbids new property tests.
