# Implementation Plan: harder-ghosts

## Overview

Add HSK 3.0 writing level 2 (400 characters) and level 3 (500 characters), split the data by level, let the player choose a starting level, and keep every existing record, prompt, rule and test intact. The plan runs in this order: verify the data sources first and stop for the human if anything is missing; amend the steering files; add the lists and the level 1 protection test; extend the pipeline and build the data; add storage, loader and engine code; build the screens; wire the App; update the Oracle; add the e2e tests; update the README; run the final checks.

Rules for every task:

- Do not edit `kiro-log.md`, `tasks.meta.json` or any steering file outside tasks 3.1 to 3.3 (steering edits, approved by the human, wording to be confirmed).
- Never write a personal name in a repository file; approvals read "approved by the human".
- Never weaken, skip, delete or loosen a test. A test may change only where it names the schema version, the default state or a dataset count, and the task says so.
- Add no property-based test and no mutation test (decision of Nov 15). Existing property tests stay and must pass.
- Do not touch `app/public/data/characters.json`, `data/character-list.txt`, `data/prompt-review.csv`, `data/prompt-overrides.csv`, the level 1 font subset, the rite constants, `scheduler.ts`, `outcome.ts` or `config.ts`, except where a task says otherwise with its reason.
- Do not create `data/prompt-overrides-level2.csv`, `data/prompt-overrides-level3.csv` or `data/prompt-approvals.csv`. They are written by the human (tasks 13.1 and 13.2).
- Keep engine logic in `app/src/engine/` and UI in `app/src/components/`.

### Kiro features used

- **Specs**: this requirements-first spec with a wave plan (`.kiro/specs/harder-ghosts/`).
- **Steering**: `tech.md`, `structure.md`, `product.md`, `content-accuracy.md` and `art-direction.md` shaped the requirements; three are edited by tasks 3.1 to 3.3.
- **Custom agent**: `accuracy-reviewer` runs over the new copy (task 12.2).
- **Hooks**: the data-check hook (`npm run check:data`) runs the three-level build and the dataset tests.
- **Playwright e2e**: `e2e/harder-ghosts.spec.ts` (task 11.2).

## Tasks

- [ ] 1. Verify the data sources (runs first)
  - [ ] 1.1 Commit the pinned CSV and write and run the read-only Source_Check
    - Download `hsk30-chars.csv` from commit `4ff9e3915ce87baaecd7ebe263085573a4ea3192` of `ivankra/hsk30` into `data/raw/hsk30/hsk30-chars.csv`; verify it is 3,001 lines, 108,366 bytes and SHA-256 `8c5957108e6dafd120be10518a827a4d834ea3ce29acbfedeff1022cd7d05280`; stop and report if any value differs
    - Write `scripts/check-level-sources.ts` and add `"check:levels": "tsx scripts/check-level-sources.ts"` to the root `package.json`; the script writes no data file. It reads the CSV and, for each character of `WritingLevel` 2 and 3, reports presence in `data/raw/hanzi-writer-data`, in Make Me a Hanzi `dictionary.txt`, in CC-CEDICT (simplified headword) and in Unihan `kCangjie` (exactly one value matching `^[A-Y]{1,5}$`), whether `selectPrompt` yields a prompt, and whether the source font cache (`data/raw/fonts/cache/LXGWWenKai-Regular.ttf`, through `cmapCoverage`) has a glyph
    - The script also prints the rows per level (300, 400, 500 expected), that level 1 rows equal `data/character-list.txt` in order, that no character is in two levels, the not-Playable characters per level, and the summon-ink class counts per level through the real parsers and `classifySummonInk`
    - Pure parts (CSV parsing, level split, report formatting) get unit tests in `tests/unit/check-level-sources.test.ts` with small fixtures; the run against the real files is reported, not asserted
    - Report the output to the human. If any item in Requirement 1.5 fails, write exactly what is missing (level, character, source) in the report and do not continue
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1_

- [ ] 2. Checkpoint - Source gate
  - Confirm task 1.1 reported nothing missing (400 and 500 characters, every source present, one valid Cangjie code each, a prompt each, a glyph each). If anything is missing, stop here and ask the human for a decision; do not start any later task. Expected not-Playable characters: 广 换 压 灭 (level 2) and 历 内 敌 锻 镜 宽 亏 杀 贡 (level 3).
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.5, 1.7_

