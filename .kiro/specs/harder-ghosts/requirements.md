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
- The real pipeline (`buildDataset`), run in memory on the two new lists without writing any file, succeeds: level 2 is 2,508,739 bytes (511,365 bytes gzip level 9) and level 3 is 3,284,451 bytes (663,356 bytes gzip level 9). The level 1 file is 1,718,328 bytes (about 353,000 bytes gzip). Those level 2 and level 3 sizes are for the pretty-printed format; the two files ship minified (Requirement 3.12), so their real sizes are smaller and the build reports them.
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
- **Source_Check**: The first task of this feature, which verifies that every level 2 and level 3 character exists in every source and compares the result with the Expected_Result.
- **Expected_Result**: The exact outcome listed in Requirement 1.8.
- **Pinned_CSV**: `hsk30-chars.csv` at commit `4ff9e3915ce87baaecd7ebe263085573a4ea3192` of `ivankra/hsk30`.
- **Playable**: A character whose Cangjie code is non-null and does not start with X (cangjie-seance).
- **Unreviewed_Prompt**: A level 2 or level 3 record whose `prompt` no human has reviewed. Its record carries `promptReview: "unreviewed"`.
- **Review_File**: A generated CSV with columns `character,chosenMeaning,chosenPinyin,source,reviewedBy,alternatives`, in the format of `data/prompt-review.csv`.
- **Approvals_File**: `data/prompt-approvals.csv`, written only by the human, with columns `character,reviewedBy`. It records that a human reviewed the default prompt of a character and accepted it.
- **Review_Sample**: A file `data/prompt-review-sample-level2.csv` or `data/prompt-review-sample-level3.csv` with the Review_File header and exactly 50 distinct rows copied from that level's Review_File, chosen with a fixed seeded PRNG (Requirement 4.10). The human reviews these rows.
- **Sample_Provenance**: The generated file `data/prompt-review-sample-provenance.json`, which records the algorithm, the seed of each level, the sample size and the source file of each Review_Sample.
- **Prompt_Counts**: The numbers of reviewed and unreviewed prompts of level 2, of level 3 and of both together, computed by the Pipeline from the Level_Datasets and never typed by hand.
- **Reviewer_Value**: The `reviewedBy` value of a row. In every new file and every new row it is exactly `human`, or empty on an unreviewed row. The level 1 files keep their existing values (`human-approved` or empty).
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
- **Current_Rule**: The existing default prompt rule of `selectPrompt` in `scripts/lib/prompt.ts` (first usable gloss of the first non-proper-noun CC-CEDICT entry). Level 1 uses it unchanged.
- **Clue_Rule**: The default prompt rule of level 2 and level 3 (Requirement 18): reading by frequency in the HSK example words, then the first clean gloss of an entry with that reading.
- **Example_Words**: The space-separated words in the `Examples` column of `data/raw/hsk30/hsk30-chars.csv` for a character (the sixth of six comma-separated columns; the file has no quoted field).
- **Reading_Count**: For one character, the number of times each tone-numbered reading occurs across the CC-CEDICT entries of its Example_Words (Requirement 18.3 and 18.4).
- **Han_Character**: A character with Unicode script Han (`\p{Script=Han}`).
- **Cross_Reference_Gloss**: A gloss that is not a standalone clue: after a single leading `(bound form) ` is removed, it starts (case-insensitively) with `variant of`, `old variant of`, `see `, `used in`, `surname `, `abbr.`, `cl:`, `also pr.` or `taiwan pr.`, or contains (case-insensitively) `(Tw)` or `(archaic)`.
- **Displayed_Meaning**: The text a player can see for a level 2 or level 3 meaning: `maskTarget(cleanupMeaning(prompt.meaning), character)` on the ghost prompt, `cleanupMeaning(prompt.meaning)` on the return line and the walkthrough, and each Example_Meaning of the Level_Manifest.
- **Rule_Changes_File**: The generated file `data/prompt-rule-changes.csv` (Requirement 18.9).
- Terms not defined here (Ghost, Séance, Rite, Summon step, Lay-to-rest step, summon-ink class, Review entry) have the meanings given in ghost-game-core, cangjie-seance, first-meeting and summon-ink.

