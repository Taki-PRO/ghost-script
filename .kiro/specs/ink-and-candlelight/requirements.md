# Requirements Document

## Introduction

The ink-and-candlelight feature gives every screen of Ghost Script one art direction: a séance at a writing desk, ink and paper by candlelight. It is spooky but calm. It uses no pumpkins, bats or cobwebs. The direction was approved by the human; this spec turns it into requirements, a design and tasks for review before anything is built.

The feature changes colours, shapes, motion, one font and some copy. It changes no game rule, no dataset, no storage schema and no scheduling. It amends several existing requirements of the `visual-identity`, `cangjie-seance`, `summon-ink` and `first-meeting` specs. Every amendment is listed in Requirement 22 and in the design under "Conflicts with existing requirements". The human approved the decisions Q1 to Q13, with Q10 changed; they are recorded in the design under "Decisions" and marked "approved by the human" in the requirements below.

The first task of this spec writes `.kiro/steering/art-direction.md` (front matter `inclusion: always`). That file holds the palette, the ghost, the motion rules and the cultural-care rules, so that every later screen follows them. This spec does not create that file now.

### Kiro features used

- **Specs:** this requirements-first spec.
- **Steering:** a new always-included `art-direction.md` (task 1), next to `product.md`, `tech.md`, `structure.md` and `content-accuracy.md`.
- **Custom agent:** the read-only `accuracy-reviewer` runs over the new copy, the cultural-care rules and the font licence text before the final checkpoint.
- **Hooks:** the existing `data-check-on-save` hook is unaffected.

## Glossary

- **App**: The React + Vite single-page web application in `app/`.
- **Art_Direction**: The rules of Requirements 1 to 4, 17 and 18, held in the Steering_File.
- **Steering_File**: The file `.kiro/steering/art-direction.md`, with the front matter `inclusion: always`.
- **Ink_Black**: The near-black ink tones of the page, the sky and the text on paper (tokens `background`, `surface`, `nightTop`, `nightMid`, `nightLow`, `inkOnPaper`).
- **Aged_Paper**: The warm paper tones of the surfaces, slips and text on dark (tokens `paper`, `ink`, and the neutral `ghost` and `muted`).
- **Seal_Red**: The one accent colour, cinnabar red. Its tokens are `seal` (fill) and `sealLight` (text and marks on dark backgrounds).
- **Candle_Light**: Warm amber used only as light: glows, halos and gradients, never as a flat fill. The token `candle` is the amber value used inside those glows.
- **Primary_Action**: The one action of a screen that moves the player forward. It is drawn in Seal_Red.
- **Paper_Slip**: A button or card drawn as a small slip of Aged_Paper with an ink label.
- **Success_Mark**: Any text or mark that tells the player something succeeded, such as "Laid to rest".
- **Ink_Ghost**: The one original ghost: a brushed silhouette with bleeding edges, drawn as inline SVG with an `feTurbulence` and `feDisplacementMap` filter.
- **GhostFigure**: The shared component `app/src/components/GhostFigure.tsx`. It draws the Ink_Ghost at every size.
- **Ghost_Card**: The clue card (`GhostPrompt`) that shows a ghost's meaning and pinyin.
- **Ghost_State**: One of `haunting`, `faded`, `flickering`, `drifted`, as defined in `visual-identity`.
- **Outcome**: `clean`, `struggled` or `gave-up`, as defined in `ghost-game-core`.
- **Flinch**: A short flicker of the Ink_Ghost caused by a wrong key in the Summon step. It is not an Outcome and not a Ghost_State.
- **Night_Scene**: The page background: the Sky_Gradient, the Moon, two Mist_Bands, Paper_Grain and the Vignette.
- **Moon**: A full pale disc, 4 rem across, with a soft halo, drawn with CSS gradients on `body::before`, in the top right of the viewport, never cut off by a viewport edge and never under text. *(Amended, approved by the human, screenshot review.)*
- **Moon_Room**: The empty band at the top of every screen below 992 CSS pixels wide, 4.75 rem (76 CSS pixels) high, in which only the Moon is drawn. It is 0 at 992 CSS pixels and wider, where the Moon lies to the right of the content column. The CSS custom property `--moon-room` holds it.
- **Mist_Band**: One of two translucent horizontal bands of mist that drift in opposite directions. Band A (strong) is centred at 88% of the viewport height with a peak alpha of 0.18; band B (soft) is centred at 72% with a peak alpha of 0.10. Each band is made of two ellipses at the same height. *(Amended, approved by the human, screenshot review.)*
- **Paper_Grain**: A fine noise texture drawn by an inline SVG `feTurbulence` filter in a `data:` URI.
- **Vignette**: A soft darkening towards the edges of the viewport.
- **Legend_Line**: The approved line 天雨粟，鬼夜哭 of the intro, with its English rendering.
- **Ink_Reveal**: The effect that makes the Legend_Line appear as if written, left to right, by a CSS mask wipe.
- **Keycap**: One key of the Summon_Keyboard, drawn as a worn keycap.
- **Summon_Keyboard**: The 25 on-screen keys of the Summon step, in the rows `QWERTYUIOP`, `ASDFGHJKL` and `XCVBNM`.
- **Seal_Stamp**: A red seal that stamps the paper when a ghost is laid to rest. It carries the ghost's own character (the Seal_Glyph) and sits in the Seal_Margin, 32 CSS pixels square, 4 CSS pixels from the right and bottom edges of the paper.
- **Seal_Glyph**: The Dataset_Character of the ghost that was laid to rest, taken from the dataset record of the target character, set in the Chinese_Font in `paperLabel` on `seal`.
- **Laid_To_Rest**: The Outcome `clean` of a ghost.
- **Outcome_Motion**: The motion of the Ink_Ghost for an Outcome: dissolve upward like ink smoke for `clean`, linger at the paper's edge for `struggled`, slip away for `gave-up`.
- **Graveyard_Screen**: The screen that shows one tablet per dataset character.
- **Tablet**: One cell of the Graveyard_Screen, drawn as a stone tablet with an arched top.
- **Hillside**: The inline SVG silhouette of a night hill, drawn behind the grid of Tablets, `aria-hidden`.
- **Tablet_Tilt**: The fixed rotation of a Tablet, taken from the five-value pattern `[-3, 1.5, 0, -1.5, 3]` degrees by the Tablet's position modulo 5. It is never random.
- **Seal_Margin**: The paper margin in the lower right corner of the Writing_Surface, between the hanzi-writer drawing area and the paper edge, in which the Seal_Stamp sits. Its width is `WRITE_PADDING_PX` (40 CSS pixels).
- **Grave_State**: One of `unmet`, `restless`, `at-rest`, as defined in `visual-identity`.
- **Dataset_Character**: A character of `app/public/data/characters.json` (300 characters).
- **Key_Shape**: The shape shown on a Keycap, from `CANGJIE_KEYS` in `app/src/engine/cangjieRules.ts`, including 難.
- **Glyph_Set**: The set of CJK characters and punctuation that the App can display: the Dataset_Characters, the Key_Shapes, the Legend_Line with its punctuation, and every other CJK character in the user-facing text of `app/src`.
- **Chinese_Font**: The one bundled Chinese font, LXGW WenKai Regular, version v1.530, SIL Open Font License 1.1, subset to the Glyph_Set.
- **Font_Pipeline**: The script `scripts/build-font.ts`, run as `npm run build:font`, that produces the Chinese_Font subset.
- **Font_Subset**: The file `app/src/assets/fonts/lxgw-wenkai-subset.woff2` produced by the Font_Pipeline.
- **Font_Sources_File**: The file `data/raw/fonts/SOURCES.md`, which records the source file, release, checksum and licence of the Chinese_Font.
- **Bundle_Budget**: 300,000 bytes, the sum of the gzip sizes of every file in `app/dist` except `data/characters.json`, as defined in `visual-identity`.
- **Bundle_Check**: The script `scripts/check-bundle-size.ts`, run as `npm run check:bundle`.
- **Reduced_Motion**: The user setting `prefers-reduced-motion: reduce`.
- **Causal_Motion**: An animation that starts because of a player action or a game event and shows that cause and effect.
- **Ambient_Motion**: An animation that runs without a player action: the Mist_Bands, the idle float of the Ink_Ghost and the idle candle glow.
- **Rite_Timing**: A timing of the Summon step that is part of the rite: `SUMMON_HOLD_MS`, `SUMMON_FADE_MS` and `SUMMON_INK_SPEED`.
- **Motion_Window**: The duration range of 200 ms to 600 ms.
- **Cultural_Care_Rules**: The rules of Requirement 18.
- **Rite_Viewports**: The two viewports 1024 × 768 and 375 × 812 CSS pixels, and the Narrow_Phone viewport 320 × 640, as defined in `visual-identity`.
- **E2E_Suite**: The Playwright tests in `e2e/`, run by `npm run test:e2e` in Chromium. They are not part of the Test_Suite.
- **Test_Suite**: The Vitest tests run by the repository's root `npm test`.
- **Screenshot_Folder**: The folder `e2e/screenshots/`, to which the E2E_Suite writes the screenshots of Requirement 20.
- **Accuracy_Reviewer**: The read-only custom agent in `.kiro/agents/accuracy-reviewer.json`.

