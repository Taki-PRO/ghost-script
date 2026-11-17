# Requirements Document

## Introduction

The summon-ink feature makes the Summon step teach how a character is built. Today the character forms only after the whole Cangjie code is typed. With summon-ink, each correct key inks the strokes of the part that the key's base shape stands for (for example, typing A for 明 inks 日 on the paper, then B inks 月). Characters whose keys do not map to their parts ink only the parts that do, and the rest form when the code is complete.

The feature has five parts: (1) a deterministic classification, computed by the data pipeline and stored per character, that says how far the keys of each code line up with the character's parts: `transparent`, `partial` or `opaque`; (2) the Summon step inks strokes on each correct key; (3) honest wording for a correct key that inks nothing; (4) the Learning order puts transparent characters first, then partial, then opaque; (5) tests, including exactly one new property-based test for the classification rule. Outcomes, thresholds, the scheduler and saving do not change.

The feature builds on character-dataset, ghost-game-core, cangjie-seance and visual-identity, and amends parts of them (see "Amendments to other specs").

### Data facts this spec relies on

A read-only computation over the 300 records of `app/public/data/characters.json`, done with a throwaway script outside the repository while designing, gave these numbers under the rules below.

- Classes: **15 transparent**, **95 partial**, **190 opaque**. The transparent characters are 一 下 二 人 从 女 干 天 手 本 早 里 明 朋 果.
- The eight spot-checked characters (明 AB, 早 AJ, 天 MK, 果 WD, 里 WG, 本 DM, 下 MY, 干 MJ), checked with the cangjie-oracle tools for decomposition and code, are all transparent. 本 (`⿻木一`, strokes 0 to 3 in 木, stroke 4 in 一) and 干 (`⿱一十`, stroke 0 in 一, strokes 1 and 2 in 十) are transparent because every stroke maps to exactly one of their two components.
- Every `matches` path in the data points exactly at a leaf of the decomposition tree (0 paths point at an inner node or out of range). 18 characters have a nested decomposition, and 17 have paths of two or three indexes (89 strokes), so the first index alone cannot identify a component.
- 9 records are atomic (一 人 八 又 女 手 牛 而 身). Four of them (一 M, 人 O, 女 V, 手 Q) are themselves a key's base shape and are transparent. Five (八 HO, 又 NK, 牛 HQ, 而 MBLL, 身 HXH) have multi-key codes that no component can match and are opaque.
- 32 non-atomic records contain the placeholder `？` as a leaf. 33 non-atomic records have at least one `null` stroke match (95 strokes): 12 are partial and 21 are opaque; none is transparent.
- 13 records repeat a leaf shape (为 二 从 哥 多 朋 比 网 能 那 非 面 飞), so `components`, which is de-duplicated, cannot be used to match keys one for one.
- 40 records are partial or opaque where a listed component is a different character from every key's base shape: 6 partial and 34 opaque. This spec does not compare such shapes (no variant table; decision approved by the human). The numbers are a note for the human.
- In the 95 partial characters, 97 of 299 keys ink a part and 202 ink nothing. On average 44 percent of a partial character's strokes are inked by its keys.
- Of the 14 characters that are themselves a key's base shape (一 中 人 十 口 大 女 山 手 日 月 木 水 火), only 一 人 女 手 are transparent.

## Glossary