---

## Requirements

### Requirement 1: Verify the Sources Before Any Other Work

**User Story:** As the maintainer, I want the sources checked for levels 2 and 3 first and automatically, so that the plan continues when the result is exactly the expected one and stops for my decision only when anything differs.

#### Acceptance Criteria

1. THE Source_Check SHALL be the first task executed and no other task SHALL start before it passes.
2. THE Source_Check SHALL read the Pinned_CSV and report, for each Level, the number of rows with that `WritingLevel`.
3. THE Source_Check SHALL report, for every character of level 2 and level 3, whether it exists in hanzi-writer-data, in Make Me a Hanzi `dictionary.txt`, in CC-CEDICT as a simplified headword and in Unihan `kCangjie`, whether its `kCangjie` has exactly one value matching `^[A-Y]{1,5}$`, whether the default prompt rule yields a prompt, and whether the source font has a glyph.
4. THE Source_Check SHALL report the characters that are not Playable, per level, and the summon-ink class counts, per level.
5. IF the Source_Check result differs from the Expected_Result in any item (Requirement 1.8), THEN THE Source_Check SHALL exit non-zero, SHALL stop the plan, SHALL write to the human what differs (the item, the Level, the character, the source, the expected value and the found value), and the plan SHALL wait for the human's decision.
6. THE Source_Check SHALL NOT replace a missing character, drop it silently, take its data from another source or generate any value.
7. WHEN the Source_Check result equals the Expected_Result in every item, THE Source_Check SHALL exit zero after reporting the per-level counts and the lists of characters that are not Playable, and the plan SHALL continue without asking the human.
8. THE Expected_Result SHALL be: the Pinned_CSV size and SHA-256 as stated in the Facts; 300, 400 and 500 rows for `WritingLevel` 1, 2 and 3; the level 1 rows equal to `data/character-list.txt` in order; no character in two levels; every level 2 and level 3 character present in hanzi-writer-data, Make Me a Hanzi `dictionary.txt`, CC-CEDICT and Unihan `kCangjie` (one value matching `^[A-Y]{1,5}$`), with a default prompt and a source-font glyph; and the not-Playable set exactly 广 换 压 灭 at level 2 and 历 内 敌 锻 镜 宽 亏 杀 贡 at level 3.

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
6. WHEN every Level succeeds, THE Pipeline SHALL write the three Level_Datasets, the Level_Manifest, the Review_Files, the two Review_Samples, the Sample_Provenance and the Prompt_Counts outputs (Requirement 4.13), each atomically, and SHALL print for each written data file its path, record count, raw bytes and gzip bytes (level 9).
7. WHEN the Pipeline runs twice with identical inputs, THE Pipeline SHALL produce byte-for-byte identical output files.
8. THE Level_Datasets SHALL have no character in common, and each key SHALL equal its record's `character`.
9. WHEN the Pipeline has run, THE content of `app/public/data/characters.json` SHALL equal its content before this feature, and a Test_Suite test SHALL hold the SHA-256 of that file and of `data/prompt-review.csv` as they were before this feature and fail when either differs.
10. THE existing dataset tests (property tests included) SHALL keep passing unchanged on the level 1 file, and new plain unit tests SHALL run over all three Level_Datasets and assert: the record counts 300, 400 and 500; every required field present; every component valid; every `cangjie` equal to the verbatim Unihan value and `sources.cangjie` correct; the Playable and not-Playable characters named in the Facts; every `summonInk` valid for its record; and the Level_Datasets and Level_Lists agree character for character.
11. THE data check (`npm run check:data`) SHALL keep running the build and `test:data`, and SHALL fail when any Level fails.
12. THE Pipeline SHALL write `characters-level2.json` and `characters-level3.json` minified (JSON with no whitespace outside strings, same key order and same record content as the pretty-printed form), and SHALL keep writing `characters.json` pretty-printed with 2 spaces, byte-identical to today; a Test_Suite test SHALL assert that each minified file parses to the same value as its pretty-printed form and contains no newline.
13. THE Pipeline SHALL print, for `characters.json`, both level files and `levels.json`, the real raw bytes and gzip bytes (level 9) after each build.