## Requirements

### Requirement 1: Steering file for the art direction

**User Story:** As the maintainer, I want the art direction written once in an always-included steering file, so that every later screen and every agent session follows the same rules.

#### Acceptance Criteria

1. THE first task of this spec SHALL create the Steering_File, before any other file of this feature changes.
2. THE Steering_File SHALL begin with a front matter block whose `inclusion` value is `always`.
3. THE Steering_File SHALL state the one-line direction: a séance at a writing desk, ink and paper by candlelight, spooky but calm.
4. THE Steering_File SHALL hold the palette rules of Requirement 2, the ghost rule of Requirement 6, the motion rules of Requirement 17 and the Cultural_Care_Rules of Requirement 18.
5. THE Steering_File SHALL list the Primary_Action of each screen, as in Requirement 10.
6. THE Steering_File SHALL name the exemptions that the human approved for Ambient_Motion and Rite_Timing, as approved by the human in Requirement 17.
7. THE Test_Suite SHALL fail IF the Steering_File lacks the front matter value `inclusion: always`.
8. THE Steering_File SHALL contain no personal name.

### Requirement 2: Palette

**User Story:** As a player, I want a calm palette of ink, paper and one red accent, so that every screen feels like the same room.

#### Acceptance Criteria

1. THE App SHALL use Ink_Black and Aged_Paper as its base colours and Seal_Red as its only accent colour.
2. THE App SHALL use Seal_Red only for the Primary_Action of a screen, for the Seal_Stamp and for Success_Marks.
3. THE App SHALL use Candle_Light only as light: glows, halos and gradients.
4. THE App SHALL define in `app/src/styles/theme.ts` the tokens `seal`, `sealLight` and `paperLabel`, and SHALL mirror them as custom properties in `app/src/styles/index.css`, checked equal by `index.css.test.ts`.
5. THE theme tests SHALL check a contrast ratio of at least 4.5:1 between `paperLabel` and `seal`, and between `sealLight` and each of `background`, `surface`, `nightTop`, `nightMid` and `nightLow`.
6. THE theme tests SHALL check a contrast ratio of at least 3:1 between the border of the Primary_Action and `nightLow`.
7. THE theme tests SHALL keep every existing contrast check at 4.5:1 or 3:1 as before, with the changed token values.
8. THE App SHALL replace the neutral-blue accent `ghost` with an Aged_Paper neutral that keeps a contrast ratio of at least 4.5:1 on every background where it is used.

### Requirement 3: Candle light, the main button and the focus ring

**User Story:** As a player, I want the candle to be light and not a flat colour, so that the page glows without a gold button.

#### Acceptance Criteria

1. THE App SHALL replace the flat candle-gold fill of the main button of the Start_Menu with the Primary_Action style of Requirement 10.
2. THE Test_Suite SHALL fail IF any file of `app/src` other than `theme.ts` and `tailwind.config.ts` uses the class `bg-candle` or the token `candle` as a `background-color`, `border-color`, `color` or `fill`.
3. THE App SHALL use the token `candle` only inside `box-shadow`, `radial-gradient` and `linear-gradient` values.
4. THE focus ring of every control SHALL be drawn in Aged_Paper with a surrounding soft Candle_Light glow, at least 2 CSS pixels wide, and SHALL keep a contrast ratio of at least 3:1 against the ring-offset colour. *(Approved by the human, Q3; replaces the candle-coloured ring of `visual-identity` Requirement 21.5.)*
5. THE `index.css.test.ts` SHALL replace the test "colours every focus ring with the candle" with a test of criterion 4.

