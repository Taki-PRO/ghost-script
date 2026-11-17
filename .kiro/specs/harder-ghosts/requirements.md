# Requirements Document

## Introduction

The game has 300 characters, the HSK 3.0 writing level 1 list. A player with character amnesia can already write most of them, so the game has little to teach that player. The harder-ghosts feature adds the HSK 3.0 writing level 2 list (400 characters) and writing level 3 list (500 characters), and lets the player choose where to start.

The feature has three parts:

1. **Data.** The existing character-dataset pipeline builds two more datasets from the same sources and licences. The 300 existing records and their human-reviewed prompts stay byte-identical. The new prompts come from the existing default and override rule and are marked as not yet human-reviewed.
2. **Loading.** The data is split by level. Level 1 loads as today. Level 2 and level 3 load only when needed, so the first load does not get heavier.
3. **Play.** After the intro on a first run, one screen asks where to start (level 1, 2 or 3). The choice can be changed from the start menu and never deletes history. Ghosts that are due return whatever their level. The Graveyard shows the chosen level and can show the others. The save moves to schema version 3 with a tested migration.

### Facts this spec relies on

These were verified on the day this spec was written, read-only, against the pinned upstream file and the files in `data/raw/`. The Source_Check task (Requirement 1) repeats them before any other work.

- The pinned file `hsk30-chars.csv` (commit `4ff9e3915ce87baaecd7ebe263085573a4ea3192` of `ivankra/hsk30`, 3,001 lines, 108,366 bytes, SHA-256 `8c5957108e6dafd120be10518a827a4d834ea3ce29acbfedeff1022cd7d05280`) has 300 rows with `WritingLevel` 1, 400 with `WritingLevel` 2 and 500 with `WritingLevel` 3. The other 1,800 rows have an empty `WritingLevel`. The 300 level 1 rows equal `data/character-list.txt` in content and in row order. No character is in two levels. Every character is one CJK codepoint in U+4E00 to U+9FFF.
- `data/raw/hsk30/` holds only the licence file. The CSV is not committed. The committed `data/character-list.txt` was derived from it.
- Every level 2 and level 3 character exists in hanzi-writer-data, in Make Me a Hanzi `dictionary.txt`, in CC-CEDICT (as a simplified headword) and in Unihan `kCangjie` with exactly one value that matches `^[A-Y]{1,5}$`. Nothing is missing from any source. Every one has at least one CC-CEDICT gloss the default prompt rule accepts.
- The real pipeline (`buildDataset`), run in memory on the two new lists without writing any file, succeeds: level 2 is 2,508,739 bytes (511,365 bytes gzip level 9) and level 3 is 3,284,451 bytes (663,356 bytes gzip level 9). The level 1 file is 1,718,328 bytes (about 353,000 bytes gzip).
- Characters that are not Playable in Cangjie mode (their code starts with X) skip the Summon step, as 别 and 错 do today. Level 2 has four: 广 换 压 灭. Level 3 has nine: 历 内 敌 锻 镜 宽 亏 杀 贡. Level 1 has two. No new character lacks a code.
- The summon-ink classes would be, for level 2, 9 transparent, 116 partial and 275 opaque, and for level 3, 7 transparent, 140 partial and 353 opaque.
- The source font (LXGW WenKai v1.530) has a glyph for every level 2 and level 3 character. The current font subset (66,532 bytes, 321 glyphs) does not. Level 2 needs 395 new glyphs and level 3 needs 496. The subset costs about 207 bytes per glyph.
- The counted bundle is 208,748 bytes gzip against a budget of 300,000. `data/characters.json` is excluded from the count today.
- Today `App` loads `characters.json` before showing any screen, `learningOrder(dataset)` is computed over the whole dataset in `App`, `Graveyard` and `CangjieGuide`, the intro's "Begin the Séance" starts a séance directly, and the save is schema version 2 with no migration shipped.

Out of scope: traditional characters, Cantonese, the Exam Crypt mode, any change to the scheduler, outcomes, thresholds or the rite constants, new fonts, minifying the level 1 file, accounts or sync, handwriting recognition beyond per-stroke checking, and property-based tests (decision of Nov 15).

## Glossary

