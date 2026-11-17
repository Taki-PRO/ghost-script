# Implementation Plan: harder-ghosts

## Overview

Add HSK 3.0 writing level 2 (400 characters) and level 3 (500 characters), split the data by level, let the player choose a starting level, and keep every existing record, prompt, rule and test intact. The plan runs in this order: verify the data sources first (automatic; it stops for the human only if the result differs from the expected one); amend the steering files; add the lists and the level 1 protection test; extend the pipeline (minified level files, review samples, generated prompt counts) and build the data; add storage, loader and engine code; build the screens; wire the App; update the Oracle; add the e2e tests; update the README; run the final checks.

Rules for every task:

- Do not edit `kiro-log.md`, `tasks.meta.json` or any steering file outside tasks 3.1 to 3.3 (steering edits, approved by the human as worded in the design).
- Never write a personal name in a repository file, data files included; approvals read "approved by the human". Every `reviewedBy` value in a new file or new row is exactly `human` (empty on an unreviewed row); the level 1 files `data/prompt-overrides.csv` and `data/prompt-review.csv` are left as they are.
- Never weaken, skip, delete or loosen a test. A test may change only where it names the schema version, the default state or a dataset count, and the task says so.
- Add no property-based test and no mutation test (decision of Nov 15). Existing property tests stay and must pass.
- Do not touch `app/public/data/characters.json`, `data/character-list.txt`, `data/prompt-review.csv`, `data/prompt-overrides.csv`, the level 1 font subset, the rite constants, `scheduler.ts`, `outcome.ts` or `config.ts`, except where a task says otherwise with its reason.
- Do not create `data/prompt-overrides-level2.csv`, `data/prompt-overrides-level3.csv` or `data/prompt-approvals.csv`, and do not review any prompt. They are written by the human (tasks 13.1 and 13.2).
- Keep engine logic in `app/src/engine/` and UI in `app/src/components/`.

### Kiro features used

- **Specs**: this requirements-first spec with a wave plan (`.kiro/specs/harder-ghosts/`).
- **Steering**: `tech.md`, `structure.md`, `product.md`, `content-accuracy.md` and `art-direction.md` shaped the requirements; three are edited by tasks 3.1 to 3.3.
- **Custom agent**: `accuracy-reviewer` runs over the new copy (task 12.2).
- **Hooks**: the data-check hook (`npm run check:data`) runs the three-level build and the dataset tests.
- **Playwright e2e**: `e2e/harder-ghosts.spec.ts` (task 11.2).

## Tasks

- [x] 1. Verify the data sources (runs first)
  - [x] 1.1 Commit the pinned CSV and write and run the read-only Source_Check
    - Download `hsk30-chars.csv` from commit `4ff9e3915ce87baaecd7ebe263085573a4ea3192` of `ivankra/hsk30` into `data/raw/hsk30/hsk30-chars.csv`; verify it is 3,001 lines, 108,366 bytes and SHA-256 `8c5957108e6dafd120be10518a827a4d834ea3ce29acbfedeff1022cd7d05280`; stop and report if any value differs
    - Write `scripts/check-level-sources.ts` and add `"check:levels": "tsx scripts/check-level-sources.ts"` to the root `package.json`; the script writes no data file. It reads the CSV and, for each character of `WritingLevel` 2 and 3, reports presence in `data/raw/hanzi-writer-data`, in Make Me a Hanzi `dictionary.txt`, in CC-CEDICT (simplified headword) and in Unihan `kCangjie` (exactly one value matching `^[A-Y]{1,5}$`), whether `selectPrompt` yields a prompt, and whether the source font cache (`data/raw/fonts/cache/LXGWWenKai-Regular.ttf`, through `cmapCoverage`) has a glyph
    - The script also prints the rows per level (300, 400, 500 expected), that level 1 rows equal `data/character-list.txt` in order, that no character is in two levels, the not-Playable characters per level, and the summon-ink class counts per level through the real parsers and `classifySummonInk`
    - Pure parts (CSV parsing, level split, report formatting) get unit tests in `tests/unit/check-level-sources.test.ts` with small fixtures; the run against the real files is reported, not asserted
    - The script compares its result with the Expected_Result (Requirement 1.8) through a pure function `compareToExpected(report)` that returns every difference (item, level, character, source, expected, found). It exits 0 when there is no difference and 1 otherwise, printing what differs; the expected sets are constants in the script (400 and 500 characters; not-Playable 广 换 压 灭 and 历 内 敌 锻 镜 宽 亏 杀 贡), and unit tests cover an equal report and each kind of difference
    - Run it and report the output. Do not ask the human when it exits 0
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1_