### Requirement 4: Success, error and neutral colours

**User Story:** As a player, I want results to read by their words and shapes first, so that colour is never the only signal.

#### Acceptance Criteria

1. THE App SHALL draw every Success_Mark, including the "Laid to rest" result line and the at-rest marker of the Graveyard_Screen, in `sealLight` on dark backgrounds, together with a text or shape cue.
2. THE App SHALL draw the `error` token as an Aged_Paper neutral, and SHALL pair every error message with its existing text cue ("Try again" or the existing message) and a non-colour shape cue.
3. THE App SHALL use no green hue for success and no red hue for errors. *(Replaces the green `success` token and the coral `error` token; approved by the human, Q4.)*
4. THE theme tests SHALL check a contrast ratio of at least 4.5:1 between each of the tokens `success`, `error`, `ghost`, `muted` and `ink` and each of `background`, `surface`, `nightTop`, `nightMid` and `nightLow`.

### Requirement 5: Surfaces on paper

**User Story:** As a player, I want the writing paper to carry only ink tones and the hint to stay visible, so that the red stays rare.

#### Acceptance Criteria

1. THE Practice_Grid and the outline colour of hanzi-writer SHALL use an ink-brown tone (token `gridLine`) and no Seal_Red. *(Amends `visual-identity` Requirement 1 and the Ink_Palette; approved by the human, Q5.)*
2. THE Write_Mode SHALL pass a `highlightColor` that is an indigo ink tone (token `hintInk`) with a contrast ratio of at least 4.5:1 against Paper, and SHALL keep the existing text message that announces a Stroke hint.
3. THE theme tests SHALL check a contrast ratio of at least 4.5:1 between Paper and each of `inkOnPaper`, `drawing` and `hintInk`.
4. THE Practice_Grid SHALL keep its five line groups, its opacity of at most 0.35 and its `aria-hidden` attribute.

### Requirement 6: One ink-wash ghost

**User Story:** As a player, I want one original ink-wash ghost that I recognise everywhere, so that the game has a face.

#### Acceptance Criteria

1. THE GhostFigure SHALL draw the Ink_Ghost as one inline SVG: a brushed silhouette path with bleeding edges, made by an `feTurbulence` filter that feeds an `feDisplacementMap` filter, filled as an ink wash (criteria 9 and 10) and not as a flat colour. *(Amended, approved by the human, screenshot review.)*
2. THE GhostFigure SHALL be the only component that draws a ghost, and SHALL replace the previous blob silhouette in the Ghost_Card, the Start_Menu, the IntroScreen and every other place that shows a ghost.
3. THE GhostFigure SHALL keep one path and one filter definition for every size, and SHALL scale the displacement in proportion to the rendered size so that the edge looks the same at 36 px and at 160 px.
4. THE GhostFigure SHALL give each instance a unique filter identifier, so that two instances on one screen never share or collide on an identifier.
5. THE GhostFigure SHALL be hidden from assistive technology, SHALL be unfocusable, SHALL contain no `text` element, and SHALL have the same shape in every place it is used.
6. THE GhostFigure SHALL contain no value derived from a Dataset_Character.
7. THE Ink_Ghost SHALL show two small eye marks inside the silhouette, drawn as paths, not as text.
8. THE GhostFigure tests SHALL check the properties of criteria 1, 4, 5 and 6 and SHALL no longer assert the two `circle` eyes of the previous shape.
9. THE GhostFigure SHALL fill the silhouette with an uneven ink tone: a `linearGradient` that runs from full opacity at the head to 0.55 opacity at the hem, and a second, darker wash layer (a `radialGradient` of the `background` token, peak opacity 0.35, centred off-axis) clipped to the same silhouette, so that the tone differs between at least two regions of the body. *(Added, approved by the human, screenshot review.)*
10. THE GhostFigure SHALL bleed its lower edge: a copy of the silhouette, shifted down by 1.5 viewBox units, blurred by an `feGaussianBlur` with a standard deviation of 1.2 viewBox units and drawn at 0.45 opacity beneath the body, so that the hem looks like wet ink. *(Added, approved by the human, screenshot review.)*
11. THE GhostFigure SHALL give every gradient, filter and clip it defines an identifier made from one `useId` value plus a fixed suffix, so that two instances on one screen never share an identifier. *(Added, approved by the human, screenshot review.)*

### Requirement 7: Favicon

**User Story:** As a player, I want the browser tab to show the same ghost, so that the game looks consistent.

#### Acceptance Criteria

1. THE App SHALL replace `app/public/favicon.svg` with the Ink_Ghost silhouette drawn as an unfiltered path, with its bleeding edge baked into the path geometry.
2. THE favicon SHALL contain no `filter` element and no filter attribute, because support for filters inside SVG favicons is not documented for the major browsers.
3. THE favicon SHALL be one file of at most 4,096 bytes and SHALL reference no external resource.
4. THE App SHALL ship only the SVG favicon `app/public/favicon.svg`, declared in `app/index.html` with `rel="icon"` and `type="image/svg+xml"`, and SHALL add no raster icon, no `apple-touch-icon` and no `mask-icon`. *(Approved by the human, Q7.)*
5. THE Test_Suite SHALL fail IF the favicon contains a `filter` element or a filter attribute, or IF the favicon path differs from the GhostFigure silhouette path.
6. THE favicon SHALL stay a flat, unfiltered copy of the silhouette with no gradient, because the wash is invisible at 16 CSS pixels. *(Added, approved by the human, screenshot review.)*

### Requirement 8: Night scene

**User Story:** As a player, I want a layered night that I can see at a glance, so that a screenshot already tells the story.

#### Acceptance Criteria