---

### Requirement 4: Prompts for the New Characters

**User Story:** As the maintainer, I want the new prompts produced by the same rule and marked as unreviewed, so that a human can review them and nobody mistakes them for the 300 reviewed ones.

#### Acceptance Criteria

1. THE Pipeline SHALL choose each new prompt with the existing `selectPrompt` rule (default walk over CC-CEDICT entries in source order, with the skipped prefixes and proper-noun rule), or with a human override by index, and SHALL NOT use an AI model for any prompt.
   - Amended (approved by the human): for level 2 and level 3 the default prompt follows the Clue_Rule of Requirement 18; the walk above is the Current_Rule that the Clue_Rule falls back to, and level 1 keeps it unchanged.
2. THE Pipeline SHALL read overrides for level 2 from `data/prompt-overrides-level2.csv` and for level 3 from `data/prompt-overrides-level3.csv`, with the columns, validation and index-only semantics of `data/prompt-overrides.csv`, and SHALL treat an absent file as no overrides.
3. THE Pipeline SHALL read approvals from `data/prompt-approvals.csv` when it exists, and SHALL reject a row whose `character` is not in a Level_List of level 2 or 3, or whose `reviewedBy` is not exactly `human`; AND THE Pipeline SHALL apply the same `reviewedBy` rule to the rows of `data/prompt-overrides-level2.csv` and `data/prompt-overrides-level3.csv`.
4. WHEN a level 2 or level 3 character has an override row or an approval row, THE Pipeline SHALL set `promptReview` to `"reviewed"` on its record; OTHERWISE THE Pipeline SHALL set `promptReview` to `"unreviewed"`.
5. THE Pipeline SHALL NOT add `promptReview` to any level 1 record.
6. THE Pipeline SHALL write `data/prompt-review-level2.csv` and `data/prompt-review-level3.csv` in the format of `data/prompt-review.csv` (same header, one row per character in Level_List order, the same `alternatives` rendering), and SHALL fill `reviewedBy` with `human` when an override or approval row exists and leave it empty otherwise; AND THE Pipeline SHALL keep writing `data/prompt-review.csv` for level 1 with content identical to today.
7. THE character data loader SHALL accept a record with no `promptReview` or with `promptReview` equal to `"reviewed"` or `"unreviewed"`, and SHALL reject any other value.
8. THE tasks of this feature SHALL NOT add rows to any overrides file or to the Approvals_File, and SHALL NOT review any prompt; reviewing the Review_Samples (and any other rows) and writing override or approval rows SHALL be a human task. Unreviewed_Prompts MAY ship (decided by the human).
9. THE Test_Suite SHALL assert that every level 2 and level 3 `prompt.meaning` is one of the record's own CC-CEDICT `meanings` (after the permitted `(bound form) ` strip) and that every `prompt.pinyin` is the tone-mark form of one of its own readings, from the same entry (existing Requirement 6 of character-dataset, applied to all levels).
10. WHEN the Pipeline succeeds, THE Pipeline SHALL write `data/prompt-review-sample-level2.csv` and `data/prompt-review-sample-level3.csv`, each with the Review_File header and exactly 50 distinct rows copied byte for byte from that level's Review_File, in the row order of that Review_File, chosen as follows: the PRNG is mulberry32, seeded with the 32-bit FNV-1a hash of the ASCII string `ghost-script/prompt-review-sample/v1/level2` (and `…/level3`); the 50 rows are the first 50 positions of a partial Fisher–Yates shuffle of the row positions, where for i from 0 to 49 the position j is `i + floor(random() * (n - i))`.
11. THE Pipeline SHALL write the Sample_Provenance with the algorithm name and steps, the seed string and numeric seed of each level, the sample size, and the Review_File each sample comes from, as JSON, so that the CSV format of the samples stays unbroken; AND THE README SHALL state the same algorithm and seeds in its prompt-review section.
12. THE sample generation SHALL be deterministic: THE Test_Suite SHALL assert that the same seed gives identical bytes on two runs, that each sample has exactly 50 distinct rows, that every row of a sample is a row of that level's Review_File, that the header equals the Review_File header, and that the Pipeline fails when a Review_File has fewer than 50 rows.
13. THE Pipeline SHALL compute the Prompt_Counts from the three Level_Datasets at build time and write them to the generated file `app/src/data/promptCounts.generated.ts` and between the markers `<!-- prompt-counts:start -->` and `<!-- prompt-counts:end -->` of `README.md`; no count SHALL be typed by hand in any source, test or document.
14. THE README SHALL state plainly, from the Prompt_Counts, how many level 2 and level 3 prompts are reviewed and how many are not (per level and together); THE Sources & licences screen SHALL state the same numbers (Requirement 16.5).
15. THE Test_Suite SHALL assert that the Prompt_Counts equal a fresh count over the three Level_Datasets, that the README block equals the block rendered from the Prompt_Counts, and that the numbers in the Sources & licences text equal the Prompt_Counts.
16. THE Test_Suite SHALL assert that every `reviewedBy` value in `data/prompt-review-level2.csv`, `data/prompt-review-level3.csv`, both Review_Samples, `data/prompt-approvals.csv` (when it exists) and `data/prompt-overrides-level2.csv` and `-level3.csv` (when they exist) is exactly `human`, or empty on a Review_File or Review_Sample row of an unreviewed prompt, and SHALL fail on any other value; AND for `data/prompt-overrides.csv` and `data/prompt-review.csv` (level 1) the test SHALL accept exactly the values and rows that exist before this feature (`human-approved` and empty), SHALL fail on any new row of `data/prompt-overrides.csv` whose `reviewedBy` is not `human`, and no task SHALL rewrite those two files.

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
10. THE design SHALL state the expected raw and gzip bytes of each Level_Dataset, of the Level_Manifest and of each level font file, and THE Pipeline and the font build SHALL report the real raw and gzip bytes of `characters.json`, both level files, `levels.json` and every font subset after each build; THE final checkpoint SHALL report them again.

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
9. THE levels SHALL NOT be cumulative: unmet characters of the other levels SHALL stay hidden and out of the Session_Pool, the only exception being the Walkthrough_Ghost of a Brand_New_Player (Requirement 9).

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

