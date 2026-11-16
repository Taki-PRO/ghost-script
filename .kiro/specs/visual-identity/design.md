# Design Document: visual-identity

## Overview

This feature is visual only. It adds one pure engine module for the Graveyard, one tiny pure module for ghost states, a handful of presentational components, CSS in `index.css`, and a size check script. It changes no game rule (Requirement 14).

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

Each of these is approved by Takshil. None is open.

| # | Decision | Effect |
| --- | --- | --- |
| 1 | Chinese text uses the Chinese_Font_Stack: `"PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Serif CJK SC", sans-serif`. No other CJK stack. | Requirement 12.3; `hanzi` font family; `[lang='zh']` rule. |
| 2 | Cormorant Garamond, weight 600, Latin subset, `font-display: swap`. | Requirement 12.2; task 1.2. |
| 3 | Bibliographic names in citations and credits are allowed, as `.kiro/steering/structure.md` says. | The Huainanzi and Wikipedia citations may name authors and historical figures (for example Chu Bong-Foo, D. C. Lau, Michael Puett, Cangjie). Personal names stay out of repo files, except "approved by Takshil". |
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

Replace the surface `<div>` with `InkSurface`, size `min(80vw, 420px)` (unchanged). Pass `strokeColor: theme.inkOnPaper`, `outlineColor: theme.gridLine`, `highlightColor: theme.seal`, `drawingColor: theme.drawing`, `drawingWidth: 5`. `showOutline` stays `false`. Nothing else changes: not the quiz options, callbacks, outcome logic, or messages.

### `modes/SummonStep.tsx` changes (Requirement 8)

- **Keyboard.** Each row becomes a CSS grid, not a wrapping flex row:
  ```tsx
  <div role="group" data-row={i} className="grid justify-center gap-[2px]"
       style={{ gridTemplateColumns: `repeat(${row.length}, var(--key-w))` }}>
  ```
  with `--key-w` defined once on the keyboard wrapper as `clamp(32px, calc((100vw - 2rem - 18px) / 10), 48px)`. At 375 px wide that is (375 - 32 - 18) / 10 = 32.5 px, so row 1 (10 keys, nine 2 px gaps) fits inside the Shell's `px-4` padding. Rows 2 and 3 use the same column width and are centred, which gives the staggered keyboard shape. Key buttons keep `min-h-[44px]`, `w-full`, `min-w-0`, and the same `aria-label`s. No `flex-wrap`.
- **Fixed surface.** `InkSurface` is rendered in every phase with size `min(60vw, 240px)`. It replaces `hidden` on the container. `surfaceSize()` in the file stays and still feeds hanzi-writer.
- **Slots.** The code slot list uses `flex-nowrap`; 5 slots of 48 px plus gaps is 272 px, less than 343 px.
- **Status area.** The `role="status"` paragraph gets `min-h-[3rem]` (two lines at the current text size), so a longer message does not push the keyboard.
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

- `scheduler.ts`, `config.ts`, `outcome.ts`, `learningOrder.ts`, `cangjie.ts`, `storage.ts` and `characters.json` stay untouched (checked with `git diff --stat` in the final checkpoint).
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
