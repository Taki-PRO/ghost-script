# Requirements Document

## Introduction

The first-meeting feature changes how a ghost is taught and how a Séance ends. Today a new player must read the "How Cangjie works" guide before the first Séance, then type a Cangjie code from memory for every ghost, with nothing shown until three wrong keys in a row bring a Key hint. This feature teaches on the first meeting and tests on the return:

1. **Teach on first meeting, test on return.** The first time a ghost is ever met (no saved history for its character), the Summon step shows the code as faint letters in the slots, and gently highlights the next slot and the matching on-screen key. When the ghost returns (it has saved history), the code is hidden as today.
2. **A guided first ghost.** A brand-new player's first ghost is chosen by a fixed rule (the first character in the Learning order that is transparent, has a two-key code of two different keys, and is a side-by-side ⿰ character). It runs as a short walkthrough on the normal Summon and Write screens with one instruction line per step.
3. **The guide no longer blocks the first Séance.** The forced "How Cangjie works" screen before the first Séance is removed. It stays on the start menu.
4. **The session summary shows the haunting.** After the last ghost, the summary lists each ghost with when it returns ("returns in 10 minutes", "returns tomorrow", "returns in 3 days").

The feature builds on ghost-game-core, cangjie-seance, visual-identity and summon-ink and amends parts of the first three (see "Amendments to other specs"). It changes no Outcome rule, threshold, scheduler function, saved-data schema or dataset record.

### Facts this spec relies on

These were verified against `app/public/data/characters.json` and the code on the day this spec was written. The orchestrator verified the first two; the others were recomputed while writing this spec.

- 从 (code OO, decomposition ⿰人人) is a `transparent` two-key side-by-side character at position 7 of the Learning order, before 明 at position 13. Its two keys are the same, so the rule below skips it.
- 明 (code AB, decomposition ⿰日月) is `transparent` with `keyStrokes` `[[0,1,2,3],[4,5,6,7]]`. It is the first character in the Learning order that meets the Walkthrough_Rule. 朋 (BB) at position 14 has two equal keys.
- For a player with an empty Review history, the scheduler's session is the first ten characters of the Learning order: 一 二 人 下 女 干 从 天 手 本. 明 is not among them, so the Walkthrough_Ghost is added in front and the last of these ten (本) moves to a later Séance.
- The base shapes of keys A and B are 日 and 月. In the dataset, `prompt.meaning` of 日 is "sun" and of 月 is "moon". Some meanings are longer (人 "person; people", 山 "mountain; hill (CL:座[zuo4])").
- The existing e2e helpers never click "Continue" on the guide: `seedState()` sets `cangjieIntroSeen: true`, and the one e2e test that shows the guide reaches it through the menu. The unit tests in `app/src/App.test.tsx` do click through the guide (they must be updated).
- The current intro text has no stand-alone one-line description of the rite. Its second paragraph is "In this game, characters you have forgotten how to write are ghosts. You lay each one to rest by writing it." The sentence "You lay each one to rest by writing it." is the line this feature replaces.

Out of scope: any change to the scheduler, `selectSession`, `buildSession`, outcomes, thresholds, the dataset or the saved-data schema; a different first ghost for returning players; walkthroughs for any ghost but the first; the Graveyard; traditional characters; property-based tests.

## Glossary

