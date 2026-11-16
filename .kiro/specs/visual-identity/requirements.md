# Requirements Document

## Introduction

The visual-identity feature makes Ghost Script memorable on video without changing any game rule. It adds a practice grid (米字格) and an ink-on-paper look to the writing surface, turns the clue card into a ghost that fades, flickers or drifts away when its rite ends, adds a Graveyard screen that shows all 300 characters by state, fixes the Summon step layout on phones, adds a Credits screen, rewords two lines of "How Cangjie works", and settles fonts and bundle size.

The feature changes no scheduling, no Outcome rule, no summon or write rule, no hint rule, no storage schema and no dataset. The Graveyard reads the existing saved history and classifies it with a small pure function in `app/src/engine/`.

Budget: about one and a half days. The design is deliberately lean: CSS and inline SVG made in this repository, no new runtime dependency except one self-hosted Latin font, and no CJK font file.

### Kiro features used

- **Specs:** this requirements-first spec (requirements, design, tasks).
- **Steering:** `product.md`, `tech.md`, `structure.md` and `content-accuracy.md` set the scope, the never-reveal rule, the licence list, the approved Huainanzi line and the Cangjie citations that the Credits screen reuses.
- **MCP (Cangjie Oracle):** tasks that need a Cangjie code or a decomposition call the `cangjie-oracle` tools (`lookup`, `decompose`); codes are never written by hand.
- **Custom agent:** the read-only `accuracy-reviewer` runs over all new copy before the final checkpoint.
- **Hooks:** the existing `data-check-on-save` hook is unaffected; this feature does not touch the files it watches.

## Glossary

- **App**: The React + Vite single-page web application in `app/`.
- **Writing_Surface**: The square area in which the player draws the character in the Lay-to-rest step (Write mode).
- **Summon_Surface**: The square area in the Summon step in which the formed character appears.
- **Practice_Grid**: The 米字格 drawn behind a surface: a vertical centre line, a horizontal centre line, two diagonals and an outer border.
- **Paper**: The warm, light background of a surface, made only with CSS or inline SVG authored in this repository.
- **Ink_Palette**: The colour tokens for stroke ink, the player's in-progress stroke, the hint highlight and the Practice_Grid, defined in `app/src/styles/theme.ts`.
- **Ghost_Card**: The clue card (`GhostPrompt`) showing a ghost's meaning and pinyin.
- **Ghost_Figure**: A decorative SVG silhouette of a ghost inside the Ghost_Card. It is the same shape for every character.
- **Ghost_State**: One of `haunting` (rite in progress), `faded` (Outcome `clean`), `flickering` (Outcome `struggled`), `drifted` (Outcome `gave-up`).
- **Outcome**: `clean`, `struggled` or `gave-up`, as defined in ghost-game-core.
- **Rite**: The Summon step followed by the Lay-to-rest step, as defined in cangjie-seance. The Rite ends when the Outcome of the ghost is reached.
- **Target_Character**: The character a ghost stands for. It is hidden until the Rite has run its course.
- **Review_History**: The saved map from character to review entry (`ReviewEntry`), as defined in ghost-game-core.
- **Learning_Order**: The order of the dataset's characters by stroke count, then codepoint (`learningOrder`).
- **Met_Character**: A character that has an own entry in the Review_History.
- **Grave_State**: One of `unmet`, `restless`, `at-rest`, defined in Requirement 6.
- **Grave_Classifier**: The pure functions in `app/src/engine/graveyard.ts` that classify characters into Grave_States.
- **Graveyard_Screen**: The screen showing one grave per character of the dataset.
- **Grave**: One cell of the Graveyard_Screen. A Grave of a Met_Character is drawn as a tombstone; a Grave of an unmet character is drawn as a wisp.
- **Credits_Screen**: The screen listing data sources, licences, the legend source, the Cangjie citations and the fonts.
- **Cangjie_Guide**: The "How Cangjie works" screen (`CangjieGuide`).
- **Start_Menu**: The start menu component (`StartMenu`).
- **Summon_Keyboard**: The 25 on-screen keys of the Summon step, in the rows `QWERTYUIOP`, `ASDFGHJKL` and `XCVBNM`.
- **Reduced_Motion**: The user setting `prefers-reduced-motion: reduce`.
- **Bundle_Budget**: 300,000 bytes, the sum of the gzip sizes of every file in `app/dist` except `data/characters.json`.
- **Bundle_Check**: The script `scripts/check-bundle-size.ts`, run as `npm run check:bundle`.
- **Test_Suite**: The Vitest tests run by the repository's root `npm test`.
- **Accuracy_Reviewer**: The read-only custom agent in `.kiro/agents/accuracy-reviewer.json`.

