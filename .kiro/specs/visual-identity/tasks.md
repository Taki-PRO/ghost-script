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
    - Write "the human" or "a human" for people; use "approved by the human" only for approvals
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

- [x] 13. Night scene foundations (tester feedback, approved by the human)
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
    - Write "the human" or "a human" for people; use "approved by the human" only for approvals
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

- [x] 21. Conditional Leave_Prompt text (accuracy finding, approved by the human)
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

- [x] 22. Sources & licences fits a phone (bug fix, approved by the human)
  - [x] 22.1 Add stacked cards and the wrap rule to `Credits.tsx`
    - Add `const WRAP = '[overflow-wrap:anywhere]'`; use it in `TD` instead of `break-words`, on every Cangjie citation `<li>`, and on the legend citation `<p>` (the one that holds the long URL)
    - Give each of the two tables the classes `hidden` and `sm:table` (keep the `overflow-x-auto` wrapper `<div>`), and add `aria-labelledby` to each table pointing at its section `h2` (`credits-sources`, `credits-software`)
    - After each table add a card `<ul aria-labelledby="…" className="mt-3 flex flex-col gap-3 sm:hidden">` with one `<li>` per row of `DATA_SOURCES` or `SOFTWARE_CREDITS`; each `<li>` holds a `<dl>` of `<div>` groups with one `<dt>` and one `<dd>` per column, using the table's column labels ("Name", "Version or commit", "Use", "Licence", "URL"; "Name", "Version", "Licence"); the `<dt>` colon comes from CSS (`after:content-[':']`), the `<dd>` carries `WRAP`; keep `bg-surface`, `text-ink`, `text-muted` tokens only
    - Keep the single link, the sticky header, the `h1` id and every other section unchanged; add no `index.css` rule (decision B5)
    - File ownership: `app/src/components/Credits.tsx`
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 9.2, 9.10_
  - [x] 22.2 Add the layout tests to `Credits.test.tsx`
    - Both layouts exist: two tables with `hidden` and `sm:table`, two card lists with `sm:hidden`; every `DATA_SOURCES` and `SOFTWARE_CREDITS` row appears in its table (scoped with `within(table)`) and as a card with the right labels and values; each `<dt>` text equals a column label and each card is a `<dl>`; every table cell, every `<dd>`, the legend citation and each Cangjie citation carry `[overflow-wrap:anywhere]`
    - Scope the existing queries that read table rows to the table (the rowheader-based Software test already is); keep every existing assertion's intent, including "exactly one `<a>`"; remember that jsdom loads no Tailwind CSS, so both layouts are present and visible in these tests
    - File ownership: `app/src/components/Credits.test.tsx`
    - Needs task 22.1
    - _Requirements: 24.3, 24.4, 24.5, 24.6, 24.13_
  - [x] 22.3 Add the Playwright dependency, the two scripts and the ignore rules
    - Run `npm install --save-dev --save-exact @playwright/test@1.65.1` at the repository root (first re-check the version with `npm view @playwright/test version`; pin whatever exact version is current and record it here; re-checked: `1.65.1` is current and pinned); confirm `package.json` shows the version without `^` or `~` and `app/package.json` is unchanged
    - Add `"test:e2e": "playwright test -c e2e/playwright.config.ts"` and `"test:e2e:install": "playwright install chromium"` to the root `scripts`; leave `"test": "vitest run"` as it is
    - Add `test-results/` and `playwright-report/` to `.gitignore` under a comment; do not touch `!.kiro/` and never add `.kiro/`
    - File ownership: root `package.json`, `package-lock.json`, `.gitignore`
    - _Requirements: 24.11, 24.12, 24.15_
  - [x] 22.4 Create `e2e/playwright.config.ts` and type-check `e2e/`
    - Config as in the design: `testDir: '.'`, `testMatch: '**/*.spec.ts'`, viewport 375 × 812, one Chromium project, `baseURL` `http://127.0.0.1:4173`, `webServer` with the command `npm run build -w app && npm run preview -w app -- --host 127.0.0.1 --port 4173 --strictPort --base /ghost-script/`, `cwd` the repository root, `url` `http://127.0.0.1:4173/ghost-script/`, `reuseExistingServer: false`, `timeout: 180_000`, reporters `list` and `html` with `open: 'never'`
    - Add `"e2e/**/*.ts"` to the `include` of the root `tsconfig.json` (no `e2e/tsconfig.json`); run `npx tsc -p tsconfig.json`
    - Confirm by reading the three Vitest configs that no `include` matches `e2e/*.spec.ts`
    - File ownership: `e2e/playwright.config.ts`, root `tsconfig.json`
    - Needs task 22.3
    - _Requirements: 24.10, 24.11, 24.12, 24.15_
  - [x] 22.5 Create `e2e/no-horizontal-overflow.spec.ts`
    - A `seed(page, state)` helper using `page.addInitScript` (key `ghost-script:state`, schema 2, set only when the key is absent) and a `findOverflow(page)` helper that waits for `document.fonts.ready`, reports `scrollWidth` above 375, and reports every element not `display: none` whose `getBoundingClientRect()` has `right` above 375.5 or `left` below -0.5, with a selector (`tag#id.class` plus `aria-label`) in each line
    - Five screen tests, one per screen, reached through the UI as in the design table: Sources & licences, Graveyard (seeded history for the first three keys of `app/public/data/characters.json`), How Cangjie works, the Summon step (fail with a clear message if the Summon step is absent), and the Write step (click "Give up" in the Summon step, wait up to 10 s for the "Write mode" region); each asserts `expect(problems, problems.join('\n')).toEqual([])`
    - One guard test that appends a 600 px wide `div` and expects `findOverflow` to name it; one viewport precondition per test; comment that pseudo-element mist layers are not elements and fixed layers add no scroll width
    - Do not change any app file; if a screen other than Sources & licences overflows, stop and report it
    - Run `npx tsc -p tsconfig.json`; the browser run itself is in task 23
    - File ownership: `e2e/no-horizontal-overflow.spec.ts`
    - Needs tasks 22.1 and 22.4
    - _Requirements: 24.7, 24.8, 24.9, 24.10_
  - [x] 22.6 Add the e2e note to `README.md`
    - Under Usage, after "Run the tests", add the subsection "Check the layout width in a real browser": `npm run test:e2e:install` once (downloads Chromium), then `npm run test:e2e` (builds the app, serves it with `vite preview` on port 4173 under `/ghost-script/`, checks four screens at 375 px); say that `npm test` does not run it and that it is not in the deploy workflow
    - Make no claim about browser download size or run time; the README cross-check test (`tests/unit/credits-readme.test.ts`) must still pass
    - File ownership: `README.md`
    - Needs task 22.3
    - _Requirements: 24.14_

  - [x] 22.7 Fix the guide overflow at 375 px (fix found by the e2e check)
    - Diagnose first with Playwright: at 375 px the Cangjie_Guide makes `main.min-h-screen.text-ink.flex` span left -3 to right 378 with no descendant beyond 375.5, so find the element whose min-content width drives the overflow (for example, set each candidate to `display: none` or `width: 0` in `page.evaluate` and re-measure `scrollWidth`); the likely cause is the unbreakable Wikipedia URLs in the citation line
    - Fix the cause in `CangjieGuide.tsx`: use the `[overflow-wrap:anywhere]` class (a `WRAP` constant, as in `Credits.tsx`) on the citation line and on any other long unbreakable text; only if that is not enough, add `min-w-0` on the guide's wrapper; do not touch `App.tsx` unless the diagnosis shows the cause is there, and if so say why in the task notes
    - Add a jsdom test to `CangjieGuide.test.tsx` that the citation line carries `[overflow-wrap:anywhere]` (and, if added, every other long-value element)
    - Re-run `npm run test:e2e` until all six tests (five screens and the guard) pass; do not loosen `findOverflow`, the 375 px viewport or the thresholds in `e2e/no-horizontal-overflow.spec.ts`
    - File ownership: `app/src/components/CangjieGuide.tsx`, `app/src/components/CangjieGuide.test.tsx`
    - Needs task 22.5
    - _Requirements: 24.17, 24.7, 24.8, 24.9_