- **App**: The React + Vite single-page web application in `app/`.
- **Seance_Session**: The component `SeanceSession` that walks the player through the ghosts of one Séance.
- **Summon_Step**: The component `SummonStep`, the first step of a ghost's Rite (cangjie-seance).
- **Write_Mode**: The component `WriteMode`, the Lay-to-rest step of a ghost's Rite.
- **Session_Summary**: The component `SessionSummary` shown after the last ghost.
- **Cangjie_Guide**: The "How Cangjie works" screen (`CangjieGuide`).
- **Intro_Screen**: The legend intro (`IntroScreen`).
- **Review_History**: The saved map from character to Review entry (ghost-game-core), read through the Storage module's `loadState()`.
- **Code_Slot**: One placeholder per key of a ghost's Cangjie code in the Summon_Step (cangjie-seance).
- **First_Meeting**: The state of a ghost whose character has no own-property entry in the Review_History read when the Séance starts.
- **Returning_Ghost**: A ghost whose character has an entry in the Review_History read when the Séance starts.
- **First_Meeting_Set**: The set of characters of a Séance's ghosts that are in the First_Meeting state. The App computes it once when the Séance starts and does not change it during the Séance.
- **Faint_Code**: The letters of a First_Meeting ghost's code, one per Code_Slot, shown in the empty slots in a faint style (dashed border, no shape glyph) at the contrast of the `muted` text token.
- **Next_Key_Highlight**: The cue on the first unfilled Code_Slot and on the matching on-screen key of a First_Meeting ghost: a ring plus a non-colour cue (the key's letter is bold and underlined, the slot carries `aria-current="true"`, and the key's accessible name ends with ", next").
- **Key_Hint**: The reveal of the next expected key after three consecutive wrong keys for the same slot (cangjie-seance AC 3.7). The Faint_Code is not a Key_Hint.
- **Brand_New_Player**: A player whose Review_History, read when the Séance starts, has no entry at all. The `introSeen` and `cangjieIntroSeen` flags are not considered.
- **Walkthrough_Rule**: The rule that picks the Walkthrough_Ghost (Requirement 3.2).
- **Walkthrough_Ghost**: The ghost the Walkthrough_Rule picks; 明 in the current data.
- **Walkthrough_Line**: The one instruction line shown with a step of the Walkthrough_Ghost (Requirement 4).
- **Meaning_Word**: A shape character's `prompt.meaning`, after `cleanupMeaning`, that consists only of the letters A–Z and a–z (one word, no ";", no brackets, no digits, no spaces).
- **Key_Shape**: The base shape of a key as listed in `CANGJIE_KEYS` (日 for A, 月 for B).
- **Return_Text**: The text `formatReturn(nextDue, now)` returns, such as "returns in 10 minutes".
- **Return_Row**: One line of the Session_Summary list: a ghost's glyph, pinyin, meaning and Return_Text.
- **Never_Reveal**: The rule that the target character is not rendered as text, in an attribute, in an accessible name or in the document title before the ghost's rite has run its course (cangjie-seance Requirement 5, summon-ink Requirement 6).
- **Rite_Viewport**: A viewport of 1024 × 768 or of 375 × 812 CSS pixels (visual-identity Requirement 25).
- **Test_Suite**: The Vitest tests run by the repository's root `npm test`.
- **E2E_Suite**: The Playwright tests under `e2e/`, run by `npm run test:e2e`, outside the Test_Suite.
- **Accuracy_Reviewer**: The `accuracy-reviewer` custom agent in `.kiro/agents/`.
- Terms not defined here (Ghost, Outcome, Séance, Rite, Learning order, Review entry, `nextDue`, Display cleanup, Summon step, Lay-to-rest step, Key hint) have the meanings given in ghost-game-core and cangjie-seance.

---

## Requirements

### Requirement 1: Teach the Code on First Meeting

**User Story:** As a player meeting a ghost for the first time, I want the Summon step to show me the code to copy, so that I learn the shapes instead of guessing keys.

#### Acceptance Criteria