- **App**: The React + Vite single-page application in `app/`.
- **Pipeline**: The scripts under `scripts/` that build the datasets (`npm run build:data`).
- **Level**: One of 1, 2 or 3, the HSK 3.0 writing level a character belongs to in the pinned CSV column `WritingLevel`.
- **Level_List**: A file of characters of one level, one per line, with a `#` header: `data/character-list.txt` (level 1, unchanged), `data/character-list-level2.txt`, `data/character-list-level3.txt`.
- **Level_Dataset**: The generated JSON file of one level: `app/public/data/characters.json` (level 1, kept under its current name), `app/public/data/characters-level2.json`, `app/public/data/characters-level3.json`.
- **Level_Manifest**: The small generated file `app/public/data/levels.json` with, for each level, its file name, character count, average stroke count and example meanings.
- **Example_Meaning**: An English meaning chosen by the Pipeline from a level's own records for the Level_Screen (Requirement 5.2).
- **Source_Check**: The first task of this feature, which verifies that every level 2 and level 3 character exists in every source.
- **Pinned_CSV**: `hsk30-chars.csv` at commit `4ff9e3915ce87baaecd7ebe263085573a4ea3192` of `ivankra/hsk30`.
- **Playable**: A character whose Cangjie code is non-null and does not start with X (cangjie-seance).
- **Unreviewed_Prompt**: A level 2 or level 3 record whose `prompt` no human has reviewed. Its record carries `promptReview: "unreviewed"`.
- **Review_File**: A generated CSV with columns `character,chosenMeaning,chosenPinyin,source,reviewedBy,alternatives`, in the format of `data/prompt-review.csv`.
- **Approvals_File**: `data/prompt-approvals.csv`, written only by the human, with columns `character,reviewedBy`. It records that a human reviewed the default prompt of a character and accepted it.
- **Chosen_Level**: The Level saved as the player's starting level.
- **Level_Screen**: The screen that asks where to start.
- **Start_Menu**: The component `StartMenu`.
- **Graveyard**: The component `Graveyard`.
- **Learning_Order**: `learningOrder(dataset)` (class, stroke count, codepoint) over the records of one level.
- **Session_Pool**: The list of characters passed to `selectSession`: the Chosen_Level's Learning_Order followed by every character with a Review entry that belongs to another level.
- **Finished_Level**: A level whose every character has an entry in the Review_History.
- **Review_History**: The saved map from character to Review entry (ghost-game-core).
- **Brand_New_Player**: A player whose Review_History has no entry at all (first-meeting).
- **Walkthrough_Ghost**: The ghost `pickWalkthroughGhost` picks (first-meeting); 明 in the current data, a level 1 character.
- **Save**: The blob in `localStorage` under `ghost-script:state`, read and written only by the Storage module.
- **Never_Reveal**: The rule that a ghost's character is not rendered as text, in an attribute, in an accessible name or in the document title before the ghost's rite has run its course.
- **Primary_Action**: The one seal-red button of a screen (art-direction.md).
- **Bundle_Budget**: 300,000 bytes of gzip, counted by `npm run check:bundle`.
- **Test_Suite**: The Vitest tests run by `npm test`.
- **E2E_Suite**: The Playwright tests under `e2e/`, run by `npm run test:e2e`.
- **Viewport_Set**: 1024 × 768, 375 × 812 and 320 × 640 CSS pixels.
- Terms not defined here (Ghost, Séance, Rite, Summon step, Lay-to-rest step, summon-ink class, Review entry) have the meanings given in ghost-game-core, cangjie-seance, first-meeting and summon-ink.

---

## Requirements

### Requirement 1: Verify the Sources Before Any Other Work

**User Story:** As the maintainer, I want the sources checked for levels 2 and 3 first, so that the plan stops for my decision if a source lacks a level or a character instead of working around it.

#### Acceptance Criteria

1. THE Source_Check SHALL be the first task executed and no other task SHALL start before it passes.
2. THE Source_Check SHALL read the Pinned_CSV and report, for each Level, the number of rows with that `WritingLevel`.
3. THE Source_Check SHALL report, for every character of level 2 and level 3, whether it exists in hanzi-writer-data, in Make Me a Hanzi `dictionary.txt`, in CC-CEDICT as a simplified headword and in Unihan `kCangjie`, whether its `kCangjie` has exactly one value matching `^[A-Y]{1,5}$`, whether the default prompt rule yields a prompt, and whether the source font has a glyph.
4. THE Source_Check SHALL report the characters that are not Playable, per level, and the summon-ink class counts, per level.
5. IF the Pinned_CSV has no rows for a Level, OR a character is missing from any source, OR a `kCangjie` value is multiple or malformed, OR the default prompt rule yields no prompt, OR the source font has no glyph, THEN THE Source_Check SHALL stop the plan, write to the human the Level, the character, the source and exactly what is missing, and wait for the human's decision.
6. THE Source_Check SHALL NOT replace a missing character, drop it silently, take its data from another source or generate any value.
7. WHEN the Source_Check finds nothing missing, THE Source_Check SHALL report the per-level counts (400 and 500 expected) and the lists of characters that are not Playable, and the plan SHALL continue.

---

### Requirement 2: Level Lists From the Pinned Source

**User Story:** As the maintainer, I want the level 2 and level 3 lists to be reproducible from the pinned source, so that nobody has to trust a hand-typed list.

#### Acceptance Criteria