1. THE App SHALL paint the Night_Scene behind every screen with CSS and inline SVG `data:` URIs only, with no image file.
2. THE Night_Scene SHALL contain, from back to front, the Sky_Gradient, the Moon, two Mist_Bands, the Paper_Grain and the Vignette. *(Amended, approved by the human, screenshot review: the order is unchanged; the Moon stays a gradient of `body::before`, not a positioned element.)*
3. THE Moon SHALL be a full pale disc with a soft halo, 4 rem across, with its centre 2.5 rem from the right edge and 2.5 rem from the top edge of the viewport, so that the whole disc is inside the viewport on every screen, and SHALL sit where no text or control is drawn at the Rite_Viewports. THE disc SHALL have a peak alpha of 0.65 and the halo a peak alpha of 0.10. *(Amended, approved by the human, screenshot review: replaces the half-visible disc of 3.2 rem at `82% 0%` with alpha 0.55.)* *(Amended again, approved by the human, task 12.2: the disc alpha is 0.65, not 0.70, because with the halo under the disc and the grain at 0.03, 0.70 gives `error` 4.20:1 and 0.65 is the highest value at 4.5:1.)*
4. THE two Mist_Bands SHALL drift in opposite horizontal directions, each with a drift period of at least 90 seconds, SHALL be visible in a still screenshot at their resting position, SHALL differ in peak alpha (0.18 and 0.10) and in height (88% and 72% of the viewport height), and SHALL lie in the lower third of the viewport. *(Amended, approved by the human, screenshot review: replaces the single peak alpha of 0.09 and the disjoint ellipses at 27% to 90%. Amends `visual-identity` Requirement 21.3 and 21.4 only in strength: the halo peak opacity limit of 0.10 stays for the halo; the disc is exempt; the blue-black night stays and the Moon disc is a separate object; approved by the human, Q8.)*
5. THE App SHALL give every text colour token a contrast ratio of at least 4.5:1 against the worst-case composite of the Sky_Gradient, the Mist_Band that lies at that height at its own peak alpha, the Moon halo and the Paper_Grain, each composite taken at the height where that layer is strongest. *(Amended, approved by the human, screenshot review: the 4.5:1 threshold is unchanged. The composites are the band A composite at 88%, the band B composite at 72% and the halo composite near the Moon.)*
6. WHILE Reduced_Motion is active, THE Mist_Bands SHALL be static at their resting positions.
7. THE Night_Scene SHALL let mouse, touch and pen events reach the controls above it, and SHALL add no element to the accessibility tree.
8. THE Night_Scene SHALL add no new DOM element; it SHALL use the existing pseudo-elements `body::before`, `body::after` and `#root::before`, or a new pseudo-element of `#root`.
9. THE Test_Suite SHALL fail IF a `url()` in `app/src/styles/index.css` is neither a `data:` URI nor the single Font_Subset asset of Requirement 16.
10. THE App SHALL leave the Moon_Room empty above the first heading of every screen below 992 CSS pixels wide by adding `padding-top: var(--moon-room)` to `#root` and by setting the height of the screen's `main` element to the viewport height minus `--moon-room`, so that no screen gains a vertical scrollbar from the Moon_Room. THE value of `--moon-room` SHALL step from 0 to 4.75 rem at 992 CSS pixels with a `clamp()` expression and no `@media` rule. *(Added, approved by the human, screenshot review.)*
11. WHILE the Graveyard_Screen or the Sources & licences screen is scrolled, THE sticky header of that screen SHALL stay below the Moon_Room (`top: var(--moon-room)`), so that no header text or control meets the Moon. *(Added, approved by the human, screenshot review.)*
12. THE E2E_Suite SHALL fail, at 1024 × 768, 375 × 812 and 320 × 640, IF any control or text element meets the Moon disc, or IF the Moon disc, read from the custom properties `--moon-size`, `--moon-inset-x` and `--moon-inset-y`, is not wholly inside the viewport. *(Added, approved by the human, screenshot review: extends the overlap test of Requirement 20.)*
13. THE `index.css.test.ts` SHALL check that `--moon-size` is at least 4 rem, that both insets are at least half of `--moon-size`, that the disc alpha is greater than the halo alpha, that the halo alpha is at most 0.10, and that `ink` and `error` keep 4.5:1 against the disc composite. *(Added, approved by the human, screenshot review. The other text tokens do not reach 4.5:1 on the disc, and criterion 12 keeps all text out of it.)*

### Requirement 9: First screen

**User Story:** As a first-time player, I want the intro to show the scene, the ghost and a serif title, and to write the legend in ink, so that the first screen already sets the mood.

#### Acceptance Criteria

1. THE IntroScreen SHALL show, above the legend text, the GhostFigure and the `h1` "Ghost Script" in the display serif (Cormorant Garamond) at a size of at least 3rem.
2. THE IntroScreen SHALL show the Legend_Line 天雨粟，鬼夜哭 with its English rendering and its Huainanzi attribution, with the exact text approved in `content-accuracy.md`, on a Paper_Slip (`card-slip`) instead of the grey box. *(Amended, approved by the human, screenshot review.)*
3. WHEN the IntroScreen appears, THE Legend_Line SHALL appear with the Ink_Reveal: a CSS mask that wipes from left to right over 600 ms.
4. THE Legend_Line SHALL be present in the DOM and the accessibility tree from the first render, and SHALL be fully visible when Reduced_Motion is active.
5. THE Ink_Reveal SHALL use no hanzi-writer instance, because the dataset holds only 天 and 雨 of the six legend glyphs, and `charDataLoader` serves only dataset characters.
6. THE IntroScreen SHALL read "Type a ghost's shapes to summon it, then write it from memory." in its second paragraph, replacing "Type its shapes to summon it, then write it from memory.".
7. THE IntroScreen SHALL show "Begin the Séance" as its Primary_Action.
8. THE `IntroScreen.test.tsx` SHALL assert the new sentence and SHALL fail IF the old sentence remains.
9. THE IntroScreen SHALL set the Legend_Line in the Chinese_Font at `text-3xl` (30 CSS pixels) below 640 CSS pixels and `text-4xl` (36 CSS pixels) from 640 CSS pixels, in `inkOnPaper` on `paper`, and SHALL set the English rendering and the attribution in `inkOnPaper` on `paper` as well. THE theme test SHALL check at least 4.5:1 between `inkOnPaper` and `paper` (12.84:1 computed). *(Added, approved by the human, screenshot review.)*
10. THE Ink_Reveal SHALL be applied to the `blockquote` inside the Paper_Slip and not to the slip, so that the slip and its shadow are static and the ink is written onto the paper. THE reveal SHALL keep its place inside the no-preference block, and the text SHALL be fully visible under Reduced_Motion. *(Added, approved by the human, screenshot review.)*

### Requirement 10: Paper slips, cards and the Primary_Action