1. WHEN a Séance starts, THE App SHALL compute the First_Meeting_Set from the Review_History read at that moment and SHALL pass the same set to the Seance_Session for the whole Séance.
2. WHILE the Summon_Step of a First_Meeting ghost is accepting keys, THE Summon_Step SHALL show the Faint_Code: in each empty Code_Slot, the letter of the code at that slot's position.
3. WHILE the Summon_Step of a First_Meeting ghost is accepting keys, THE Summon_Step SHALL give each empty Code_Slot the accessible name "Slot {n}, type {LETTER}" (for example "Slot 1, type A"), where n counts from 1.
4. WHILE the Summon_Step of a First_Meeting ghost is accepting keys, THE Summon_Step SHALL show the Next_Key_Highlight on the first unfilled Code_Slot and on the matching on-screen key.
5. WHEN the player enters a correct key in a First_Meeting ghost's Summon_Step, THE Summon_Step SHALL replace that slot's Faint_Code by the key's letter and base shape as today, and SHALL move the Next_Key_Highlight to the next unfilled slot and its key.
6. WHEN the code of a First_Meeting ghost is complete, or the player gives up, THE Summon_Step SHALL remove the Faint_Code and the Next_Key_Highlight.
7. THE Faint_Code letters SHALL have a contrast ratio of at least 4.5:1 against the slot background; THE faint style SHALL come from the dashed border, the absence of the shape glyph and the smaller size, and SHALL NOT come from a lower text contrast.
8. THE Next_Key_Highlight SHALL NOT rely on colour alone: THE highlighted key SHALL show its letter in bold with an underline, THE highlighted slot SHALL carry `aria-current="true"`, and THE highlighted key's accessible name SHALL end with ", next".
9. WHEN a Summon_Step for a First_Meeting ghost starts, THE Summon_Step SHALL show the status text "Copy the faint letters, one key at a time".
10. THE Faint_Code and the Next_Key_Highlight SHALL NOT set `hintShown`, change the mistake count, change the count of misses on the slot or change the Step result; THE Summon reducer in `app/src/engine/cangjie.ts` SHALL stay unchanged.
11. WHEN the player completes the code of a First_Meeting ghost with no wrong key and no Key_Hint, THE Summon_Step SHALL fix the Step result `clean`.
12. WHEN the player enters a wrong key in a First_Meeting ghost's Summon_Step, THE Summon_Step SHALL count one mistake, SHALL show the Key_Hint after three consecutive wrong keys for the same slot, and SHALL classify the Step result with the same thresholds as for a Returning_Ghost.

---

### Requirement 2: Test the Code on Return

**User Story:** As a player whose ghost returns, I want the code hidden again, so that the Séance tests what I learned.

#### Acceptance Criteria

1. WHILE the Summon_Step of a Returning_Ghost is accepting keys, THE Summon_Step SHALL show no letter in an empty Code_Slot, SHALL give each empty Code_Slot the accessible name "Slot {n}, empty", and SHALL show no Next_Key_Highlight.
2. THE Summon_Step SHALL apply the existing Key_Hint rule to a Returning_Ghost unchanged (cangjie-seance AC 3.7).
3. THE App SHALL decide whether a ghost is a First_Meeting from the Review_History alone, using an own-property check, and SHALL add no field to the saved data; THE saved-data schema version SHALL stay 2.
4. THE First_Meeting_Set SHALL stay fixed while a Séance runs, so that recording an Outcome during the Séance does not change the display of any ghost; because a Séance never presents the same character twice (ghost-game-core AC 3.5), no ghost is met twice in one Séance.
5. IF the Review_History was reset (schema reset, corrupt data or unavailable storage), THEN THE App SHALL treat every ghost as a First_Meeting.
6. IF the Seance_Session receives no First_Meeting_Set, THEN THE Seance_Session SHALL treat every ghost as a Returning_Ghost.

---

### Requirement 3: The Guided First Ghost

**User Story:** As a brand-new player, I want my first ghost to be a gentle walkthrough on the normal screens, so that I understand summoning before I am tested.

#### Acceptance Criteria