- **App**: The React + Vite single-page web application in `app/`.
- **Pipeline**: The data pipeline in `scripts/` that builds `characters.json`.
- **Dataset_Loader**: `loadDataset` in `app/src/data/charDataLoader.ts`, which validates `characters.json` in the App.
- **Test_Suite**: The Vitest tests run by the repository's root `npm test`.
- **E2E_Suite**: The Playwright tests in `e2e/`, run by `npm run test:e2e`.
- **Key_Table**: The table `CANGJIE_KEYS` of 25 entries, key letter and shape, with one definition in `app/src/engine/cangjieRules.ts`.
- **Base_Shape**: The shape of a key in the Key_Table. The key X has the face 難, which is a label of the on-screen key and not a Base_Shape; the key X has no Base_Shape.
- **IDS_Tree**: The tree parsed from a record's `decomposition.decomposition` string. The operators are U+2FF0 to U+2FFB; ⿲ (U+2FF2) and ⿳ (U+2FF3) take three operands and every other operator takes two. Every other code point, including `？`, is a leaf.
- **Component_Instance**: One leaf of the IDS_Tree, identified by its path (the child indexes from the root). Component_Instances are ordered left to right. For an atomic record, the single Component_Instance is the character itself.
- **Instance_Strokes**: The stroke indexes that belong to a Component_Instance: stroke `i` belongs to it when `decomposition.matches[i]` equals its path exactly. For an atomic record, Instance_Strokes are all stroke indexes.
- **Unattributed_Stroke**: A stroke that belongs to no Component_Instance: its match is `null`, or its path is not exactly the path of a leaf (an inner node, an index out of range, or a path too long).
- **Eligible_Instance**: A Component_Instance whose Instance_Strokes are not empty.
- **Key_Match**: The assignment of a code's keys to Eligible_Instances (Requirement 1).
- **Ink_Class**: One of `transparent`, `partial` or `opaque`.
- **Summon_Ink**: The field `summonInk` of a CharacterRecord: `{ class: 'opaque' }`, or `{ class: 'transparent' | 'partial', keyStrokes: number[][] }`.
- **Key_Strokes**: `keyStrokes[i]`, the ascending stroke indexes that the code's key number `i` (counted from 0) inks; an empty list when the key inks nothing.
- **Inkless_Key**: A correct key of a character whose Ink_Class is `partial` and whose Key_Strokes are empty.
- **Opaque_Note**: The one line of static plain text "This code uses shapes the game doesn't show yet." that the Summon_Step shows near the slots for a character whose Ink_Class is `opaque`.
- **Classifier**: The pure function `classifySummonInk` in `app/src/engine/summonInk.ts`.
- **Summon_Step**: The component `SummonStep` in `app/src/modes/SummonStep.tsx` (cangjie-seance Requirement 3).
- **Paper**: The `InkSurface` of the Summon_Step.
- **Ink_Writer**: The hanzi-writer instance that draws strokes on the Paper in the Summon_Step.
- **Learning_Order**: The deterministic order in which characters are introduced (ghost-game-core Requirement 6, AC 6.12), amended by Requirement 7.
- **Existing_Fields**: Every field of a CharacterRecord except `summonInk`.
- **Accuracy_Reviewer**: The custom agent `accuracy-reviewer` in `.kiro/agents/`.
- Terms not defined here (Séance, Ghost, Outcome, Summon step, Lay-to-rest step, Playable in Cangjie mode, Answer_Leak, Step result) have the meanings given in the cangjie-seance and ghost-game-core requirements.

---

## Requirements

### Requirement 1: The Classification Rule

**User Story:** As a developer, I want one deterministic rule that compares a code's keys with a character's parts, so that the game inks only what the data proves.

#### Acceptance Criteria

1. THE Classifier SHALL be a pure function that returns a Summon_Ink value computed only from a record's `cangjie`, `strokeCount`, `decomposition.decomposition`, `decomposition.matches`, `decomposition.atomic` and the Key_Table.
2. THE Key_Table SHALL have exactly one definition, in `app/src/engine/cangjieRules.ts`, and `app/src/engine/cangjie.ts` SHALL re-export it so that the Pipeline and the App use the same table.
3. WHEN a record is atomic, THE Classifier SHALL use the character itself as the single Component_Instance with every stroke index as its Instance_Strokes, and SHALL ignore `matches`.
4. WHEN a record is not atomic, THE Classifier SHALL parse `decomposition.decomposition` into an IDS_Tree and SHALL use its leaves, left to right, as the Component_Instances.
5. IF the decomposition string of a non-atomic record is not one complete well-formed IDS_Tree (an operand is missing or code points remain after the tree), THEN THE Classifier SHALL return class `opaque`.
6. WHEN a record is not atomic, THE Classifier SHALL assign stroke `i` to the leaf whose path equals `matches[i]` exactly, and SHALL treat every other stroke as an Unattributed_Stroke.
7. IF `matches` is `null` or its length differs from `strokeCount`, THEN THE Classifier SHALL treat every stroke of a non-atomic record as an Unattributed_Stroke.
8. THE Classifier SHALL assign keys to Eligible_Instances by walking the code's keys from left to right with a cursor that starts at the first Component_Instance: a key with a Base_Shape matches the first Eligible_Instance at or after the cursor whose leaf equals that Base_Shape, and the cursor then moves to the position after the matched instance.
9. WHEN a key has no Base_Shape (the key X) or no Eligible_Instance at or after the cursor has the key's Base_Shape, THE Classifier SHALL leave that key unmatched and SHALL leave the cursor where it was.
10. IF `cangjie` is `null` or an empty string, THEN THE Classifier SHALL return class `opaque`.
11. IF no key is matched, THEN THE Classifier SHALL return class `opaque`.
12. WHEN every key is matched and every stroke index belongs to a matched instance, THE Classifier SHALL return class `transparent`.
13. WHEN at least one key is matched and the conditions of AC 1.12 do not hold, THE Classifier SHALL return class `partial`.
14. WHEN the class is `transparent` or `partial`, THE Classifier SHALL return `keyStrokes` with exactly one entry per key of the code, each entry holding the ascending Instance_Strokes of the instance that key matched, or an empty list for an unmatched key.
15. WHEN the class is `opaque`, THE Classifier SHALL return an object holding the class only.
16. THE Classifier SHALL give the same result for the same input and SHALL NOT modify its input.
17. WHEN a record is atomic and its code is exactly one key whose Base_Shape is the character itself, THE Classifier SHALL return class `transparent` with `keyStrokes` holding one entry that lists every stroke index in ascending order.

