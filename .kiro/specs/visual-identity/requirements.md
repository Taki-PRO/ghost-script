# Requirements Document

## Introduction

The visual-identity feature makes Ghost Script memorable on video without changing any game rule. It adds a practice grid (米字格) and an ink-on-paper look to the writing surface, turns the clue card into a ghost that fades, flickers or drifts away when its rite ends, adds a Graveyard screen that shows all 300 characters by state, fixes the Summon step layout on phones, adds a Credits screen with a Software section and a shipped file of third-party licence texts, rewords two lines of "How Cangjie works", and settles fonts and bundle size.

The feature changes no scheduling, no Outcome rule, no summon or write rule, no hint rule, no storage schema and no dataset. The Graveyard reads the existing saved history and classifies it with a small pure function in `app/src/engine/`.

Requirements 18 to 23 amend this feature after tester feedback (approved by the human): a Leave séance control, sticky headers on two screens, the rename of the Credits screen to "Sources & licences", a night-scene atmosphere and a menu entrance. They change no game rule. Where an earlier criterion is affected, it carries an "Amended" note that points to the new requirement.

Requirement 24 amends this feature after a browser check by the human at 375 px (approved by the human): the Sources & licences screen overflowed sideways. It fixes Requirement 9 (the Credits_Screen) at 375 px and relates to the manual task 10.1 (the human phone check). It adds stacked cards for narrow screens, a wrap rule for long values, and a dev-only Playwright width check. It changes no game rule.

Requirements 25 to 31 amend this feature after a second browser check by the human (approved by the human). They make the whole Rite fit one screen without scrolling at 1024 × 768 and 375 × 812, scroll to the top when a screen or a ghost changes, fix the Sources & licences screen at 320 px, extend the Playwright check to 320 px and to heights, and remove a personal name from repo files. They change no game rule, no timing, no storage and no dataset. Where an earlier criterion is affected, it carries an "Amended" note.

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
- **Credits_Screen**: The screen listing data sources, licences, the legend source, the Cangjie citations and the fonts. *(Amended (approved by the human), Requirement 20: this is the internal name. The user-facing name is "Sources & licences". The identifiers `credits`, `Credits.tsx` and `onOpenCredits` stay.)*
- **Cangjie_Guide**: The "How Cangjie works" screen (`CangjieGuide`).
- **Start_Menu**: The start menu component (`StartMenu`).
- **Summon_Keyboard**: The 25 on-screen keys of the Summon step, in the rows `QWERTYUIOP`, `ASDFGHJKL` and `XCVBNM`.
- **Reduced_Motion**: The user setting `prefers-reduced-motion: reduce`.
- **Bundle_Budget**: 300,000 bytes, the sum of the gzip sizes of every file in `app/dist` except `data/characters.json`.
- **Bundle_Check**: The script `scripts/check-bundle-size.ts`, run as `npm run check:bundle`.
- **Test_Suite**: The Vitest tests run by the repository's root `npm test`.
- **Accuracy_Reviewer**: The read-only custom agent in `.kiro/agents/accuracy-reviewer.json`.
- **Chinese_Font_Stack**: The CSS font list `"PingFang SC", "Hiragino Sans GB", "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Serif CJK SC", sans-serif`, used for Chinese text.
- **Runtime_Dependency**: A package in the production dependency tree of the `app` workspace: the packages in `dependencies` of `app/package.json`, and recursively their `dependencies` and `optionalDependencies`, excluding `devDependencies` and `peerDependencies`.
- **Notices_File**: The text file `app/public/THIRD_PARTY_NOTICES.txt`, served at `THIRD_PARTY_NOTICES.txt` under the site base path. It holds, for each Runtime_Dependency, a header (name, version, licence identifier) and the full text of each of its licence files copied verbatim from `node_modules`.
- **Notices_Script**: The script `scripts/build-notices.ts`, run as `npm run build:notices`, that writes the Notices_File.
- **Write_Mode**: The Lay-to-rest component `app/src/modes/WriteMode.tsx`.
- **Summon_Step**: The Summon component `app/src/modes/SummonStep.tsx`.
- **Seance_Session**: The session component `SeanceSession`, which shows the result line (`RESULT_TEXT`) for the combined Outcome.
- **Leave_Button**: The button named "Leave séance" at the top of the Seance_Session (Requirement 18).
- **Saving_Works**: The boolean returned by `isSavingWorking()` of the Storage module. It is true until any write fails during this visit (this page session), and false from the first write that threw or was attempted with no storage backend available. A later successful write does not make it true again, because the failed write's Outcome was never persisted. A new page session starts true again.
- **Leave_Prompt**: The inline confirmation, shown inside the Seance_Session, that asks "Leave now? Ghosts you've finished are saved." while Saving_Works is true, or "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost." while Saving_Works is false, and offers the buttons "Leave" and "Stay".
- **Sticky_Header**: A header row that stays at the top edge of the viewport while its screen scrolls, and holds the screen title and the "Back to menu" button (Requirement 19).
- **Sources_Caption**: The line "Where the words, strokes, codes and fonts come from." shown under the "Sources & licences" button of the Start_Menu.
- **Night_Scene**: The page background made only with CSS: the Sky_Gradient and two Mist_Layers (Requirement 21).
- **Sky_Gradient**: The deep blue-black vertical gradient of the Night_Scene, from the darkest stop (`nightTop`) through `nightMid` to the lightest stop (`nightLow`).
- **Mist_Layer**: One of two translucent, slowly drifting cloud layers of the Night_Scene.
- **Moon_Glow**: A faint radial glow behind the title of the Start_Menu.
- **Candle_Accent**: The warm amber colour `candle`, used for the main button of the Start_Menu and for focus rings.
- **GhostFigure**: The shared component `app/src/components/GhostFigure.tsx` that draws the Ghost_Figure. The Ghost_Card and the Start_Menu both use it.
- **Software_List**: The list of Runtime_Dependencies (name, version, licence identifier) shown in the Software section of the Credits_Screen, defined in `app/src/data/software.ts`.
- **Narrow_Layout**: A viewport narrower than 640 CSS pixels (below the Tailwind `sm` breakpoint).
- **Wide_Layout**: A viewport 640 CSS pixels wide or wider.
- **Source_Table**: The table of data sources in the Credits_Screen (columns Name, Version or commit, Use, Licence, URL).
- **Software_Table**: The table of the Software_List in the Credits_Screen (columns Name, Version, Licence).
- **Source_Cards**: The list in the Credits_Screen that shows each row of `DATA_SOURCES` as one stacked card.
- **Software_Cards**: The list in the Credits_Screen that shows each row of `SOFTWARE_CREDITS` as one stacked card.
- **Wrap_Class**: The Tailwind class `[overflow-wrap:anywhere]`, which lets a long unbroken value break at any character.
- **E2E_Suite**: The Playwright tests in the `e2e/` folder at the repository root, run by `npm run test:e2e` in Chromium. They are not part of the Test_Suite.
- **Width_Check**: The check of the E2E_Suite on one screen at a viewport of 375 × 812 CSS pixels (Requirement 29.1 adds the Narrow_Phone): the document `scrollWidth` and the bounding box of every displayed element (Requirements 24.7 and 24.8).