1. WHEN a Séance starts, THE App SHALL treat the player as a Brand_New_Player exactly when the Review_History read at that moment has no entry.
2. THE Walkthrough_Rule (approved by the human) SHALL pick the first character in `learningOrder(dataset)` that satisfies all of these: its `summonInk.class` is `transparent`; its Cangjie code has exactly two keys; the two keys are different letters; its code is Playable in Cangjie mode (`isPlayableInCangjie`); and its decomposition (IDS) string parses to a tree whose top operator is ⿰.
3. THE function `pickWalkthroughGhost(order, dataset)` in `app/src/engine/walkthrough.ts` SHALL implement the Walkthrough_Rule as a pure function and SHALL return the character, or `null` when no character satisfies the rule.
4. THE Test_Suite SHALL assert, in one test only, that `pickWalkthroughGhost` on the real dataset returns the literal 明, reading the expected character from the rule's own output and comparing it with that literal; no other test, helper or source file SHALL name 明 as the Walkthrough_Ghost.
5. WHEN the player is a Brand_New_Player and `pickWalkthroughGhost` returns a character, THE App SHALL build the Séance's ghosts as the Walkthrough_Ghost first, followed by the ghosts `buildSession` returns without the Walkthrough_Ghost, cut to `DEFAULT_CONFIG.sessionSize` ghosts in total.
6. WHEN the player is not a Brand_New_Player, or `pickWalkthroughGhost` returns `null`, THE App SHALL use the ghosts `buildSession` returns unchanged.
7. THE composition of AC 3.5 SHALL be a pure function `composeFirstSession(ghosts, walkthrough, size)` in `app/src/engine/walkthrough.ts`; `buildSession`, `selectSession` and `learningOrder` SHALL stay unchanged.
8. THE Walkthrough_Ghost SHALL be in the First_Meeting_Set, so that the Faint_Code and the Next_Key_Highlight show for it.
9. THE Walkthrough_Ghost SHALL run on the normal Summon_Step and Write_Mode screens, with no extra screen, no extra control and no change to the step label, the Leave button or the "Next ghost" control.
10. WHEN the Walkthrough_Ghost reaches its Combined outcome, THE App SHALL record it with `applyReview` and `recordOutcome` as for any ghost, and THE Séance SHALL continue with the remaining ghosts in the order of AC 3.5.
11. WHEN a Brand_New_Player leaves the Séance before the Walkthrough_Ghost has an Outcome, THE App SHALL record nothing, so that the next Séance again starts with the Walkthrough_Ghost.
12. WHEN the Walkthrough_Ghost has an Outcome, THE Review_History SHALL contain an entry, so that every later Séance of that player starts as for any other player.

---

### Requirement 4: Walkthrough Lines Come From the Data

**User Story:** As a brand-new player, I want one short instruction per step that names each shape, so that I know why each key matters.

#### Acceptance Criteria

1. THE function `walkthroughSummonLines(record, dataset)` in `app/src/engine/walkthrough.ts` SHALL return one line per key of the record's code, built as follows for the key K with Key_Shape S: IF S is a character of the dataset whose cleaned meaning is a Meaning_Word M, THEN the line is "Press K: the M S"; IF S is a character of the dataset whose cleaned meaning is not a Meaning_Word, THEN the line is "Press K: S (M)", where M is the cleaned meaning; IF S is not a character of the dataset, THEN the line is "Press K: S".
2. THE lines SHALL contain no meaning, shape or letter typed by hand: THE meaning SHALL be `cleanupMeaning` applied to the shape character's `prompt.meaning`, and THE shape SHALL be the Key_Shape from `CANGJIE_KEYS`.
3. THE function `walkthroughSummonLines` SHALL apply `maskTarget` with the record's character to every line.
4. THE constant `WALKTHROUGH_WRITE_LINE` in `app/src/engine/walkthrough.ts` SHALL be "Now write it from memory".
5. WHILE the Summon_Step of the Walkthrough_Ghost is accepting keys, THE Summon_Step SHALL show the line for the first unfilled key, and SHALL show the next key's line after each correct key.
6. WHEN the code of the Walkthrough_Ghost is complete, or the player gives up, THE Summon_Step SHALL remove the Summon line.
7. WHILE the Write_Mode of the Walkthrough_Ghost is shown and the ghost has no result, THE Seance_Session SHALL show `WALKTHROUGH_WRITE_LINE`.
8. WHEN the Walkthrough_Ghost has a result, THE Seance_Session SHALL remove the Write line.
9. WHILE the Walkthrough_Ghost is the current ghost, THE App SHALL show no other walkthrough text, so that each step carries exactly one instruction line.
10. THE dataset in the current data SHALL give the lines "Press A: the sun 日" and "Press B: the moon 月" for the Walkthrough_Ghost (日 has the meaning "sun" and 月 has the meaning "moon").

---

### Requirement 5: The Guide No Longer Blocks the First Séance

**User Story:** As a new player, I want to start playing at once, so that I meet the first ghost without reading a screen first.

#### Acceptance Criteria

