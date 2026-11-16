# Implementation Plan: visual-identity

## Overview

Build the visual layer in small steps: theme tokens, font and CSS first; then the two pure engine modules, the data modules and the third-party notices; then the ink surface, ghost card, Graveyard and Credits components; then wire the screens into `App`. Documentation, the accuracy review, a human phone check and the final checks come last. The design is TypeScript, so no language question applies. Each task includes its own unit or component tests. Do not touch `app/public/data/characters.json` or any file listed in Requirement 14.1.

## Tasks

- [x] 1. Foundations: tokens, font, CSS
  - [x] 1.1 Add theme tokens, Tailwind colours and font families
    - In `app/src/styles/theme.ts` add `paper`, `inkOnPaper`, `drawing`, `seal`, `gridLine`, `graveRestless`, `graveRest`, `graveWisp` (values accepted in the design; adjust a hex only if a contrast test fails, to reach 4.5:1)
    - In `app/tailwind.config.ts` add the colours, the `display` family and the `hanzi` family set to exactly the Chinese_Font_Stack, in that order (`"PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Serif CJK SC", sans-serif`); no other CJK stack anywhere
    - Extend `app/src/styles/theme.test.ts`: contrast at least 4.5:1 for `inkOnPaper`, `drawing` and `seal` on `paper`, and for `ink`/`ghost` text on each grave background
    - _Requirements: 2.5, 12.3, 13.3_
  - [x] 1.2 Add the Latin display font
    - Run `npm install -w app --save-exact @fontsource/cormorant-garamond@5.3.0`; add `import '@fontsource/cormorant-garamond/latin-600.css'` to `app/src/main.tsx` (weight 600, Latin subset, `font-display: swap`; no other weight or subset)
    - Confirm the package `LICENSE` is the SIL OFL 1.1 and note its copyright line for task 8.1 (task 3.2 copies the licence text into the notices file); confirm no CJK font file and no third-party URL is added
    - Note: package LICENSE is SIL OFL 1.1; copyright line: "Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant)"
    - _Requirements: 12.1, 12.2, 12.4, 16.3_
  - [x] 1.3 Add paper, ghost and grave styles to `app/src/styles/index.css`
    - `:root` palette variables, `.ink-paper` (gradients plus one inline SVG noise `data:` URI), `[lang='zh']` font rule with the exact Chinese_Font_Stack (`"PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Serif CJK SC", sans-serif`), `.grave*` shapes, static `[data-ghost-state]` end states, and all keyframes inside one `@media (prefers-reduced-motion: no-preference)` block (float, fade 1.5 s, flicker 1.2 s ending at 0.5, drift 2 s, grave flicker)
    - Add `app/src/styles/index.css.test.ts` as in the design (animations only inside the no-preference block; palette equals `theme.ts`; end states exist; the `[lang='zh']` rule holds the exact stack and equals the Tailwind `hanzi` family)
    - _Requirements: 2.1, 2.2, 3.5, 4.1, 4.2, 4.3, 4.4, 7.9, 12.3, 13.1_

- [x] 2. Pure engine modules
  - [x] 2.1 Create `app/src/engine/graveyard.ts` and `graveyard.test.ts`
    - Export `GraveState`, `UnmetGrave`, `MetGrave`, `Grave`, `GraveyardModel`, `classifyEntry`, `cleanStreak`, `buildGraveyard` exactly as in the design; import only `nextDue` and the types from `scheduler.ts`
    - Tests: every rule row using the real `applyReview`, the `nextDue === now` boundary, non-finite and negative `nextDue`, streak cases, order equals `learningOrder`, counts sum to size, unknown keys ignored, unmet graves have no `char`, prototype-safe lookup
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_
  - [x] 2.2 Create `app/src/engine/ghostVisual.ts` and `ghostVisual.test.ts`
    - `ghostStateFor(outcome: Outcome | null): GhostState` with the four mappings; no other parameter
    - _Requirements: 4.5, 4.7_