**User Story:** As a player, I want buttons and cards that look like paper slips with an ink label, and one red action per screen, so that I always know what moves me forward.

#### Acceptance Criteria

1. THE App SHALL draw every secondary button and every card as a Paper_Slip: an Aged_Paper surface with an ink label.
2. THE App SHALL draw the Primary_Action in Seal_Red fill with the `paperLabel` text colour and a visible Aged_Paper border.
3. THE App SHALL show at most one Primary_Action on each screen at a time.
4. THE Primary_Action of each screen SHALL be: the IntroScreen, "Begin the Séance"; the Start_Menu, "Begin a Nightly Séance"; the Cangjie_Guide, its continue button; the Seance_Session after an Outcome, "Next ghost" or "Finish the séance"; the Leave_Prompt, "Stay"; the SessionSummary, "Begin another Séance". *(Approved by the human, Q9.)*
5. THE Summon step, the Write step before an Outcome, the Graveyard_Screen and the Sources & licences screen SHALL show no Primary_Action; their "Give up" and "Back to menu" buttons SHALL be Paper_Slips.
6. THE App SHALL keep, for every button, its accessible name, a minimum height of 44 px and a visible focus ring.
7. THE component tests of the screens of criterion 4 SHALL check that the Primary_Action carries the Seal_Red style class and that no other button on the same screen does.

### Requirement 11: Summon keys and the Flinch

**User Story:** As a player, I want keys that look worn and a ghost that flinches at a wrong key, so that typing feels physical and each mistake has a visible cause.

#### Acceptance Criteria

1. THE Summon_Keyboard SHALL draw each Keycap as a worn keycap: a rounded paper-toned cap with an inner bevel, a darker lower edge and a fine scuff texture drawn in CSS gradients.
2. THE Summon_Keyboard SHALL keep each Keycap at least 44 CSS pixels high and at least 32 CSS pixels wide (27 below 370 px, as in `visual-identity` Requirement 25.9), so that the one-screen fit of the Summon step is unchanged.
3. THE Keycap SHALL keep its letter, its Key_Shape, its accessible name, and the marker of the next key.
4. WHEN a wrong key is typed in the Summon step, THE Ghost_Card SHALL show the Flinch: the Ink_Ghost flickers once for 400 ms.
5. THE Seance_Session SHALL derive the Flinch from a wrong-key event that the Summon_Step reports through the optional callback `onWrongKey`, and SHALL pass the Flinch to the Ghost_Card as a presentation prop.
6. THE Flinch SHALL change no Ghost_State, no Outcome, no hint and no scheduling value.
7. WHILE Reduced_Motion is active, THE Ghost_Card SHALL show no Flinch animation and SHALL show a static text or shape cue for the wrong key that the Summon step already shows.
8. THE Flinch SHALL contain no Dataset_Character in any text node or attribute.
9. THE Summon_Step SHALL call `onWrongKey` once for each wrong key that its engine counts as a miss, and for no other event.

### Requirement 12: Brush-like strokes

**User Story:** As a player, I want strokes that look brushed, so that writing feels like ink on paper.

#### Acceptance Criteria

1. THE Write_Mode SHALL pass `strokeColor` from the Ink_Black tokens, `drawingColor` from the `drawing` token, `highlightColor` as in Requirement 5.2 and `outlineColor` from the `gridLine` token.
2. THE Write_Mode SHALL pass `drawingWidth` of 6 or more, and SHALL leave `strokeFadeDuration`, `drawingFadeDuration` and `strokeHighlightSpeed` at values that keep each of their animations inside the Motion_Window.
3. THE InkSurface SHALL apply one CSS `filter` that references an SVG `feDisplacementMap` definition to the hanzi-writer container, so that the edges of finished strokes bleed slightly. IF the selector for the finished strokes is brittle in hanzi-writer 3.7.3, THEN THE InkSurface SHALL drop the filter and rely on `drawingWidth`. *(Approved by the human, Q6.)*
4. THE InkSurface filter SHALL add no new character or stroke data.
5. WHILE Reduced_Motion is active, THE InkSurface filter SHALL stay applied, because it is a static texture and not an animation.
6. THE Write_Mode SHALL leave the quiz options, the hint rule, the Outcome rules and the never-reveal rule unchanged.
7. THE design SHALL record which hanzi-writer 3.7.3 options can change the look without new data and which cannot (a per-stroke brush width, a pressure taper and a stroke texture need new data or a custom renderer, and are out of scope).
8. THE Write_Mode SHALL pass the hanzi-writer option `padding` of `WRITE_PADDING_PX` (40 CSS pixels), exported from `app/src/engine/sealLayout.ts`, so that the Seal_Margin is free of strokes. THE design SHALL state the trade-off: the character is drawn 2 x (40 - 12) = 56 CSS pixels smaller on each side of the square (220 instead of 276 CSS pixels at 375 wide), the paper that receives the pointer stays the same size, and the e2e fit specs and the quiz tests confirm that the smaller character is still written and checked. *(Added, approved by the human, screenshot review: replaces `padding: 12`.)*

### Requirement 13: Seal stamp

**User Story:** As a player, I want a red seal with the ghost's own character to stamp the paper when I lay a ghost to rest, so that the win has a physical mark.

#### Acceptance Criteria

