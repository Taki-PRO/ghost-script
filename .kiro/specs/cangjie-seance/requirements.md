# Requirements Document

## Introduction

The cangjie-seance feature is the Resurrection-category core of Ghost Script. It revives Cangjie (倉頡輸入法), an input method that composes every character from base shapes on the keys A–Y, as a second way to lay ghosts to rest: instead of drawing a forgotten character, the player types its Cangjie code. The feature has five parts: (1) Cangjie codes added to the character dataset from the Unicode Unihan database; (2) a Cangjie Séance mode, chosen on the start menu next to Write mode; (3) a one-time "How Cangjie works" screen; (4) an optional "Reveal its shape" structure hint in Write mode; and (5) a stronger rule that the target character is never shown before its ghost is resolved.

The feature builds on the character-dataset and ghost-game-core specs and amends parts of both (see "Amendments to other specs"). It reuses the ghost-game-core engine where possible: the Haunting scheduler, the Learning order, the thresholds in `app/src/engine/config.ts`, immediate saving, and the Séance flow.

### Data finding this spec relies on

A read-only probe (13 Nov 2026, no repository changes) of the Unicode 18.0.0 Unihan database (`Unihan.zip`, file date 2026-07-31, SHA-256 `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`) found a `kCangjie` value for all 300 characters in `data/character-list.txt` (0 missing). Every value matches `^[A-Y]{1,5}$` (code lengths: 1 key ×14, 2 ×55, 3 ×104, 4 ×90, 5 ×37). No character has more than one value. Three codes use the X (難) key: 别 `XRSLN`, 错 `XCTA`, 身 `HXH`. 55 of the 300 simplified characters have a different traditional form, and Unihan gives a code for the simplified character itself in every case (for example 们 `OLS`). UAX #38 lists `kCangjie` as Provisional with syntax `[A-Z]+`, and says only that it "incorporates data from the file cangjie-table.b5 by Christian Wittern"; it does not explain what a leading X means. Because of that, 298 of the 300 characters are Playable in Cangjie mode: 别 (`XRSLN`) and 错 (`XCTA`) are excluded because their codes start with X, which UAX #38 does not document. 身 (`HXH`) stays playable because its X is not the first key. The X (難) key stays on the On-screen Cangjie keyboard (25 keys) because 身 needs it. The dataset still stores the codes of 别 and 错 verbatim; the exclusion happens in the app's engine, not in the data. The Pipeline re-verifies these facts at build time (Requirement 1); they are recorded here only to justify the scope.

Out of scope: traditional characters and the traditional toggle, Build mode, Cantonese, other input methods, Cangjie codes from any source other than Unihan, typing whole words, teaching the auxiliary shapes behind each key, and the Cangjie Oracle MCP server.

## Glossary

- **Cangjie code**: The sequence of 1–5 key letters (A–Y) that Cangjie uses to input a character, copied verbatim from the Unihan `kCangjie` field. Stored in the dataset as `cangjie: string | null`.
- **Playable in Cangjie mode**: A character whose `cangjie` is non-null and does not start with `X`.
- **Base shape**: The single shape shown for each Cangjie key: A日 B月 C金 D木 E水 F火 G土 H竹 I戈 J十 K大 L中 M一 N弓 O人 P心 Q手 R口 S尸 T廿 U山 V女 W田 Y卜. Each key also stands for a family of related shapes, which this feature does not teach one by one.
- **X key (難)**: The special Cangjie key X (難, "difficult"). It has no base shape in the list above and appears in some codes (in our data: 别, 错, 身).
- **Mode**: Either Write (draw the character, ghost-game-core Requirement 5) or Cangjie (type its code, Requirement 5 of this spec).
- **Cangjie Séance**: A Nightly Séance played in Cangjie mode. It follows the ghost-game-core session flow, but each ghost is laid to rest by typing its Cangjie code.
- **Code slot**: One placeholder per key of the target code, shown in order. A slot is empty until its key is entered correctly; it then shows that key's letter and base shape (難 for X).
- **On-screen Cangjie keyboard**: 25 buttons, the 24 base-shape keys A–Y plus X (難), usable with touch, mouse, and keyboard focus.
- **Key hint**: In Cangjie mode, the reveal of the next expected key after repeated wrong keys for the same slot.
- **Structure hint ("Reveal its shape")**: In Write mode, an optional control that shows the character's layout from its IDS decomposition as nested boxes labelled with its components, never the character itself.
- **Eligible for the structure hint**: A character whose decomposition is not atomic and whose IDS string contains no `？` (U+FF1F). In the current data, 259 of 300 characters are eligible (9 are atomic and 32 contain an interior `？`).
- **Unihan**: The Unicode Han Database (`Unihan.zip`), distributed under the Unicode License V3 (SPDX `Unicode-3.0`).
- Terms not defined here (Ghost, Outcome, `clean`/`struggled`/`gave-up`, Interval ladder, Learning order, Review history, Storage module, Display cleanup, Stroke hint, Haunting scheduler) have the meanings given in the ghost-game-core requirements.