- [x] 3. Data modules
  - [x] 3.1 Create `app/src/data/citations.ts`, `app/src/data/credits.ts` and `credits.test.ts`
    - `citations.ts`: `CANGJIE_CITATIONS` (the two entries now in `CangjieGuide`) and `LEGEND_SOURCE` with the citation copied exactly from the "Approved legend line" section of `.kiro/steering/content-accuracy.md`
    - `credits.ts`: `DATA_SOURCES` (the five README table rows, same wording), `COMBINED_WORK_NOTE`, `CODE_LICENCE`, `FONTS` (Cormorant Garamond, SIL Open Font License 1.1)
    - Tests: non-empty fields, `https://` URLs, both Wikipedia titles and URLs
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6_
  - [x] 3.2 Create `scripts/build-notices.ts`, the `build:notices` script, the committed notices file and `tests/unit/third-party-notices.test.ts`
    - Export `collectRuntimePackages`, `renderNotices`, `runtimeSummary` and the types as in the design; `main()` under the direct-execution guard renders first, then writes `app/public/THIRD_PARTY_NOTICES.txt`; on a missing licence file or licence identifier, print the package name, exit 1 and write nothing
    - Walk the production dependency tree of `app/package.json` (`dependencies` and `optionalDependencies`, recursively; never `devDependencies` or `peerDependencies`), resolving up the `node_modules` chain; copy every `LICENSE*`, `LICENCE*` and `COPYING*` file verbatim; sort by name and file name with code-unit comparison; no timestamps or paths
    - Add `"build:notices": "tsx scripts/build-notices.ts"` to the root `package.json`, run it once, and commit the generated file (it needs task 1.2 first so the font's OFL text is included)
    - Tests: the six cases listed in the design (up to date, deterministic, complete including the OFL text, fixture-tree behaviour); the "Credits match" case is added by task 3.3
    - _Requirements: 12.3, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9_
  - [x] 3.3 Create `app/src/data/software.ts` and its test
    - Export `SOFTWARE_CREDITS` (name, version, licence), ascending by name, one entry per package in the notices file (react, react-dom, hanzi-writer, scheduler, loose-envify, js-tokens, `@fontsource/cormorant-garamond`, with the versions and identifiers from the generated file)
    - Add the "Credits match" test to `tests/unit/third-party-notices.test.ts`: `SOFTWARE_CREDITS` equals the packages parsed from the headers of the committed file; add `app/src/data/software.ts` to the root `tsconfig.json` `include`
    - _Requirements: 16.10_

- [x] 4. Ink surface and the two modes
  - [x] 4.1 Create `PracticeGrid.tsx`, `InkSurface.tsx` and their tests
    - `PracticeGrid`: no props, SVG with five line groups, `aria-hidden`, `pointer-events-none`, opacity 0.25
    - `InkSurface`: paper wrapper with the grid and the hanzi-writer container, fixed `size`, never `display: none`, `touch-action: none` kept
    - Tests as listed in the design
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 8.4_
  - [x] 4.2 Update `app/src/modes/WriteMode.tsx` and its tests
    - Render the surface through `InkSurface` (size `min(80vw, 420px)`, same `role` and `aria-label`); pass `strokeColor`, `outlineColor`, `highlightColor`, `drawingColor`, `drawingWidth` from the palette; change no quiz option, callback or message
    - Extend `WriteMode.test.tsx` to check the colours given to the mocked `HanziWriter.create`, and that the hint message text still appears
    - _Requirements: 1.1, 2.3, 2.5, 2.6, 14.3_
  - [x] 4.3 Update `app/src/modes/SummonStep.tsx` and its tests
    - Three grid rows with `--key-w: clamp(32px, calc((100vw - 2rem - 18px) / 10), 48px)`, no `flex-wrap`; `InkSurface` (size `min(60vw, 240px)`) present in every phase instead of the `hidden` class; the fallback character inside the surface; slots `flex-nowrap`; status `min-h-[3rem]`; stroke colour from the palette
    - Update tests that looked for the `hidden` class; add the layout tests from the design; existing never-reveal and hint tests must pass unchanged
    - When a test fixture needs a Cangjie code, get it from the `cangjie-oracle` `lookup` tool; do not type a code by hand
    - _Requirements: 1.2, 2.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 14.3_

- [x] 5. Ghost card
  - [x] 5.1 Update `GhostPrompt.tsx`, `SeanceSession.tsx` and their tests
    - `GhostPrompt` gets the optional `outcome` prop, `data-ghost-state`, and the inline SVG `Ghost_Figure` (no text element, `aria-hidden`); `SeanceSession` passes `result` as `outcome`; keep the target masking and the result text and Next button timing
    - Tests: state per outcome, target absent from `innerHTML` in every state, no `<text>` in the figure, clue text has no opacity style, result text and Next button present immediately
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 4.5, 4.6, 5.1, 5.2_

- [x] 6. Screens
  - [x] 6.1 Create `app/src/components/Graveyard.tsx` and `Graveyard.test.tsx`
    - Props `dataset`, `history`, `now`, `onBack`; render from `buildGraveyard(learningOrder(dataset), history, now)` with markers `·`, `!`, `✓`, shapes via the `.grave-*` classes, accessible names, legend with counts, empty-history line, Back button
    - Tests: one item per record; with an empty history the HTML contains none of the characters; mixed history shows glyphs, markers and names; no glyph in any unmet label; Back button
    - _Requirements: 5.3, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 13.2, 13.4_
  - [x] 6.2 Create `app/src/components/Credits.tsx` and `Credits.test.tsx`
    - Render sections from `credits.ts`, `citations.ts` and `software.ts`: sources table, licensing, legend with citation, Cangjie citations as text, fonts and the installed-fonts sentence, a "Software" section (table of name, version, licence for every `SOFTWARE_CREDITS` row) and Back button; URLs stay text, and the only link is "Full licence texts (THIRD_PARTY_NOTICES.txt)" with `href` built from `import.meta.env.BASE_URL`
    - Tests as listed in the design, plus: every Software row is visible; exactly one `<a>` exists and its `href` ends with `THIRD_PARTY_NOTICES.txt`
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9, 9.10, 13.2, 16.11_
  - [x] 6.3 Reword `CangjieGuide.tsx` and update `CangjieGuide.test.tsx`
    - New sentence and the visible heading "The 25 keys in this game" with `aria-labelledby`; import `CANGJIE_CITATIONS` from `data/citations.ts` and delete the local copy
    - Tests assert the new strings and that the old ones are gone
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 6.4 Add the two buttons to `StartMenu.tsx` and update `StartMenu.test.tsx`
    - New props `onOpenGraveyard` and `onOpenCredits`; buttons "Graveyard" and "Credits" after "How Cangjie works", same classes; update the count and order assertions
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [x] 6.5 Wire the screens in `App.tsx` and update `App.test.tsx`
    - Add the `graveyard` and `credits` views; the graveyard case reads `loadState().history` and `Date.now()`; Back returns to the menu; `StartMenu` gets the two callbacks
    - Tests: Menu → Graveyard → Back and Menu → Credits → Back
    - _Requirements: 5.4, 7.1, 9.1, 11.2, 11.3_

- [x] 7. Bundle size check
  - [x] 7.1 Create `scripts/check-bundle-size.ts`, the root script and `tests/unit/bundle-size.test.ts`
    - Export `summariseBundle`, `BUNDLE_BUDGET_BYTES` (300000) and the types; `main()` under the direct-execution guard walks `app/dist`, gzips each file at level 9, excludes `data/characters.json`, prints total and five largest, exits 1 when over budget or when `app/dist` is missing
    - Add `"check:bundle": "tsx scripts/check-bundle-size.ts"` to the root `package.json`
    - Tests: under, at and over budget; exclusion of `characters.json`; top five only
    - _Requirements: 12.6, 12.7, 12.8_

- [ ] 8. Documentation
  - [x] 8.1 Update `README.md` and add `tests/unit/credits-readme.test.ts`
    - Replace the "Fonts" bullet in "Data and licences" with the record from the design (name, package and exact version, SIL OFL 1.1, copyright line from the package `LICENSE`) and a sentence that Chinese text uses the device's fonts; add a "Legend source" bullet with the citation exactly as in `content-accuracy.md`; add a "Third-party notices" bullet naming `app/public/THIRD_PARTY_NOTICES.txt`, the `npm run build:notices` command and that the file is committed and checked by a test
    - Add `app/src/data/credits.ts` and `app/src/data/citations.ts` to the root `tsconfig.json` `include`
    - Test: README table rows equal `DATA_SOURCES`; README font line matches `FONTS`; `LEGEND_SOURCE` citation appears in the README and in `content-accuracy.md`
    - _Requirements: 9.8, 12.5, 15.4, 16.6_
  - [~] 8.2 Add entries to `kiro-log.md`
    - One entry per Kiro feature used here (Specs, Steering, MCP oracle, Custom agent), dated the day the task runs, with the font decisions (Latin display font bundled, system Chinese font stack) and their size numbers, the committed third-party notices decision, and the outcome of the accuracy review from task 9.1
    - Write "the human" or "a human" for people; use "approved by Takshil" only for approvals
    - _Requirements: 15.2_

- [x] 9. Accuracy review
  - [x] 9.1 Run the `accuracy-reviewer` agent over all new copy and fix findings
    - Files to review: `app/src/components/Credits.tsx`, `Graveyard.tsx`, `CangjieGuide.tsx`, `app/src/data/credits.ts`, `app/src/data/citations.ts`, `app/src/data/software.ts`, the README changes, and this spec folder
    - Third review: the reviewer found three wording overstatements. (1) `LEAVE_TEXT_NOT_SAVING` said "is not saving progress", which is false when one write failed and later writes succeeded. Changed to "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost." in `SeanceSession.tsx`, its tests (`SeanceSession.test.tsx`, `App.test.tsx`), Req 18.2b, the Leave_Prompt glossary entry, the design Leave section and tasks 21.2 and 21.3; resolves an accuracy finding. (2) ghost-game-core AC 1.5 now says finished ghosts "may be lost" on leaving. (3) ghost-game-core AC 7.6 now says a failed write persists nothing and earlier successful writes stay saved
    - Fix each finding within this spec's scope; re-run until it reports `No findings`; record anything that needs a decision from a human in the task notes instead of changing steering
    - _Requirements: 9.7, 15.2_

- [ ] 10. Manual check by a human (non-coding)
  - [~] 10.1 Human check of the phone layout at 375, 768 and 1440 px
    - This task is NON-CODING and is performed by a human, not by Kiro. Kiro runs nothing for it and does not write its `kiro-log.md` entry; the human records the result in `kiro-log.md` themselves
    - Open the built or dev app at viewport widths of 375, 768 and 1440 px (a phone or the browser's device mode). Check that: the Summon keyboard keeps three rows with no wrapping and nothing moves while typing, forming and fading; the code slots stay on one row; the Graveyard grid reflows with no horizontal scroll; the Credits page, its Software table and the licence-texts link fit and work; text is readable
    - _Requirements: 7.10, 8.2, 8.3, 8.4, 8.7_

- [x] 11. Final checkpoint - Verify the whole change
  - Run the root `npm test`
  - Run `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json` and `npx tsc -p oracle/tsconfig.json`
  - Run `npm run build -w app`, then `npm run check:bundle` (the notices file is in `app/public`, so it is counted)
  - Run `npm run build:notices` and confirm `git diff` shows no change to `app/public/THIRD_PARTY_NOTICES.txt`
  - Confirm `git diff --stat` shows no change to `app/public/data/characters.json`, `scheduler.ts`, `config.ts`, `outcome.ts`, `learningOrder.ts`, `cangjie.ts` or `storage.ts`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 14.1, 14.2, 14.3, 15.3, 16.8_

- [x] 12. Post-outcome polish (requested by the human)
  - [x] 12.1 Single result line and hidden Give up
    - In `app/src/modes/WriteMode.tsx`, make `onComplete` set an empty status line; keep the Give-up message "The ghost reveals itself"; render "Give up" disabled while loading and remove it once the outcome is reached
    - In `app/src/modes/SummonStep.tsx`, render "Give up" only in the typing phase; remove it in the forming and fading phases; add no focus code
    - Update `WriteMode.test.tsx` and `SummonStep.test.tsx`; update `SeanceSession.test.tsx` and `App.test.tsx` wherever they look for the old WriteMode "Laid to rest" text or a disabled Give up (assert one result line from `SeanceSession` and no Give up button instead)
    - Change no scheduling, Outcome, hint or timing code, and no file in Requirement 14.1
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 14.3_

- [x] 13. Night scene foundations (tester feedback, approved by Takshil)
  - [x] 13.1 Add night and candle tokens, Tailwind colours and contrast tests
    - In `app/src/styles/theme.ts` add `nightTop`, `nightMid`, `nightLow`, `mist`, `moon`, `candle` with the proposed hex values of the design; adjust a hex only to pass a test, never a text token
    - In `app/tailwind.config.ts` add the colours `night-top`, `night-mid`, `night-low`, `mist`, `moon`, `candle` and `boxShadow.candle` (`0 0 20px rgba(240, 184, 102, 0.35)`)
    - Extend `app/src/styles/theme.test.ts`: each text token (`ink`, `muted`, `ghost`, `success`, `error`) at least 4.5:1 on `nightTop`, `nightMid` and `nightLow`; `candle` at least 3:1 on `nightTop`, `nightLow` and `background`; `background` on `candle` at least 4.5:1; `ink` and `muted` on `nightTop` at least 4.5:1; `nightTop` is the darkest and `nightLow` the lightest stop by luminance
    - _Requirements: 21.2, 21.6, 21.7, 21.8, 19.8_
  - [x] 13.2 Add the night scene, moon glow, candle focus rule and scroll padding to `app/src/styles/index.css`, with CSS tests
    - Add the `:root` variables (`--night-top`, `--night-mid`, `--night-low`, `--mist`, `--moon`, `--candle`, `--mist-peak-alpha` 0.05, `--moon-peak-alpha` 0.06), `html { scroll-padding-top: 5rem }`, the three fixed pseudo-elements (`body::before`, `body::after`, `#root::before`) with `pointer-events: none`, `#root { position: relative; z-index: 1 }`, `.moon-glow`, and `*:focus-visible { --tw-ring-color: var(--candle) !important; }`
    - Extend the one existing `@media (prefers-reduced-motion: no-preference)` block with `mist-drift-a` (120 s), `mist-drift-b` (180 s) and `.menu-figure` (reuse `ghost-float`); add no second block and no animation outside it
    - Extend `app/src/styles/index.css.test.ts`: variables equal the tokens of `theme.ts` (and the mist and moon channel triples equal their hex); every `animation` and `@keyframes` lies inside the single no-preference block; every `url(` is followed by `data:` (with or without a quote); `scroll-padding-top` is at least 4rem; the three pseudo-elements set `pointer-events: none`; the focus rule sets `--tw-ring-color` to `var(--candle)`; worst-case composite contrast (lightest stop, both mist layers at peak, then the moon glow at peak) at least 4.5:1 for every text token; periods of both mist animations at least 90 s
    - If the composite test fails, lower the two alpha variables or darken `mist` or `moon` (this may need a one-line change to `theme.ts` by the same task); never change a text token
    - Needs task 13.1
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.9, 21.10, 21.12, 19.6, 23.4_

- [x] 14. Shared ghost figure
  - [x] 14.1 Create `GhostFigure.tsx` and use it in `GhostPrompt.tsx`
    - New `app/src/components/GhostFigure.tsx` with the SVG of the design (same path, `aria-hidden`, `focusable="false"`, no text element, eyes filled with `theme.background`, optional `className`); `GhostPrompt.tsx` renders `<GhostFigure className="ghost-figure mx-auto mb-2 h-16 w-14 text-ghost" />` in place of its inline SVG; change nothing else in `GhostPrompt`
    - Add `GhostFigure.test.tsx` (aria-hidden, unfocusable, no `<text>`, identical markup in two renders); `GhostPrompt.test.tsx` must pass without change to its assertions
    - _Requirements: 22.3, 22.4, 3.1, 3.2, 3.3, 5.2_

- [x] 15. Start menu
  - [x] 15.1 Rename the button to "Sources & licences" and add the caption in `StartMenu.tsx`
    - Button text `Sources &amp; licences` (accessible name "Sources & licences"); wrap it with the caption `<p id="menu-sources-hint">` reading exactly "Where the words, strokes, codes and fonts come from." in `text-sm text-muted`; give the button `aria-describedby="menu-sources-hint"`; keep the prop name `onOpenCredits` and every other button as is
    - Update `StartMenu.test.tsx`: the five names in order end with "Sources & licences"; accessible description equals the caption; the caption text is exact; the button calls `onOpenCredits` once and no other callback; no visible text or name matches `/\bcredits\b/i`
    - _Requirements: 20.1, 20.3, 20.4, 20.5, 20.6, 20.7, 11.1, 11.5_
  - [x] 15.2 Build the menu entrance in `StartMenu.tsx`
    - Hero wrapper `moon-glow` holding `<GhostFigure className="menu-figure mb-4 h-24 w-20 text-ghost" />` above the `h1` "Ghost Script" (`font-display text-5xl font-semibold tracking-wide sm:text-7xl`); main button `bg-candle text-background shadow-candle`; remove `bg-background` from the wrapper `<main>`; keep order and callbacks of the five buttons
    - Extend `StartMenu.test.tsx`: the figure precedes the `h1` in document order and is `aria-hidden`; one `h1`, with `font-display` and `text-5xl`; the main button has `bg-candle`; the wrapper has no `bg-background`
    - Needs tasks 13.1, 13.2, 14.1 and 15.1
    - _Requirements: 21.4, 21.5, 21.11, 22.1, 22.2, 22.5, 22.6_

- [x] 16. Sticky headers (Graveyard and Sources & licences)
  - [x] 16.1 Rename the heading and add the sticky header in `Credits.tsx`
    - `<header className="sticky top-0 z-20 -mx-4 flex min-h-[64px] items-center justify-between gap-3 border-b border-muted/40 bg-night-top px-4 py-2">` as the first child of the content container, holding the `h1` (id `credits-title`, text "Sources & licences", `min-w-0 font-display text-2xl sm:text-3xl`) and the "Back to menu" button (`shrink-0 whitespace-nowrap`, 44 px, focus ring); delete the bottom button; drop `bg-background` and the top padding of `<main>`
    - Update `Credits.test.tsx`: heading and landmark name "Sources & licences"; no `/\bcredits\b/i` in the rendered text; exactly one "Back to menu" button, inside the same `<header>` as the `h1`; header classes include `sticky`, `top-0` and `bg-night-top`; `onBack` once; existing section, table and link tests unchanged
    - Needs task 13.1
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.7, 20.2, 20.3, 21.11, 9.9_
  - [x] 16.2 Add the sticky header to `Graveyard.tsx`
    - Same `<header>` structure with the `h1` "Graveyard"; delete the bottom button; drop `bg-background` and the top padding of `<main>`; keep the intro line, legend, empty-history line and grid unchanged
    - Update `Graveyard.test.tsx`: exactly one "Back to menu" button, inside the `<header>` with the `h1`; header classes as in 16.1; `onBack` once; all existing grave, legend and glyph tests pass unchanged
    - Needs task 13.1
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.7, 21.11, 7.11_

- [x] 17. Leave séance
  - [x] 17.1 Add the Leave_Button and Leave_Prompt to `SeanceSession.tsx` and replace the old rule test
    - New required prop `onLeave`; top row with the "Leave séance" button (`aria-expanded`, `aria-controls="leave-prompt"`) and the "Ghost N of M" heading; inline `role="group"` prompt named by its question "Leave now? Ghosts you've finished are saved." (made conditional by task 21) with "Leave" and "Stay"; focus to "Stay" on open; "Stay" and Escape (on the group) close it and return focus to the Leave_Button; "Leave" sets a `leftRef` and calls `onLeave` once; `handleOutcome` and `handleSummonDone` return at once when `leftRef` is set; skip the "focus Next ghost" effect while the prompt is open; call `window.confirm`, `alert` and `prompt` nowhere
    - In `SeanceSession.test.tsx` replace the test "has no legend or menu control during the session" with the tests listed in the design (button present in every state and first in the DOM; no legend, guide, Graveyard, Sources or "Back to menu" button before and after an Outcome; prompt text, role, name and `aria-expanded`; no `window.confirm` call; focus moves; Stay and Escape; Leave once; late emit after Leave calls nothing; leave after a finished Summon step calls `onOutcome` zero times; Outcome while the prompt is open is reported once and focus stays); update the shared `setup` to pass `onLeave`
    - Do not change `onOutcome`, `onComplete`, the Outcome rules or any timing
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11, 18.12, 23.3_
  - [x] 17.2 Wire `onLeave`, make the Shell transparent and update `App.test.tsx`
    - In `App.tsx` pass `onLeave={() => setView({ screen: 'menu', dataset })}` to `SeanceSession`; remove `bg-background` from the `Shell` `<main>` (keep `text-ink`)
    - In `App.test.tsx`: open the Sources screen by the name "Sources & licences" and expect the heading "Sources & licences"; add: finish ghost 1, start ghost 2, press "Leave séance" then "Leave", see the menu, and check `loadState().history` has ghost 1 and not ghost 2; pressing "Stay" keeps the séance on screen
    - Needs tasks 15.1, 16.1 and 17.1
    - _Requirements: 18.7, 18.8, 20.7, 21.11, 5.4_

- [x] 18. Remaining page wrappers
  - [x] 18.1 Make the wrappers of the intro, guide and summary transparent
    - Remove `bg-background` from the wrapper `<main>` of `IntroScreen.tsx`, `CangjieGuide.tsx` and `SessionSummary.tsx` (keep `hover:bg-background` and `ring-offset-background` on buttons); add one test per component that the wrapper has no `bg-background` class; change no text
    - _Requirements: 21.11_

- [ ] 19. Review and log
  - [x] 19.1 Run the `accuracy-reviewer` agent over the new copy and fix findings
    - Review: `StartMenu.tsx` (the Sources_Caption and the five labels), `Credits.tsx` (heading), `SeanceSession.tsx` (both Leave_Prompt texts; the saved text "Ghosts you've finished are saved" is true only while `isSavingWorking()` is true, meaning no write has failed this visit, because each Outcome is written to local storage when it is reached and a failed write keeps nothing, so the not-saving text must show otherwise), `GhostFigure.tsx`, the README, and this spec folder
    - Run this task after task 21, so the reviewer sees the conditional wording
    - Findings and fixes (first review): (1) `App.tsx` read `savingWorks` only at mount and in `handleOutcome`, so it ignored the intro-flag and guide-flag writes (Req 18.2c). Fixed by calling `setSavingWorks(isSavingWorking())` after `setIntroSeen(true)`, after `setCangjieIntroSeen(true)` and in `startSeance`; new `App.test.tsx` test for a first visit with a throwing `setItem`. (2) `LEAVE_TEXT_NOT_SAVING` overstated when earlier Outcomes were saved and a later write failed. Changed "will be lost" to "may be lost", resolving an accuracy finding; approved option kept. (3) Req 18.2c, design (storage note and App wiring) and task 21.2 and 21.3 updated to match the code and the new text
    - Second review: the reviewer found that `isSavingWorking()` reflected only the most recent write, so if ghost 1's write failed and ghost 2's write succeeded, the prompt said "Ghosts you've finished are saved" although ghost 1 was never persisted (Req 18.2a, 18.2d, the Saving_Works entry, design Leave section, tasks 21.1 to 21.3). Fixed by making the flag sticky for the page session (`saveFailedThisSession`); the Leave texts are unchanged. The storage test "back to true after a later successful write" encoded the old rule and was replaced, as an intended semantic change from an accuracy finding, by "stays false after a later successful write (sticky for the session)"; new tests: a new store starts true, and an App test with a first-write failure. Requirements, design and tasks 21.1 to 21.3 updated
    - Fix each finding within this spec's scope; re-run until it reports `No findings`; record anything that needs a decision from a human in the task notes instead of changing steering
    - _Requirements: 23.5_
  - [ ] 19.2 Human visual check of the amendments (non-coding)
    - This task is NON-CODING and is performed by a human, not by Kiro. Kiro runs nothing for it and does not write its `kiro-log.md` entry; the human records the result in `kiro-log.md` themselves
    - At 375, 768 and 1440 px check: the sticky header stays put while scrolling the Graveyard and Sources & licences and fits on one row (at most 72 px); the focused element is not hidden under it; the night scene, moon glow and mist look calm and text is readable; with "reduce motion" on, nothing moves; the Leave séance prompt is usable with keyboard (Tab, Enter, Escape) and a screen reader
    - _Requirements: 19.6, 19.7, 21.9, 18.3_
  - [ ] 19.3 Add entries to `kiro-log.md`
    - One dated entry for the tester-feedback amendment: what was changed (Leave séance, sticky headers, rename, night scene, menu entrance), the decisions (inline `group` prompt with focus on "Stay", caption under the menu button, internal names kept, global candle focus rule, three pseudo-element scene), the amended ghost-game-core rule, and the accuracy-review outcome of task 19.1
    - Write "the human" or "a human" for people; use "approved by Takshil" only for approvals
    - Needs tasks 19.1 and 19.2
    - _Requirements: 23.5_

- [x] 20. Final checkpoint - Verify the amendments
  - Run the root `npm test`
  - Run `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json` and `npx tsc -p oracle/tsconfig.json`
  - Run `npm run build -w app`, then `npm run check:bundle` (budget 300,000 bytes of gzip)
  - Confirm `git diff --stat` shows no change to `app/public/data/characters.json`, `scheduler.ts`, `config.ts`, `outcome.ts`, `learningOrder.ts` or `cangjie.ts`, and that the diff of `storage.ts` is only `isSavingWorking()` (task 21.1: the `saveFailedThisSession` flag, its two assignments in `saveState`, and the two new exports) with no schema change
  - Ensure all tests pass, ask the user if questions arise.
  - This checkpoint runs after task 21 and task 19.1
  - _Requirements: 23.1, 23.2, 23.6, 14.1_

- [x] 21. Conditional Leave_Prompt text (accuracy finding, approved by Takshil)
  - [x] 21.1 Add `isSavingWorking()` to `app/src/storage/storage.ts` and test it
    - In `createStore` add `let saveFailedThisSession = false` (sticky for the page session). In `saveState`: set it to `true` when no backend is available and set it to `true` in the `catch`; a successful `backend.setItem` never clears it. Add `isSavingWorking(): boolean` to the `Store` interface and the returned object (it returns `!saveFailedThisSession`), and export `const isSavingWorking = (): boolean => defaultStore.isSavingWorking()`
    - Change no schema, no blob field, no existing signature and no existing behaviour; `recordOutcome(char, entry)` stays as it is and updates the flag through `saveState`; `loadState` and `resetToDefaults` do not touch it
    - In `storage.test.ts` add: true on a fresh store; true after a successful `saveState`; false after a `setItem` that throws; false after a save with no backend (backend resolver returns `undefined` or throws); stays false after a later successful write (sticky for the session); a new store starts true again; `recordOutcome` and `setIntroSeen` update it; `loadState` does not change it; existing assertions pass unchanged
    - File ownership: `storage.ts`, `storage.test.ts`
    - _Requirements: 18.2d, 14.1, 14.2_
  - [x] 21.2 Add the `savingWorks` prop and both texts to `SeanceSession.tsx` and test them
    - New required prop `savingWorks: boolean`. Add the constants `LEAVE_TEXT_SAVED` ("Leave now? Ghosts you've finished are saved.") and `LEAVE_TEXT_NOT_SAVING` ("Leave now? This browser didn't save all your progress, so some finished ghosts may be lost.") and show the one that matches the prop in `<p id="leave-question">`; the group keeps `aria-labelledby="leave-question"`, so its accessible name follows the text
    - In `SeanceSession.test.tsx`: with `savingWorks` true, the group is named by the saved text; with false, by the not-saving text and the saved text is absent; the buttons, focus, Escape and Leave behaviour are unchanged in both cases; update the shared `setup` to pass `savingWorks` (default true)
    - File ownership: `SeanceSession.tsx`, `SeanceSession.test.tsx` (and `SeanceSession.resultLine.test.tsx` if its setup needs the new prop)
    - Needs task 17.1
    - _Requirements: 18.2, 18.2a, 18.2b, 18.3_
  - [x] 21.3 Wire `savingWorks` in `App.tsx` and add the App test
    - In `App.tsx` keep `const [savingWorks, setSavingWorks] = useState(() => isSavingWorking())`, call `setSavingWorks(isSavingWorking())` in `handleOutcome` right after `recordOutcome(...)`, after `setIntroSeen(true)`, after `setCangjieIntroSeen(true)` and in `startSeance` (added by task 19.1), and pass `savingWorks={savingWorks}` to `SeanceSession`. Do not use the return value of `recordOutcome` and do not change any game rule
    - In `App.test.tsx` add tests: with a `localStorage` whose `setItem` throws, finish a ghost, press "Leave séance" and see the group named "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost."; with a `setItem` that throws on the first Outcome write and works afterwards, finish ghost 1 and ghost 2, press "Leave séance" and still see the not-saving text. With a working `localStorage`, the same steps show "Leave now? Ghosts you've finished are saved."; that test lives in `App.leaveSaved.test.tsx` because the flag is sticky in the default store and would otherwise leak from the failing-write tests in `App.test.tsx`
    - File ownership: `App.tsx`, `App.test.tsx`, `App.leaveSaved.test.tsx`
    - Needs tasks 17.2, 21.1 and 21.2
    - _Requirements: 18.2a, 18.2b, 18.2c_

## Notes

- Task 12.1 runs after every other task. It is a small change requested by the human and adds no new property-based tests.
- No optional tasks: every task is required, including its tests.
- Unit and component tests only. No property-based tests and no mutation tests are added (decision of Nov 15 in `tech.md`).
- Use the `cangjie-oracle` MCP tools (`lookup`, `decompose`) whenever a task needs a Cangjie code or a decomposition. Never write a code by hand.
- Never-reveal: the Graveyard renders glyphs only for Met_Characters, and nothing in the ghost visuals renders the Target_Character before the Rite ends.
- Do not edit the files in Requirement 14.1, except the one `storage.ts` addition of task 21.1 (approved by Takshil). If any other task seems to need it, stop and ask.
- Wave 0 tasks touch disjoint files: 1.1 (theme, tailwind), 1.2 (`app/package.json`, `main.tsx`), 2.1, 2.2, 3.1, 6.4, 7.1 (`scripts/check-bundle-size.ts`, root `package.json`).
- Task 3.2 needs the font package from 1.2 and edits the root `package.json` after 7.1 (wave 0); task 3.3 edits the root `tsconfig.json` after 8.1 (wave 1); task 6.2 needs `software.ts` from 3.3; task 6.5 needs 6.2.
- `README.md` is edited only by 8.1 and, if the review finds something, by 9.1 (a later wave). `kiro-log.md` is edited only by 8.2.
- Pixel checks cannot run in jsdom. A human checks the layout at 375, 768 and 1440 px before deploy (task 10.1, non-coding). Kiro does not run it and does not log it.
- Approvals are recorded as "approved by Takshil". The approved decisions are in the design under "Approved decisions": the Chinese font stack, Cormorant Garamond 600 Latin with `font-display: swap`, bibliographic names allowed in credits, the Software section with the committed notices file, the colours, the human phone check, one flicker then 0.5 opacity, and 300 kB = 300,000 bytes. No question is open.
- Bibliographic names in citations and credits are allowed (`structure.md`); personal names stay out of repo files.
- The notices file is committed, not generated at build time. After any change to a runtime dependency, run `npm run build:notices` and update `software.ts`.
- Task 8.2 (`kiro-log.md`) stays in the plan.
- Task 10.1 is the only manual, non-coding task. Task 11 is a checkpoint and is not in the dependency graph.

### Notes for tasks 13 to 20 (tester feedback, approved by Takshil)

- These tasks amend the spec after tester feedback. They change no game rule and add no property-based test.
- The superseded "no menu control during a séance" rule is ghost-game-core Requirement 1.5. It is amended in place there, and its test (`SeanceSession.test.tsx`, "has no legend or menu control during the session") is replaced by task 17.1.
- File ownership (no two tasks of one wave edit the same file): 13.1 `theme.ts`, `theme.test.ts`, `tailwind.config.ts`; 13.2 `index.css`, `index.css.test.ts`; 14.1 `GhostFigure.tsx`, `GhostFigure.test.tsx`, `GhostPrompt.tsx`; 15.1 and 15.2 `StartMenu.tsx`, `StartMenu.test.tsx` (different waves); 16.1 `Credits.tsx`, `Credits.test.tsx`; 16.2 `Graveyard.tsx`, `Graveyard.test.tsx`; 17.1 `SeanceSession.tsx`, `SeanceSession.test.tsx`; 17.2 `App.tsx`, `App.test.tsx`; 18.1 `IntroScreen.tsx`, `CangjieGuide.tsx`, `SessionSummary.tsx` and their tests; 19.3 `kiro-log.md`. Task 19.1 may edit any file named in its list, and runs in a wave of its own with the human task 19.2.
- Until task 17.2 runs, `App.test.tsx` still looks for the old name "Credits", so run only the tests of your own files in tasks 15 and 16; the whole suite is green again at task 20.
- Task 21 (accuracy finding, approved by Takshil) makes the Leave_Prompt text conditional on `isSavingWorking()`. It sits after task 20 in the file but runs before 19.1 and 20 (waves 11 and 12 of the graph). 21.1 and 21.2 touch disjoint files and run in parallel; 21.3 follows. Task 19.1 re-runs the `accuracy-reviewer` after task 21, and the final checkpoint 20 runs after 19.1. Requirement 14.1 is amended to allow this one `storage.ts` addition.
- Internal names (`credits` view, `Credits.tsx`, `onOpenCredits`, `data/credits.ts`) stay; only user-facing text is renamed.
- Task 19.2 is the second manual, non-coding task (after 10.1). Task 20 is a checkpoint and is not in the dependency graph.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "2.2", "3.1", "6.4", "7.1"] },
    { "id": 1, "tasks": ["1.3", "3.2", "6.3", "8.1"] },
    { "id": 2, "tasks": ["3.3", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "6.2"] },
    { "id": 4, "tasks": ["6.5"] },
    { "id": 5, "tasks": ["9.1", "10.1"] },
    { "id": 6, "tasks": ["8.2"] },
    { "id": 7, "tasks": ["12.1"] },
    { "id": 8, "tasks": ["13.1", "14.1", "15.1", "17.1"] },
    { "id": 9, "tasks": ["13.2", "16.1", "16.2", "18.1"] },
    { "id": 10, "tasks": ["15.2", "17.2"] },
    { "id": 11, "tasks": ["21.1", "21.2"] },
    { "id": 12, "tasks": ["21.3"] },
    { "id": 13, "tasks": ["19.1", "19.2"] },
    { "id": 14, "tasks": ["19.3"] }
  ]
}
```
