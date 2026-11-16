# Requirements Document

## Introduction

The cangjie-seance feature is the Resurrection-category core of Ghost Script. It revives Cangjie (倉頡輸入法), an input method that composes every character from base shapes on the keys A–Y, as part of every ghost's Séance. There is one rite and no mode choice. Each ghost goes through two steps in a single Nightly Séance: (a) SUMMON, where the player types the ghost's Cangjie code on a physical keyboard or a 25-key on-screen keyboard and the character forms in ink and then fades out; and (b) LAY TO REST, where the player writes the character from memory in the existing Write mode. Ghosts without a playable code skip the summon step and go straight to writing.

The feature has five parts: (1) Cangjie codes added to the character dataset from the Unicode Unihan database; (2) the two-step rite inside the Séance; (3) one combined Outcome per ghost, recorded once into the existing Review history; (4) a one-time "How Cangjie works" screen that can be re-read from the start menu; and (5) a strict rule that the target character is never shown before the ghost's rite has run its course. Saved-data schema version 2 adds the flag that records whether "How Cangjie works" has been seen.

The feature builds on the character-dataset and ghost-game-core specs and amends parts of both (see "Amendments to other specs"). It reuses the ghost-game-core engine unchanged: the Haunting scheduler, the Learning order over all 300 characters, the thresholds in `app/src/engine/config.ts`, immediate saving, and the Séance flow.

### Data facts this spec relies on

A read-only probe of the Unicode 18.0.0 Unihan database (`Unihan.zip`, file date 2026-07-31, SHA-256 `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`) found a `kCangjie` value for all 300 characters in `data/character-list.txt` (0 missing). Every value matches `^[A-Y]{1,5}$`. Code lengths are 1 key ×14, 2 keys ×55, 3 keys ×104, 4 keys ×90 and 5 keys ×37. No character has more than one value. The X (難) key appears in exactly three codes: 别 `XRSLN`, 错 `XCTA` and 身 `HXH`. UAX #38 lists `kCangjie` as Provisional with syntax `[A-Z]+`; it does not explain what a leading X means. For that reason 298 of the 300 characters are Playable in Cangjie mode: 别 and 错 are excluded because their codes start with X. 身 stays playable because its X is not the first key. The X (難) key stays on the On-screen Cangjie keyboard (25 keys) because 身 needs it. The dataset still stores the codes of 别 and 错 verbatim; the exclusion happens in the app's engine, not in the data. The Pipeline re-verifies these facts at build time (Requirement 1).

Out of scope: traditional characters and the traditional toggle, any choice of mode, a separate Cangjie-only Séance, a structure ("Reveal its shape") hint, Cantonese, other input methods, Cangjie codes from any source other than Unihan, typing whole words, teaching the auxiliary shapes behind each key, and the Cangjie Oracle MCP server.

## Glossary