---

- **Rite_Viewports**: The two viewports 1024 × 768 CSS pixels and 375 × 812 CSS pixels.
- **Narrow_Phone**: The viewport 320 × 640 CSS pixels.
- **Compact_Card**: The Ghost_Card as the Seance_Session shows it (prop `compact`): the Ghost_Figure beside the text, tight padding, smaller text.
- **Surface_Sizes**: The pure functions `summonPaperSize` and `writeSurfaceSize` in `app/src/engine/surfaceSize.ts`. Each takes the viewport width and height in CSS pixels and returns the side of a square in whole CSS pixels.
- **Scroll_Reset**: One call of `window.scrollTo(0, 0)`.
- **Last_Keyboard_Row**: The Summon_Keyboard row whose `data-row` attribute is `2` (the keys `XCVBNM`).
- **Height_Check**: The checks of the E2E_Suite at a Rite_Viewport that named parts of a screen lie fully inside the viewport and that the page does not scroll (Requirement 29).
- **Personal_Name**: The name of a human who works on this project, in any form, as opposed to a bibliographic name in a citation or credit.

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
5. WHILE the Ghost_State is `haunting`, THE Ghost_Figure SHALL float with a slow vertical movement of at most 6 CSS pixels. *(Amended (approved by the human): see ink-and-candlelight Requirement 17.3 (Q2): the idle float is an Ambient_Motion, exempt from the Motion_Window, and keeps its 4 s and 6 px; the old text stays as written))*
6. WHEN a new ghost begins, THE Ghost_Card SHALL be in the `haunting` state.

### Requirement 4: Ghosts Fade, Flicker and Drift Away

**User Story:** As a player, I want to see what happened to each ghost when its rite ends, so that laying a ghost to rest feels like an event.

#### Acceptance Criteria

1. WHEN the Outcome of a ghost is `clean`, THE Ghost_Figure SHALL fade to fully transparent within 1500 ms and stay transparent. *(Amended (approved by the human): see ink-and-candlelight Requirement 14 (Q12a): the outcome motions now take 600 ms with new shapes (clean dissolves upward, struggled lingers at the edge, gave-up slips away); the state names are unchanged, and the old 1500 ms limit is replaced))*
2. WHEN the Outcome of a ghost is `struggled`, THE Ghost_Figure SHALL flicker for 1200 ms and then stay at an opacity of 0.5. *(Amended (approved by the human): see ink-and-candlelight Requirement 14 (Q12a): the outcome motions now take 600 ms with new shapes (clean dissolves upward, struggled lingers at the edge, gave-up slips away); the state names are unchanged, and the old 1200 ms limit is replaced))*
3. WHEN the Outcome of a ghost is `gave-up`, THE Ghost_Figure SHALL drift upward and sideways while fading to fully transparent within 2000 ms, and stay transparent. *(Amended (approved by the human): see ink-and-candlelight Requirement 14 (Q12a): the outcome motions now take 600 ms with new shapes (clean dissolves upward, struggled lingers at the edge, gave-up slips away); the state names are unchanged, and the old 2000 ms limit is replaced))*
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
4. THE Start_Menu, the Graveyard_Screen and the Credits_Screen SHALL be reachable only outside an active séance. *(Amended (approved by the human), Requirement 18: the Leave_Button is the one control shown during a séance that leads back to the Start_Menu, and only after the player confirms. The Start_Menu, the Graveyard_Screen and the Credits_Screen themselves stay unreachable during a séance.)*

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
5. THE Graveyard_Screen SHALL tell the three Grave_States apart by the outline shape of the Grave, by a text marker inside the Grave and by an accessible name that states the state, so that colour is never the only signal. *(Amended (approved by the human, screenshot review): see ink-and-candlelight Requirement 15: each Grave is drawn as an arched stone Tablet on a Hillside, tilted by `tabletTilt`; the three outlines (solid, dashed with a chipped corner, blank), the markers `·`, `!`, `✓` and the accessible names stay.)*
6. THE Graveyard_Screen SHALL show a legend that names each Grave_State in words and the number of graves in each state.
7. IF no character is a Met_Character, THEN THE Graveyard_Screen SHALL show a text line stating that no ghost has been met yet.
8. THE Graveyard_Screen SHALL read the Review_History and the current time and SHALL write nothing to storage.
9. WHILE Reduced_Motion is not active, THE Graveyard_Screen SHALL flicker the Graves in the `restless` state; WHILE Reduced_Motion is active, THE Graveyard_Screen SHALL show them without animation.
10. THE Graveyard_Screen SHALL lay out its graves in a grid that reflows between viewport widths of 375 px and 1440 px without horizontal scrolling.
11. THE Graveyard_Screen SHALL provide a "Back to menu" button with an accessible name, a minimum height of 44 px and a visible focus ring. *(Amended (approved by the human), Requirement 19: the button sits in the Sticky_Header at the top of the screen and no button appears at the bottom.)*
12. THE Graveyard_Screen SHALL give glyphs and text a contrast ratio of at least 4.5:1 against the background of their Grave.

### Requirement 8: Summon Step Layout

**User Story:** As a phone player, I want the Summon keyboard to keep its three-row shape and stay still, so that I can type the code without the layout jumping.

#### Acceptance Criteria

1. THE Summon_Keyboard SHALL show three rows with 10, 9 and 6 keys in the order `QWERTYUIOP`, `ASDFGHJKL`, `XCVBNM`.
2. THE Summon_Keyboard SHALL keep those three rows at every viewport width from 375 px to 1440 px, without wrapping a row onto a second line.
3. THE Summon_Keyboard SHALL give each key a width of at least 32 CSS pixels and a height of at least 44 CSS pixels at every viewport width from 375 px to 1440 px. *(Unchanged by Requirement 25.9, which adds a rule below 370 px.)*
4. THE Summon step SHALL reserve the Summon_Surface space, with the same width and height, from its first render until it ends, in the typing, forming and fading phases.
5. THE Summon_Surface SHALL be a square whose side is the smaller of 60% of the viewport width and 240 CSS pixels. *(Amended (approved by the human), Requirement 25: the side is the value of `summonPaperSize`, at most 160 CSS pixels.)*
6. THE Summon step SHALL show the code slots in one row without wrapping.
7. THE Summon step SHALL reserve a status area tall enough for two lines of text, so that a longer message does not move the Summon_Keyboard.
8. THE Summon_Keyboard SHALL keep its current accessible key names and its current hint behaviour.