1. WHEN the player activates "Begin the Séance" on the Intro_Screen, THE App SHALL start the Séance directly, with no Cangjie_Guide screen in between.
2. WHEN the player activates "Begin a Nightly Séance" on the Start_Menu or "Begin another Séance" on the Session_Summary, THE App SHALL start the Séance directly, whatever the stored value of `cangjieIntroSeen`.
3. WHEN the player activates "How Cangjie works" on the Start_Menu, THE App SHALL show the Cangjie_Guide, and WHEN the player continues from it, THE App SHALL return to the Start_Menu.
4. THE saved-data schema SHALL keep the field `cangjieIntroSeen` and the Storage functions `getCangjieIntroSeen` and `setCangjieIntroSeen`, with no migration and no change to `app/src/storage/`.
5. WHEN the player continues from the Cangjie_Guide, THE App SHALL still call `setCangjieIntroSeen(true)`; THE App SHALL read `cangjieIntroSeen` for no navigation decision.
6. THE App's `cangjie-guide` view SHALL have no `origin` field and no path that leads from the guide to a Séance.

---

### Requirement 6: Intro Copy

**User Story:** As a first-time player, I want the intro to say in one line what I will do, so that the first ghost makes sense.

#### Acceptance Criteria

1. THE Intro_Screen SHALL replace the sentence "You lay each one to rest by writing it." with the sentence "Type its shapes to summon it, then write it from memory." in the same paragraph, and SHALL keep every other sentence, heading, quotation, citation and the button label of the Intro_Screen unchanged.
2. THE Intro_Screen SHALL make no claim beyond the existing premise, the Huainanzi attribution and the new sentence, which describes how this game works.

---

### Requirement 7: Never Reveal, Also on First Meeting

**User Story:** As a player, I want the target character to stay hidden even while I am being taught its code, so that the challenge to write it stays real.

#### Acceptance Criteria

1. THE Faint_Code SHALL consist of key letters only, and THE Summon_Step SHALL NOT render the target character in any text, attribute, accessible name or the document title while the code is neither complete nor given up, for a First_Meeting ghost as for a Returning_Ghost.
2. WHEN a Key_Shape equals the target character, THE Summon_Step SHALL apply `maskTarget` to it as today (cangjie-seance AC 5.2), whether the ghost is a First_Meeting or a Returning_Ghost.
3. WHILE the target character is the base shape of a key, THE Summon_Step SHALL keep the on-screen keyboard in letters-only form (cangjie-seance AC 5.3), including for a First_Meeting ghost.
4. THE Walkthrough_Lines SHALL never contain the target character (Requirement 4.3).
5. THE Test_Suite SHALL include a never-reveal component test that renders every Playable ghost's Summon_Step as a First_Meeting and as a Returning_Ghost, unresolved and after a Key_Hint, and asserts that the target character appears nowhere in the DOM text, the attributes or the document title; the existing never-reveal test SHALL be updated for this.
6. THE Session_Summary MAY show each ghost's glyph, because the summary appears only after every ghost of the Séance has run its Rite and the Write_Mode has revealed its character (cangjie-seance AC 5.7).
7. THE file `.kiro/steering/content-accuracy.md` SHALL list under "What is not an answer leak" the first-meeting display (the faint code, the highlight and the walkthrough lines), approved by the human, and SHALL state that the never-reveal rule still holds for Returning_Ghosts and for the character itself as text.

---

### Requirement 8: Formatting When a Ghost Returns

**User Story:** As a player, I want to read when each ghost will come back in plain words, so that the haunting feels real.

#### Acceptance Criteria

1. THE function `formatReturn(nextDue, now)` in `app/src/engine/formatReturn.ts` SHALL be pure, SHALL read no clock and no time zone setting other than the local calendar fields of the two timestamps, and SHALL return a Return_Text.
2. IF `nextDue` or `now` is not a finite number, THEN `formatReturn` SHALL return "returns soon".
3. WHEN `nextDue - now` is zero or negative, THE `formatReturn` function SHALL return "returns now".
4. WHEN `nextDue - now` is positive and `ceil((nextDue - now) / 60000)` is less than 60, THE `formatReturn` function SHALL return "returns in {m} minutes", or "returns in 1 minute" when m is 1, where m is that ceiling.
5. WHEN AC 8.4 does not apply and `ceil((nextDue - now) / 3600000)` is less than 24, THE `formatReturn` function SHALL return "returns in {h} hours", or "returns in 1 hour" when h is 1, where h is that ceiling.
6. WHEN neither AC 8.4 nor AC 8.5 applies, THE `formatReturn` function SHALL compute the difference d in local calendar days between the day of `nextDue` and the day of `now` (each day taken as the local year, month and day of the timestamp, converted with `Date.UTC` so that a daylight-saving change cannot shift the count), and SHALL return "returns tomorrow" when d is 1 or less, and "returns in {d} days" otherwise.
7. THE rule of AC 8.6 SHALL be the only rule for "tomorrow": a ghost due at 06:00 the next calendar day is "returns tomorrow" when `now` is more than 23 hours earlier, and a ghost due 24 hours after a review is "returns tomorrow".
8. THE `formatReturn` function SHALL be testable with injected `now` and with timestamps built from local calendar fields, so that the tests pass in every time zone.