---

## Requirements

### Requirement 1: Cangjie Codes in the Character Dataset

**User Story:** As a developer, I want each character's Cangjie code added to `characters.json` from a pinned, licensed source, so that Cangjie mode never relies on guessed or AI-generated codes.

#### Acceptance Criteria

1. THE Pipeline SHALL read Cangjie codes only from the `kCangjie` field of the Unihan database, Unicode version 18.0.0, obtained from `https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip` and checked against the SHA-256 recorded in `data/raw/SOURCES.md` (`4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e`).
2. THE repository SHALL store the Unihan data file the Pipeline reads under `data/raw/unihan/`, with the Unicode License V3 text in the same directory; `data/raw/SOURCES.md` SHALL record the Unicode version, file date, download URL, SHA-256, the file and field used, and the licence (SPDX `Unicode-3.0`).
3. EACH CharacterRecord SHALL gain a `cangjie` field holding the character's `kCangjie` value copied verbatim, or `null` when Unihan has no value; `sources.cangjie` SHALL be `"unihan"` when the value is non-null and `"missing"` when it is null. THE Pipeline SHALL NEVER infer, derive, or generate a code (for example from a traditional variant or from components).
4. IF a `kCangjie` value does not match `^[A-Y]{1,5}$`, or a character has more than one `kCangjie` value, THEN THE Pipeline SHALL write the affected characters and values to stderr, exit with a non-zero status, and write no output.
5. A null Cangjie code SHALL NOT fail the build; THE Pipeline's success summary SHALL state how many characters have a code and list every character without one.
6. THE Pipeline SHALL stay deterministic: identical inputs, including the Unihan file, SHALL produce a byte-identical `characters.json`.
7. THE README "Data and licences" section SHALL list Unihan with its version, URL, and licence, and SHALL state that `characters.json` also contains data under the Unicode License V3.
8. THE shared `CharacterRecord` type and the app's dataset loader SHALL accept the `cangjie` field, and THE loader SHALL reject a record whose `cangjie` is neither `null` nor a string matching `^[A-Y]{1,5}$`.
9. THE Test_Suite SHALL include property tests asserting that every non-null `cangjie` matches `^[A-Y]{1,5}$`, that `sources.cangjie` is `"unihan"` exactly when `cangjie` is non-null, and that every non-null `cangjie` equals the raw Unihan value for that character.
10. THE `data/raw/SOURCES.md` file SHALL record the SHA-256 of the committed Unihan data file as well as the SHA-256 of the original `Unihan.zip`; WHEN the Pipeline starts, THE Pipeline SHALL verify the committed file's SHA-256 against the recorded value before reading it, and IF the hashes differ, THEN THE Pipeline SHALL exit with a non-zero status and write no output.
11. THE Pipeline's success summary SHALL also state how many characters are Playable in Cangjie mode and list every character that is not (in the current data: 别 and 错); THE dataset SHALL keep storing those characters' codes verbatim.

---

### Requirement 2: Choosing a Mode

**User Story:** As a player, I want to choose between Write and Cangjie on the start menu, so that I can practise on whatever device and keyboard I have.

#### Acceptance Criteria

1. THE StartMenu SHALL offer two clearly labelled controls to begin a Nightly Séance, one in Write mode and one in Cangjie mode, each operable by touch, mouse, and keyboard.
2. THE StartMenu SHALL also offer a control to re-view "How Cangjie works" (Requirement 3), next to the existing control to re-view the legend.
3. THE player SHALL choose the Mode only outside an active Séance; a Séance SHALL keep the Mode it was started in until it ends.
4. WHEN the player uses the legend intro's begin control on a first visit, THE App SHALL start a Write-mode Séance, as in ghost-game-core.

---

### Requirement 3: "How Cangjie Works" Screen

**User Story:** As a player new to Cangjie, I want a short explanation before my first Cangjie Séance, so that I know what the keys mean.