---

### Requirement 2: The `summonInk` Field in the Dataset

**User Story:** As a developer, I want the classification computed by the Pipeline and stored per character, so that the App never recomputes it and no hand-written list exists.

#### Acceptance Criteria

1. THE Pipeline SHALL add to each CharacterRecord a field `summonInk` computed by the Classifier from that record's own data.
2. THE Pipeline SHALL NOT read any hand-written list of characters, shapes or classes to compute `summonInk`.
3. THE Pipeline SHALL serialise `summonInk` between `cangjie` and `sources`, with its own keys in the order `class`, `keyStrokes`.
4. THE Pipeline SHALL serialise every Existing_Field of every record exactly as before this feature, and SHALL NOT add a key to `sources`.
5. THE Pipeline SHALL stay deterministic: identical inputs SHALL produce a byte-identical `characters.json`.
6. WHEN the build succeeds, THE Pipeline SHALL state in its success summary the number of transparent, partial and opaque characters, and the three numbers SHALL add up to the number of records.
7. THE shared type documentation for `summonInk` and the README "Data and licences" section SHALL state that the field is derived from `decomposition` (Make Me a Hanzi), `cangjie` (Unihan) and the Key_Table, and that it adds no dataset and no licence.
8. THE file `characters.json` SHALL be produced only by `npm run build:data` and SHALL NOT be edited by hand.

---

### Requirement 3: Types and Loader Validation

**User Story:** As a developer, I want the field typed and validated at the JSON boundary, so that a damaged dataset cannot ink wrong strokes.

#### Acceptance Criteria

1. THE shared types in `app/src/data/types.ts` SHALL define `SummonInkClass`, `SummonInk` and a required `summonInk` field on CharacterRecord.
2. THE Dataset_Loader SHALL accept a record whose `summonInk` is valid for that record's `cangjie` and `strokeCount`.
3. IF a record has no `summonInk`, or its class is not one of the three Ink_Classes, THEN THE Dataset_Loader SHALL return `{ ok: false, reason: 'invalid-shape' }`.
4. IF a record's class is `opaque` and it has `keyStrokes`, THEN THE Dataset_Loader SHALL return `invalid-shape`.
5. IF a record's class is `transparent` or `partial` and `keyStrokes` is missing, is not an array of arrays of integers, has a length different from the code's length, or the record's `cangjie` is `null`, THEN THE Dataset_Loader SHALL return `invalid-shape`.
6. IF a stroke index in `keyStrokes` is not an integer from 0 to `strokeCount` minus 1, is not ascending within its key, or appears under two keys, THEN THE Dataset_Loader SHALL return `invalid-shape`.
7. IF a record's class is `transparent` and the union of its `keyStrokes` is not every stroke index, or its class is `partial` and every entry is empty, THEN THE Dataset_Loader SHALL return `invalid-shape`.
8. THE validation of AC 3.3 to 3.7 SHALL be one exported pure function in `app/src/engine/summonInk.ts` that the Dataset_Loader calls.