---

### Requirement 9: The Session Summary Shows the Haunting

**User Story:** As a player finishing a Séance, I want to see which ghosts will return and when, so that I know what the game will ask of me next.

#### Acceptance Criteria

1. WHEN the last ghost of a Séance has an Outcome, THE App SHALL build one Return_Row for each ghost of the Séance that has a recorded entry, in the order the ghosts were presented, and SHALL pass the rows and the time `now` of the summary to the Session_Summary.
2. THE App SHALL take each row's `nextDue` from the entry returned by `applyReview` when the Outcome was recorded, held in memory for the Séance, so that the list is correct when the browser cannot save.
3. THE Return_Row of every ghost SHALL be shown, including gave-up and struggled ghosts.
4. THE Session_Summary SHALL show, for each Return_Row, the glyph (with a Chinese `lang` attribute), the pinyin exactly as stored, the cleaned meaning and the Return_Text of `formatReturn(nextDue, now)`, in an accessibly labelled list.
5. WHEN the Séance has no Return_Row, THE Session_Summary SHALL show no list and no list heading.
6. THE Session_Summary SHALL keep its heading, its count line "{n} of {m} ghosts laid to rest" and its "Begin another Séance" button unchanged.
7. THE Session_Summary SHALL fit the page width at 375 × 812 and at 320 × 640 with no horizontal overflow, and SHALL scroll vertically when the list is longer than the screen.
8. THE App SHALL leave `app/src/engine/scheduler.ts` unchanged and SHALL compute no new due time: the Return_Text comes from the entry's `nextDue` only.
9. WHEN the player activates "Leave séance" and confirms, THE App SHALL show no summary and SHALL discard the in-memory entries of that Séance.

---

### Requirement 10: One Screen Fit, Walkthrough Included

**User Story:** As a phone or laptop player, I want the first ghost to fit on one screen like every other ghost, so that I never scroll to reach a key.

#### Acceptance Criteria

1. WHILE the Summon_Step of a First_Meeting ghost is shown at a Rite_Viewport, THE Seance_Session SHALL keep every control that visual-identity Requirement 25.1 lists, and the Faint_Code slots, fully inside the viewport with no vertical scrolling.
2. WHILE the Summon_Step or the Write_Mode of the Walkthrough_Ghost is shown at a Rite_Viewport, THE Seance_Session SHALL keep the Walkthrough_Line fully inside the viewport, on one line of text, and the same controls inside the viewport with no vertical scrolling.
3. WHEN a Walkthrough_Line is shown, THE `summonPaperSize` and `writeSurfaceSize` functions SHALL subtract a reserved height of `WALKTHROUGH_LINE_PX` (24) CSS pixels from the viewport height before they apply their existing formulas, so that the line takes room from the drawing surface and not from the controls; WHEN no Walkthrough_Line is shown, both functions SHALL return the values they return today.
4. THE Faint_Code SHALL NOT change the height of a Code_Slot.
5. THE E2E_Suite SHALL check these fits at both Rite_Viewports (Requirement 12.6).

---

### Requirement 11: No Change to Game Rules

**User Story:** As a maintainer, I want this feature to change what is shown and what starts a Séance, not how ghosts are scored or scheduled, so that the trusted rules stay trusted.

#### Acceptance Criteria