### Requirement 9: Credits Screen

**User Story:** As a judge or a player, I want to see every source and licence in the app, so that I can trust where the data comes from.

#### Acceptance Criteria

1. WHEN the player presses the "Credits" button in the Start_Menu, THE App SHALL show the Credits_Screen. *(Amended (approved by the human), Requirement 20: the button is now labelled "Sources & licences".)*
2. THE Credits_Screen SHALL list every data source of the README "Data and licences" table, each with its name, version or commit, use, licence and URL as text. *(Amended (approved by the human), Requirement 24: in the Narrow_Layout each row is shown as a stacked card with the same five labels and values; in the Wide_Layout it stays a table row.)*
3. THE Credits_Screen SHALL state that `characters.json` is a combined work that carries the licence terms of each source for its fields, and that the code of Ghost Script is licensed MIT.
4. THE Credits_Screen SHALL show the legend line 天雨粟，鬼夜哭 with the Huainanzi source citation worded exactly as in the "Approved legend line" section of `content-accuracy.md`, and SHALL state that the English rendering is the project's own.
5. THE Credits_Screen SHALL cite the English Wikipedia articles "Cangjie input method" and "Chu Bong-Foo", each with its title and its URL as text.
6. THE Credits_Screen SHALL list each bundled font with its name and licence, and SHALL state that Chinese text is drawn with fonts already installed on the device.
7. THE Credits_Screen SHALL make no claim about Cangjie beyond those allowed in `content-accuracy.md`.
8. THE Test_Suite SHALL fail IF the data sources, licences, versions, URLs or the font entry of the Credits_Screen differ from those of the README.
9. THE Credits_Screen SHALL provide a "Back to menu" button with an accessible name, a minimum height of 44 px and a visible focus ring. *(Amended (approved by the human), Requirement 19: the button sits in the Sticky_Header at the top of the screen and no button appears at the bottom.)*
10. THE Credits_Screen SHALL show a "Software" section that lists every package of the Software_List with its name, version and licence identifier, and SHALL link to the Notices_File. *(Amended (approved by the human), Requirement 24: in the Narrow_Layout each package is shown as a stacked card with the same three labels and values.)*

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

1. THE Start_Menu SHALL show five buttons in this order: "Begin a Nightly Séance", "Read the legend again", "How Cangjie works", "Graveyard", "Credits". *(Amended (approved by the human), Requirement 20: the fifth label is "Sources & licences".)*
2. WHEN the player presses "Graveyard", THE Start_Menu SHALL call `onOpenGraveyard` once.
3. WHEN the player presses "Credits", THE Start_Menu SHALL call `onOpenCredits` once. *(Amended (approved by the human), Requirement 20: the button is labelled "Sources & licences"; the callback name stays.)*
4. WHEN the player presses one of the three existing buttons, THE Start_Menu SHALL call the same callback as before.
5. THE Start_Menu SHALL give every button a visible text label, a minimum height of 44 px and a visible focus ring.

### Requirement 12: Fonts and Bundle Size

**User Story:** As the maintainer, I want open-licensed fonts and a small bundle, so that the site loads fast on a phone and stays free to host.

#### Acceptance Criteria

1. THE App SHALL bundle only fonts licensed under the SIL Open Font License. *(Amended (approved by the human): see ink-and-candlelight Requirement 16.1 (Q1): one Chinese font, LXGW WenKai Regular, is added as a subset))*
2. THE App SHALL bundle exactly one font family, Cormorant Garamond, in weight 600, as the self-hosted `woff2` Latin subset of the `@fontsource/cormorant-garamond` npm package pinned to an exact version, loaded with `font-display: swap`. *(Amended (approved by the human): see ink-and-candlelight Requirement 16.1 (Q1): the LXGW WenKai subset is bundled in addition to Cormorant Garamond))*
3. THE App SHALL bundle no CJK font file and SHALL draw Chinese text with the Chinese_Font_Stack, in exactly that order. *(Amended (approved by the human): see ink-and-candlelight Requirements 16.1 and 16.7 (Q1): the LXGW WenKai subset is bundled and placed first in the Chinese font stack, with the old stack kept as the fallback))*
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

1. THE implementation of this feature SHALL leave unmodified `app/src/engine/scheduler.ts`, `config.ts`, `outcome.ts`, `learningOrder.ts` and `cangjie.ts`, `app/src/storage/storage.ts`, and `app/public/data/characters.json`. *(Amended (approved by the human), Requirement 18: `storage.ts` may gain the one addition `isSavingWorking()`, with no change to the storage schema, to the blob, or to the behaviour of any existing function.)*
2. THE storage schema version SHALL stay at 2.
3. THE existing tests for the files in criterion 1, for the hint rules and for the never-reveal rule of the Summon step SHALL pass without change to their assertions.

### Requirement 15: Verification

**User Story:** As the maintainer, I want the new work verified by unit and component tests and a content review, so that it ships correct.

#### Acceptance Criteria

