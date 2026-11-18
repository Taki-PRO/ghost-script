# Requirements Document

## Introduction

The night-polish feature fixes one visible bug and adds four pieces of polish to the night scene of Ghost Script, all requested by the human after a phone review:

1. **Sticky header band.** Below 992 CSS pixels, the sticky header of the Graveyard and of Sources & licences sticks at `top: var(--moon-room)` (76 px). The page keeps scrolling in the 76 px above it, so tablets and text pass visibly through the band. That band must show only the night sky and the Moon.
2. **Ghost cursor.** On devices with a fine pointer, a small ghost cursor (and a variant for buttons and links), and a brush-tip cursor on the writing paper.
3. **Grass.** Fixed tufts of night grass along the hill and at the foot of the tablets in the Graveyard. The tufts are dark and night-toned, with no bright green, and they stand out from the stone and the hill behind them (a luminance ratio of at least 1.3:1).
4. **Moon.** A pale warm disc with soft maria and a faint glow, in the same place and at the same size.
5. **Paper slips.** Livelier paper-slip buttons: lift and candle glow on hover and focus, a pressed state, a deckled edge, and a faint wax texture on the seal-red primary.

This spec was amended to the human's answers to every open question; each answer is listed under "Decisions approved by the human" at the end of this document. The amendments of Requirement 7 to `.kiro/steering/art-direction.md` are approved by the human, each on its own, and are recorded in the design; the steering file is edited only by tasks 8.1 to 8.8. This spec change itself edits no code, no steering file, no data and not `kiro-log.md`.

The feature changes no game rule, no dataset, no storage schema and no scheduling. It adds no property-based test and no mutation testing (decision of Nov 15); every new test is a unit, component or end-to-end test.

### What the read-only investigation found