1. THE amendment task SHALL edit `.kiro/steering/content-accuracy.md` (approved by the human, as worded in the design) so that: "Character selection" names HSK 3.0 writing levels 1, 2 and 3 (exactly 300, 400 and 500) from `ivankra/hsk30` `hsk30-chars.csv`, column `WritingLevel`; the exhaustive Cangjie unit test is over all records of all three Level_Datasets; the required dataset tests apply to every Level; the "not an answer leak" list names the Level_Screen's Example_Meanings (English meanings only, no character) and the Graveyard glyphs of met ghosts at any level; and the Unreviewed_Prompt rule (Requirement 4) is stated.
2. THE amendment task SHALL edit `.kiro/steering/art-direction.md` (approved by the human, as worded in the design) to add the rows "Level screen | none" and keep "Start menu | Begin a Nightly Séance", and SHALL update `tests/unit/steering-art-direction.test.ts` to expect the new row without removing an existing assertion.
3. THE amendment task SHALL edit `.kiro/steering/product.md` (approved by the human, as worded in the design) so that "Must-have" says the Nightly Séance draws from the Chosen_Level's characters and that the game has 1,200 checked characters in three levels, and "Core game loop" keeps its text.
4. THE amendment task SHALL add "Amended (approved by the human): see harder-ghosts Requirement N" notes to the spec items this feature changes (character-dataset Requirements 1 and 5, ghost-game-core Requirement 6.12 and the start-menu items, first-meeting Requirement 3, the Storage items of ghost-game-core) and SHALL NOT rewrite their history or edit any `tasks.meta.json`.
5. THE amendment task SHALL run before the tasks that depend on the amended text.
6. THE steering edits SHALL be made only by the amendment task; no other task SHALL edit a steering file.

---

### Requirement 16: README and Sources & Licences

**User Story:** As a judge or a player, I want the counts and the limits stated honestly, so that I know what the game contains and what it needs.

