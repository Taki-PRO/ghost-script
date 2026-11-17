# Implementation Plan: ink-and-candlelight

## Overview

The plan builds the art direction in layers: steering first, then tokens and the font pipeline, then the ghost, then the screens, the night scene, the rite effects, the screenshots and the reviews. Tests are written inside each task as unit and component tests, never as separate optional tasks, because `tech.md` requires tests for new code. No task adds a property-based test or a mutation test.

Rules for the implementer:

- Task 1.1 runs first and alone. Do not change any other file before the steering file exists.
- The human approved the decisions Q1 to Q13 (design, "Decisions"), with Q10 changed. Where a task says "default", it means the approved choice; build exactly that.
- Task 10.2 is human-only: Kiro skips it. No task in this plan writes `kiro-log.md`; the human keeps that log, and an entry for this feature is a human-only step outside this plan.
- Never edit `app/src/engine/scheduler.ts`, `config.ts`, `outcome.ts`, `learningOrder.ts`, `cangjie.ts`, `app/src/storage/storage.ts` or `app/public/data/characters.json`.
- Never write a personal name in any file. Write "approved by the human".
- Never add Chinese text for decoration. Every glyph comes from the dataset, `CANGJIE_KEYS` or the Legend_Line.
- Tasks that edit `app/src/styles/index.css` are in different waves: 2.2, 3.3, 6.1, 7.3.

## Tasks

- [x] 1. Steering first
  - [x] 1.1 Create `.kiro/steering/art-direction.md`
    - Front matter with `inclusion: always`, then the one-line direction, the palette rules, the ghost rule, the motion rules (200 to 600 ms for causal motion, the named ambient exemptions and the rite timings as decided in Q2 and Q12), the cultural-care rules and the Primary_Action table of the design.
    - Add a unit test `tests/steering-art-direction.test.ts` that reads the file and checks the front matter value `inclusion: always`, the presence of each section heading and the absence of a personal name pattern from the repo's existing name check, if one exists.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Palette and tokens
  - [x] 2.1 Add and change tokens in `theme.ts`, `tailwind.config.ts` and `theme.test.ts`
    - Add `paperLabel`, `sealLight`, `hintInk`; change `seal`, `ghost`, `success`, `error` and `gridLine` to the values in the design; add the Tailwind colour names and a `boxShadow` named `candle-glow` for glows.
    - Extend `theme.test.ts`: `paperLabel` on `seal` at 4.5, `sealLight` on every dark background at 4.5, `hintInk` on paper at 4.5, `ghost`, `error`, `success`, `muted` and `ink` on every dark background at 4.5, `seal` on `paper` at 3, the Seal_Stamp inner border on `seal` at 3, the primary border on `nightLow` at 3. Remove the tests that require `candle` as a fill or `background` on `candle`.
    - Recompute every ratio with `contrastRatio`; if a proposed value fails, adjust the value, not the threshold, and record the new value in the design table.
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 4.2, 4.3, 4.4, 5.2, 5.3_
  - [x] 2.2 Palette variables, Paper_Slip classes and focus ring in `index.css`
    - Mirror the new tokens as custom properties; add `.slip`, `.slip-primary` and `.card-slip` in `@layer components`; replace the candle focus ring with the aged-paper ring plus glow (default of Q3).
    - Update `index.css.test.ts`: palette variables equal `theme.ts`; replace the test "colours every focus ring with the candle"; add a test that `candle` appears only inside `box-shadow` and gradient values; keep the single no-preference block test.
    - Add `tests/candle-usage.test.ts` that scans `app/src` for `bg-candle`, `border-candle` and `text-candle`.
    - _Requirements: 2.3, 2.4, 3.2, 3.3, 3.4, 3.5, 10.1, 10.2_