1. WHEN the combined Outcome of a ghost is `clean`, THE Seance_Session SHALL show one Seal_Stamp in the Seal_Margin at the lower right corner of the Writing_Surface, after the Write step has ended, and THE Seal_Stamp SHALL cover no stroke (criteria 13 to 15). *(Amended, approved by the human, screenshot review: the stamp no longer lies over the drawing area.)*
2. THE Seal_Stamp SHALL be a `seal` square with a lighter inner border and rough edges, drawn as an inline SVG, that carries the Seal_Glyph. *(Approved by the human, Q10 as changed.)*
3. THE Seal_Stamp SHALL take the Seal_Glyph from the dataset record of the ghost's target character, and SHALL contain no other Chinese text and no invented character shape.
4. THE Seal_Stamp SHALL draw the Seal_Glyph in the Chinese_Font, in the `paperLabel` colour on `seal`, at a font size of 24 CSS pixels (18 pt), as an HTML text element with `lang="zh"` placed over the SVG. *(Amended, approved by the human, screenshot review: replaces 28 CSS pixels.)*
5. THE theme tests SHALL check a contrast ratio of at least 4.5:1 between `paperLabel` and `seal`. THE design SHALL state that the Seal_Glyph counts as large text (24 CSS pixels in a regular weight is 18 pt, the threshold of WCAG 2.2, where 3:1 suffices) and that the stricter 4.5:1 is met anyway (5.05:1).
6. THE Seal_Stamp SHALL have the role `img` and the accessible name "Seal: " followed by the Seal_Glyph, and SHALL mark its visible glyph and its SVG `aria-hidden`, so that the Seal_Glyph is announced once, in the accessible name of the Seal_Stamp.
7. THE Seal_Stamp SHALL stamp in 300 ms: it SHALL scale from 1.3 to 1 while its opacity rises from 0 to 1.
8. WHILE Reduced_Motion is active, THE Seal_Stamp SHALL appear at once in its final state.
9. THE Seal_Stamp SHALL ignore pointer events and SHALL take no layout space, so that the one-screen fit of the Write step is unchanged. THE Seal_Stamp SHALL be 32 CSS pixels square, with `bottom` and `right` of 4 CSS pixels, taken from `SEAL_SIZE_PX` and `SEAL_INSET_PX` of `app/src/engine/sealLayout.ts`. *(Amended, approved by the human, screenshot review: replaces 48 CSS pixels at 8 CSS pixels.)*
10. IF the combined Outcome is `struggled` or `gave-up`, THEN THE Seance_Session SHALL show no Seal_Stamp. *(Approved by the human, Q11.)*
11. THE Seal_Stamp SHALL not exist in the DOM before the combined Outcome is `clean`: not during the Summon step, not during the Write step, and not after a `struggled` or `gave-up` Outcome, so that the never-reveal rule is unchanged.
12. THE `SealStamp.test.tsx` and `SeanceSession.test.tsx` SHALL check criteria 3, 6, 10 and 11, including that no element with the role `img` and a name that starts with "Seal:" exists during the Summon step, during writing, and after a `struggled` or a `gave-up` Outcome.
13. THE Seal_Stamp SHALL lie wholly outside the hanzi-writer drawing area: the clearance `WRITE_PADDING_PX - (SEAL_SIZE_PX + SEAL_INSET_PX)` SHALL be at least 4 CSS pixels (as built: 40 - 36 = 4). THE Test_Suite SHALL fail IF the clearance is below 4, IF `WriteMode` passes a `padding` other than `WRITE_PADDING_PX`, or IF `SealStamp` uses a size or inset other than the two constants. *(Added, approved by the human, screenshot review.)*
14. THE E2E_Suite SHALL, at the Write step after a `clean` Outcome on a real Dataset_Character, at 1024 × 768 and 375 × 812, compare the bounding box of the Seal_Stamp with the bounding box of every `path` inside the hanzi-writer SVG and SHALL fail IF any of them lies within 2 CSS pixels of the Seal_Stamp box or overlaps it. *(Added, approved by the human, screenshot review. The 2 CSS pixels allow for the displacement of the ink-bleed filter.)*
15. THE Seal_Stamp SHALL keep the stamp motion, the `role="img"` label and the clean-only rule of criteria 6, 7, 8, 10 and 11 unchanged. *(Added, approved by the human, screenshot review.)*

### Requirement 14: Outcome motions

**User Story:** As a player, I want each way a ghost leaves to look different, so that I feel what happened.

#### Acceptance Criteria

1. WHEN the Outcome of a ghost is `clean`, THE Ink_Ghost SHALL dissolve upward like ink smoke within 600 ms, and stay transparent.
2. WHEN the Outcome of a ghost is `struggled`, THE Ink_Ghost SHALL move to the right edge of the Ghost_Card within 600 ms, and stay there at an opacity of 0.5.
3. WHEN the Outcome of a ghost is `gave-up`, THE Ink_Ghost SHALL slip away sideways and downward while fading to fully transparent within 600 ms, and stay transparent.
4. WHILE Reduced_Motion is active, THE App SHALL show the end state of criteria 1 to 3 at once, without animation.
5. THE Ghost_Card SHALL keep the attribute `data-ghost-state` with the values `haunting`, `faded`, `flickering` and `drifted`, and SHALL keep `ghostStateFor` unchanged.
6. THE Ghost_Card SHALL keep the meaning and pinyin text at full opacity in every Ghost_State.
7. WHEN the Outcome of a ghost is reached, THE App SHALL show the result text and the Primary_Action of Requirement 10.4 at that moment, without waiting for the Outcome_Motion to end.
8. THE `index.css.test.ts` SHALL replace its test "ends the flicker at opacity 0.5" with a test of criterion 2.

### Requirement 15: Graveyard of stone tablets

**User Story:** As a player, I want the Graveyard to look like a night hillside of stone tablets, so that my progress looks like a place.

#### Acceptance Criteria