---

### Requirement 4: Inking Strokes in the Summon Step

**User Story:** As a player, I want each correct key to draw the part of the character that the key stands for, so that I see how the character is built.

#### Acceptance Criteria

1. WHEN the Summon_Step starts for a record whose class is `transparent` or `partial`, THE Summon_Step SHALL create the Ink_Writer on the Paper with no stroke visible.
2. WHEN the player enters a correct key for such a record, THE Summon_Step SHALL ink every stroke in that key's Key_Strokes on the Paper and SHALL keep the strokes already inked.
3. WHEN a correct key's Key_Strokes are empty, THE Summon_Step SHALL ink nothing for that key.
4. WHEN the player enters a wrong key, THE Summon_Step SHALL leave the Paper unchanged.
5. WHILE a record's class is `opaque`, THE Summon_Step SHALL create no Ink_Writer until the code is complete or the player gives up, as before this feature.
6. WHEN the player enters keys faster than the strokes can be drawn, THE Summon_Step SHALL draw the strokes one at a time in key order, and every stroke SHALL be drawn.
7. WHEN the code is complete for such a record, THE Summon_Step SHALL form every stroke that is not yet inked, in ascending stroke order, keep the inked strokes, hold the character for `SUMMON_HOLD_MS`, fade it for `SUMMON_FADE_MS`, remove it from the page and then call `onDone` once with the Step result. *(Amended (approved by the human): see ink-and-candlelight Requirement 17.5 (Q12b): the hold and fade stay at `SUMMON_HOLD_MS` and `SUMMON_FADE_MS`, unchanged))*
8. WHEN the player gives up for such a record, THE Summon_Step SHALL show the full code as before, SHALL NOT ink the Key_Strokes of keys that were not typed on their own, and SHALL form every stroke that is not yet inked as in AC 4.7.
9. WHERE the player's system requests reduced motion, THE Summon_Step SHALL draw each ink and forming stroke without a drawing animation, each within one animation frame, and SHALL replace the fade as cangjie-seance AC 2.5 requires.
10. IF the Ink_Writer cannot be created or a stroke animation fails, THEN THE Summon_Step SHALL keep accepting keys without ink and SHALL form the character with the existing plain-text fallback, with the same hold and fade.
11. WHEN the Summon_Step unmounts, THE Summon_Step SHALL stop drawing, SHALL clear its timers, SHALL empty the Paper and SHALL NOT call `onDone` afterwards.
12. THE Summon_Step SHALL compute mistakes, the Key hint and the Step result exactly as before this feature, independent of the Ink_Class.
13. THE Summon_Step SHALL keep the Paper size from `summonPaperSize` and SHALL fit on one screen at 1024 by 768 and at 375 by 812 pixels.

---

### Requirement 5: Honest Wording for Keys That Ink Nothing

**User Story:** As a player, I want the game to say when a key's shape is not shown, so that I do not think the game has a fault or that the key was wrong.

#### Acceptance Criteria

1. WHEN the player enters an Inkless_Key, THE Summon_Step SHALL show the text "This key's shape is one the game doesn't show yet." in the status line (the element with `role="status"` and `aria-live="polite"`), together with the existing accepted-key text.
2. THE Summon_Step SHALL replace that text on the player's next key press.
3. WHEN the key is wrong, or the record's class is `transparent` or `opaque`, or the correct key inks strokes, THE Summon_Step SHALL NOT show the text of AC 5.1.
4. WHILE the record's class is `opaque` and the code is neither complete nor given up, THE Summon_Step SHALL show the Opaque_Note as static text near the slots, from the start of the Summon_Step, and SHALL show nothing per key.
5. THE Opaque_Note SHALL be plain text in an element with no `role` and no `aria-live` attribute, outside the status line, so that assistive technology does not announce it again on a key press.
6. WHILE the record's class is `transparent`, THE Summon_Step SHALL show neither the text of AC 5.1 nor the Opaque_Note, and WHILE the record's class is `partial`, THE Summon_Step SHALL NOT show the Opaque_Note.
7. THE guide "How Cangjie works" SHALL keep the sentence "Each key stands for a family of related shapes. Only the base shape of the family is shown on the key."
8. THE Summon_Step SHALL stay within its one-screen layout at 375 by 812 pixels when it shows the text of AC 5.1 and when it shows the Opaque_Note.
9. WHEN this feature adds or changes text shown in the App, the README or a spec, including the text of AC 5.1 and the Opaque_Note, THE Accuracy_Reviewer SHALL review that text before the final checkpoint.