- [x] 3. Chinese font
  - [x] 3.1 Write the Font_Pipeline `scripts/build-font.ts`
    - Add `subset-font` at an exact version to the root `devDependencies` and the script `build:font` to the root `package.json`.
    - Export the pure functions `collectGlyphSet`, `missingGlyphs` and `unicodeRange`, and `buildFont`. Download the pinned release file if absent into `data/raw/fonts/cache/` (add to `.gitignore`), check its SHA-256 against `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b`, subset, write the subset, `data/fonts/glyph-set.txt`, `app/src/styles/fonts.css` and print bytes, gzip bytes and SHA-256.
    - Write `tests/build-font.test.ts` with fixtures: comments are excluded, strings included, sorted unique output, `unicodeRange` ranges, missing glyph reports, checksum mismatch exits non-zero.
    - Copy `OFL.txt` of tag v1.530 to `data/raw/fonts/lxgw-wenkai/OFL.txt` verbatim and create `data/raw/fonts/SOURCES.md` with the fields of the design's `FontSourceRecord`.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.8_
  - [x] 3.2 Run the pipeline and commit its outputs
    - Run `npm run build:font`; commit `app/src/assets/fonts/lxgw-wenkai-subset.woff2`, `data/fonts/glyph-set.txt`, `app/src/styles/fonts.css` and the subset SHA-256 in `SOURCES.md`.
    - Run it twice and confirm identical SHA-256. The design measured 64,708 bytes WOFF2, 64,746 bytes gzip and 316 characters; record the real values and stop if the glyph count or any missing glyph differs.
    - Add `tests/font-outputs.test.ts`: the glyph set computed from the repo equals `glyph-set.txt`; the committed subset's SHA-256 equals `SOURCES.md`; the subset file is under 100,000 bytes.
    - _Requirements: 16.3, 16.4, 16.5, 16.11_
  - [x] 3.3 Wire the font into the app
    - Import `fonts.css` in `app/src/main.tsx`; put `"LXGW WenKai Subset"` first in `[lang='zh']` in `index.css` and in the Tailwind `hanzi` family, keeping the old stack after it; keep the existing test that the two stacks are equal.
    - Allow exactly the one font URL in the `url()` test by testing `fonts.css` separately from `index.css`.
    - _Requirements: 16.6, 16.7, 8.9_
  - [x] 3.4 Record the font in Credits, README and notices
    - Add the WenKai entry to `FONTS` in `credits.ts` (name, licence, both copyright lines, release, URL); rewrite the Chinese-text sentence in `Credits.tsx` as in the design; change the Credits "Back to menu" button to a Paper_Slip.
    - Extend `build-notices.ts` to append the verbatim `OFL.txt` after the packages; regenerate `THIRD_PARTY_NOTICES.txt`; keep the determinism test green.
    - Update the README Fonts bullet, "Data and licences", and add a `build:font` usage line. Extend the README-versus-`FONTS` test.
    - _Requirements: 16.8, 16.9, 16.10, 16.11, 16.14, 21.4_

- [x] 4. The ghost
  - [x] 4.1 Draw the Ink_Ghost in `GhostFigure.tsx` and replace the favicon
    - Export `GHOST_PATH` and `GHOST_EYE_PATHS`; add the per-instance filter (`useId`, `feTurbulence`, `feDisplacementMap`); keep `aria-hidden`, `focusable="false"` and no text element.
    - Replace `app/public/favicon.svg` with an unfiltered path of the same silhouette with a rough edge baked into the geometry, at most 4,096 bytes.
    - Update `GhostFigure.test.tsx` (one body path, a filter with both primitives, unique ids for two instances, no `text`, no props from a character) and add a test that reads the favicon, rejects any `filter`, and compares its path to `GHOST_PATH`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 7.1, 7.2, 7.3, 7.5_
  - [x] 4.2 Add the Flinch to `GhostPrompt.tsx`
    - Add the optional `flinch?: number` prop and the attribute `data-ghost-flinch`; keep `data-ghost-state` from `ghostStateFor`.
    - Update `GhostPrompt.test.tsx`: the flinch attribute changes with the prop and never changes the state; the target character is absent from text and attributes; the card keeps both sizes.
    - _Requirements: 11.4, 11.6, 11.8, 14.5, 14.6_

- [x] 5. Screens
  - [x] 5.1 Restyle `StartMenu.tsx`
    - Use `.slip-primary` for "Begin a Nightly Séance" and `.slip` for the four others; keep labels, order, callbacks, `aria-describedby` and the caption. Replace the `bg-candle` class.
    - Update `StartMenu.test.tsx`: only the first button carries the primary class; the order and callbacks are unchanged.
    - _Requirements: 3.1, 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_
  - [x] 5.2 Rebuild `IntroScreen.tsx`
    - Add `GhostFigure`, the serif `h1` at `text-5xl`, the new second sentence, the legend figure with the class `ink-reveal` and `.slip-primary` on "Begin the Séance".
    - Update `IntroScreen.test.tsx`: the new sentence is present, the old one is absent, the Legend_Line text is in the DOM, the legend text and attribution match `content-accuracy.md`, the button has the primary class.
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.7, 9.8, 18.3_
  - [x] 5.3 Restyle `CangjieGuide.tsx`
    - Make the continue button a `.slip-primary` and every other button a `.slip`; keep the wording and the citations.
    - Update `CangjieGuide.test.tsx` for the primary class.
    - _Requirements: 10.2, 10.3, 10.4, 10.6_
  - [x] 5.4 Restyle `SessionSummary.tsx`
    - Make "Begin another Séance" a `.slip-primary`; draw the ghost rows as `.card-slip`; keep every row's text and `formatReturn` output.
    - Update `SessionSummary.test.tsx`.
    - _Requirements: 10.1, 10.2, 10.4, 10.7_
  - [x] 5.5 Rebuild the tablets in `Graveyard.tsx`
    - Replace the `grave-*` classes with `tablet`, `tablet-rest`, `tablet-restless` and `tablet-unmet`; keep the markers, accessible names, legend counts, sticky header, never-reveal types and the empty-state line; "Back to menu" is a `.slip`.
    - Update `Graveyard.test.tsx`: the existing never-reveal tests pass unchanged; add the class per state, the marker per state and the accessible name per state.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.10, 10.5_