1. THE feature SHALL NOT change `app/src/engine/config.ts`, `app/src/engine/scheduler.ts`, `app/src/engine/outcome.ts`, `app/src/engine/cangjie.ts`, `app/src/engine/learningOrder.ts`, `app/src/storage/` or `app/public/data/characters.json`.
2. THE feature SHALL keep `SUMMON_HOLD_MS` and `SUMMON_FADE_MS` at 1500 each, defined once in `app/src/modes/SummonStep.tsx`. *(Amended (approved by the human): see ink-and-candlelight Requirement 17.5 (Q12b): unchanged, exempt from the Motion_Window))*
3. THE feature SHALL keep the Outcome of every ghost computed by `combineOutcomes` from the Step results, the thresholds from the engine config, and the Key_Hint rule unchanged.
4. THE feature SHALL add no new property-based test and no mutation testing (tech.md, decision of Nov 15; the one exception, the summon-ink classification, is not affected).
5. THE feature SHALL add no network request, no API key and no runtime model call.

---

### Requirement 12: Tests

**User Story:** As a developer, I want the new behaviour proven by unit, component and end-to-end tests, so that teaching on first meeting never breaks the test on return.

#### Acceptance Criteria

1. THE Test_Suite SHALL include unit tests for `isBrandNewPlayer` and `firstMeetingSet` (own-property check, a key such as "constructor", an empty history, a history with entries), for `pickWalkthroughGhost` (each clause of the rule on small hand-built datasets, `null` when nothing matches, the real-dataset assertion of Requirement 3.4), for `composeFirstSession` (prepend, removal of a duplicate, size cut, size smaller than the list), for `walkthroughSummonLines` (the three line forms, `maskTarget`, one line per key, an exhaustive loop over every key A–Y against the real dataset) and for `formatReturn` (every bucket and boundary, singular forms, the calendar-day rule with injected local timestamps, non-finite input).
2. THE Test_Suite SHALL include component tests, with hanzi-writer mocked, for the Summon_Step (Faint_Code letters and slot names for a First_Meeting ghost, "Slot {n}, empty" for a Returning_Ghost, the Next_Key_Highlight moving and ending, the walkthrough line changing per key and ending, a wrong key counting a mistake, `clean` when typed without error, no `hintShown` from the Faint_Code), for the Seance_Session (the First_Meeting_Set and the Walkthrough_Ghost props, the Write line, the Write line removed on a result, the defaults), for the Session_Summary (rows, order, each Return_Text, no list when empty, glyph with `lang`) and for the Intro_Screen (the new sentence, the old sentence gone).
3. THE Test_Suite SHALL include App tests for: first visit (intro, then the Séance directly with the Walkthrough_Ghost first and `cangjieIntroSeen` unchanged); the menu's "Begin a Nightly Séance" with `cangjieIntroSeen` false starting the Séance directly; "How Cangjie works" showing the guide and returning to the menu; a Brand_New_Player getting the Walkthrough_Ghost first and ten ghosts in total; a player with any history getting `buildSession`'s ghosts unchanged; the summary listing the return times of the ghosts just recorded; and the summary appearing when storage cannot save.
4. THE Test_Suite SHALL update the existing tests that clicked through the forced guide or assumed the first ghost of an empty history is the first character of the Learning order (`app/src/App.test.tsx`, `app/src/App.leaveSaved.test.tsx` and any test that fails because of this feature), changing a test only where this spec changes the behaviour.
5. THE Test_Suite SHALL keep the existing property-based tests unchanged and green.
6. THE E2E_Suite SHALL include a spec `e2e/first-meeting.spec.ts` that, with the saved state seeded through the existing `seed` helper and without a backdoor in the App, checks: a new player's first ghost is the one `pickWalkthroughGhost` returns, with the Faint_Code letters visible in the slots and the Walkthrough_Line "Press {K}: ..." for the first key; a Returning_Ghost shows "Slot 1, empty" and no letters; a new player reaches the first ghost from the intro with no guide; and the summary lists a Return_Text for every ghost of a completed Séance.
7. THE E2E_Suite SHALL check, at both Rite_Viewports, that the Walkthrough_Ghost's Summon_Step and Write_Mode and a First_Meeting ghost that is not the Walkthrough_Ghost keep their controls and the Walkthrough_Line inside the viewport with no vertical scroll, and SHALL run the width check on the Session_Summary with the list at 375 × 812.
8. THE existing e2e specs SHALL pass unchanged in intent: where their seeded history makes the first ghost a First_Meeting or the Walkthrough_Ghost, they SHALL be updated only as far as that requires.
9. THE final checkpoint SHALL run `npm test`, `tsc --noEmit` for the root project, `app/` and `oracle/`, `npm run build -w app`, `npm run check:bundle` and `npm run test:e2e`, and all SHALL pass.