- [ ] 3. Steering and spec amendments (approved by the human, wording to be confirmed)
  - [ ] 3.1 Edit `.kiro/steering/content-accuracy.md`
    - Apply the five wording changes listed under "Content-accuracy wording planned for approval" in `design.md`: the Character selection line (levels 1, 2, 3; exactly 300, 400, 500), the Cangjie unit test over all records of all Level_Datasets, the "not an answer leak" entry for the level screen's example meanings and Graveyard glyphs of met ghosts, the "Prompts of later levels" entry, and the required-tests line for every level
    - Change nothing else in the file; keep `tests/unit/content-accuracy-intro-link.test.ts` and `tests/unit/credits-readme.test.ts` passing
    - _Requirements: 15.1, 15.5, 15.6_
  - [ ] 3.2 Edit `.kiro/steering/art-direction.md` and its test
    - Add the row `| Level screen | none |` to the Primary action table; keep every other row
    - Extend `tests/unit/steering-art-direction.test.ts` with an assertion for the new row; remove no assertion
    - _Requirements: 12.2, 15.2, 15.5, 15.6_
  - [ ] 3.3 Edit `.kiro/steering/product.md`
    - In "Must-have" say the game has about 1,200 checked characters in three levels and that the Nightly Séance draws new ghosts from the chosen level; keep "Core game loop" unchanged
    - _Requirements: 15.3, 15.5, 15.6_
  - [ ] 3.4 Add the amendment notes to the other specs
    - Add "Amended (approved by the human): see harder-ghosts Requirement N" notes to: character-dataset `requirements.md` (Requirements 1 and 5, the glossary entry for the character list), ghost-game-core `requirements.md` (the Learning_Order item 6.12, the start-menu items and the Storage items), first-meeting `requirements.md` (Requirement 3, the first-ghost rule)
    - Add notes only; do not rewrite history and do not edit any `tasks.meta.json`
    - _Requirements: 15.4_

- [ ] 4. Level lists and the protected level 1
  - [ ] 4.1 Add the level lists and record the CSV in `SOURCES.md`
    - In `data/raw/SOURCES.md`, extend the HSK 3.0 section: levels 1, 2 and 3, the CSV file name, byte size, SHA-256 and the licence file
    - Create `data/character-list-level2.txt` (400 characters) and `data/character-list-level3.txt` (500 characters) from the CSV rows with `WritingLevel` 2 and 3, in row order, with `#` header lines in the form of `data/character-list.txt` (name, source, file, rule, commit, licence, original standard)
    - Add `tests/unit/level-lists.test.ts`: each list equals the CSV rows of its level in row order, the three lists share no character, every entry is one codepoint in U+4E00 to U+9FFF, the counts are 400 and 500, the CSV SHA-256 equals the value in `SOURCES.md`, and `data/character-list.txt` still equals the level 1 CSV rows
    - Do not change `data/character-list.txt` or `tests/smoke/character-list-bounds.test.ts` (it stays level 1 only)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [ ] 4.2 Record the level 1 protection test before any pipeline change
    - Compute the SHA-256 of the committed `app/public/data/characters.json` and of `data/prompt-review.csv` and `data/character-list.txt` as they are now (before task 5.3 and 5.4 run) and write them into `tests/unit/level1-protected.test.ts`
    - The test reads the three files and fails when a hash differs; its failure message says that changing level 1 needs the human's decision
    - _Requirements: 2.4, 3.9, 17.4_