1. THE Test_Suite SHALL cover this feature with unit tests and component tests only, and SHALL add no property-based tests and no mutation tests (decision of Nov 15 in `tech.md`).
2. WHEN all new copy exists, THE maintainer SHALL run the Accuracy_Reviewer over the Credits_Screen, the Graveyard_Screen, the Cangjie_Guide changes and the README changes, and SHALL fix every finding within the scope of this spec.
3. WHEN the final checkpoint runs, THE maintainer SHALL run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app` and `npm run check:bundle`, and all SHALL succeed.
4. THE README SHALL be updated with the font record of Requirement 12.5, with the Huainanzi source of Requirement 9.4, and with a note on the Notices_File and the `build:notices` script.

### Requirement 16: Third-Party Software Notices

**User Story:** As a judge or a maintainer, I want the full licence text of every bundled runtime library shipped with the site and listed in the app, so that the project meets the notice terms of those licences.

#### Acceptance Criteria

1. THE Notices_Script SHALL read the Runtime_Dependency tree of the `app` workspace and SHALL include no package that is only a development dependency.
2. THE Notices_Script SHALL write to the Notices_File, for each Runtime_Dependency, a header with its name, version and licence identifier, followed by the full text of each licence file found in the package directory (a file whose name starts with LICENSE, LICENCE or COPYING, in any letter case), copied verbatim from `node_modules`.
3. THE Notices_File SHALL include the SIL Open Font License text of `@fontsource/cormorant-garamond`.
4. THE Notices_Script SHALL write the Notices_File deterministically: packages in ascending order of name, licence files in ascending order of file name, LF line endings, and no timestamp, path or other value that depends on the machine or the run.
5. IF a Runtime_Dependency has no licence file or no licence identifier, THEN THE Notices_Script SHALL exit with a non-zero status and name the package, and SHALL leave the Notices_File unchanged.
6. THE repository SHALL contain the Notices_File as a committed file, so that the static site serves it without a generation step at build time.
7. THE root `package.json` SHALL provide the script `build:notices` that runs the Notices_Script.
8. THE Test_Suite SHALL fail IF regenerating the Notices_File gives output that differs from the committed file.
9. THE Test_Suite SHALL fail IF the Notices_File lacks the name, version, licence identifier or licence text of any Runtime_Dependency.
10. THE Test_Suite SHALL fail IF the set of packages in the Software_List, with their versions and licence identifiers, differs from the set of packages in the Notices_File.
11. THE Credits_Screen SHALL include a link whose target is the Notices_File, resolved against the site base path.

### Requirement 17: Post-outcome polish

**User Story:** As a player, I want to see the result of a ghost once and have no dead controls left on screen, so that the end of a rite is clear and calm.

This requirement was requested by the human. It changes no game rule.

#### Acceptance Criteria

1. WHEN the Outcome of a ghost is reached, THE Write_Mode SHALL show an empty status line, so that the result line of the Seance_Session is the only result text on screen.
2. WHEN the Outcome of a ghost is reached, THE Seance_Session SHALL keep showing its own result line for the combined Outcome, using the existing result texts.
3. WHEN the player gives up in the Lay-to-rest step, THE Write_Mode SHALL keep showing the message "The ghost reveals itself" while the character is revealed.
4. WHILE the Lay-to-rest step is loading, THE Write_Mode SHALL show the "Give up" button as disabled.
5. WHEN the Outcome of the Lay-to-rest step is reached, THE Write_Mode SHALL remove the "Give up" button from the screen.
6. WHEN the Summon step reaches the forming phase, THE Summon_Step SHALL remove the "Give up" button from the screen, and SHALL keep it absent through the fading phase.
7. THE App SHALL leave keyboard focus handling unchanged by this requirement, because the Seance_Session already moves focus to "Next ghost" after the Outcome.
8. THE App SHALL leave the never-reveal rule, the Outcome values, the hint rules and the Summon timings (`SUMMON_HOLD_MS` and `SUMMON_FADE_MS`) unchanged by this requirement.

### Requirement 18: Leave a Séance

**User Story:** As a player, I want to leave a séance part-way, so that I am not stuck in a session I cannot finish now, and I don't lose ghosts I already finished when this browser can save.

This requirement was requested after tester feedback and is approved by the human. It replaces the rule of ghost-game-core Requirement 1.5 that no menu control appears during a séance. It changes no scheduling, Outcome, hint or storage-schema rule. Amended (approved by the human): the accuracy review found that the saved-text is false when `localStorage` is unavailable or full, so the Leave_Prompt now has two texts, chosen by Saving_Works. The Storage module gains the read-only `isSavingWorking()`; the blob and the schema version stay as they are.

#### Acceptance Criteria

1. WHILE a séance is active, THE Seance_Session SHALL show the Leave_Button as the first control in its reading and tab order, at the top of the session, in every state of every ghost (summoning, writing, and after the Outcome while "Next ghost" is shown).
2. WHEN the player activates the Leave_Button, THE Seance_Session SHALL show the Leave_Prompt inline in the page, containing the buttons "Leave" and "Stay", and SHALL use no browser dialog (`window.confirm`, `window.alert` or `window.prompt`).
2a. WHEN the Leave_Prompt is shown and the `savingWorks` prop of the Seance_Session is true, THE Seance_Session SHALL show the text "Leave now? Ghosts you've finished are saved.".
2b. WHEN the Leave_Prompt is shown and the `savingWorks` prop of the Seance_Session is false, THE Seance_Session SHALL show the text "Leave now? This browser didn't save all your progress, so some finished ghosts may be lost." instead of the text in criterion 2a.
2c. THE App SHALL read the Saving_Works value when it mounts, after each write of the intro flag or the Cangjie-guide flag, when a Seance_Session starts, and after each Outcome is recorded, and SHALL pass the most recently read value to the Seance_Session as `savingWorks`, so that the Leave_Prompt text reflects whether any write has failed during this visit. *(Amended (approved by the human): see first-meeting Requirement 5: no change to this rule; the Cangjie-guide flag is still written, now only when the player continues from the guide opened on the menu, so the read after that write stays)*
2d. THE Storage module SHALL provide `isSavingWorking(): boolean` that returns true until any write fails during the page session, and returns false from the first write that threw or was attempted with no storage backend available, for the rest of the page session; a later successful write SHALL NOT make it true again, and a new store (a new page session) SHALL start true.
3. THE Leave_Prompt SHALL have the role `group` with the text shown by criterion 2a or 2b as its accessible name, and THE Leave_Button SHALL expose `aria-expanded` with the value `true` while the Leave_Prompt is open and `false` otherwise.
4. WHEN the Leave_Prompt opens, THE Seance_Session SHALL move keyboard focus to the "Stay" button.
5. WHEN the player activates "Stay", or presses the Escape key while focus is inside the Leave_Prompt, THE Seance_Session SHALL close the Leave_Prompt and SHALL return keyboard focus to the Leave_Button.
6. WHEN the Leave_Prompt closes through "Stay" or Escape, THE Seance_Session SHALL leave the current ghost, its step and its Outcome state as they were before the Leave_Prompt opened.
7. WHEN the player activates "Leave", THE Seance_Session SHALL call `onLeave` once, and THE App SHALL end the séance and show the Start_Menu.
8. WHEN the player activates "Leave", THE App SHALL record nothing for the current ghost, including when its Summon step has finished and its Lay-to-rest step has not, and SHALL keep every Outcome that was already recorded.
9. WHEN the player has activated "Leave", THE Seance_Session SHALL call neither `onOutcome` nor `onComplete` afterwards, including when a late event of the Summon step or the Write_Mode arrives.
10. WHILE the Leave_Prompt is open and the Outcome of the current ghost is reached, THE Seance_Session SHALL record that Outcome as it does at any other time and SHALL keep keyboard focus inside the Leave_Prompt.
11. THE Leave_Button, "Leave" and "Stay" SHALL each have a visible text label, a minimum height of 44 px and a visible focus ring.
12. WHILE a séance is active, THE Seance_Session SHALL show no control other than the Leave_Button that leads to the Start_Menu, the legend, the Cangjie_Guide, the Graveyard_Screen or the Credits_Screen.

### Requirement 19: Sticky Header on Graveyard and Sources & licences

**User Story:** As a player, I want the title and the way back to stay at the top while I scroll a long screen, so that I can always return to the menu without scrolling to the bottom.

#### Acceptance Criteria

1. THE Graveyard_Screen and the Credits_Screen SHALL each begin with one Sticky_Header that holds the screen's `h1` title and the "Back to menu" button.
2. WHILE the player scrolls the Graveyard_Screen or the Credits_Screen, THE Sticky_Header SHALL stay at the top edge of the viewport, above the screen content, with an opaque background. *(Amended (approved by the human, screenshot review): see ink-and-candlelight Requirement 8.11: below 992 px the Sticky_Header stays below the Moon_Room (`top: var(--moon-room)`), not at the very top edge, so that no header text or control meets the Moon.)*
3. THE Graveyard_Screen and the Credits_Screen SHALL each contain exactly one "Back to menu" button, located in the Sticky_Header, and no button at the bottom of the screen.
4. WHEN the player activates "Back to menu", THE Graveyard_Screen and the Credits_Screen SHALL call `onBack` once.
5. THE "Back to menu" button SHALL have an accessible name, a minimum height of 44 px and a visible focus ring.
6. WHEN keyboard focus moves to an element below the Sticky_Header, THE App SHALL keep that element out from under the Sticky_Header by reserving a scroll padding at the top of the page that is at least as tall as the Sticky_Header.
7. THE Sticky_Header SHALL keep its title and its button on one row, no taller than 72 CSS pixels, at every viewport width from 375 px to 1440 px.
8. THE Sticky_Header SHALL give its title and its button text a contrast ratio of at least 4.5:1 against the header background.

### Requirement 20: Sources & licences

**User Story:** As a player, I want the screen that lists where everything comes from to have a name that says so, so that I understand what the button does before I press it.

#### Acceptance Criteria

1. THE Start_Menu SHALL label its fifth button "Sources & licences".
2. THE Credits_Screen SHALL show the heading "Sources & licences" as its `h1`, and its landmark SHALL have the accessible name "Sources & licences".
3. THE Start_Menu and the Credits_Screen SHALL contain no visible text, accessible name or accessible description that contains the word "Credits".
4. WHEN the player presses "Sources & licences", THE Start_Menu SHALL call `onOpenCredits` once and call no other callback.
5. THE Start_Menu SHALL show the Sources_Caption directly under the "Sources & licences" button, and THE "Sources & licences" button SHALL reference the Sources_Caption through `aria-describedby`.
6. THE Sources_Caption SHALL read exactly "Where the words, strokes, codes and fonts come from." and SHALL be shown as muted text whose contrast meets Requirement 21.6.
7. THE tests of the Start_Menu, the Credits_Screen and the App SHALL assert the new name, and SHALL no longer look for the name "Credits".

### Requirement 21: Night Scene

**User Story:** As a player, I want a calm night atmosphere behind the game instead of a flat black page, so that the game feels haunted and memorable without hurting readability.

#### Acceptance Criteria

1. THE App SHALL paint the Night_Scene behind every screen, using only CSS gradients and inline `data:` URIs, so that no new image file, font file or network request is added.
2. THE Night_Scene SHALL contain a Sky_Gradient from a darkest stop to a lightest stop, both blue-black, defined as the tokens `nightTop`, `nightMid` and `nightLow` in `app/src/styles/theme.ts`.
3. THE Night_Scene SHALL contain two Mist_Layers that drift in opposite horizontal directions, each with a drift period of at least 90 seconds. *(Amended (approved by the human): see ink-and-candlelight Requirements 8.4 and 17.3 (Q2): the mist drift is an Ambient_Motion, exempt from the Motion_Window; the drift periods of 120 s and 180 s stay))* *(Amended again (approved by the human, screenshot review): see ink-and-candlelight Requirement 8.4: as built, the two bands differ in peak alpha and height, band A at 0.18 and 88% of the viewport height, band B at 0.10 and 72%, both in the lower third; the drift periods and the Ambient_Motion exemption stay.)*
4. THE Start_Menu SHALL show a Moon_Glow behind its title, whose peak opacity is at most 0.10. *(Amended (approved by the human): see ink-and-candlelight Requirements 8.3 and 8.4 (Q8): the halo keeps its peak of at most 0.10, and a separate moon disc is added; as built, the disc is at `82% 0%`, 3.2 rem across and half visible))* *(Amended again (approved by the human, screenshot review): see ink-and-candlelight Requirements 8.3, 8.10 and 8.11: as built, the Moon is a full disc 4 rem across with a peak alpha of 0.65 (halo peak alpha 0.10), its centre 2.5 rem from the right and top edges. Below 992 px every screen keeps a Moon_Room of 4.75 rem above its first heading. The séance screen takes no Moon_Room: its `main` carries the class `no-moon-room` and its first row has a right pad of 4.5 rem instead. The old "half visible" text stays as written.)*
5. THE main button of the Start_Menu ("Begin a Nightly Séance") SHALL use the Candle_Accent as its background, and every focus ring in the App SHALL use the Candle_Accent colour. *(Amended (approved by the human): see ink-and-candlelight Requirement 3 (Q3): the main button is a seal-red Primary_Action, with amber only in its glow, and every focus ring is aged paper with a soft candle glow))*
6. THE App SHALL give every text colour token a contrast ratio of at least 4.5:1 against the darkest stop, against the lightest stop, and against the worst-case composite of the lightest stop, both Mist_Layers at their peak opacity and the Moon_Glow at its peak opacity. *(Amended (approved by the human, screenshot review): see ink-and-candlelight Requirements 8.3 to 8.5: the 4.5:1 threshold is unchanged; the worst-case composites are band A at 0.18 and 88%, band B at 0.10 and 72%, and the Moon halo near the Moon. The Moon disc (alpha 0.65) is exempt because no text is drawn on it.)*
7. THE Candle_Accent SHALL have a contrast ratio of at least 3:1 against the darkest stop, the lightest stop and the ring-offset colour, and THE focus ring SHALL stay visible on every screen.
8. THE text on the main button SHALL have a contrast ratio of at least 4.5:1 against the Candle_Accent.
9. THE App SHALL declare every animation of the Night_Scene and of the menu figure inside a `@media (prefers-reduced-motion: no-preference)` block, and WHILE Reduced_Motion is active, THE Mist_Layers SHALL be static.
10. THE Night_Scene SHALL let mouse, touch and pen events reach the controls above it and SHALL add no element to the accessibility tree.
11. THE page wrappers of the screens SHALL have a transparent background so that the Night_Scene shows through, while cards, buttons and graves keep their opaque backgrounds.
12. THE `url()` values in `app/src/styles/index.css` SHALL all be inline `data:` URIs. *(Amended (approved by the human): see ink-and-candlelight Requirements 8.9 and 16.6 (Q1): one generated font file URL is allowed in `fonts.css`; `index.css` keeps its `data:` rule))*
13. THE Night_Scene SHALL add no runtime dependency, and the Bundle_Check SHALL still pass against the Bundle_Budget.

### Requirement 22: Menu Entrance

**User Story:** As a player, I want the menu to feel like the entrance to a haunted place, so that the first screen sets the mood.

#### Acceptance Criteria

1. THE Start_Menu SHALL show, above its buttons and in this order, the Ghost_Figure and the `h1` "Ghost Script".
2. THE `h1` of the Start_Menu SHALL use the Cormorant Garamond display font at a size of at least 3rem (48 CSS pixels).
3. THE Ghost_Card and the Start_Menu SHALL both draw their Ghost_Figure through the one component GhostFigure.
4. THE GhostFigure SHALL be hidden from assistive technology, SHALL be unfocusable, SHALL contain no text element, and SHALL have the same shape in every place it is used.
5. WHILE Reduced_Motion is not active, THE Ghost_Figure of the Start_Menu SHALL float with a slow vertical movement of at most 6 CSS pixels; WHILE Reduced_Motion is active, THE Ghost_Figure of the Start_Menu SHALL be static. *(Amended (approved by the human): see ink-and-candlelight Requirement 17.3 (Q2): the idle float is an Ambient_Motion, exempt from the Motion_Window; 4 s and 6 px are unchanged))*
6. THE Start_Menu SHALL keep its five buttons in the order of Requirement 11.1, with their callbacks of Requirement 11.2 to 11.4.

### Requirement 23: No Game-Rule Change and Verification of the Amendments

**User Story:** As the maintainer, I want proof that the tester-feedback changes are presentation and navigation only, and that the new copy is accurate, so that the game still behaves as approved and ships correct.

#### Acceptance Criteria

1. THE implementation of Requirements 18 to 22 SHALL leave unmodified every file listed in Requirement 14.1, and THE storage schema version SHALL stay at 2.
2. THE Test_Suite SHALL cover Requirements 18 to 22 with unit tests and component tests only, and SHALL add no property-based tests and no mutation tests (decision of Nov 15 in `tech.md`).
3. THE Test_Suite SHALL replace the test of the SeanceSession that asserts no legend or menu control during a séance with tests of Requirement 18.1 and 18.12.
4. THE Test_Suite SHALL fail IF a CSS animation of `app/src/styles/index.css` lies outside a `@media (prefers-reduced-motion: no-preference)` block, IF a `url()` value of that file is not a `data:` URI, IF a custom property of the Night_Scene differs from its token in `app/src/styles/theme.ts`, or IF a contrast ratio of Requirement 21.6 to 21.8 falls below its limit.
5. WHEN all new copy exists, THE maintainer SHALL run the Accuracy_Reviewer over the Start_Menu copy, the "Sources & licences" screen, the Leave_Prompt text and the README, and SHALL fix every finding within the scope of this spec.
6. WHEN the final checkpoint of the amendments runs, THE maintainer SHALL run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app` and `npm run check:bundle` (budget 300,000 bytes of gzip), and all SHALL succeed.