- **The bug.** `app/src/styles/index.css` sets `#root { padding-top: var(--moon-room) }` and `.sticky-below-moon { top: var(--moon-room) }`. `--moon-room` is `clamp(0px, calc((992px - 100vw) * 1000), 4.75rem)`, so it is 76 px below 992 px and 0 at 992 px and wider. The document scrolls, so the top 76 px of the viewport is not part of any clipped container. Content scrolls up through it and is hidden only once it passes under the opaque header (`bg-night-top`). `Graveyard.tsx` line 92 and `Credits.tsx` line 37 use `sticky sticky-below-moon z-20`.
- **Layers.** The Moon is `body::before` (`position: fixed`, `z-index: 0`). `#root` is `position: relative; z-index: 1`, so all content paints above the Moon. The mist (`body::after`, `#root::before`) and the grain and vignette (`#root::after`) are absolute and as tall as the page, so they scroll with the content. The sky is the `html` background, one viewport high (`background-size: 100% 100vh`), so it also scrolls: the sky seen in the top band changes with the scroll offset, from the `nightTop` end towards `skyHold`.
- **Existing tests that touch this.** `e2e/graveyard-fit.spec.ts` checks only that the header starts at or below `moonRoomPx(width)` at scroll 0, at 375 x 812 and 320 x 640. It does not scroll. `e2e/night-scene.spec.ts` covers the Graveyard and Sources & licences at 375 x 812 and 1024 x 768 (full-page capture, no flat band) and the Moon shade (lit versus shaded luminance ratio of at least 1.2). `e2e/helpers.ts` has `moonDisc`, `moonIntruders` and `expectMoonInside` (disc inside the viewport, no control or text box meeting the disc). `e2e/screenshots.spec.ts` calls `expectMoonInside` for the intro, Summon, Write and Graveyard at 375 x 812 and for the intro, Summon and Graveyard at 320 x 640. `e2e/no-horizontal-overflow.spec.ts` and `findOverflow` check 375 and 320 px widths. `e2e/fits-one-screen.spec.ts` checks the Summon and Write steps at 1024 x 768 and 375 x 812. `app/src/styles/index.css.test.ts` computes the contrast of every text token on mist band A, mist band B, the halo composite and the held sky, and of `ink` and `error` on the disc composite (`discBg`). It also pins `--moon-disc-alpha` to exactly 0.65, pins the disc and halo gradient strings, keeps the shade inside the disc, and fails on any image file or `will-change`.
- **Moon today.** `--moon: #7283ab` (a cool blue-grey), disc alpha 0.65, halo alpha 0.10 over 7 rem, one off-centre shade (alpha 0.35, offset 0.5 rem, radius 1.25 rem), 0.2 rem soft edge. The disc is a full 4 rem disc centred 2.5 rem from the top and the right.
- **Slips.** `.slip`, `.slip-primary` and `.card-slip` are in `@layer components`. `.slip:hover` changes only the background gradient. `.slip-primary` already has a candle glow in `box-shadow` and `:hover` uses `filter: brightness(1.1)`. The focus ring is `*:focus-visible` with the Tailwind ring in `ink` and a candle glow carried by `--tw-shadow`. Motion lives in one `@media (prefers-reduced-motion: no-preference)` block, which today has no hover or press transition.
- **Ghost and favicon.** `GhostFigure.tsx` exports `GHOST_PATH` and `GHOST_EYE_PATHS` on a `0 0 64 80` viewBox. `app/public/favicon.svg` is an unfiltered flat copy of the same path with the eyes in `#0e0f13`; `GhostFigure.test.tsx` checks that the favicon path equals `GHOST_PATH`. The `ink-and-candlelight` spec (Requirement 8, ACs 176 to 181) set this precedent. There is no `cursor:` rule in `app/src` apart from `disabled:cursor-not-allowed` on `LevelScreen`.
- **Writing paper.** `InkSurface.tsx` renders `[data-testid="ink-surface"]` (class `ink-paper`, `touch-action: none`) with `PracticeGrid` and the hanzi-writer container `[data-testid="ink-container"]`. The same component is used by the Summon step (not drawable) and by `WriteMode` (drawable).
- **Graveyard.** `Graveyard.tsx` draws the hillside as one `aria-hidden` SVG (`viewBox 0 0 100 48`, `preserveAspectRatio="none"`, `data-testid="hillside"`, `h-48`) inside a wrapper with `overflow-hidden`, over a `hillNear` ground gradient. The tablets are `li` elements with `tablet-tilt-{0..4}` (fixed pattern from `engine/tabletTilt.ts`), `min-h-[56px]`, a Dataset_Character in `lang="zh"` and a marker span (`·`, `!`, `✓`, `aria-hidden`). The hill tokens `hillFar` (#202c4c) and `hillNear` (#161e38) are decorative.
- **Contrast helpers.** `app/src/styles/theme.ts` exports `contrastRatio`. `e2e/colour.ts` exports `luminance` and `luminanceRatio`, tested in `tests/unit/e2e-colour.test.ts`. `e2e/helpers.ts` exports `pixelsAt`, which decodes a Playwright screenshot.

## Glossary

- **App**: The React + Vite single-page web application in `app/`.
- **Art_Direction**: The steering file `.kiro/steering/art-direction.md`.
- **Test_Suite**: The Vitest tests run by the repository's root `npm test`.
- **E2E_Suite**: The Playwright tests in `e2e/`, run by `npm run test:e2e`.
- **Narrow_Viewport**: A viewport narrower than 992 CSS pixels.
- **Moon**: The fixed disc and halo on `body::before` (Art_Direction, "Moon, mist and seal placement"). The Moon is 4 rem across, centred 2.5 rem from the top and 2.5 rem from the right of the viewport.
- **Moon_Room**: The top band of a Narrow_Viewport screen, `--moon-room` high (4.75 rem, 76 CSS pixels), in which only the Moon is drawn. It is 0 at 992 CSS pixels and wider.
- **Night_Sky**: The sky as seen in the Moon_Room at scroll offset 0: the top of the Sky_Gradient (`nightTop` into `nightMid`), plus the Moon, the halo and the grain.
- **Sky_Cap**: The new layer of Requirement 1 that holds the Night_Sky in the Moon_Room above scrolling content.
- **Sticky_Header**: The `header` element of the Graveyard screen and of the Sources & licences screen (class `sticky-below-moon`).
- **Content_Element**: Any element of a screen other than `html`, `body`, `#root`, the Sky_Cap and the pseudo-element layers.
- **Ghost_Cursor**: The cursor of Requirement 2 that shows the ghost silhouette.
- **Link_Cursor**: The variant of the Ghost_Cursor for buttons and links.
- **Brush_Cursor**: The cursor of Requirement 3 for the Writing_Paper.
- **Writing_Paper**: The `InkSurface` of the Write step, where the player draws strokes with hanzi-writer.
- **Fine_Pointer_Device**: A device whose primary input matches the media query `(hover: hover) and (pointer: fine)`.
- **Hotspot**: The pixel of a cursor image that the browser treats as the pointer position.
- **Ghost_Silhouette_Copy**: A flat, unfiltered copy of the `GHOST_PATH` silhouette (and `GHOST_EYE_PATHS`) with no gradient and no `filter`, like `app/public/favicon.svg`.
- **Grass**: The tufts of Requirement 4, inline SVG, `aria-hidden`.
- **Grass_Pattern**: The fixed mapping from a tablet position, or a hill position, to a tuft shape and offset. It uses no random number and no clock.
- **Grass_Token**: The new palette token `grass`, a dark blue-green (hue between teal and blue, low saturation) derived from `hillFar`, used as the only fill of the Grass. Its value is set in the design.
- **Grass_Floor**: The visibility floor of the Grass: a luminance ratio of at least 1.3:1 (as computed by `luminanceRatio` of `e2e/colour.ts`, lighter over darker) between a Grass pixel and the stone, hill or sky pixel behind it.
- **Marker**: The `·`, `!` or `✓` span of a tablet.
- **Maria**: Soft darker patches on the Moon disc. One patch is a mare.
- **Slip**: An interactive paper-slip button: the `.slip` class and the `.slip-primary` class. `.card-slip` and `.keycap` are not Slips.
- **Primary_Slip**: A Slip with the `.slip-primary` class, the seal-red Primary_Action.
- **Slip_States**: Rest, hover, keyboard focus, pressed and disabled.
- **Slip_State**: One of the Slip_States: rest, hover, keyboard focus, pressed or disabled.
- **Dataset_Character**: A Chinese character taken from the generated character dataset.
- **Seal_Stamp**: The seal-red stamp that carries a ghost's own revealed character after a clean outcome (Art_Direction, "Cultural care").
- **Primary_Action**: The one main action of a screen, as listed in the Art_Direction table "Primary action per screen".
- **Sky_Gradient**: The `html` background gradient from `nightTop` through `nightMid` and `nightLow` to the held sky.
- **Wax_Texture**: A faint inline-SVG noise on the Primary_Slip, in tones of `seal`.
- **Deckled_Edge**: A slightly irregular, torn-paper edge of a Slip.
- **Motion_Block**: The one `@media (prefers-reduced-motion: no-preference)` block of `app/src/styles/index.css`.
- **Contrast_Test**: A test in `app/src/styles/index.css.test.ts` or `app/src/styles/theme.test.ts` that computes a contrast ratio from CSS values and theme tokens.

---

## Requirements

### Requirement 1: Nothing scrolls visibly above the sticky header

**User Story:** As a phone player, I want the band above the sticky header to show only the night sky and the Moon, so that tablets and text do not slide through it.

#### Acceptance Criteria

1. WHILE the viewport is a Narrow_Viewport and the Graveyard screen is shown, THE App SHALL show no Content_Element in the Moon_Room at any scroll offset from 0 to the maximum. "Show" means rendered pixels: every pixel there outside the Moon and its halo matches the Night_Sky within the tolerance of AC 7.
2. WHILE the viewport is a Narrow_Viewport and the Sources & licences screen is shown, THE App SHALL show no Content_Element in the Moon_Room at any scroll offset from 0 to the maximum, by the same pixel definition as AC 1.
3. WHILE the viewport is a Narrow_Viewport and the Graveyard or the Sources & licences screen is shown, THE Sky_Cap SHALL be a fixed layer that spans the full viewport width at the top of the viewport and is `--moon-room` (76 CSS pixels) high.
4. WHILE the viewport is a Narrow_Viewport and the Graveyard or the Sources & licences screen is shown, THE Sky_Cap SHALL paint the Night_Sky above every Content_Element except the Sticky_Header.
5. WHILE the viewport is a Narrow_Viewport and the Graveyard or the Sources & licences screen is shown, THE Sky_Cap SHALL stack below the Sticky_Header, so that no Sticky_Header text or control is covered by the Sky_Cap.
6. WHILE the viewport is a Narrow_Viewport and the Graveyard or the Sources & licences screen is shown, THE Sky_Cap SHALL have `pointer-events: none`, so that a click or tap inside the Moon_Room reaches the element beneath it.
7. WHILE the viewport is a Narrow_Viewport and the page is scrolled, THE Sky_Cap SHALL show the same colours in the Moon_Room as the Night_Sky shows at scroll offset 0 of the same screen and viewport. The tolerance is 6 per RGB channel, measured at sample points that lie outside the Moon disc and outside 7 rem of the Moon centre.
8. WHILE the viewport is a Narrow_Viewport and the page is scrolled to any offset, THE Moon disc SHALL have the same position and the same 4 rem size as at scroll offset 0, within 1 CSS pixel.
9. WHILE the viewport is a Narrow_Viewport and the page is scrolled to any offset, THE Moon SHALL keep a luminance ratio of at least 1.2 between the disc centre and the sky at a point 8 rem to the left of the Moon centre. That point lies outside the 7 rem halo.
10. WHILE the viewport is a Narrow_Viewport, THE Sticky_Header SHALL keep its top edge at `--moon-room` (76 CSS pixels, within 1 CSS pixel) at every scroll offset. THE Sticky_Header SHALL also stay visible, meaning the topmost element at the centre point of its box is the Sticky_Header or one of its descendants.
11. WHILE the viewport is 992 CSS pixels wide or wider, THE Sticky_Header SHALL keep its top edge at 0 (within 1 CSS pixel) at every scroll offset.
12. WHILE the viewport is 992 CSS pixels wide or wider, THE App SHALL render no Sky_Cap, meaning no element or pseudo-element of the Sky_Cap has a painted box.
13. THE Sky_Cap SHALL be hidden from assistive technology, meaning it is absent from the accessibility tree.
14. THE Sky_Cap SHALL take no keyboard focus, and THE Tab order of each screen SHALL be the same with and without the Sky_Cap.
15. THE Sky_Cap SHALL add no horizontal scroll at 320 CSS pixels and at 375 CSS pixels wide, meaning the document's scroll width does not exceed its client width and `findOverflow` reports no element.
16. THE E2E_Suite SHALL contain a test that runs at 375 x 812 and at 320 x 640, for the Graveyard, for Sources & licences, for the Summary screen and for the Level screen. The test SHALL check that each screen is scrollable by at least 152 CSS pixels (two Moon_Room heights). IF the Summary screen or the Level screen is not scrollable by 152 CSS pixels at a viewport, THEN the test SHALL run that screen at the same width and a height of 420 CSS pixels, and IF the screen is still not scrollable by 152 CSS pixels at 420 CSS pixels, THEN the test SHALL run it at the same width and a height of 280 CSS pixels, and IF the screen is still not scrollable by 152 CSS pixels at 280 CSS pixels, THEN the test SHALL run it at the same width and a height of 200 CSS pixels. The 152 CSS pixel minimum, the offsets, the sample grid, the tolerance and the Moon checks stay the same at every fallback height. The heights 420, 280 and 200 CSS pixels are test devices only; they are not supported layouts, and the one-screen fit tests are unaffected. IF a screen is still not scrollable by 152 CSS pixels at 200 CSS pixels, THEN the test SHALL fail with a message saying the screen is not scrollable. The test SHALL scroll to the offsets 0, one third of the scrollable height, two thirds, and the maximum. At each offset it SHALL fail IF any sampled pixel differs from the Night_Sky colour of AC 7 by more than 6 per RGB channel. The sample points are a grid of 5 columns (at 10%, 30%, 50%, 70% and 90% of the viewport width) by 3 rows (at 15%, 50% and 85% of the Moon_Room height), minus the points inside 7 rem of the Moon centre. At least 3 columns by 3 rows SHALL remain after that exclusion. The failure message SHALL name the screen, the viewport, the offset, the point, and the colour found. Because the Sky_Cap has `pointer-events: none`, `document.elementsFromPoint` also returns the content beneath it, so the test SHALL NOT use `elementsFromPoint` as a pass or fail check. It MAY use `elementsFromPoint` only to name the element beneath the point in the failure message.
17. THE E2E_Suite test of AC 16 SHALL also fail IF the Moon position and size check of AC 8, or the luminance check of AC 9, fails at any of its scroll offsets.
18. THE first run of the AC 16 test, before the fix is applied, SHALL fail on the current build for the Graveyard and for Sources & licences at both viewports, at one or more offsets above 0. That failing run SHALL be recorded in the tasks as the evidence that the test detects the bug.
19. THE existing tests `e2e/graveyard-fit.spec.ts` (header starts at or below the Moon_Room at scroll 0), `e2e/night-scene.spec.ts` and `e2e/screenshots.spec.ts` (`expectMoonInside`) SHALL keep passing unchanged.
20. IF a control on the Graveyard or Sources & licences screen takes keyboard focus at a Narrow_Viewport, THEN THE App SHALL scroll the page so that the top edge of the control is at or below the bottom edge of the Sticky_Header. THE App SHALL use a `scroll-padding-top` of at least the Moon_Room height plus the Sticky_Header height (76 CSS pixels plus the header's rendered height) to do this. THE E2E_Suite SHALL check it by tabbing through every focusable control of both screens at 375 x 812 and 320 x 640 and measuring each control's bounding box against the Sticky_Header's bottom edge.
21. THE Sky_Cap SHALL cover every screen at a Narrow_Viewport that has a Moon_Room (the Summon and Write steps use the compact séance shell, which has no Moon_Room and so shows no Sky_Cap). THE AC 1 and AC 2 definition of "show", the AC 3 to AC 6 criteria and the AC 12 criterion SHALL apply to every such screen, and THE AC 16 test SHALL scroll the Graveyard, Sources & licences, the Summary screen and the Level screen.

### Requirement 2: Ghost cursor on fine pointers

**User Story:** As a laptop player with a mouse or trackpad, I want a small ghost as my pointer, so that the haunting follows me across the whole app.

#### Acceptance Criteria

1. WHERE the device is a Fine_Pointer_Device, THE App SHALL set the Ghost_Cursor as the default cursor of the page, on the `body` element, with a CSS `cursor` declaration of the form `url("data:image/svg+xml,...") X Y, auto`, where X and Y are the Hotspot in CSS pixels.
2. WHERE the device is a Fine_Pointer_Device, THE App SHALL set the Link_Cursor, with `auto` as the fallback, on every enabled `button`, `a[href]`, `[role="button"]` and `summary` element. An element is enabled when it has no `disabled` attribute and no `aria-disabled="true"`.
3. IF the device is not a Fine_Pointer_Device, THEN THE App SHALL leave the computed `cursor` of every element without a `url(` value, so that no custom cursor reaches touch devices.
4. THE Ghost_Cursor image and THE Link_Cursor image SHALL each be 24 by 30 CSS pixels, declared with explicit `width='24'` and `height='30'` attributes on the root `svg` element, which is within the 32 by 32 CSS pixel limit.
5. THE Ghost_Cursor image SHALL be a Ghost_Silhouette_Copy: its silhouette path string SHALL equal `GHOST_PATH` and its eye paths SHALL equal `GHOST_EYE_PATHS`, with any outline drawn as a stroke on those same paths.
6. THE Link_Cursor image SHALL use the same `GHOST_PATH` silhouette as the Ghost_Cursor and SHALL show wider eyes: each eye path of the Link_Cursor SHALL carry a `transform` that scales it by 1.4 about the centre of its own bounding box, and each eye path of the Ghost_Cursor SHALL carry no `transform`. The Link_Cursor therefore differs from the Ghost_Cursor in shape and not only in fill or stroke colour, so that the player sees that the target is pressable.
7. THE Ghost_Cursor and THE Link_Cursor SHALL each carry an outline so that, on each of the four grounds `background`, `surface`, `paper` and `inkOnPaper`, at least one of the image's fill and outline has a contrast ratio of at least 3:1 against that ground, as computed by `contrastRatio`.
8. THE Ghost_Cursor Hotspot and THE Link_Cursor Hotspot SHALL each be the whole-pixel coordinate (12, 1), which lies inside the image and within 2 CSS pixels of the topmost point of the scaled silhouette, and the same X and Y values SHALL be used in the CSS and in the unit test of AC 11.
9. THE App SHALL build the Ghost_Cursor and the Link_Cursor images with one function from the exported constants of `GhostFigure.tsx`, so that the cursors, the favicon and the figure share one source of the silhouette. THE CSS value SHALL be generated or verified from that function and SHALL NOT be hand-copied.
10. THE cursor declarations SHALL leave `cursor: not-allowed` on disabled buttons unchanged, and SHALL leave the Brush_Cursor of Requirement 3 in force on the Writing_Paper.
11. THE Test_Suite SHALL contain a unit test that parses the cursor declarations in `app/src/styles/index.css` and fails IF a data URI is not double-quoted and percent-encoded, IF an image exceeds 32 by 32 CSS pixels, IF a Hotspot lies outside its image, IF the path differs from `GHOST_PATH`, IF the eye paths differ from `GHOST_EYE_PATHS`, IF an image fails any check of AC 16, or IF no `auto` fallback follows the URL.
12. THE E2E_Suite SHALL contain a test that, in a desktop browser context (a Fine_Pointer_Device), reads the computed `cursor` of `body`, of an enabled `button` and of `[data-testid="ink-surface"]` on the Write step and finds a `url(` value on each. THE same test SHALL, in a context with `hasTouch: true` and `isMobile: true`, find no `url(` in the computed `cursor` of `body` or of a button.
13. WHEN a keyboard user moves focus with Tab to an element, THE App SHALL show the existing focus ring (`ink` ring and candle glow) on that element, and no cursor rule added by this requirement SHALL set `outline`, `box-shadow` or `--tw-shadow`.
14. THE cursor rules SHALL sit outside the Motion_Block, because a cursor is not motion, and SHALL add no `animation` and no `transition`.
15. THE index.css test that forbids image files (`url(` outside `data:` URIs) SHALL keep passing: each cursor URL SHALL be a `data:` URI.
16. THE Ghost_Cursor image and THE Link_Cursor image SHALL contain no `filter`, no gradient, no `text` element, no `href` and no `url(` reference to anything outside the image.
17. WHERE the device is a Fine_Pointer_Device, THE E2E_Suite SHALL read the computed `cursor` of a non-interactive element on the intro screen, the start menu and the Graveyard, and SHALL fail IF any of them lacks a `url(` value.

### Requirement 3: A brush-tip cursor on the writing paper

**User Story:** As a player writing with a mouse or trackpad, I want a cursor that does not hide where my stroke starts, so that I can start strokes in the right place.

#### Acceptance Criteria

1. WHERE the device is a Fine_Pointer_Device, WHILE the pointer is over the Writing_Paper (`[data-testid="ink-surface"]`, `[data-testid="ink-container"]` and every descendant of them on the Write step), THE App SHALL show the Brush_Cursor, so that the computed `cursor` of each of those elements is the Brush_Cursor `url(` value.
2. THE Brush_Cursor SHALL be a thin crosshair of 20 by 20 CSS pixels, with explicit `width='20'` and `height='20'` attributes on the root `svg` element, declared as a double-quoted, percent-encoded `data:image/svg+xml` URI in the form `url("data:image/svg+xml,...") X Y, crosshair`, so that `crosshair` is the fallback. The width of each crosshair arm SHALL be at most 2 CSS pixels. This limit applies to the arms and not to the outline: a paper casing of 4 CSS pixels under the arms is allowed.
3. THE Brush_Cursor Hotspot SHALL be the whole-pixel coordinate (10, 10), the centre of the crosshair and inside the image, and the same coordinate SHALL be used in the CSS and in the unit test of AC 9.
4. THE Brush_Cursor SHALL NOT be the Ghost_Cursor, because the ghost silhouette would cover the stroke start, and its image SHALL contain no `GHOST_PATH` silhouette.
5. WHERE the device is a Fine_Pointer_Device, WHILE the Summon step shows its paper (a surface that takes no strokes), THE App SHALL show the Ghost_Cursor, or the Link_Cursor over a button or link, on that paper, so that the computed `cursor` of `[data-testid="ink-surface"]` on the Summon step is not the Brush_Cursor.
6. WHERE the device is not a Fine_Pointer_Device, THE App SHALL leave the computed `cursor` of the Writing_Paper and of every descendant at the browser default, with no `url(` value.
7. THE Brush_Cursor SHALL keep a luminance ratio of at least 3:1 against `paper` and against `inkOnPaper` strokes: for each of those two grounds, the fill or the outline of the artwork SHALL reach 3:1 against it.
8. THE Brush_Cursor SHALL use no seal red and no candle amber, in a fill, an outline or a gradient.
9. THE Test_Suite SHALL contain a unit test of the Brush_Cursor that fails IF the data URI is not double-quoted and percent-encoded, IF the image is larger than 24 CSS pixels in width or height, IF the Hotspot lies outside the image, IF no `crosshair` fallback follows the URL, or IF any painted pixel (alpha above 0) lies inside the circle of 6 CSS pixels diameter centred on the Hotspot.
10. THE E2E_Suite test of Requirement 2 AC 12 SHALL read the computed `cursor` of `[data-testid="ink-surface"]` on the Write step and find a `url(` value in a desktop context, and SHALL find no `url(` value in a context with `hasTouch: true` and `isMobile: true`.
11. THE Brush_Cursor artwork SHALL leave the circle of 6 CSS pixels diameter around the Hotspot with no painted pixel (alpha above 0), so that the point where the stroke starts stays visible.
12. THE Writing_Paper SHALL keep `touch-action: none` in its computed style, and THE cursor rule SHALL leave the bounding boxes of `[data-testid="ink-surface"]` and `[data-testid="ink-container"]`, and the mouse and touch handling of hanzi-writer, unchanged.
13. THE Brush_Cursor rules SHALL sit outside the Motion_Block, add no animation, and be a `data:` URI so that the index.css test that forbids image files keeps passing.
14. WHILE a stroke is being drawn on the Writing_Paper (the primary mouse button is held), THE App SHALL keep the Brush_Cursor unchanged, so that the computed `cursor` of `[data-testid="ink-surface"]` while the button is held equals its value at rest.

### Requirement 4: Night grass in the Graveyard

**User Story:** As a player, I want tufts of grass on the hill and at the foot of the tablets, so that the Graveyard reads as a real hillside at night.

#### Acceptance Criteria

1. THE Graveyard SHALL draw every Grass element as inline SVG with `aria-hidden="true"` and `focusable="false"`, and with no `title`, no `desc`, no text and no `lang="zh"` content.
2. WHILE the Graveyard shows its tablets, THE Graveyard SHALL draw one Grass element at the foot of each tablet (every `li` of `[aria-label="Graves"]`), so that the number of tablet Grass elements equals the number of `li` elements. The bounding box of each tablet Grass element SHALL lie inside the box of its `li`, SHALL have its bottom edge within 2 CSS pixels of the bottom edge of that `li`, and SHALL be at most 16 CSS pixels high. The tuft SHALL be the same for a tablet in each of the three tablet states (Never met, Restless, At rest).
3. THE Grass_Pattern SHALL be a pure function in `app/src/engine/`. It SHALL map a tablet position to a tuft shape and offset, and a hill slot index to a tuft shape and offset, each from a fixed table like `tabletTilt.ts`: five tuft shapes chosen by tablet position modulo 5, and 12 hill slots. Its output SHALL depend only on its input, so that the same position gives the same tuft on every render, on every reload and at every viewport width.
4. WHILE the Graveyard shows its hillside, THE Graveyard SHALL draw Grass along the crest of the hillside, one tuft at each of 12 fixed hill slots. Every hill tuft SHALL lie inside the box of the hillside wrapper, and its shape and offset SHALL come from the Grass_Pattern.
5. THE Test_Suite SHALL contain a unit test that the Grass_Pattern returns the same output when called twice with the same input, and returns a defined output for every tablet position from 0 to 500 inclusive and for every hill slot index. The test SHALL also read the module source and fail IF it contains `Math.random` or `Date`.
6. THE Grass SHALL paint behind the Marker and behind the Dataset_Character of every tablet, in stacking order.
7. THE E2E_Suite SHALL fail IF the bounding box of any tablet Grass element intersects the box of any Marker span or of any `[lang="zh"]` glyph at 375 x 812 and at 320 x 640. The failure SHALL report the viewport and the tablet position.
8. THE Grass SHALL add no horizontal overflow at 320, 375, 1024 and 1440 CSS pixels. At each width `findOverflow` SHALL report no element, including the tilted tablets, whose box extends past the viewport, and the box of every tablet SHALL keep the size it has without Grass.
9. THE Grass SHALL take no pointer events (`pointer-events: none`) and no keyboard focus, and SHALL add no stop to the Tab order of the Graveyard.
10. THE Grass SHALL leave the accessible name and role of every tablet, and the list structure of the Graveyard (the `[aria-label="Graves"]` list and its `li` count), unchanged.
11. THE Grass fill SHALL be the Grass_Token `grass` and no other colour, and THE Grass SHALL have no stroke. THE Grass_Token SHALL be a dark blue-green and not a bright green: its hue SHALL lie between 180 and 230 degrees, its HSL saturation SHALL be at most 35 percent and its HSL lightness SHALL be at most 30 percent. THE Grass SHALL use no seal-red fill and no candle-amber fill. THE Grass_Token SHALL be added to `app/src/styles/theme.ts` and to `app/src/styles/index.css` with equal values, and to the Art_Direction palette table by the amendment of Requirement 7 AC 10.
12. THE Grass SHALL stay a decorative graphic that conveys no state: the three tablet states SHALL keep their text, Marker and shape cues, and the Grass SHALL be neither the only nor a required signal for any state.
13. THE existing E2E tests of the hillside (`hillside sits behind the grid`, `the hillside paints behind the first tablet`, `the far ridge is lighter than the sky`) and of the never-met tablets (text equals `·`, no border, no glyph) SHALL keep passing unchanged.
14. THE Grass SHALL add no more than 20 KB (20,480 bytes) to the built CSS and JavaScript files together, measured uncompressed against the build without Grass, and SHALL add no image file.
15. WHILE the motion preference is `no-preference`, THE Grass SHALL stay static, with no `animation` and no `transition` on any Grass element. THE Graveyard SHALL add no new ambient motion for the Grass.
16. WHILE the Graveyard is shown at 375 x 812 and at 1024 x 768, THE Grass SHALL stand out from the stone and the hill behind it: THE E2E_Suite SHALL contain a pixel test on the Graveyard screenshot, like the existing test "the far ridge is lighter than the sky", that compares each pixel of a Grass element's box with the same pixel in a second screenshot with all Grass hidden. For every tablet Grass element (in all three tablet states), at least 8 pixels of its box SHALL have a luminance ratio of at least the Grass_Floor, and the test SHALL fail naming the viewport and the tablet position IF one does not. For the hill Grass elements, at least 6 of the 12 SHALL pass the same check at each viewport.
17. THE Test_Suite SHALL contain a unit test that computes, with `contrastRatio`, the ratio of the Grass_Token against `hillNear`, `hillFar`, `nightMid`, `nightLow`, `skyHold`, the never-met tablet stone (`#14161c`), the lighter and the darker end of the tablet stone gradient (`#2a2d36` and `#1d2028`), and the tablet stone and the Grass_Token each under the candle glow of an at-rest tablet at the alphas 0, 0.1, 0.17, 0.2 and 0.28, and SHALL fail IF any ratio is below 1.5 (the Grass_Floor of 1.3 plus a margin).
18. THE tablet `li` elements SHALL NOT use `overflow: hidden`: the computed `overflow` of every tablet SHALL be `visible`, so that the restless wisp and the at-rest glow are not clipped. THE tablet Grass element SHALL lie inside the tablet box by construction (AC 2).
19. THE hill Grass elements SHALL come before the tablet grid in document order and SHALL set no `z-index`, so that every tablet, glyph and Marker paints above them. THE E2E_Suite SHALL fail IF a hill Grass element comes after the grid or has a `z-index`.

### Requirement 5: A moon that reads as a moon

**User Story:** As a player, I want the Moon to look like a moon, with a warm pale tone, soft maria and a faint glow, so that it is no longer a flat grey circle.

#### Acceptance Criteria

1. THE Moon SHALL be one disc, drawn with CSS gradients on `body::before` or with one inline SVG in a `data:` URI, and SHALL use no image file.
2. THE Moon SHALL keep the same place as today (disc centre 2.5 rem from the top and 2.5 rem from the right of the viewport) and the same diameter (4 rem). At any scroll offset, the E2E_Suite SHALL measure the disc position and diameter as equal to those at scroll offset 0, within 1 CSS pixel.
3. THE Moon disc SHALL have a pale warm base tone, taken from the aged-paper tones of the palette (`ink`, `paper`); no new Moon token is added. The composited disc colour at the lit point of the disc (outside every mare and outside the shade) SHALL have a red channel value greater than its blue channel value and a relative luminance higher than that of today's disc composite (`discBg` in `app/src/styles/index.css.test.ts`), and the Contrast_Test SHALL fail IF either condition is not met.
4. THE Moon disc SHALL show exactly four Maria, each drawn as a soft-edged gradient that lies entirely inside the disc, at fixed positions, with a fixed pattern and no random number.
5. THE composited colour at the centre of each mare SHALL have a lower relative luminance than the composited colour at the lit point of the disc (AC 3), and the E2E_Suite or the Contrast_Test SHALL fail IF any mare centre is not darker.
6. THE Moon SHALL keep the off-centre shade (darker toward the lower right). The existing night-scene test of the Moon shade (lit versus shaded luminance ratio of at least 1.2) SHALL keep passing unchanged.
7. THE Moon SHALL have a glow that extends beyond the disc, with a peak alpha of 0.10 or less outside the disc, with the same 7 rem extent as the current halo, and falling to alpha 0 at its outer edge.
8. THE Moon SHALL contain candle amber only inside `radial-gradient` or `linear-gradient` functions, and SHALL contain no flat amber fill.
9. THE Moon SHALL add no animation and no transition. IF a Moon animation is wanted later, THEN the Art_Direction ambient list SHALL name it first; this spec adds none.
10. WHILE the viewport is a Narrow_Viewport, THE Sky_Cap SHALL show the same Moon appearance as the Moon (same base tone, Maria, shade and glow), so that Requirement 1 AC 7, AC 8 and AC 9 hold for the new Moon.
11. WHEN the Moon is shown, THE Moon SHALL be a full disc inside the viewport: `expectMoonInside` SHALL pass for every view that calls it today.
12. THE E2E_Suite SHALL add Sources & licences and the Summary screen, at 375 x 812 and at 320 x 640, to the views that call `expectMoonInside`.
13. THE Moon SHALL lie under no text and no control: `moonIntruders` SHALL return an empty list for every view that calls `expectMoonInside`.
14. THE Contrast_Tests of text on mist band A, on mist band B, on the halo composite and on the held sky SHALL keep passing, with each text token (`ink`, `muted`, `ghost`, `success`, `error`) at 4.5:1 or more.
15. THE Contrast_Tests SHALL compute a new composite of the glow at its brightest point outside the disc (the ring at the disc edge), in paint order, with the grain and vignette layer on top.
16. THE Contrast_Tests SHALL fail IF any text token (`ink`, `muted`, `ghost`, `success`, `error`) is below 4.5:1 on the composite of AC 15, because text such as a heading may sit beside the Moon on screens 992 CSS pixels wide and wider.
17. THE Test_Suite SHALL remove the test "ink and error at 4.5:1 on the disc composite" and the test "Moon_Shade: ink and error at 4.5:1 at the lightest and the darkest point", because a pale disc cannot give light text 4.5:1 on itself and no text lies on the disc.
18. THE Test_Suite SHALL replace the two tests of AC 17 with a test that no text token has to meet 4.5:1 on the disc because `moonIntruders` proves that no text lies on the disc (the test reads `e2e/screenshots.spec.ts` and fails IF an `expectMoonInside` call is missing for a view named in AC 11 and AC 12). THE replacement SHALL be recorded in the amendment of Requirement 7 AC 3, and THE 4.5:1 requirement SHALL stay in force on the glow ring (AC 15 and AC 16).
19. THE Test_Suite SHALL keep the structural tests of the Moon (size at least 4 rem, insets at least half the size, disc and halo gradient strings, the shade staying inside the disc), with their expected strings updated to the new gradients.
20. THE Test_Suite SHALL drop only an assertion that pins a value the human has approved to change (the disc alpha of exactly 0.65, the cool `--moon` blue, and the second disc-contrast test of AC 17), and SHALL keep every other assertion in `app/src/styles/index.css.test.ts`.
21. THE index.css test that forbids image files and `will-change` SHALL keep passing.
22. THE screenshot spec SHALL save an intro screenshot at 375 x 812 so that the human can review the new Moon and at 1440 x 900. THE human's screenshot review SHALL be the acceptance test for "reads as a moon", because tone is a judgement and not a measurement.

### Requirement 6: Livelier paper slips

**User Story:** As a player, I want the paper-slip buttons to feel like paper that answers my pointer, so that pressing them is more satisfying.

#### Acceptance Criteria

1. WHERE the device supports hover, WHEN the pointer moves onto an enabled Slip, THE Slip SHALL move up by 1 to 2 CSS pixels from its rest position and SHALL gain a candle-warm glow. The glow SHALL be a candle-derived colour layer in the computed `box-shadow` that is absent at rest, and SHALL be drawn in no other property.
2. WHEN an enabled Slip takes keyboard focus (`:focus-visible`), THE Slip SHALL show the same lift (1 to 2 CSS pixels) and the same candle glow layer as on hover. This SHALL hold on devices that do not support hover.
3. WHEN an enabled Slip is pressed (`:active`), THE Slip SHALL sink to rest position plus 1 CSS pixel downward. During the sink the lift SHALL return to 0 before it passes below rest. In the pressed state of a pointer press the drop-shadow offset and blur SHALL each be smaller than at rest, and the candle glow alpha SHALL be lower than in the hover state. For a keyboard press, the focus ring owns the `box-shadow` (AC 19) and only the sink applies.
4. WHILE a Slip is disabled, THE Slip SHALL keep a computed `transform` of `none` and a computed `box-shadow` equal to its rest value under hover, `:focus-visible` and `:active`.
5. THE transitions for lift, glow and sink SHALL each last 200 ms. Every `transition` and `transform` declaration for Slips SHALL sit inside the Motion_Block. This keeps the Art_Direction rule "motion that follows a player action runs 200 to 600 ms" with no new exemption.
6. WHILE the motion preference is `reduce`, THE Slip SHALL have a computed transition duration of 0 s and a computed `transform` of `none` in every Slip_State. The glow of hover and focus and the shortened shadow of the pressed state SHALL still show as static end states.
7. THE hover rules for Slips SHALL be declared only inside `@media (hover: hover)`. On a device without hover, a Slip that has been tapped and released SHALL show its rest appearance, with no lift and no hover glow.
8. THE Deckled_Edge of a Slip SHALL be an irregular edge (not a straight line on at least one side) that deviates from the Slip's rectangular box by at most 2 CSS pixels at every point.
9. THE Deckled_Edge SHALL come from one fixed shape, either a fixed path or a fixed `feTurbulence` seed, delivered as an inline SVG or CSS mask in a `data:` URI. The computed mask value SHALL be identical on every Slip and on every render.
10. THE Primary_Slip, and no other element, SHALL carry the Wax_Texture. The Wax_Texture SHALL be an inline-SVG noise in a `data:` URI, in `background-image` layers, with no image file and with only tones lighter or darker than `seal`. Its maximum lightening alpha SHALL be declared in one place in `app/src/styles/index.css` for the Contrast_Test to read (0.12).
11. THE Primary_Slip label (`paperLabel`) SHALL keep a contrast ratio of at least 4.5:1. The ratio SHALL be computed on the lightest composite of `seal` and the Wax_Texture at its maximum lightening alpha, including any brightness filter, in the rest, hover, focus and pressed states. The Contrast_Test SHALL fail IF any of these four cases is below 4.5:1.
12. THE `.slip` label (`inkOnPaper`) SHALL keep a contrast ratio of at least 4.5:1 on the lightest and on the darkest point of the Slip background in each Slip_State, computed by the Contrast_Test. The test SHALL fail IF any of these cases is below 4.5:1.
13. THE E2E_Suite SHALL measure the bounding box of a Slip at rest, under hover and while pressed. It SHALL fail IF the width differs from rest, IF the vertical position differs by more than 2 CSS pixels upward or more than 1 CSS pixel downward, or IF the layout position (`offsetTop`, `offsetLeft`) changes.
14. THE App SHALL show at most one Primary_Slip on every screen at a time. THE existing tests of the primary-action table SHALL keep passing. THE new styles SHALL add no seal-red fill to any element that is not a Primary_Slip, the Seal_Stamp or a success mark.
15. THE Slip glow and texture SHALL use candle amber only inside `box-shadow`, `radial-gradient` and `linear-gradient`, and SHALL add no `bg-candle`, `border-candle` or `text-candle` class.
16. THE changes SHALL apply to `.slip` and `.slip-primary` only. THE `.card-slip` (static cards) and `.keycap` (Summon keys) SHALL keep their current computed styles.
17. THE E2E_Suite SHALL fail IF `findOverflow` reports any element past the viewport at 375 and at 320 CSS pixels on the start menu, the Graveyard and Sources & licences, in the rest state and with one Slip hovered.
18. THE Test_Suite SHALL contain component or CSS unit tests on `app/src/styles/index.css` that check the rules of AC 5, 6, 7, 10 and 15. These tests SHALL check that every `transition` and `transform` for Slips is inside the Motion_Block, that the hover rules are inside `@media (hover: hover)`, that the Wax_Texture is declared on `.slip-primary` only, and that candle appears only in `box-shadow` and gradients.
19. WHEN an enabled Slip takes `:focus-visible`, THE existing focus ring (2 px `ink` ring and candle glow) SHALL stay in the computed `box-shadow`. In a screenshot, pixels immediately outside all four sides of the Slip's border box SHALL differ from the page background, so the ring is not clipped.
20. THE Slip itself SHALL have a computed `clip-path` of `none` and no `overflow: hidden`. THE Deckled_Edge SHALL be applied only to an inner layer through a mask, so that it does not clip the `box-shadow` glow or the focus ring.
21. THE Slip SHALL have a height of at least 44 CSS pixels in every Slip_State and with the Deckled_Edge applied. THE E2E_Suite SHALL fail IF the height of any measured Slip falls below 44 CSS pixels.

### Requirement 7: Steering amendments that need approval

**User Story:** As the human, I want every change to the art direction listed and approved before the steering file is edited, so that the rules and the app stay consistent.

#### Acceptance Criteria

1. THE design SHALL record the text "approved by the human" next to each amendment of AC 2 to AC 6, AC 9, AC 10 and AC 11. No task SHALL edit the Art_Direction or any other steering file for an amendment unless the design records that approval next to it. Each amendment was approved on its own, and the approval of one amendment SHALL NOT count as approval of another.
2. THE Art_Direction SHALL replace the sentence "drawn only by `GhostFigure`" with a sentence that also allows Ghost_Silhouette_Copy images (the favicon and the cursors). Each copy SHALL be built from the exported `GHOST_PATH` and `GHOST_EYE_PATHS`, SHALL contain no filter, no gradient and no text, and SHALL be a standalone SVG that does not reference the `GhostFigure` component or its filter. The reason, which the design records, is that the favicon is already a flat copy of the same path (ink-and-candlelight, Requirement 8) and a cursor is the same kind of copy.
3. THE Art_Direction SHALL replace the Moon bullet of "Moon, mist and seal placement" with one that describes a pale warm disc with soft Maria and a faint glow, in the same place and at the same size, and that records that no text token has to meet 4.5:1 on the disc because `moonIntruders` proves that no text lies on the disc.
4. THE Art_Direction SHALL replace the rule "Graphics keep 3:1" with a rule that exempts from 3:1 every graphic that is `aria-hidden` and conveys no information. The exempt graphics are named in the rule: the hillside, the Grass, the mist, the Moon glow, the grain, the Wax_Texture and the Deckled_Edge. The rule SHALL also state that the Grass keeps its own visibility floor, a luminance ratio of at least 1.3:1 against the stone and the hill behind it (the Grass_Floor). The reason, which the design records, is that the Grass is deliberately dark and night-toned, as the hillside already is, yet must stay visible.
5. THE Art_Direction SHALL add a Slip rule that states these points: Slips lift and glow on hover and focus, Slips sink when pressed, Slips have a Deckled_Edge, the Primary_Slip has a Wax_Texture in tones of `seal`, and the transitions run 200 ms and need no motion exemption (Requirement 6).
6. THE Art_Direction SHALL add exactly one sentence to "Moon, mist and seal placement". The sentence SHALL state that below 992 CSS pixels a fixed Sky_Cap keeps the Moon_Room free of scrolling content on every screen.
7. THE design SHALL record that the human approved every amendment of this requirement, so that no dependent item is dropped and no alternative is built.
8. WHEN any amendment of this requirement is applied, THE Test_Suite SHALL keep passing its art-direction checks: the palette values, the `theme.ts` and `index.css` token parity, and the absence of `bg-candle`, `border-candle` and `text-candle`.
9. THE Art_Direction SHALL add a "Pointer" section for the Ghost_Cursor, the Link_Cursor and the Brush_Cursor. The section SHALL state that the cursors apply to Fine_Pointer_Devices only, that each ghost cursor image is at most 32 by 32 CSS pixels (the Brush_Cursor at most 24 by 24, per Requirement 3), that each is a `data:` SVG, and that each declares a fallback (`auto` for the ghost cursors, `crosshair` for the Brush_Cursor).
10. THE Art_Direction SHALL record that the Moon uses only existing tokens (no new Moon token). THE Art_Direction palette table SHALL add one row for the Grass_Token `grass` with its value and its use, and the same task SHALL keep `theme.ts`, `index.css` and the hex checks of `index.css.test.ts` equal to that value.
11. THE Art_Direction rule of AC 4 SHALL state that the cursor images and every graphic that carries meaning keep the 3:1 contrast rule.

### Requirement 8: Verification and no regression

**User Story:** As the human, I want the polish to leave every existing guarantee in force, so that nothing that worked stops working.

#### Acceptance Criteria

1. WHEN `npm test` is run at the repository root on the finished feature, THE Test_Suite SHALL pass with zero failing tests and zero skipped tests that were not skipped before this feature.
2. THE Test_Suite SHALL contain no new property-based test and no mutation test added by this feature; every new test SHALL be a unit, component or end-to-end test.
3. WHEN `npm run test:e2e` is run on the finished feature, THE E2E_Suite SHALL pass with zero failing tests and zero skipped tests that were not skipped before this feature.
4. THE E2E_Suite SHALL contain the new tests required by Requirements 1, 2, 3, 4 and 6.
5. THE feature SHALL remove no existing test from the Test_Suite or the E2E_Suite and SHALL loosen no existing assertion, except the assertions that Requirement 5 AC 17 to AC 20 allow to be dropped or updated (the disc alpha of exactly 0.65, the cool `--moon` blue, the expected gradient strings of the Moon, and the two disc-contrast tests) and the rewrites listed in the design under "Existing assertions that change" (approved by the human). Each rewrite SHALL check the same property at least as strictly as the assertion it replaces, and the report of the task that makes it SHALL state the old and the new assertion.
6. THE existing tests `e2e/fits-one-screen.spec.ts` (Summon and Write steps at 1024 x 768 and 375 x 812) and `e2e/no-horizontal-overflow.spec.ts` (375 and 320 CSS pixels) SHALL pass without any edit to those files.
7. THE App SHALL keep every text token (`ink`, `muted`, `ghost`, `success`, `error`) at a contrast ratio of at least 4.5:1 on every dark background and on paper, except the disc composite, for which Requirement 5 AC 17 and AC 18 apply.
8. THE App SHALL keep every button at least 44 CSS pixels high in every Slip_State.
9. THE App SHALL keep every animation and every transition inside the Motion_Block.
10. THE Test_Suite SHALL keep the existing check that fails IF an `animation` or a `transition` sits outside the Motion_Block, and that check SHALL pass without any edit.
11. WHILE the motion preference is `reduce`, THE App SHALL show the static end state of every new style (Slip hover, focus and pressed states, Grass and Moon), with no animation and no transition.
12. THE new cursor images, Grass, Moon and Slip styles SHALL contain no Dataset_Character, no hidden answer, no pinyin and no Cangjie code, in text, in attributes or in `data:` URIs.
13. THE new cursor images, Grass, Moon and Slip styles SHALL show nothing before the Summon step that the Summon step itself would not show.
14. THE new cursor images, Grass, Moon and Slip textures SHALL contain no Chinese glyph and no glyph-like shape.
15. THE new cursor images, Grass, Moon and Slip textures SHALL contain no pumpkin, bat, cobweb, joss paper, offering money, talisman script and no incense.
16. THE App SHALL show at most one Primary_Slip on every screen at a time, and the existing tests of the primary-action table SHALL pass without any edit.
17. THE new styles SHALL apply seal red only to the Primary_Slip, the Seal_Stamp and success marks.
18. THE feature SHALL add no runtime LLM call, no paid service and no external network request at runtime.
19. THE feature SHALL add no image file; every new asset SHALL be CSS or an inline or `data:` SVG, and the existing `index.css` test that fails on image files SHALL pass without any edit.
20. THE feature SHALL leave `README.md` unchanged, because it adds no font, no dataset and no third-party asset.
21. IF the design adds a font, a dataset or a third-party asset, THEN THE design SHALL name the task that updates the `README.md` licence and credit text, and that task SHALL complete before the feature is finished.
22. THE implementation tasks SHALL leave `kiro-log.md` unchanged until the human gives a separate instruction.
23. IF any check of AC 1 to 22 fails, THEN THE feature SHALL NOT be reported as finished, and the report SHALL name each failing check, the file or test that failed and the command that was run.
24. WHEN the implementation is reported as finished, THE report SHALL list the exact commands run for AC 1 and AC 3 and the number of tests passed, failed and skipped for each.

---

## Art-direction tensions

Each tension names the rule, the request, and how the requirements resolve it.

| # | Art_Direction rule | Request | Resolution in the requirements |
|---|---|---|---|
| T1 | Candle amber only inside `box-shadow`, `radial-gradient`, `linear-gradient`. | Hover and focus glow on Slips; warm Moon. | The glow is a `box-shadow` (R6 AC 1, 15). The Moon uses gradients only (R5 AC 8). |
| T2 | Action-caused motion runs 200 to 600 ms. | Hover lift and press. | Both transitions run 200 ms, the lower bound, inside the Motion_Block, so no exemption is needed (R6 AC 5). A faster, instant press would need an exemption and is not proposed. |
| T3 | The Moon is a 4 rem full disc, alpha 0.65, an off-centre shade, 4.5:1 contrast tests, text never under it. | A paler, warmer disc with maria and glow. | Same place and size (R5 AC 1, 2). A pale disc cannot give light text 4.5:1 on itself, so the disc contrast tests are replaced by the proof that no text lies on the disc (`moonIntruders`, R5 AC 17, 18). Text near the Moon keeps 4.5:1 on the glow ring (R5 AC 15, 16). The pinned 0.65 alpha and the cool blue are amended (R5 AC 20). |
| T4 | The ghost is "drawn only by `GhostFigure`". | A ghost cursor. | A cursor needs a standalone `data:` SVG. The favicon is the precedent for a flat unfiltered copy of the same path. A steering amendment is planned (R7 AC 2) and the copy is tied to `GHOST_PATH` by a test (R2 AC 5, 11). |
| T5 | Graphics keep 3:1. | Grass is meant to be quiet, dark on dark, yet visible. | Grass is decorative and `aria-hidden`, so the amendment exempts it from 3:1 (with the hillside, mist and Moon glow, which the rule already fails in practice, R7 AC 4). The Grass keeps its own 1.3:1 visibility floor, proven by a pixel test (R4 AC 16, 17). Cursors keep 3:1 (R2 AC 7). |
| T6 | One seal-red Primary_Action per screen; seal red nowhere else. | A wax texture on the primary. | The texture is in tones of `seal` only, on the Primary_Slip only (R6 AC 10, 14). |
| T7 | Colour is never the only signal. | Link_Cursor variant. | The variant differs in shape (wider eyes), not only in colour (R2 AC 6). |
| T8 | Ambient motion exemptions are listed and closed. | Anything idle. | No new idle motion: Grass static (R4 AC 15), Moon static (R5 AC 9). |
| T9 | Moon never under text; the Moon_Room keeps content clear of it. | A Sky_Cap that paints over content. | The Sky_Cap is the way to make the rule hold while scrolling (R1 AC 3 to 6). It is a new layer, so the placement sentence is amended (R7 AC 6). |
| T10 | Buttons stay at least 44 px high. | Lift, sink, deckle. | The hit box and height are measured unchanged (R6 AC 13, 21). |

## Decisions approved by the human

The human answered every open question with the recommended answer, except Grass colour (3.1), which the human changed. The numbering below is the human's. All of the following are approved by the human.

- **1.1** The Sky_Cap covers every screen at a Narrow_Viewport (R1 AC 21). The e2e test scrolls the Graveyard, Sources & licences, the Summary and the Level screen.
- **1.2** The band is a fixed Sky_Cap element that repaints the sky, the Moon, the grain and the vignette.
- **1.3** The band shows the sky colours of scroll offset 0 at every offset (tolerance 6 per channel).
- **1.4** The header focus clearance is included (R1 AC 20).
- **2.1 to 2.7** Ghost cursors are flat copies of `GHOST_PATH` (R2 AC 5). The ghost cursors are 24 by 30 CSS pixels with Hotspot (12, 1) (R2 AC 4, 8). The Link_Cursor has the same silhouette with wider eyes (R2 AC 6). The cursors apply under `(hover: hover) and (pointer: fine)` (R2 AC 1). The Summon paper keeps the ghost cursor (R3 AC 5). The Brush_Cursor is a 20 by 20 crosshair with a 6 CSS pixel open centre (R3 AC 2, 11). The cursor does not change while drawing (R3 AC 14).
- **3.1 (changed answer)** The Grass must be visible, not hidden in the hill: dark and night-toned, no bright green, with a new `grass` token and a luminance ratio of at least 1.3:1 against the stone and the hill, proven by a pixel test (R4 AC 11, 16, 17).
- **3.2** One tuft inside each tablet at its foot, with no `overflow: hidden` on the tablet, plus separate hill-crest tufts (R4 AC 2, 4, 18).
- **3.3** Five tuft shapes by position modulo 5 and 12 crest slots (R4 AC 3, 4).
- **3.4** Tablet tufts never overlap a Marker or a glyph; hill tufts get a paint-order test (R4 AC 7, 19).
- **4.1 to 4.4** The disc contrast tests are replaced by the `moonIntruders` proof, and 4.5:1 stays on the glow ring (R5 AC 17, 18). There is no new Moon token (R7 AC 10). The Moon has four Maria (R5 AC 4). The human reviews the screenshots (R5 AC 22).
- **5.1 to 5.5** `.slip` and `.slip-primary` only (R6 AC 16). The Deckled_Edge is a masked inner layer. Lift is 2 px, sink is 1 px and the wax lightens by at most 0.12. Hover rules sit only under `(hover: hover)`. Disabled Slips do not move.
- **Amendments** A2, A3, A4 (adjusted for the Grass_Floor), A5, A6 (every screen), A9, A10 and A11 are approved by the human (R7).
- **Rewrites of existing CSS tests** (the design's gaps G1 to G5) are approved by the human, provided none is loosened (R8 AC 5).