- [x] 23. Final checkpoint - Verify the Sources & licences fix
  - Check that `git diff --stat` shows `package.json`, `package-lock.json`, `.gitignore`, `tsconfig.json`, `README.md`, `Credits.tsx`, `Credits.test.tsx`, `CangjieGuide.tsx`, `CangjieGuide.test.tsx` and the new `e2e/` files only, and none of the files in Requirement 14.1
  - Run the root `npm test`; confirm its output lists no file under `e2e/`
  - Run `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json` and `npx tsc -p oracle/tsconfig.json`
  - Run `npm run build -w app`, then `npm run check:bundle`
  - Run `npm run test:e2e:install` (it downloads Chromium), then `npm run test:e2e`; all six tests (five screens and the guard) pass, and no file under `e2e/test-results` or `playwright-report` shows in `git status`
  - Ensure all tests pass, ask the user if questions arise.
  - This checkpoint runs after tasks 22.1 to 22.7 and is not in the dependency graph; the manual task 10.1 stays open for the human to re-check 375 px
  - _Requirements: 24.16, 24.17, 14.1, 24.15_

- [x] 24. Fit one screen, scroll reset, 320 px and names (amendment, approved by the human)
  - [x] 24.1 Create `app/src/engine/surfaceSize.ts` and its test
    - Export `summonPaperSize(width, height)` = `Math.round(Math.max(96, Math.min(0.4 * width, 160, height - 600)))` and `writeSurfaceSize(width, height)` = `Math.round(Math.max(200, Math.min(0.8 * width, 420, height - 400)))`, with a doc comment that names the budget of the design ("Height budget") as the source of 600 and 400
    - In `surfaceSize.test.ts` (unit tests, no property tests): `summonPaperSize` gives 160 at 1024 × 768, 150 at 375 × 812, 96 at 320 × 640 and 160 at 1440 × 900; `writeSurfaceSize` gives 368, 300, 240 and 420 at the same four viewports; the floors (height 300 gives 96 and 200) and the caps (4000 × 4000 gives 160 and 420); results are integers
    - File ownership: `app/src/engine/surfaceSize.ts`, `app/src/engine/surfaceSize.test.ts`
    - _Requirements: 25.2, 26.2_
  - [x] 24.2 Create `app/src/components/scrollToTop.ts` and its test
    - Export `scrollToTop(): void`: return at once when `typeof window === 'undefined'` or `typeof window.scrollTo !== 'function'`, else call `window.scrollTo(0, 0)` with no options (instant scrolling in every motion setting, decision F9)
    - In `scrollToTop.test.ts`: with `window.scrollTo` mocked, one call with `(0, 0)` and no third argument; with `window.scrollTo` set to `undefined`, no throw
    - File ownership: `app/src/components/scrollToTop.ts`, `app/src/components/scrollToTop.test.ts`
    - _Requirements: 27.3, 27.4_
  - [x] 24.3 Add the `.summon-keys` rule to `index.css` and test it
    - In `app/src/styles/index.css` add `.summon-keys { --key-w: clamp(min(32px, calc((100vw - 2rem - 18px) / 10)), calc((100vw - 2rem - 18px) / 10), 48px); }` and no media query (as built; approved by the human (narrower keys only below the width where 32px keys fit): the existing test requires exactly one `@media` block, and ten 32 px keys need a 370 px viewport; the first draft had `@media (max-width: 359px)`; add no animation and no `url()`)
    - In `index.css.test.ts` add tests: the rule exists with that value; the file contains no `scroll-behavior` (Requirement 27.3); every existing test passes without change
    - File ownership: `app/src/styles/index.css`, `app/src/styles/index.css.test.ts`
    - _Requirements: 25.8, 25.9, 27.3_
  - [x] 24.4 Add the `compact` prop to `GhostPrompt.tsx` and test it
    - Add `compact?: boolean` (default `false`). When true, render the Compact_Card of the design (decision F4): section classes `ghost-card flex items-center gap-3 rounded-lg bg-surface p-2 text-left`; `GhostFigure` with `ghost-figure h-10 w-9 shrink-0 text-ghost`; a `min-w-0` text column with `sr-only` paragraphs "Meaning" and "Pronunciation", the meaning in `text-xl text-ink` and the pinyin in `text-lg text-ghost` with `lang="zh-Latn-pinyin"`. The non-compact markup stays exactly as it is. `data-ghost-state`, the masking and the pinyin text are unchanged
    - In `GhostPrompt.test.tsx` add tests for the compact case (classes, `sr-only` labels, pinyin `lang`, the target character absent from the DOM text and from attributes, `data-ghost-state` still set); every existing test passes unchanged
    - File ownership: `app/src/components/GhostPrompt.tsx`, `app/src/components/GhostPrompt.test.tsx`
    - _Requirements: 25.4, 25.5, 25.10_
  - [x] 24.5 Fit the Summon step in `SummonStep.tsx` and update its test
    - Needs `summonPaperSize` and the `.summon-keys` class. Compute `const [side] = useState(() => summonPaperSize(window.innerWidth, window.innerHeight))`; pass `size={`${side}px`}` to `InkSurface` and `width: side, height: side` to `HanziWriter.create`; remove the local `surfaceSize`
    - Spacing: root `gap-2`; slots `h-12 w-11`; status paragraph `min-h-[2.5rem] text-sm`; fallback character `text-6xl`; "Give up" `min-h-[44px]`; replace the inline `--key-w` style on the keyboard wrapper with the class `summon-keys` (keep the row grid and every `aria-label`)
    - Change no timer, no `SUMMON_HOLD_MS` or `SUMMON_FADE_MS`, no hint rule, no reducer call and no never-reveal behaviour
    - In `SummonStep.test.tsx` replace the three `min(60vw, 240px)` assertions (about lines 392 to 400) with: the surface width is `${summonPaperSize(innerWidth, innerHeight)}px` at two viewport sizes (set `window.innerWidth` and `innerHeight`, restore them after), and hanzi-writer receives the same number as `width` and `height`; add tests for the `summon-keys` class, the status `min-h-[2.5rem]` and the 44 px "Give up"; every hold, fade, hint and never-reveal test passes unchanged
    - File ownership: `app/src/modes/SummonStep.tsx`, `app/src/modes/SummonStep.test.tsx`
    - Needs tasks 24.1 and 24.3
    - _Requirements: 25.1, 25.2, 25.3, 25.7, 25.8, 25.9, 25.10, 31.3_
  - [x] 24.6 Fit the Write step in `WriteMode.tsx` and update its test
    - Needs `writeSurfaceSize`. Compute the side once with `useState(() => writeSurfaceSize(window.innerWidth, window.innerHeight))`; pass `size={`${side}px`}` to `InkSurface` and `width: side, height: side` to `HanziWriter.create`; remove the exported `surfaceSize` (its test moves to `surfaceSize.test.ts`); root `gap-2`; "Give up" `min-h-[44px]`
    - Change no quiz option, no callback, no outcome rule and no message
    - In `WriteMode.test.tsx` replace the `min(80vw, 420px)` assertion (about line 157) and the `surfaceSize` test (about lines 494 to 497) with the `writeSurfaceSize` equivalents at two viewport sizes, add the 44 px "Give up" test; every other test passes unchanged
    - File ownership: `app/src/modes/WriteMode.tsx`, `app/src/modes/WriteMode.test.tsx`
    - Needs task 24.1
    - _Requirements: 26.1, 26.2, 26.3, 26.5, 26.6_
  - [x] 24.7 Compact layout and next-ghost scroll reset in `SeanceSession.tsx`, with tests
    - Pass `compact` to `GhostPrompt`; root classes `gap-2 p-2` (were `gap-4 p-4`); step label `text-sm text-muted`; keep the header, the Leave_Prompt, every focus effect and the result block as they are
    - In `handleAdvance`, in the branch that starts the next ghost (not the branch that calls `onComplete`), call `scrollToTop()` before the state updates
    - In `SeanceSession.test.tsx` mock `window.scrollTo` (restore after each test): pressing "Next ghost" calls it once with `(0, 0)`; pressing "Finish the séance" does not call it from the session; the clue card has the compact classes; all focus, Escape and Leave tests pass unchanged. Update `SeanceSession.resultLine.test.tsx` only if its setup breaks
    - File ownership: `app/src/components/SeanceSession.tsx`, `SeanceSession.test.tsx`, `SeanceSession.resultLine.test.tsx`
    - Needs tasks 24.2 and 24.4
    - _Requirements: 25.4, 25.6, 27.2, 27.5_
  - [x] 24.8 Compact `Shell` and screen-change scroll reset in `App.tsx`, with tests
    - Add `compact?: boolean` to `Shell`: when true the `main` uses `min-h-[100dvh] ... px-2 py-2` instead of `min-h-screen ... px-4 py-6`; render `<Shell compact>` for the `seance` case only
    - Add `useLayoutEffect(() => { scrollToTop(); }, [view.screen])` (import it; do not move any existing effect). Confirm by reading that no child focuses in a layout effect; if one does, stop and report
    - In `App.test.tsx` mock `window.scrollTo`: each of menu to graveyard, graveyard back to menu, menu to séance adds a call with `(0, 0)` (assert as an increase, not an exact total, because `SeanceSession` also calls it); the séance `main` has `px-2`, the menu `main` has `px-4`; every existing test and `App.leaveSaved.test.tsx` pass unchanged
    - File ownership: `app/src/App.tsx`, `app/src/App.test.tsx`, `app/src/App.leaveSaved.test.tsx`
    - Needs task 24.2
    - _Requirements: 25.6, 27.1, 27.5_
  - [x] 24.9 Fix Sources & licences at 320 px in `Credits.tsx`, with a test
    - Diagnose first, before any change: with a throwaway Playwright script (not committed) at 320 × 640, measure `document.documentElement.scrollWidth` (341 expected), then find the element that drives it, for example by setting `display: none` or `width: 0` on candidates and re-measuring. Check these suspects in order: the Fonts list items (copyright text with a URL, no `WRAP`), the two Licensing paragraphs, the header row (`whitespace-nowrap` "Back to menu" button beside the title). Write the finding in this task's notes (element, selector, why)
    - Fix the named element: add the `WRAP` class (and any other long-text element of the same kind); only if that is not enough, make the header shrink (for example let the button text wrap or reduce its padding below `sm`) without changing the 44 px height. If the cause is in `App.tsx` (`Shell`), stop and report: `App.tsx` belongs to task 24.8
    - In `Credits.test.tsx` add a test that the named element carries `[overflow-wrap:anywhere]`; every existing test passes unchanged
    - Re-measure at 320 × 640 and at 375 × 812 with the throwaway script; both must be within their width
    - File ownership: `app/src/components/Credits.tsx`, `app/src/components/Credits.test.tsx`
    - Finding (diagnosed at 320 × 640 with a throwaway Playwright script in `/tmp`): `document.documentElement.scrollWidth` was 334 here, not 341 (`main` and the sticky `header` both ended at 334). Setting `display: none` on `section[aria-labelledby="credits-fonts"] li` brought it to 320. Hiding the Licensing paragraphs, the header button, the h1, the Sources and Software card lists, the legend and the Cangjie section changed nothing. Cause: the Fonts list items (`<li>` in `#credits-fonts`), whose copyright text holds a URL with no break point and had no `WRAP`. The cause is in `Credits.tsx`, not `App.tsx`. Fix: `className={WRAP}` on those `<li>`; the header needed no change. After the fix: 320 at 320 × 640 and 375 at 375 × 812. Test: "lets every Fonts list item wrap anywhere" in `Credits.test.tsx`.
    - _Requirements: 28.1, 28.2, 28.3, 28.4_
  - [x] 24.10 Remove the personal name from data and tests, and add the name guard
    - Record before: `shasum -a 256 app/public/data/characters.json` and a copy of `data/prompt-review.csv` (for example to `/tmp`, not in the repo)
    - In `data/prompt-overrides.csv` replace the `reviewedBy` value on every row with `human-approved`; in `tests/unit/build-override-errors.test.ts` replace the five override rows' fourth field with `human-approved`
    - In `tests/unit/oracle-power.test.ts` keep the "personal names" test and make it assert that none of the three Power files matches a name token that the test builds from parts (for example `new RegExp(['Tak', 'shil'].join(''), 'i')`), so the file itself contains no name
    - Add `tests/unit/no-personal-names.test.ts`: list the tracked files with `git ls-files` (`execFileSync`), skip binary files (by extension: png, jpg, jpeg, gif, webp, ico, woff, woff2, ttf, pdf, zip) and the allowed exceptions `kiro-log.md`, `.kiro/steering/` and every `tasks.meta.json`, and fail with the list of offending paths if any other file contains the same assembled token (case-insensitive). The test file must not contain the name
    - Run `npm run build:data`. Confirm `shasum -a 256 app/public/data/characters.json` is unchanged; if it changed, stop and report. Confirm `data/prompt-review.csv` changed only in the `reviewedBy` column: parse old and new with the pipeline's CSV parser (a throwaway `tsx` script) and check that every other column is equal on every row and that each changed `reviewedBy` is `human-approved`
    - Do not edit `kiro-log.md`, any steering file or any `tasks.meta.json`
    - File ownership: `data/prompt-overrides.csv`, `data/prompt-review.csv` (generated), `tests/unit/build-override-errors.test.ts`, `tests/unit/oracle-power.test.ts`, `tests/unit/no-personal-names.test.ts`
    - _Requirements: 30.2, 30.3, 30.4, 30.5, 30.6_
  - [x] 24.11 Extract the e2e helpers and add the 320 px width checks
    - Create `e2e/helpers.ts` with `seed`, `seedState`, `datasetKeys`, `findOverflow(page, width)` (same logic and thresholds as now, with `width` in place of the constant 375) and `boxInside(page, locator)` (returns the bounding box and the viewport; used by task 24.12). Import them in `e2e/no-horizontal-overflow.spec.ts`
    - Wrap the five screen tests and the guard test in `for (const vp of [{ width: 375, height: 812 }, { width: 320, height: 640 }])` with `test.describe(`no horizontal overflow at ${vp.width} px`, …)` and `test.use({ viewport: vp })`; `expectViewport` compares with `vp`; the 375 titles stay as they are
    - Never loosen a check: keep `375.5`/`-0.5` (now `width + 0.5`), `scrollWidth > width`, the `display: none` skip and the guard test
    - Run `npx tsc -p tsconfig.json`. If a screen other than the Summon step and Sources & licences overflows at 320, stop and report it with the findOverflow lines, and do not change an app file
    - File ownership: `e2e/helpers.ts`, `e2e/no-horizontal-overflow.spec.ts`
    - Needs tasks 24.3, 24.5, 24.6, 24.7, 24.8 and 24.9
    - _Requirements: 29.1, 29.2, 29.8_
  - [x] 24.12 Add the height and scroll-reset checks and update the README
    - Create `e2e/fits-one-screen.spec.ts` that loops over `[{ width: 1024, height: 768 }, { width: 375, height: 812 }]` with `test.use({ viewport })` and a viewport precondition, importing `e2e/helpers.ts`. Tests per viewport, as in the design ("E2E extension"): (1) the Summon step: `boxInside` for "Leave séance", the text "Step 1 of 2: Summon", the region "Ghost's clue", the list "Cangjie code", `getByTestId('ink-surface')`, every button in `[data-row="2"]` and the Summon "Give up" button, each with top ≥ 0, bottom ≤ `innerHeight`, left ≥ 0, right ≤ `innerWidth`, and `scrollHeight <= innerHeight`; (2) the Write step: "Leave séance", the write `ink-surface`, "Give up" and `scrollHeight <= innerHeight`; (3) after "Give up" in the Write step (wait until enabled, timeout 10 s) "Next ghost" is inside the viewport; (4) scroll reset: append `div#scroll-spacer` (2000 px) to `document.body`, `scrollTo(0, 500)`, assert `scrollY > 0`, press "Give up" in both steps, press "Next ghost", then `expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)`
    - If a check fails, do not loosen it and do not change an app file: stop and report the measured values and the element
    - In `README.md`, reword the e2e subsection to "five screens at 375 and 320 px and the one-screen fit at 1024 × 768 and 375 × 812", with no claim about download size or run time; `tests/unit/credits-readme.test.ts` must still pass
    - Run `npx tsc -p tsconfig.json`; the browser run is in task 25
    - File ownership: `e2e/fits-one-screen.spec.ts`, `README.md`
    - Needs task 24.11
    - _Requirements: 29.3, 29.4, 29.5, 29.6, 29.7, 29.9, 26.1, 26.4_