---

## Requirements

### Requirement 1: Practice Grid

**User Story:** As a player, I want a 米字格 behind the surface I write on, so that I can judge the proportions and placement of my strokes the way I would on practice paper.

#### Acceptance Criteria

1. WHEN the Lay-to-rest step shows the Writing_Surface, THE App SHALL draw the Practice_Grid behind the strokes, edge to edge of the surface.
2. WHEN the Summon step shows the Summon_Surface, THE App SHALL draw the same Practice_Grid behind the formed character.
3. THE Practice_Grid SHALL consist of exactly five line groups: a vertical centre line, a horizontal centre line, two diagonals, and an outer border.
4. THE Practice_Grid SHALL draw its lines with an opacity of at most 0.35 so that ink strokes stay clearly visible on top.
5. THE Practice_Grid SHALL be identical for every character and SHALL contain no value derived from the Target_Character.
6. THE Practice_Grid SHALL let mouse, touch and pen events reach the surface beneath and SHALL be hidden from assistive technology.

### Requirement 2: Ink on Paper

**User Story:** As a player, I want strokes that look like ink on paper, so that writing feels like writing and the app looks distinctive in a video.

#### Acceptance Criteria

1. THE Writing_Surface and the Summon_Surface SHALL show the Paper background, built only from CSS gradients and inline SVG authored in this repository.
2. THE App SHALL contain no raster image file (PNG, JPEG, GIF or WebP) that was not made for this project.
3. WHEN the Lay-to-rest step creates its hanzi-writer instance, THE App SHALL pass `strokeColor`, `highlightColor`, `drawingColor` and `outlineColor` taken from the Ink_Palette.
4. WHEN the Summon step creates its hanzi-writer instance, THE App SHALL pass `strokeColor` taken from the Ink_Palette.
5. THE Ink_Palette SHALL give a contrast ratio of at least 4.5:1 between Paper and each of the stroke ink, the in-progress stroke colour and the hint highlight colour.
6. WHEN a Stroke hint is shown, THE App SHALL show the existing text message that announces the hint in addition to the highlight colour.

### Requirement 3: The Clue Card Reads as a Ghost

**User Story:** As a player, I want the clue card to look like a ghost, so that the game's premise is visible at a glance.

#### Acceptance Criteria

1. THE Ghost_Card SHALL contain one Ghost_Figure drawn as an inline SVG authored in this repository.
2. THE Ghost_Figure SHALL be hidden from assistive technology.
3. THE Ghost_Figure SHALL have the same shape for every character.
4. THE Ghost_Card SHALL keep the meaning text and the pinyin text at full opacity in every Ghost_State.
5. WHILE the Ghost_State is `haunting`, THE Ghost_Figure SHALL float with a slow vertical movement of at most 6 CSS pixels.
6. WHEN a new ghost begins, THE Ghost_Card SHALL be in the `haunting` state.

### Requirement 4: Ghosts Fade, Flicker and Drift Away

**User Story:** As a player, I want to see what happened to each ghost when its rite ends, so that laying a ghost to rest feels like an event.

#### Acceptance Criteria