---

### Requirement 13: Steering, Amendments and Review

**User Story:** As a maintainer, I want the rules and specs this feature changes updated and reviewed, so that the repository stays consistent for judging.

#### Acceptance Criteria

1. THE file `.kiro/steering/content-accuracy.md` SHALL be edited by the steering task of this spec only, as Requirement 7.7 says.
2. THE file `.kiro/steering/product.md` SHALL be edited by the steering task of this spec only, so that its core loop says: the first time a ghost is met its code is shown to copy; when the ghost returns the code is hidden; and the hint line "Never the full answer at first" applies to hints after wrong answers, not to the first-meeting display.
3. THE spec documents named in "Amendments to other specs" SHALL carry an "Amended (approved by the human)" note for each change.
4. WHEN all new copy exists, THE maintainer SHALL run the Accuracy_Reviewer over the Intro_Screen sentence, the Walkthrough_Lines and the status text in `SummonStep.tsx` and `walkthrough.ts`, the Return_Texts and summary copy, the README change and the steering edits, and SHALL fix every finding and run the agent again until it reports none.
5. THE repository SHALL NOT contain a personal name in any file this feature adds or changes, and approvals SHALL be written as "approved by the human".

---

## Amendments to other specs

These changes are approved by the human and are applied by task 1.3 of this spec. Each carries an "Amended (approved by the human): see first-meeting Requirement N" note.

### ghost-game-core

- Requirements AC 1.2 (intro premise): the legend names the rite in one line, "Type its shapes to summon it, then write it from memory." (first-meeting Requirement 6).
- Requirements AC 1.3 and AC 1.5: the begin controls start a Séance directly; the earlier cangjie-seance rule that the guide comes first is withdrawn (Requirement 5).
- Requirements AC 3.1 and AC 6.5: for a Brand_New_Player the App puts the Walkthrough_Ghost first and fills the rest from the scheduler's selection; the scheduler's algorithm is unchanged (Requirement 3).
- Requirements AC 3.3: the session-complete summary also lists when each ghost returns (Requirement 9).
- Design: the App `startSeance` and summary notes follow.

### cangjie-seance

- Requirements AC 6.1 and AC 6.2: the guide before the first Séance is removed; AC 6.3 stays (re-view from the menu). AC 7.2 and AC 9.4 lose "after the guide, if Requirement 6.2 applies" and "first visit: intro, guide, Séance".
- Requirements Glossary "Code slot" and AC 3.1, AC 3.5: for a First_Meeting ghost an empty slot shows a Faint_Code letter.
- Requirements AC 3.7 and Glossary "Key hint": the Faint_Code is not a Key hint; AC 5.1 notes that the faint letters are key letters and never the target character.
- Requirements Introduction and Requirement 6 title: the guide is no longer "before my first Séance".
- Design: the screen-flow diagram (`guide_before`), `App` (`beginSeance`, `origin`), the Summon step slots and the status text, and the `App.test.tsx` row.
- Decision D13 stays: the guide example is still chosen late in the Learning order.

### visual-identity

- Requirements 25.1, 25.2 and 26.1 and the design's height budget: the Walkthrough_Line reserves `WALKTHROUGH_LINE_PX` and the formulas take an optional reserved height (Requirement 10.3).
- Requirements 29.3 and 29.4 (the e2e checks): the Summon_Step now also shows the Faint_Code, and the new spec checks the Walkthrough_Line.
- Requirement 18.2c: the Saving_Works read after "the Cangjie-guide flag" stays, because the guide still writes the flag from the menu; no change is needed beyond a note.

### summon-ink

- Requirements AC 9.7 and design "End-to-end tests": the e2e test that reaches 明 by seeding history now meets a First_Meeting ghost (its Faint_Code is visible); the ink behaviour is unchanged.

### Steering

- `content-accuracy.md`: the first-meeting display under "What is not an answer leak" (Requirement 7.7).
- `product.md`: the core loop (Requirement 13.2).