- **App**: The React + Vite single-page web application in `app/`.
- **Pipeline**: The data pipeline in `scripts/` that builds `characters.json` (character-dataset spec).
- **Storage module**: The wrapped `localStorage` layer in `app/src/storage/` (ghost-game-core Requirement 7).
- **Test_Suite**: The Vitest tests run by the repository's root `npm test`.
- **Unihan**: The Unicode Han Database (`Unihan.zip`, Unicode 18.0.0), distributed under the Unicode License V3 (SPDX `Unicode-3.0`). Its `kCangjie` field supplies the Cangjie codes.
- **Cangjie code**: The sequence of 1–5 key letters (A–Y) that Cangjie uses to input a character, copied verbatim from the Unihan `kCangjie` field. Stored in the dataset as `cangjie: string | null`.
- **Base shape**: The single shape shown for each Cangjie key: A日 B月 C金 D木 E水 F火 G土 H竹 I戈 J十 K大 L中 M一 N弓 O人 P心 Q手 R口 S尸 T廿 U山 V女 W田 Y卜. Each key also stands for a family of related shapes, which this feature does not teach one by one.
- **X key**: The Cangjie key X, which this feature labels 難 on screen (a label of the on-screen key, not a claim about Cangjie). It is not in the list above and appears in some codes (in the current data: 别, 错 and 身).
- **Answer_Leak**: The target character of a ghost becoming visible before its rite has run its course. In the guide, an example character that a new player meets early would be an Answer_Leak.
- **Playable in Cangjie mode**: A character whose `cangjie` is non-null and does not start with `X`. Only a Playable character has a Summon step.
- **Rite**: The two steps every ghost goes through in a Séance: the Summon step, then the Lay-to-rest step. A ghost that is not Playable in Cangjie mode has only the Lay-to-rest step.
- **Summon step**: The first step of the Rite. The player types the ghost's Cangjie code; when the code is complete (or the player gives up) the character forms in ink and then fades out.
- **Lay-to-rest step**: The second step of the Rite. The player writes the character from memory in Write mode (ghost-game-core Requirement 5), unchanged.
- **Code slot**: One placeholder per key of the target code, shown in order. A slot is empty until its key is entered correctly; it then shows that key's letter and base shape (難 for X).
- **On-screen Cangjie keyboard**: 25 buttons, the 24 base-shape keys A–Y plus X (難), usable with touch, mouse and keyboard focus.
- **Key hint**: In the Summon step, the reveal of the next expected key after repeated wrong keys for the same slot.
- **Step result**: The Outcome of one step on its own: `clean`, `struggled` or `gave-up`, classified by the step's own hints, mistakes and Give up.
- **Combined outcome**: The single Outcome of a ghost, computed from the Summon step's Step result (when there is one) and the Lay-to-rest step's Step result (Requirement 4).
- Terms not defined here (Ghost, Outcome, `clean`/`struggled`/`gave-up`, Nightly Séance, Interval ladder, Learning order, Review history, Display cleanup, Stroke hint, Haunting scheduler, Write mode) have the meanings given in the ghost-game-core requirements.

---

## Requirements

### Requirement 1: Cangjie Codes in the Character Dataset

**User Story:** As a developer, I want each character's Cangjie code added to `characters.json` from a pinned, licensed source, so that the Summon step never relies on guessed or AI-generated codes.

#### Acceptance Criteria

1. THE Pipeline SHALL read Cangjie codes only from the `kCangjie` field of the Unihan database, Unicode version 18.0.0, obtained from `https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip` and checked against the SHA-256 recorded in `data/raw/SOURCES.md` (`4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`).
2. THE repository SHALL store the Unihan data file the Pipeline reads (`Unihan_DictionaryLikeData.txt`, a verbatim copy) under `data/raw/unihan/`, with the Unicode License V3 text in the same directory; `data/raw/SOURCES.md` SHALL record the Unicode version, file date, download URL, both SHA-256 values (the zip and the committed file), the file and field used, and the licence (SPDX `Unicode-3.0`).
3. EACH CharacterRecord SHALL gain a `cangjie` field holding the character's `kCangjie` value copied verbatim, or `null` when Unihan has no value; `sources.cangjie` SHALL be `"unihan"` when the value is non-null and `"missing"` when it is null. THE Pipeline SHALL NEVER infer, derive or generate a code (for example from a traditional variant or from components).
4. IF a `kCangjie` value does not match `^[A-Y]{1,5}$`, or a character has more than one `kCangjie` value, THEN THE Pipeline SHALL write the affected characters and values to stderr, exit with a non-zero status, and write no output.
5. IF a character has no `kCangjie` value, THEN THE Pipeline SHALL set its `cangjie` to `null`, SHALL NOT fail the build, and SHALL state in its success summary how many characters have a code and list every character without one.
6. THE Pipeline SHALL stay deterministic: identical inputs, including the Unihan file, SHALL produce a byte-identical `characters.json`.
7. THE README "Data and licences" section SHALL list Unihan with its version, URL and licence, and SHALL state that `characters.json` also contains data under the Unicode License V3.
8. THE shared `CharacterRecord` type and the app's dataset loader SHALL accept the `cangjie` field, and THE loader SHALL reject a record whose `cangjie` is neither `null` nor a string matching `^[A-Y]{1,5}$`.
9. WHEN the Pipeline starts, THE Pipeline SHALL verify the committed Unihan file's SHA-256 against the value recorded in `data/raw/SOURCES.md` before reading it, and IF the hashes differ or no recorded hash is found, THEN THE Pipeline SHALL exit with a non-zero status and write no output.
10. THE Pipeline's success summary SHALL also state how many characters are Playable in Cangjie mode (298 in the current data) and list every character that is not (in the current data: 别 and 错); THE dataset SHALL keep storing those characters' codes verbatim.
11. THE function `isPlayableInCangjie(code)` SHALL have exactly one definition, in `app/src/engine/cangjieRules.ts`, used by both the Pipeline summary and the App, and SHALL return true exactly when `code` is non-null and does not start with `X`.