#### Acceptance Criteria

1. THE README SHALL state the character counts (300, 400, 500; 1,200 in total), the three Level_Datasets and the Level_Manifest, update the data table row for the character list to "HSK 3.0 writing levels 1 to 3", and update the build and check instructions.
2. THE README SHALL state the bundle weights it reports (counted bundle, each Level_Dataset's raw and gzip bytes).
3. THE README SHALL state that the level 2 and level 3 prompts come from the same deterministic rule, that a human has reviewed only those counted as reviewed, and that a human reviews a random sample of 50 rows per level (Requirement 4.10); it SHALL give the numbers of reviewed and unreviewed level 2 and level 3 prompts through the generated block of Requirement 4.13, not by hand.
4. THE README SHALL have a "Known limitations" section with this line: "The Lay to rest step needs a mouse, a finger or a pen to draw each stroke, so a keyboard-only player cannot lay a ghost to rest; that player can only give up."
5. THE Sources & licences screen SHALL show the same limitation line, the character list row for writing levels 1 to 3 with the commit, and the sentence "The clues of levels 2 and 3 come from CC-CEDICT by a fixed rule. A human has reviewed R of the T clues and has not reviewed U." WHILE at least one record in a Level_Dataset has `promptReview` `"unreviewed"`, with R, T and U taken from the Prompt_Counts; a Test_Suite test SHALL read the three Level_Datasets and fail when the sentence is present and no record is unreviewed, or absent and some record is unreviewed, or when R, T or U differs from the count over the data.
6. THE Sources & licences data in `app/src/data/credits.ts` SHALL replace "the ~300 characters taught in the app" with the three counts.
7. THE new copy SHALL cite no statistic and make no claim about HSK, Cangjie or difficulty that content-accuracy.md does not allow; the Accuracy_Reviewer agent SHALL review it.

---

### Requirement 17: Tests, Protected Items and Final Verification

**User Story:** As the maintainer, I want the feature proven by tests and a full run, so that nothing existing broke and nothing was weakened.

#### Acceptance Criteria

1. THE feature SHALL add unit, component and e2e tests only (the sample, counts and reviewer checks are plain unit tests); it SHALL add no property-based test and no mutation test, and the existing property tests SHALL keep running and passing on the level 1 data and, where they read all datasets, on the new data.
2. THE feature SHALL NOT weaken, skip, delete or loosen any existing test; a changed assertion SHALL change only a value that names the schema version, the default state or a dataset count, and the task SHALL say so.
3. THE feature SHALL keep engine logic pure in `app/src/engine/` (no React, no `localStorage`, no `fetch`, no clock) and UI in `app/src/components/`.
4. THE feature SHALL NOT change the rite constants (`SUMMON_HOLD_MS`, `SUMMON_FADE_MS`, `SUMMON_INK_SPEED`), the scheduler, the outcome rules, the thresholds or the level 1 records.
5. THE human-only tasks (reviewing the Review_Samples, writing override and approval rows, the spot-check of a random sample of the new characters, the screenshot review of the Level_Screen) SHALL be marked as human tasks, and Kiro SHALL NOT do them.
6. THE last task SHALL run `npm test`, the three `tsc --noEmit` runs (root, `app/`, `oracle/`), `npm run build -w app`, `npm run check:bundle` and `npm run test:e2e`, and SHALL report the results and the real raw and gzip size of `characters.json`, both level files, `levels.json` and every font subset.
7. THE feature SHALL write no personal name in any repository file, data files included; approvals SHALL read "approved by the human", and every new `reviewedBy` value SHALL follow Requirement 4.16.
8. THE last task SHALL also report the first ten ghosts in Learning_Order at level 2 and at level 3, each with character, meaning, pinyin and summon-ink class, read from the generated Level_Datasets by a script and not typed by hand.

### Requirement 18: Clue Quality for Levels 2 and 3 (follow-up, approved by the human)

**User Story:** As a player, I want each level 2 and level 3 ghost to show its everyday meaning and reading, so that I am not asked for "penis" when I should see "bird", and never see Chinese characters in a clue.

#### Acceptance Criteria

1. THE Pipeline SHALL choose the default prompt of every level 2 and level 3 character with the Clue_Rule, and SHALL keep choosing the prompt of every level 1 character with the Current_Rule, so that `app/public/data/characters.json` and `data/prompt-review.csv` stay byte-identical.
2. WHERE a human override row exists for a level 2 or level 3 character, THE Pipeline SHALL use the override and not the Clue_Rule; WHERE an approval row exists and no override row, THE Pipeline SHALL use the Current_Rule's prompt for that character, because the human approved that prompt.
3. THE Pipeline SHALL count readings for a character as follows: for every word of its Example_Words that contains the character, and for every CC-CEDICT entry whose simplified headword equals the word exactly and whose reading has exactly one syllable per character of the word, count once the syllable at the position of the character's first occurrence in the word; a word with no such entry adds nothing.
4. THE Pipeline SHALL compare syllables as tone-numbered CC-CEDICT syllables, lower-cased, with `u:` and `v` read as `ü`, and SHALL NOT count a syllable whose tone digit is 5 or that has no tone digit 1 to 4.
5. THE Pipeline SHALL take as the Clue_Rule reading the reading with the highest Reading_Count; IF two or more readings share the highest count, or no reading was counted, THEN THE Pipeline SHALL use the reading of the Current_Rule's entry.
6. THE Pipeline SHALL scan the character's CC-CEDICT entries in source order, skipping each entry whose reading is a proper-noun reading (the Current_Rule's test), and for each entry whose normalised reading equals the Clue_Rule reading SHALL take the first gloss that, after one leading `(bound form) ` is removed, is not empty, is not a Cross_Reference_Gloss and whose `cleanupMeaning` form contains no Han_Character; the chosen entry's reading, in tone marks, is the prompt's pinyin.
7. IF no entry with the Clue_Rule reading has such a gloss, THEN THE Pipeline SHALL use the Current_Rule's prompt for that character.
8. THE selected meaning SHALL be one of the record's own CC-CEDICT meanings (after the permitted `(bound form) ` strip) and the selected pinyin SHALL be the tone-mark form of the reading of the same entry, so the tests of Requirement 4.9 keep passing.
9. WHEN the Pipeline succeeds, THE Pipeline SHALL write `data/prompt-rule-changes.csv` atomically with the other generated files, with the fixed header `character,level,oldPinyin,oldMeaning,newPinyin,newMeaning`, one row for each level 2 character and then each level 3 character, in Level_List order, whose Clue_Rule pinyin or meaning differs from the Current_Rule's (the stored values, with the quoting of the Review_Files), and no row for a character with an override or approval row; the file SHALL be identical on two runs.
10. THE Pipeline SHALL leave `promptReview` of a changed prompt as the existing rule gives it (`unreviewed` unless an override or approval row exists), and SHALL print the number of changed prompts for level 2, for level 3 and in total.
11. IF a Displayed_Meaning of a level 2 or level 3 record would contain a Han_Character after the Clue_Rule, an override and the fallback (checked on `cleanupMeaning(prompt.meaning)` with the target character not masked), THEN THE Pipeline SHALL fail the build with no file written, naming each such character, its level and the file in which a human adds an override row (`data/prompt-overrides-level2.csv` or `-level3.csv`).
12. THE Test_Suite SHALL assert, for every record of `characters-level2.json` and `characters-level3.json`, that no Han_Character occurs in `cleanupMeaning(prompt.meaning)`, in `maskTarget(cleanupMeaning(prompt.meaning), character)`, and in each Example_Meaning of `levels.json`.
13. THE Test_Suite SHALL assert that the Rule_Changes_File has the fixed header, that each row's new pinyin and meaning equal the record's prompt, that each row's old pair equals the Current_Rule's choice over the same CC-CEDICT data, and that the number of rows equals the number of records whose prompt differs from the Current_Rule's choice.
14. THE pure functions of the Clue_Rule SHALL live in `scripts/lib/` and SHALL have unit tests on small fixtures: a clear majority, a tie, no usable example, tone 5 ignored, `u:` and `ü`, a proper-noun entry skipped, two entries of one word each counted, a word whose entry has the wrong syllable count, each Cross_Reference_Gloss phrase, a gloss with a Han_Character skipped, a `(CL:…)` note that `cleanupMeaning` removes, the next entry with the same reading, the fallback, and the override and approval precedence.
15. WHEN the Pipeline has run, THE regenerated files SHALL be the three Level_Datasets (level 1 unchanged), the Review_Files, both Review_Samples with the same seed strings and the same row positions, the Sample_Provenance, the Prompt_Counts outputs, the README block, `levels.json` and, only if a glyph set changes, the font subsets; and every existing check SHALL stay green, where a test that pins a level 2 or level 3 prompt value changes that value only.
16. THE data-check hook SHALL also watch `data/character-list-level2.txt`, `data/character-list-level3.txt`, `data/prompt-overrides-level2.csv`, `data/prompt-overrides-level3.csv` and `data/prompt-approvals.csv`, and `tests/unit/kiro-hook.test.ts` SHALL cover each new path and still reject the generated files.
17. THE README SHALL describe the Clue_Rule for levels 2 and 3 in the prompt section, name the `Examples` column of the Pinned_CSV as its source, and name the Rule_Changes_File.
18. THE final checkpoint (task 16) SHALL run every check of Requirement 17.6, SHALL report the number of changed prompts per level and print the Rule_Changes_File, and SHALL run `npm run report:ghosts` again and print its output.
19. THE follow-up SHALL add no property-based test and no mutation test (decision of Nov 15), SHALL NOT edit `kiro-log.md`, `tasks.meta.json` or any steering file, SHALL NOT create `data/prompt-overrides-level2.csv`, `data/prompt-overrides-level3.csv` or `data/prompt-approvals.csv`, and SHALL write no personal name in any file.