1. THE repository SHALL contain `data/raw/hsk30/hsk30-chars.csv`, byte-identical to the Pinned_CSV, next to the existing `data/raw/hsk30/LICENSE`.
2. THE file `data/raw/SOURCES.md` SHALL record for the Pinned_CSV the commit, the file name, the byte size, the SHA-256 and the licence (MIT), under the existing HSK 3.0 section, and SHALL state that the section now covers writing levels 1, 2 and 3.
3. THE repository SHALL contain `data/character-list-level2.txt` with exactly 400 characters and `data/character-list-level3.txt` with exactly 500 characters, one per line, in the row order of the Pinned_CSV, each starting with `#` header lines in the form of `data/character-list.txt` that name the source, the file, the rule `WritingLevel == 2` (or `== 3`), the commit, the licence and the original standard.
4. THE file `data/character-list.txt` SHALL remain byte-identical to its content before this feature.
5. WHEN the Test_Suite runs, THE Test_Suite SHALL assert that each Level_List equals the Pinned_CSV rows of its level in row order, that the three lists share no character, and that every character is one codepoint in U+4E00 to U+9FFF.
6. WHEN the Test_Suite runs, THE Test_Suite SHALL assert that the SHA-256 of the committed CSV equals the value recorded in `data/raw/SOURCES.md`.
7. THE existing bounds test of `data/character-list.txt` (280 to 320 entries) SHALL stay and SHALL apply to level 1 only; a new test SHALL assert exactly 400 and exactly 500 entries for the two new lists.

---

### Requirement 3: Level Datasets Through the Existing Pipeline

**User Story:** As the maintainer, I want the new characters built by the same pipeline from the same sources, so that every field is traceable and every existing data check holds.

#### Acceptance Criteria

1. WHEN `npm run build:data` runs, THE Pipeline SHALL build one Level_Dataset per Level from its Level_List, using the same parsers, the same merge, the same record schema and the same `sources` keys for all three.
2. THE Pipeline SHALL take every field of every new record from its source: `pinyin` and `meanings` from CC-CEDICT, `strokeCount` and `strokeData` from hanzi-writer-data, `decomposition` from Make Me a Hanzi, `cangjie` verbatim from Unihan `kCangjie`; no value SHALL be generated or inferred by an AI model.
3. THE Pipeline SHALL apply the same exclusion rule to every Level: a character whose `cangjie` is null or starts with X stays in its Level_Dataset and skips the Summon step in play, and THE Pipeline SHALL print, for each Level, the characters that are not Playable and the characters without a code.
4. THE Pipeline SHALL set `summonInk` on every new record with the existing `classifySummonInk` rule and SHALL print the class counts per Level.
5. IF any Level has a per-character failure (missing field, prompt-selection failure, override error, bad Cangjie value), THEN THE Pipeline SHALL process every character of every Level, report all failures grouped by Level, exit non-zero and write no output file for any Level.
6. WHEN every Level succeeds, THE Pipeline SHALL write the three Level_Datasets, the Level_Manifest and the Review_Files, each atomically, and SHALL print for each written data file its path, record count, raw bytes and gzip bytes (level 9).
7. WHEN the Pipeline runs twice with identical inputs, THE Pipeline SHALL produce byte-for-byte identical output files.
8. THE Level_Datasets SHALL have no character in common, and each key SHALL equal its record's `character`.
9. WHEN the Pipeline has run, THE content of `app/public/data/characters.json` SHALL equal its content before this feature, and a Test_Suite test SHALL hold the SHA-256 of that file and of `data/prompt-review.csv` as they were before this feature and fail when either differs.
10. THE existing dataset tests (property tests included) SHALL keep passing unchanged on the level 1 file, and new plain unit tests SHALL run over all three Level_Datasets and assert: the record counts 300, 400 and 500; every required field present; every component valid; every `cangjie` equal to the verbatim Unihan value and `sources.cangjie` correct; the Playable and not-Playable characters named in the Facts; every `summonInk` valid for its record; and the Level_Datasets and Level_Lists agree character for character.
11. THE data check (`npm run check:data`) SHALL keep running the build and `test:data`, and SHALL fail when any Level fails.

---

### Requirement 4: Prompts for the New Characters

**User Story:** As the maintainer, I want the new prompts produced by the same rule and marked as unreviewed, so that a human can review them and nobody mistakes them for the 300 reviewed ones.

#### Acceptance Criteria

1. THE Pipeline SHALL choose each new prompt with the existing `selectPrompt` rule (default walk over CC-CEDICT entries in source order, with the skipped prefixes and proper-noun rule), or with a human override by index, and SHALL NOT use an AI model for any prompt.
2. THE Pipeline SHALL read overrides for level 2 from `data/prompt-overrides-level2.csv` and for level 3 from `data/prompt-overrides-level3.csv`, with the columns, validation and index-only semantics of `data/prompt-overrides.csv`, and SHALL treat an absent file as no overrides.
3. THE Pipeline SHALL read approvals from `data/prompt-approvals.csv` when it exists, and SHALL reject a row whose `character` is not in a Level_List or whose `reviewedBy` is empty.
4. WHEN a level 2 or level 3 character has an override row or an approval row, THE Pipeline SHALL set `promptReview` to `"reviewed"` on its record; OTHERWISE THE Pipeline SHALL set `promptReview` to `"unreviewed"`.
5. THE Pipeline SHALL NOT add `promptReview` to any level 1 record.
6. THE Pipeline SHALL write `data/prompt-review-level2.csv` and `data/prompt-review-level3.csv` in the format of `data/prompt-review.csv` (same header, one row per character in Level_List order, the same `alternatives` rendering), and SHALL fill `reviewedBy` from the override or approval row when one exists; AND THE Pipeline SHALL keep writing `data/prompt-review.csv` for level 1 with content identical to today.
7. THE character data loader SHALL accept a record with no `promptReview` or with `promptReview` equal to `"reviewed"` or `"unreviewed"`, and SHALL reject any other value.
8. THE tasks of this feature SHALL NOT add rows to any overrides file or to the Approvals_File; reviewing the Review_Files and writing those rows SHALL be a human task.
9. THE Test_Suite SHALL assert that every level 2 and level 3 `prompt.meaning` is one of the record's own CC-CEDICT `meanings` (after the permitted `(bound form) ` strip) and that every `prompt.pinyin` is the tone-mark form of one of its own readings, from the same entry (existing Requirement 6 of character-dataset, applied to all levels).