---

### Requirement 2: The Rite, One Flow per Ghost

**User Story:** As a player, I want every ghost to ask me to summon it by its Cangjie code and then write it from memory, so that I learn how each character is built and then prove I can write it.

#### Acceptance Criteria

1. WHEN a ghost is presented in a Séance, THE App SHALL run the Rite for that ghost in this order: first the Summon step, then the Lay-to-rest step, with no choice of mode anywhere in the App.
2. WHEN the ghost's character is Playable in Cangjie mode, THE App SHALL begin the ghost with the Summon step.
3. IF the ghost's character is not Playable in Cangjie mode (a null code, or a code starting with X; in the current data 别 `XRSLN` and 错 `XCTA`), THEN THE App SHALL skip the Summon step and begin the ghost with the Lay-to-rest step. 身 (`HXH`) SHALL have a Summon step.
4. WHEN the Summon step's code is complete, or the player gives up in the Summon step, THE App SHALL form the character in ink, hold it on screen for 1.5 s (`SUMMON_HOLD_MS`, 1500 ms), fade it out over 1.5 s (`SUMMON_FADE_MS`, 1500 ms), remove it from the page, and only then begin the Lay-to-rest step. *(Amended (approved by the human): see summon-ink Requirements 4 and 6: strokes may be drawn during typing, one set per correct key; no character text and no attribute appears before the code is complete, and the hold and fade are unchanged.)*
5. WHERE the player's system requests reduced motion, THE App SHALL replace the animated fade by an immediate removal after the same hold time.
6. WHEN the player gives up in the Summon step, THE App SHALL show the full code, form and fade the character as in AC 2.4, and still proceed to the Lay-to-rest step for that ghost, with the ghost's Combined outcome fixed at `gave-up`.
7. THE Lay-to-rest step SHALL behave exactly as Write mode does in ghost-game-core (hanzi-writer quiz mode, live per-stroke checking, Stroke hint after 3 consecutive misses of the same stroke, "Give up" with stroke-order animation, clean-mistake threshold from the engine config).
8. WHEN a Séance begins, THE App SHALL select its ghosts with the ghost-game-core session-selection algorithm (ghost-game-core AC 6.5) applied to the Learning order over all 300 characters, with the UI-read clock and the same `EngineConfig`; 298 of the 300 ghosts have a Summon step.
9. THE Séance SHALL keep the ghost-game-core flow: "Ghost N of M", the cleaned and masked clue shown through both steps, a text label naming the active step ("Step 1 of 2: Summon" or "Step 2 of 2: Lay to rest"; "Lay to rest" for a ghost without a Summon step), a "Next ghost" control that appears only after the Lay-to-rest step ends (the last ghost leading to the summary), the session summary, and "Begin another Séance".
10. THE hold and fade durations of AC 2.4 SHALL come only from the named constants `SUMMON_HOLD_MS` and `SUMMON_FADE_MS`, each defined once in the Summon step module (`app/src/modes/SummonStep.tsx`).