- [x] 25. Final checkpoint - Verify the fit amendments
  - Check that `git diff --stat` shows only the files named in tasks 24.1 to 24.12 and the `.kiro/specs` text files, and none of the files in Requirement 14.1, `kiro-log.md`, a steering file or a `tasks.meta.json`
  - Run `npm test` (output lists no file under `e2e/`), `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json` and `npx tsc -p oracle/tsconfig.json`
  - Run `npm run build -w app`, then `npm run check:bundle`
  - Run `npm run test:e2e`: the 375 and 320 width tests (five screens each plus the guard), and the height and scroll-reset tests at both Rite_Viewports, all pass
  - Confirm `shasum -a 256 app/public/data/characters.json` equals the value recorded in task 24.10, and run `npx vitest run tests/unit/no-personal-names.test.ts` plus a case-insensitive `grep -ri` for the name token over `.kiro/specs` (only `tasks.meta.json` may match; report the output)
  - Ensure all tests pass, ask the user if questions arise.
  - This checkpoint runs after tasks 24.1 to 24.12 and is not in the dependency graph; the manual tasks 10.1 and 19.2 stay open for the human
  - _Requirements: 31.1, 31.4, 31.5, 30.3_

## Notes

- Task 12.1 runs after every other task. It is a small change requested by the human and adds no new property-based tests.
- No optional tasks: every task is required, including its tests.
- Unit and component tests only. No property-based tests and no mutation tests are added (decision of Nov 15 in `tech.md`).
- Use the `cangjie-oracle` MCP tools (`lookup`, `decompose`) whenever a task needs a Cangjie code or a decomposition. Never write a code by hand.
- Never-reveal: the Graveyard renders glyphs only for Met_Characters, and nothing in the ghost visuals renders the Target_Character before the Rite ends.
- Do not edit the files in Requirement 14.1, except the one `storage.ts` addition of task 21.1 (approved by the human). If any other task seems to need it, stop and ask.
- Wave 0 tasks touch disjoint files: 1.1 (theme, tailwind), 1.2 (`app/package.json`, `main.tsx`), 2.1, 2.2, 3.1, 6.4, 7.1 (`scripts/check-bundle-size.ts`, root `package.json`).
- Task 3.2 needs the font package from 1.2 and edits the root `package.json` after 7.1 (wave 0); task 3.3 edits the root `tsconfig.json` after 8.1 (wave 1); task 6.2 needs `software.ts` from 3.3; task 6.5 needs 6.2.
- `README.md` is edited only by 8.1 and, if the review finds something, by 9.1 (a later wave). `kiro-log.md` is edited only by 8.2.
- Pixel checks cannot run in jsdom. A human checks the layout at 375, 768 and 1440 px before deploy (task 10.1, non-coding). Kiro does not run it and does not log it.
- Approvals are recorded as "approved by the human". The approved decisions are in the design under "Approved decisions": the Chinese font stack, Cormorant Garamond 600 Latin with `font-display: swap`, bibliographic names allowed in credits, the Software section with the committed notices file, the colours, the human phone check, one flicker then 0.5 opacity, and 300 kB = 300,000 bytes. No question is open.
- Bibliographic names in citations and credits are allowed (`structure.md`); personal names stay out of repo files.
- The notices file is committed, not generated at build time. After any change to a runtime dependency, run `npm run build:notices` and update `software.ts`.
- Task 8.2 (`kiro-log.md`) stays in the plan.
- Task 10.1 is the only manual, non-coding task. Task 11 is a checkpoint and is not in the dependency graph.