---

### Requirement 5: Split Loading and Level Weights

**User Story:** As a player, I want the first load to be no heavier than today, so that the extra levels cost nothing until I choose them.

#### Acceptance Criteria

1. THE Pipeline SHALL write the Level_Manifest with, for each Level, the fields `level`, `file`, `count`, `averageStrokes` (mean of `strokeCount`, one decimal) and `exampleMeanings` (an array of three Example_Meanings), all derived from that Level's records.
2. THE Pipeline SHALL choose the Example_Meanings of a Level deterministically: take the records at positions ⌊n/4⌋, ⌊n/2⌋ and ⌊3n/4⌋ of the Level's Learning_Order and, for each, the first record at or after that position whose `cleanupMeaning(prompt.meaning)` is at most 24 characters long and contains only letters, spaces and hyphens, skipping any record already chosen; THE Example_Meaning SHALL be that cleaned meaning.
3. WHEN the App starts, THE App SHALL load the level 1 file, THEN SHALL load the Chosen_Level's file when it is not level 1, THEN, WHILE the Review_History has a character with no record in any loaded Level_Dataset, SHALL load the next unloaded Level in ascending order.
4. WHEN the Save has Chosen_Level 1 and a Review_History of level 1 characters only, THE App SHALL request on first load exactly the files it requests today and SHALL NOT request the Level_Manifest or any other Level_Dataset.
5. THE App SHALL request the Level_Manifest only when it shows the Level_Screen.
6. WHEN the player chooses or opens a Level whose Level_Dataset is not loaded, THE App SHALL request that file once, SHALL show a status message while it loads, and SHALL keep the loaded data for the rest of the page session.
7. IF a Level_Dataset request fails, OR the response is not valid JSON, OR a record fails validation, THEN THE App SHALL treat that Level as not loaded and SHALL show the message for that screen (Requirements 6.6 and 10.5); IF the failure happens during the start-up load of Requirement 5.3, THEN THE App SHALL show the existing error screen.
8. THE data loader SHALL validate each Level_Dataset with the same record checks it applies to level 1 and SHALL validate the Level_Manifest shape (three levels in order, counts as positive integers, three non-empty strings per level).
9. THE bundle check SHALL keep the Bundle_Budget at 300,000 bytes, SHALL keep counting every file the first load fetches, SHALL list but not count the Level_Datasets and the lazy level font files (Requirement 13) with their gzip bytes, and SHALL fail when the counted total is over the budget.
10. THE design SHALL state the expected raw and gzip bytes of each Level_Dataset, of the Level_Manifest and of each level font file, and THE Pipeline and the font build SHALL report the actual bytes after each build.

---

### Requirement 6: Choose Where to Start

**User Story:** As a player who has just read the intro, I want to say where I want to start, so that I am not made to write characters I already know.

#### Acceptance Criteria

1. WHEN the player activates "Begin the Séance" on the intro AND the Save has `levelChosen` false, THE App SHALL show the Level_Screen and SHALL NOT start a séance.
2. THE Level_Screen SHALL show a heading, one sentence asking where to start, and three choices in the order level 1, level 2, level 3, each a button whose visible text starts with "Level 1", "Level 2" or "Level 3".
3. THE Level_Screen SHALL show under each name one line built from the Level_Manifest: the count, the average stroke count rounded to a whole number, and the three Example_Meanings, in the form `300 characters, about 7 strokes each. For example: "eight", "father" and "white".`
4. THE Level_Screen SHALL NOT render any Chinese character, in text, attribute, accessible name or title.
5. WHEN the player activates a choice, THE App SHALL save the Chosen_Level with `levelChosen` true, SHALL load that Level's Level_Dataset when it is not loaded, and, WHEN the data is loaded and the screen was opened from the intro, SHALL start the first séance, AND, WHEN the screen was opened from the Start_Menu, SHALL return to the Start_Menu.
6. WHILE a Level_Dataset is loading, THE Level_Screen SHALL show the status "Loading level N…" (`role="status"`) and SHALL disable the three choices; IF the load fails, THEN THE Level_Screen SHALL show the alert "Level N could not be loaded. Check your connection and try again.", SHALL enable the choices and SHALL NOT save the choice.
7. IF the Level_Manifest fails to load, THEN THE Level_Screen SHALL show the three choices with their names and no description line, and SHALL show the alert "The level descriptions could not be loaded."
8. THE Level_Screen SHALL have no Primary_Action; each choice SHALL be a paper slip at least 44 px high.
9. WHERE the Level_Screen is opened from the Start_Menu, THE Level_Screen SHALL show a "Back to menu" paper slip and SHALL mark the Chosen_Level with the text "Current level" and `aria-current="true"`.