---

### Requirement 3: Summoning a Ghost by Typing its Cangjie Code

**User Story:** As a player, I want to type a ghost's Cangjie code on my keyboard or on screen and see each correct shape appear, so that I learn how the character is built.

#### Acceptance Criteria

1. WHEN the Summon step begins, THE App SHALL show one empty Code slot per key of the target code and SHALL accept input from the physical keyboard and from the On-screen Cangjie keyboard. The number of Code slots tells the player the code length, by design.
2. WHEN a physical key event has a `KeyboardEvent.key` that is a single letter A–Y (either case), Ctrl, Alt and Meta are not held, the event is not an auto-repeat, `isComposing` is false and `key` is not `"Process"`, THE App SHALL treat the event as one key entry; THE App SHALL ignore every other event, including every Z, without counting a mistake.
3. THE Summon step SHALL show a short note asking the player to turn off any system Chinese input method if typed letters do not appear.
4. THE On-screen Cangjie keyboard SHALL provide 25 buttons (A–Y with their base shapes and X labelled 難); each button SHALL have an accessible name containing its letter, measure at least 44 px in each dimension, and be operable by touch, mouse and keyboard focus.
5. WHEN a key entry equals the next expected key of the code, THE App SHALL fill the next Code slot with that key's letter and base shape (難 for X) and give accepted feedback.
6. WHEN a key entry does not equal the next expected key, THE App SHALL count exactly one mistake within the handling of that entry, leave the slots unchanged, and give rejected feedback; nothing SHALL change the mistake count outside a key entry.
7. WHEN the player enters a wrong key for the SAME slot on 3 consecutive entries (the `strokeHintAfterConsecutiveMisses` constant of the engine config), THE App SHALL show a Key hint identifying the next expected key, on its slot and on the On-screen Cangjie keyboard; the player SHALL still enter that key to fill the slot. THE App SHALL provide no control to request a Key hint.
8. WHEN the last slot is filled, THE App SHALL set the Summon step's Step result to `clean` if no Key hint was shown and total mistakes are within `cleanMistakeThreshold`, and to `struggled` otherwise, SHALL show the full code, and SHALL form the character in ink (Requirement 2.4).
9. THE Summon step SHALL provide a clearly labelled "Give up" control; WHEN the player activates it, THE App SHALL stop accepting key entries, set the Summon step's Step result to `gave-up`, show the full code in the slots, and form the character in ink (Requirement 2.4).
10. THE App SHALL fix the Summon step's Step result exactly once, and SHALL ignore key entries and Give up after it is fixed.
11. THE thresholds SHALL come only from the engine config; feedback SHALL use text or an icon as well as colour; and every control SHALL be operable by keyboard.
12. THE input and Step-result logic (matching a key entry to the code, counting mistakes, triggering the Key hint, classifying the Step result) SHALL be a pure reducer in `app/src/engine/` with no I/O and no reliance on ambient time.
13. WHILE the Summon step is active, THE App SHALL show the one-line source note "Codes: Unicode Unihan kCangjie" (the guide carries the fuller statement, Requirement 6.7).

---

### Requirement 4: One Combined Outcome per Ghost

**User Story:** As a player, I want one result per ghost that reflects how I did in both steps, so that the Haunting scheduler brings back the ghosts I struggled with.

#### Acceptance Criteria

