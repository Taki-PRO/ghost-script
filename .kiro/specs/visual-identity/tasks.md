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

## Notes

- Task 12.1 runs after every other task. It is a small change requested by the human and adds no new property-based tests.
- No optional tasks: every task is required, including its tests.
- Unit and component tests only. No property-based tests and no mutation tests are added (decision of Nov 15 in `tech.md`).
- Use the `cangjie-oracle` MCP tools (`lookup`, `decompose`) whenever a task needs a Cangjie code or a decomposition. Never write a code by hand.
- Never-reveal: the Graveyard renders glyphs only for Met_Characters, and nothing in the ghost visuals renders the Target_Character before the Rite ends.
- Do not edit the files in Requirement 14.1. If a task seems to need it, stop and ask.
- Wave 0 tasks touch disjoint files: 1.1 (theme, tailwind), 1.2 (`app/package.json`, `main.tsx`), 2.1, 2.2, 3.1, 6.4, 7.1 (`scripts/check-bundle-size.ts`, root `package.json`).
- Task 3.2 needs the font package from 1.2 and edits the root `package.json` after 7.1 (wave 0); task 3.3 edits the root `tsconfig.json` after 8.1 (wave 1); task 6.2 needs `software.ts` from 3.3; task 6.5 needs 6.2.
- `README.md` is edited only by 8.1 and, if the review finds something, by 9.1 (a later wave). `kiro-log.md` is edited only by 8.2.
- Pixel checks cannot run in jsdom. A human checks the layout at 375, 768 and 1440 px before deploy (task 10.1, non-coding). Kiro does not run it and does not log it.
- Approvals are recorded as "approved by Takshil". The approved decisions are in the design under "Approved decisions": the Chinese font stack, Cormorant Garamond 600 Latin with `font-display: swap`, bibliographic names allowed in credits, the Software section with the committed notices file, the colours, the human phone check, one flicker then 0.5 opacity, and 300 kB = 300,000 bytes. No question is open.
- Bibliographic names in citations and credits are allowed (`structure.md`); personal names stay out of repo files.
- The notices file is committed, not generated at build time. After any change to a runtime dependency, run `npm run build:notices` and update `software.ts`.
- Task 8.2 (`kiro-log.md`) stays in the plan.
- Task 10.1 is the only manual, non-coding task. Task 11 is a checkpoint and is not in the dependency graph.

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
    { "id": 7, "tasks": ["12.1"] }
  ]
}
```