#### Acceptance Criteria

1. WHEN the player starts a Cangjie Séance and the Storage module has no record that "How Cangjie works" was seen, THE App SHALL show the "How Cangjie works" screen first; WHEN the player continues from it, THE App SHALL record that it was seen and start the Cangjie Séance.
2. THE App SHALL let the player re-view the screen from the StartMenu, and only outside an active Séance.
3. THE screen SHALL show all 24 keys A–Y with their base shapes, explain the X (難) key, explain that a code is a sequence of one to five keys typed in order, and explain that each key stands for a family of related shapes of which only the base shape is shown.
4. ANY example code on the screen SHALL be taken from the dataset's `cangjie` field, not written by hand.
5. THE screen SHALL make no historical claim other than these four, taken from content-accuracy.md: Cangjie was invented in 1976 by Chu Bong-Foo; it is named after Cangjie, the legendary inventor of Chinese writing; it was the first Chinese input method to use the standard QWERTY keyboard; it was released to the public in 1982. THE screen SHALL show a visible citation to the English Wikipedia articles "Cangjie input method" and "Chu Bong-Foo", giving each title and URL as text. THE screen SHALL make no other claims, statistics, or "dying" language.
6. THE screen SHALL be operable by keyboard, touch, and mouse; its continue control SHALL have an accessible label; the shapes SHALL carry a Chinese `lang` attribute; and its text SHALL meet contrast guidelines on the dark theme.

---

### Requirement 4: Cangjie Séance Session

**User Story:** As a player, I want a Cangjie Séance to work like a Write Séance, so that the game feels familiar and my progress is kept.

#### Acceptance Criteria

1. WHEN a Cangjie Séance begins, THE App SHALL select its ghosts with the ghost-game-core session-selection algorithm (ghost-game-core AC 6.5), applied to the Learning order filtered to characters Playable in Cangjie mode, with the UI-read clock and the same `EngineConfig`.
2. THE App SHALL skip every character that is not Playable in Cangjie mode; such a character SHALL never appear as a Cangjie ghost.
3. THE Cangjie Séance SHALL follow the ghost-game-core Séance flow: "Ghost N of M", the cleaned and masked clue, one terminal Outcome per ghost, a "Next ghost" control after each Outcome with the last one leading to the summary, the session summary, and "Begin another Séance" starting another Séance in the same Mode.
4. THE App SHALL record each Cangjie ghost's Outcome to the Review history IMMEDIATELY when it is reached, using `applyReview` with the UI-read clock, so that leaving mid-session loses no completed ghost.
5. THE App SHALL keep one Review history per Mode (`write`, `cangjie`), each keyed by character, so that a Cangjie Outcome never changes when a character is next due in Write mode, and a Write Outcome never changes when it is next due in Cangjie mode.

---

### Requirement 5: Typing the Cangjie Code

**User Story:** As a player, I want to type a ghost's Cangjie code on my keyboard or on screen and see each correct shape appear, so that I learn how the character is built.

#### Acceptance Criteria