- [ ] 5. Pipeline, data build, bundle check and fonts
  - [ ] 5.1 Add the shared types and the approvals parser
    - In `app/src/data/types.ts` add `Level`, `PromptReview`, the optional `promptReview` on `CharacterRecord`, `level` and `promptApprovalsPath` on `BuildOptions`, and `LevelManifest` and `LevelInfo` (fields as in the design)
    - Write `scripts/lib/parse-prompt-approvals.ts` (columns `character,reviewedBy`; reject an empty reviewer, a duplicate, a malformed row) in the style of `parse-prompt-overrides.ts`, with `tests/unit/parse-prompt-approvals.test.ts`
    - _Requirements: 4.3, 4.4, 4.7_
  - [ ] 5.2 Write the level helpers for the manifest
    - Write `scripts/lib/levels.ts`: `LEVEL_FILES`, `averageStrokes(records)`, `exampleMeanings(order, records)` (the rule of Requirement 5.2, using `cleanupMeaning`), `buildManifest(...)`, `serialiseManifest` (2-space JSON), `formatFileReport(path, records, raw, gzip)`
    - Tests in `tests/unit/levels-lib.test.ts` on hand-built records: positions ⌊n/4⌋, ⌊n/2⌋, ⌊3n/4⌋, skip of long or non-letter meanings, no repeated meaning, fewer than three usable records, one-decimal average, deterministic output
    - _Requirements: 5.1, 5.2, 3.6_
  - [ ] 5.3 Extend `serialise.ts` and `build-data.ts` to build all levels
    - `orderRecord` appends `promptReview` after `sources` only when defined; add a case to `tests/unit/serialise.test.ts` for present and absent
    - `buildDataset` sets `promptReview` after `mergeCharacter` when `opts.level` is 2 or 3 (override row or approval row gives `reviewed`, otherwise `unreviewed`) and never for level 1 or an absent level; the `buildDataset` signature and level 1 output stay as they are
    - Add exported `buildAllLevels(opts)` and `main()` changes: one `buildDataset` call per level with its list, its overrides file (absent means none) and the shared approvals file; all failures reported grouped by level; no file written unless every level succeeds; atomic writes of the three Level_Datasets, `levels.json`, `prompt-review.csv` and the two new Review_Files; per-level Cangjie and summon-ink lines and one report line per data file with record count, raw bytes and gzip bytes
    - Tests in `tests/unit/build-all-levels.test.ts` with fixtures for two small levels: failure in one level writes nothing and lists both levels' failures, `promptReview` for override, approval and neither, no field at level 1, deterministic bytes, the Review_File format and header, the manifest, the report lines
    - Keep every existing pipeline test passing without edits
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2_
  - [ ] 5.4 Run the build, commit the generated files and add the level dataset tests
    - Run `npm run build:data`; confirm `app/public/data/characters.json` and `data/prompt-review.csv` are unchanged (task 4.2's test passes) and that the three Level_Datasets, `levels.json`, `data/prompt-review-level2.csv` and `data/prompt-review-level3.csv` exist; report the printed byte counts
    - Add `tests/unit/level-datasets.test.ts` (plain unit tests over all three files): counts 300, 400, 500; Level_Datasets and Level_Lists agree character for character; no shared character; required fields present; components valid; every `cangjie` equals the verbatim Unihan value and `sources.cangjie` is right; the named not-Playable sets; `summonInk` valid for every record; `promptReview` present on all level 2 and 3 records and absent on level 1; every prompt is one of the record's own meanings and its pinyin is the tone-mark form of a reading from the same entry; the Review_Files have the header and one row per character in list order; the manifest equals what `buildManifest` returns for the files
    - Extend `tests/unit/cangjie-dataset.test.ts` and `tests/unit/summon-ink-dataset.test.ts` only by adding cases for levels 2 and 3 (their level 1 assertions on 300 records stay)
    - Run `npm run check:data` and report the result
    - _Requirements: 3.1, 3.3, 3.4, 3.8, 3.9, 3.10, 3.11, 4.4, 4.6, 4.9, 5.1_
  - [ ] 5.5 Generalise the bundle check
    - In `scripts/check-bundle-size.ts` replace `EXCLUDED_PATH` with a list of lazy paths (`data/characters.json`, `data/characters-level2.json`, `data/characters-level3.json` and the two lazy level font files by pattern `assets/lxgw-wenkai-subset-level*`), keep the budget at 300,000, count everything else, and print a second block "Lazy files (not counted)" with each file's gzip bytes
    - Extend `tests/unit/bundle-size.test.ts`: lazy paths are not counted, other data files (`data/levels.json`) are, the budget is unchanged, a fixture over budget still fails
    - _Requirements: 5.9, 5.10_
  - [ ] 5.6 Build the level font subsets
    - In `scripts/build-font.ts` keep `computeRepoGlyphSet` and the level 1 outputs unchanged; add `computeLevelGlyphSets(root)` and write `lxgw-wenkai-subset-level2.woff2` and `…-level3.woff2` under `app/src/assets/fonts/`, with one `@font-face` rule per subset in `app/src/styles/fonts.css` (same family name, disjoint `unicode-range`), and print glyph count, bytes, gzip bytes and SHA-256 per file; the build fails naming the character when the source font lacks a glyph
    - Run `npm run build:font` (the source font is checksum-verified and cached); confirm `data/fonts/glyph-set.txt` and `lxgw-wenkai-subset.woff2` are byte-identical to before (`git diff`); record the three subsets in `data/raw/fonts/SOURCES.md`
    - Extend `tests/build-font.test.ts`: disjoint glyph sets, union covers every key of the three Level_Datasets, three disjoint CSS rules, level 1 glyph set unchanged
    - Run `npm run build -w app` and `npm run check:bundle`; report the counted total and the lazy block
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6, 5.9_

- [ ] 6. Checkpoint - Data and pipeline
  - Run `npm test` and `npm run check:data`; confirm `git diff` shows no change to `app/public/data/characters.json`, `data/prompt-review.csv`, `data/character-list.txt`, `data/fonts/glyph-set.txt` and `app/src/assets/fonts/lxgw-wenkai-subset.woff2`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.9, 13.1, 17.4_

- [ ] 7. Storage, loader and engine
  - [ ] 7.1 Move the Save to schema version 3
    - In `app/src/storage/storage.ts` set `CURRENT_SCHEMA_VERSION` to 3; add `level` and `levelChosen` to `PersistedState`, the default state, `validateState`, `saveState`, `recordOutcome` and the setters; register migration `2` (`level: 1`, `levelChosen: introSeen`); add `getLevel`, `getLevelChosen`, `setLevel` and their default-store exports; update the comment above `SHIPPED_MIGRATIONS`
    - Extend `storage.test.ts` with the cases of Requirement 11.9 and the validation, newer-version, version 1 and unwritable-storage cases; change existing assertions only where they name the schema version or the default state, and say so in the task report
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6, 11.7, 11.9, 11.10_
  - [ ] 7.2 Extend the loader
    - In `app/src/data/charDataLoader.ts` add `levelUrl(level)`, `loadLevel(level)`, `loadManifest(url?)`, acceptance of `promptReview` (`'reviewed'` or `'unreviewed'`, anything else rejects the record) and manifest shape validation; keep `loadDataset`, `defaultDatasetUrl`, `getRecord`, `toHanziWriterData` and `makeCharDataLoader` as they are
    - Tests in `charDataLoader.test.ts`: URLs with the base path, valid and invalid `promptReview`, manifest shape cases, a level 2 file loads with a stubbed `fetch`
    - _Requirements: 4.7, 5.6, 5.7, 5.8_
  - [ ] 7.3 Write the level engine module
    - Write `app/src/engine/levels.ts` as in the design (`LEVELS`, `isLevel`, `sessionCharacterList`, `isLevelFinished`, `unplacedHistoryKeys`, `nextLevelToLoad`, `nextLevel`); pure, own-property checks, no input mutation
    - Tests in `levels.test.ts`: pool order and de-duplication, never-met other-level ghosts excluded, due ghosts of other levels included, finished level (empty order is not finished), `unplacedHistoryKeys` with `constructor` and `__proto__`, every branch of `nextLevelToLoad`, `nextLevel`
    - _Requirements: 5.3, 8.1, 8.2, 8.5, 8.8, 17.3_
  - [ ] 7.4 Extend the tablet tilt test to 500 positions
    - In `app/src/engine/tabletTilt.test.ts` add a case over positions 1 to 500 (same bounds as the existing 1 to 300 case); keep the existing case
    - _Requirements: 14.4_

- [ ] 8. Screens
  - [ ] 8.1 Build `LevelScreen`
    - Write `app/src/components/LevelScreen.tsx` and `LevelScreen.test.tsx` as in the design: three slips in order, lines from the manifest in the form of Requirement 6.3, no Chinese character anywhere, loading status with disabled choices, failure alert, manifest failure alert with names only, back slip and "Current level" with `aria-current` from the menu, no `slip-primary`, buttons at least 44 px high, any transition inside the `no-preference` block of `index.css`
    - _Requirements: 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 6.9, 12.1, 12.2, 12.4, 12.5_
  - [ ] 8.2 Extend `StartMenu`
    - Add the props `level`, `onChooseLevel` and `finishedNotice`; render the "Starting level: N" slip under the primary button and the notice with its "Move on to level N+1" slip for levels 1 and 2; keep one primary button
    - Extend `StartMenu.test.tsx`: slip text and callback, notice at levels 1, 2 and 3, one `slip-primary`; keep the existing cases (add the new required props to their render calls)
    - _Requirements: 7.1, 7.5, 8.6, 8.7_
  - [ ] 8.3 Extend `Graveyard`
    - Change the props as in the design; add the level group (`aria-pressed` and the "showing" cue), the loading and failure states, the per-level intro sentence and the label "Ghost P of T, never met" with T the shown level's count
    - Extend `Graveyard.test.tsx`: default level, switching, counts add up to the level count, never-met graves carry no character, met ghosts of the shown level show their glyph, failure keeps the previous level; the existing "Never met: 300" and "Ghost 4 of 300" cases keep passing for level 1
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 12.1_
  - [ ] 8.4 Update the credits data, the Credits screen and the README table
    - In `app/src/data/credits.ts` replace the character-list row (name "Character list — HSK 3.0 writing levels 1 to 3", use "the 300, 400 and 500 characters taught in the app, in three levels"), add exported constants for the keyboard limitation line and the unreviewed-prompts sentence; show both in `Credits.tsx` (the sentence only while the constant says some prompts are unreviewed)
    - Update the matching README table row and add the "Known limitations" section with the line of Requirement 16.4, so `tests/unit/credits-readme.test.ts` keeps passing
    - Tests: `Credits.test.tsx` for the new row and lines; `tests/unit/level-datasets.test.ts` (or a new `tests/unit/credits-prompts.test.ts`) asserts the unreviewed sentence is present exactly while a record is unreviewed
    - _Requirements: 16.1, 16.4, 16.5, 16.6, 16.7_

- [ ] 9. App wiring
  - [ ] 9.1 Wire levels into `App.tsx`
    - Add the `level` view, the loaded-levels state, the manifest state, `ensureLevel`, the start-up load plan (`nextLevelToLoad`), the Chosen_Level state read from the Save, the merged lookup passed to the séance, the Graveyard level state and loading, the menu notice, and the intro `onBegin` branch on `levelChosen`
    - Extend `planSeance` with the optional `scope` argument (session pool and level 1 walkthrough) and keep `buildSession` and the no-scope behaviour as today; add `startSeance` for the Chosen_Level; pass the level 1 dataset to `CangjieGuide`
    - Tests: update `App.test.tsx` and `App.leaveSaved.test.tsx` only where the first-run flow now passes through the Level_Screen (say so in the report); add cases for first run at levels 1, 2 and 3 (guided first ghost first at all three, rest from the chosen level), start-up load of a saved level 2, history in level 3 with Chosen_Level 1, changing level from the menu keeps history, a failed level load, the finished-level notice, and `planSeance` for a level 1 Brand_New_Player equal to today's session
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.5, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 11.4, 11.8, 14.1_

- [ ] 10. Cangjie Oracle
  - [ ] 10.1 Read all three levels in the Oracle
    - In `oracle/src/dataset.ts` read the three Level_Datasets and merge them; update the Oracle's tests, `oracle/power` text and README Oracle section to say 1,200 characters; keep `tsc --noEmit` in `oracle/` clean
    - _Requirements: 14.3_

- [ ] 11. End-to-end tests
  - [ ] 11.1 Update the e2e helpers
    - In `e2e/helpers.ts` make `SeedState` version 3 (`level`, `levelChosen`), add `seedV2` for the migration test, add `levelDatasetMap(level)` and `levelOrder(level)`; keep `datasetKeys`, `datasetMap`, `datasetRecord` and `seedBefore` reading level 1
    - _Requirements: 12.7, 14.2_
  - [ ] 11.2 Add `e2e/harder-ghosts.spec.ts`
    - Cover: first run intro → Level_Screen → first séance for level 2 with the guided first ghost; one-screen fit (no vertical scroll) and no horizontal scroll of the Level_Screen at 1024 × 768, 375 × 812 and 320 × 640; no Chinese character on the Level_Screen; change level from the menu with the history unchanged; Graveyard level switch with counts that add up and no never-met glyph; a version 2 seed opens on the menu at level 1 with history intact
    - _Requirements: 6.1, 6.4, 7.2, 7.3, 9.1, 10.3, 10.4, 10.6, 11.4, 12.3, 12.6_
  - [ ] 11.3 Diagnose and fix the existing e2e specs
    - Run `npm run test:e2e`; change only what fails because of this feature (the seed type, the first-run path through the Level_Screen, Graveyard text); keep every assertion's intent and add `320 × 640` to `e2e/no-horizontal-overflow.spec.ts` for the new screen only
    - _Requirements: 12.3, 12.6, 17.2_

- [ ] 12. README and accuracy review
  - [ ] 12.1 Finish the README
    - Update the character counts, the "Build the dataset" and "Check" instructions (three outputs, manifest, review files, approvals file), the bundle and file weights from the real build output, the reviewed and unreviewed prompt counts, and the Oracle count; keep the Known limitations line from task 8.4
    - _Requirements: 14.5, 16.1, 16.2, 16.3, 16.4_
  - [ ] 12.2 Run the accuracy reviewer
    - Invoke the `accuracy-reviewer` agent on the new app text, the README changes and this spec; fix findings in the new text only
    - _Requirements: 16.7_

- [ ] 13. Human tasks (Kiro does not do these)
  - [ ] 13.1 HUMAN TASK: review the level 2 and level 3 prompts
    - Open `data/prompt-review-level2.csv` and `data/prompt-review-level3.csv`; for each prompt that needs a different gloss add a row to `data/prompt-overrides-level2.csv` or `-level3.csv` (columns `character,entryIndex,meaningIndex,reviewedBy`), and add accepted prompts to `data/prompt-approvals.csv` (`character,reviewedBy`); then run `npm run build:data`
    - _Requirements: 4.8, 17.5_
  - [ ] 13.2 HUMAN TASK: spot-check a random sample of the new characters
    - Check meaning, pinyin and components of a random sample before deploy and record the result in `kiro-log.md` (content-accuracy.md manual review)
    - _Requirements: 17.5_
  - [ ] 13.3 HUMAN TASK: review the Level_Screen screenshots
    - Review the Level_Screen and the Graveyard switcher at 1024 × 768, 375 × 812 and 320 × 640 for art direction and wording
    - _Requirements: 12.4, 17.5_

- [ ] 14. Final checkpoint
  - Run `npm test`, then `npx tsc --noEmit` at the repository root, `npx tsc --noEmit -p app` and `npx tsc --noEmit -p oracle` (no errors), `npm run build -w app`, `npm run check:bundle` (passes, counted total under 300,000) and `npm run test:e2e` (all pass, including `harder-ghosts.spec.ts`)
  - Report the real sizes: each Level_Dataset's raw and gzip bytes, `levels.json`, each font subset, the counted bundle total
  - Confirm with `git diff --stat` that `app/public/data/characters.json`, `data/prompt-review.csv`, `data/prompt-overrides.csv`, `data/character-list.txt`, `scheduler.ts`, `outcome.ts`, `config.ts`, `learningOrder.ts` and `lxgw-wenkai-subset.woff2` are untouched; search the added and changed files for `any`, for personal names and for `.kiro/` in `.gitignore`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.6, 17.7_

## Notes

- There are no optional tasks. Every test task is required. No property-based test is added (tech.md, decision of Nov 15); the existing property tests stay as they are.
- Task 1.1 is the data-source verification and runs first. Task 2 is a hard stop: if a source lacks a level or a character, the plan waits for the human's decision.
- Tasks 13.1 to 13.3 are human tasks. Kiro does not execute them, does not write override or approval rows, and does not edit `kiro-log.md`.
- Task 4.2 must finish before tasks 5.3 and 5.4 so the level 1 hashes are recorded from the unchanged files.
- Open questions are listed at the end of `requirements.md`; the tasks follow the recommended answers.
- Steering edits (tasks 3.1 to 3.3) are approved by the human, with the exact wording still to be confirmed. Do not edit steering files anywhere else.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4", "4.1", "4.2"] },
    { "id": 2, "tasks": ["5.1"] },
    { "id": 3, "tasks": ["5.2", "5.5", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 4, "tasks": ["5.3", "8.1", "8.2", "8.3"] },
    { "id": 5, "tasks": ["5.4"] },
    { "id": 6, "tasks": ["5.6", "8.4", "10.1", "11.1"] },
    { "id": 7, "tasks": ["9.1"] },
    { "id": 8, "tasks": ["11.2", "11.3"] },
    { "id": 9, "tasks": ["12.1"] },
    { "id": 10, "tasks": ["12.2"] },
    { "id": 11, "tasks": ["13.1", "13.2", "13.3"] }
  ]
}
```