- [x] 6. Night scene
  - [x] 6.1 Build the Night_Scene in `index.css`
    - Add the Moon, the raised Mist_Band alpha, the Paper_Grain and the Vignette to the existing pseudo-elements. Add no DOM element.
    - Extend `index.css.test.ts`: every `url()` is a `data:` URI; mist drift periods are at least 90 s and inside the no-preference block; the worst-case composite including grain, vignette, mist at 0.09 and the moon halo keeps 4.5:1 for each text token; the pseudo-elements ignore pointer events; the moon halo peak is at most 0.10.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

- [x] 7. The rite: keys, strokes, seal and outcomes
  - [x] 7.1 Keycaps and `onWrongKey` in `SummonStep.tsx`
    - Add the classes `keycap` and `keycap-next`; add the optional `onWrongKey` callback called once per counted miss and never otherwise; leave `SUMMON_HOLD_MS`, `SUMMON_FADE_MS`, `SUMMON_INK_SPEED`, key names, heights and the never-reveal behaviour unchanged. "Give up" is a `.slip`.
    - Update `SummonStep.test.tsx` with tests for `onWrongKey` (called on a miss, not on a hit, a hint or a blocked key); the existing tests run unchanged.
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.9, 17.5, 19.5_
  - [x] 7.2 Seal, ink filter and brush options
    - Create `components/SealStamp.tsx` with the prop `character`: a wrapper `div` with `role="img"` and `aria-label` "Seal: " plus the character; inside it an `aria-hidden` SVG (rough-edged `seal` square, lighter inner border) and an `aria-hidden` `span` with `lang="zh"` holding the glyph at 28 px in `paperLabel`. `pointer-events: none`, no layout space. The glyph comes only from the `character` prop; type no Chinese character in the file. Add `overlay` to `InkSurface.tsx` and the ink-bleed filter (per-surface `useId`, `feTurbulence` plus `feDisplacementMap`, applied to the character group only; drop the filter and record it in the task notes if the selector is brittle in hanzi-writer 3.7.3 (Q6)). Add `sealed` to `WriteMode.tsx`, which passes `<SealStamp character={...} />` with the target character of its dataset record to the overlay only when `sealed` is true; set `drawingWidth` 6, `highlightColor` `hintInk`, `outlineColor` `gridLine`; keep every quiz option and rule.
    - Add `SealStamp.test.tsx`: role `img`; the name is "Seal: " plus the character and contains the character once; the glyph span and the SVG are `aria-hidden`; the glyph equals the prop, has `lang="zh"` and is the only text; no other Chinese text; the glyph size is 28 px and the colour is `paperLabel`; the stamp ignores pointer events. Update `InkSurface.test.tsx` and `WriteMode.test.tsx` (options passed, overlay present only when `sealed`, the stamp gets the target character of the record, and no seal exists while writing before the Outcome).
    - _Requirements: 5.1, 5.2, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.2, 13.3, 13.4, 13.6, 13.9, 13.11, 13.12_
  - [x] 7.3 Motion and rite styles in `index.css`
    - Inside the single no-preference block add `ghost-smoke`, `ghost-linger`, `ghost-slip` (each 600 ms), `ghost-flinch` (400 ms), `seal-stamp` (300 ms), `ink-reveal` (600 ms), the idle float, the idle candle glow and `wisp-rise`; outside it add the static end states for the three outcomes, the keycap look, the tablets, the hillside and the glow and wisp pseudo-elements. Remove the old fade, flicker and drift keyframes.
    - Replace the test "ends the flicker at opacity 0.5" with the test of Requirement 14.2; add a test that every non-ambient animation duration is between 200 ms and 600 ms; add a test that the ambient animations are the named ones.
    - _Requirements: 3.4, 11.4, 11.7, 13.7, 13.8, 14.1, 14.2, 14.3, 14.4, 14.8, 15.9, 17.1, 17.2, 17.4, 9.3_
  - [x] 7.4 Wire the session in `SeanceSession.tsx`
    - Keep a `flinch` count, passed to `GhostPrompt` and incremented by `onWrongKey`; reset it when the ghost changes. Pass `sealed` (combined Outcome `clean`) to `WriteMode`. Style "Next ghost" and "Finish the séance" as `.slip-primary`, the Leave_Prompt "Stay" as `.slip-primary` and the other buttons as `.slip`; while the Leave_Prompt is open, "Next ghost" is a `.slip`.
    - Update `SeanceSession.test.tsx` and `SeanceSession.resultLine.test.tsx`: the flinch is counted; the stamp appears only after a `clean` Outcome and shows the ghost's own character in its name; no element with role `img` and a name that starts with "Seal:" exists during the Summon step, during writing, after a `struggled` Outcome or after a `gave-up` Outcome; one primary per state; all existing Outcome, Leave and focus tests pass unchanged.
    - _Requirements: 10.3, 10.4, 11.5, 11.6, 13.1, 13.10, 13.11, 13.12, 14.7, 19.3_

