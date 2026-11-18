# Requirements Document

## Introduction

Proof Pass answers the third outside review of Ghost Script. It contains thirteen items in the human's priority order: four must-do items (a memory fix for returning ghosts, six corrected clues, a bigger Summon paper, a summary that works as a reward) and nine small fixes (a cross-level notice, Graveyard order, data-file credits and first-load honesty, a Give up slip, a start menu that fits, a restless-ghost review, a level screen with samples, a collapsed Graveyard with more grass, and an animated legend line).

This phase produces requirements only. Design and tasks follow in later phases, and nothing is implemented now. The requirement order below is the human's priority order. Requirement 14 collects the constraints that apply to all of them.

Three items conflict with current steering text and need approval before implementation: item 1 (content-accuracy and product), item 11 (content-accuracy and the harder-ghosts spec), and item 13 (art-direction). The list is at the end of this document, under "Steering amendments needing approval".

### Investigation findings (read-only, cited)

- `app/src/modes/SummonStep.tsx`: `SUMMON_HOLD_MS = 1500`, `SUMMON_FADE_MS = 1500`, `SUMMON_INK_SPEED = 2`. Once the code is complete (or the player gives up), the forming effect draws every stroke not yet inked (`enqueueInk` over `strokeCount`), or calls `animateCharacter()` for opaque ghosts. It then holds 1500 ms, fades 1500 ms, and calls `onDone`. If the writer is missing or breaks, `useFallback` shows the character as plain text (`<p lang="zh">{record.character}</p>`) with the same hold and fade. The `firstMeeting` prop only changes the faint code, the next-key highlight and the status text. It does not change the reveal, so a returning ghost gets the same full reveal as a first meeting.
- `summonPaperSize` (`app/src/engine/surfaceSize.ts`) is `max(96, min(0.4 × width, 160, height − reserved − 600))`. That gives 160 px at 1024 × 768 and 150 px at 375 × 812. The 600 is the height budget of everything else on the Summon step.
- `app/src/engine/graveyard.ts`: `classifyEntry` returns `restless` when `lastOutcome` is not `clean`, or when it is `clean` and `nextDue <= now`. Otherwise it returns `at-rest`, or `unmet` with no entry. `buildGraveyard` lists graves in `learningOrder` and returns counts per state.
- `app/src/engine/scheduler.ts`: `applyReview` (clean advances the ladder; a miss sets step 0 and `nextDue = now + relearnDelayMs`) and `selectSession` (due ghosts most overdue first, then new ones, then not-yet-due ones soonest first). Neither needs to change for item 10.
- `app/src/App.tsx`: `planSeance` and `SeanceScope` build the pool with `sessionCharacterList` (chosen level first, then other levels' ghosts that have a history entry). `firstMeetingSet` marks ghosts with no history entry. Only a brand-new player gets the walkthrough ghost, picked by `pickWalkthroughGhost` from the level 1 order. Storage is at `CURRENT_SCHEMA_VERSION = 3` (`app/src/storage/storage.ts`). Item 10 needs no schema change.
- Learning order (computed read-only from `app/public/data/*.json` with the rule in `learningOrder.ts`): the walkthrough ghost is 明, at level 1 position 13 (transparent, 8 strokes). It is level 1 data and is not in the level 2 or 3 datasets. Level 1 has 15 transparent, 95 partial and 190 opaque ghosts.
- `data/prompt-overrides.csv` (level 1) already has `么,2,0,human-approved` and `本,0,8,human-approved`, and no row for 天. `data/prompt-approvals.csv` has `刚,human`. CC-CEDICT lines (`data/raw/cc-cedict/cedict_ts.u8`) show each of the six requested texts in exactly one (entry, meaning) of its character: 么 entry 1 meaning 0 (reading ma5), 本 entry 0 meaning 0 (with the "(bound form) " prefix, stripped), 天 entry 0 meaning 1, 云 entry 2 meaning 0, 刚 entry 0 meaning 3, 获 entry 1 meaning 0 (with the prefix, stripped). Note that the new 么 entry has the reading ma, while the current clue shows me.
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
- **Level_1_Review_Value**: the `reviewedBy` value written in the three level 1 override rows of Requirement 2, chosen under Item 2 Q1 (recommended: `human`).
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
- **Level_Sample**: the one character shown on a paper square on the Level_Screen for a level.
- **Level_Manifest**: `app/public/data/levels.json`, generated by the data pipeline.
- **Level_1_Font_Range**: the `unicode-range` of the level 1 `@font-face` in `app/src/styles/fonts.css`.
- **Legend_Line**: the intro line 天雨粟，鬼夜哭.
- **Legend_Strokes_File**: a new file `app/public/data/legend-strokes.json`, built by `scripts/` from `data/raw/hanzi-writer-data`.
- **Ink_In**: the character-by-character inking of the Legend_Line.
- **Grain_Fall**: the slow fall of pale grain behind the Legend_Line.
- **Sources_Screen**: the Sources & licences screen (`Credits`).
- **Power**: the Kiro Power packaged from `oracle/power/`.
- **Pipeline**: the Node and TypeScript scripts in `scripts/` that build the datasets and derived files.
- **Slip**: an element with the `slip` or `slip-primary` class as defined in `art-direction.md`.
- **Fit_Tests**: the Playwright specs that check one-screen fit (`e2e/fits-one-screen.spec.ts`, `e2e/no-horizontal-overflow.spec.ts`, `e2e/sky-cap.spec.ts`, `e2e/graveyard-fit.spec.ts`).

## Requirements

### Requirement 1: Returning ghosts show no formed character after the code

**User Story:** As a returning player, I want the game to stop showing me the finished character after I type the code, so that writing it tests my memory and not my copying.

#### Acceptance Criteria

1. IF steering amendments 1 to 3 are not approved, THEN THE Summon_Step SHALL keep today's reveal for every ghost, and the work SHALL NOT merge criteria 2 to 12 and 18 to 28 of this requirement.
2. WHEN the code of a Returning_Ghost with a transparent or partial `summonInk` class is complete, THE Summon_Step SHALL call `onDone` exactly once, after all strokes queued by the accepted keys have finished animating.
3. WHEN the code of a Returning_Ghost with an opaque `summonInk` class is complete, THE Summon_Step SHALL call `onDone` once, without waiting for any animation.
4. WHEN the code of a Returning_Ghost with an opaque `summonInk` class is complete, THE Summon_Step SHALL call neither `animateCharacter` nor `animateStroke`.
5. WHEN the code of a Returning_Ghost with an opaque `summonInk` class is complete, THE Summon_Paper SHALL contain no stroke.
6. WHEN the code of a Returning_Ghost with a transparent or partial `summonInk` class is complete, THE Summon_Step SHALL call `animateStroke` only for stroke indices in the union of the `keyStrokes` of the accepted keys, and SHALL never call `animateCharacter`.
7. WHEN the code of a Returning_Ghost is complete, THE Summon_Step SHALL start the Write_Step with a hold of 0 ms and a fade of 0 ms, without starting a `SUMMON_HOLD_MS` timer or a `SUMMON_FADE_MS` timer.
8. IF the animation fails for a Returning_Ghost because `HanziWriter.create` throws or `onLoadCharDataError` fires, THEN THE Summon_Step SHALL call `onDone` exactly once with a hold of 0 ms and a fade of 0 ms.
9. IF the animation fails for a Returning_Ghost, THEN THE Summon_Step SHALL render no Plain_Text_Fallback node.
10. WHEN the player gives up the Summon_Step of a Returning_Ghost, THE Summon_Step SHALL draw no stroke and SHALL call neither `animateCharacter` nor `animateStroke`.
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

### Requirement 2: Six corrected clues

**User Story:** As a player, I want the six clues the review found misleading to show the right sense of each character, so that the ghost I meet matches the character I must write.

#### Acceptance Criteria

1. THE Pipeline SHALL set the Clue meaning to the following texts, each taken from the character's own CC-CEDICT entries: 么 "interrogative final particle", 本 "root; stem", 天 "sky", 云 "cloud", 刚 "just; only a short while ago", 获 "to reap; to harvest".
2. THE Pipeline SHALL apply an override row for one of the six characters only IF `stripBoundForm(meaning)` of the selected (entry, meaning) pair equals the requested text and no other pair of that character does.
3. IF an override row of the six characters does not satisfy criterion 2, THEN THE Pipeline SHALL exit with a failure that names the character, the text and the number of matching pairs, and SHALL leave every generated file unchanged.
4. THE `data/prompt-overrides.csv` file SHALL replace, in place, the row `么,2,0,human-approved` with `么,1,0,<Level_1_Review_Value>`.
5. THE `data/prompt-overrides.csv` file SHALL replace, in place, the row `本,0,8,human-approved` with `本,0,0,<Level_1_Review_Value>`.
6. THE `data/prompt-overrides.csv` file SHALL gain exactly the row `天,0,1,<Level_1_Review_Value>`, with no other row added or removed.
7. THE `data/prompt-overrides-level2.csv` file SHALL gain exactly the rows `云,2,0,human` and `刚,0,3,human`.
8. THE `data/prompt-overrides-level3.csv` file SHALL gain exactly the row `获,1,0,human`.
9. THE Pipeline SHALL leave the Clues of 第, 视, 奋 and 居 unchanged.
10. WHERE the human accepts Item 2 Q2, THE Pipeline SHALL take the 么 reading from CC-CEDICT entry 1 (ma5), so that the Clue pinyin of 么 is "ma".
11. WHEN the Pipeline runs twice on the same inputs, THE Pipeline SHALL produce byte-identical output for the three Level_Datasets, the Level_Manifest, the three review files and `app/src/data/promptCounts.generated.ts`.
12. THE Level_1_Pin SHALL change only in the SHA-256 of `app/public/data/characters.json` and the SHA-256 of `data/prompt-review.csv`.
13. THE Level_1_Pin SHALL keep the SHA-256 of `data/character-list.txt` unchanged.
14. THE test suite SHALL include a fixture of per-record SHA-256 values for all 300 level 1 records (one hash of the whole record and one hash of the record without its `prompt` field), committed before the first edit to `data/prompt-overrides.csv`.
15. THE test suite SHALL assert that the hash of the record without `prompt` matches the fixture for all 300 level 1 records.
16. THE test suite SHALL assert that the whole-record hash matches the fixture for exactly 297 level 1 records and differs for exactly 么, 本 and 天.
17. THE test suite SHALL assert that the new Clue of each of 么, 本 and 天 equals the requested text plus the reading of the selected entry.
18. THE test suite SHALL assert, against a per-line hash fixture captured before the edit, that every line of `data/prompt-review.csv` except the lines of 么, 本 and 天 is identical.
19. THE test suite SHALL assert that the three changed lines of `data/prompt-review.csv` show the new meaning and the Level_1_Review_Value.
20. THE test suite SHALL assert, with per-record fixtures, that the level 2 dataset differs only in 云 and 刚 and the level 3 dataset differs only in 获.
21. THE regenerated `promptCounts.generated.ts` SHALL change only by one fewer unreviewed level 2 prompt (云) and one fewer unreviewed level 3 prompt (获), because 刚 is already approved, and the existing credits tests SHALL pass.
22. THE `data/prompt-review-level2.csv` and `data/prompt-review-level3.csv` files SHALL show `reviewedBy` = `human` for 云, 刚 and 获 after the build.
23. THE 50-row review sample files SHALL keep the same characters at the same positions, and only the `reviewedBy` cell of a sampled 云, 刚 or 获 MAY change.
24. THE design SHALL check whether the example meanings in `levels.json` use the meanings of 么, 本 or 天, and SHALL record the result.

### Requirement 3: A bigger Summon paper

**User Story:** As a player on a laptop or a phone, I want the Summon paper as large as the screen allows, so that I can see the inked parts clearly.

#### Acceptance Criteria

1. WHEN the viewport is 1024 × 768, THE Summon_Step SHALL draw the Summon_Paper with a side of at least 260 px for a Returning_Ghost and for a non-guided First_Meeting_Ghost, with `reservedPx` 0.
2. WHEN the viewport is 1024 × 768, THE Summon_Step SHALL draw the Summon_Paper of the Guided_Ghost with a side of at least 260 px, with `reservedPx` equal to `WALKTHROUGH_LINE_PX` (24).
3. WHEN the viewport is 375 × 812, THE Summon_Step SHALL draw the Summon_Paper with a side of at least 240 px.
4. THE `summonPaperSize` function SHALL return the floor of the smaller of (width − 32) and (height − `reservedPx` − 484), where 484 px is the height of all other Summon content except the Summon_Paper and the walkthrough line, and SHALL no longer apply the limit of 0.4 × width or the cap of 160.
5. THE `summonPaperSize` function SHALL return at least 96.
6. THE Summon_Step SHALL set the hint text, the status line, the system-input note and the Unihan note at 12 px or larger, reduced only as far as criterion 7 needs.
7. WHEN the viewport is 1024 × 768 and `reservedPx` is 0, THE Summon_Step SHALL keep the other Summon content within 484 px of height.
8. THE Summon_Step SHALL keep text, including the reduced text, at a contrast of at least 4.5:1.
9. THE Summon_Step SHALL fit one screen, with no vertical scrolling and no horizontal overflow, at 1024 × 768, 375 × 812 and 320 × 640, for a Returning_Ghost, a First_Meeting_Ghost and the Guided_Ghost.
10. THE Summon_Step SHALL keep every control at least 44 px high.
11. THE Summon_Step SHALL keep the Moon's top room of 4.75 rem below 992 px.
12. THE Fit_Tests SHALL assert that `ink-surface` is square, at least 260 px at 1024 × 768 and at least 240 px at 375 × 812.
13. THE Fit_Tests SHALL add 320 × 640 to the Summon fit check.
14. THE unit tests of `summonPaperSize` SHALL assert exactly: 1024 × 768 with `reservedPx` 0 gives 284; 1024 × 768 with `reservedPx` 24 gives 260; 375 × 812 gives 328; 320 × 640 gives 156; 320 × 500 gives 96.
15. THE design SHALL confirm the 32 px page padding and SHALL reconcile this requirement with Requirement 5 criterion 15 (the height of the cross-level line).

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
3. THE Sources_Screen SHALL state, for each file of criteria 1 and 2, what it holds and which sources and licences its fields carry, reusing the wording of `credits.ts` and adding no new licence claim.
4. THE Sources_Screen test SHALL list every `.json` file in `app/public/data` at test time and fail if any file name is missing from the screen.
5. THE Sources_Screen test SHALL list every `.json` file in `oracle/power/data` at test time and fail if any file name is missing from the screen.
6. THE README SHALL state the real first load in gzip bytes, next to the 300,000-byte budget, as the counted bundle plus the level 1 dataset (currently 214,206 + 361,679 = 575,885), with figures copied from the `check:bundle` output.
7. THE README SHALL state that the 300,000-byte budget does not count the level 1 dataset.
8. THE `npm run check:bundle` script SHALL print the counted bundle, the level 1 dataset and their sum.
9. THE `scripts/check-bundle-size.ts` script SHALL treat the Legend_Strokes_File either as a lazy file or as counted, the design SHALL record which, and IF it is counted, THEN THE counted total SHALL be at most 300,000 bytes gzip.
10. THE e2e suite SHALL include a test with a fresh browser context that goes from the intro through the Level_Screen and level 1 to the first Summon_Step, records every network request, and asserts that no request URL contains `lxgw-wenkai-subset-level2` or `lxgw-wenkai-subset-level3`.
11. IF the test of criterion 10 finds such a request, THEN THE implementer SHALL identify the glyph, remove the cause and record both in the design.
12. THE README data table SHALL list every file named in criteria 1 and 2.

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
5. WHERE Item 10 Q5 is approved, THE Graveyard count SHALL equal the Start_Menu count over all levels.
6. WHILE no Restless_Ghost exists, THE Start_Menu SHALL NOT render the "Review restless ghosts" Slip.
7. WHILE no Restless_Ghost exists, THE Graveyard SHALL NOT render the "Review restless ghosts" Slip.
8. THE "Review restless ghosts" Slip SHALL be a `slip` and not a `slip-primary` on both screens.
9. THE "Review restless ghosts" Slip SHALL be at least 44 px high, and "Begin a Nightly Séance" SHALL stay the only `slip-primary` of the Start_Menu.
10. WHEN the player activates the "Review restless ghosts" Slip, THE App SHALL start a Review_Run whose pool holds only Restless_Ghosts, ordered by level ascending and then by learning order.
11. THE Review_Run SHALL select at most `sessionSize` (10) ghosts from that pool with `selectSession`: due ghosts first, most overdue first, then not-yet-due ghosts, soonest first; WHEN the pool holds fewer than 10 ghosts, THE Review_Run SHALL use all of them.
12. THE Review_Run SHALL treat every ghost as a Returning_Ghost, with no faint code, no first-meeting display and no walkthrough line.
13. THE Requirement 1 criteria for a Returning_Ghost (2 to 12, 18 and 19, and the never-reveal checks of 20 to 28) SHALL apply to every ghost of a Review_Run.
14. THE Review_Run SHALL show no cross-level line from Requirement 5.
15. WHERE Item 10 Q1 and Q2 are approved, WHEN a ghost of a Review_Run ends `clean`, THE App SHALL leave its stored entry byte-for-byte unchanged.
16. WHERE Item 10 Q1 is approved, WHEN a ghost of a Review_Run ends `struggled` or `gave-up`, THE App SHALL store `applyReview(prior, outcome, now, DEFAULT_CONFIG)` for that ghost.
17. THE `scheduler.ts` module and its tests SHALL stay unchanged.
18. THE recording rule of criteria 15 and 16 SHALL live in a new pure engine function, not in a component.
19. WHERE Item 10 Q3 is approved, THE result text of a clean ghost in a Review_Run SHALL be "Remembered. It rests after its next séance."
20. WHERE Item 10 Q3 is approved, THE result text of a struggled ghost in a Review_Run SHALL contain neither "laid to rest" nor "Laid to rest", and the gave-up text SHALL stay unchanged.
21. WHERE Item 10 Q3 is approved, THE Summary_Screen of a Review_Run SHALL show the count line "N of M ghosts remembered" (with "1 of 1 ghost remembered" when M = 1), with N the number of clean ghosts, and no text SHALL say "laid to rest".
22. WHERE Item 10 Q3 is approved, THE Summary_Screen of a Review_Run SHALL show the Ghost_Tile of a clean ghost with the `SealStamp` as Requirement 4 criterion 4 defines.
23. THE Summary_Screen of a Review_Run SHALL show for each ghost the Return_Text computed from its stored entry after the run.
24. WHERE Item 10 Q6 is approved, THE Summary_Screen of a Review_Run SHALL show "Begin another Séance" as its only `slip-primary`, and activating it SHALL start a nightly séance.
25. WHEN a Review_Run has ended, THE Graveyard counts SHALL equal `buildGraveyard` over the stored history.
26. THE Graveyard SHALL keep the format of its grave accessible names.
27. WHEN the player leaves a Review_Run during a ghost, THE App SHALL store nothing for the current ghost and SHALL keep the entries of earlier ghosts.
28. IF a Level_Dataset needed by the Review_Run fails to load when the player activates the Slip, THEN THE App SHALL stay on the screen, show a text message that the review could not start, and leave the history unchanged.
29. THE unit tests SHALL cover the restless definition for a missed ghost, a clean ghost that is due, a clean ghost that is not due, and a ghost with no entry.
30. THE unit tests SHALL cover the pool order across levels, the `selectSession` order, and the cap of 10 with a pool of 11.
31. THE unit tests SHALL cover the recording decision for clean, struggled and gave-up, according to the approved answers.
32. THE component tests SHALL cover the presence and absence of the Slip on the Start_Menu and the Graveyard.
33. THE component tests SHALL cover the position of the Slip among three Start_Menu controls and that it is not a `slip-primary`.
34. THE e2e suite SHALL seed three Restless_Ghosts, run a Review_Run with one clean and two missed ghosts, and assert the stored history and the Graveyard counts.
35. WHERE Item 10 Q1 and Q2 are approved, THE e2e test SHALL assert that the clean entry equals its seed and that each missed entry has step 0 and `nextDue` equal to the recording time plus `relearnDelayMs`.

### Requirement 11: The level screen shows the ghost and one sample character per level

**User Story:** As a new player, I want to see a sample of each level's characters, so that "easy", "harder" and "hardest" mean something.

#### Acceptance Criteria

1. THE Level_Screen SHALL show one `GhostFigure` above its heading, with `aria-hidden` and no text.
2. THE Level_Screen SHALL show one small paper square for each of levels 1, 2 and 3, in that order, each holding the Level_Sample of its level.
3. THE Level_Screen SHALL render each Level_Sample as one character in LXGW WenKai with `lang="zh"`.
4. THE Level_Screen SHALL show the visible labels "easy", "harder" and "hardest" next to the level numbers 1, 2 and 3.
5. THE Level_Screen SHALL keep the English example meanings of `describeLevel` unchanged.
6. WHERE the recommended answer of Item 11 Q1 is approved, THE Pipeline SHALL write into the Level_Manifest, for each level, the first character at learning position 31 or later (counting from 1) whose code point lies in the Level_1_Font_Range.
7. IF the Pipeline finds no such character for a level, THEN THE Pipeline SHALL stop with an error that names the level and SHALL leave the Level_Manifest unchanged.
8. WHEN the Pipeline runs twice on the same inputs, THE Pipeline SHALL write identical Level_Samples.
9. THE Pipeline SHALL take each Level_Sample from the Level_Dataset of its own level.
10. WHILE the Level_Screen is shown and no level is chosen, THE App SHALL request neither the level 2 font subset nor the level 3 font subset, and every Level_Sample SHALL use a glyph of the level 1 subset.
11. IF the Level_Manifest has no sample for a level, THEN THE Level_Screen SHALL omit that square and its label, keep that level's Slip and show the other squares.
12. IF the Level_Manifest fails to load, THEN THE Level_Screen SHALL show no squares, keep the three Slips with their numbers, show the existing alert and keep the level choice working.
13. THE Level_Screen SHALL show three level Slips, no `slip-primary`, and every control, including Back, at least 44 px high.
14. THE Level_Screen SHALL fit one screen at every viewport that `harder-ghosts.spec.ts` tests today, including 375 × 812 and 1024 × 768.
15. THE Level_Screen SHALL show each Level_Sample at a contrast of at least 4.5:1 on its square, and each label at a contrast of at least 4.5:1.
16. THE Level_Screen unit and component tests SHALL replace "no Chinese character" with assertions that exactly three Han characters appear, one per square, each equal to the manifest sample and none among the first 30 characters of its level.
17. THE `e2e/harder-ghosts.spec.ts` suite SHALL replace "no Chinese character" in the same way and SHALL add the check that no sample is among the first 30 characters of its level.
18. THE Pipeline unit test SHALL assert, with real data, the position rule, the font-range rule, the determinism and the own-dataset rule.
19. IF steering amendment 4 is not approved, THEN THE Level_Screen SHALL keep showing no Han character, and the work for criteria 2, 3, 4, 6 to 12 and 15 to 18 SHALL NOT start.

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

### Requirement 13: The legend line inks itself in

**User Story:** As a first-time player, I want the legend line to ink itself in over falling grain, so that the intro sets the mood.

#### Acceptance Criteria

1. THE Pipeline SHALL build the Legend_Strokes_File from the stroke files of 天, 雨, 粟, 鬼, 夜 and 哭 in `data/raw/hanzi-writer-data`, with one entry for each of them and none for ， or any other character.
2. THE Pipeline SHALL be the only writer of the Legend_Strokes_File.
3. WHEN the Pipeline runs twice on the same inputs, THE Pipeline SHALL produce a byte-identical Legend_Strokes_File.
4. THE Sources_Screen SHALL list the Legend_Strokes_File with the Arphic Public License.
5. THE README SHALL list the Legend_Strokes_File with the Arphic Public License, consistently with Requirement 7 criterion 1.
6. WHEN the intro opens and the Legend_Strokes_File has loaded, THE intro SHALL ink the six Han characters one at a time, in order, with the strokes in stroke-data order.
7. WHEN the Ink_In reaches ， or a character without an entry, THE intro SHALL reveal it with a left-to-right brush wipe.
8. WHERE steering amendment 5 is approved, THE intro SHALL ink each Han character in at most 900 ms.
9. WHERE steering amendment 5 is approved, THE intro SHALL set `data-legend-state="inked"` within 6000 ms of the intro opening, including the wipe of ，.
10. WHERE steering amendment 5 is approved, THE intro SHALL draw each stroke in less than 200 ms.
11. WHILE the Ink_In runs, THE intro SHALL expose the whole line 天雨粟，鬼夜哭 to assistive technology as one text string and the strokes as nothing.
12. WHILE the Ink_In runs, THE intro SHALL keep "Begin the Séance" and "Sources" focusable and activatable without delay.
13. IF the Legend_Strokes_File fails to load (network failure, non-ok response, invalid JSON, or no entries for the six characters), THEN THE intro SHALL use the existing `ink-reveal` wipe, reach `data-legend-state="inked"` and show no error message.
14. WHEN the Ink_In ends, THE intro SHALL show the Legend_Line as WenKai text and SHALL keep `data-legend-state="inked"` on the legend figure with no other value afterwards.
15. THE code points 天 U+5929, 雨 U+96E8, 粟 U+7C9F, ， U+FF0C, 鬼 U+9B3C, 夜 U+591C and 哭 U+54ED SHALL lie in the Level_1_Font_Range.
16. THE intro SHALL show a Grain_Fall of at most 24 pale grains, each drawn with the `ink` token at an alpha of at most 0.35 and `aria-hidden`.
17. WHERE steering amendment 5 is approved, THE Grain_Fall SHALL make each grain fall for at least 12 s per pass.
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
15. THE work SHALL NOT edit a steering file until the human approves its amendment.
16. THE work SHALL change data files only through the Pipeline and the CSV override files, and SHALL NOT edit a generated file by hand.
17. WHILE a steering amendment is not approved, THE work SHALL NOT implement its item: item 1 for amendments 1 to 3, item 11 for amendment 4, and item 13 for amendment 5.
18. THE work SHALL write no personal name in any repo file and SHALL say "the human" instead, except author and historical names in citations.

## Open questions (with recommended answers)

### Item 1: Memory fix

1. **For a transparent returning ghost the inked parts are the whole character. Should it hold briefly or fade?** Recommended: no hold and no fade (Requirement 1.7). The strokes finish animating, and the Write_Step starts. This adds no new timing and no new exemption.
2. **Should giving up the Summon step of a returning ghost reveal anything?** Recommended: no. Show nothing, outcome `gave-up`, go to writing (Requirement 1.10–1.12). The reveal then comes only from the Write_Step's Give up, as before.
3. **Should the opaque note ("This code uses shapes the game doesn't show yet.") stay for returning ghosts?** Recommended: yes, unchanged. It is typing-phase text and shows no character.
4. **Do first meetings keep the full hold and fade?** Recommended: yes, as asked. The walkthrough ghost is always a first meeting.
5. **Does `SUMMON_REDUCED_SPEED` exist?** Recommended: confirm in the design; if not, use the existing reduced-motion path.

### Item 2: Clues

1. **Which `reviewedBy` value for the three level 1 rows?** The level 1 file uses `human-approved` today; the request says `human`. Recommended: `human` for all six rows as requested (the level 1 parser accepts any non-empty value; levels 2 and 3 require `human`). The level 1 file then mixes both values, which is harmless.
2. **The 么 clue pinyin changes from me to ma, because the requested sense is entry 1 (ma5). Accept?** Recommended: yes. It is the source reading of that sense, and the clue text and pinyin then agree.
3. **刚 has an approval row (`刚,human`) and now also gets an override.** Recommended: keep the approval row; approvals never change the prompt. If the build rejects a character that has both, remove the approval row for 刚 and record it.
4. **How to prove level 1 is otherwise unchanged?** Recommended: the per-record hash fixture in Requirements 2.14–2.20. The fixture must be captured before the first change to the overrides file.

### Item 3: Summon paper

1. **Is 240 px at 375 × 812 the right floor?** Recommended: yes for now (the width limit is about 343 px and the height budget at 812 leaves room above 300). Adjust it to the measured value in the design.
2. **What is the floor at 320 × 640?** Recommended: keep the 96 px floor and require the fit; the design should aim for 150 px or more.
3. **The 260 px target with the 24 px walkthrough line leaves 484 px for other content at 768 px high.** Recommended: accept; the code slots, key rows and hint shrink, and the system-input note and Unihan note move to 12 px.
4. **Is the page padding 32 px, and does the Requirement 5 line change the paper size?** Recommended: confirm in the design; reserve the Requirement 5 line inside `reservedPx` so the 260 and 240 floors still hold.

### Item 4: Summary

1. **Which ghosts are "faint ghosts with a return line"?** Recommended: clean ghosts are paper squares with seals, and struggled and gave-up ghosts are faint ghosts. Every tile also shows its Return_Text, because every ghost has a next due time. If the human meant that only the faint ghosts show a Return_Text, say so and Requirement 4.3 will change.
2. **Does a struggled ghost count as "laid to rest" on the count line?** Recommended: keep today's rule (clean and struggled count; gave-up does not), but show a seal only for clean.
3. **Is a visible meaning needed on the tile?** Recommended: no. Show glyph, pinyin and Return_Text, and keep the meaning in the accessible name, to fit one screen.
4. **Faint ghosts use `GhostFigure` (with its filter) up to 10 times. Is that allowed?** Recommended: yes; `art-direction.md` does not limit the number of `GhostFigure` uses, and flat copies are reserved for the favicon and cursors.

### Item 5: Cross-level line

1. **Show the line only when other-level ghosts fill the séance, or whenever there is at least one?** Recommended: whenever N ≥ 1, because due ghosts come first (band a of `selectSession`) and any level 1 ghost in a level 2 séance is equally unexpected.
2. **Where does it sit?** Recommended: above the first ghost's prompt, on the séance screen, so there is no extra screen and no extra primary action.
3. **A Review_Run?** Recommended: no line (it has no chosen level).

### Item 6: Graveyard order

1. **Move the Guided_Ghost to grave 1 on level 1, or change the wording only?** Recommended: both (Requirements 6.1 and 6.7). The move makes the order true for all brand-new players (cases a to c). The wording names the guided ghost for the one case (d) where it does not hold.
2. **Should an unmet Guided_Ghost's blank first stone be a leak?** Recommended: no. Position alone reveals nothing, and the accessible name stays "never met".

### Item 7: Credits, README, fonts

1. **Does the Level_Manifest count as a "data file" to credit?** Recommended: yes, name it too (it holds only counts, averages, English meanings and now one sample character per level).
2. **If the e2e check finds the level 3 font on a fresh level 1 load, who fixes it?** The implementer, in this spec (Requirement 7.11). No finding is expected from the static reading.
3. **Should the README figure be hand-maintained?** Recommended: no. Print it from `check:bundle` (Requirement 7.8) and copy it.

### Item 8: Give up slip

1. **Any open question?** None. Treat as decided.

### Item 9: Start menu fit

1. **Should 320 × 640 also be required?** Recommended: no, only the two viewports asked for; add 320 × 640 later if the human wants it.
2. **How to make room?** Recommended: a smaller ghost figure, tighter gaps, and a two-column grid for the four small Slips below 640 px wide. The design decides.
3. **Keep the 12 px text floor and the 4-digit count in the worst case?** Recommended: yes.

### Item 10: Restless review

1. **A clean review does not move a ghost to rest early, and a miss counts as a miss. Agree?** Recommended: agree. A clean review that advanced the ladder would let a player push a ghost to long intervals by self-selected reviews, which defeats the spacing. The cost is that a restless ghost leaves "restless" only through a nightly séance when it is due.
2. **Should a clean review be recorded in the ghost's history?** Recommended: no. It changes nothing in storage, so streaks and counts stay exactly as the scheduler left them.
3. **Seal on a clean review?** Recommended: yes, because `art-direction.md` stamps the seal after a clean outcome. The text says "Remembered", not "Laid to rest", so the screen stays true.
4. **Restless includes ghosts that are already due and so would also appear tonight.** Recommended: keep that; it is the existing graveyard definition and the review is explicitly outside the schedule.
5. **Graveyard Slip count: all levels or the shown level?** Recommended: all levels, the same number as on the Start_Menu.
6. **Review summary primary action?** Recommended: the same "Begin another Séance" (a nightly séance), since the table in `art-direction.md` has one rule for the Summary.

### Item 11: Level screen

1. **Level_Sample font: the level's own subset, or the level 1 subset?** Using levels 2 and 3's own subsets would make the Level_Screen download about 90 kB and 116 kB of font (raw) before the player picks a level. Recommended: choose from characters whose glyph is already in the Level_1_Font_Range (Requirement 11.6). With today's data that gives a level 1 character at position 31, 哭 for level 2 (position 107) and 鬼 for level 3 (position 370). The alternative is to add the two samples to the level 1 subset; that costs only a few glyphs, and the human can choose it instead.
2. **N for "tested on first"?** Recommended: the first 30, the same number as the "How Cangjie works" rule (position 30 or later). The first séance introduces at most 10 new ghosts.
3. **The two later-level samples are also legend-line characters.** Recommended: accept; it is a side effect of the font rule, not a design choice.
4. **"Easy, harder, hardest" labels.** Recommended: use those words exactly, next to the level number.

### Item 12: Graveyard

1. **"More grass": how much?** Recommended: 24 hill tufts (double) and two tufts per tablet (double). If hill tufts at 24 slots look crowded at 375 px, the design may keep 18.
2. **Rows between met ghosts.** Recommended: show every row from the first to the last row that holds a met ghost, even if a middle row is all blank, so the order stays visible.
3. **Wording of the collapsed line.** Recommended: "N ghosts not yet met" and "1 ghost not yet met".

### Item 13: Intro legend

1. **Total time.** The six Han characters have 51 strokes. Recommended: total at most 6 s and at most 900 ms per character, which needs a per-stroke time below the 200 ms floor in `art-direction.md`. This needs an amendment (below). The alternative is 200 ms per stroke, which takes about 10 s and delays the mood too long.
2. **Does the intro wait for the ink?** Recommended: no. The buttons work throughout.
3. **Where do the strokes of 粟 come from?** It is in no level, so a new Pipeline-built Legend_Strokes_File is needed (stroke files for all six Han characters exist in `data/raw/hanzi-writer-data`). Recommended: a lazy file fetched by the intro, with the existing wipe as the fallback.
4. **Grain under reduced motion.** Recommended: no grain at all.
5. **Grain colour.** Recommended: the `ink` token at low alpha, never `seal`, never `candle` as a fill.

### Item 14: Constraints

1. **Does the `kiro-log.md` ban cover only this spec's work?** Recommended: yes; the human writes the log.

## Steering amendments needing approval

1. **`content-accuracy.md`, "What is not an answer leak" (item 1).** Narrow the bullet "The designed summon reveal …" so that the full reveal (form, hold, fade, and the Plain_Text_Fallback) is allowed for a first meeting only. For a returning ghost, only the parts that the typed keys inked are shown, and the Plain_Text_Fallback is not allowed.
2. **`product.md`, core loop step 2 (item 1).** Say that the character forms after the code on a first meeting, and that a returning ghost shows only the parts the keys inked.
3. **`art-direction.md`, Rite-timing exemption Q12 (item 1).** Add that `SUMMON_HOLD_MS`, `SUMMON_FADE_MS` and `SUMMON_INK_SPEED` apply to first meetings; a returning ghost has no hold and no fade.
4. **`content-accuracy.md`, "What is not an answer leak", second bullet (item 11).** Replace "The level screen shows English example meanings, never a character" with: the Level_Screen shows English example meanings and one sample character per level, taken from the Level_Manifest, at position 31 or later of the level's learning order. Also amend the `harder-ghosts` spec's requirement and the tests that state "no Chinese character on the Level_Screen".
5. **`art-direction.md`, Motion, ambient exemption list (item 13).** Add "the intro's Grain_Fall" to the named ambient motions, and add a named rite-timing exemption for the Ink_In of the Legend_Line (at most 6 s in total, at most 900 ms per character, per-stroke time below 200 ms).
6. **`tech.md`, Testing rules.** No amendment. The no-new-property-test decision of Nov 15 stays as it is.
7. **`structure.md`.** No amendment. The Legend_Strokes_File is a generated file under `app/public/data/`, produced only by `scripts/`.