1. THE Graveyard_Screen SHALL draw each Tablet as a stone tablet with an arched top (a border radius of `50% 50% 3px 3px / 36% 36% 3px 3px`), on the Hillside. *(Amended, approved by the human, screenshot review: replaces the hillside drawn with a CSS gradient only.)*
2. WHILE a Tablet is in the Grave_State `at-rest`, THE Graveyard_Screen SHALL draw a small Candle_Light glow at the foot of the Tablet.
3. WHILE a Tablet is in the Grave_State `restless`, THE Graveyard_Screen SHALL draw a wisp rising from the Tablet.
4. WHILE a Tablet is in the Grave_State `unmet`, THE Graveyard_Screen SHALL draw the Tablet blank, with no glyph and no marker of a character.
5. THE Graveyard_Screen SHALL write on a Tablet only the glyph of a Dataset_Character that the player has met, and SHALL write no other character and no decorative Chinese text.
6. THE Graveyard_Screen SHALL tell the three Grave_States apart by the outline shape of the Tablet, by the text marker (`·`, `!`, `✓`) and by an accessible name that states the state, so that colour is never the only signal.
7. THE Graveyard_Screen SHALL keep its legend, its counts, its empty-state line, its sticky header and its grid reflow between 375 px and 1440 px without horizontal scrolling.
8. THE Graveyard_Screen SHALL give glyphs and text a contrast ratio of at least 4.5:1 against the background of their Tablet.
9. WHILE Reduced_Motion is not active, THE wisp of a `restless` Tablet SHALL move slowly as Ambient_Motion; WHILE Reduced_Motion is active, THE wisp SHALL be static.
10. THE `Graveyard.test.tsx` SHALL keep its assertions of the never-reveal rule for unmet Tablets and SHALL add assertions of criteria 2 to 4 and 6.
11. THE Graveyard_Screen SHALL draw the Hillside as one inline SVG with two overlapping ridge paths behind the grid, `aria-hidden="true"`, `focusable="false"`, `preserveAspectRatio="none"`, with no `text` element and no Chinese text, in tones darker than `surface`. *(Added, approved by the human, screenshot review.)*
12. THE Graveyard_Screen SHALL tilt each Tablet by `Tablet_Tilt`, chosen by the pure function `tabletTilt(position)` of `app/src/engine/tabletTilt.ts` as `[-3, 1.5, 0, -1.5, 3][position % 5]` degrees, and SHALL apply it by CSS classes `tablet-tilt-0` to `tablet-tilt-4`. *(Added, approved by the human, screenshot review.)*
13. THE Graveyard_Screen SHALL draw an `unmet` Tablet as blank dark stone with the arched outline and no border style of dots or dashes, with no glyph, keeping the marker `·` and the accessible name "Ghost N of M, never met". THE `at-rest` Tablet SHALL keep a solid border, the Candle_Light glow at its base and the marker `✓`; THE `restless` Tablet SHALL keep a dashed border, a chipped upper corner, the wisp above and the marker `!`. *(Added, approved by the human, screenshot review: colour is never the only signal.)*
14. THE Graveyard_Screen SHALL keep the grid free of horizontal overflow at 320, 375 and 1440 CSS pixels with the Tablet_Tilt applied; the largest tilt of 3 degrees adds at most 56 x sin(3°) = 3 CSS pixels to a Tablet's width, which the 12 CSS pixel padding of the grid absorbs. *(Added, approved by the human, screenshot review.)*

### Requirement 16: Chinese font

**User Story:** As a player, I want Chinese glyphs in one calm Kai-style face on every device, so that the characters look the same everywhere and match the brush direction.

#### Acceptance Criteria

1. THE App SHALL bundle one Chinese font, LXGW WenKai Regular, release v1.530, under the SIL Open Font License 1.1. *(Amends `visual-identity` Requirements 12.1 to 12.3; approved by the human, Q1.)*
2. THE Font_Pipeline SHALL read the source file `LXGWWenKai-Regular.ttf` of the release v1.530 from `https://github.com/lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Regular.ttf`, SHALL verify that its SHA-256 is `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b`, and SHALL stop with a non-zero status IF the checksum differs.
3. THE Font_Pipeline SHALL compute the Glyph_Set from the dataset, from `CANGJIE_KEYS`, from the Legend_Line and from every CJK character in the user-facing text of `app/src`, and SHALL write it to `data/fonts/glyph-set.txt` in codepoint order.
4. THE Font_Pipeline SHALL subset the source font to exactly the Glyph_Set with the `subset-font` package pinned to an exact version, SHALL write the Font_Subset as WOFF2, and SHALL stop with a non-zero status IF any Glyph_Set character has no glyph in the source font.
5. THE Font_Pipeline SHALL be deterministic: two runs on the same source file SHALL write byte-identical output, and the SHA-256 of the Font_Subset SHALL be recorded in the Font_Sources_File.
6. THE App SHALL load the Font_Subset through one `@font-face` rule with `font-display: swap` and `unicode-range` limited to the Glyph_Set, from a file served by the App, and SHALL request no font from a third-party host at runtime.
7. THE App SHALL set the Chinese font stack to `"LXGW WenKai Subset"` first, followed by the previous Chinese_Font_Stack as the fallback, in `[lang='zh']` and in the Tailwind `hanzi` family.
8. THE README, the Sources & licences screen (`FONTS` in `app/src/data/credits.ts`), the Notices_File and the Font_Sources_File SHALL each record the name, the release, the licence and the copyright lines of the Chinese_Font, including the Klee Project copyright line that the font's licence file carries.
9. THE Notices_Script SHALL append the full text of the font's `OFL.txt`, copied verbatim from `data/raw/fonts/lxgw-wenkai/OFL.txt`, to the Notices_File, in a deterministic position.
10. THE Sources & licences screen SHALL replace the sentence "Chinese text is drawn with fonts already installed on the device" with a sentence that names the bundled Chinese font and states that other Chinese text falls back to installed fonts.
11. THE Test_Suite SHALL fail IF the Glyph_Set computed from the code and data differs from `data/fonts/glyph-set.txt`, IF the SHA-256 of the committed Font_Subset differs from the one in the Font_Sources_File, IF the README font entry differs from `FONTS`, or IF a CJK character in the user-facing text of `app/src` is missing from the Glyph_Set.
12. THE Bundle_Check SHALL still compare the sum of the gzip sizes with the Bundle_Budget of 300,000 bytes, and the projected total with the Chinese_Font is 201,501 bytes. *(As built: the committed subset has 321 glyphs and 66,532 bytes of WOFF2, SHA-256 `76fc7f88…dc26`; the projected total is 203,330 bytes, still inside the budget. See the design, "Final pipeline run".)*
13. IF the total with the Chinese_Font exceeds the Bundle_Budget, THEN THE design's fallback SHALL keep the system Chinese fonts and bundle no CJK file.
14. THE feature SHALL not change `app/src/data/software.ts` for the Chinese_Font, because the font is not an npm runtime dependency.

### Requirement 17: Motion rules

**User Story:** As a player with motion sensitivity, I want every motion to have a cause and to be short, so that the game stays calm.

#### Acceptance Criteria

1. THE App SHALL run every Causal_Motion for a duration inside the Motion_Window of 200 ms to 600 ms.
2. THE App SHALL declare every animation, transition and keyframe inside one `@media (prefers-reduced-motion: no-preference)` block of `app/src/styles/index.css`, and SHALL show static end states otherwise.
3. THE Steering_File SHALL list every Ambient_Motion by name: the two Mist_Bands, the idle float of the Ink_Ghost, the idle glow of Candle_Light and the wisp of a `restless` Tablet. *(Approved by the human, Q2: Ambient_Motion is exempt from the Motion_Window, named in the Steering_File, and sits behind Reduced_Motion.)*
4. THE Test_Suite SHALL fail IF an animation or transition of `app/src/styles/index.css` lies outside the no-preference block, or IF a Causal_Motion duration lies outside the Motion_Window.
5. THE App SHALL keep the Rite_Timings of Requirement 22.2 unchanged. *(Approved by the human, Q12: the Rite_Timings are exempt from the Motion_Window.)*
6. THE App SHALL play no sound.