---

## Decisions approved by the human

There are no open questions. The human approved the following decisions; the requirements above state them.

1. A finished level changes nothing automatically. Séances continue over due and not-yet-due ghosts. The Start_Menu shows "You have met every ghost of level N." and, for levels 1 and 2, a "Move on to level N+1" paper slip; level 3 shows the line only (Requirements 8.5 to 8.7).
2. Levels are not cumulative. Unmet level 1 ghosts stay hidden; the exception is the Walkthrough_Ghost (明) for a Brand_New_Player (Requirements 8.9 and 9).
3. Tapping a level on the Level_Screen starts at once; the screen has no seal-red Primary_Action (Requirement 6).
4. The Start_Menu has one paper slip under "Begin a Nightly Séance", reading "Starting level: N" (Requirement 7.1).
5. The Graveyard has three paper slips with `aria-pressed`, defaults to the Chosen_Level and counts the shown level (Requirement 10).
6. Unreviewed prompts may ship. The human reviews a random sample of 50 rows per level, generated by a seeded script step; the README and the Sources & licences screen state the reviewed and unreviewed counts, computed at build time (Requirements 4.8 and 4.10 to 4.16, 16.3, 16.5). The sample review itself is a human-only task.
7. A prompt's unreviewed flag is cleared through `data/prompt-approvals.csv` (columns `character,reviewedBy`) or an override row (Requirement 4).
8. The `content-accuracy.md` amendments are approved as worded in the design (Requirement 15.1).
9. The `art-direction.md` amendment, the row "Level screen | none", is approved as worded (Requirement 15.2).
10. Fonts: the level 1 subset stays untouched; two lazy subsets are loaded by `unicode-range` and are outside the Bundle_Budget count (Requirement 13).
11. File names: `characters.json` stays level 1; the others are `characters-level2.json` and `characters-level3.json`.
12. `characters-level2.json` and `characters-level3.json` are minified; `characters.json` stays byte-identical with its hash test. The build and the final checkpoint report the real raw and gzip size of every data and font file (Requirements 3.12, 3.13, 5.10).
13. `levels.json` (about 0.6 KB gzip) is fetched when the Level_Screen first shows (Requirement 5.5).
14. A level file that fails to load at start-up shows the existing error screen (Requirement 5.7).
15. The Cangjie Oracle covers all 1,200 characters (Requirement 14.3).
16. The keyboard-only limitation line is in a README "Known limitations" section and on the Sources & licences screen (Requirement 16.4 and 16.5).
17. The 13 characters that are not Playable skip the Summon step, as 别 and 错 do (Requirement 3.3).
18. All steering amendments are approved as worded in the design.
19. No personal names appear in any file, data files included. Every new `reviewedBy` value is exactly `human`; the level 1 files keep their existing values (Requirement 4.16).
20. The Source_Check is automatic: the plan continues when the result equals the Expected_Result and stops for the human only when anything differs (Requirement 1).
21. Clue quality (Requirement 18): levels 2 and 3 get a new default prompt rule; level 1 and its protected hashes stay as they are.
22. The reading is the most frequent non-neutral reading across the CC-CEDICT entries of the character's HSK example words; a tie or no usable example keeps the Current_Rule's reading (Requirements 18.3 to 18.5).
23. The meaning is the first gloss of the entry with that reading that has no Chinese character and is not a cross-reference; otherwise the next entry with the same reading; otherwise the Current_Rule (Requirements 18.6 and 18.7).
24. No Displayed_Meaning of level 2 or 3 contains a Chinese character, proven by a test over every record; a character that cannot meet this fails the build and gets a human override row (Requirements 18.11 and 18.12).
25. `data/prompt-rule-changes.csv` lists every changed prompt; changed prompts stay unreviewed; override and approval rows win (Requirements 18.2, 18.9 and 18.10).
26. The data-check hook also watches the level 2 and 3 lists, the two level overrides files and the approvals file (Requirement 18.16).
27. The human reviewed 12 clues and asked Kiro to write their override rows on the human's behalf (task 17). This supersedes Requirement 4.8 for these 12 rows only.