### Notes for tasks 13 to 20 (tester feedback, approved by the human)

- These tasks amend the spec after tester feedback. They change no game rule and add no property-based test.
- The superseded "no menu control during a séance" rule is ghost-game-core Requirement 1.5. It is amended in place there, and its test (`SeanceSession.test.tsx`, "has no legend or menu control during the session") is replaced by task 17.1.
- File ownership (no two tasks of one wave edit the same file): 13.1 `theme.ts`, `theme.test.ts`, `tailwind.config.ts`; 13.2 `index.css`, `index.css.test.ts`; 14.1 `GhostFigure.tsx`, `GhostFigure.test.tsx`, `GhostPrompt.tsx`; 15.1 and 15.2 `StartMenu.tsx`, `StartMenu.test.tsx` (different waves); 16.1 `Credits.tsx`, `Credits.test.tsx`; 16.2 `Graveyard.tsx`, `Graveyard.test.tsx`; 17.1 `SeanceSession.tsx`, `SeanceSession.test.tsx`; 17.2 `App.tsx`, `App.test.tsx`; 18.1 `IntroScreen.tsx`, `CangjieGuide.tsx`, `SessionSummary.tsx` and their tests; 19.3 `kiro-log.md`. Task 19.1 may edit any file named in its list, and runs in a wave of its own with the human task 19.2.
- Until task 17.2 runs, `App.test.tsx` still looks for the old name "Credits", so run only the tests of your own files in tasks 15 and 16; the whole suite is green again at task 20.
- Task 21 (accuracy finding, approved by the human) makes the Leave_Prompt text conditional on `isSavingWorking()`. It sits after task 20 in the file but runs before 19.1 and 20 (waves 11 and 12 of the graph). 21.1 and 21.2 touch disjoint files and run in parallel; 21.3 follows. Task 19.1 re-runs the `accuracy-reviewer` after task 21, and the final checkpoint 20 runs after 19.1. Requirement 14.1 is amended to allow this one `storage.ts` addition.
- Internal names (`credits` view, `Credits.tsx`, `onOpenCredits`, `data/credits.ts`) stay; only user-facing text is renamed.
- Task 19.2 is the second manual, non-coding task (after 10.1). Task 20 is a checkpoint and is not in the dependency graph.