1. WHEN a ghost is presented in Cangjie mode, THE App SHALL show the clue and one empty Code slot per key of the target code, and SHALL accept input from the physical keyboard and from the On-screen Cangjie keyboard. The number of Code slots tells the player the code length, by design.
2. THE App SHALL read `KeyboardEvent.key` for physical keyboard input; WHEN `key` is a single letter A–Y (case-insensitive), Ctrl, Alt, and Meta are not held, and the event is not an auto-repeat, THE App SHALL treat the event as one key entry; THE App SHALL ignore every event whose `isComposing` is true (and every event whose `key` is `"Process"`), every Z, and every other key. Z is not a Cangjie key, so it is ignored and not counted as a mistake.
3. THE Cangjie screen SHALL show a short note asking the player to turn off any system Chinese input method if typed letters do not appear.
4. THE On-screen Cangjie keyboard SHALL provide 25 buttons, A–Y with their base shapes and X labelled 難; each button SHALL have an accessible name containing its letter, measure at least 44 px in each dimension, and be operable by touch, mouse, and keyboard focus.
5. WHEN a key entry equals the next expected key of the code, THE App SHALL fill the next Code slot with that key's letter and base shape (難 for X) and give accepted feedback.
6. WHEN a key entry does not equal the next expected key (a wrong key entry is a letter A–Y that differs from the next expected key, or an on-screen key that differs), THE App SHALL count exactly one mistake within the handling of that entry, leave the slots unchanged, and give rejected feedback; nothing SHALL change the mistake count outside a key entry.
7. WHEN the player enters a wrong key for the SAME slot on 3 consecutive entries (the ghost-game-core `strokeHintAfterConsecutiveMisses` constant), THE App SHALL show a Key hint identifying the next expected key, on its slot and on the On-screen Cangjie keyboard; the player SHALL still enter that key to fill the slot. THE App SHALL provide no control to request a Key hint; the Key hint appears only automatically after 3 consecutive wrong entries for the same slot.
8. WHEN the last slot is filled with no Key hint shown and total mistakes within `cleanMistakeThreshold`, THE App SHALL resolve the ghost as `clean`; WHEN the last slot is filled after any Key hint or with more mistakes, THE App SHALL resolve it as `struggled`; in both cases THE App SHALL show the completed character in ink and the full code.
9. THE App SHALL provide a clearly labelled "Give up" control; WHEN the player activates it, THE App SHALL stop accepting key entries, show the full code in the slots, play the character's stroke-order animation from the dataset's stroke data, and resolve the ghost as `gave-up`.
10. THE App SHALL resolve each ghost exactly once, and SHALL ignore key entries and Give up after the ghost is resolved.
11. THE thresholds SHALL come only from the ghost-game-core engine config; feedback SHALL use text or icons as well as colour; and every control SHALL be operable by keyboard.
12. THE input and outcome logic (matching a key entry to the code, counting mistakes, triggering the Key hint, classifying the Outcome) SHALL be a pure function in `app/src/engine/` with no I/O and no reliance on ambient time.

---

### Requirement 6: Structure Hint in Write Mode

**User Story:** As a player who is stuck in Write mode, I want to see how the character is laid out and what it is made of, without seeing the character itself, so that I can rebuild it from its parts.

#### Acceptance Criteria

1. WHILE a Write-mode ghost is unresolved AND no Stroke hint has been shown for it, THE App SHALL offer a clearly labelled "Reveal its shape" control for a character that is Eligible for the structure hint.
2. WHEN the character is not Eligible for the structure hint, THE App SHALL NOT offer an active "Reveal its shape" control and SHALL say that this ghost's shape cannot be revealed.
3. WHEN the player activates "Reveal its shape", THE App SHALL show the character's layout as nested boxes following its IDS decomposition, supporting every Ideographic Description Character used in the data (including ⿲ and ⿳ with three parts and ⿻ for overlapping parts), and SHALL label each leaf box with its component; the layout SHALL never show the target character.
4. WHEN "Reveal its shape" has been used for a ghost, THE App SHALL treat that ghost as having had a hint, so that completing it SHALL resolve as `struggled`, never `clean`; the revealed layout SHALL stay visible until the ghost is resolved.
5. WHEN a Stroke hint is shown, THE App SHALL withdraw the "Reveal its shape" control for that ghost.
6. THE conversion from an IDS decomposition to a box layout SHALL be a pure function in `app/src/engine/`; the layout's leaves, in reading order, SHALL be exactly the leaf codepoints of the IDS string in order (repeats allowed), and removing repeats from them (keeping first occurrences) SHALL give exactly `decomposition.components`.
7. THE App SHALL use system fonts only (no bundled font); components in the CJK Radicals Supplement block (in the current data: ⺊ ⺍ ⺌ ⺮ ⺼) depend on the device's fonts, and rendering on target devices is checked in a later spec (Spec 5).
8. THE App SHALL offer "Reveal its shape" only in Write mode and SHALL NOT offer it in Cangjie mode.

---

### Requirement 7: Never Revealing the Target Character

**User Story:** As a player, I want the game never to show me the character I am trying to recall until the ghost is resolved, so that the challenge is real.

#### Acceptance Criteria

1. WHILE a ghost is unresolved in either Mode, THE App SHALL NOT render the target character in any text, attribute, accessible name, Code slot, key face, hint, layout box, or document title.
2. WHEN any string shown for an unresolved ghost would contain the target character, THE App SHALL replace each occurrence with "～" (U+FF5E), for display only, as GhostPrompt does.
3. WHILE the target character is itself the base shape of a key (in the current data: 一 中 人 十 口 大 女 山 手 日 月 木 水 火, each of whose codes is that single key), THE On-screen Cangjie keyboard SHALL show every key by its letter only, with no base shapes, so that no single key stands out.
4. THE Test_Suite SHALL include a test that renders every ghost in each Mode, in its unresolved state and after a Key hint or structure hint, and asserts that the target character appears nowhere in the DOM text or attributes.

