# Requirements Document

## Introduction

Proof Pass answers the third outside review of Ghost Script. It contains thirteen items in the human's priority order: four must-do items (a memory fix for returning ghosts, five corrected clues and a display rule for traditional|simplified pairs, a bigger Summon paper, a summary that works as a reward) and nine small fixes (a cross-level notice, Graveyard order, data-file credits and first-load honesty, a Give up slip, a start menu that fits, a restless-ghost review, a level screen with samples, a collapsed Graveyard with more grass, and an animated legend line).

This document states the requirements as amended to the human's answers (task 2.1); it implements nothing. The requirement order below is the human's priority order. Requirement 14 collects the constraints that apply to all of them.

Three items conflict with current steering text: item 1 (content-accuracy and product), item 11 (content-accuracy and the harder-ghosts spec), and item 13 (art-direction). The human approved the five amendments that resolve the conflicts. They are listed at the end of this document, under "Steering amendments (approved by the human)", and are written into the steering files by tasks 3.1 to 3.5 before the items they gate.

### Investigation findings (read-only, cited)

- `app/src/modes/SummonStep.tsx`: `SUMMON_HOLD_MS = 1500`, `SUMMON_FADE_MS = 1500`, `SUMMON_INK_SPEED = 2`. Once the code is complete (or the player gives up), the forming effect draws every stroke not yet inked (`enqueueInk` over `strokeCount`), or calls `animateCharacter()` for opaque ghosts. It then holds 1500 ms, fades 1500 ms, and calls `onDone`. If the writer is missing or breaks, `useFallback` shows the character as plain text (`<p lang="zh">{record.character}</p>`) with the same hold and fade. The `firstMeeting` prop only changes the faint code, the next-key highlight and the status text. It does not change the reveal, so a returning ghost gets the same full reveal as a first meeting.
- `summonPaperSize` (`app/src/engine/surfaceSize.ts`) is `max(96, min(0.4 × width, 160, height − reserved − 600))`. That gives 160 px at 1024 × 768 and 150 px at 375 × 812. The 600 is the height budget of everything else on the Summon step.
- `app/src/engine/graveyard.ts`: `classifyEntry` returns `restless` when `lastOutcome` is not `clean`, or when it is `clean` and `nextDue <= now`. Otherwise it returns `at-rest`, or `unmet` with no entry. `buildGraveyard` lists graves in `learningOrder` and returns counts per state.
- `app/src/engine/scheduler.ts`: `applyReview` (clean advances the ladder; a miss sets step 0 and `nextDue = now + relearnDelayMs`) and `selectSession` (due ghosts most overdue first, then new ones, then not-yet-due ones soonest first). Neither needs to change for item 10.
- `app/src/App.tsx`: `planSeance` and `SeanceScope` build the pool with `sessionCharacterList` (chosen level first, then other levels' ghosts that have a history entry). `firstMeetingSet` marks ghosts with no history entry. Only a brand-new player gets the walkthrough ghost, picked by `pickWalkthroughGhost` from the level 1 order. Storage is at `CURRENT_SCHEMA_VERSION = 3` (`app/src/storage/storage.ts`). Item 10 needs no schema change.
- Learning order (computed read-only from `app/public/data/*.json` with the rule in `learningOrder.ts`): the walkthrough ghost is 明, at level 1 position 13 (transparent, 8 strokes). It is level 1 data and is not in the level 2 or 3 datasets. Level 1 has 15 transparent, 95 partial and 190 opaque ghosts.
- `data/prompt-overrides.csv` (level 1) already has `么,2,0,human-approved` and `本,0,8,human-approved`, and no row for 天. `data/prompt-approvals.csv` has `刚,human`. CC-CEDICT lines (`data/raw/cc-cedict/cedict_ts.u8`) show each of the five requested texts in exactly one (entry, meaning) of its character: 本 entry 0 meaning 0 (with the "(bound form) " prefix, stripped), 天 entry 0 meaning 1, 云 entry 2 meaning 0, 刚 entry 0 meaning 3, 获 entry 1 meaning 0 (with the prefix, stripped). The request for 么 is withdrawn by the human: the existing row `么,2,0,human-approved` stays, so the stored clue of 么 and its review line stay byte-identical, and the display rule of Requirement 2 (criteria 23 to 34) handles its traditional|simplified pairs.
- Pairs in clues (computed read-only over the three datasets): `prompt.meaning` contains "|" in 4 level 1 records (么, 号, 路, 道), 7 level 2 records and 2 level 3 records. The Han-run, "|", Han-run pattern of Requirement 2 criterion 23 changes the displayed clue of exactly one record, 么 (level 1); the other records either have their pair inside a note that the existing cleanup removes anyway (the "(CL:條|条[tiao2])" notes), or have a digit after the "|" (号).
- `tests/unit/level1-protected.test.ts` pins SHA-256 of `app/public/data/characters.json`, `data/prompt-review.csv` and `data/character-list.txt`. Level 2 and 3 override files use `reviewedBy` = `human` (the level 2 and 3 parsers require it); the level 1 file uses `human-approved`.
- `app/src/styles/fonts.css` has three `@font-face` subsets with disjoint `unicode-range`s. All seven code points of the legend line (天 U+5929, 雨 U+96E8, 粟 U+7C9F, ， U+FF0C, 鬼 U+9B3C, 夜 U+591C, 哭 U+54ED) are in the level 1 range. Of the Han characters, 天 and 雨 are level 1 data. 夜 and 哭 are level 2 data, 鬼 is level 3 data, and 粟 is in no level list. `data/raw/hanzi-writer-data` has stroke files for all six Han characters and none for ，.
- `README.md` (lines 112 to 127): "First load, counted against a budget of 300,000 bytes gzip: 214,206 bytes". The level 1 dataset (361,679 gzip) is fetched at start but is exempt from the count, so the real first load is about 575,885 bytes gzip. `scripts/check-bundle-size.ts` skips `data/characters*.json` and `assets/lxgw-wenkai-subset-level*` as lazy files.
- Level-screen fonts: whether a fresh level 1 load requests the level 2 or 3 subset has not been observed in a browser. Static reading finds no glyph outside the level 1 range on the intro, the level screen or the first séance, so item 7 treats the e2e check as the arbiter.
- Current screens: `SessionSummary.tsx` is a `text-3xl` heading with a list of rows (no `font-display`). `StartMenu.tsx` is a column of seven slips plus a hint (the human measured 936 px at 375 × 812). `LevelScreen.tsx` and its test state "no Chinese character", and `e2e/harder-ghosts.spec.ts` asserts it. `Graveyard.tsx` renders one `li` per grave at `repeat(auto-fill, minmax(48px, 1fr))`, 12 hill tufts (`HILL_SLOTS`) and one tablet tuft per grave. `WriteMode.tsx` line 189 renders Give up with `rounded-md border` and not `slip`.
- `SummonStep.neverReveal.test.tsx` loops over every playable record in four variants (returning, first meeting, and both with walkthrough lines). It checks the target is absent from text and attributes before the code is complete. `content-accuracy.md` lists "the designed summon reveal" and its plain-text fallback as not an answer leak, and `art-direction.md` fixes `SUMMON_HOLD_MS`, `SUMMON_FADE_MS` and `SUMMON_INK_SPEED` in the Q12 rite-timing exemption.

## Glossary

- **App**: the Ghost Script single-page web app in `app/`.
- **Summon_Step**: the `SummonStep` component, where the player types the Cangjie code of a ghost.
- **Write_Step**: the `WriteMode` component, where the player writes the character from memory.
- **First_Meeting_Ghost**: a ghost with no history entry when the séance is planned (the `firstMeeting` set of `planSeance`). It includes the walkthrough ghost.
- **Returning_Ghost**: any ghost that is not a First_Meeting_Ghost, including every ghost of a Review_Run.
- **Inked_Parts**: the strokes that accepted keys have drawn on the Summon paper, as listed by `summonInk.keyStrokes` for the keys typed. An opaque ghost has none.
- **Plain_Text_Fallback**: the `<p lang="zh">` node that shows the character as text when the animation fails.
- **Summon_Paper**: the square ink surface of the Summon_Step; its side is `summonPaperSize`.
- **Clue**: the English meaning and pinyin shown for a ghost (`record.prompt`).
- **Level_Dataset**: one of `characters.json` (level 1), `characters-level2.json`, `characters-level3.json`.
- **Level_1_Pin**: the pinned fingerprint of the level 1 dataset in `tests/unit/level1-protected.test.ts` and its fixtures.
- **Level_1_Review_Value**: the `reviewedBy` value `human`, written in the two level 1 override rows of Requirement 2 (本 and 天), approved by the human.
- **Clue_Cleanup**: the display function `cleanupMeaning` in `app/src/engine/promptCleanup.ts`, which runs before `maskTarget` in every place that shows a Clue.
- **Han_Pair**: in a Clue meaning, a maximal run of one or more Han characters (Unicode script Han), immediately followed by "|", immediately followed by at least one Han character, as in "什麼|什么[shen2 me5]".
- **Traditional_Half**: the run of Han characters and the "|" that precede the simplified half of a Han_Pair.
- **Summary_Screen**: the `SessionSummary` screen shown after a séance.
- **Ghost_Tile**: one ghost on the Summary_Screen: a small paper square with its Seal_Stamp (clean ghost), or a faint ghost (any other ghost), with the return text beneath.
- **Return_Text**: the text of `formatReturn`, for example "returns tomorrow" or "returns in 10 minutes".
- **Chosen_Level**: the level chosen on the Level_Screen or the Start_Menu, stored as `level`.
- **Due**: the state of a ghost whose `nextDue` is at or before the time of planning (`nextDue <= now`).
- **Other_Level_Ghost**: a ghost in a planned séance that is due (`nextDue <= now`) and belongs to a level other than the Chosen_Level.
- **Start_Menu**: the `StartMenu` screen.
- **Graveyard**: the `Graveyard` screen.
- **Guided_Ghost**: the ghost that `pickWalkthroughGhost` returns for the level 1 order (currently 明).
- **Grave_Row**: the set of graves that the Graveyard grid lays out on one line at the current width.
- **Met_Ghost**: a ghost with a history entry, either restless or at rest.
- **Collapsed_Grave**: a grave that the Graveyard does not show under Requirement 12 criteria 1 to 3.
- **Restless_Ghost**: a ghost whose `classifyEntry` result is `restless` at the current time.
- **Review_Run**: a run of the rite over Restless_Ghosts started from the "Review restless ghosts" slip.
- **Level_Screen**: the `LevelScreen` screen.
- **Level_Sample**: the one character drawn on a paper square on the Level_Screen for a level, as an SVG of its stroke paths from `data/raw/hanzi-writer-data` and never as text.
- **Level_Manifest**: `app/public/data/levels.json`, generated by the data pipeline; it carries, for each level, the Level_Sample character and its stroke paths.
- **Level_1_Font_Range**: the `unicode-range` of the level 1 `@font-face` in `app/src/styles/fonts.css` (used by the Legend_Line only).
- **Legend_Line**: the intro line 天雨粟，鬼夜哭.
- **Legend_Strokes_File**: a new file `app/public/data/legend-strokes.json`, built by `scripts/` from `data/raw/hanzi-writer-data`.
- **Ink_In**: the character-by-character inking of the Legend_Line.
- **Grain_Fall**: the slow fall of pale grain behind the Legend_Line.
- **Sources_Screen**: the Sources & licences screen (`Credits`).
- **Power**: the Kiro Power packaged from `oracle/power/`.
- **Pipeline**: the Node and TypeScript scripts in `scripts/` that build the datasets and derived files.
- **Slip**: an element with the `slip` or `slip-primary` class as defined in `art-direction.md`.
- **Fit_Tests**: the Playwright specs that check one-screen fit (`e2e/fits-one-screen.spec.ts`, `e2e/no-horizontal-overflow.spec.ts`, `e2e/sky-cap.spec.ts`, `e2e/graveyard-fit.spec.ts`).
- **Intro_Control**: any `button` or link (`a`) on the intro screen, including "Begin the Séance" and "Sources".
- **Control_Box**: the bounding box of an Intro_Control, expanded by 4 px on every side to cover the 2 px hover lift and the focus ring.
- **Grain_Path**: the area a grain sweeps during its whole fall: its x range (left to left plus size) and the full height of the grain layer (0 to 100 %).
- **First_Load_Figures**: the counted bundle, the level 1 dataset and their sum, in gzip bytes, as printed by `npm run check:bundle`.

## Requirements

### Requirement 1: Returning ghosts show no formed character after the code

**User Story:** As a returning player, I want the game to stop showing me the finished character after I type the code, so that writing it tests my memory and not my copying.

#### Acceptance Criteria

1. THE work SHALL implement criteria 2 to 28 of this requirement only after steering amendments 1 to 3 (approved by the human) are written into `content-accuracy.md`, `product.md` and `art-direction.md` by tasks 3.1 to 3.3.
2. WHEN the code of a Returning_Ghost with a transparent or partial `summonInk` class is complete, THE Summon_Step SHALL call `onDone` exactly once, after all strokes queued by the accepted keys have finished animating.
3. WHEN the code of a Returning_Ghost with an opaque `summonInk` class is complete, THE Summon_Step SHALL call `onDone` once, without waiting for any animation.
4. WHEN the code of a Returning_Ghost with an opaque `summonInk` class is complete, THE Summon_Step SHALL call neither `animateCharacter` nor `animateStroke`.
5. WHEN the code of a Returning_Ghost with an opaque `summonInk` class is complete, THE Summon_Paper SHALL contain no stroke.
6. WHEN the code of a Returning_Ghost with a transparent or partial `summonInk` class is complete, THE Summon_Step SHALL call `animateStroke` only for stroke indices in the union of the `keyStrokes` of the accepted keys, and SHALL never call `animateCharacter`.
7. WHEN the code of a Returning_Ghost is complete, THE Summon_Step SHALL start the Write_Step with a hold of 0 ms and a fade of 0 ms, without starting a `SUMMON_HOLD_MS` timer or a `SUMMON_FADE_MS` timer.
8. IF the animation fails for a Returning_Ghost because `HanziWriter.create` throws or `onLoadCharDataError` fires, THEN THE Summon_Step SHALL call `onDone` exactly once with a hold of 0 ms and a fade of 0 ms.
9. IF the animation fails for a Returning_Ghost, THEN THE Summon_Step SHALL render no Plain_Text_Fallback node.
10. WHEN the player gives up the Summon_Step of a Returning_Ghost, THE Summon_Step SHALL request no stroke after the give-up, SHALL let the strokes that accepted keys already requested finish, and SHALL NOT call `animateCharacter`.
11. WHEN the player gives up the Summon_Step of a Returning_Ghost, THE Summon_Step SHALL render no Plain_Text_Fallback node.
12. WHEN the player gives up the Summon_Step of a Returning_Ghost, THE Summon_Step SHALL start the Write_Step with the outcome `gave-up`.
13. WHEN the code of a First_Meeting_Ghost is complete, THE Summon_Step SHALL draw the strokes not yet inked, or call `animateCharacter` for an opaque ghost, as it does today.
14. WHEN the code of a First_Meeting_Ghost is complete, THE Summon_Step SHALL hold for 1500 ms, fade for 1500 ms and then call `onDone`.
15. IF the animation fails for a First_Meeting_Ghost, THEN THE Summon_Step SHALL show the Plain_Text_Fallback with the same hold and fade as criterion 14.
16. WHEN the player gives up the Summon_Step of a First_Meeting_Ghost, THE Summon_Step SHALL keep today's reveal as criteria 13 to 15 describe.
17. THE Summon_Step SHALL keep `SUMMON_HOLD_MS`, `SUMMON_FADE_MS` and `SUMMON_INK_SPEED` at 1500, 1500 and 2.
18. WHILE the preference `prefers-reduced-motion: reduce` is set, THE Summon_Step SHALL draw the Inked_Parts of a Returning_Ghost at `SUMMON_REDUCED_SPEED`, and the design SHALL confirm that this constant exists in `SummonStep.tsx`.
19. WHILE the preference `prefers-reduced-motion: reduce` is set, THE Summon_Step SHALL start the Write_Step of a Returning_Ghost without any hold, fade or timer.
20. THE `SummonStep.neverReveal.test.tsx` suite SHALL, for every playable record in both Returning_Ghost variants (with and without walkthrough lines), type the whole code, advance fake timers by at least 3000 ms, and assert that the target character is absent from all text nodes, all attributes and `document.title`.
21. THE `SummonStep.neverReveal.test.tsx` suite SHALL assert that `onDone` was called exactly once for every playable Returning_Ghost record.
22. THE `SummonStep.neverReveal.test.tsx` suite SHALL assert that `animateCharacter` was never called for a Returning_Ghost.
23. THE `SummonStep.neverReveal.test.tsx` suite SHALL assert that every `animateStroke` index lies in the union of the `keyStrokes` of the typed keys.
24. THE `SummonStep.neverReveal.test.tsx` suite SHALL assert that a Returning_Ghost never renders the target character when `HanziWriter.create` throws.
25. THE `SummonStep.neverReveal.test.tsx` suite SHALL assert that a Returning_Ghost never renders the target character when `onLoadCharDataError` fires.
26. THE `SummonStep.neverReveal.test.tsx` suite SHALL assert that, under the failures of criteria 24 and 25, a First_Meeting_Ghost renders the Plain_Text_Fallback with a hold of 1500 ms and a fade of 1500 ms.
27. THE `e2e/summon-ink.spec.ts` suite SHALL assert that the Write_Step of a Returning_Ghost appears within 1000 ms after the last key.
28. THE `e2e/summon-ink.spec.ts` suite SHALL assert, with a MutationObserver, that no text node containing the target character exists after the last key of a Returning_Ghost.

### Requirement 2: Corrected clues

**User Story:** As a player, I want clues that show the right sense of each character and no duplicate traditional forms, so that the ghost I meet matches the character I must write.

#### Acceptance Criteria

1. THE Pipeline SHALL set the Clue meaning of five characters to the following texts, each taken from the character's own CC-CEDICT entries: 本 "root; stem", 天 "sky", 云 "cloud", 刚 "just; only a short while ago", 获 "to reap; to harvest".
2. THE Pipeline SHALL apply an override row for one of the five characters only IF `stripBoundForm(meaning)` of the selected (entry, meaning) pair equals the requested text and no other pair of that character does.
3. IF an override row of the five characters does not satisfy criterion 2, THEN THE Pipeline SHALL exit with a failure that names the character, the text and the number of matching pairs, and SHALL leave every generated file unchanged.
4. THE `data/prompt-overrides.csv` file SHALL replace, in place, the row `本,0,8,human-approved` with `本,0,0,human`.
5. THE `data/prompt-overrides.csv` file SHALL gain exactly the row `天,0,1,human`, SHALL keep the row `么,2,0,human-approved` exactly as it is, and SHALL have no other row added, removed or changed.
6. THE `data/prompt-overrides-level2.csv` file SHALL gain exactly the rows `云,2,0,human` and `刚,0,3,human`, and `data/prompt-approvals.csv` SHALL keep its row `刚,human`.
7. THE `data/prompt-overrides-level3.csv` file SHALL gain exactly the row `获,1,0,human`.
8. THE Pipeline SHALL leave the stored Clues of 么, 第, 视, 奋 and 居 unchanged.
9. WHEN the Pipeline runs twice on the same inputs, THE Pipeline SHALL produce byte-identical output for the three Level_Datasets, the Level_Manifest, the three review files and `app/src/data/promptCounts.generated.ts`.
10. THE Level_1_Pin SHALL change only in the SHA-256 of `app/public/data/characters.json` and the SHA-256 of `data/prompt-review.csv`.
11. THE Level_1_Pin SHALL keep the SHA-256 of `data/character-list.txt` unchanged.
12. THE test suite SHALL include a fixture of per-record SHA-256 values for all 300 level 1 records (one hash of the whole record and one hash of the record without its `prompt` field), committed before the first edit to `data/prompt-overrides.csv`.
13. THE test suite SHALL assert that the hash of the record without `prompt` matches the fixture for all 300 level 1 records.
14. THE test suite SHALL assert that the whole-record hash matches the fixture for exactly 298 level 1 records and differs for exactly 本 and 天, so that 么 stays byte-identical.
15. THE test suite SHALL assert that the new Clue of each of 本 and 天 equals the requested text plus the reading of the selected entry.
16. THE test suite SHALL assert, against a per-line hash fixture captured before the edit, that every line of `data/prompt-review.csv` except the lines of 本 and 天 is identical, including the line of 么.
17. THE test suite SHALL assert that the two changed lines of `data/prompt-review.csv` show the new meaning and the Level_1_Review_Value.
18. THE test suite SHALL assert, with per-record fixtures, that the level 2 dataset differs only in 云 and 刚 and the level 3 dataset differs only in 获.
19. THE regenerated `promptCounts.generated.ts` SHALL change only by one fewer unreviewed level 2 prompt (云) and one fewer unreviewed level 3 prompt (获), because 刚 is already approved and level 1 has no count; THE `prompt-counts` block of `README.md` SHALL be regenerated to the same counts (level 2: 53 reviewed and 347 not; level 3: 60 reviewed and 440 not); and the existing credits tests SHALL pass.
20. THE `data/prompt-review-level2.csv` and `data/prompt-review-level3.csv` files SHALL show `reviewedBy` = `human` for 云, 刚 and 获 after the build.
21. THE 50-row review sample files SHALL keep the same characters at the same positions; the `reviewedBy` cell of a sampled 云 or 获 MAY change, and the sampled 刚 row MAY change its `chosenMeaning`, `source` and `reviewedBy` cells.
22. THE design SHALL check whether the example meanings in `levels.json` use the meanings of 本 or 天, and SHALL record the result.
23. THE Clue_Cleanup SHALL, as its first operation in every pass, remove the Traditional_Half of every Han_Pair in the Clue meaning, so that "什麼|什么[shen2 me5]" becomes "什么[shen2 me5]".
24. WHEN a Clue meaning holds several Han_Pairs, THE Clue_Cleanup SHALL remove the Traditional_Half of each one independently, from left to right; in a chain "AB|CD|EF" of Han runs it SHALL remove "AB|" and "CD|" and keep "EF".
25. THE Clue_Cleanup SHALL leave every "|" that is not between two Han characters untouched, including a "|" followed by a digit or a letter, as in "237號房間|237号房间".
26. THE Clue_Cleanup SHALL apply its operations in this order: remove the Traditional_Halves, then the existing removal of notes, bracketed pinyin and separators (repeated to a fixpoint as today), and THE caller SHALL then apply `maskTarget`.
27. THE displayed Clue of 么 SHALL be "suffix, used to form interrogative 什～, what?, indefinite 这～ thus, etc", while the stored meaning of 么 in `characters.json` stays unchanged.
28. THE Clue_Cleanup change SHALL apply to every level and to every place that calls `cleanupMeaning` (`GhostPrompt` and the walkthrough lines).
29. THE Clue_Cleanup SHALL stay a function that only deletes characters from its input and is idempotent, and THE work SHALL change no stored data for it.
30. THE test suite SHALL assert, for every record of the three Level_Datasets, that the displayed Clue (`maskTarget(cleanupMeaning(meaning), character)`) contains the target character nowhere.
31. THE test suite SHALL assert, for every record of levels 2 and 3, that the displayed Clue contains no Han character, so that the Chinese-character-free rule of the `harder-ghosts` spec (its Requirement 18) and the existing displayed-meaning test stay passing.
32. THE unit tests of the Clue_Cleanup SHALL cover: 么 with its exact stored meaning and the exact displayed text of criterion 27; a "(CL:條|条[tiao2])" note; the digit case of 号; a non-Han "|" such as "a|b"; a chain of two Han_Pairs; two separate Han_Pairs in one meaning; a "|" at the start or end of the text; idempotence on each example; and an unchanged meaning without "|".
33. THE test suite SHALL compute, over the real Level_Datasets, how many displayed Clues change at each level because of the new step, SHALL print the three numbers, and SHALL assert them as 1 for level 1, 0 for level 2 and 0 for level 3; the checkpoint task SHALL report them.
34. THE Level 1 Clues that contain Han characters after cleanup (你, 您, 第 and 么) SHALL stay allowed, because the Chinese-character-free rule applies to levels 2 and 3 only.

### Requirement 3: A bigger Summon paper

**User Story:** As a player on a laptop or a phone, I want the Summon paper as large as the screen allows, so that I can see the inked parts clearly.

#### Acceptance Criteria

1. WHEN the viewport is 1024 × 768, THE Summon_Step SHALL draw the Summon_Paper with a side of at least 260 px for a Returning_Ghost and for a non-guided First_Meeting_Ghost, with `reservedPx` 0.
2. WHEN the viewport is 1024 × 768, THE Summon_Step SHALL draw the Summon_Paper of the Guided_Ghost with a side of at least 260 px, with `reservedPx` equal to `WALKTHROUGH_LINE_PX` (24).
3. WHEN the viewport is 375 × 812, THE Summon_Step SHALL draw the Summon_Paper with a side of at least 240 px.
4. THE `summonPaperSize` function SHALL return the floor of the smaller of (width − 32) and (height − `reservedPx` − 484), where 484 px is the target height of all other Summon content except the Summon_Paper and the walkthrough line (measured today: 544 px at 1024 × 768, 564 px at 375 × 812, 586 px at 320 × 640, so the design compacts the content to reach it), limited to a ceiling of 560 px, and SHALL no longer apply the limit of 0.4 × width or the cap of 160.
5. THE `summonPaperSize` function SHALL return at least 96.
6. THE Summon_Step SHALL set the hint text, the status line, the system-input note and the Unihan note at 12 px or larger, reduced only as far as criterion 7 needs.
7. WHEN the viewport is 1024 × 768 and `reservedPx` is 0, THE Summon_Step SHALL keep the other Summon content within 484 px of height (a target that the compaction in the design achieves; the design measures 456 to 472 px).
8. THE Summon_Step SHALL keep text, including the reduced text, at a contrast of at least 4.5:1.
9. THE Summon_Step SHALL fit one screen, with no vertical scrolling and no horizontal overflow, at 1024 × 768, 375 × 812 and 320 × 640, for a Returning_Ghost, a First_Meeting_Ghost and the Guided_Ghost.
10. THE Summon_Step SHALL keep every control at least 44 px high.
11. THE Summon_Step SHALL keep the Moon's top room of 4.75 rem below 992 px.
12. THE Fit_Tests SHALL assert that `ink-surface` is square, at least 260 px at 1024 × 768 and at least 240 px at 375 × 812.
13. THE Fit_Tests SHALL add 320 × 640 to the Summon fit check.
14. THE unit tests of `summonPaperSize` SHALL assert exactly: 1024 × 768 with `reservedPx` 0 gives 284; 1024 × 768 with `reservedPx` 24 gives 260; 375 × 812 gives 328; 320 × 640 gives 156; 320 × 500 gives 96.
15. THE design SHALL confirm the 32 px page padding and SHALL reconcile this requirement with Requirement 5 criterion 15 (the height of the cross-level line).
16. THE unit tests of `summonPaperSize` SHALL assert that 4000 × 4000 gives the ceiling 560, and that every result is an integer of at least 96.

### Requirement 4: The summary as a reward

**User Story:** As a player who finished a séance, I want the summary to look like a reward, so that I see my ghosts laid to rest and when the others return.

#### Acceptance Criteria

1. THE Summary_Screen SHALL render its heading with the `font-display` class that the Level_Screen, the Graveyard and the Start_Menu use.
2. THE Summary_Screen SHALL show one Ghost_Tile per ghost of the séance, in play order.
3. THE Summary_Screen SHALL show on every Ghost_Tile the glyph of the ghost, its pinyin and its Return_Text beneath.
4. WHEN a ghost's outcome is `clean`, THE Summary_Screen SHALL show its Ghost_Tile as a small paper square with a `SealStamp` that carries only that ghost's own character.
5. WHEN a ghost's outcome is `struggled` or `gave-up`, THE Summary_Screen SHALL show its Ghost_Tile with a faint `GhostFigure` and no `SealStamp`.
6. THE Summary_Screen SHALL give every Ghost_Tile an accessible name that contains the character, the pinyin, the meaning, the outcome in words and the Return_Text.
7. THE Summary_Screen SHALL state the outcome of every ghost in words, so that colour and shape are never the only signal.
8. THE `SessionResults` type SHALL carry the outcome of each ghost, and `buildReturnRows` SHALL pass it through.
9. THE `formatReturn` function SHALL keep its output unchanged.
10. WHILE the séance has at most 10 ghosts, THE Summary_Screen SHALL fit one screen, with no vertical scrolling and no horizontal overflow, at 1024 × 768 and 375 × 812.
11. WHILE no Review_Run is shown, THE Summary_Screen SHALL show the count line "N of M ghosts laid to rest" with `role="status"`, with N computed by the existing `SessionSummary` rule.
12. THE Summary_Screen SHALL keep "Begin another Séance" as its only `slip-primary`.
13. IF the séance has no ghosts, THEN THE Summary_Screen SHALL show "No ghosts appeared this time" and the primary action, and no Ghost_Tile.
14. THE Summary_Screen SHALL keep text at a contrast of at least 4.5:1.
15. THE Summary_Screen SHALL keep the Moon's top room below 992 px.
16. THE Summary_Screen SHALL play any motion only inside the single `prefers-reduced-motion: no-preference` block and SHALL show the static end state otherwise.
17. THE Fit_Tests SHALL cover a full 10-ghost Summary_Screen at 1024 × 768 and 375 × 812, and the `sky-cap` and `no-horizontal-overflow` specs SHALL include it.
18. THE Summary_Screen unit tests SHALL cover a clean tile, a struggled tile and a gave-up tile, and their accessible names.
19. THE Summary_Screen unit tests SHALL assert that no `SealStamp` renders for a struggled or gave-up ghost.

### Requirement 5: A line when due ghosts from another level come first

**User Story:** As a player, I want to be told when ghosts from another level return first, so that a séance of unfamiliar ghosts does not surprise me.

#### Acceptance Criteria

1. WHEN the planned séance holds N ≥ 2 Other_Level_Ghosts from one level L, THE App SHALL show the line "N ghosts from level L return first."
2. WHEN the planned séance holds exactly 1 Other_Level_Ghost, from level L, THE App SHALL show the line "1 ghost from level L returns first."
3. WHEN the Other_Level_Ghosts come from two levels L1 < L2, THE App SHALL show the line "N1 ghosts from level L1 and N2 ghosts from level L2 return first.", using "1 ghost" where a count is 1, and the plural "return".
4. THE App SHALL count Other_Level_Ghosts only among the ghosts selected for the séance (at most `sessionSize`, 10), with "due" decided at planning time, and SHALL exclude Chosen_Level ghosts and ghosts that are not yet due.
5. THE App SHALL show the line once, above the first ghost, while that ghost is in Summon, Write or outcome.
6. WHEN the player leaves the first ghost, THE App SHALL remove the line, and SHALL show it neither above a later ghost nor on the Summary_Screen.
7. IF the séance holds no Other_Level_Ghost, THEN THE App SHALL show no line.
8. IF the run is a Review_Run, THEN THE App SHALL show no line.
9. IF the séance starts with the Guided_Ghost, THEN THE App SHALL show no line.
10. THE `planSeance` function SHALL report the level of each planned ghost and whether the ghost was due at planning time.
11. THE App SHALL build the line text with a pure function of that report and the Chosen_Level.
12. THE line SHALL be plain text, read as text, at 12 px or larger, with a contrast of at least 4.5:1.
13. THE line SHALL NOT be a Slip.
14. THE line SHALL add no primary action, and each screen SHALL keep at most one `slip-primary`.
15. WHILE the line is shown, THE Summon_Step and the Write_Step SHALL fit one screen at 1024 × 768, 375 × 812 and 320 × 640, with the line allowed to wrap and its height reserved as `WALKTHROUGH_LINE_PX` is reserved.
16. THE unit tests SHALL cover: N = 10 from one level, N = 1, N = 2, two levels (including a count of 1 on each side), no Other_Level_Ghost, a séance of Chosen_Level ghosts only, Chosen_Level ghosts that are due, Other_Level_Ghosts that are not due, a Review_Run, and a séance that starts with the Guided_Ghost; and a component test SHALL assert that the line is present above the first ghost and absent above the second.
17. THE e2e suite SHALL seed 3 due level 1 ghosts, choose level 2, assert "3 ghosts from level 1 return first." above the first ghost, assert that the line is gone after "Next ghost", and assert the fit at the three viewports of criterion 15.

### Requirement 6: Graveyard order says what is true

**User Story:** As a player, I want the Graveyard order to match the order I meet ghosts, so that the explanation on the screen is true.

#### Acceptance Criteria

1. WHEN level 1 has a Guided_Ghost, THE Graveyard SHALL show the Guided_Ghost as grave 1 and the other 299 level 1 graves after it in their relative `learningOrder`.
2. THE Graveyard SHALL number the graves 1 to 300 in displayed order, and the accessible-name position of each grave SHALL equal its displayed position.
3. THE Graveyard SHALL leave the `learningOrder` of levels 2 and 3 unchanged.
4. IF `pickWalkthroughGhost` returns null for level 1, THEN THE Graveyard SHALL show the plain `learningOrder`.
5. THE Graveyard SHALL derive the Guided_Ghost with `pickWalkthroughGhost(level 1 order, dataset)` and SHALL NOT hard-code 明.
6. WHILE the Guided_Ghost is unmet, THE Graveyard SHALL show grave 1 as a blank stone named "Ghost 1 of 300, never met", with no Han character in any text or attribute.
7. WHEN level 1 has a Guided_Ghost, THE Graveyard SHALL show the explanation "These graves are the ghosts of level 1. The guided first ghost comes first, then the rest in the order you will meet them. A ghost you have not met stays hidden."
8. IF level 1 has no Guided_Ghost, THEN THE Graveyard SHALL use the sentence of criterion 9 with N = 1.
9. WHEN the shown level N is 2 or 3, THE Graveyard SHALL show the explanation "These graves are the ghosts of level N, in the order you will meet them. A ghost you have not met stays hidden."
10. THE reorder SHALL change display only: `learningOrder`, session order, history, `classifyEntry` and the Level_Datasets SHALL stay unchanged, so that the Level_1_Pin stays valid.
11. THE design SHALL record this case analysis: (a) a brand-new player at any level meets the Guided_Ghost first, because `composeFirstSession` takes it from level 1 and puts it first; (b) a player who starts at level 2 meets it first, and it shows first on the level 1 Graveyard; (c) a player who starts at level 1 meets it first in the same way; (d) a player whose history predates the walkthrough never got the guided session and would meet the ghost at position 13, which is why the sentence names "the guided ghost".
12. THE unit tests of the reorder function SHALL assert, with real level 1 data, that the Guided_Ghost is at index 0, the other 299 follow in order with no duplicate, and the total is 300; that a null Guided_Ghost gives `learningOrder`; and that levels 2 and 3 equal `learningOrder`.
13. THE component tests SHALL assert the names of graves 1 and 2 while unmet, that grave 1 holds no glyph while unmet, and both explanation sentences.

### Requirement 7: Complete data credits, an honest first load, and no unneeded font

**User Story:** As a judge or a player on a slow connection, I want the app to name every data file it ships and to state its real first load, so that nothing is hidden.

#### Acceptance Criteria

1. THE Sources_Screen SHALL name `characters.json` (level 1), `characters-level2.json`, `characters-level3.json`, `levels.json` and the Legend_Strokes_File.
2. THE Sources_Screen SHALL name the Power's derived file `oracle/power/data/oracle-data.json`.
3. THE Sources_Screen SHALL state, for each file of criteria 1 and 2, what it holds and which sources and licences its fields carry, reusing the wording of `credits.ts` and adding no new licence claim; for `levels.json` it SHALL name the hanzi-writer-data stroke outlines of the three Level_Samples under the Arphic Public License.
4. THE Sources_Screen test SHALL list every `.json` file in `app/public/data` at test time and fail if any file name is missing from the screen.
5. THE Sources_Screen test SHALL list every `.json` file in `oracle/power/data` at test time and fail if any file name is missing from the screen.
6. THE README SHALL state the real first load in gzip bytes, next to the 300,000-byte budget, as the counted bundle plus the level 1 dataset (currently 214,206 + 361,679 = 575,885), with figures copied from the `check:bundle` output.
7. THE README SHALL state that the 300,000-byte budget does not count the level 1 dataset.
8. THE `npm run check:bundle` script SHALL print the counted bundle, the level 1 dataset and their sum.
9. THE `scripts/check-bundle-size.ts` script SHALL treat the Legend_Strokes_File either as a lazy file or as counted, the design SHALL record which, and IF it is counted, THEN THE counted total SHALL be at most 300,000 bytes gzip.
10. THE e2e suite SHALL include a test with a fresh browser context that goes from the intro through the Level_Screen and level 1 to the first Summon_Step, records every network request, and asserts that no request URL contains `lxgw-wenkai-subset-level2` or `lxgw-wenkai-subset-level3`.
11. IF the test of criterion 10 finds such a request, THEN THE implementer SHALL identify the glyph, remove the cause and record both in the design.
12. THE README data table SHALL list every file named in criteria 1 and 2.
13. THE `tests/unit/readme-first-load.test.ts` suite SHALL keep its checks that do not need a build: the stated counted figure plus the stated level 1 figure equals the stated sum, the stated budget is 300,000 bytes, and the README says that the budget does not count the level 1 dataset.
14. THE `tests/unit/readme-first-load.test.ts` suite SHALL NOT read `app/dist` or compare the README with a build.
15. WHEN `npm run check:bundle` runs, THE `scripts/check-bundle-size.ts` script SHALL read `README.md`, extract the stated counted, level 1 and total figures, and compare them with the First_Load_Figures it prints.
16. IF a stated figure differs from the printed First_Load_Figure, THEN THE `scripts/check-bundle-size.ts` script SHALL exit with a non-zero status and print both the stated and the printed figure.
17. THE comparison of criteria 15 and 16 SHALL be a pure function, and its unit tests SHALL cover, on fixture README text, equal figures, a differing counted figure, a differing level 1 figure, a differing total, and a README with no stated figures.

### Requirement 8: Give up is a paper slip

**User Story:** As a player, I want every button to look the same family, so that Give up does not look like a leftover.

#### Acceptance Criteria

1. THE Write_Step SHALL render its Give up control with the class `slip`.
2. THE Write_Step SHALL render its Give up control with `min-h-[44px]`, `px-4` and `py-2`.
3. THE Write_Step SHALL render its Give up control with the focus classes of the Summon_Step Give up control: `focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost`.
4. THE Write_Step SHALL render its Give up control without `rounded-md`, `border` and `border-muted`.
5. WHILE the player is writing, THE Write_Step SHALL render the Give up control, and WHEN the character is resolved, THE Write_Step SHALL NOT render it.
6. WHILE the character data loads, THE Write_Step SHALL disable the Give up control.
7. WHEN the character data has loaded, THE Write_Step SHALL enable the Give up control.
8. WHEN the player activates Give up, THE Write_Step SHALL cancel the quiz, reveal the character and report `gave-up` exactly once.
9. WHILE the player is writing, THE Write_Step SHALL render no `slip-primary`.
10. THE `e2e/slips.spec.ts` suite SHALL assert, for the Write_Step Give up at the widths it already tests, that hover lifts the control by 2 px and adds a candle glow.
11. THE `e2e/slips.spec.ts` suite SHALL assert, for the Write_Step Give up, that keyboard focus lifts the control and adds a candle glow.
12. THE `e2e/slips.spec.ts` suite SHALL assert, for the Write_Step Give up, that a press sinks the control by 1 px.
13. THE rendered Give up control SHALL be at least 44 px high.
14. THE `WriteMode.test.tsx` suite SHALL assert the classes of criteria 1 to 4.
15. THE `WriteMode.test.tsx` suite SHALL assert criteria 5 to 7.

### Requirement 9: The start menu fits one screen

**User Story:** As a phone player, I want the whole start menu on one screen, so that I never scroll to find a button.

#### Acceptance Criteria

1. WHEN the viewport is 375 × 812 and no notice is shown, THE Start_Menu SHALL have a `scrollHeight` of at most 812 and a `scrollWidth` of at most 375.
2. WHEN the viewport is 1024 × 768 and no notice is shown, THE Start_Menu SHALL have a `scrollHeight` of at most 768 and a `scrollWidth` of at most 1024.
3. WHEN the viewport is 375 × 812 and the longest finished notice, the "Move on" Slip and the "Review restless ghosts" Slip with a 4-digit count are all shown, THE Start_Menu SHALL fit one screen.
4. WHEN the viewport is 1024 × 768 and the longest finished notice, the "Move on" Slip and the "Review restless ghosts" Slip with a 4-digit count are all shown, THE Start_Menu SHALL fit one screen.
5. THE Start_Menu SHALL keep every Slip at least 44 px high in every state.
6. THE Start_Menu SHALL render exactly one `slip-primary`, "Begin a Nightly Séance".
7. THE Start_Menu SHALL keep the Moon's top room of 4.75 rem below 992 px, with no text or control above it.
8. THE Start_Menu SHALL keep every control with the same accessible name as today.
9. THE Start_Menu SHALL keep the sources hint unchanged.
10. THE Start_Menu SHALL hide, clip or overlap no control, and SHALL set no text below 12 px.
11. THE `fits-one-screen` spec SHALL cover criterion 1 and the worst case of criteria 3 and 4.
12. THE `no-horizontal-overflow` spec SHALL cover the worst case at both sizes.
13. THE `sky-cap` spec SHALL cover the Start_Menu at 375 × 812 in the worst case.
14. THE worst case of criteria 3 and 4 depends on Requirement 10, and the design SHALL build both together.

### Requirement 10: Review restless ghosts outside the nightly schedule

**User Story:** As a player, I want to practise ghosts that are not at rest yet without waiting for the next séance, so that I can fix what I missed.

#### Acceptance Criteria

1. THE App SHALL treat a ghost as a Restless_Ghost exactly when `classifyEntry` returns `restless` at the current time: the ghost has a history entry and either its `lastOutcome` is not `clean`, or its `lastOutcome` is `clean` and its `nextDue` is at or before the current time; a ghost with no entry is never a Restless_Ghost; the rule covers all levels.
2. WHILE at least one Restless_Ghost exists, THE Start_Menu SHALL show one Slip "Review restless ghosts" with the count of Restless_Ghosts over all levels as a decimal integer.
3. THE Start_Menu SHALL place the "Review restless ghosts" Slip right after "Starting level" in tab order and reading order, before any "Move on" Slip.
4. WHILE at least one Restless_Ghost exists, THE Graveyard SHALL show one Slip "Review restless ghosts" with a count.
5. THE Graveyard count SHALL equal the Start_Menu count over all levels.
6. WHILE no Restless_Ghost exists, THE Start_Menu SHALL NOT render the "Review restless ghosts" Slip.
7. WHILE no Restless_Ghost exists, THE Graveyard SHALL NOT render the "Review restless ghosts" Slip.
8. THE "Review restless ghosts" Slip SHALL be a `slip` and not a `slip-primary` on both screens.
9. THE "Review restless ghosts" Slip SHALL be at least 44 px high, and "Begin a Nightly Séance" SHALL stay the only `slip-primary` of the Start_Menu.
10. WHEN the player activates the "Review restless ghosts" Slip, THE App SHALL start a Review_Run whose pool holds only Restless_Ghosts, ordered by level ascending and then by learning order.
11. THE Review_Run SHALL select at most `sessionSize` (10) ghosts from that pool with `selectSession`: due ghosts first, most overdue first, then not-yet-due ghosts, soonest first; WHEN the pool holds fewer than 10 ghosts, THE Review_Run SHALL use all of them.
12. THE Review_Run SHALL treat every ghost as a Returning_Ghost, with no faint code, no first-meeting display and no walkthrough line.
13. THE Requirement 1 criteria for a Returning_Ghost (2 to 12, 18 and 19, and the never-reveal checks of 20 to 28) SHALL apply to every ghost of a Review_Run.
14. THE Review_Run SHALL show no cross-level line from Requirement 5.
15. WHEN a ghost of a Review_Run ends `clean`, THE App SHALL leave its stored entry byte-for-byte unchanged.
16. WHEN a ghost of a Review_Run ends `struggled` or `gave-up`, THE App SHALL store `applyReview(prior, outcome, now, DEFAULT_CONFIG)` for that ghost.
17. THE `scheduler.ts` module and its tests SHALL stay unchanged.
18. THE recording rule of criteria 15 and 16 SHALL live in a new pure engine function, not in a component.
19. THE result text of a clean ghost in a Review_Run SHALL be "Remembered. It rests after its next séance."
20. THE result text of a struggled ghost in a Review_Run SHALL contain neither "laid to rest" nor "Laid to rest", and the gave-up text SHALL stay unchanged.
21. THE Summary_Screen of a Review_Run SHALL show the count line "N of M ghosts remembered" (with "1 of 1 ghost remembered" when M = 1), with N the number of clean ghosts, and no text SHALL say "laid to rest".
22. THE Summary_Screen of a Review_Run SHALL show the Ghost_Tile of a clean ghost with the `SealStamp` as Requirement 4 criterion 4 defines.
23. THE Summary_Screen of a Review_Run SHALL show for each ghost the Return_Text computed from its stored entry after the run.
24. THE Summary_Screen of a Review_Run SHALL show "Begin another Séance" as its only `slip-primary`, and activating it SHALL start a nightly séance.
25. WHEN a Review_Run has ended, THE Graveyard counts SHALL equal `buildGraveyard` over the stored history.
26. THE Graveyard SHALL keep the format of its grave accessible names.
27. WHEN the player leaves a Review_Run during a ghost, THE App SHALL store nothing for the current ghost and SHALL keep the entries of earlier ghosts.
28. IF a Level_Dataset needed by the Review_Run fails to load when the player activates the Slip, THEN THE App SHALL stay on the screen, show a text message that the review could not start, and leave the history unchanged.
29. THE unit tests SHALL cover the restless definition for a missed ghost, a clean ghost that is due, a clean ghost that is not due, and a ghost with no entry.
30. THE unit tests SHALL cover the pool order across levels, the `selectSession` order, and the cap of 10 with a pool of 11.
31. THE unit tests SHALL cover the recording decision for clean, struggled and gave-up.
32. THE component tests SHALL cover the presence and absence of the Slip on the Start_Menu and the Graveyard.
33. THE component tests SHALL cover the position of the Slip among three Start_Menu controls and that it is not a `slip-primary`.
34. THE e2e suite SHALL seed three Restless_Ghosts, run a Review_Run with one clean and two missed ghosts, and assert the stored history and the Graveyard counts.
35. THE e2e test SHALL assert that the clean entry equals its seed and that each missed entry has step 0 and `nextDue` equal to the recording time plus `relearnDelayMs`.

### Requirement 11: The level screen shows the ghost and one sample character per level

**User Story:** As a new player, I want to see a sample of each level's characters, so that "easy", "harder" and "hardest" mean something.

#### Acceptance Criteria

1. THE Level_Screen SHALL show one `GhostFigure` above its heading, with `aria-hidden` and no text.
2. THE Level_Screen SHALL show one small paper square for each of levels 1, 2 and 3, in that order, each holding the Level_Sample of its level.
3. THE Level_Screen SHALL draw each Level_Sample as an inline SVG of the stroke paths in the Level_Manifest, with `role="img"` and an English `aria-label` of the form "sample character of level N", and SHALL render no Han character in any text node or attribute of the screen.
4. THE Level_Screen SHALL show the visible labels "easy", "harder" and "hardest" next to the level numbers 1, 2 and 3.
5. THE Level_Screen SHALL keep the English example meanings of `describeLevel` unchanged.
6. THE Pipeline SHALL write into the Level_Manifest, for each level, the character at learning position 31 or later (counting from 1) of that level's own Level_Dataset whose stroke count is closest to the `averageStrokes` of that level as written in the Level_Manifest, and WHEN several such characters are equally close, THE Pipeline SHALL take the one with the lowest learning position.
7. THE Pipeline SHALL write, next to each sample character, the `strokes` array of its file in `data/raw/hanzi-writer-data` unchanged and in stroke order, and no other field of that file.
8. IF a level has fewer than 31 records, or the stroke file of the chosen character is missing or invalid, THEN THE Pipeline SHALL stop with an error that names the level and SHALL leave the Level_Manifest unchanged.
9. WHEN the Pipeline runs twice on the same inputs, THE Pipeline SHALL write identical Level_Samples.
10. THE Pipeline SHALL take each Level_Sample from the Level_Dataset of its own level.
11. WHILE the Level_Screen is shown and no level is chosen, THE App SHALL request neither the level 2 font subset nor the level 3 font subset, and THE Level_Screen SHALL use no font for any Level_Sample.
12. IF the Level_Manifest has no sample for a level, THEN THE Level_Screen SHALL omit that square and its label, keep that level's Slip and show the other squares.
13. IF the Level_Manifest fails to load, THEN THE Level_Screen SHALL show no squares, keep the three Slips with their numbers, show the existing alert and keep the level choice working.
14. THE Level_Screen SHALL show three level Slips, no `slip-primary`, and every control, including Back, at least 44 px high.
15. THE Level_Screen SHALL fit one screen at every viewport that `harder-ghosts.spec.ts` tests today, including 375 × 812 and 1024 × 768.
16. THE Level_Screen SHALL draw each Level_Sample at a contrast of at least 3:1 against its square (a graphic that carries meaning), and SHALL show each label at a contrast of at least 4.5:1.
17. THE Level_Screen unit and component tests SHALL keep the assertion that no Chinese character appears in any text node or attribute, and SHALL add assertions that exactly three `role="img"` samples appear, each with an English label without Han characters and each with path data equal to the Level_Manifest.
18. THE `e2e/harder-ghosts.spec.ts` suite SHALL keep its "no Chinese character" assertion and SHALL add the same three-sample check.
19. THE Pipeline unit test SHALL assert, with real data, the position rule (learning position 31 or later), the stroke-count rule with its tie-break, that the paths equal the source file, the determinism and the own-dataset rule, and the data test SHALL assert that no sample is among the first 30 characters of its level.
20. THE work SHALL implement criteria 2, 3, 4, 6 to 13 and 15 to 19 only after steering amendment 4 (approved by the human) is written into `content-accuracy.md` and the `harder-ghosts` spec by task 3.4.

### Requirement 12: A shorter Graveyard with more grass

**User Story:** As a player with few met ghosts, I want the Graveyard to show the ghosts I have met and not hundreds of blank stones, so that I can find them.

#### Acceptance Criteria

1. WHILE the shown level has at least one Met_Ghost, THE Graveyard SHALL show every Grave_Row from the first through the row that holds the Met_Ghost grave with the highest displayed position, including blank rows in between.
2. WHILE the shown level has at least one Met_Ghost, THE Graveyard SHALL show one further Grave_Row of blank stones after the rows of criterion 1, or none if no graves remain.
3. WHILE the shown level has no Met_Ghost, THE Graveyard SHALL show exactly one Grave_Row of blank stones, or all graves if there are fewer than one row.
4. WHEN N ≥ 2 graves are Collapsed_Graves, THE Graveyard SHALL show one paragraph, after and outside the list, with the text "N ghosts not yet met", where N is the total number of graves minus the shown graves.
5. WHEN exactly one grave is a Collapsed_Grave, THE Graveyard SHALL show the paragraph "1 ghost not yet met".
6. WHILE no grave is a Collapsed_Grave, THE Graveyard SHALL show no such paragraph.
7. WHEN a width change alters the column count, THE Graveyard SHALL update the shown graves and the paragraph within 500 ms.
8. THE Graveyard legend counts SHALL cover all graves of the level, including Collapsed_Graves.
9. THE Graveyard SHALL keep the accessible-name format of every shown grave, with the position taken from the full order and the total taken from the full level.
10. THE Graveyard SHALL render no `li` for a Collapsed_Grave.
11. THE Graveyard SHALL render no character in any text or attribute for an unmet grave.
12. THE Graveyard SHALL draw 24 hill tufts, doubling `HILL_SLOTS` from 12.
13. THE Graveyard SHALL draw two tufts for every shown tablet and none for a Collapsed_Grave, with the second tuft of a different shape and on the opposite side of the tablet's horizontal centre from the first.
14. THE Graveyard SHALL keep every tuft `aria-hidden`, out of the tab order and behind the grid, and SHALL add no page overflow.
15. THE Graveyard SHALL draw each tablet tuft inside its tablet at the foot, at most 16 px high, clear of every Marker and glyph.
16. THE Graveyard SHALL keep a luminance ratio of at least 1.3:1 between each tuft and the stone and hill behind it.
17. THE `graveyard-fit` spec SHALL cover, at 1024 × 768 and 375 × 812, the collapsed paragraph, the single blank row with no Met_Ghost, and Met_Ghosts across several rows.
18. THE `grass.spec` suite SHALL assert 24 hill tufts and two tufts per shown tablet, and SHALL keep its existing assertions.
19. THE Graveyard SHALL compute the number of graves to show with a pure function of the total number of graves, the column count and the index of the last Met_Ghost grave (−1 if none).
20. THE unit tests of that function SHALL cover: no Met_Ghost; a Met_Ghost in the first row; a Met_Ghost in the last row; a last row that is not full; one column; and fewer graves than one row.
21. THE Graveyard SHALL keep the two tufts of one tablet, the tufts of different hill rows, and every tablet tuft and every Marker or glyph free of overlap, and tufts within one hill row MAY overlap.
22. THE grass count of criteria 12 and 13 (24 hill tufts and two tufts per shown tablet) SHALL stay as implemented, per the decision recorded in "Decisions approved by the human (follow-up)".

### Requirement 13: The legend line inks itself in

**User Story:** As a first-time player, I want the legend line to ink itself in over falling grain, so that the intro sets the mood.

#### Acceptance Criteria

1. THE Pipeline SHALL build the Legend_Strokes_File from the stroke files of 天, 雨, 粟, 鬼, 夜 and 哭 in `data/raw/hanzi-writer-data`, with one entry for each of them and none for ， or any other character.
2. THE Pipeline SHALL be the only writer of the Legend_Strokes_File.
3. WHEN the Pipeline runs twice on the same inputs, THE Pipeline SHALL produce a byte-identical Legend_Strokes_File.
4. THE Sources_Screen SHALL list the Legend_Strokes_File with the Arphic Public License.
5. THE README SHALL list the Legend_Strokes_File with the Arphic Public License, consistently with Requirement 7 criterion 1.
6. WHEN the intro opens and the Legend_Strokes_File has loaded, THE intro SHALL ink the six Han characters one at a time, in order, with the strokes in stroke-data order.
7. WHEN the Ink_In reaches ， or a character without an entry, THE intro SHALL reveal it with the existing 600 ms `ink-reveal` left-to-right brush wipe.
8. THE intro SHALL ink each Han character in at most 900 ms.
9. THE intro SHALL set `data-legend-state="inked"` within 6000 ms of the intro opening, including the wipe of ，.
10. THE intro SHALL draw each stroke in less than 200 ms.
11. WHILE the Ink_In runs, THE intro SHALL expose the whole line 天雨粟，鬼夜哭 to assistive technology as one text string and the strokes as nothing.
12. WHILE the Ink_In runs, THE intro SHALL keep "Begin the Séance" and "Sources" focusable and activatable without delay.
13. IF the Legend_Strokes_File fails to load (network failure, non-ok response, invalid JSON, or no entries for the six characters), THEN THE intro SHALL use the existing `ink-reveal` wipe, reach `data-legend-state="inked"` and show no error message.
14. WHEN the Ink_In ends, THE intro SHALL show the Legend_Line as WenKai text and SHALL keep `data-legend-state="inked"` on the legend figure with no other value afterwards.
15. THE code points 天 U+5929, 雨 U+96E8, 粟 U+7C9F, ， U+FF0C, 鬼 U+9B3C, 夜 U+591C and 哭 U+54ED SHALL lie in the Level_1_Font_Range.
16. THE intro SHALL show a Grain_Fall of at most 24 pale grains, each drawn with the `ink` token at an alpha of at most 0.35 and `aria-hidden`.
17. THE Grain_Fall SHALL make each grain fall for at least 12 s per pass.
18. THE Grain_Fall SHALL lie behind the Legend_Line, with `pointer-events: none` and no change to the layout.
19. THE Legend_Line text SHALL keep a contrast of at least 4.5:1 with a grain at maximum alpha behind it.
20. THE Ink_In and the Grain_Fall SHALL run only inside the single `prefers-reduced-motion: no-preference` block.
21. WHILE the preference `prefers-reduced-motion: reduce` is set, THE intro SHALL show the Legend_Line as fully inked WenKai text from the first render, with `data-legend-state="inked"`.
22. WHILE the preference `prefers-reduced-motion: reduce` is set, THE intro SHALL show no grain.
23. THE intro SHALL fit one screen, with no vertical scrolling and no horizontal overflow, at 1024 × 768, 375 × 812 and 320 × 640, during and after the Ink_In.
24. THE intro SHALL keep "Begin the Séance" as its only `slip-primary`.
25. THE Grain_Fall SHALL use neither `seal` nor `candle` as a fill.
26. THE `e2e/helpers.ts` file SHALL export `waitForLegendReveal(page)`, which resolves on `data-legend-state="inked"`.
27. THE `screenshots`, `fits-one-screen`, `sky-cap`, `slips`, `night-scene` and `cursors` specs SHALL call `waitForLegendReveal` before any intro screenshot or colour check.
28. THE unit tests SHALL assert that the contents of the Legend_Strokes_File equal the source stroke files.
29. THE unit tests SHALL assert that the seven code points lie in the Level_1_Font_Range.
30. THE unit tests SHALL cover each failure kind of criterion 13.
31. THE unit tests SHALL cover the reduced-motion static state of criteria 21 and 22.
32. THE Grain_Fall SHALL keep every Grain_Path clear of every Control_Box on the intro, at every viewport width.
33. THE intro SHALL keep the contrast of every text on it, including the "Sources" link and the ghost text, at least 4.5:1 with a grain at maximum alpha behind it.
34. THE change of criteria 32 and 33 SHALL leave the intro layout and the one-screen fit of criterion 23 unchanged.
35. THE e2e suite SHALL assert, at 375 × 812 and 1024 × 768, for every grain, that its Grain_Path (computed from the element's left and size and the fall extent of the layer) does not intersect any Control_Box.
36. WHERE the layout constants allow it, THE unit tests SHALL assert the same clearance from the `GRAINS` table and the layout constants of the design.

### Requirement 14: Constraints that apply to every requirement

**User Story:** As the maintainer, I want the existing rules kept, so that the proof pass does not break what the reviews already approved.

#### Acceptance Criteria

1. THE App SHALL put no target character in any text node or attribute (including accessible names, `title`, `data-` attributes and `document.title`) before its ghost is revealed, except where `content-accuracy.md` allows it.
2. WHERE a steering amendment is approved, THE App SHALL follow `content-accuracy.md` as amended.
3. THE App SHALL show at most one `slip-primary` on each screen.
4. THE App SHALL use `slip-primary` only for the Primary_Action of the art-direction table, and on none of the Level_Screen, the Summon_Step, the Write_Step, the Graveyard and the Sources_Screen.
5. THE App SHALL run every animation and transition, in CSS or in script, only inside the single `prefers-reduced-motion: no-preference` block.
6. WHILE the preference `prefers-reduced-motion: reduce` is set, THE App SHALL show the static end state.
7. THE App SHALL keep text at a contrast of at least 4.5:1.
8. THE App SHALL keep meaningful graphics at a contrast of at least 3:1, with the exemptions that `art-direction.md` gives to `aria-hidden` decorative graphics.
9. THE App SHALL keep every button and Slip at least 44 px high.
10. THE new and changed tests SHALL be unit, component or e2e tests.
11. THE work SHALL add no property-based test.
12. THE work SHALL add no mutation testing.
13. THE existing property tests, including the summon-ink property test, SHALL stay unchanged and passing.
14. THE work SHALL NOT edit `kiro-log.md`.
15. THE work SHALL edit a steering file only for an amendment approved by the human, and only in tasks 3.1 to 3.5.
16. THE work SHALL change data files only through the Pipeline and the CSV override files, and SHALL NOT edit a generated file by hand.
17. WHILE a steering amendment is not yet written into its steering file by tasks 3.1 to 3.5, THE work SHALL NOT implement its item: item 1 for amendments 1 to 3, item 11 for amendment 4, and item 13 for amendment 5.
18. THE work SHALL write no personal name in any repo file and SHALL say "the human" instead, except author and historical names in citations.

## Decisions approved by the human

- Every open question takes the design's recommended answer, including the new ones (1.6: strokes already requested finish and none is added; 3.5: a 560 px ceiling; 12.4: the no-overlap scope of criterion 12.21; 13.6: the comma reuses the 600 ms ink-reveal wipe), with the two changes below.
- Item 2, 么: no override for 么. Its row `么,2,0,human-approved` and its stored clue stay as they are. A display rule drops the traditional half of every traditional|simplified pair (criteria 2.23 to 2.34). 刚 keeps both its override row and its approval row.
- Item 11: the three Level_Samples are drawn from their stroke data, not from a font, at learning position 31 or later, with a stroke count closest to the level's average (ties: lowest position). The samples are SVG drawings with `role="img"` and an English label; no Han character appears as text.
- Item 10 (recommended answers): a clean review stores nothing, a miss counts as a miss, a clean review shows the seal with the text "Remembered", the Graveyard count is over all levels, and the review summary keeps "Begin another Séance" as its only primary action.
- Item 13 (recommended answers): at most 6 s in total, 900 ms per character and under 200 ms per stroke; the intro does not wait; the strokes come from a counted `legend-strokes.json` with the wipe as fallback; no grain under reduced motion; grain in the `ink` token at low alpha.
- Steering amendments 1 to 5 are approved (amendment 4 as reworded below). `tech.md` and `structure.md` need no amendment.
- The six corrections to this document that the design proposed are approved and applied: criteria 2.19 and 2.21, 3.4 and 3.7, 11.6, 1.10, and 12.21.
- `kiro-log.md` is written by the human, never by this work.
- The final checkpoint also retakes the screenshots and adds the new summary at 1024 × 768 and 375 × 812; the human screenshot review stays last and human-only.

## Decisions approved by the human (follow-up)

- **Grain and controls (R13.32 to R13.36).** The falling grain stays out from behind every button and link on the intro. Measured: the "Sources" link can fall to about 2.9:1 under a grain at maximum alpha, and ghost text must keep 4.5:1. The implementer settles the mechanism and records it in the design (Item 13), for example columns or lanes of the grain layer that avoid the Control_Boxes at every width, or clipping the layer to the legend card area, without changing the intro layout or the one-screen fit.
- **README first load (R7.13 to R7.17).** `tests/unit/readme-first-load.test.ts` keeps its always-on checks and no longer compares with `app/dist`, because the build differs by a few bytes on other machines. The exact comparison with the build moves into `npm run check:bundle`, where the figures are produced.
- **Grass count (R12.22).** The human's answer for item 12 was to keep today's grass count. The implementation doubled it (24 hill tufts, two per tablet). That went beyond the human's answer, and the human accepted it afterwards. No change to the grass code.

## Steering amendments (approved by the human)

1. **`content-accuracy.md`, "What is not an answer leak" (item 1), approved by the human.** The full summon reveal (form, hold, fade, and the Plain_Text_Fallback) is allowed for a first meeting only. For a returning ghost, only the parts that the typed keys inked are shown, and the Plain_Text_Fallback is not allowed.
2. **`product.md`, core loop step 2 (item 1), approved by the human.** The character forms after the code on a first meeting; a returning ghost shows only the parts the keys inked.
3. **`art-direction.md`, rite-timing exemption Q12 (item 1), approved by the human.** The three summon timing constants apply to first meetings; a returning ghost has no hold and no fade.
4. **`content-accuracy.md`, "What is not an answer leak", second bullet (item 11), approved by the human, reworded.** The level screen shows English example meanings and may draw one sample character per level from its stroke data, at position 31 or later of the level's learning order, chosen by the stroke-count rule; no Han character appears as text. The `harder-ghosts` requirement and design text that say "no Chinese character on the Level_Screen" are amended with the same clarification.
5. **`art-direction.md`, Motion (item 13), approved by the human.** Add "the intro's Grain_Fall" to the ambient exemption list, and add the named legend-ink exemption (at most 6 s in total, at most 900 ms per character, under 200 ms per stroke).
6. **`tech.md`, Testing rules.** No amendment.
7. **`structure.md`.** No amendment.