1. WHEN the Outcome of a ghost is `clean`, THE Ghost_Figure SHALL fade to fully transparent within 1500 ms and stay transparent.
2. WHEN the Outcome of a ghost is `struggled`, THE Ghost_Figure SHALL flicker for 1200 ms and then stay at an opacity of 0.5.
3. WHEN the Outcome of a ghost is `gave-up`, THE Ghost_Figure SHALL drift upward and sideways while fading to fully transparent within 2000 ms, and stay transparent.
4. WHILE Reduced_Motion is active, THE App SHALL show the end state of criteria 1 to 3 immediately and SHALL run no animation on the Ghost_Figure, including the float of Requirement 3.5.
5. THE Ghost_Card SHALL expose the Ghost_State as the attribute `data-ghost-state` with the value `haunting`, `faded`, `flickering` or `drifted`.
6. WHEN the Outcome of a ghost is reached, THE App SHALL show the existing result text and the "Next ghost" button at that moment, without waiting for the Ghost_Figure animation to end.
7. THE Ghost_State SHALL be derived only from the Outcome, or from the absence of an Outcome, and SHALL be the same for every character.

### Requirement 5: Ghost Visuals Never Reveal the Target

**User Story:** As a developer, I want the ghost visuals to be unable to leak the answer, so that the never-reveal rule still holds after this feature.

#### Acceptance Criteria

1. WHILE the Rite of a ghost has not ended, THE Ghost_Card SHALL contain the Target_Character in no text node and in no attribute value.
2. WHILE the Rite of a ghost has not ended, THE Ghost_Figure and its animations SHALL contain no text element and no glyph.
3. THE Graveyard_Screen SHALL render the glyph of a character only for a Met_Character.
4. THE Start_Menu, the Graveyard_Screen and the Credits_Screen SHALL be reachable only outside an active séance.

### Requirement 6: Graveyard States

**User Story:** As a developer, I want a precise, pure definition of each grave state built on the existing scheduler data, so that the Graveyard always agrees with how ghosts are scheduled.

#### Acceptance Criteria

1. THE Grave_Classifier SHALL assign every character of the dataset exactly one Grave_State.
2. IF a character has no own entry in the Review_History, THEN THE Grave_Classifier SHALL assign `unmet`.
3. IF a character has an entry whose `lastOutcome` is `struggled` or `gave-up`, THEN THE Grave_Classifier SHALL assign `restless`.
4. IF a character has an entry whose `lastOutcome` is `clean` and whose next-due time is less than or equal to the current time, THEN THE Grave_Classifier SHALL assign `restless`.
5. IF a character has an entry whose `lastOutcome` is `clean` and whose next-due time is greater than the current time, THEN THE Grave_Classifier SHALL assign `at-rest`.
6. THE Grave_Classifier SHALL read the next-due time with the scheduler's `nextDue` function and SHALL treat a non-finite value as 0, as `selectSession` does.
7. THE Grave_Classifier SHALL report for an `at-rest` or `restless` character its clean streak: the number of consecutive `clean` attempts at the end of the entry's `history`, or 1 when the entry has no `history` and its `lastOutcome` is `clean`, or 0 otherwise.
8. THE Grave_Classifier SHALL list the graves in the Learning_Order and SHALL ignore Review_History entries for characters that are not in the dataset.
9. THE Grave_Classifier SHALL return counts per Grave_State whose sum equals the number of characters in the dataset.
10. THE Grave_Classifier SHALL be pure: it SHALL take the current time as an argument and SHALL read no storage and no clock.
11. THE Grave_Classifier SHALL represent an `unmet` grave without the character, so that the type system prevents the Graveyard_Screen from rendering its glyph.

### Requirement 7: Graveyard Screen

**User Story:** As a player, I want a graveyard showing every character by state, so that I can see my progress at a glance.

#### Acceptance Criteria