---

### Requirement 7: Change the Level Later

**User Story:** As a player, I want to change my starting level from the menu, so that I can move up or down without losing my progress.

#### Acceptance Criteria

1. THE Start_Menu SHALL show, directly under "Begin a Nightly Séance", a paper slip whose text names the Chosen_Level ("Starting level: 2") and which opens the Level_Screen.
2. WHEN the player changes the Chosen_Level from the Start_Menu, THE App SHALL save the new level and return to the Start_Menu without starting a séance.
3. WHEN the Chosen_Level changes, THE App SHALL leave the Review_History, `introSeen` and `cangjieIntroSeen` of the Save unchanged.
4. WHEN the player chooses the level that is already the Chosen_Level, THE App SHALL return to the Start_Menu without a request for data.
5. THE Start_Menu SHALL keep exactly one Primary_Action, "Begin a Nightly Séance".

---

### Requirement 8: Order, Due Ghosts and a Finished Level

**User Story:** As a player, I want new ghosts from my level and old ghosts back when they are due, so that the haunting keeps working across levels.

#### Acceptance Criteria

1. WHEN a séance starts, THE App SHALL build the Session_Pool and pass it to `selectSession`, so that never-met characters of the other levels are not in the pool.
2. THE Session_Pool SHALL list the Chosen_Level's characters in that level's Learning_Order, then the characters with a Review entry that belong to the other levels in ascending level order and each level's Learning_Order, with no duplicates.
3. WHEN a ghost of any level is due, THE scheduler SHALL return it ahead of new ghosts under its existing bands; THE feature SHALL NOT change `selectSession`, `applyReview`, `config.ts` or `outcome.ts`.
4. THE new ghosts of a séance SHALL come from the Chosen_Level in the existing Learning_Order (summon-ink class, then stroke count, then codepoint).
5. WHEN every character of the Chosen_Level has a Review entry, THE App SHALL treat the level as a Finished_Level and SHALL still start séances, using the existing bands over the Session_Pool (due ghosts, then ghosts not yet due, soonest first).
6. WHILE the Chosen_Level is a Finished_Level and is level 1 or level 2, THE Start_Menu SHALL show the line "You have met every ghost of level N." and a paper slip "Move on to level N+1" that sets the Chosen_Level as Requirement 7.2 does and keeps the Start_Menu Primary_Action unchanged.
7. WHILE the Chosen_Level is a Finished_Level and is level 3, THE Start_Menu SHALL show the line "You have met every ghost of level 3." and no slip.
8. THE Test_Suite SHALL cover, with fixed histories, a level 2 pool that contains level 1 ghosts that are due, a level 2 pool that excludes never-met level 1 and level 3 ghosts, and a finished level.

---

### Requirement 9: The Guided First Ghost at Every Level

**User Story:** As a brand-new player who starts at level 2 or 3, I want the same guided first ghost, so that I learn how the rite works before it matters.

#### Acceptance Criteria

1. WHEN a Brand_New_Player begins a séance at any Chosen_Level, THE App SHALL put the Walkthrough_Ghost first, as it does today.
2. THE App SHALL pick the Walkthrough_Ghost from the level 1 Level_Dataset with `pickWalkthroughGhost`, whatever the Chosen_Level, and the remaining ghosts SHALL come from the Chosen_Level's Session_Pool, cut to `config.sessionSize`.
3. THE App SHALL keep the level 1 Level_Dataset loaded at all times, so that the Walkthrough_Ghost and the shape meanings in its walkthrough lines are always available.
4. WHEN the Chosen_Level is 1, THE first session of a Brand_New_Player SHALL be identical to today's first session.
5. THE "How Cangjie works" example SHALL keep being chosen from the level 1 Level_Dataset only, so that it stays at position 30 or later of the level 1 Learning_Order.
6. WHEN the Walkthrough_Ghost has a Review entry, THE scheduler SHALL return it like any other ghost, whatever the Chosen_Level.

---

### Requirement 10: The Graveyard Shows Levels

**User Story:** As a player, I want to see my graves for the level I am playing and look at the others, so that my progress is clear at every level.

#### Acceptance Criteria