### Notes for tasks 22 and 23 (bug fix, approved by the human)

- This group fixes Requirement 9 (Credits) at 375 px, reported by the human after a browser check (tables about 975 px wide, page `scrollWidth` 588). It relates to the manual task 10.1, which stays open: the human re-checks 375, 768 and 1440 px after the fix. It changes no game rule and adds no property-based test.
- File ownership (no two tasks of one wave edit the same file): 22.1 `Credits.tsx`; 22.2 `Credits.test.tsx`; 22.3 root `package.json`, `package-lock.json`, `.gitignore`; 22.4 `e2e/playwright.config.ts`, root `tsconfig.json`; 22.5 `e2e/no-horizontal-overflow.spec.ts`; 22.6 `README.md`; 22.7 `CangjieGuide.tsx`, `CangjieGuide.test.tsx`. There is no `index.css` task: the wrap rule is the Tailwind class `[overflow-wrap:anywhere]` (decision B5).
- Order: 22.1 and 22.3 run first (wave 15); 22.2, 22.4 and 22.6 follow (wave 16); 22.5 needs the cards and the config (wave 17); 22.7 fixes the guide overflow that 22.5 found (wave 18). Task 23 is a checkpoint and is not in the dependency graph.
- Task 22.5 does not run the browser. Task 23 runs `npm run test:e2e:install` and `npm run test:e2e`.
- Not done here, on purpose: a CI step for the E2E_Suite (follow-up B10 in the design), and any change to `kiro-log.md`.