---

### Requirement 6: Never-Reveal Boundary

**User Story:** As a player, I want the character to stay hidden until I have earned it, even while parts of it appear.

#### Acceptance Criteria

1. WHILE the Summon step's code is neither complete nor given up, THE App SHALL NOT render the target character as text, in an attribute, in an accessible name or in the document title (cangjie-seance AC 5.1), and stroke paths SHALL be the only form in which parts of the character appear; paths of strokes not yet inked MAY be present in the document at zero opacity.
2. WHEN the Summon_Step calls `onDone`, THE Paper SHALL contain no stroke path.
3. WHILE the Lay-to-rest step is active, THE App SHALL NOT make the target character visible anywhere on the page (cangjie-seance AC 5.5).
4. THE file `.kiro/steering/content-accuracy.md` SHALL list, under "What is not an answer leak", the parts drawn during the Summon step as designed and approved by the human.

---

### Requirement 7: Learning Order

**User Story:** As a player, I want to meet the characters whose keys show their parts first, so that the idea is clear before the harder cases.

#### Acceptance Criteria

1. THE function `learningOrder` SHALL sort the dataset's characters by Ink_Class (`transparent`, then `partial`, then `opaque`), then by `strokeCount` ascending, then by Unicode code point ascending.
2. IF a record has no valid `summonInk`, THEN `learningOrder` SHALL rank it as `opaque`, and IF a record's `strokeCount` is not a finite number, THEN `learningOrder` SHALL sort it after all finite counts within its class.
3. THE function `learningOrder` SHALL return a permutation of the dataset's keys, SHALL return the same result for the same data regardless of the Map's insertion order, and SHALL NOT modify its input.
4. WHEN `learningOrder` is applied to the real dataset, THE result SHALL list all transparent characters first, then all partial characters, then all opaque characters.
5. THE App SHALL keep passing `learningOrder(dataset)` to `selectSession` unchanged, so that new characters are introduced in the new order, and the Graveyard SHALL list characters in the same order.
6. THE guide example `pickGuideExample` SHALL keep choosing the last Playable character with a code of two or three keys in the Learning_Order, and that character SHALL be at position 30 or later.
7. THE saved-data schema version, the Review history keys and the Storage module SHALL stay unchanged.

---

### Requirement 8: No Game-Rule Changes

**User Story:** As a maintainer, I want this feature to change what the player sees and the order of new ghosts only, so that scoring and scheduling stay trusted.

#### Acceptance Criteria

1. THE feature SHALL NOT change `app/src/engine/config.ts`, `app/src/engine/scheduler.ts`, `app/src/engine/outcome.ts` or `app/src/storage/`.
2. THE feature SHALL keep `SUMMON_HOLD_MS` at 1500 and `SUMMON_FADE_MS` at 1500, each defined once in `app/src/modes/SummonStep.tsx`. *(Amended (approved by the human): see ink-and-candlelight Requirement 17.5 (Q12b): unchanged, exempt from the Motion_Window))*
3. THE feature SHALL keep every Existing_Field of `characters.json` byte-identical, and until the final checkpoint the Test_Suite SHALL compare each record's Existing_Fields with a recorded checksum made from the committed file before this feature.
4. WHEN the final checkpoint runs `git diff` on `app/public/data/characters.json`, THE diff SHALL contain added lines only.
5. WHEN the existing-fields check has passed at the final checkpoint, THE final checkpoint SHALL delete the checksum fixture, the test that reads it and the provenance paragraph that describes it.

---

### Requirement 9: Tests

**User Story:** As a developer, I want the rule and the behaviour proven by tests, so that the data and the ink cannot drift apart.

#### Acceptance Criteria