1. WHEN the Graveyard opens, THE Graveyard SHALL show the Chosen_Level.
2. THE Graveyard SHALL show, under its header, a group of three paper slips "Level 1", "Level 2" and "Level 3", each with `aria-pressed` true for the shown level and false for the others and with a text cue ("showing") on the shown level.
3. WHEN the player activates a level slip, THE Graveyard SHALL show that Level, loading its Level_Dataset when it is not loaded, with the status "Loading level N…" while it loads.
4. THE Graveyard counts (Never met, Restless, At rest) SHALL be computed over the shown Level's characters only and SHALL add up to that Level's character count.
5. IF the Level_Dataset of the requested Level fails to load, THEN THE Graveyard SHALL keep showing the previous Level and SHALL show the alert "Level N could not be loaded. Check your connection and try again."
6. THE Graveyard SHALL show the glyph of a character only when the character has a Review entry, and a never-met grave SHALL carry no character and have the label "Ghost P of T, never met", where T is the shown Level's count.
7. THE Graveyard SHALL use positions in the shown Level's Learning_Order.
8. WHEN the shown Level contains a character with a Review entry, THE Graveyard SHALL show it as Restless or At rest by the existing rule, whatever the Chosen_Level.
9. THE Graveyard's introductory sentence SHALL say that the graves are the ghosts of the shown level.

---

### Requirement 11: Save Schema Version 3

**User Story:** As a returning player, I want my history kept when the game updates, so that I do not lose my ghosts.

#### Acceptance Criteria

1. THE Storage module SHALL write schema version 3, and the Save SHALL add `level` (1, 2 or 3) and `levelChosen` (boolean) to the existing fields.
2. THE default state SHALL have `level` 1 and `levelChosen` false.
3. WHEN the Storage module loads a version 2 Save, THE Storage module SHALL migrate it with a migration registered for version 2, keeping `introSeen`, `cangjieIntroSeen` and every Review entry unchanged, setting `level` to 1 and `levelChosen` to the value of `introSeen`.
4. WHEN a version 2 Save with a non-empty history is loaded, THE App SHALL go to the Start_Menu with the Chosen_Level 1 and SHALL NOT show the Level_Screen.
5. THE Storage module SHALL keep the existing behaviour for a version 1 Save (reset to defaults), for a Save newer than version 3 (reset), for a Save that fails validation (reset) and for unwritable storage (in-memory defaults, the sticky saving flag).
6. IF a Save at version 3 has a `level` that is not 1, 2 or 3 OR a `levelChosen` that is not a boolean, THEN THE Storage module SHALL load the default state.
7. THE Storage module SHALL export `getLevel`, `setLevel(level)` and `getLevelChosen`, `setLevel` SHALL set `levelChosen` to true, and no function SHALL change the Review_History other than `recordOutcome`.
8. IF the Save cannot be written, THEN THE App SHALL keep the Chosen_Level in memory for the page session and SHALL show the existing "progress is not being saved" notice.
9. THE Test_Suite SHALL test the migration with a complete version 2 blob, an empty version 2 blob with `introSeen` false, a version 2 blob with a history of several characters, a corrupt version 2 blob and a round trip through version 3.
10. THE existing storage tests SHALL be changed only where they name the schema version or the default state; no assertion SHALL be weakened or removed.

---

### Requirement 12: Never-Reveal, Primary Action, Fit and Art Direction

**User Story:** As a player on any device, I want the new screen to look and behave like the rest of the game, so that nothing spoils a ghost and nothing is cut off.

#### Acceptance Criteria

1. THE Level_Screen, the Start_Menu level slip and the Graveyard level switcher SHALL render no character that has no Review entry, in text, attribute, accessible name or document title.
2. THE Level_Screen SHALL have no Primary_Action, and `art-direction.md` SHALL list it in the Primary_Action table with "none".
3. THE Level_Screen SHALL fit its viewport without vertical scrolling at every viewport of the Viewport_Set, and without horizontal scrolling at 320, 375 and 1024 px wide.
4. THE Level_Screen SHALL follow `art-direction.md`: palette tokens only, no `candle` utility, secondary buttons as paper slips with an ink label, buttons at least 44 px high, text at 4.5:1 contrast, Moon top room of 4.75 rem below 992 px, and every animation or transition inside the `prefers-reduced-motion: no-preference` block.
5. THE Level_Screen SHALL show no decorative Chinese text and no new imagery other than the existing ghost, moon and mist.
6. THE E2E_Suite SHALL contain a spec for the Level_Screen that covers: the first-run flow intro → Level_Screen → first séance for each level (with the guided first ghost for level 2); the one-screen fit and no horizontal scroll at the Viewport_Set; the change from the Start_Menu without losing history; the Graveyard level switch with correct counts and hidden never-met ghosts; and a version 2 seed that opens on the Start_Menu at level 1 with its history intact.
7. THE E2E helpers SHALL seed version 3 Saves and SHALL keep a way to seed a version 2 Save.

---

### Requirement 13: Fonts for the New Characters

**User Story:** As a player, I want every character the game shows to use the game's brush font, so that level 2 and 3 characters in the Graveyard and the summary look like the rest.

#### Acceptance Criteria