---

### Requirement 8: Persistence and Schema

**User Story:** As a returning player, I want my Write and Cangjie progress and my "How Cangjie works" choice saved, so that nothing is lost when the saved-data format changes.

#### Acceptance Criteria

1. THE Storage module SHALL persist, in addition to ghost-game-core's data, whether "How Cangjie works" has been seen and the Cangjie-mode Review history.
2. THE Storage module SHALL raise `CURRENT_SCHEMA_VERSION` from 1 to 2; schema version 2 SHALL store `history: { write: ReviewHistory, cangjie: ReviewHistory }`; THE migration from version 1 SHALL move the existing history under `write`, keep `introSeen`, set `cangjie` to an empty history, and set "How Cangjie works" to not seen.
3. ALL other persisted-data rules of ghost-game-core Requirement 7 SHALL continue to apply: unknown or newer versions and corrupt data reset to defaults without migrating, and no storage failure crashes the App.

---

### Requirement 9: Quality and Testing

**User Story:** As a judge and developer, I want Cangjie mode held to the same standards as the rest of the game, so that it is trustworthy and works on every device.

#### Acceptance Criteria

1. THE feature SHALL use TypeScript `strict: true` with no `any`, keep game logic in `app/src/engine/` and UI in `app/src/components/` or `app/src/modes/`, run fully offline, and make no network request for Cangjie codes or stroke data at runtime.
2. THE property-based tests SHALL cover at least these cases: (1) entering exactly the code's keys in order fills every slot and completes the ghost, and no shorter sequence completes it; (2) the mistake count equals the number of wrong key entries; (3) the Key hint appears exactly when a slot has received the configured number of consecutive wrong entries, and the counter resets when the slot is filled; (4) Outcome classification in Cangjie mode matches ghost-game-core's rule for the same hint flag and mistake count; (5) nothing changes after resolution; (6) Z and non-letter keys never change the state (no slot filled, no mistake counted); (7) the IDS-to-layout function's leaves equal the leaf codepoints of the IDS string in order, removing repeats gives exactly `decomposition.components`, and the leaves never include the target character; and (8) masked display strings never contain the target character.
3. THE repository's root `npm test` SHALL keep running all existing character-dataset and ghost-game-core tests, changed only where this spec amends them, plus the new tests.
4. THE Cangjie mode SHALL be usable from 375 px phones to 1440 px+ laptops, with the physical keyboard on laptops and the On-screen Cangjie keyboard on touch devices.

---

## Amendments to other specs

This spec changes the following elsewhere. These amendments have been applied to those specs.

- **character-dataset**: Requirement 4.2, Requirement 4.11, Properties 4 and 10, the serialiser key order, the README licence summary, and the dataset id `unihan`.
- **ghost-game-core**: AC 5.5 and 5.6 ("no hint of any kind"); Requirement 7 (schema version 2 with per-Mode history); StartMenu AC 1.5 and 3.6 (controls); AC 6.12 (Learning order filtered for Cangjie mode).

Remaining steering note: product.md's principle "laptops get Build mode" and tech.md's device target "Laptop … Build mode is primary" are stale now that Cangjie Séance replaces Build mode. This spec treats Cangjie mode as the laptop/keyboard mode.

## Decisions

All approved by Takshil; no open questions remain.

1. Separate Review history per Mode (`write`, `cangjie`); schema version 2 with migration from version 1.
2. Single-key characters: letters-only on-screen keyboard while the target is itself a key's base shape (Requirement 7.3).
3. Code length is shown by the number of Code slots, by design.
4. X-prefixed codes: 别 and 错 are not Playable in Cangjie mode (excluded in the engine, stored verbatim in the data); 身 stays; the X key stays on the keyboard.
5. "How Cangjie works" makes only the four content-accuracy.md historical claims, with visible citations to the two English Wikipedia articles.
6. No manual hint button; the Key hint appears only after 3 consecutive wrong entries for the same slot.
7. Physical keyboard reads `KeyboardEvent.key`, accepts A–Y only, ignores Z, IME composition, and modified or repeated keys, and shows a note about system Chinese input methods.
8. "Reveal its shape" is offered only in Write mode.
9. System fonts only; radical rendering is checked in Spec 5.
10. The pinned Unihan file is committed under `data/raw/unihan/`; its SHA-256 and the zip's SHA-256 are recorded, and the committed file's hash is verified before use.
