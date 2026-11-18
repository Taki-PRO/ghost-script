# Implementation Plan: night-polish

## Overview

Fix the sticky-header band (Sky_Cap) and add four pieces of polish to the night scene: ghost and brush cursors, Grass in the Graveyard, a Moon that reads as a moon, and livelier paper slips. The plan runs in this order: the human answered the open questions and approved each steering amendment (gate, done); the spec is amended to those answers; then one group per item (Sky_Cap, cursors, grass, moon, slips), each with its implementation and its unit, component and end-to-end tests from the design's testing table; then the steering edits for approved amendments only; a human-only screenshot review; and a final checkpoint.

Rules for every task:

- Task 1 is a gate that the human completed, and every later task depends on it. After the answers, the spec is amended first (task 2: `requirements.md`, `design.md` and this file updated to the human's answers, every "pending the human's answer" marker removed) before any code task runs.
- Kiro never answers an open question or approves an amendment on the human's behalf. An amendment counts as approved only when the design records "approved by the human" next to it; the design records that for A2, A3, A4, A5, A6, A9, A10 and A11.
- Do not edit `kiro-log.md`, `README.md`, any data file or `app/public/data/*`. Do not edit any steering file outside tasks 8.1 to 8.8, and edit it there only for an amendment recorded as approved by the human.
- Never write a personal name in a repository file. Approvals read "approved by the human".
- Add no property-based test and no mutation test (decision of Nov 15, `tech.md`). The existing property tests stay and must pass. Every new test is a unit, component or end-to-end test.
- Never weaken, skip, delete or loosen an existing test, except the assertions listed in the design under "Existing assertions that change" (gaps G1 to G5, approved by the human). The condition of that approval is that no rewrite loosens a test: each rewrite checks the same property at least as strictly as the assertion it replaces. Each task that changes one of them says which and why, and its task report states the old assertion and the new assertion side by side and why the new one is at least as strict. If a rewrite cannot be made at least as strict, the task stops and reports.
- Add no image file, no font, no runtime request and no `any`. Keep logic in `app/src/engine/` and UI in `app/src/components/`.
- Every animation and transition sits inside the one `prefers-reduced-motion: no-preference` block of `app/src/styles/index.css`.
- No commits.

### Kiro features used

- **Specs**: this requirements-first spec (`.kiro/specs/night-polish/`).
- **Steering**: `art-direction.md` is amended only for the amendments approved by the human (tasks 8.1 to 8.8).
- **Playwright e2e**: `e2e/sky-cap.spec.ts`, `e2e/cursors.spec.ts`, `e2e/grass.spec.ts`, `e2e/slips.spec.ts`, and one new test in `e2e/graveyard-fit.spec.ts` (the Grass visibility pixel test).

## Tasks

- [x] 1. Gate: the human answers the open questions and approves or rejects each steering amendment
  - [x] 1.1 HUMAN TASK: Human answers the open questions and approves or rejects each proposed steering amendment
    - Human-only. Kiro does not answer on the human's behalf and does not start any later task until this is done
    - Answer every open question (the answers are recorded in "Decisions approved by the human" in `requirements.md` and `design.md`)
    - Confirm or reject the requirement gaps G1 to G5 (G1: the list of existing `index.css.test.ts` assertions that change) and the brush casing reading of Requirement 3 AC 2
    - Approve or reject each proposed amendment on its own: A2 (ghost silhouette copies), A3 (Moon bullet), A4 (3:1 exemption), A11 (what stays at 3:1), A5 (Slip rule), A6 (Sky_Cap sentence), A9 (Pointer section), A10 (Moon tokens, option 1 or 2). The approval of one does not count for another
    - After the answers, the spec is amended first (task 2), before any code task runs
    - _Requirements: 7.1, 7.7_

- [x] 2. Amend the spec to the human's answers
  - [x] 2.1 Update `requirements.md`, `design.md` and this `tasks.md` to the recorded answers
    - Update the requirements and the design to the chosen answers; remove every "pending the human's answer to Open question N.M" marker and the alternatives that were not chosen, and keep a short "Decisions approved by the human" list instead of the open questions (Requirement 7 AC 7)
    - Write "approved by the human" next to each approved amendment in "Steering amendments"; record the confirmed gap resolutions G1 to G5
    - Edit this `tasks.md` to match: drop or adjust the tasks of any rejected or changed item (for example: global or scoped Sky_Cap, no ghost cursor, no Grass, the disc test kept or replaced, new Moon tokens, `.keycap` included), and mark in tasks 8.1 to 8.8 which amendments are approved
    - Run `validate_spec_format` on each edited document until it reports no errors
    - Edit no code, no steering file, no data file and not `kiro-log.md`
    - _Requirements: 7.1, 7.7, 7.10_

- [x] 3. Sky_Cap (Requirement 1)
  - [x] 3.1 Write the sticky-header e2e test and record it failing on the current build
    - Add the new helpers `discExtent`, `bandPixels` and `reachSummary` to `e2e/helpers.ts`; change no existing helper (`reachSummary` extracts the route of the `first-meeting.spec.ts` summary test)
    - Write `e2e/sky-cap.spec.ts` as in the design (Part 1, "New e2e test"): for the Graveyard, Sources & licences, the Summary screen and the Level screen, at 375 x 812 and 320 x 640; the screen must scroll at least 152 px; if the Summary or the Level screen does not, the test runs it at the same width and a height of 420 px, and fails saying it is not scrollable if it still does not; reference capture at scroll 0 with the cap hidden by an injected style; sample grid of 5 columns by 3 rows minus the points within 7 rem of the Moon centre (at least 3 by 3 remain); offsets 0, one third, two thirds, maximum; tolerance 6 per channel; failure message names screen, viewport, offset, point and colour found; `elementsFromPoint` only names the element beneath in the message
    - In the same file add the Moon checks at every offset (position and 4 rem size within 1 px, luminance ratio at least 1.2 against the point 8 rem left), the header checks (top at 76 px within 1 px below 992 px; top at 0 and cap height `0px` at 1024 x 768; header visible at its centre point), the cap checks (`aria-hidden`, no `tabindex`, same Tab order with and without the cap), `findOverflow` at 320 and 375, and the focus-clearance check (every focusable control of both screens, top edge at or below the Sticky_Header bottom edge)
    - Run `npx playwright test -c e2e/playwright.config.ts e2e/sky-cap.spec.ts` on the current build, before any CSS or component change, after waiting until nothing listens on port 4173. It must fail for the Graveyard and for Sources & licences at both viewports, at one or more offsets above 0. Paste the command, the failing test titles and the first failing message of each into this task's report as the evidence of Requirement 1 AC 18. If it does not fail, stop and report
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18, 1.20, 1.21_
  - [x] 3.2 Add the `SkyCap` component and wire it into `App`
    - Write `app/src/components/SkyCap.tsx` (`div.sky-cap[aria-hidden="true"][data-testid="sky-cap"]`, no props) and `SkyCap.test.tsx`: `aria-hidden`, no `tabindex`, absent from `getByRole` queries
    - In `app/src/App.tsx` rename the current default function `AppScreens` and export a wrapper that renders `<SkyCap />` before it (global scope, approved by the human)
    - Add a case to `App.test.tsx` that exactly one `.sky-cap` is in the tree; change no existing assertion
    - _Requirements: 1.13, 1.14, 1.21_
  - [x] 3.3 Add the Sky_Cap CSS and the scroll padding, with their unit tests
    - In `app/src/styles/index.css` add `.sky-cap` as in the design: `position: fixed`, `top: 0`, `left: 0`, `right: 0` (not `width: 100vw`), `height: var(--moon-room)`, `z-index: 10`, `pointer-events: none`, the ten background layers (vignette, grain, the seven Moon layers copied verbatim from `body::before`, the sky gradient), and `#root:has(> main.no-moon-room) > .sky-cap { display: none; }`; add no `@media` rule for the cap
    - Change `html` to `scroll-padding-top: 7rem` followed by `scroll-padding-top: calc(var(--moon-room) + 7rem)`
    - In `app/src/styles/index.css.test.ts` add `describe('sky cap')`: the rule's properties; `z-index` greater than 0 and less than the header's `z-20` read from `Graveyard.tsx` and `Credits.tsx`; no `width: 100vw`; the Moon layer list of `body::before`, the grain URL of `#root::after` and the sky gradient of `html` each appear verbatim in `.sky-cap`, with equal background list lengths; the effective `scroll-padding-top` value
    - G1 change in this task: the `scene pseudo-elements ignore pointer events` selector list gains `.sky-cap`. Reason: additive, the cap must ignore pointer events (Requirement 1 AC 6). The task report states the old and the new assertion; the new one checks every selector the old one did, plus `.sky-cap`
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.12, 1.20, 5.10_
  - [x] 3.4 Run the Sky_Cap test green and the existing tests that touch the band
    - After waiting for port 4173 to be free, run `e2e/sky-cap.spec.ts` (all pass, same command as 3.1), then `e2e/graveyard-fit.spec.ts`, `e2e/night-scene.spec.ts`, `e2e/screenshots.spec.ts`, `e2e/fits-one-screen.spec.ts` and `e2e/no-horizontal-overflow.spec.ts` without editing any of them; run `npm test -- app/src/styles/index.css.test.ts`
    - Amendment to the sky-cap test (edit `e2e/sky-cap.spec.ts` in this task): task 3.1 found that the Level screen is built to fit one screen, so at 420 px height its scrollHeight is 430 and it cannot scroll 152 px; the Summary screen does scroll enough. For a screen that cannot scroll 152 px at its viewport, the test reruns it at the same width and a height of 420 px, and if it still cannot, at 280 px, and if it still cannot, at 200 px. Task 3.4 found that the Level screen's scrollHeight is 430 px at any viewport height of 420 px or less (its content has a fixed minimum height), so at 280 px it scrolls only 150 px, 2 px short of the 152 px minimum; the 200 px step is the fix. It keeps the 152 px minimum, the offsets, the pixel grid, the tolerance and the Moon checks, and fails as before if the screen cannot scroll 152 px at 200 px. The 420, 280 and 200 px heights are test devices only, not a supported layout, and the one-screen fit tests are unaffected. If the Level screen still cannot scroll 152 px at 200 px, stop and report; do not drop the screen
    - If the focus-clearance check fails at 320 px, raise the `scroll-padding-top` rem value in the same task and say so in the report
    - _Requirements: 1.1, 1.2, 1.15, 1.16, 1.19, 1.20, 8.6_

- [x] 4. Cursors (Requirements 2 and 3)
  - [x] 4.1 Write the pure cursor builder with unit tests
    - Write `app/src/styles/cursors.ts` as in the design (`pathBounds`, `encodeSvg`, `ghostCursor('default' | 'link')`, `brushCursor`, `cursorDeclaration`, exported brush geometry), built from `GHOST_PATH` and `GHOST_EYE_PATHS` of `GhostFigure.tsx`; no cycle (`GhostFigure.tsx` never imports `cursors`)
    - Write `app/src/styles/cursors.test.ts` with the checks of the design's `cursors.test.ts` list that need no CSS file: decoded SVG round-trip with no raw `<`, `>`, `#`, `"`; sizes at most 32 (ghost, link) and 24 (brush); whole-pixel hotspots inside the image (ghost 12 and 1, brush 10 and 10) and within 2 px of the scaled true top of `GHOST_PATH`; silhouette `d` equals `GHOST_PATH` and eye `d` equals `GHOST_EYE_PATHS`; link eyes carry a `transform` and ghost eyes do not; no `filter`, gradient, `<text`, `href` or `url(`; fallbacks `auto` and `crosshair`; contrast at least 3:1 against `background`, `surface`, `paper` and `inkOnPaper` (brush: `paper` and `inkOnPaper`); brush arm width at most 2, no `GHOST_PATH`, no seal red or candle amber, nearest painted point at least 3.5 px from the hotspot; no Han character in any image
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.16, 3.2, 3.3, 3.4, 3.7, 3.8, 3.9, 3.11, 8.12, 8.14_
  - [x] 4.2 Add the `drawable` prop to `InkSurface` and pass it from `WriteMode`
    - In `app/src/components/InkSurface.tsx` add `drawable?: boolean`, setting `data-brush="true"` on the surface div only when true; in `app/src/modes/WriteMode.tsx` pass `drawable`; leave `SummonStep.tsx` unchanged (the Summon paper keeps the ghost cursor, approved by the human)
    - Extend `InkSurface.test.tsx` (`data-brush` only with `drawable`) and the `WriteMode` and `SummonStep` tests (present on Write, absent on Summon); change no existing assertion; the box, `touch-action` and handlers do not change
    - _Requirements: 3.1, 3.5, 3.12_
  - [x] 4.3 Add the cursor declarations to `index.css` and test them
    - In `app/src/styles/index.css`, outside the Motion_Block, add the `@media (hover: hover) and (pointer: fine)` block of the design: the ghost cursor on `body`, the link cursor on enabled `button`, `a[href]`, `[role='button']` and `summary`, `not-allowed` kept on disabled controls, and the brush cursor on `[data-brush='true']` and its descendants; paste the declarations printed by `cursorDeclaration` (never hand-copied); no rule sets `outline`, `box-shadow`, `--tw-shadow`, `animation` or `transition`
    - Add to `cursors.test.ts` the checks that read `index.css`: the three declarations equal the builder's output (on a mismatch the message prints the expected declaration), each URL is double-quoted `data:image/svg+xml,`, an `auto` or `crosshair` fallback follows each URL
    - In `index.css.test.ts` add the cursor checks (no `outline`, `box-shadow`, `--tw-shadow`, `animation`, `transition` in the cursor rules; `button:disabled` keeps `not-allowed`; the cursor media block is outside the Motion_Block; each `url(` is a `data:` URI)
    - G1 change in this task: `has exactly one no-preference block and no other media block` asserts the exact set of `@media` conditions, which is now `(prefers-reduced-motion: no-preference)` once and `(hover: hover) and (pointer: fine)` once (task 7.3 adds the hover conditions); and in `leaves a Moon_Room below 992 px ...` the line `css.match(/@media/g)).toHaveLength(1)` becomes `no @media query mentions 992px`, all other lines unchanged. Reason: Requirement 2 AC 1 needs the pointer query; the intent (no stray queries, no media gate for the Moon_Room) is kept and made stricter. The task report states each old and new assertion; the new ones fail on every stray query the old ones failed on
    - _Requirements: 2.1, 2.2, 2.3, 2.10, 2.11, 2.13, 2.14, 2.15, 3.2, 3.6, 3.13_
  - [x] 4.4 Write the cursor e2e test
    - Write `e2e/cursors.spec.ts`: in a desktop context the computed `cursor` has a `url(` value on `body`, on an enabled button, on `[data-testid="ink-surface"]` on the Write step and its descendants, and on a non-interactive element of the intro, the start menu and the Graveyard; a disabled button is `not-allowed`; the Summon paper does not carry the brush value; in a context with `hasTouch: true` and `isMobile: true` no checked element has a `url(` value; the Write paper keeps `touch-action: none` and equal box sizes of `[data-testid="ink-surface"]` and `[data-testid="ink-container"]` (the Summon paper is the control); the focus ring is unchanged on Tab; with the primary mouse button held on the Write paper (`page.mouse.down()`) the computed `cursor` of `[data-testid="ink-surface"]` equals its value at rest (no change while drawing)
    - After waiting for port 4173 to be free, run `e2e/cursors.spec.ts`; it passes
    - _Requirements: 2.3, 2.10, 2.12, 2.13, 2.17, 3.1, 3.5, 3.6, 3.10, 3.12, 3.14_

- [x] 5. Grass (Requirement 4)
  - [x] 5.1 Record the baseline size and write the pure Grass_Pattern
    - First run `npm run build -w app` and record the summed uncompressed bytes of `app/dist/assets/*.js` and `*.css` in the task report as the baseline
    - Write `app/src/engine/grassPattern.ts` as in the design (`TUFT_SHAPES`, `TABLET_TUFTS`, `HILL_TUFTS`, `HILL_SLOTS`, `FAR_RIDGE_PATH`, `HILL_REM_PER_UNIT`, `tabletTuft`, `hillTuft`); no `Math.random`, no `Date`, no import except types
    - Write `grassPattern.test.ts`: same output for the same input; defined output for positions 0 to 500 and every slot; each shape starts with `M`, every blade ends with `Z`, all coordinates inside the 24 x 9 box, no Han character; `crestY` within 0.05 of the evaluated far ridge; hill tuft boxes inside the wrapper at 296 px (`xPercent * 2.96 >= 24 * scale / 2`); the module source contains neither `Math.random` nor `Date`
    - _Requirements: 4.3, 4.4, 4.5, 8.14_
  - [x] 5.2 Add the `GrassTuft` component
    - Write `app/src/components/GrassTuft.tsx` (`aria-hidden="true"`, `focusable="false"`, one `path` filled with `theme.grass`, no stroke, no `title`, `desc`, text or `lang`) and `GrassTuft.test.tsx`: those attributes, the fill is `grass`, no `style` with animation or transition
    - _Requirements: 4.1, 4.11, 4.15_
  - [x] 5.3 Draw the tufts in the Graveyard
    - In `app/src/components/Graveyard.tsx` import `FAR_RIDGE_PATH` instead of the inline ridge string (no change of output); add one tablet tuft wrapper per `li` (`data-grass="tablet"`, `-z-10`, `pointer-events-none`, `aria-hidden`, at the foot, same in all three states) and the 12 hill tuft wrappers between the hillside `svg` and the grid `ul` (`data-grass="hill"`), as in the design
    - Extend `Graveyard.test.tsx`: one tablet tuft per `li`; 12 hill tufts; `-z-10`, `pointer-events-none`, `aria-hidden`; accessible names, list structure and counts unchanged; the three tablet states keep their text and Marker; no existing assertion changes
    - _Requirements: 4.2, 4.4, 4.6, 4.9, 4.10, 4.12_
  - [x] 5.4 Write the Grass e2e test, add the CSS check and record the size
    - Write `e2e/grass.spec.ts`: each tablet tuft box lies inside its `li`, bottom within 2 px, at most 16 px high; no tablet tuft box meets a Marker or `[lang="zh"]` box at 375 x 812 and 320 x 640 (failure names viewport and tablet position); hill tufts come before the grid in document order and have no `z-index` (gap G2, approved by the human); the computed `overflow` of every tablet is `visible` (Requirement 4 AC 18); `findOverflow` reports nothing at 320, 375, 1024 and 1440; tablet boxes keep their size with the tufts hidden by an injected style
    - In `index.css.test.ts` add the check that no `animation` or `transition` selector mentions grass
    - After waiting for port 4173 to be free, run `e2e/grass.spec.ts` and `e2e/graveyard-fit.spec.ts`; both pass, with the hillside and never-met tablet tests of `night-scene.spec.ts` unchanged and passing
    - Run `npm run build -w app` again and record the added bytes against the baseline of task 5.1; they must be at most 20,480
    - _Requirements: 4.2, 4.5, 4.6, 4.7, 4.8, 4.9, 4.13, 4.14, 4.15, 4.18, 4.19_
  - [x] 5.5 Add the `grass` token with its tests
    - In `app/src/styles/theme.ts` add `grass: '#30505c'` (comment: derived from `hillFar`, hue turned to teal, decorative Grass fill); in `app/src/styles/index.css` add `--grass: #30505c;` to the `:root` token block; edit no steering file here (the palette row is written by task 8.8)
    - In `app/src/styles/theme.test.ts` add cases (no existing case changes): `theme.grass` is `#30505c`; its hue lies between 180 and 230 degrees, its HSL saturation is at most 35 percent and its lightness at most 30 percent (not a bright green); `contrastRatio` of `grass` against `hillNear`, `hillFar`, `nightMid`, `nightLow`, `skyHold`, the never-met stone `#14161c`, the stone gradient ends `#2a2d36` and `#1d2028`, and against the stone and the tuft each mixed with `candle` (`#f0b866`) at the alphas 0, 0.1, 0.17, 0.2 and 0.28, is at least 1.5 in every case (expected values: 1.90, 1.59, 2.17, 1.86, 1.95, 2.09, 1.59, 1.88, and 1.88, 1.81, 1.73, 1.69, 1.59)
    - In `app/src/styles/index.css.test.ts` add a hex check that `--grass` equals `theme.grass` (the same style as the existing token hex checks); change no existing assertion
    - Run `npm test -- app/src/styles` and report the computed ratios
    - _Requirements: 4.11, 4.17, 7.10_
  - [x] 5.6 Write the Grass visibility pixel test
    - In `e2e/graveyard-fit.spec.ts` add one new test, `the Grass stands out from the stone and the hill`, at 375 x 812 and 1024 x 768, placed next to "the far ridge is lighter than the sky"; change no existing test in that file
    - Follow the design (Part 3, "Pixel test"): `reducedMotion: 'reduce'`; open the Graveyard from `seedGraveyard` with tablets of all three states (fail naming the missing state); full-page screenshot A; inject `<style>[data-grass]{visibility:hidden!important}</style>`; full-page screenshot B; for each `[data-grass]` element read its box in document coordinates and count the pixels whose `luminanceRatio` of A against B is at least 1.3 (decode each screenshot once; use `pixelsAt` or a new helper in `e2e/helpers.ts` that adds a helper and changes no existing one)
    - Every tablet tuft must have at least 8 such pixels; at least 6 of the 12 hill tufts must have at least 8; the failure message names the viewport, the kind, the position or slot and the best ratio
    - After waiting for port 4173 to be free, run `npx playwright test -c e2e/playwright.config.ts e2e/graveyard-fit.spec.ts`; all tests pass. Report the pixel counts per kind and viewport. If fewer than 6 hill tufts pass, stop and report instead of lowering a number
    - _Requirements: 4.16_


- [x] 6. Moon (Requirement 5)
  - [x] 6.1 Restyle the Moon in `body::before` and in the Sky_Cap copy
    - In `app/src/styles/index.css` change `--moon-disc-alpha` to `0.80`, add `--moon-mare-alpha: 0.28`, change the disc and glow colour triples to `ink` (`236 230 214`), and add the four maria layers (`nightMid`, `10 17 38`) between the shade and the disc, as in Part 4 of the design; keep the shade, size, insets and the 7 rem glow geometry, `--moon` and `--moon-peak-alpha`; no animation, no transition, no candle
    - Apply the identical layer list to `.sky-cap` in the same task so the verbatim-copy test of task 3.3 keeps passing (Requirement 5 AC 10)
    - Add no Moon token (approved by the human: the Moon uses only existing tokens). `README.md` is not edited
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 5.9, 5.10_
  - [x] 6.2 Update the Moon assertions in `index.css.test.ts` and add the new ones
    - G1 changes in this task, each with its reason in the task report: `--moon-disc-alpha` `toBe(0.80)` (pinned value the human approved to change, Requirement 5 AC 20); the channel-triple allow-list gains `236 230 214` and `10 17 38` (the cool `--moon` blue no longer colours the disc and halo); the `discBg`, `underShade` and `haloBg` helpers use `theme.ink`; and remove `keeps ink and error at 4.5:1 on the disc composite` and `Moon_Shade: keeps ink and error at 4.5:1 at the lightest and the darkest point`, replacing both by the meta test that `e2e/screenshots.spec.ts` calls `expectMoonInside(` for intro, Summon, Write, Graveyard, Sources & licences and Summary at 375 and for intro, Summon, Graveyard, Sources & licences and Summary at 320 (approved by the human). For each change the task report states the old and the new assertion and why the new one is at least as strict (for the two disc tests: the new test proves that no text lies on the disc on every listed screen, and 4.5:1 stays proven on the glow ring for all five text tokens)
    - Keep the structural tests (size at least 4 rem, insets, disc and halo gradient strings, shade inside the disc, `shades visibly`)
    - Add `describe('moon')`: lit point red above blue and luminance above 0.1187; three to four maria, each inside the disc (offset length plus larger radius at most `size / 2 - 0.2rem`) and each darker than the lit point; glow peak at most 0.10 and radius `7rem`; glow ring composite at 4.5:1 for `ink`, `muted`, `ghost`, `success` and `error`; no flat candle fill, no `animation` or `transition` in `body::before`; the existing text contrast tests (band A, band B, halo, held sky) keep passing
    - _Requirements: 5.3, 5.4, 5.5, 5.7, 5.8, 5.9, 5.14, 5.15, 5.16, 5.17, 5.18, 5.19, 5.20, 5.21, 8.5_
  - [x] 6.3 Add the Moon screens to the screenshot spec and re-run the Moon e2e checks
    - In `e2e/screenshots.spec.ts` add calls only: `expectMoonInside` for Sources & licences and Summary (through `reachSummary`) at 375 x 812 and 320 x 640, and a 1440 x 900 intro screenshot (approved by the human); the intro at 375 x 812 is saved again for the human's review
    - After waiting for port 4173 to be free, run `e2e/screenshots.spec.ts`, `e2e/night-scene.spec.ts` (the Moon shade test unchanged and passing) and `e2e/sky-cap.spec.ts`; all pass
    - _Requirements: 5.2, 5.6, 5.11, 5.12, 5.13, 5.22_

- [x] 7. Slips (Requirement 6)
  - [x] 7.1 Pin the `.card-slip` and `.keycap` blocks before any Slip CSS change
    - In `index.css.test.ts`, before `index.css` is edited, add a test that the text of the `.card-slip {` and `.keycap {` blocks equals a literal copied from the current file, so an accidental edit fails; also assert that neither selector appears in any new Slip rule
    - _Requirements: 6.16_
  - [x] 7.2 Restyle `.slip` and `.slip-primary`
    - In `app/src/styles/index.css` implement Part 5 of the design: paper, border and wax on a masked `::before` with the four fixed deckle tiles (`--deckle-top`, `--deckle-bottom`, `--deckle-left`, `--deckle-right`), `.slip.border-2::before`, the wax custom properties `--wax-light` (alpha 0.12 in its `data:` URI) and `--wax-dark` on `.slip-primary::before` only, the hover rules inside `@media (hover: hover)`, the focus, pressed and disabled rules (every state rule `:not(:disabled)`), and, inside the Motion_Block, the 200 ms transitions and the lift (`-2px`), focus lift and press (`1px`); no `clip-path`, no `overflow` on the Slips, `min-height: 44px` kept, `.card-slip` and `.keycap` untouched
    - Replace the old `.slip:hover` background rule and the `.slip-primary:hover` filter rule by the new state rules; the `.slip-primary` rest `box-shadow` keeps `var(--candle)`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.15, 6.16, 6.20, 6.21_
  - [x] 7.3 Update and extend the Slip assertions in `index.css.test.ts`
    - G1 changes in this task, each with its reason in the task report: `has exactly one no-preference block and no other media block` now allows exactly `(prefers-reduced-motion: no-preference)` once, `(hover: hover)` twice (static states and the one nested in the Motion_Block) and `(hover: hover) and (pointer: fine)` once, and no other query (Requirement 6 AC 7 needs the hover query, the nested one is inside the Motion_Block); `has no animation-duration, animation-name or transition longhand` keeps `animation-duration` and `animation-name` forbidden and now forbids any `transition` outside the Motion_Block, any `transition-*` longhand, and any transition entry in the block that is not 200 ms (Requirement 6 AC 5); in `defines .slip, .slip-primary and .card-slip ...` the `.slip-primary {` assertions for `background-color: var(--seal)` and `border: 1px solid var(--paper)` are checked on `.slip-primary::before {` and the element block asserts `border: 1px solid transparent` (the fill moves to the masked inner layer, Requirement 6 AC 20); min-height, colour and the `var(--candle)` box-shadow checks stay on the element. For each change the task report states the old and the new assertion and why the new one is at least as strict (the same colour, border and transition properties are checked, on the element that now carries them)
    - Add `describe('slips')`: every `transition` and `transform` for the Slips is inside the Motion_Block and every transition is 200 ms; hover rules are inside `@media (hover: hover)`; `--wax-light` is referenced only by `.slip-primary::before`; candle appears only in `box-shadow` and gradients; no `bg-candle`, `border-candle` or `text-candle`; the four deckle tiles have sizes 64 x 2 and 2 x 64, every profile coordinate within 2 px of the box and equal tile ends; the `.slip` and `.slip-primary` blocks contain no `clip-path` or `overflow`; no Han character in any new `data:` URI
    - Add the contrast tests from the design's tables: the Primary_Slip label on the lightest composite of `seal` and the wax at the alpha parsed from `--wax-light`, in the rest, hover (with `brightness(1.1)` on both colours, clamped), focus and pressed cases, each at least 4.5; the `.slip` label on the lightest and darkest gradient point in rest, hover and focus, pressed and disabled, each at least 4.5; the existing primary-action table tests stay unedited
    - _Requirements: 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.14, 6.15, 6.18, 6.20, 8.5, 8.9, 8.10, 8.19_
  - [x] 7.4 Write the Slip e2e test
    - Write `e2e/slips.spec.ts` as in the design: on the start menu, the Graveyard and Sources & licences at 375 and 320, width and layout position (`offsetTop`, `offsetLeft`) equal at rest, hover and while pressed, vertical shift at most 2 px up and 1 px down, height at least 44 in every state; a pointer press shortens the shadow (gap G3); computed `clip-path` is `none`, `overflow` is `visible` and the `::before` mask is the same string on every Slip; a disabled Slip keeps `transform: none` and its rest `box-shadow` under hover; the pixels just outside all four sides of a focused Slip differ from the page background; with `reducedMotion: 'reduce'` the `transform` is `none` and the transition duration `0s` in hover, focus and press while the hover `box-shadow` still differs from rest; in a `hasTouch` and `isMobile` context a tapped Slip shows its rest `box-shadow`; `findOverflow` at 375 and 320 at rest and with one Slip hovered
    - After waiting for port 4173 to be free, run `e2e/slips.spec.ts`, `e2e/fits-one-screen.spec.ts` and `e2e/no-horizontal-overflow.spec.ts`; all pass, the last two unedited
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 6.9, 6.13, 6.17, 6.19, 6.20, 6.21, 8.6, 8.8_

- [x] 8. Steering edits for approved amendments only
  - Rules for this group: the design records "approved by the human" next to every amendment A2, A3, A4, A5, A6, A9, A10 and A11, so every sub-task runs; a sub-task whose amendment is not recorded as approved in the design is skipped and the report says "skipped: not approved". Each sub-task edits `.kiro/steering/art-direction.md` with the exact wording recorded in the design after task 2, and updates `tests/unit/steering-art-direction.test.ts` with an assertion for the changed text; remove no assertion. After each, `tests/unit/steering-art-direction.test.ts`, `app/src/styles/theme.test.ts` and the `index.css.test.ts` art-direction checks (palette values, token parity, no `bg-candle`, `border-candle`, `text-candle`) must pass. Edit no other steering file
  - [x] 8.1 A2: ghost silhouette copies
    - Replace the phrase "drawn only by `GhostFigure`" in "The ghost" with the approved sentence that also allows flat copies (favicon and cursors); test the new sentence
    - _Requirements: 7.1, 7.2, 7.8_
  - [x] 8.2 A3: the Moon bullet
    - Replace the Moon bullet of "Moon, mist and seal placement" with the approved long form of A3 (approved by the human); test the new sentence
    - _Requirements: 7.1, 7.3, 7.8_
  - [x] 8.3 A4: the 3:1 exemption for decorative graphics
    - Replace "Graphics keep 3:1." with the approved exemption naming the hillside, the Grass, the mist, the Moon glow, the grain, the Wax_Texture and the Deckled_Edge, and stating the Grass visibility floor of 1.3:1 against the stone and the hill (approved by the human); test the new sentences
    - _Requirements: 7.1, 7.4, 7.8_
  - [x] 8.4 A11: what stays at 3:1
    - Add the sentence that the cursor images and every graphic that carries meaning keep the 3:1 rule (approved by the human); test it
    - _Requirements: 7.1, 7.11, 7.8_
  - [x] 8.5 A5: the Slip rule
    - Add the approved Slip sentence (lift, glow, sink, Deckled_Edge, Wax_Texture, 200 ms with no new motion exemption); test it
    - _Requirements: 7.1, 7.5, 7.8_
  - [x] 8.6 A6: the Sky_Cap sentence
    - Add exactly one sentence to "Moon, mist and seal placement", in the approved global wording ("on every screen"); test it
    - _Requirements: 7.1, 7.6, 7.8_
  - [x] 8.7 A9: the Pointer section
    - Add the approved "Pointer" section after "Motion"; test its text
    - _Requirements: 7.1, 7.9, 7.8_
  - [x] 8.8 A10: the Moon tokens
    - Add the approved option 2 sentence (the Moon uses only existing tokens) to "Moon, mist and seal placement" and add the `grass` row (`#30505c`, Graveyard Grass tufts, at least 1.3:1 against the stone and the hill) to the palette table after `hintInk`, matching `theme.ts` and `index.css` from task 5.5; test both
    - _Requirements: 4.11, 7.1, 7.10, 7.8_

- [ ] 9. Human-only screenshot review of the Moon and the Slips
  - [ ] 9.1 HUMAN TASK: Human reviews the Moon and Slip screenshots
    - Human-only, separate from Kiro work. Review the intro screenshot at 375 x 812 (and 1440 x 900 if added) saved by `e2e/screenshots.spec.ts`, and the Slips at rest, hover, focus and pressed, for "reads as a moon" and the paper-slip look; tone is a judgement and not a measurement, so this review is the acceptance test of Requirement 5 AC 22
    - Record the decision (accepted, or what to change) in the review notes the human keeps; Kiro does not review the screenshots and does not edit `kiro-log.md`
    - _Requirements: 5.22_

- [x] 10. Final checkpoint
  - Before every end-to-end run, wait until nothing listens on port 4173 (for example, `lsof -i :4173` prints nothing), because the Playwright config starts its own server and does not reuse an existing one
  - Run `npm test` at the repository root; then `npx tsc --noEmit` at the repository root, `npx tsc --noEmit -p app` and `npx tsc --noEmit -p oracle` (no errors); then `npm run build -w app`; `npm run check:bundle` (passes); `npm run test:e2e` (all pass, including `sky-cap`, `cursors`, `grass` and `slips`); and `npm run check:data` (unaffected: it passes and no data file changed)
  - Report the exact commands run and the passed, failed and skipped counts of `npm test` and `npm run test:e2e` (Requirement 8 AC 24), with no skipped test that was not skipped before this feature
  - Report every G1 assertion change made in `app/src/styles/index.css.test.ts` (the pointer-event selector list; the media-condition set; the Moon_Room line; the transition rule; the `.slip-primary` block assertions; the disc alpha; the channel-triple allow-list; the helper recipes; the two removed disc tests and their replacement), each with its reason, the old assertion, the new assertion, and why the new one is at least as strict; report the re-expressed checks of gaps G2 to G5 (hill tuft paint order, pointer-press shadow, 0 px cap height on wide screens, wax alpha inside the data URI) the same way
  - Report the Grass size added (baseline against after, limit 20,480 bytes), the `grass` token value and its computed ratios (task 5.5) and the pixel counts of the Grass visibility test (task 5.6), the recorded failing run of task 3.1, which steering sub-tasks ran and which were skipped, and that tasks 1.1 and 9.1 are human-only and their state
  - Confirm with `git diff --stat` that `README.md`, `kiro-log.md`, every data file and `app/public/data/*` are untouched, and that no steering file other than `.kiro/steering/art-direction.md` changed (and that file only through tasks 8.1 to 8.8); search the added and changed files for `any`, for personal names, and for `bg-candle`, `border-candle` and `text-candle`
  - Retake the eight screenshots: delete the PNG files in the gitignored `e2e/screenshots/`, run `npm run test:e2e -- screenshots` (after waiting for port 4173 to be free), and report the paths of the eight PNG files it writes, so the human can review them in task 9.1
  - Report anything not achieved: name each failing or skipped check, each requirement criterion that was not met, the file or test, and the command; make no commit
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.19, 8.20, 8.22, 8.23, 8.24_

## Notes

- There are no optional tasks. Every test task is required. No property-based test and no mutation test is added (decision of Nov 15); the existing property tests stay.
- Task 1.1 and task 9.1 are human tasks. Kiro does not do them, does not answer the open questions, does not approve an amendment and does not review the screenshots.
- After task 1.1, task 2.1 amends the spec first (requirements, design and this file), so the code tasks follow the human's answers.
- Task 3.1 writes the sticky-header test and records it failing on the current build before the Sky_Cap fix (Requirement 1 AC 18).
- Tasks 3.3, 4.3, 6.2 and 7.3 are where the listed `index.css.test.ts` assertions change (gap G1); each says why, and its report states the old and the new assertion. No rewrite may loosen a test (condition of the human's approval). Tasks 6.1 and 3.3 stay in step because `.sky-cap` copies the Moon layers verbatim. Task 7.1 pins `.card-slip` and `.keycap` before the Slip CSS changes.
- Tasks 8.1 to 8.8 apply the amendments A2, A3, A4, A11, A5, A6, A9 and A10, which the design records as approved by the human, each in its own sub-task.
- Tasks 5.5 and 5.6 were added at the end of group 5 for the visible Grass: 5.5 (the `grass` token) runs before 5.2, and 5.6 (the pixel test) runs after 5.4.
- Files that several tasks edit (`index.css`, `index.css.test.ts`, `e2e/helpers.ts`, `e2e/screenshots.spec.ts`, `art-direction.md`) sit in different waves of the graph.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4"] },
    { "id": 5, "tasks": ["4.1", "4.2"] },
    { "id": 6, "tasks": ["4.3"] },
    { "id": 7, "tasks": ["4.4"] },
    { "id": 8, "tasks": ["5.1"] },
    { "id": 9, "tasks": ["5.5"] },
    { "id": 10, "tasks": ["5.2"] },
    { "id": 11, "tasks": ["5.3"] },
    { "id": 12, "tasks": ["5.4"] },
    { "id": 13, "tasks": ["5.6"] },
    { "id": 14, "tasks": ["6.1"] },
    { "id": 15, "tasks": ["6.2"] },
    { "id": 16, "tasks": ["6.3"] },
    { "id": 17, "tasks": ["7.1"] },
    { "id": 18, "tasks": ["7.2"] },
    { "id": 19, "tasks": ["7.3"] },
    { "id": 20, "tasks": ["7.4"] },
    { "id": 21, "tasks": ["8.1", "9.1"] },
    { "id": 22, "tasks": ["8.2"] },
    { "id": 23, "tasks": ["8.3"] },
    { "id": 24, "tasks": ["8.4"] },
    { "id": 25, "tasks": ["8.5"] },
    { "id": 26, "tasks": ["8.6"] },
    { "id": 27, "tasks": ["8.7"] },
    { "id": 28, "tasks": ["8.8"] }
  ]
}
```