### Requirement 24: Sources & licences Fits a Phone

**User Story:** As a phone player, I want the Sources & licences screen to fit the width of my screen, so that I can read every source and licence without scrolling sideways.

This requirement is a bug fix approved by the human. In a browser check at 375 px the human found that the Credits_Screen overflowed sideways: its tables were about 975 px wide and the page `scrollWidth` was 588 px. It fixes Requirement 9 (Credits) at 375 px and relates to the manual task 10.1. The dev-only Playwright dependency is also approved by the human. It changes no game rule, no scheduling, no storage and no dataset. The E2E_Suite later found the same kind of overflow in the Cangjie_Guide (criterion 17), which this requirement also fixes.

#### Acceptance Criteria

1. WHILE the viewport is in the Narrow_Layout, THE Credits_Screen SHALL show every row of `DATA_SOURCES` as one card of the Source_Cards and every row of `SOFTWARE_CREDITS` as one card of the Software_Cards, and SHALL show neither the Source_Table nor the Software_Table.
2. WHILE the viewport is in the Wide_Layout, THE Credits_Screen SHALL show the Source_Table and the Software_Table, and SHALL show neither the Source_Cards nor the Software_Cards.
3. THE Credits_Screen SHALL give each of the two tables the classes `hidden` and `sm:table`, and each of the two card lists the class `sm:hidden`, so that exactly one layout has `display: none` at every width and assistive technology reads only the layout that is shown.
4. THE Credits_Screen SHALL draw each card as a description list (`<dl>`) with one "label: value" line per table column, using the column labels of the matching table: "Name", "Version or commit", "Use", "Licence" and "URL" for a Source_Card, and "Name", "Version" and "Licence" for a Software_Card.
5. THE Credits_Screen SHALL contain every row of `DATA_SOURCES` and every row of `SOFTWARE_CREDITS` in both layouts, with the same values in both.
6. THE Credits_Screen SHALL give the Wrap_Class to every element that holds a long value: each cell of the Source_Table and the Software_Table, each value line of the Source_Cards and the Software_Cards, the legend citation, and each Cangjie citation.
7. IF the `scrollWidth` of the document element is greater than 375 at a viewport of 375 × 812 CSS pixels, THEN THE Width_Check SHALL fail and report the measured value.
8. IF a displayed element has a bounding box whose right edge is greater than 375.5 or whose left edge is less than -0.5 at a viewport of 375 × 812 CSS pixels, THEN THE Width_Check SHALL fail and report a selector for that element. THE Width_Check SHALL skip every element whose computed `display` is `none`.
9. THE E2E_Suite SHALL run the Width_Check on the Sources & licences screen, the Graveyard_Screen, the Cangjie_Guide, the Summon_Step of a séance, and the Write_Mode step of a séance, each reached through the interface of the built app.
10. THE E2E_Suite SHALL run in Chromium only, against the built app served by `vite preview` under the base path `/ghost-script/`.
11. THE root `package.json` SHALL provide the scripts `test:e2e` (`playwright test -c e2e/playwright.config.ts`) and `test:e2e:install` (`playwright install chromium`), and SHALL list `@playwright/test` in `devDependencies` at an exact version.
12. THE Test_Suite SHALL run no file of the `e2e/` folder, so that `npm test` stays Vitest-only and needs no browser.
13. THE Test_Suite SHALL fail IF the Credits_Screen lacks a row of `DATA_SOURCES` or `SOFTWARE_CREDITS` in either layout, IF a table or a card list lacks the classes of criterion 3, or IF a long-value element of criterion 6 lacks the Wrap_Class.
14. THE README SHALL tell the reader to run `npm run test:e2e:install` once and then `npm run test:e2e` to run the E2E_Suite.
15. THE implementation of this requirement SHALL leave unmodified every file listed in Requirement 14.1, SHALL add no step to `.github/workflows`, and SHALL add `test-results/` and `playwright-report/` to `.gitignore` without removing the rule that keeps `.kiro/` in the repository.
16. WHEN the final checkpoint of this requirement runs, THE maintainer SHALL run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app`, `npm run check:bundle`, `npm run test:e2e:install` and `npm run test:e2e`, and all SHALL succeed.
17. THE Cangjie_Guide SHALL give the Wrap_Class to its citation line and to every other element that holds long unbreakable text, so that the Width_Check passes on the Cangjie_Guide at a viewport of 375 × 812 CSS pixels (fix found by the e2e check: the guide made the page 378 px wide).

### Requirement 25: The Summon Step Fits One Screen

**User Story:** As a phone or laptop player, I want the whole Summon step to fit on one screen, so that I never scroll to reach the keys.

This requirement is approved by the human after a browser check. It changes sizes and spacing only. The heights come from the real layout of `SeanceSession`, `GhostPrompt` and `SummonStep`: at 1024 × 768 the old layout needed about 1080 px (page padding 48, Seance_Session padding 32, header 44, Ghost_Card 208, step label 24, slots 56, Summon_Surface 240, status 48, keyboard 136, notes 40, Give up 42 and gaps 136), so about 320 px have to go.

#### Acceptance Criteria

1. WHILE the Summon_Step is shown at a Rite_Viewport, THE Seance_Session SHALL keep the Leave_Button, the step label, the Compact_Card, the code slots, the Summon_Surface, every key of the three Summon_Keyboard rows and the "Give up" button fully inside the viewport, with the page `scrollY` equal to 0 and no vertical scrolling needed. *(Amended (approved by the human): see first-meeting Requirement 10: the Faint_Code slots of a First_Meeting ghost and, for the Walkthrough_Ghost, the Walkthrough_Line also stay inside the viewport)*
2. THE Summon_Surface SHALL be a square whose side in CSS pixels is `summonPaperSize(width, height)`: the larger of 96 and the smallest of 40% of the viewport width, 160, and the viewport height minus 600, rounded to a whole number. This gives 160 at 1024 × 768, 150 at 375 × 812 and 96 at 320 × 640. *(Amended (approved by the human): see first-meeting Requirement 10.3: while a Walkthrough_Line is shown, `summonPaperSize` takes an optional reserved height of `WALKTHROUGH_LINE_PX` (24) that is subtracted from the viewport height before this formula; without a line the values above are unchanged)*
3. THE Summon_Step SHALL pass the side given by `summonPaperSize` to hanzi-writer as both `width` and `height`, and SHALL give the same side to the Summon_Surface, so that the formed character fills the paper.
4. THE Seance_Session SHALL show the Ghost_Card as the Compact_Card: the Ghost_Figure at most 40 CSS pixels tall beside the meaning and the pinyin, padding of 8 CSS pixels, meaning text of 1.25 rem and pinyin text of 1.125 rem.
5. THE Compact_Card SHALL keep the labels "Meaning" and "Pronunciation" in the accessibility tree as visually hidden text, SHALL keep the pinyin `lang` attribute, and SHALL keep the text colours and contrast ratios of the Ghost_Card.
6. THE Seance_Session SHALL use padding of 8 CSS pixels and a gap of 8 CSS pixels between its parts, and the App SHALL use a page padding of 8 CSS pixels on the séance screen.
7. THE Summon_Step SHALL use a gap of 8 CSS pixels between its parts, SHALL reserve a status area of at least 2.5 rem with text of 0.875 rem (two lines, as Requirement 8.7), and SHALL give the "Give up" button a height of at least 44 CSS pixels.
8. THE Summon_Keyboard SHALL keep keys with a height of at least 44 CSS pixels and keep its three-row layout at every viewport width from 320 px to 1440 px.
9. WHILE the viewport is 370 CSS pixels wide or wider, THE Summon_Keyboard SHALL give each key a width of at least 32 CSS pixels; WHILE the viewport is narrower than 370 CSS pixels, THE Summon_Keyboard SHALL give each key the width `(100vw - 2rem - 18px) / 10`, which is 27 CSS pixels at 320 px, because ten 32 px keys and nine 2 px gaps need 338 px, and `100vw - 2rem` is 338 px only at 370 px. *(As built in task 24.3; approved by the human (narrower keys only below the width where 32px keys fit). The first draft said 360 px, but only 328 px is available at 360 px.)*
10. THE Summon_Step SHALL keep the never-reveal rule, `SUMMON_HOLD_MS`, `SUMMON_FADE_MS`, the hint rules, the key names and the Outcome rules unchanged.

### Requirement 26: The Write Step Fits One Screen

**User Story:** As a phone or laptop player, I want the writing surface and the Give up button on one screen, so that I can write and give up without scrolling.

#### Acceptance Criteria

1. WHILE the Write_Mode is shown at a Rite_Viewport and the ghost has no result, THE Seance_Session SHALL keep the Leave_Button, the step label, the Compact_Card, the Writing_Surface and the "Give up" button fully inside the viewport, with the page `scrollY` equal to 0 and no vertical scrolling needed. *(Amended (approved by the human): see first-meeting Requirement 10: for the Walkthrough_Ghost the Walkthrough_Line also stays inside the viewport with no vertical scrolling)*
2. THE Writing_Surface SHALL be a square whose side in CSS pixels is `writeSurfaceSize(width, height)`: the larger of 200 and the smallest of 80% of the viewport width, 420, and the viewport height minus 400, rounded to a whole number. This gives 368 at 1024 × 768, 300 at 375 × 812, 240 at 320 × 640 and 420 at 1440 × 900. *(Amended (approved by the human): see first-meeting Requirement 10.3: while a Walkthrough_Line is shown, `writeSurfaceSize` takes an optional reserved height of `WALKTHROUGH_LINE_PX` (24) that is subtracted from the viewport height before this formula; without a line the values above are unchanged)*
3. THE Write_Mode SHALL pass the side given by `writeSurfaceSize` to hanzi-writer as both `width` and `height`, and SHALL give the same side to the Writing_Surface.
4. WHILE the ghost has a result at a Rite_Viewport, THE Seance_Session SHALL keep the result line and the "Next ghost" button (or "Finish the séance" for the last ghost) fully inside the viewport.
5. THE Write_Mode SHALL use a gap of 8 CSS pixels between its parts and SHALL give the "Give up" button a height of at least 44 CSS pixels.
6. THE Write_Mode SHALL keep the quiz options, the hint rule, the Outcome rules and the never-reveal rule unchanged.

### Requirement 27: Scroll Reset

**User Story:** As a player, I want each new screen and each new ghost to start at the top, so that I never land in the middle of a page.

#### Acceptance Criteria

1. WHEN the App changes screen, THE App SHALL perform one Scroll_Reset before the new screen's own focus move runs.
2. WHEN the player presses the "Next ghost" button, THE Seance_Session SHALL perform one Scroll_Reset before it shows the next ghost.
3. THE App SHALL scroll instantly in every motion setting: it SHALL use `window.scrollTo(0, 0)` with no `behavior` option, and `app/src/styles/index.css` SHALL contain no `scroll-behavior` declaration.
4. IF `window.scrollTo` is not a function, THEN THE App SHALL skip the Scroll_Reset and raise no error.
5. THE App SHALL keep every existing focus move of the screens and of the Seance_Session.

### Requirement 28: Sources & licences Fits 320 px

**User Story:** As a player on a very narrow phone, I want the Sources & licences screen to fit my screen, so that I never scroll sideways.

This requirement is a bug fix approved by the human. At 320 × 640 the Credits_Screen has a document `scrollWidth` of 341 px. The cause is not yet known; the task diagnoses it first, as task 22.7 did for the Cangjie_Guide.

#### Acceptance Criteria

1. WHEN the cause is not known, THE maintainer SHALL find, with a browser at the Narrow_Phone viewport, the element whose minimum content width makes the page 341 px wide, and SHALL record that element in the task notes before changing any code.
2. THE Credits_Screen SHALL give the Wrap_Class to the element named by the diagnosis and to every other element of the same kind that holds long unbreakable text.
3. THE Credits_Screen SHALL have a document `scrollWidth` of at most 320 at the Narrow_Phone viewport, and at most 375 at 375 × 812 as before.
4. THE Test_Suite SHALL fail IF an element named by the diagnosis lacks the Wrap_Class.

### Requirement 29: The E2E Suite Checks 320 px and Heights

**User Story:** As the maintainer, I want the browser check to cover 320 px and the one-screen fit, so that the next layout regression is caught before a human sees it.

#### Acceptance Criteria

1. THE E2E_Suite SHALL run the Width_Check at the Narrow_Phone viewport on the same five screens as at 375 × 812, with the limit 320 in place of 375 (the document `scrollWidth` must not exceed 320, and no displayed element may have a right edge above 320.5 or a left edge below -0.5).
2. THE E2E_Suite SHALL keep every existing check at 375 × 812 at its present threshold, SHALL keep the guard test, and SHALL loosen no check.
3. WHEN the Summon_Step is shown at each Rite_Viewport, THE E2E_Suite SHALL check without scrolling that the Leave_Button, the step label, the Ghost_Card, the code slots, the Summon_Surface, the Last_Keyboard_Row and the "Give up" button each have a top edge of at least 0 and a bottom edge of at most `innerHeight`, and that the Last_Keyboard_Row has no key whose left edge is below 0 or whose right edge is above `innerWidth`. *(Amended (approved by the human): see first-meeting Requirement 12: the Summon_Step of a First_Meeting ghost also shows the Faint_Code, and the new spec `e2e/first-meeting.spec.ts` checks the Walkthrough_Line inside the viewport)*
4. WHEN the Write_Mode is shown at each Rite_Viewport, THE E2E_Suite SHALL check without scrolling that the Leave_Button, the Writing_Surface and the "Give up" button each lie fully inside the viewport. *(Amended (approved by the human): see first-meeting Requirement 12: the new spec `e2e/first-meeting.spec.ts` also checks the Walkthrough_Line of the Walkthrough_Ghost's Write_Mode inside the viewport)*
5. WHEN the Summon_Step or the Write_Mode is shown at each Rite_Viewport, THE E2E_Suite SHALL check that the document `scrollHeight` is at most `innerHeight`.
6. WHEN the player has pressed "Give up" in both steps of ghost 1 at each Rite_Viewport, THE E2E_Suite SHALL check that the "Next ghost" button lies fully inside the viewport.
7. WHEN the page has been scrolled down during ghost 1 (the test adds a tall spacer element to the document body so that scrolling is possible, and first checks that `scrollY` is above 0), the ghost is finished with "Give up" in both steps and "Next ghost" is pressed, THE E2E_Suite SHALL check that `window.scrollY` equals 0.
8. THE E2E_Suite SHALL run in Chromium only and SHALL stay outside the Test_Suite, as Requirements 24.10 and 24.12 say.
9. THE README SHALL say that the E2E_Suite checks five screens at 375 and 320 px and the one-screen fit at 1024 × 768 and 375 × 812.

### Requirement 30: No Personal Names in Repo Files

**User Story:** As the maintainer, I want no personal name in the repository files, so that the repo follows the names rule of `structure.md`.

The rule has no exception for approvals. The README and the log are first person ("I approved"). Specs, data files and tests say "approved by the human" or "human-approved". Bibliographic names in citations and credits (for example Chu Bong-Foo, D. C. Lau, Michael Puett, Cangjie) are allowed. The human edits `kiro-log.md` and the steering files; this requirement does not.

#### Acceptance Criteria

1. THE files under `.kiro/specs/` SHALL contain the text "approved by the human" in place of every earlier approval note that named a person, including the titles of tasks in every `tasks.md`.
2. THE `reviewedBy` column of `data/prompt-overrides.csv` SHALL read "human-approved" on every row, and the tests under `tests/` that build override rows SHALL use "human-approved".
3. WHEN `npm run build:data` runs after criterion 2 is done, THE data pipeline SHALL write an `app/public/data/characters.json` that is byte-identical to the file before the change, and SHALL write a `data/prompt-review.csv` that differs from the earlier file only in the `reviewedBy` column.
4. THE test `tests/unit/oracle-power.test.ts` SHALL keep a test that none of the three Power files contains a Personal_Name, built from a name token that the test file assembles from parts so that the file itself contains no Personal_Name.
5. THE Test_Suite SHALL fail IF a tracked text file contains the name token of criterion 4, case-insensitive, except `kiro-log.md`, the files under `.kiro/steering/` (both maintained by the human) and the tool-generated `tasks.meta.json` files, which the maintainer never edits by hand.
6. THE maintainer SHALL NOT edit any `tasks.meta.json` by hand and SHALL report which task titles changed, because Kiro derives task IDs from titles.

### Requirement 31: No Game-Rule Change and Verification of the Fit Amendments

**User Story:** As the maintainer, I want proof that Requirements 25 to 30 change only layout, scrolling, tests and names, so that the game still behaves as approved.

#### Acceptance Criteria

1. THE implementation of Requirements 25 to 29 SHALL leave unmodified every file listed in Requirement 14.1, and THE storage schema version SHALL stay at 2.
2. THE Test_Suite SHALL cover Requirements 25 to 28 and 30 with unit tests and component tests only, and SHALL add no property-based tests and no mutation tests (decision of Nov 15 in `tech.md`).
3. THE existing assertions of the Summon step about the hold time, the fade time, the hint rules and the never-reveal rule SHALL pass without change; only the assertions about the paper size, the Writing_Surface size and the status area height SHALL change.
4. WHEN the final checkpoint of these amendments runs, THE maintainer SHALL run `npm test`, `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json`, `npx tsc -p oracle/tsconfig.json`, `npm run build -w app`, `npm run check:bundle`, `npm run test:e2e` and the dataset byte-identical check, and all SHALL succeed.
5. THE manual tasks 10.1 and 19.2 SHALL stay open for the human, who re-checks 375, 768 and 1440 px and the new one-screen fit by eye.