1. WHEN the player presses the "Graveyard" button in the Start_Menu, THE App SHALL show the Graveyard_Screen.
2. THE Graveyard_Screen SHALL show one Grave for every character of the dataset, in the Learning_Order.
3. WHEN a character is a Met_Character, THE Graveyard_Screen SHALL show its glyph in its Grave.
4. WHEN a character is not a Met_Character, THE Graveyard_Screen SHALL show its Grave with no glyph, and the character SHALL appear in no text node, attribute value or accessible name of that Grave.
5. THE Graveyard_Screen SHALL tell the three Grave_States apart by the outline shape of the Grave, by a text marker inside the Grave and by an accessible name that states the state, so that colour is never the only signal.
6. THE Graveyard_Screen SHALL show a legend that names each Grave_State in words and the number of graves in each state.
7. IF no character is a Met_Character, THEN THE Graveyard_Screen SHALL show a text line stating that no ghost has been met yet.
8. THE Graveyard_Screen SHALL read the Review_History and the current time and SHALL write nothing to storage.
9. WHILE Reduced_Motion is not active, THE Graveyard_Screen SHALL flicker the Graves in the `restless` state; WHILE Reduced_Motion is active, THE Graveyard_Screen SHALL show them without animation.
10. THE Graveyard_Screen SHALL lay out its graves in a grid that reflows between viewport widths of 375 px and 1440 px without horizontal scrolling.
11. THE Graveyard_Screen SHALL provide a "Back to menu" button with an accessible name, a minimum height of 44 px and a visible focus ring.
12. THE Graveyard_Screen SHALL give glyphs and text a contrast ratio of at least 4.5:1 against the background of their Grave.

### Requirement 8: Summon Step Layout

**User Story:** As a phone player, I want the Summon keyboard to keep its three-row shape and stay still, so that I can type the code without the layout jumping.

#### Acceptance Criteria

1. THE Summon_Keyboard SHALL show three rows with 10, 9 and 6 keys in the order `QWERTYUIOP`, `ASDFGHJKL`, `XCVBNM`.
2. THE Summon_Keyboard SHALL keep those three rows at every viewport width from 375 px to 1440 px, without wrapping a row onto a second line.
3. THE Summon_Keyboard SHALL give each key a width of at least 32 CSS pixels and a height of at least 44 CSS pixels at every viewport width from 375 px to 1440 px.
4. THE Summon step SHALL reserve the Summon_Surface space, with the same width and height, from its first render until it ends, in the typing, forming and fading phases.
5. THE Summon_Surface SHALL be a square whose side is the smaller of 60% of the viewport width and 240 CSS pixels.
6. THE Summon step SHALL show the code slots in one row without wrapping.
7. THE Summon step SHALL reserve a status area tall enough for two lines of text, so that a longer message does not move the Summon_Keyboard.
8. THE Summon_Keyboard SHALL keep its current accessible key names and its current hint behaviour.

### Requirement 9: Credits Screen

**User Story:** As a judge or a player, I want to see every source and licence in the app, so that I can trust where the data comes from.

#### Acceptance Criteria

1. WHEN the player presses the "Credits" button in the Start_Menu, THE App SHALL show the Credits_Screen.
2. THE Credits_Screen SHALL list every data source of the README "Data and licences" table, each with its name, version or commit, use, licence and URL as text.
3. THE Credits_Screen SHALL state that `characters.json` is a combined work that carries the licence terms of each source for its fields, and that the code of Ghost Script is licensed MIT.
4. THE Credits_Screen SHALL show the legend line 天雨粟，鬼夜哭 with the Huainanzi source citation worded exactly as in the "Approved legend line" section of `content-accuracy.md`, and SHALL state that the English rendering is the project's own.
5. THE Credits_Screen SHALL cite the English Wikipedia articles "Cangjie input method" and "Chu Bong-Foo", each with its title and its URL as text.
6. THE Credits_Screen SHALL list each bundled font with its name and licence, and SHALL state that Chinese text is drawn with fonts already installed on the device.
7. THE Credits_Screen SHALL make no claim about Cangjie beyond those allowed in `content-accuracy.md`.
8. THE Test_Suite SHALL fail IF the data sources, licences, versions, URLs or the font entry of the Credits_Screen differ from those of the README.
9. THE Credits_Screen SHALL provide a "Back to menu" button with an accessible name, a minimum height of 44 px and a visible focus ring.

### Requirement 10: Guide Wording

**User Story:** As a player, I want the guide to say clearly that its rules are about this game, so that it makes no claim about Cangjie in general.

#### Acceptance Criteria

1. THE Cangjie_Guide SHALL contain the sentence "In this game, a code is one to five keys".
2. THE Cangjie_Guide SHALL label its key list with the visible heading and accessible name "The 25 keys in this game".
3. THE Cangjie_Guide SHALL no longer contain the sentence "A code is one to five keys" without the words "In this game," before it, nor the label "The 25 Cangjie keys".
4. THE tests of the Cangjie_Guide SHALL assert the new wording.