- [ ] 8. Checkpoint - Ensure all tests pass
  - Run `npm test` and the three `tsc` projects; ask the human if any question arises.

- [x] 9. Screenshots
  - [x] 9.1 Add `e2e/screenshots.spec.ts`
    - Write four PNGs (intro, Summon after one key, Write step, Graveyard with a seeded history) at 1024 × 768 and 375 × 812 to `e2e/screenshots/`; add the folder to `.gitignore` (default of Q13); read every code from `characters.json` at test time; fail if a file is missing or empty. Add the README note.
    - Check by bounding boxes that no control or text lies inside the Moon region at the Rite_Viewports.
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 8.3_

- [ ] 10. Reviews and amendments
  - [x] 10.1 Run the accuracy review
    - Run the Accuracy_Reviewer over the IntroScreen copy, the Steering_File, the Cultural_Care_Rules, the Credits sentence, the README changes, the font licence text (both copyright lines, the reserved-name permission) and the Seal_Stamp: its "Seal: " label, that its glyph comes only from the dataset record, that it exists only after a clean Outcome, and that it adds no new decorative Chinese text. Fix every finding within this spec.
    - _Requirements: 13.3, 13.6, 13.11, 18.3, 18.4, 18.7, 21.2_
  - [ ] 10.2 Human-only: look at the result
    - Kiro skips this task. The human opens the screenshots, compares the glyph forms of 20 Graveyard characters with the Write-step strokes, and checks the screens on a phone. This task changes no file and is not done by an agent.
    - _Requirements: 16.1, 21.2_
  - [x] 10.3 Record approved amendments in the old specs
    - For each question the human approved, add an "Amended (approved by the human)" note to the old requirement in `visual-identity`, `cangjie-seance` and `summon-ink`, as the earlier amendments do. The human approved all of them (design, "Decisions").
    - _Requirements: 22.1, 22.2, 22.3_

- [x] 11. Final checkpoint
  - Run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app`, `npm run check:bundle` (budget 300,000 bytes; projected 201,501) and `npm run test:e2e`. Ask the human if any question arises.
  - _Requirements: 16.12, 19.4, 21.3_

## Notes

- Tests are part of each task and are not optional, because the repo rule requires tests for new code. They are unit and component tests only.
- The waves keep each file in one task per wave. `index.css` is edited by 2.2, 3.3, 6.1 and 7.3 in four different waves; `README.md` by 3.4 and 9.1 in two different waves; `tailwind.config.ts` by 2.1 and 3.3 in two different waves.
- Task 10.2 is human-only and is not a coding task.
- The decisions Q1 to Q13 in the design ("Decisions") fix the choices used here.
- No task writes `kiro-log.md`. Any log entry is human-only and is not part of this plan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.1"] },
    { "id": 3, "tasks": ["3.3", "3.4", "4.2", "5.1", "5.2", "5.3", "5.4", "5.5", "7.1", "7.2"] },
    { "id": 4, "tasks": ["6.1", "7.4"] },
    { "id": 5, "tasks": ["7.3"] },
    { "id": 6, "tasks": ["9.1"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3"] }
  ]
}
```