1. THE Test_Suite SHALL include unit tests of the Classifier with hand-built records for: an atomic record, a nested path, a repeated shape matched in order, a `null` stroke, a `？` placeholder leaf, the key X, keys in a different order from the leaves, a path that points at an inner node, a `matches` array of the wrong length, an empty code, a `null` code and a malformed decomposition string, and for the atomic cases of AC 1.17: an atomic character whose single key's Base_Shape is the character (一 with M) is `transparent`, and an atomic character with a multi-key code (八 with HO) is `opaque`.
2. THE Test_Suite SHALL include exactly one new property-based test, written with fast-check, for the classification rule (design Property 1), whose generator produces atomic records with a single key equal to the character's own Base_Shape.
3. THE Test_Suite SHALL include an exhaustive unit test over all 300 records that the stored `summonInk` equals the Classifier's result recomputed from the record, that every leaf of a non-atomic record is either listed in `decomposition.components` or `？`, and that the three class counts add up to 300.
4. THE Test_Suite SHALL include a spot-check test for 明 早 天 果 里 本 下 干 that reads each code, component list and stroke mapping from the dataset and checks class `transparent`, the key-to-component order and a partition of the strokes.
5. THE Test_Suite SHALL include the existing-fields check of AC 8.3 until the final checkpoint deletes it (AC 8.5).
6. THE Test_Suite SHALL include component tests of the Summon_Step with a mocked hanzi-writer for Requirements 4 to 6, and one integration test with the real hanzi-writer in jsdom that shows sequential `animateStroke` calls keep earlier strokes visible and a call made while another runs cancels the earlier one.
7. THE E2E_Suite SHALL include a test that, after the first correct key for 明, the Paper holds at least one visible stroke path, reaching 明 by seeding the saved Review history through the existing `seed` helper and without a backdoor in the App. *(Amended (approved by the human): see first-meeting Requirement 1: the ghost reached by seeding history now meets a First_Meeting ghost, so its Faint_Code is visible while the ink is drawn; the ink behaviour this test checks is unchanged)*
8. THE E2E_Suite SHALL check that the Summon step still fits one screen at 1024 by 768 and at 375 by 812 pixels, including after an ink stroke is drawn.
9. THE Test_Suite SHALL update the existing tests listed in the design so that all of them pass.

---

### Requirement 10: Steering, Amendments and Review

**User Story:** As a maintainer, I want the rules and specs that this feature changes updated and reviewed, so that the repository stays consistent for judging.

#### Acceptance Criteria

1. THE file `.kiro/steering/tech.md` SHALL state that the decision of no new property-based tests has one exception, the summon-ink classification test, approved by the human.
2. THE spec documents named in "Amendments to other specs" SHALL carry an "Amended (approved by the human)" note for each change.
3. THE final checkpoint SHALL run `npm test`, `tsc --noEmit` for the root project, `app/` and `oracle/`, `npm run build:data` twice with identical output, the existing-fields check (then deleted as AC 8.5 requires), `npm run build -w app`, `npm run check:bundle` and `npm run test:e2e`, and all SHALL pass.
4. THE repository SHALL NOT contain a personal name in any file this feature adds or changes, and approvals SHALL be written as "approved by the human".

---

## Amendments to other specs

These changes are approved by the human and are applied by the tasks of this spec.

### ghost-game-core

- Requirements: AC 6.12 and the Glossary entry "Learning order" change from "strokeCount ascending, ties by code point" to "Ink_Class first, then strokeCount, then code point" (Requirement 7 above).
- Design: the `learningOrder` section, the architecture node label, Property 12 and the `learningOrder` rows of the Testing Strategy follow the new sort key.
- Tasks: the text of tasks 5.8 to 5.10 is left as history; a note points at this spec.

### cangjie-seance

- Design: the sentence "No hanzi-writer instance exists before this moment" and the Summon step "Forming and fading" paragraph change: for `transparent` and `partial` characters the Ink_Writer exists from the start of the step (Requirement 4).
- Requirements: AC 2.4 and AC 5.1 get a note that strokes drawn during typing are allowed and that no character text or attribute appears.
- Decision D10 gets a note that the hold and fade constants are unchanged.

### character-dataset

- Requirements and design: the record schema, the serialiser key order and Properties 4 and 10 note the new field `summonInk` between `cangjie` and `sources`; Property 10 (the `sources` keys) is unchanged.

### Steering

- `tech.md`: the single property-test exception (Requirement 10.1). `content-accuracy.md`: the not-an-answer-leak entry (Requirement 6.4) and a note on derived fields (Requirement 2.7). Both are tasks of this spec.