## Assumptions for the human (Clue quality)

These follow from the brief only by interpretation. They are not recorded as decisions until the human confirms them.

1. **Proper-noun entries stay skipped.** The Clue_Rule keeps the Current_Rule's test: an entry whose reading starts with a capital letter is never chosen. Without it a read-only trial picked "France" for 法 and "Yuan dynasty" for 元. Capitalised readings of example words (法国, "Fa3 guo2") still count as a reading, compared case-insensitively.
2. **First occurrence only.** A word that holds the character twice counts one syllable, the first position.
3. **Each matching entry counts once.** A word with two CC-CEDICT entries of the right length (for example a word with two readings) adds one count per entry. A single-character example word (the character itself) counts all its entries; this is intended, because a rare reading then gets one vote against the common reading's votes from longer words.
4. **Neutral tone and no tone digit.** Tone 5, and any syllable without a digit 1 to 4, is not counted.
5. **Chinese-character test on the cleaned gloss.** Requirement 18.6 tests `cleanupMeaning(gloss)`, not the raw gloss, so a gloss whose only Chinese text is a `(CL:…)` note or a `[pin1 yin1]` reference, which the display removes, stays eligible. The stored `prompt.meaning` is still the raw gloss and may contain such a note, as today.
6. **The strict test also rejects the target character itself** (for example "(variant of 豆[dou4])" is rejected although `maskTarget` would hide the 豆), so the return line, which does not mask, is clean too.
7. **Cross-reference list is the Current_Rule's list plus the brief's.** The Clue_Rule never picks a gloss the Current_Rule would skip (`abbr.`, `cl:`, `also pr.`, `taiwan pr.`), and adds `(Tw)` and `(archaic)` as "contains" tests and `surname ` as a prefix, as the Current_Rule already has.
8. **Approval rows keep the Current_Rule's prompt**, since a human approved that prompt, not the new one. No approvals file exists yet.
9. **An override that shows a Chinese character also fails the build** (Requirement 18.11); the human fixes the override row.
10. **The `source` column of the Review_Files stays `default`** for a Clue_Rule choice; the Rule_Changes_File is where changes are listed.
11. **"List order"** of the Rule_Changes_File means level 2 in `character-list-level2.txt` order, then level 3 in `character-list-level3.txt` order.
12. **The Clue_Rule is applied only when the build is given the Pinned_CSV path** (the repository build always is); a build without it (some test fixtures) keeps the Current_Rule.