### Notes for tasks 24 and 25 (second browser check, approved by the human)

- These tasks amend the spec after a second browser check. They change no game rule, no timing and no storage, and add no property-based test.
- File ownership (no two tasks of one wave edit the same file): 24.1 `surfaceSize.ts` and test; 24.2 `scrollToTop.ts` and test; 24.3 `index.css`, `index.css.test.ts`; 24.4 `GhostPrompt.tsx` and test; 24.5 `SummonStep.tsx` and test; 24.6 `WriteMode.tsx` and test; 24.7 `SeanceSession.tsx` and its two tests; 24.8 `App.tsx` and its two tests; 24.9 `Credits.tsx` and test; 24.10 `data/` CSV files and three test files in `tests/unit/`; 24.11 `e2e/helpers.ts`, `e2e/no-horizontal-overflow.spec.ts`; 24.12 `e2e/fits-one-screen.spec.ts`, `README.md`.
- Order: wave 19 (24.1, 24.2, 24.3, 24.4, 24.9, 24.10) has disjoint files; wave 20 (24.5, 24.6, 24.7, 24.8) needs wave 19; wave 21 (24.11) needs every UI task; wave 22 (24.12) needs 24.11. Task 25 is a checkpoint and is not in the graph.
- Task 24.10 touches only `data/`, `tests/` and the generated `data/prompt-review.csv`; it has no dependency on the UI tasks. `kiro-log.md`, the steering files and every `tasks.meta.json` are not edited. The spec markdown files were already changed by the maintainer (the approval phrase replaced everywhere); three task titles of this file changed (groups 13, 21 and 22), so their task IDs change when Kiro rewrites `tasks.meta.json`.
- Deviation, as built in task 24.3; approved by the human (narrower keys only below the width where 32px keys fit): below 370 px the Summon keys are narrower than 32 px (27 px at 320 px), because ten 32 px keys do not fit (design F7).
- Not in these tasks: the human visual checks 10.1 and 19.2 (still open) and any change to `kiro-log.md`.

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
    { "id": 14, "tasks": ["19.3"] },
    { "id": 15, "tasks": ["22.1", "22.3"] },
    { "id": 16, "tasks": ["22.2", "22.4", "22.6"] },
    { "id": 17, "tasks": ["22.5"] },
    { "id": 18, "tasks": ["22.7"] },
    { "id": 19, "tasks": ["24.1", "24.2", "24.3", "24.4", "24.9", "24.10"] },
    { "id": 20, "tasks": ["24.5", "24.6", "24.7", "24.8"] },
    { "id": 21, "tasks": ["24.11"] },
    { "id": 22, "tasks": ["24.12"] }
  ]
}
```