1. THE font build SHALL keep the level 1 subset `lxgw-wenkai-subset.woff2` and `data/fonts/glyph-set.txt` byte-identical to today.
2. THE font build SHALL write one more subset per new Level, each with exactly the glyphs of that Level's Level_Dataset keys not already in an earlier Level's subset, and SHALL write one `@font-face` rule per subset with the same family name and a `unicode-range` that is disjoint from the others.
3. THE font build SHALL fail, naming the character, WHEN the source font has no glyph for a character of any Level.
4. THE App SHALL fetch a level font file only when a character in its range is drawn.
5. THE font build SHALL print, for each subset file, the glyph count, the bytes, the gzip bytes and the SHA-256, and `data/raw/fonts/SOURCES.md` SHALL record them.
6. THE Test_Suite SHALL assert that the three glyph sets are disjoint, that their union contains every key of the three Level_Datasets, and that `fonts.css` has three rules with disjoint ranges.
7. THE Credits text about the font SHALL stay true ("subset to the characters in this game").

---

### Requirement 14: Other Consumers of the Dataset

**User Story:** As the maintainer, I want every script and screen that reads the dataset to keep working and to say what it covers.

#### Acceptance Criteria

1. THE App SHALL compute `learningOrder` per Level wherever it orders ghosts: the session pool, the Walkthrough_Ghost, the Graveyard and the Cangjie guide example.
2. THE e2e helpers `datasetKeys`, `datasetMap`, `datasetRecord` and `seedBefore` SHALL keep reading the level 1 file, and new helpers SHALL read the other Level_Datasets by Level.
3. THE Cangjie Oracle SHALL read all three Level_Datasets and SHALL answer for every character in them, AND the Oracle's tests, README text and Power text SHALL state the 1,200 characters.
4. THE `tabletTilt` test SHALL cover positions 1 to 500.
5. THE `check:data` hook documentation in the README SHALL name the three outputs.
6. THE `kiro-log.md` file SHALL NOT be edited by any task; the human writes it.

---

### Requirement 15: Steering and Spec Amendments

**User Story:** As the maintainer, I want the steering files to match the game, so that future work follows the new rules.

#### Acceptance Criteria

1. THE amendment task SHALL edit `.kiro/steering/content-accuracy.md` (approved by the human, wording to be confirmed) so that: "Character selection" names HSK 3.0 writing levels 1, 2 and 3 (exactly 300, 400 and 500) from `ivankra/hsk30` `hsk30-chars.csv`, column `WritingLevel`; the exhaustive Cangjie unit test is over all records of all three Level_Datasets; the required dataset tests apply to every Level; the "not an answer leak" list names the Level_Screen's Example_Meanings (English meanings only, no character) and the Graveyard glyphs of met ghosts at any level; and the Unreviewed_Prompt rule (Requirement 4) is stated.
2. THE amendment task SHALL edit `.kiro/steering/art-direction.md` (approved by the human, wording to be confirmed) to add the rows "Level screen | none" and keep "Start menu | Begin a Nightly Séance", and SHALL update `tests/unit/steering-art-direction.test.ts` to expect the new row without removing an existing assertion.
3. THE amendment task SHALL edit `.kiro/steering/product.md` (approved by the human, wording to be confirmed) so that "Must-have" says the Nightly Séance draws from the Chosen_Level's characters and that the game has 1,200 checked characters in three levels, and "Core game loop" keeps its text.
4. THE amendment task SHALL add "Amended (approved by the human): see harder-ghosts Requirement N" notes to the spec items this feature changes (character-dataset Requirements 1 and 5, ghost-game-core Requirement 6.12 and the start-menu items, first-meeting Requirement 3, the Storage items of ghost-game-core) and SHALL NOT rewrite their history or edit any `tasks.meta.json`.
5. THE amendment task SHALL run before the tasks that depend on the amended text.
6. THE steering edits SHALL be made only by the amendment task; no other task SHALL edit a steering file.

---

### Requirement 16: README and Sources & Licences

**User Story:** As a judge or a player, I want the counts and the limits stated honestly, so that I know what the game contains and what it needs.

#### Acceptance Criteria