### Requirement 11: Start Menu

**User Story:** As a player, I want to reach the Graveyard and the Credits from the menu, so that I can find them.

#### Acceptance Criteria

1. THE Start_Menu SHALL show five buttons in this order: "Begin a Nightly Séance", "Read the legend again", "How Cangjie works", "Graveyard", "Credits".
2. WHEN the player presses "Graveyard", THE Start_Menu SHALL call `onOpenGraveyard` once.
3. WHEN the player presses "Credits", THE Start_Menu SHALL call `onOpenCredits` once.
4. WHEN the player presses one of the three existing buttons, THE Start_Menu SHALL call the same callback as before.
5. THE Start_Menu SHALL give every button a visible text label, a minimum height of 44 px and a visible focus ring.

### Requirement 12: Fonts and Bundle Size

**User Story:** As the maintainer, I want open-licensed fonts and a small bundle, so that the site loads fast on a phone and stays free to host.

#### Acceptance Criteria

1. THE App SHALL bundle only fonts licensed under the SIL Open Font License.
2. THE App SHALL bundle at most one font family, a Latin display font, in one weight, as a self-hosted `woff2` Latin subset taken from an npm package pinned to an exact version.
3. THE App SHALL bundle no CJK font file and SHALL draw Chinese text with a font stack of fonts installed on the device.
4. THE App SHALL request no font or stylesheet from a third-party host at runtime.
5. THE README SHALL record the name, the exact version, the licence and the copyright line of each bundled font.
6. THE Bundle_Check SHALL compute the gzip size of every file in `app/dist` except `data/characters.json` and SHALL compare the sum with the Bundle_Budget.
7. IF the sum exceeds the Bundle_Budget, THEN THE Bundle_Check SHALL exit with a non-zero status and list the five largest files with their gzip sizes.
8. THE Test_Suite SHALL test the pure size-checking function of the Bundle_Check.

### Requirement 13: Motion and Accessibility

**User Story:** As a player with motion sensitivity or low vision, I want calm, readable visuals, so that I can use the game comfortably.

#### Acceptance Criteria

1. THE App SHALL declare every new CSS animation inside a `@media (prefers-reduced-motion: no-preference)` block.
2. THE App SHALL give every new button an accessible name, a minimum height of 44 px and a visible focus ring.
3. THE theme tests SHALL check a contrast ratio of at least 4.5:1 for every new text colour token against the background it is used on.
4. THE App SHALL pair every state shown by colour in this feature with a text cue or a shape cue.

### Requirement 14: No Change to Game Rules

**User Story:** As the maintainer, I want proof that this feature is only visual, so that the game still behaves as approved.

#### Acceptance Criteria

1. THE implementation of this feature SHALL leave unmodified `app/src/engine/scheduler.ts`, `config.ts`, `outcome.ts`, `learningOrder.ts` and `cangjie.ts`, `app/src/storage/storage.ts`, and `app/public/data/characters.json`.
2. THE storage schema version SHALL stay at 2.
3. THE existing tests for the files in criterion 1, for the hint rules and for the never-reveal rule of the Summon step SHALL pass without change to their assertions.

### Requirement 15: Verification

**User Story:** As the maintainer, I want the new work verified by unit and component tests and a content review, so that it ships correct.

#### Acceptance Criteria

1. THE Test_Suite SHALL cover this feature with unit tests and component tests only, and SHALL add no property-based tests and no mutation tests (decision of Nov 15 in `tech.md`).
2. WHEN all new copy exists, THE maintainer SHALL run the Accuracy_Reviewer over the Credits_Screen, the Graveyard_Screen, the Cangjie_Guide changes and the README changes, and SHALL fix every finding within the scope of this spec.
3. WHEN the final checkpoint runs, THE maintainer SHALL run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app` and `npm run check:bundle`, and all SHALL succeed.
4. THE README SHALL be updated with the font record of Requirement 12.5 and with the Huainanzi source of Requirement 9.4.