- [x] 2. Checkpoint - Source gate
  - Automatic gate. If `npm run check:levels` (task 1.1) exited 0, the result equals the Expected_Result (400 and 500 characters, no overlap, every character in hanzi-writer-data, Make Me a Hanzi, CC-CEDICT and Unihan `kCangjie`, not-Playable exactly 广 换 压 灭 at level 2 and 历 内 敌 锻 镜 宽 亏 杀 贡 at level 3): continue to the next task without asking the human.
  - If it exited 1, stop here, tell the human exactly what differs (the script's output), and do not start any later task.
  - Run the tests of task 1.1; they must pass.
  - _Requirements: 1.5, 1.7, 1.8_

- [x] 3. Steering and spec amendments (approved by the human, as worded in the design)
  - [x] 3.1 Edit `.kiro/steering/content-accuracy.md`
    - Apply the five wording changes listed under "Content-accuracy wording planned for approval" in `design.md`: the Character selection line (levels 1, 2, 3; exactly 300, 400, 500), the Cangjie unit test over all records of all Level_Datasets, the "not an answer leak" entry for the level screen's example meanings and Graveyard glyphs of met ghosts, the "Prompts of later levels" entry, and the required-tests line for every level
    - Change nothing else in the file; keep `tests/unit/content-accuracy-intro-link.test.ts` and `tests/unit/credits-readme.test.ts` passing
    - _Requirements: 15.1, 15.5, 15.6_
  - [x] 3.2 Edit `.kiro/steering/art-direction.md` and its test
    - Add the row `| Level screen | none |` to the Primary action table; keep every other row
    - Extend `tests/unit/steering-art-direction.test.ts` with an assertion for the new row; remove no assertion
    - _Requirements: 12.2, 15.2, 15.5, 15.6_
  - [x] 3.3 Edit `.kiro/steering/product.md`
    - In "Must-have" say the game has about 1,200 checked characters in three levels and that the Nightly Séance draws new ghosts from the chosen level; keep "Core game loop" unchanged
    - _Requirements: 15.3, 15.5, 15.6_
  - [x] 3.4 Add the amendment notes to the other specs
    - Add "Amended (approved by the human): see harder-ghosts Requirement N" notes to: character-dataset `requirements.md` (Requirements 1 and 5, the glossary entry for the character list), ghost-game-core `requirements.md` (the Learning_Order item 6.12, the start-menu items and the Storage items), first-meeting `requirements.md` (Requirement 3, the first-ghost rule)
    - Add notes only; do not rewrite history and do not edit any `tasks.meta.json`
    - _Requirements: 15.4_

- [x] 4. Level lists and the protected level 1
  - [x] 4.1 Add the level lists and record the CSV in `SOURCES.md`
    - In `data/raw/SOURCES.md`, extend the HSK 3.0 section: levels 1, 2 and 3, the CSV file name, byte size, SHA-256 and the licence file
    - Create `data/character-list-level2.txt` (400 characters) and `data/character-list-level3.txt` (500 characters) from the CSV rows with `WritingLevel` 2 and 3, in row order, with `#` header lines in the form of `data/character-list.txt` (name, source, file, rule, commit, licence, original standard)
    - Add `tests/unit/level-lists.test.ts`: each list equals the CSV rows of its level in row order, the three lists share no character, every entry is one codepoint in U+4E00 to U+9FFF, the counts are 400 and 500, the CSV SHA-256 equals the value in `SOURCES.md`, and `data/character-list.txt` still equals the level 1 CSV rows
    - Do not change `data/character-list.txt` or `tests/smoke/character-list-bounds.test.ts` (it stays level 1 only)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [x] 4.2 Record the level 1 protection test before any pipeline change
    - Compute the SHA-256 of the committed `app/public/data/characters.json` and of `data/prompt-review.csv` and `data/character-list.txt` as they are now (before task 5.3 and 5.4 run) and write them into `tests/unit/level1-protected.test.ts`
    - The test reads the three files and fails when a hash differs; its failure message says that changing level 1 needs the human's decision
    - _Requirements: 2.4, 3.9, 17.4_

- [x] 5. Pipeline, data build, bundle check and fonts
  - [x] 5.1 Add the shared types and the approvals parser
    - In `app/src/data/types.ts` add `Level`, `PromptReview`, the optional `promptReview` on `CharacterRecord`, `level` and `promptApprovalsPath` on `BuildOptions`, and `LevelManifest` and `LevelInfo` (fields as in the design)
    - Write `scripts/lib/parse-prompt-approvals.ts` (columns `character,reviewedBy`; reject a `reviewedBy` that is not exactly `human`, a duplicate, a malformed row) in the style of `parse-prompt-overrides.ts`, with `tests/unit/parse-prompt-approvals.test.ts`
    - Give the overrides parser an optional `requiredReviewer: 'human'` setting used for the level 2 and 3 files only; the level 1 call and `data/prompt-overrides.csv` stay as they are, and the existing parser tests pass unchanged
    - _Requirements: 4.3, 4.4, 4.7, 4.16_
  - [x] 5.2 Write the level helpers for the manifest
    - Write `scripts/lib/levels.ts`: `LEVEL_FILES`, `averageStrokes(records)`, `exampleMeanings(order, records)` (the rule of Requirement 5.2, using `cleanupMeaning`), `buildManifest(...)`, `serialiseManifest` (2-space JSON), `formatFileReport(path, records, raw, gzip)`
    - Tests in `tests/unit/levels-lib.test.ts` on hand-built records: positions ⌊n/4⌋, ⌊n/2⌋, ⌊3n/4⌋, skip of long or non-letter meanings, no repeated meaning, fewer than three usable records, one-decimal average, deterministic output
    - _Requirements: 5.1, 5.2, 3.6_
  - [x] 5.3 Extend `serialise.ts` and `build-data.ts` to build all levels
    - `orderRecord` appends `promptReview` after `sources` only when defined; `serialiseDataset` gets an optional `{ minify }` that writes JSON with no whitespace (level 1 keeps the 2-space form); add cases to `tests/unit/serialise.test.ts` for present and absent `promptReview` and for minified output (parses equal to the pretty form, no newline)
    - `buildDataset` sets `promptReview` after `mergeCharacter` when `opts.level` is 2 or 3 (override row or approval row gives `reviewed`, otherwise `unreviewed`) and never for level 1 or an absent level; the `buildDataset` signature and level 1 output stay as they are
    - Add exported `buildAllLevels(opts)` and `main()` changes: one `buildDataset` call per level with its list, its overrides file (absent means none) and the shared approvals file; all failures reported grouped by level; no file written unless every level succeeds; atomic writes of the three Level_Datasets (levels 2 and 3 minified, level 1 byte-identical), `levels.json`, `prompt-review.csv` and the two new Review_Files, the two Review_Samples and the Sample_Provenance (task 5.7), and `promptCounts.generated.ts` and the README counts block (task 5.8); per-level Cangjie and summon-ink lines and one report line per data file with record count, raw bytes and gzip bytes (`characters.json`, both level files, `levels.json`)
    - Tests in `tests/unit/build-all-levels.test.ts` with fixtures for two small levels: failure in one level writes nothing and lists both levels' failures, `promptReview` for override, approval and neither, no field at level 1, deterministic bytes, the Review_File format and header (`reviewedBy` `human` or empty), the manifest, the report lines, the written sample files and counts
    - Keep every existing pipeline test passing without edits
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.12, 3.13, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.10, 4.13, 5.1, 5.2_
  - [x] 5.4 Run the build, commit the generated files and add the level dataset tests
    - Run `npm run build:data`; confirm `app/public/data/characters.json` and `data/prompt-review.csv` are unchanged (task 4.2's test passes) and that the three Level_Datasets, `levels.json`, `data/prompt-review-level2.csv`, `data/prompt-review-level3.csv`, the two Review_Samples, the Sample_Provenance and `app/src/data/promptCounts.generated.ts` exist; report the printed raw and gzip byte counts of `characters.json`, both level files and `levels.json`
    - Add `tests/unit/level-datasets.test.ts` (plain unit tests over all three files): counts 300, 400, 500; Level_Datasets and Level_Lists agree character for character; no shared character; required fields present; components valid; every `cangjie` equals the verbatim Unihan value and `sources.cangjie` is right; the named not-Playable sets; `summonInk` valid for every record; `promptReview` present on all level 2 and 3 records and absent on level 1; every prompt is one of the record's own meanings and its pinyin is the tone-mark form of a reading from the same entry; the Review_Files have the header and one row per character in list order; the manifest equals what `buildManifest` returns for the files; the level 2 and 3 files are minified (no newline, parse equal to the pretty form built in the test) and `characters.json` is still pretty-printed
    - Extend `tests/unit/cangjie-dataset.test.ts` and `tests/unit/summon-ink-dataset.test.ts` only by adding cases for levels 2 and 3 (their level 1 assertions on 300 records stay)
    - Add `tests/unit/reviewed-by.test.ts` (Requirement 4.16): `checkReviewedBy` fails on any value other than `human` (or empty on an unreviewed row) in the level 2 and 3 Review_Files, both Review_Samples, `data/prompt-approvals.csv` and `data/prompt-overrides-level2.csv` and `-level3.csv` when they exist; for `data/prompt-overrides.csv` it pins the existing rows and accepts a new row only with `human`; for `data/prompt-review.csv` it accepts exactly `human-approved` and empty. It does not rewrite either level 1 file
    - Add `tests/unit/review-sample.test.ts` (Requirement 4.12): the committed samples equal a fresh generation, same seed gives identical bytes, exactly 50 distinct rows, all from that level's Review_File, same header, the provenance file equals a fresh one
    - Run `npm run check:data` and report the result
    - _Requirements: 3.1, 3.3, 3.4, 3.8, 3.9, 3.10, 3.11, 3.12, 4.4, 4.6, 4.9, 4.12, 4.16, 5.1_
  - [x] 5.5 Generalise the bundle check
    - In `scripts/check-bundle-size.ts` replace `EXCLUDED_PATH` with a list of lazy paths (`data/characters.json`, `data/characters-level2.json`, `data/characters-level3.json` and the two lazy level font files by pattern `assets/lxgw-wenkai-subset-level*`), keep the budget at 300,000, count everything else, and print a second block "Lazy files (not counted)" with each file's raw and gzip bytes
    - Extend `tests/unit/bundle-size.test.ts`: lazy paths are not counted, other data files (`data/levels.json`) are, the budget is unchanged, a fixture over budget still fails
    - _Requirements: 5.9, 5.10_
  - [x] 5.6 Build the level font subsets
    - In `scripts/build-font.ts` keep `computeRepoGlyphSet` and the level 1 outputs unchanged; add `computeLevelGlyphSets(root)` and write `lxgw-wenkai-subset-level2.woff2` and `…-level3.woff2` under `app/src/assets/fonts/`, with one `@font-face` rule per subset in `app/src/styles/fonts.css` (same family name, disjoint `unicode-range`), and print glyph count, raw bytes, gzip bytes and SHA-256 per file; the build fails naming the character when the source font lacks a glyph
    - Run `npm run build:font` (the source font is checksum-verified and cached); confirm `data/fonts/glyph-set.txt` and `lxgw-wenkai-subset.woff2` are byte-identical to before (`git diff`); record the three subsets in `data/raw/fonts/SOURCES.md`
    - Extend `tests/build-font.test.ts`: disjoint glyph sets, union covers every key of the three Level_Datasets, three disjoint CSS rules, level 1 glyph set unchanged
    - Run `npm run build -w app` and `npm run check:bundle`; report the counted total and the lazy block
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6, 5.9_

  - [x] 5.7 Write the review-sample module (pure)
    - Write `scripts/lib/review-sample.ts` as in the design ("Review samples and prompt counts"): `fnv1a32`, `mulberry32`, `sampleRows(n, 50, seed)` (partial Fisher–Yates, result sorted ascending), `buildReviewSample(reviewCsv, level)` (header and rows copied byte for byte, fails when fewer than 50 data rows), `buildSampleProvenance(...)` and its JSON serialisation; seed strings `ghost-script/prompt-review-sample/v1/level2` and `…/level3`
    - Tests in `tests/unit/review-sample-lib.test.ts` on small fixtures: known FNV-1a values, a fixed expected position list for a small `n` and seed, same seed gives identical bytes, exactly 50 distinct rows, all rows from the input, header kept, fewer than 50 rows throws, provenance content
    - _Requirements: 4.10, 4.11, 4.12_
  - [x] 5.8 Write the prompt-counts module and add the README markers
    - Write `scripts/lib/prompt-counts.ts`: `computePromptCounts(datasets)`, `renderCountsModule(counts)` (the content of `app/src/data/promptCounts.generated.ts`, with a "generated, do not edit" header), `renderReadmeBlock(counts)` and `replaceReadmeBlock(readme, block)` (fails when a marker is missing)
    - Add the markers `<!-- prompt-counts:start -->` and `<!-- prompt-counts:end -->` to `README.md` in its prompt-review section, with a placeholder sentence that the build replaces; add no typed number
    - Tests in `tests/unit/prompt-counts.test.ts` on hand-built records: counts per level and together, records without the field are not counted, rendered module and block, missing-marker failure, replacement is idempotent
    - _Requirements: 4.13, 4.14, 4.15_

- [x] 6. Checkpoint - Data and pipeline
  - Run `npm test` and `npm run check:data`; confirm the review samples have 50 rows each and the counts file matches the data; confirm `git diff` shows no change to `app/public/data/characters.json`, `data/prompt-review.csv`, `data/character-list.txt`, `data/fonts/glyph-set.txt` and `app/src/assets/fonts/lxgw-wenkai-subset.woff2`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.9, 13.1, 17.4_

- [x] 7. Storage, loader and engine
  - [x] 7.1 Move the Save to schema version 3
    - In `app/src/storage/storage.ts` set `CURRENT_SCHEMA_VERSION` to 3; add `level` and `levelChosen` to `PersistedState`, the default state, `validateState`, `saveState`, `recordOutcome` and the setters; register migration `2` (`level: 1`, `levelChosen: introSeen`); add `getLevel`, `getLevelChosen`, `setLevel` and their default-store exports; update the comment above `SHIPPED_MIGRATIONS`
    - Extend `storage.test.ts` with the cases of Requirement 11.9 and the validation, newer-version, version 1 and unwritable-storage cases; change existing assertions only where they name the schema version or the default state, and say so in the task report
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6, 11.7, 11.9, 11.10_
  - [x] 7.2 Extend the loader
    - In `app/src/data/charDataLoader.ts` add `levelUrl(level)`, `loadLevel(level)`, `loadManifest(url?)`, acceptance of `promptReview` (`'reviewed'` or `'unreviewed'`, anything else rejects the record) and manifest shape validation; keep `loadDataset`, `defaultDatasetUrl`, `getRecord`, `toHanziWriterData` and `makeCharDataLoader` as they are
    - Tests in `charDataLoader.test.ts`: URLs with the base path, valid and invalid `promptReview`, manifest shape cases, a level 2 file loads with a stubbed `fetch`
    - _Requirements: 4.7, 5.6, 5.7, 5.8_
  - [x] 7.3 Write the level engine module
    - Write `app/src/engine/levels.ts` as in the design (`LEVELS`, `isLevel`, `sessionCharacterList`, `isLevelFinished`, `unplacedHistoryKeys`, `nextLevelToLoad`, `nextLevel`); pure, own-property checks, no input mutation
    - Tests in `levels.test.ts`: pool order and de-duplication, never-met other-level ghosts excluded, due ghosts of other levels included, finished level (empty order is not finished), `unplacedHistoryKeys` with `constructor` and `__proto__`, every branch of `nextLevelToLoad`, `nextLevel`
    - _Requirements: 5.3, 8.1, 8.2, 8.5, 8.8, 17.3_
  - [x] 7.4 Extend the tablet tilt test to 500 positions
    - In `app/src/engine/tabletTilt.test.ts` add a case over positions 1 to 500 (same bounds as the existing 1 to 300 case); keep the existing case
    - _Requirements: 14.4_

- [x] 8. Screens
  - [x] 8.1 Build `LevelScreen`
    - Write `app/src/components/LevelScreen.tsx` and `LevelScreen.test.tsx` as in the design: three slips in order, lines from the manifest in the form of Requirement 6.3, no Chinese character anywhere, loading status with disabled choices, failure alert, manifest failure alert with names only, back slip and "Current level" with `aria-current` from the menu, no `slip-primary`, buttons at least 44 px high, any transition inside the `no-preference` block of `index.css`
    - _Requirements: 6.2, 6.3, 6.4, 6.6, 6.7, 6.8, 6.9, 12.1, 12.2, 12.4, 12.5_
  - [x] 8.2 Extend `StartMenu`
    - Add the props `level`, `onChooseLevel` and `finishedNotice`; render the "Starting level: N" slip under the primary button and the notice with its "Move on to level N+1" slip for levels 1 and 2; keep one primary button
    - Extend `StartMenu.test.tsx`: slip text and callback, notice at levels 1, 2 and 3, one `slip-primary`; keep the existing cases (add the new required props to their render calls)
    - _Requirements: 7.1, 7.5, 8.6, 8.7_
  - [x] 8.3 Extend `Graveyard`
    - Change the props as in the design; add the level group (`aria-pressed` and the "showing" cue), the loading and failure states, the per-level intro sentence and the label "Ghost P of T, never met" with T the shown level's count
    - Extend `Graveyard.test.tsx`: default level, switching, counts add up to the level count, never-met graves carry no character, met ghosts of the shown level show their glyph, failure keeps the previous level; the existing "Never met: 300" and "Ghost 4 of 300" cases keep passing for level 1
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 12.1_
  - [x] 8.4 Update the credits data, the Credits screen and the README table
    - In `app/src/data/credits.ts` replace the character-list row (name "Character list — HSK 3.0 writing levels 1 to 3", use "the 300, 400 and 500 characters taught in the app, in three levels"), add exported constants for the keyboard limitation line and the unreviewed-prompts sentence built from `PROMPT_COUNTS` (`app/src/data/promptCounts.generated.ts`, no typed number); show both in `Credits.tsx` (the sentence only while `PROMPT_COUNTS.unreviewed` is above zero)
    - Update the matching README table row and add the "Known limitations" section with the line of Requirement 16.4 (keyboard-only; also shown on the Sources & licences screen), so `tests/unit/credits-readme.test.ts` keeps passing
    - Tests: `Credits.test.tsx` for the new row and lines; `tests/unit/level-datasets.test.ts` (or a new `tests/unit/credits-prompts.test.ts`) asserts the unreviewed sentence is present exactly while a record is unreviewed and that the R, T and U it shows equal a fresh count over the three data files and the README block
    - _Requirements: 4.14, 4.15, 16.1, 16.4, 16.5, 16.6, 16.7_

- [x] 9. App wiring
  - [x] 9.1 Wire levels into `App.tsx`
    - Add the `level` view, the loaded-levels state, the manifest state, `ensureLevel`, the start-up load plan (`nextLevelToLoad`), the Chosen_Level state read from the Save, the merged lookup passed to the séance, the Graveyard level state and loading, the menu notice, and the intro `onBegin` branch on `levelChosen`
    - Extend `planSeance` with the optional `scope` argument (session pool and level 1 walkthrough) and keep `buildSession` and the no-scope behaviour as today; add `startSeance` for the Chosen_Level; pass the level 1 dataset to `CangjieGuide`
    - Tests: update `App.test.tsx` and `App.leaveSaved.test.tsx` only where the first-run flow now passes through the Level_Screen (say so in the report); add cases for first run at levels 1, 2 and 3 (guided first ghost first at all three, rest from the chosen level), start-up load of a saved level 2, history in level 3 with Chosen_Level 1, changing level from the menu keeps history, a failed level load, the finished-level notice, and `planSeance` for a level 1 Brand_New_Player equal to today's session
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.5, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 11.4, 11.8, 14.1_

- [x] 10. Cangjie Oracle
  - [x] 10.1 Read all three levels in the Oracle
    - In `oracle/src/dataset.ts` read the three Level_Datasets and merge them; update the Oracle's tests, `oracle/power` text and README Oracle section to say 1,200 characters; keep `tsc --noEmit` in `oracle/` clean
    - _Requirements: 14.3_

- [x] 11. End-to-end tests
  - [x] 11.1 Update the e2e helpers
    - In `e2e/helpers.ts` make `SeedState` version 3 (`level`, `levelChosen`), add `seedV2` for the migration test, add `levelDatasetMap(level)` and `levelOrder(level)`; keep `datasetKeys`, `datasetMap`, `datasetRecord` and `seedBefore` reading level 1
    - _Requirements: 12.7, 14.2_
  - [x] 11.2 Add `e2e/harder-ghosts.spec.ts`
    - Cover: first run intro → Level_Screen → first séance for level 2 with the guided first ghost; one-screen fit (no vertical scroll) and no horizontal scroll of the Level_Screen at 1024 × 768, 375 × 812 and 320 × 640; no Chinese character on the Level_Screen; change level from the menu with the history unchanged; Graveyard level switch with counts that add up and no never-met glyph; a version 2 seed opens on the menu at level 1 with history intact
    - _Requirements: 6.1, 6.4, 7.2, 7.3, 9.1, 10.3, 10.4, 10.6, 11.4, 12.3, 12.6_
  - [x] 11.3 Diagnose and fix the existing e2e specs
    - Run `npm run test:e2e`; change only what fails because of this feature (the seed type, the first-run path through the Level_Screen, Graveyard text); keep every assertion's intent and add `320 × 640` to `e2e/no-horizontal-overflow.spec.ts` for the new screen only
    - _Requirements: 12.3, 12.6, 17.2_

- [x] 12. README and accuracy review
  - [x] 12.1 Finish the README
    - Update the character counts, the "Build the dataset" and "Check" instructions (three outputs, manifest, review files, approvals file), the bundle and file weights from the real build output, the Oracle count, a prompt-review section that states the sample algorithm and both seed strings (from the Sample_Provenance) and a short note on `data/prompt-review-sample-level2.csv` and `-level3.csv`; the reviewed and unreviewed counts stay in the generated block and are not typed; keep the Known limitations line from task 8.4
    - _Requirements: 4.11, 4.14, 14.5, 16.1, 16.2, 16.3, 16.4_
  - [x] 12.2 Run the accuracy reviewer
    - Invoke the `accuracy-reviewer` agent on the new app text, the README changes and this spec; fix findings in the new text only
    - _Requirements: 16.7_

  - [x] 12.3 Add the first-ghosts report script
    - Write `scripts/report-first-ghosts.ts` (`"report:ghosts"` in the root `package.json`) with a pure formatter in `scripts/lib/report-first-ghosts.ts`: it reads `characters-level2.json` and `characters-level3.json`, orders each with the app's `learningOrder`, and prints the first ten ghosts of each level with character, `prompt.meaning`, `prompt.pinyin` and `summonInk`; no value is typed
    - Unit test the formatter on hand-built records (ten rows, order kept, fewer than ten records)
    - _Requirements: 17.8_

- [ ] 13. Human tasks (Kiro does not do these)
  - [~] 13.1 HUMAN TASK: review the prompt samples
    - Open `data/prompt-review-sample-level2.csv` and `data/prompt-review-sample-level3.csv` (50 rows each, chosen by the seeded script step); for each prompt that needs a different gloss add a row to `data/prompt-overrides-level2.csv` or `-level3.csv` (columns `character,entryIndex,meaningIndex,reviewedBy`), and add accepted prompts to `data/prompt-approvals.csv` (`character,reviewedBy`), with `reviewedBy` exactly `human`; then run `npm run build:data`. Unreviewed prompts may ship; the counts update from the data
    - _Requirements: 4.8, 17.5_
  - [~] 13.2 HUMAN TASK: spot-check a random sample of the new characters
    - Check meaning, pinyin and components of a random sample of characters (separate from the prompt samples) before deploy and record the result in `kiro-log.md` (content-accuracy.md manual review)
    - _Requirements: 17.5_
  - [~] 13.3 HUMAN TASK: review the Level_Screen screenshots
    - Review the Level_Screen and the Graveyard switcher at 1024 × 768, 375 × 812 and 320 × 640 for art direction and wording
    - _Requirements: 12.4, 17.5_

- [x] 14. Final checkpoint
  - Run `npm test`, then `npx tsc --noEmit` at the repository root, `npx tsc --noEmit -p app` and `npx tsc --noEmit -p oracle` (no errors), `npm run build -w app`, `npm run check:bundle` (passes, counted total under 300,000) and `npm run test:e2e` (all pass, including `harder-ghosts.spec.ts`)
  - Report the real raw and gzip bytes of `characters.json`, `characters-level2.json`, `characters-level3.json`, `levels.json` and every font subset (`lxgw-wenkai-subset.woff2` and the two level subsets), and the counted bundle total
  - Run `npm run report:ghosts` and report its output: the first ten ghosts in learning order at level 2 and at level 3, each with character, meaning, pinyin and summon-ink class, read from the generated data and not typed by hand
  - Confirm with `git diff --stat` that `app/public/data/characters.json`, `data/prompt-review.csv`, `data/prompt-overrides.csv`, `data/character-list.txt`, `scheduler.ts`, `outcome.ts`, `config.ts`, `learningOrder.ts` and `lxgw-wenkai-subset.woff2` are untouched; search the added and changed files, data files included, for `any`, for personal names and for `.kiro/` in `.gitignore`; confirm the `reviewed-by` test passes
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.6, 17.7, 17.8_

- [x] 15. Clue quality for levels 2 and 3 (follow-up, approved by the human)
  - Rules for this task group: edit no steering file, `kiro-log.md` or `tasks.meta.json`; create no `data/prompt-overrides-level2.csv`, `-level3.csv` or `data/prompt-approvals.csv`; add no property-based or mutation test; keep `selectPrompt` behaviour, `app/public/data/characters.json` and `data/prompt-review.csv` byte-identical
  - [x] 15.1 Implement the pure Clue_Rule with unit tests
    - In `scripts/lib/prompt.ts` only add `export` to `stripBoundForm`, `isProperNounReading` and `hasSkippedPrefix`; do not change any behaviour
    - Write `scripts/lib/parse-hsk-examples.ts` (`parseHskExamples`) and `scripts/lib/select-prompt-by-examples.ts` (`normaliseSyllable`, `readingCounts`, `topReading`, `isCrossReferenceGloss`, `containsHan`, `selectPromptByExamples`) as in the design section "Clue quality"; no I/O, no `any`
    - Write `tests/unit/parse-hsk-examples.test.ts` and `tests/unit/select-prompt-by-examples.test.ts` with the cases of Requirement 18.14 on small hand-built `CcCedictEntry` fixtures; `tests/unit/prompt.test.ts` stays unchanged and passing
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.14, 18.19_
  - [x] 15.2 Wire the Clue_Rule into the build for levels 2 and 3 only
    - Add `hskCharsPath` to `BuildOptions` and `AllLevelsOptions`; `buildAllLevels` passes it to levels 2 and 3 only and `main()` passes `data/raw/hsk30/hsk30-chars.csv`; without the path the Current_Rule runs
    - Add the private `choosePrompt` helper used by both the character loop and `buildPromptReviewCsv` (override wins; approval without override keeps the Current_Rule's prompt; otherwise the Clue_Rule); keep the `source` column value `default`
    - Add the Chinese-character gate (`promptFailure: 'chinese-in-meaning'`) and its `formatError` text naming the character, the level and the override file; extend `tests/unit/build-all-levels.test.ts` and `tests/unit/build-override-errors.test.ts` with a fixture CSV: level 2 changes and level 1 does not, override and approval precedence, `promptReview` as before, Review_File equals dataset, the failure names the character and writes nothing
    - _Requirements: 18.1, 18.2, 18.7, 18.8, 18.10, 18.11, 18.19_
  - [x] 15.3 Write the Rule_Changes_File
    - Write `scripts/lib/rule-changes.ts` (`renderRuleChangesCsv`); add `ruleChanges` to `BuildResult` and `LevelBuild`, `ruleChangesCsv` to `AllLevelsOutput`, `ruleChanges` (`data/prompt-rule-changes.csv`) to `AllLevelsPaths` and `filesToWrite`; print `Prompt rule changes: level 2: N, level 3: M, total: T` in `formatAllLevelsReport`
    - Add `tests/unit/rule-changes.test.ts`: fixed header, quoting, order (level 2 then level 3, list order), no row for an override or approval character, identical bytes on two runs
    - _Requirements: 18.9, 18.10, 18.13, 18.19_
  - [x] 15.4 Extend the data-check hook
    - Change the matcher in `.kiro/hooks/data-check-on-save.json` to `(^|/)data/(character-list(-level[23])?\\.txt|prompt-overrides(-level[23])?\\.csv|prompt-approvals\\.csv|raw/.+)$` (JSON-escaped as in the file today); extend `tests/unit/kiro-hook.test.ts` so each of the five new paths is accepted (relative and absolute) and `data/prompt-rule-changes.csv`, `data/prompt-review-level2.csv` and `app/public/data/characters-level2.json` are rejected; keep every existing assertion
    - _Requirements: 18.16, 18.19_
  - [x] 15.5 Rebuild and regenerate everything
    - Run `npm run build:data`; report the per-level changed counts it prints and the real raw and gzip bytes of the data files
    - Print the changes list with `cat data/prompt-rule-changes.csv` and report how many rows each level has; if the build fails with a Chinese-character failure, stop and report the characters to the human (do not write an override row)
    - Confirm that `characters-level2.json`, `characters-level3.json`, `levels.json`, both Review_Files, both Review_Samples (same seed strings, same row positions), the generated counts module and the README block were regenerated and that the font subsets did not change (`git diff --stat`; run `npm run build:font` only if a glyph set changed)
    - Update only the prompt values in existing tests that pin a level 2 or level 3 prompt (list each changed assertion in the report); change nothing else
    - _Requirements: 18.9, 18.10, 18.15, 18.19_
  - [x] 15.6 Add the Chinese-character-free displayed-meaning test
    - Write `tests/unit/prompt-displayed-chinese.test.ts`: for every record of `characters-level2.json` and `characters-level3.json` assert no Han_Character (`/\p{Script=Han}/u`) in `cleanupMeaning(prompt.meaning)` and in `maskTarget(cleanupMeaning(prompt.meaning), character)`, and in each `exampleMeanings` entry of `levels.json`; add a test that the Rule_Changes_File agrees with the datasets (Requirement 18.13)
    - _Requirements: 18.12, 18.13, 18.19_
  - [x] 15.7 Verify level 1 is unchanged and update the README
    - Run `git diff --stat` and confirm `app/public/data/characters.json`, `data/prompt-review.csv`, `data/prompt-overrides.csv`, `data/character-list.txt` and `scripts/lib/prompt.ts` (apart from the three added `export` words) are untouched; `tests/unit/level1-protected.test.ts` passes without edits
    - In the README prompt section describe the Clue_Rule for levels 2 and 3 (source: the `Examples` column of `hsk30-chars.csv`; reading by frequency, then the first clean gloss; fallback; the changes file) and keep the generated count block as the build writes it; run the `accuracy-reviewer` agent over the new README text and fix findings in that text only
    - _Requirements: 18.1, 18.15, 18.17, 18.19_
- [x] 16. Final checkpoint for clue quality
  - Run `npm test`, then `npx tsc --noEmit` at the repository root, `npx tsc --noEmit -p app` and `npx tsc --noEmit -p oracle` (no errors), `npm run build -w app`, `npm run check:bundle`, `npm run test:e2e`, `npm run check:data` and `npm run check:levels`; all must pass
  - Report the number of changed prompts per level (from the build output) and print `data/prompt-rule-changes.csv`
  - Run `npm run report:ghosts` again and print its output
  - Confirm with `git diff --stat` that `app/public/data/characters.json`, `data/prompt-review.csv`, `data/prompt-overrides.csv`, `data/character-list.txt`, `scheduler.ts`, `outcome.ts`, `config.ts` and the level 1 font subset are untouched, and search the added and changed files for `any` and for personal names
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 18.18, 18.19_
## Notes

- There are no optional tasks. Every test task is required. No property-based test is added (tech.md, decision of Nov 15); the existing property tests stay as they are.
- Task 1.1 is the data-source verification and runs first. Task 2 is automatic: the plan continues when the check exits 0 and stops for the human only when the result differs from the expected one.
- Tasks 13.1 to 13.3 are human tasks. Kiro does not execute them, does not review prompts, does not write override or approval rows, and does not edit `kiro-log.md`.
- Task 4.2 must finish before tasks 5.3 and 5.4 so the level 1 hashes are recorded from the unchanged files.
- The decisions in `requirements.md` ("Decisions approved by the human") are final; there are no open questions.
- Tasks 15 and 16 are the clue-quality follow-up (Requirement 18, approved by the human). Task 15.5 rebuilds the data and must run after 15.1 to 15.4; task 15.6 runs after 15.5 because it reads the regenerated files. Task 14 is unchanged and keeps its own checkpoint.
- Steering edits (tasks 3.1 to 3.3) are approved by the human as worded in the design. Do not edit steering files anywhere else.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4", "4.1", "4.2"] },
    { "id": 2, "tasks": ["5.1"] },
    { "id": 3, "tasks": ["5.2", "5.5", "5.7", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 4, "tasks": ["5.8", "8.1", "8.2", "8.3"] },
    { "id": 5, "tasks": ["5.3"] },
    { "id": 6, "tasks": ["5.4"] },
    { "id": 7, "tasks": ["5.6", "8.4", "10.1", "11.1"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["11.2", "11.3"] },
    { "id": 10, "tasks": ["12.1", "12.3"] },
    { "id": 11, "tasks": ["12.2"] },
    { "id": 12, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 13, "tasks": ["15.1", "15.4"] },
    { "id": 14, "tasks": ["15.2"] },
    { "id": 15, "tasks": ["15.3"] },
    { "id": 16, "tasks": ["15.5"] },
    { "id": 17, "tasks": ["15.6", "15.7"] }
  ]
}
```