1. THE README SHALL state the character counts (300, 400, 500; 1,200 in total), the three Level_Datasets and the Level_Manifest, update the data table row for the character list to "HSK 3.0 writing levels 1 to 3", and update the build and check instructions.
2. THE README SHALL state the bundle weights it reports (counted bundle, each Level_Dataset's raw and gzip bytes).
3. THE README SHALL state that the level 2 and level 3 prompts come from the same deterministic rule and that the human has reviewed only those listed as reviewed; it SHALL give the number of reviewed and unreviewed prompts at the time of writing.
4. THE README SHALL have a "Known limitations" section with this line: "The Lay to rest step needs a mouse, a finger or a pen to draw each stroke, so a keyboard-only player cannot lay a ghost to rest; that player can only give up."
5. THE Sources & licences screen SHALL show the same limitation line, the character list row for writing levels 1 to 3 with the commit, and the sentence "The clues of levels 2 and 3 come from CC-CEDICT by a fixed rule, and a human has not reviewed all of them yet." WHILE at least one record in a Level_Dataset has `promptReview` `"unreviewed"`; a Test_Suite test SHALL read the three Level_Datasets and fail when the sentence is present and no record is unreviewed, or absent and some record is unreviewed.
6. THE Sources & licences data in `app/src/data/credits.ts` SHALL replace "the ~300 characters taught in the app" with the three counts.
7. THE new copy SHALL cite no statistic and make no claim about HSK, Cangjie or difficulty that content-accuracy.md does not allow; the Accuracy_Reviewer agent SHALL review it.

---

### Requirement 17: Tests, Protected Items and Final Verification

**User Story:** As the maintainer, I want the feature proven by tests and a full run, so that nothing existing broke and nothing was weakened.

#### Acceptance Criteria

1. THE feature SHALL add unit, component and e2e tests only; it SHALL add no property-based test and no mutation test, and the existing property tests SHALL keep running and passing on the level 1 data and, where they read all datasets, on the new data.
2. THE feature SHALL NOT weaken, skip, delete or loosen any existing test; a changed assertion SHALL change only a value that names the schema version, the default state or a dataset count, and the task SHALL say so.
3. THE feature SHALL keep engine logic pure in `app/src/engine/` (no React, no `localStorage`, no `fetch`, no clock) and UI in `app/src/components/`.
4. THE feature SHALL NOT change the rite constants (`SUMMON_HOLD_MS`, `SUMMON_FADE_MS`, `SUMMON_INK_SPEED`), the scheduler, the outcome rules, the thresholds or the level 1 records.
5. THE human-only tasks (reviewing the Review_Files, writing override and approval rows, the spot-check of a random sample of the new characters, the screenshot review of the Level_Screen) SHALL be marked as human tasks, and Kiro SHALL NOT do them.
6. THE last task SHALL run `npm test`, the three `tsc --noEmit` runs (root, `app/`, `oracle/`), `npm run build -w app`, `npm run check:bundle` and `npm run test:e2e`, and SHALL report the results and the actual file sizes.
7. THE feature SHALL write no personal name in any repository file; approvals SHALL read "approved by the human".

---

## Open questions for the human

Each question has a recommended answer. The design and tasks follow the recommendation until the human decides otherwise.

1. **What happens when a level is finished?** Recommended: nothing changes automatically. Séances keep running over due and not-yet-due ghosts, and the Start_Menu offers a "Move on to level N+1" slip (Requirement 8.5 to 8.7).
2. **Are the levels cumulative?** Recommended: no. Starting at level 2 does not require level 1. Level 1 ghosts that were never met stay hidden in the Graveyard and stay out of the Session_Pool, except the Walkthrough_Ghost for a new player.
3. **`content-accuracy.md` amendments** (Requirement 15.1). Recommended: approve the four edits listed there.
4. **`art-direction.md` amendments** (Requirement 15.2). Recommended: add "Level screen | none".
5. **How an Unreviewed_Prompt is flagged, and whether unreviewed prompts may ship.** Recommended: an optional `promptReview` field on level 2 and 3 records only; the human clears it through override rows or the Approvals_File. Unreviewed prompts may ship if the human first reviews a random sample (content-accuracy.md manual review) and the Sources screen and README say plainly that some prompts are unreviewed.
6. **Font subset impact.** Recommended: keep the level 1 font as is, add one lazy subset per level (about +82 KB and +103 KB, not counted in the budget), and say so in the README. The alternative, one bigger subset (about +185 KB), would put the counted bundle near 394 KB and over budget.
7. **How the Graveyard switches levels.** Recommended: three paper slips with `aria-pressed` under the header, default the Chosen_Level, counts per shown level.
8. **Where the level choice sits in the menu.** Recommended: one paper slip directly under "Begin a Nightly Séance" showing the current level.
9. **Does tapping a level on the Level_Screen start the séance at once?** Recommended: yes, with no Primary_Action on that screen. The alternative is a radio group plus a seal-red "Begin" button.
10. **File naming.** Recommended: keep `characters.json` as level 1 and add `characters-level2.json` and `characters-level3.json`, so no existing path, test, e2e helper or oracle path changes.
11. **Minifying the level files.** Recommended: no. Keep the existing pretty-printed format for all three so the level 1 bytes do not change; a follow-up could cut about 60 percent of the raw size.
12. **A level that fails to load at start-up** (Requirement 5.7). Recommended: show the existing error screen.
13. **Oracle scope** (Requirement 14.3). Recommended: extend it to all 1,200 characters in this feature.
14. **The 13 characters that are not Playable** (4 at level 2, 9 at level 3). Recommended: same rule as 别 and 错, they skip the Summon step.
15. **The first-load rule** (Requirement 5.4). Recommended: the Level_Manifest is fetched only when the Level_Screen is shown, so the first load of a level 1 player is exactly today's.
16. **Where the keyboard limitation line goes** (Requirement 16.4 and 16.5). Recommended: the README "Known limitations" and the Sources & licences screen.
17. **A human to review the new prompts.** Recommended: review `data/prompt-review-level2.csv` and `-level3.csv` (900 rows) before deploy, or at least a random sample, and record it in `kiro-log.md`.