1. IF the player used Give up in EITHER step of a ghost's Rite, THEN THE App SHALL set that ghost's Combined outcome to `gave-up`.
2. IF Give up was not used, AND a hint appeared in EITHER step (a Key hint in the Summon step or a Stroke hint in the Lay-to-rest step) OR total mistakes in EITHER step exceeded `cleanMistakeThreshold` (each step's mistakes compared to the threshold separately, not added together), THEN THE App SHALL set the Combined outcome to `struggled`.
3. IF neither of the above applies, THEN THE App SHALL set the Combined outcome to `clean`.
4. WHEN a ghost has no Summon step, THE App SHALL set its Combined outcome to the Lay-to-rest step's Step result.
5. THE App SHALL record each ghost's Combined outcome ONCE, immediately when it is final (at the end of the Lay-to-rest step), using `applyReview` with the UI-read clock and the Storage module's `recordOutcome(char, entry)`; THE App SHALL record nothing at the end of the Summon step, so leaving mid-ghost records nothing for that ghost.
6. THE App SHALL keep ONE Review history, shared by both steps, and the Haunting scheduler and Learning order SHALL be unchanged.
7. WHEN a step's Step result is `gave-up`, key entries and strokes that arrive afterwards SHALL NOT change the Combined outcome.
8. IF hanzi-writer cannot load the character in the Lay-to-rest step, THEN THE App SHALL resolve that step as `gave-up` (as in ghost-game-core), so the Combined outcome is `gave-up`.
9. THE combination of the Summon step's Step result (or its absence) with the Lay-to-rest step's Step result SHALL be a pure function `combineOutcomes(summon, write)` in `app/src/engine/outcome.ts`.
10. THE SeanceSession SHALL combine the two Step results internally and report one Outcome per ghost, so that the App's outcome handler and `recordOutcome(char, entry)` keep their current signatures.

---

### Requirement 5: Never Revealing the Target Character

**User Story:** As a player, I want the game never to show me the character I am trying to recall until I have earned it, so that the challenge is real.

#### Acceptance Criteria

1. WHILE the Summon step's code is neither complete nor given up, THE App SHALL NOT render the target character in any text, attribute, accessible name, Code slot, key face, hint, or the document title. *(Amended (approved by the human): see summon-ink Requirements 4 and 6: strokes drawn during typing are allowed because they are drawn paths, not text or an attribute.)*
2. WHEN any string shown for an unresolved ghost would contain the target character, THE App SHALL replace each occurrence with "～" (U+FF5E), for display only, using one shared mask helper (the one GhostPrompt uses).
3. WHILE the target character is itself the base shape of a key (in the current data: 一 中 人 十 口 大 女 山 手 日 月 木 水 火, each of whose codes is that single key), THE On-screen Cangjie keyboard SHALL show every key by its letter only, with no base shapes, so that no single key stands out.
4. THE App SHALL show the target character during the Summon step only while it forms and fades (Requirement 2.4).
5. WHILE the Lay-to-rest step is active and not yet ended, THE App SHALL NOT make the target character visible anywhere on the page, including as residue of the Summon step.
6. WHEN the ghost has no Summon step, THE App SHALL apply the existing Write-mode never-reveal rule (ghost-game-core AC 5.1) and no more.
7. WHEN the Lay-to-rest step ends, THE App SHALL reveal the character as Write mode does today.

---

### Requirement 6: "How Cangjie Works" Screen

**User Story:** As a player new to Cangjie, I want a short explanation before my first Séance, so that I know what the keys mean.

#### Acceptance Criteria

1. WHEN the player dismisses the legend intro on a first visit and the Storage module has no record that "How Cangjie works" was seen, THE App SHALL show the "How Cangjie works" screen before the first Séance.
2. WHEN the player begins a Séance from the start menu and the Storage module has no record that "How Cangjie works" was seen, THE App SHALL show the screen first; WHEN the player continues from it, THE App SHALL record that it was seen and start the Séance.
3. THE App SHALL let the player re-view the screen from the StartMenu, only outside an active Séance; WHEN the player continues from a re-view, THE App SHALL return to the StartMenu.
4. THE screen SHALL show all 25 keys with their base shapes (X shown as 難), show the X key labelled 難 as the label of that on-screen key, explain that a code is one to five keys typed in order, and state that each key stands for a family of related shapes of which only the base shape is shown (citing "Cangjie input method", Requirement 6.6).
5. THE screen SHALL show an example character and its code read from the dataset's `cangjie` field at runtime, never written by hand, where the example is the last character in the Learning order that is Playable in Cangjie mode and has a code of 2 or 3 keys; WHEN no character is eligible, THE screen SHALL omit the example.
6. THE screen SHALL state that Cangjie was "developed in the 1970s" by Chu Bong-Foo, and SHALL make no other historical claim except these three from content-accuracy.md, plus the descriptive claim in the next sentence: it is named after Cangjie, the legendary inventor of Chinese writing; it was the first Chinese input method to use the standard QWERTY keyboard; it was released to the public in 1982. THE screen SHALL state that each key stands for a family of related shapes, and that is the only descriptive claim about how Cangjie works. THE screen SHALL show a visible citation to the English Wikipedia articles "Cangjie input method" and "Chu Bong-Foo", giving each title and URL as text; the citation line SHALL cover the descriptive claim, with the "Cangjie input method" article as its source. THE screen SHALL contain no other claims, statistics, or "dying" language.
7. THE screen SHALL state that the game's codes follow the Unicode Unihan `kCangjie` field, which Unihan marks provisional, so some typists know different codes for some characters.
8. THE screen SHALL be operable by keyboard, touch and mouse; its continue control SHALL have an accessible label; the shapes SHALL carry a Chinese `lang` attribute; and its text SHALL meet contrast guidelines on the dark theme.
9. THE screen SHALL NOT show, as its example, any of the characters a new player meets first, so the example is never an Answer_Leak; THE guide SHALL achieve this by choosing the last eligible character in the Learning order (Requirement 6.5), since a new player meets the Learning order from its start.

---

### Requirement 7: Start Menu

**User Story:** As a returning player, I want a simple menu to begin a Séance or re-read the guides, so that I can find everything without a mode choice.

#### Acceptance Criteria

1. THE StartMenu SHALL offer exactly three controls: "Begin a Nightly Séance", "Read the legend again" and "How Cangjie works", each operable by touch, mouse and keyboard and at least 44 px high.
2. WHEN the player activates "Begin a Nightly Séance", THE App SHALL start a Séance (after the guide, if Requirement 6.2 applies).
3. THE StartMenu SHALL be shown only outside an active Séance, so re-viewing a guide never interrupts a Séance.
4. WHEN the App is opened and a prior visit is recorded, THE App SHALL show the StartMenu directly, skipping the legend intro.

---

### Requirement 8: Persistence and Schema Version 2

**User Story:** As a returning player, I want the app to remember whether I have read "How Cangjie works", so that I am not shown it every time.

#### Acceptance Criteria

1. THE Storage module SHALL set `CURRENT_SCHEMA_VERSION` to 2 and persist the state `{ schemaVersion: 2, introSeen, cangjieIntroSeen, history }`, where `history` is the single Review history keyed by character.
2. THE Storage module SHALL expose `getCangjieIntroSeen()` and `setCangjieIntroSeen(seen)`; `recordOutcome(char, entry)` SHALL keep its current signature and SHALL preserve both flags.
3. THE Storage module SHALL ship NO migration from version 1; WHEN persisted data has `schemaVersion` 1, THE Storage module SHALL reset to defaults under the existing rule that an older version without a migration resets. The consequence is that every existing player loses their saved progress once, and sees the legend intro again.
4. ALL other persisted-data rules of ghost-game-core Requirement 7 SHALL continue to apply: unknown or newer versions, corrupt data and forbidden history keys reset to defaults, and no storage failure crashes the App.

---

### Requirement 9: Quality and Testing

**User Story:** As a judge and developer, I want the new feature held to the same standards as the rest of the game, so that it is trustworthy and works on every device.

#### Acceptance Criteria

1. THE feature SHALL use TypeScript `strict: true` with no `any`, keep game logic in `app/src/engine/` and UI in `app/src/components/` or `app/src/modes/`, run fully offline, and make no network request for Cangjie codes or stroke data at runtime.
2. THE feature SHALL add NO new property-based tests and NO mutation testing; THE Test_Suite SHALL cover the new code with unit tests and component tests only.
3. THE Test_Suite SHALL include unit tests for: the Unihan parser, the SHA-256 check and the build validation failures; `isPlayableInCangjie`; `parseKeyEvent`; the Summon reducer (slot fill, mistakes, the automatic Key hint at 3 consecutive wrong keys and its reset when the slot is filled, Give up, no change after the step result is fixed, Z ignored); the `combineOutcomes` truth table; and the mask helper.
4. THE Test_Suite SHALL include component tests, with hanzi-writer mocked, for: the Summon step (slots, physical and on-screen keys, letters-only keys for key-face characters, the IME note, the hint, Give up, the character forming and then fading, never-reveal before completion); the two-step ghost flow in the Séance (summon, then write, then one Combined outcome recorded once; the Summon step skipped for 别 and 错); the "How Cangjie works" screen; the StartMenu; and the App (first visit: intro, guide, Séance; returning visit: menu; a version-1 saved blob resets).
5. THE Test_Suite SHALL include a never-reveal component test that renders every Playable ghost's Summon step in its unresolved state and again after a Key hint, and asserts the target character appears nowhere in the DOM text, attributes or document title.
6. THE existing 438 tests SHALL stay green, changed only where this spec changes a behaviour or a shape, and THE repository's root `npm test` SHALL run all tests.
7. THE feature SHALL be usable from 375 px phones to 1440 px+ laptops, with the physical keyboard on laptops and the On-screen Cangjie keyboard on touch devices; the Lay-to-rest step needs a pointer to draw, and every other control SHALL work with touch and with mouse or keyboard.

---

## Amendments to other specs

This re-scope changes what the other two specs must say. **These amendments HAVE now been applied.** In ghost-game-core, the withdrawn Cangjie-mode amendments were removed, AC 5.1 was amended for summon-then-fade, and Requirement 7 received the schema-2 reset note. In character-dataset, the Cangjie property tests were replaced by the exhaustive unit test. The lists below record what was changed.

### ghost-game-core: earlier amendments that this re-scope WITHDRAWS

- Requirements: the "Reveal its shape" structure hint in AC 5.5 and AC 5.6 and in the Glossary entries "Clean outcome" and "Struggled outcome" (revert to "no Stroke hint" for the Lay-to-rest step's own rule).
- Requirements: the Glossary entry "Mode", and the per-Mode Review history and the version-1 to version-2 migration in Requirement 7 (AC 7.1, AC 7.6, AC 7.7, AC 7.8).
- Requirements: the mode choice in AC 1.5 and AC 3.6 (the StartMenu has no per-Mode controls; "Begin another Séance" has no Mode).
- Requirements: the filtered Learning order in AC 6.12 (the Learning order is always the full order over all 300 characters).
- Requirements and design: `recordOutcome(mode, char, entry)` returns to `recordOutcome(char, entry)`.
- Design: the storage amendments (`CURRENT_SCHEMA_VERSION` comment on `= 1`, the `recordOutcome(mode, …)` comment, the "Migrations" paragraph and "Amended storage shape (schema v2)" with `history: { write, cangjie }`), the StartMenu, SeanceSession (`mode` prop) and App amendments, the `structureHintUsed` note in the WriteMode `onComplete` bullet, and the session-selection note after the `learningOrder` wiring.

### ghost-game-core: what this re-scope requires

- Glossary and Requirement 3: a ghost is a Rite of one or two steps; the Combined outcome is recorded once at the end of the Lay-to-rest step (Requirement 4 above).
- Requirement 1 (AC 1.5, AC 1.3): the StartMenu has three controls (begin, legend, "How Cangjie works"); the legend's begin control leads to "How Cangjie works" on a first visit.
- Requirement 7: `CURRENT_SCHEMA_VERSION` is 2; the state is `{ schemaVersion, introSeen, cangjieIntroSeen, history }`; no migration ships, so version-1 data resets; `getCangjieIntroSeen` and `setCangjieIntroSeen` join the Storage API.
- Design: `SeanceSession` gains the two-step ghost flow; `App` gains the `cangjie-guide` screen.

### character-dataset: what this re-scope requires

- Keep the earlier amendments that remain correct: the Unihan source and licence (AC 2.4, 2.5, 2.6), the `cangjie` field and `unihan` dataset id (AC 4.2, 4.11, 4.13), the pipeline inputs and summary (AC 3.2, 3.6, 3.7), the serialiser key order, and the amended Properties 4 and 10 (their tests are updated, not removed).
- WITHDRAW or replace: the new property-test ACs 5.10, 5.11 and 5.12 and design Property 23 with its `cangjie.test.ts` row. They conflict with "no new property tests"; replace them with unit tests (Requirement 9.3).

### Steering

The steering files (`product.md`, `tech.md`, `content-accuracy.md`) are updated and describe the two-step rite. `content-accuracy.md` requires the expected Cangjie code to be the verbatim Unihan value; this spec meets that with an exhaustive unit test over all 300 records (Decision 12).

## Decisions

All approved by the human; no open questions remain.

1. One rite, no mode choice: every ghost goes through Summon then Lay to rest in one Séance (approved by the human).
2. Ghosts without a playable code (null, or starting with X: 别 and 错) skip the Summon step; 身 stays playable; 298 of 300 ghosts have a Summon step (approved by the human).
3. One Combined outcome per ghost, recorded once at the end of the Lay-to-rest step with `applyReview` and `recordOutcome(char, entry)`; one Review history; the scheduler and Learning order are unchanged (approved by the human).
4. Each step's mistakes are compared to `cleanMistakeThreshold` separately (approved by the human).
5. Cut: "Reveal its shape", the IDS layout parser and StructureHint component, the mode choice, per-Mode histories and the version-1 to version-2 migration (approved by the human).
6. Schema version 2 gains `cangjieIntroSeen`; no migration ships (approved by the human).
7. Kept: Unihan `kCangjie` data with both SHA-256 values, the X-code exclusion, letters-only on-screen keys for the 14 single-key characters, IME handling, the automatic Key hint after 3 consecutive wrong keys, the never-reveal rule, and the "How Cangjie works" screen (approved by the human).
8. "How Cangjie works" says "developed in the 1970s", matching the content-accuracy.md whitelist, instead of a specific year (approved by the human).
9. Tests: unit and component tests only, no new property tests, no mutation testing (approved by the human).
10. The last task is a manual check by a human, not by Kiro (approved by the human).
11. Accepted trade-off: writing right after seeing the character tests short-term memory; the hold and fade times are named constants (`SUMMON_HOLD_MS`, `SUMMON_FADE_MS`), one constant each, so they are easy to change.
12. The verbatim-code check is an exhaustive unit test over all 300 records, not a property test, which honours "no new property tests".
13. Give up in the Summon step reveals the code; the character forms and fades; the ghost still proceeds to the Lay-to-rest step with the Combined outcome fixed at `gave-up` (approved by the human).
14. The formed character holds 1.5 s and fades over 1.5 s (approved by the human).
15. The Summon step shows the one-line note "Codes: Unicode Unihan kCangjie", in addition to the statement in the guide (approved by the human).
16. Step labels are "Step 1 of 2: Summon" and "Step 2 of 2: Lay to rest" (approved by the human).
17. `SeanceSession` combines the two Step results internally, so `App` and `recordOutcome(char, entry)` keep their current form (approved by the human).
18. The guide example is the last eligible character in the Learning order (Playable, code of 2 or 3 keys) to avoid an Answer_Leak, and the guide keeps only sourced statements: "each key stands for a family of related shapes" cites "Cangjie input method"; the X key is labelled 難 on screen without any claim about its meaning (approved by the human).
