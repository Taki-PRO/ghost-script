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
- Tasks that edit `app/src/styles/index.css` are in different waves: 2.2, 3.3, 6.1, 7.3, 12.2 and 12.6. Tasks that edit `e2e/helpers.ts` (12.8) and `app/src/modes/WriteMode.tsx` (7.2, 12.7) are also in different waves.
- Tasks 12.1 to 12.12 implement the follow-up from the human's screenshot review (design, "Follow-up: screenshot review"), approved by the human. They add unit and component tests only, no property test and no mutation test, and they write no `kiro-log.md` entry.
- Tasks 15.1 to 15.12 implement the intro fix from the human's review (design, "Follow-up: intro fix"), approved by the human. They add unit and component tests only (plus e2e specs), no property test and no mutation test, and no task writes a `kiro-log.md` entry. `index.css` is edited by 15.3 (wave 14) and 15.6 (wave 15) only; `theme.ts` by 15.3 (wave 14) and 15.7 (wave 15) only; `e2e/helpers.ts` by 15.4 (wave 14) only; `app/src/App.tsx` by 15.2 only. Task 15.7 does not edit `index.css`.

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

- [x] 12. Follow-up from the screenshot review (approved by the human)
  - [x] 12.1 Update the Steering_File and its test
    - In `.kiro/steering/art-direction.md` add: the Moon is a full disc of 4 rem in the top right that never lies under text, with a top room of 4.75 rem below 992 px; the Mist has two bands (0.18 at 88%, 0.10 at 72%); the ghost is an ink wash with the same shape everywhere; the seal sits in the paper margin and covers no stroke. Keep `inclusion: always`, the Primary_Action table and the named ambient exemptions.
    - Extend `tests/unit/steering-art-direction.test.ts`: the new rules are present and no personal name appears.
    - _Requirements: 1.2, 1.4, 8.3, 8.4, 13.1_
  - [x] 12.2 Moon, Moon_Room and mist in `index.css`, with `moonRoom.ts`
    - In `app/src/styles/index.css`: add `--moon-size`, `--moon-inset-x`, `--moon-inset-y`, `--moon-room` (a `clamp()` step at 992px, no `@media`), `--mist-a-alpha` 0.18, `--mist-b-alpha` 0.10; remove `--mist-peak-alpha`; set `--moon-disc-alpha` to 0.65 (amended from 0.70, approved by the human); replace the two moon gradients of `body::before` by the full disc and the 7 rem halo; set the two mist layers to the ellipses of the design (band A at 88%, band B at 72%); add `#root { padding-top: var(--moon-room) }`, `#root > main { min-height: calc(100vh - var(--moon-room)) }` (with a `100dvh` rule for the compact shell) and `.sticky-below-moon { top: var(--moon-room) }`.
    - Create `app/src/engine/moonRoom.ts` with `MOON_ROOM_PX` (76), `MOON_ROOM_BREAKPOINT_PX` (992) and `moonRoomPx(width)`; add `moonRoom.test.ts`.
    - Update `app/src/styles/index.css.test.ts`: replace the tests for `circle 1.6rem at 82% 0%`, `circle 9rem`, the four-ellipse extents and `--mist-peak-alpha` of 0.09 with the tests of the design (Moon custom properties and inset rule, halo at most 0.10, disc alpha above halo alpha, `--moon-room` has `clamp(` and `992px`, only the one no-preference `@media` block, `#root` padding, `.sticky-below-moon`; two mist bands with disjoint extents in the lower third and alpha A at least 1.5 times B; each text token at 4.5:1 on band A at 88%, band B at 72% and the halo composite; `ink` and `error` at 4.5:1 on the disc composite). Keep the threshold at 4.5.
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.10, 8.11, 8.13_
  - [x] 12.3 Ink wash in `GhostFigure.tsx`
    - Add the tone `linearGradient`, the darker wash `radialGradient` path, the blurred hem path and the `feGaussianBlur` filter, all with ids built from the one `useId` value; keep `GHOST_PATH`, `GHOST_EYE_PATHS`, `aria-hidden`, `focusable="false"` and no `text`.
    - Update `GhostFigure.test.tsx` as in the design (gradients, three silhouette paths, two filters, disjoint and resolvable ids for two instances, no text) and add to the favicon test: no `linearGradient` or `radialGradient`, no `filter`, path equals `GHOST_PATH`. Leave `app/public/favicon.svg` unchanged.
    - _Requirements: 6.1, 6.4, 6.5, 6.6, 6.9, 6.10, 6.11, 7.5, 7.6_
  - [x] 12.4 Paper-slip legend in `IntroScreen.tsx`
    - Make the figure a `card-slip`; move `ink-reveal` to the `blockquote`; set the Chinese line at `text-3xl sm:text-4xl` in ink on paper and the English line and the caption in ink on paper; remove `bg-surface`, `text-ghost` and `text-muted` from the figure. Keep the text, "wept" and the citation unchanged.
    - Update `IntroScreen.test.tsx` as in the design; keep every existing assertion that still applies.
    - _Requirements: 9.2, 9.4, 9.9, 9.10_
  - [x] 12.5 Sticky header of Sources & licences below the Moon_Room
    - In `app/src/components/Credits.tsx` replace `top-0` of the sticky header by the class `sticky-below-moon`.
    - Update `Credits.test.tsx`: the header has `sticky-below-moon` and no `top-0`.
    - _Requirements: 8.11_
  - [x] 12.6 Hillside, stone tablets and tilt in `Graveyard.tsx`
    - Create `app/src/engine/tabletTilt.ts` (`TABLET_TILTS_DEG` and `tabletTilt(position)`) and `tabletTilt.test.ts`.
    - In `Graveyard.tsx` add the `aria-hidden` SVG hillside behind the grid, the arched outlines (no dotted or dashed border on `unmet`), the `tablet-tilt-N` class and `.sticky-below-moon` on the header; keep the markers, counts, accessible names, never-reveal types and the empty-state line.
    - In `index.css` add the stone backgrounds, the arched radii, the `.tablet-tilt-0` to `.tablet-tilt-4` rules and the unmet rule; keep the glow, the wisp and the single no-preference block. Extend `index.css.test.ts` (tilt rules equal the pattern, `unmet` has no border) and `Graveyard.test.tsx` as in the design.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.6, 15.10, 15.11, 15.12, 15.13, 15.14, 8.11_
  - [x] 12.7 Seal in the paper margin and hanzi-writer padding
    - Create `app/src/engine/sealLayout.ts` exporting `WRITE_PADDING_PX` (40), `SEAL_SIZE_PX` (32), `SEAL_INSET_PX` (4) and `SEAL_CLEARANCE_PX`; add `sealLayout.test.ts` (clearance at least 4).
    - In `SealStamp.tsx` use the three constants for width, height, bottom and right and set the glyph to 24 px; in `WriteMode.tsx` pass `padding: WRITE_PADDING_PX` and subtract `moonRoomPx(window.innerWidth)` through `reservedPx` when it computes the surface size.
    - Update `SealStamp.test.tsx` (24 px glyph, size and offsets from the constants; role, label, `aria-hidden` and pointer-events tests stay) and `WriteMode.test.tsx` (`padding` equals `WRITE_PADDING_PX`; the other options unchanged). Fix any other test that asserts `padding: 12`, 28 px or `h-12 w-12`.
    - _Requirements: 12.8, 13.1, 13.4, 13.9, 13.13, 13.15_
  - [x] 12.8 Add the e2e helpers for the Moon and the seal
    - In `e2e/helpers.ts` add `moonDisc(page)` (reads `--moon-size`, `--moon-inset-x`, `--moon-inset-y`, resolves rem to pixels and returns the disc box), `moonIntruders(page)` and `expectMoonInside(page)` (moved from `screenshots.spec.ts`), and `layToRestClean(page, character)` (types the code read from `characters.json`, then draws every stroke from the `hanzi-writer-data` medians through the `getScreenCTM()` of the writer's positioned group).
    - _Requirements: 8.12, 13.14_
  - [x] 12.9 Retake the eight screenshots and extend the moon check
    - In `e2e/screenshots.spec.ts` use the helpers of 12.8 instead of the regular expression over `background-image`; run the moon check in every view at both viewports and fail if the disc is cut off by a viewport edge; add a 320 × 640 moon check on the intro, the Summon step and the Graveyard; make the Write-step view lay a real character to rest `clean` with `layToRestClean` so the PNG shows the seal; write the same eight PNG names as before.
    - Run `npm run test:e2e -- screenshots` and confirm that all eight PNGs exist and are not empty.
    - _Requirements: 8.12, 20.1, 20.2, 20.3, 20.7, 20.8_
  - [x] 12.10 Add `e2e/seal-margin.spec.ts`
    - At 1024 × 768 and 375 × 812, lay a real character to rest `clean`, then compare the Seal_Stamp box with the box of every `path` in the writer SVG (at least 2 px apart, no overlap) and check that the stamp lies inside the paper box.
    - _Requirements: 13.13, 13.14_
  - [x] 12.11 Add `e2e/graveyard-fit.spec.ts`
    - Seed at-rest, restless and unmet tablets and call `findOverflow` at 320, 375 and 1440 CSS pixels; fail on any overflow. Also check at scroll 0 at 375 × 812 and 320 × 640 that the sticky header row starts at or below the Moon_Room.
    - _Requirements: 8.11, 15.7, 15.14_
  - [x] 12.12 Record the amendments in `visual-identity`
    - In `.kiro/specs/visual-identity/requirements.md` add an "Amended (approved by the human, screenshot review)" note to 21.3, 21.4 and 21.6 (mist, moon and composite), pointing to Requirements 8.3 to 8.5 of this spec.
    - _Requirements: 22.3, 22.4_

- [x] 13. Review again
  - [x] 13.1 Re-run the accuracy review
    - Run the Accuracy_Reviewer over the changed copy and rules: the Steering_File additions, the IntroScreen legend slip (the line, "wept", the attribution and the Huainanzi citation), the Seal_Stamp label and glyph source (24 px, still the dataset character only and only after a `clean` Outcome), the Graveyard (no decorative Chinese text on the hillside or on `unmet` tablets) and the README screenshot note. Fix every finding within this spec.
    - _Requirements: 13.3, 13.6, 15.5, 18.3, 18.4, 18.7, 21.2_

- [x] 14. Final checkpoint after the screenshot review
  - Run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app`, `npm run check:bundle` (budget 300,000 bytes) and `npm run test:e2e`. All must pass, with `fits-one-screen.spec.ts` and `no-horizontal-overflow.spec.ts` at their old thresholds. Ask the human if any question arises.
  - _Requirements: 19.4, 21.3_

- [x] 15. Intro fix and night-scene follow-up (approved by the human)
  - [x] 15.1 Record the intro's Sources link in `content-accuracy.md`
    - Steering edit, approved by the human. In `.kiro/steering/content-accuracy.md` add a section "The intro cites by link": the intro shows no raw citation; its "Sources" link opens the Sources & licences screen, which carries `CANGJIE_CITATIONS` (the English Wikipedia articles "Cangjie input method" and "Chu Bong-Foo", for the intro's Cangjie claim) and `LEGEND_SOURCE.citation` (the Huainanzi line); that link satisfies the citation rule for the intro's Cangjie claim and for the legend line. Keep every other rule and the approved legend line unchanged.
    - Add `tests/unit/content-accuracy-intro-link.test.ts`: reads the steering file and checks the section heading, the words "Sources & licences", `CANGJIE_CITATIONS` and `LEGEND_SOURCE.citation`, and that the "Approved legend line" section is still present. The no-personal-names test must stay green.
    - Files: `.kiro/steering/content-accuracy.md`, `tests/unit/content-accuracy-intro-link.test.ts`.
    - _Requirements: 23.11, 18.5_
  - [x] 15.2 Intro fits one screen: Sources link, no raw citations, Credits origin
    - `app/src/components/IntroScreen.tsx`: remove the sources line (`CANGJIE_CITATIONS`) and the `LEGEND_SOURCE.citation` span and their `data-testid`s; keep the caption sentence; add the required prop `onOpenSources` and the Sources_Link (`<button type="button">`, text "Sources", `inline-flex min-h-[44px] items-center text-sm text-ghost underline`, the shared focus ring, no `slip` or `slip-primary`) below the "Begin the Séance" button; drop `min-h-screen`, `px-6` and `py-10` from the root; apply the sizes of the design table (ghost `h-12 w-10 sm:h-24 sm:w-20`, `h1` `text-4xl sm:text-5xl` with line height 1.1, paragraphs `text-base leading-snug sm:text-lg`, tighter spacing below 640 px, slip padding, button `py-2 sm:py-3`). Keep the Legend_Line at `text-3xl sm:text-4xl`, `ink-reveal` on the `blockquote`, the text of both paragraphs and the one Primary_Action.
    - `app/src/App.tsx`: change the credits view to `{ screen: 'credits'; dataset; origin: 'menu' | 'intro' }`; the menu passes `origin: 'menu'`, the intro passes `onOpenSources={() => setView({ screen: 'credits', dataset, origin: 'intro' })}`; `onBack` returns to the menu or to `{ screen: 'intro', dataset }` by `origin`; give `Shell` a `tight` prop (`min-h-screen px-4 py-2`) and use it for the intro. Do not call `setIntroSeen` on this path.
    - `app/src/components/Credits.tsx`: add `backTo?: 'menu' | 'intro'` (default `'menu'`); the button text and `aria-label` are "Back to menu" or "Back to the intro".
    - Tests: `IntroScreen.test.tsx` (no text matches `http`; the button named "Sources" calls `onOpenSources`; it has neither `slip-primary` nor `slip`; the caption sentence is present; the root has no `min-h-screen`; the `h1` has `text-4xl` and `sm:text-5xl`; replace every assertion on the removed `data-testid`s; keep the new-sentence, old-sentence, Legend_Line, "wept" and primary-class assertions); `Credits.test.tsx` (both back labels; every `CANGJIE_CITATIONS` entry and the full `LEGEND_SOURCE.citation` are present; keep the sticky-header assertions); `App.test.tsx` (intro to Sources shows "Back to the intro", Back shows the intro again, `introSeen` in storage is unchanged; menu to Sources shows "Back to menu" and returns to the menu).
    - Files: `app/src/components/IntroScreen.tsx`, `app/src/components/IntroScreen.test.tsx`, `app/src/components/Credits.tsx`, `app/src/components/Credits.test.tsx`, `app/src/App.tsx`, `app/src/App.test.tsx`.
    - _Requirements: 9.1, 9.2, 23.1, 23.2, 23.3, 23.4, 23.5, 23.7, 23.8, 23.9, 23.10, 10.3, 10.7_
  - [x] 15.3 Cover the full page height: Canvas_Sky, Document_Layers and `skyHold`
    - `app/src/styles/theme.ts`: add `skyHold: '#101c38'`. `theme.test.ts`: `skyHold` equals the old sky at 88% (blend of `nightMid` and `nightLow` at 33/45, within 1 per channel); `ink`, `error`, `ghost`, `muted` and `success` keep 4.5:1 on `skyHold`; recompute with `contrastRatio` and adjust the value, not the threshold, if one fails.
    - `app/src/styles/index.css`: add `--sky-hold`; put the Canvas_Sky on `html` (`background-color: var(--sky-hold)`, one `linear-gradient(180deg, var(--night-top) 0%, var(--night-mid) 55%, var(--sky-hold) 88%, var(--sky-hold) 100%)`, `background-size: 100% 100vh`, `no-repeat`); remove `bg-background` from `body` in `@layer base` and give `body` `position: relative` and `overflow-x: clip` (preceded by an `overflow-x: hidden` fallback line); remove the sky, vignette and grain layers from `body::before` (it keeps only the Moon disc and halo); add `#root::after` (absolute, `top: 0; bottom: 0; left: 0; right: 0`, `z-index: -1`, `pointer-events: none`, grain over vignette with the same gradients as before); make `body::after` and `#root::before` `position: absolute` (not fixed) with `background-size: 100% 100vh` and `background-repeat: repeat-y`; remove both `will-change: transform` lines; keep the drift keyframes inside the no-preference block and the single-block rule.
    - `app/src/styles/index.css.test.ts`: update every test that reads these layers (the layer-order test of `body::before`, the `position: fixed` assertions of the mist layers, the pointer-events list, which gains `#root::after`); add the tests of Requirement 24.9; change `sky(y)` of the composite test to follow the new gradient (unchanged up to 88, `skyHold` above); keep every threshold at 4.5.
    - Confirm by running `npm test` that no other test reads the removed `bg-background` body style.
    - Files: `app/src/styles/theme.ts`, `app/src/styles/theme.test.ts`, `app/src/styles/index.css`, `app/src/styles/index.css.test.ts`.
    - _Requirements: 8.2, 8.4, 8.5, 8.6, 8.7, 8.8, 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.9_
  - [x] 15.4 Add the e2e helpers for the ink wait and for full-page pixels
    - In `e2e/helpers.ts` add `waitForInkReveal(page)` (awaits `finished` of every animation of `blockquote.ink-reveal`, then fails unless all `playState`s are `finished`; resolves at once when there are none), `pixelsAt(page, png, points)` (decodes a PNG buffer in a second page with `createImageBitmap` and a canvas and returns `[r, g, b]` per point; no new dependency), `luminance(rgb)` and `luminanceRatio(a, b)` (`(L1 + 0.05) / (L2 + 0.05)`, the WCAG formula, lighter over darker), and `seedGraveyard(page)` that seeds one at-rest, one restless and one gave-up character as `graveyard-fit.spec.ts` does and opens the Graveyard. Leave every existing export unchanged.
    - Files: `e2e/helpers.ts`.
    - _Requirements: 20.9, 24.7, 25.3, 25.9_
  - [x] 15.5 Update the Steering_File `art-direction.md` and its test
    - In `.kiro/steering/art-direction.md` add: the Moon disc has a soft off-centre shading (darker toward the lower right); the night sky, the grain and the mist cover the full page height on screens that scroll, with the mist repeating once per screen-high tile; the intro shows no raw citation and links to the Sources & licences screen with one small "Sources" link that is not a Primary_Action. Keep `inclusion: always`, the Primary_Action table and the named ambient exemptions.
    - Extend `tests/unit/steering-art-direction.test.ts`: the three new rules are present, the table still lists "Begin the Séance" for the intro, and no personal name appears.
    - Files: `.kiro/steering/art-direction.md`, `tests/unit/steering-art-direction.test.ts`.
    - _Requirements: 1.4, 1.5, 23.2, 24.4, 25.1_
  - [x] 15.6 Shade the Moon in `index.css`
    - In `app/src/styles/index.css` add `--moon-shade-alpha: 0.35`, `--moon-shade-offset: 0.5rem`, `--moon-shade-radius: 1.25rem` and the Moon_Shade `radial-gradient` as the first layer of `body::before`, above the disc (design, section 6).
    - In `index.css.test.ts`: allow the shade's `rgb(5 8 19 / var(--moon-shade-alpha))` in the test that rejects other `rgb(... / var(--moon` colours; test that the three properties exist, that the shade is the first layer of `body::before`, that `offset × √2 + radius` is at most `--moon-size / 2`, that `ink` and `error` keep 4.5:1 at the lightest point and at the darkest point (paint order: sky at 2%, halo, disc, shade, grain) and that the luminance ratio of the two points is at least 1.25. Keep the existing disc and halo tests.
    - Files: `app/src/styles/index.css`, `app/src/styles/index.css.test.ts`.
    - _Requirements: 8.3, 8.13, 25.1, 25.2, 25.3, 25.4_
  - [x] 15.7 Make the Hillside visible in `Graveyard.tsx`
    - In `app/src/styles/theme.ts` add `hillFar: '#202c4c'` and `hillNear: '#161e38'`; in `theme.test.ts` check `hillFar` against the sky at 30% (from `nightTop` and `nightMid`) at 1.3:1 and `hillNear` against `hillFar` at 1.1:1; adjust the colours, not the thresholds, if one fails.
    - In `app/src/components/Graveyard.tsx` replace the full-height SVG by the fixed-height one of the design (`HILL_HEIGHT_REM` = 12, `h-48`, `top-0`, `viewBox="0 0 100 48"`, `preserveAspectRatio="none"`, the two ridge paths with `theme.hillFar` and `theme.hillNear`, `aria-hidden`, `focusable="false"`, `data-testid="hillside"`) and give the wrapper the `linear-gradient(to bottom, transparent 12rem, hillNear 12rem)` background image; no literal colour in the component. Do not edit `index.css`; if the palette-variable test requires every token to be mirrored, exempt the two tokens in that test.
    - In `Graveyard.test.tsx`: the viewBox, the two path fills equal the theme tokens, the wrapper background names `hillNear`, no `text`, `aria-hidden`; keep every never-reveal, marker, name and tilt test.
    - Files: `app/src/styles/theme.ts`, `app/src/styles/theme.test.ts`, `app/src/components/Graveyard.tsx`, `app/src/components/Graveyard.test.tsx`.
    - _Requirements: 15.11, 25.5, 25.6, 25.7, 25.10_
  - [x] 15.8 Add the intro to `e2e/fits-one-screen.spec.ts`
    - The human explicitly allows editing this file to add the intro. After the existing loop, add one `test.describe` over 1024 × 768, 375 × 812 and 320 × 640 with `introSeen: false`: `expectInside` for the "Begin the Séance" button and for the "Sources" button, then `expectNoVerticalScroll`. Do not change any existing line, viewport or assertion of the file.
    - Files: `e2e/fits-one-screen.spec.ts`.
    - _Requirements: 23.6, 19.4_
  - [x] 15.9 Run the accuracy review on the changed intro
    - Run the Accuracy_Reviewer over `IntroScreen.tsx` and its copy (the remaining paragraphs, the Legend_Line, "wept", the caption sentence, the "Sources" link), the Credits sections `The legend` and `Cangjie`, the new section of `content-accuracy.md` and the new rules of `art-direction.md`. Check that no claim lost its source: each claim of the intro must be reachable through the Sources_Link. Fix every finding within this spec; any fix may edit the files of 15.1, 15.2 and 15.5 only.
    - Files: those of 15.1, 15.2 and 15.5, only if a finding needs a fix.
    - _Requirements: 23.12, 18.5, 18.7, 21.2_
  - [x] 15.10 Add `e2e/night-scene.spec.ts`
    - New spec. At 375 × 812 and 1024 × 768, on the Graveyard (`seedGraveyard`) and on the Sources_Screen (opened from the menu): assert the page is taller than the viewport; read the computed styles of Requirement 24.8; take a Full_Page_Capture from scroll 0 and check the strip, the blue tint and the three sample points of Requirement 24.7 with `pixelsAt`. At the same two sizes on the intro, sample the screenshot at the lit and the shaded Moon points and check the luminance ratio of Requirement 25.3 (call `waitForInkReveal` first so that the capture is stable).
    - Files: `e2e/night-scene.spec.ts` (new).
    - _Requirements: 24.7, 24.8, 25.3_
  - [x] 15.11 Add the hill checks to `e2e/graveyard-fit.spec.ts`
    - At 375 × 812 and 1024 × 768 add a `describe` with the checks of Requirement 25.8 (SVG box contains the first row; the far ridge top lies between the first row's top and the second row's bottom) and 25.9 (the pixel sample at the left end of the far ridge). Do not change the existing tests of the file.
    - Files: `e2e/graveyard-fit.spec.ts`.
    - _Requirements: 25.8, 25.9_
  - [x] 15.12 Wait for the legend ink and retake the eight screenshots
    - In `e2e/screenshots.spec.ts` call `waitForInkReveal(page)` in both intro tests (the PNG test and the 320 × 640 moon check) before `expectMoonInside` and `save`; do not emulate reduced motion. Run `npm run test:e2e -- screenshots` and confirm that all eight PNGs exist and are not empty. Open the intro PNGs only to check that the Legend_Line is complete, the Moon shows its shade and the Graveyard PNG shows the hill behind the first rows.
    - Files: `e2e/screenshots.spec.ts`.
    - _Requirements: 20.9, 20.10_

- [x] 16. Final checkpoint after the intro fix
  - Run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app`, `npm run check:bundle` (budget 300,000 bytes) and `npm run test:e2e`. All must pass, with `fits-one-screen.spec.ts` (existing checks), `no-horizontal-overflow.spec.ts` and `seal-margin.spec.ts` at their old thresholds. Ask the human if any question arises.
  - _Requirements: 19.4, 21.3, 23.6, 24.7, 24.8_

## Notes

- Tasks 12.1 to 14 are the follow-up from the human's screenshot review. 12.2 and 12.6 both edit `index.css` and `index.css.test.ts`, so they are in waves 9 and 10; 12.2 creates `moonRoom.ts`, which 12.7 imports in wave 10.
- Tests are part of each task and are not optional, because the repo rule requires tests for new code. They are unit and component tests only.
- The waves keep each file in one task per wave. `index.css` is edited by 2.2, 3.3, 6.1 and 7.3 in four different waves; `README.md` by 3.4 and 9.1 in two different waves; `tailwind.config.ts` by 2.1 and 3.3 in two different waves.
- Task 10.2 is human-only and is not a coding task.
- The decisions Q1 to Q13 in the design ("Decisions") fix the choices used here.
- No task writes `kiro-log.md`. Any log entry is human-only and is not part of this plan.
- Tasks 15.1 to 16 are the intro fix. 15.3 and 15.6 both edit `index.css` and `index.css.test.ts`, so they are in waves 14 and 15; 15.3 and 15.7 both edit `theme.ts`, so they are also in waves 14 and 15. 15.2 owns `IntroScreen.tsx`, `Credits.tsx` and `App.tsx`; 15.9 can touch them only in a later wave. The e2e specs 15.8, 15.10, 15.11 and 15.12 each own one file and use the helpers of 15.4.
- Measured, not guessed: the intro layout, the full-page diagnosis and the Moon and hill numbers in the design were measured on the committed build; the tasks re-measure on the real code and adjust values, not thresholds.

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
    { "id": 8, "tasks": ["10.2", "10.3"] },
    { "id": 9, "tasks": ["12.1", "12.2", "12.3", "12.4"] },
    { "id": 10, "tasks": ["12.5", "12.6", "12.7"] },
    { "id": 11, "tasks": ["12.8", "12.12"] },
    { "id": 12, "tasks": ["12.9", "12.10", "12.11"] },
    { "id": 13, "tasks": ["13.1"] },
    { "id": 14, "tasks": ["15.1", "15.2", "15.3", "15.4", "15.5"] },
    { "id": 15, "tasks": ["15.6", "15.7", "15.8", "15.9"] },
    { "id": 16, "tasks": ["15.10", "15.11"] },
    { "id": 17, "tasks": ["15.12"] }
  ]
}
```