### Requirement 18: Cultural care

**User Story:** As a player of Chinese heritage, I want the game to treat its theme with care, so that it is spooky without being disrespectful.

#### Acceptance Criteria

1. THE App SHALL show no funeral imagery: no joss paper, no offering money, no talisman script and no incense for the dead.
2. THE App SHALL show no pumpkin, bat or cobweb.
3. THE App SHALL show no new Chinese text for decoration: every Chinese glyph SHALL come from the dataset, from `CANGJIE_KEYS` or from the sourced Legend_Line.
4. THE Tablets and the ghost SHALL carry no invented Chinese text, no pseudo-Chinese shapes and no imitation of seal-script characters, and THE Seal_Stamp SHALL carry only the Seal_Glyph of Requirement 13, set in the Chinese_Font and not in a seal-script imitation.
5. THE App SHALL present the legend as a story and as a design premise, and SHALL make no claim about Cangjie beyond those allowed in `content-accuracy.md`.
6. THE Test_Suite SHALL fail IF a CJK character appears in the user-facing text of `app/src` that is not in the Glyph_Set.
7. THE Accuracy_Reviewer SHALL review the new copy and the Cultural_Care_Rules before the final checkpoint.

### Requirement 19: No game-rule, data or storage change

**User Story:** As the maintainer, I want proof that this feature is only presentation, so that the game still behaves as approved.

#### Acceptance Criteria

1. THE implementation SHALL leave unmodified `app/src/engine/scheduler.ts`, `config.ts`, `outcome.ts`, `learningOrder.ts`, `cangjie.ts`, `app/src/storage/storage.ts` and `app/public/data/characters.json`.
2. THE storage schema version SHALL stay at 2, and the implementation SHALL write nothing new to storage.
3. THE existing tests for the hint rules and for the never-reveal rule of the Summon step and of the Ghost_Card SHALL pass without change to their assertions.
4. THE E2E_Suite specs `fits-one-screen.spec.ts` and `no-horizontal-overflow.spec.ts` SHALL pass at 375 × 812, 1024 × 768 and 320 × 640 with their thresholds unchanged.
5. THE implementation SHALL leave `SUMMON_HOLD_MS`, `SUMMON_FADE_MS` and `SUMMON_INK_SPEED` unchanged. *(Approved by the human, Q12.)*

### Requirement 20: Screenshots

**User Story:** As a reviewer, I want screenshots of the main screens, so that I can check the look without playing.

#### Acceptance Criteria

1. THE E2E_Suite SHALL provide the spec `e2e/screenshots.spec.ts`, which writes one PNG for each of these four views to the Screenshot_Folder: the IntroScreen, the Summon step with one key typed (mid-ghost), the Write step, and the Graveyard_Screen with a seeded history of at-rest, restless and unmet ghosts.
2. THE screenshot spec SHALL use the 1024 × 768 viewport and the 375 × 812 viewport and SHALL name each file with its view and viewport.
3. THE screenshot spec SHALL fail IF a PNG is not written or is empty.
4. THE Screenshot_Folder SHALL be listed in `.gitignore`, without removing the rule that keeps `.kiro/`. *(Approved by the human, Q13.)*
5. THE screenshot spec SHALL type no Cangjie code by hand: it SHALL read the code from `characters.json` at test time, as the existing specs do.
6. THE README SHALL tell the reader where the screenshots are written.
7. WHEN the follow-up of the screenshot review is built, THE E2E_Suite SHALL write all eight PNGs again (four views at 1024 × 768 and 375 × 812), and THE screenshot spec SHALL run the moon check of Requirement 8.12 in each view. *(Added, approved by the human, screenshot review.)*
8. THE Write-step screenshot SHALL show the Seal_Stamp, so the seal's place in the Seal_Margin is visible, by laying a real Dataset_Character to rest `clean` before the capture. *(Added, approved by the human, screenshot review.)*

### Requirement 21: Verification

**User Story:** As the maintainer, I want the new work verified by unit and component tests and a content review, so that it ships correct.

#### Acceptance Criteria

1. THE Test_Suite SHALL cover this feature with unit tests and component tests only, and SHALL add no property-based test and no mutation test (decision of Nov 15 in `tech.md`).
2. WHEN all new copy exists, THE maintainer SHALL run the Accuracy_Reviewer over the IntroScreen copy, the Cultural_Care_Rules, the Steering_File, the README changes, the font licence text and the Seal_Stamp accessible name "Seal: " with its role and label wording, and SHALL fix every finding within the scope of this spec.
3. WHEN the final checkpoint runs, THE maintainer SHALL run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app`, `npm run check:bundle` and `npm run test:e2e`, and all SHALL succeed.
4. THE README SHALL be updated with the Chinese_Font record, the `build:font` script, the new palette note and the screenshot folder.

### Requirement 22: Amendments to existing requirements

**User Story:** As the maintainer, I want every change to an approved requirement listed in one place, so that nothing changes silently.

#### Acceptance Criteria

1. THE design SHALL list, for each existing requirement that this feature amends, the old text, the new text and the decision (Q1 to Q13) that the human approved.
2. THE amended requirements SHALL be: `visual-identity` 3.5, 4.1 to 4.3, 12.1 to 12.3, 21.3 to 21.5, 21.12 and 22.5; `summon-ink` `SUMMON_INK_SPEED`; and `cangjie-seance` `SUMMON_HOLD_MS` and `SUMMON_FADE_MS` (listed as Rite_Timings; unchanged by default).
3. WHEN the human approves an amendment, THE maintainer SHALL add an "Amended (approved by the human)" note to the old requirement in its spec, as the earlier amendments do.
4. THE amended requirements of the screenshot review SHALL be the criteria of this spec that carry the note "Amended, approved by the human, screenshot review": 6.1, 8.2 to 8.5, 9.2, 13.1, 13.4, 13.9 and 15.1. THE `visual-identity` requirements 21.3, 21.4 and 21.6 (mist, moon, composite) are amended again by them. *(Added, approved by the human, screenshot review.)*
