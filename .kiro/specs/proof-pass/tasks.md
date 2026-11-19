# Implementation Plan: proof-pass

## Overview

Answer the third outside review of Ghost Script: thirteen items in the human's priority order. The plan runs in this order: the human answered the open questions and approved steering amendments 1 to 5 (gate, done); the spec is amended to those answers (task 2); the approved steering edits (task 3); then one group per item, 1 to 13 (tasks 4 to 16), each with its implementation and its unit, component and end-to-end tests from the design's testing table; a final checkpoint (task 17); and a human-only screenshot review (task 18), placed last so that no Kiro task waits on it.

Item to task map: item 1 = task 4, item 2 = task 5, item 3 = task 6, item 4 = task 7, item 5 = task 8, item 6 = task 9, item 7 = task 10, item 8 = task 11, item 9 = task 12, item 10 = task 13, item 11 = task 14, item 12 = task 15, item 13 = task 16.

Rules for every task:

- Task 1 is a gate for the human, and every later task depends on it. After the answers, the spec is amended first (task 2: `requirements.md`, `design.md` and this file updated to the human's answers, the design's proposed requirement corrections applied, every marker of an unanswered question removed) before any code task runs.
- Kiro never answers a question or approves an amendment on the human's behalf. All five amendments are recorded in the design as "approved by the human" (amendment 4 as reworded). Items 1, 11 and 13 are gated on tasks 3.1 to 3.3, 3.4 and 3.5, which write the amendments into the steering files before those items start.
- Do not edit `kiro-log.md`. Edit a steering file only in tasks 3.1 to 3.5 and only for an amendment recorded as approved by the human. Change data files only through the data pipeline and the CSV override files, never by hand.
- Never write a personal name in a repository file. Approvals read "approved by the human".
- Add no property-based test and no mutation test (decision of Nov 15, `tech.md`). The existing property tests stay unchanged and must pass, including the summon-ink property test. Every new test is a unit, component or end-to-end test.
- Never weaken, skip, delete or loosen an existing test, except the assertions listed in the design under "Existing assertions that would change". The human approved those changes on condition that no rewrite loosens a test: each rewrite checks the same property at least as strictly as the assertion it replaces, or moves it to equivalent new data. Each task that changes one of them names it, and its report states the old assertion and the new assertion side by side and why the new one is at least as strict. If a rewrite cannot be made at least as strict, the task stops and reports. A test that fails and is not in the design's list is fixed by changing its inputs, never its expectation, and is added to the report with the reason.
- Add no `any`. Keep logic in `app/src/engine/` and UI in `app/src/components/`. Every animation and transition sits inside the one `prefers-reduced-motion: no-preference` block of `app/src/styles/index.css`.
- Before every end-to-end run, wait until nothing listens on port 4173 (for example `lsof -i :4173` prints nothing), because the Playwright config starts its own server.
- No commits. The design suggests committing the hash fixtures of task 5.1 first; this plan only requires that they are written and verified before the first override edit, and the report records the order.

### Kiro features used

- **Specs**: this requirements-first spec (`.kiro/specs/proof-pass/`).
- **Steering**: `content-accuracy.md`, `product.md` and `art-direction.md` are amended only for the amendments approved by the human (tasks 3.1 to 3.5).
- **Playwright e2e**: new `e2e/font-requests.spec.ts`, `e2e/review.spec.ts` and `e2e/legend-ink.spec.ts`, and extensions of the existing fit, slips, grass, graveyard and screenshot specs.

## Tasks

- [x] 1. Gate: the human answers the open questions and approves or rejects each steering amendment
  - [x] 1.1 HUMAN TASK: Human answers the open questions and decides the amendments and corrections
    - Human-only. Kiro does not answer on the human's behalf and does not start any later task until this is done
    - Answer every row of the design's "Open questions" table, including the new ones (Item 1 Q6, Item 3 Q5, Item 11 Q5, Item 12 Q4, Item 13 Q6), and the questions of `requirements.md` that the table lists
    - Approve or reject each proposed steering amendment 1 to 5 on its own; the approval of one does not count for another. Amendments 1 to 3 gate item 1, amendment 4 gates item 11, amendment 5 gates item 13
    - Accept or reject each of the six corrections proposed to `requirements.md` (R2.21, R2.23, R3.7 and R3.4, R11.6 and Item 11 Q1, R1.10, R12)
    - Confirm the design's list "Existing assertions that would change", with the condition that no rewrite loosens a test
    - After the answers, the spec is amended first (task 2), before any code task runs
    - _Requirements: 14.15, 14.17_

- [x] 2. Amend the spec to the human's answers
  - [x] 2.1 Update `requirements.md`, `design.md` and this `tasks.md` to the recorded answers
    - Update the requirements and the design to the chosen answers; replace the open questions by a short "Decisions approved by the human" list; remove every marker of an unanswered question and every alternative that was not chosen (a search for such markers in the three documents finds nothing afterwards)
    - Apply the design's proposed requirement corrections that the human accepted, and fill in the Level_1_Review_Value, the level 3 sample rule, the hill tuft count and every other chosen value
    - Write "approved by the human" next to each approved steering amendment in the design, and nothing next to a rejected one
    - Edit this `tasks.md` to match: drop the steering sub-task and the gated item tasks of any rejected amendment, adjust any task whose answer changed (for example a clean review that advances the ladder, a Level_Sample rule, 18 hill tufts), and keep the dependency graph valid
    - Run `validate_spec_format` on each edited document until it reports no errors
    - Edit no code, no steering file, no data file and not `kiro-log.md`
    - _Requirements: 14.15, 14.17, 14.18_

- [x] 3. Steering edits for approved amendments only
  - Rules for this group: a sub-task runs only if the design records "approved by the human" next to its amendment; otherwise it is removed in task 2.1 or skipped, and the report says "skipped: not approved". Each sub-task edits one steering file with the exact wording recorded in the design after task 2 and adds an assertion for the changed text to its steering test (`tests/unit/steering-art-direction.test.ts` for `art-direction.md`; `tests/unit/steering-content-accuracy.test.ts` and `tests/unit/steering-product.test.ts` are created if they do not exist, following the style of `steering-art-direction.test.ts`). Remove no existing assertion. The existing steering tests, `content-accuracy-intro-link.test.ts` and `no-personal-names.test.ts` must pass afterwards
  - [x] 3.1 Amendment 1: `content-accuracy.md`, the summon reveal bullet
    - Replace the bullet "The designed summon reveal ..." with the approved text (full reveal for a first meeting only; a returning ghost shows only the inked parts, with no hold, no fade and no plain-text fallback); test the new text
    - _Requirements: 1.1, 14.2, 14.15_
  - [x] 3.2 Amendment 2: `product.md`, core loop step 2
    - Replace the Summon line with the approved text; test it
    - _Requirements: 1.1, 14.2, 14.15_
  - [x] 3.3 Amendment 3: `art-direction.md`, rite-timing exemption
    - Add the approved sentence that the three summon timing constants apply to a first meeting; test it, and keep the existing test of the exemption
    - _Requirements: 1.1, 1.17, 14.15_
  - [x] 3.4 Amendment 4: `content-accuracy.md`, the level screen bullet, and the harder-ghosts spec
    - Replace the second "not an answer leak" bullet with the approved text of amendment 4 as reworded in the design (the level screen shows English example meanings and may draw one sample character per level from its stroke data, at position 31 or later of the level's learning order, chosen by the stroke-count rule; no Han character appears as text); amend in the same task the `harder-ghosts` requirement and design text that say "no Chinese character on the Level_Screen" (`.kiro/specs/harder-ghosts/design.md` and the matching requirement) with the same clarification (no Han character as text; a drawn sample is allowed), then run `validate_spec_format` on each edited spec file; test the steering text
    - _Requirements: 11.20, 14.2, 14.15_
  - [x] 3.5 Amendment 5: `art-direction.md`, ambient list and legend-ink exemption
    - Add "the intro's Grain_Fall" to the ambient exemption and add the named legend-ink exemption (at most 6 s in total, at most 900 ms per character, under 200 ms per stroke) with the approved wording; test both sentences. Keep the 200 to 600 ms rule for every other motion
    - _Requirements: 13.8, 13.9, 13.10, 14.2, 14.15_

- [x] 4. Item 1: returning ghosts show no formed character (gated on amendments 1 to 3)
  - [x] 4.1 Add the returning branch to the Summon step
    - In `app/src/modes/SummonStep.tsx` export `SUMMON_REDUCED_SPEED`, compute `returning = !firstMeeting`, and add the returning branch of the forming effect as in the design: wait only for the strokes queued by accepted keys, call `finish()` once, never call `animateCharacter`, never start a hold or fade timer, never render the plain-text fallback, and give up the same way with outcome `gave-up`; keep the first-meeting branch and the constants 1500, 1500 and 2 unchanged
    - For give-up after some keys, let the strokes already requested finish and add none (approved by the human)
    - Thread `firstMeeting.has(record.character)` from `SeanceSession` to `SummonStep`, with an empty default set in `SeanceSession` so a review run is all returning
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18, 1.19_
  - [x] 4.2 Keep the first-meeting tests and add the returning tests
    - Existing assertions that change: the render helpers of `SummonStep.test.tsx`, `SummonStep.ink.test.tsx` and `SeanceSession.test.tsx` (the lines the design lists) gain `firstMeeting: true`, because the default prop now means returning. Every number and DOM expectation stays. The human approved this on condition that nothing is loosened; the report states, for each helper, the old call and the new call
    - Add returning cases beside them: `onDone` once after the queued strokes, `animateCharacter` never called, strokes only from the typed keys, opaque ghost creates no writer, `vi.getTimerCount()` is 0 after `onDone`, `HanziWriter.create` throwing and `onLoadCharDataError` give `onDone` once with no `p[lang="zh"]`, give-up with zero keys and with k keys, reduced motion uses `SUMMON_REDUCED_SPEED` and no timer; and a `SeanceSession` case that a returning ghost and a first-meeting ghost take different paths
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18, 1.19_
  - [x] 4.3 Extend the never-reveal suite
    - In `SummonStep.neverReveal.test.tsx` make the module mock spy-based and add the returning variants (with and without walkthrough lines) over every playable record: type the whole code, advance fake timers by 3000 ms, assert the target is absent from all text nodes, all attributes and `document.title`, `onDone` once, `animateCharacter` never called, every `animateStroke` index inside the union of the typed keys' `keyStrokes`, and the same under `create` throwing and `onLoadCharDataError`; assert that a first-meeting ghost still renders the fallback with 1500 ms hold and 1500 ms fade under both failures. Change no existing expectation
    - _Requirements: 1.20, 1.21, 1.22, 1.23, 1.24, 1.25, 1.26, 14.1_
  - [x] 4.4 Write the returning-ghost e2e test
    - In `e2e/summon-ink.spec.ts` seed one met ghost so the first ghost is returning, pick a transparent or partial record whose last key inks at most three strokes, install a `MutationObserver` before the last key, assert the Write step is visible within 1000 ms after the last key and that no added node or text change contains the target character. After waiting for port 4173 to be free, run the spec; it passes
    - _Requirements: 1.27, 1.28_

- [x] 5. Item 2: five corrected clues and a display rule for traditional|simplified pairs
  - [x] 5.1 Capture all fixtures before any override edit
    - Write `tests/helpers/record-hashes.ts` (`hashRecord`, `hashRecordWithoutPrompt`, pure) and the CLI `tests/helpers/capture-proof-pass-fixtures.ts`. Confirm with `git status` that `data/` and `app/public/data/` have no changes, then run the CLI and write, under `tests/fixtures/proof-pass/`: `level1-record-hashes.json`, `level2-record-hashes.json`, `level3-record-hashes.json` (whole-record and no-prompt hashes per record), `prompt-review-level1-line-hashes.json` and `prompt-review-sample-level2-line-hashes.json` (per-line hashes). Capture all five fixtures in this task, before task 5.2 edits any override CSV; the report records the `git status` output and the order of events
    - Add a small unit test of the two hash functions
    - _Requirements: 2.12, 2.16, 2.18_
  - [x] 5.2 Add the exact-match guard and the override rows
    - Write `scripts/lib/clue-corrections.ts` (`CLUE_CORRECTIONS` with five entries: 本, 天, 云, 刚, 获; `matchingPairs`, `checkClueCorrections`) and call it from `buildDataset` right after the overrides and the dictionary load, so a failure names the character, the text and the number of matching pairs and throws before any file is written; write `tests/unit/clue-corrections.test.ts` (exactly one pair, zero pairs, two pairs, a missing override row, no file written on failure)
    - Edit the override files only now: in `data/prompt-overrides.csv` replace `本,0,8,human-approved` by `本,0,0,human` and add `天,0,1,human`; add `云,2,0,human` and `刚,0,3,human` to `data/prompt-overrides-level2.csv`; add `获,1,0,human` to `data/prompt-overrides-level3.csv`. Do not touch the row `么,2,0,human-approved`: `git diff` of `data/prompt-overrides.csv` shows exactly one changed line and one added line. Keep `刚,human` in `data/prompt-approvals.csv`. No other row changes, and 第, 视, 奋 and 居 stay as they are
    - Do not run the build in this task
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [x] 5.3 Rebuild and update the pins
    - Run `npm run build:data` (run `npm run build:font` first only if `app/src/styles/fonts.css` is stale), then run it a second time and confirm the output is byte-identical. Generated files change only through the pipeline. Update the README count block by the regenerated output and change the README sentence "48 overrides" to the new row count of `data/prompt-overrides.csv` (49); add `tests/unit/readme-override-count.test.ts` comparing the number with the row count
    - Existing assertions that change, each approved by the human on condition that it is not loosened, with old and new stated in the report: `tests/unit/level1-protected.test.ts` (the SHA-256 of `characters.json` and of `prompt-review.csv` take new values; the `character-list.txt` value is unchanged); `tests/unit/reviewed-by.test.ts` (the old 48-row pin stays and is proved by reverting the 本 row and dropping the 天 row; the level 1 review rule accepts `human` only on 本 and 天). `components/GhostPrompt.test.tsx` is not changed
    - _Requirements: 2.9, 2.10, 2.11, 2.19, 2.20_
  - [x] 5.4 Write the data tests and run the fixture comparisons
    - Write `tests/unit/clue-corrections-data.test.ts`: no-prompt hash equal for all 300 level 1 records; whole-record hash equal for exactly 298 and different for exactly 本 and 天 (so 么 is byte-identical); the new clue of each of 本 and 天 is the requested text plus the reading of the selected entry; every line of `data/prompt-review.csv` except 本 and 天 equals its fixture (the 么 line included) and those two show the new meaning and `human`; level 2 differs only in 云 and 刚 and level 3 only in 获; `reviewedBy` is `human` for 云, 刚 and 获 in the level 2 and 3 review files; the two 50-row sample files keep the same characters at the same positions; the nine `levels.json` example meanings are unchanged. Run `npm test`, `npm run check:data` and `npm run check:levels`; they pass
    - _Requirements: 2.8, 2.12, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.20, 2.21, 2.22_
  - [x] 5.5 Add the display rule to the clue cleanup
    - In `app/src/engine/promptCleanup.ts` add `removeTraditionalHalves` with the pattern of the design (a maximal run of Han characters, `|`, then at least one Han character; only the run and the `|` are removed) and make it the first operation of `step`, before the existing removals; keep the function deletion-only and idempotent, and check that the TypeScript target accepts `\p{Script=Han}`
    - Extend `engine/promptCleanup.test.ts` without removing a case: 么 with its exact stored meaning and the exact displayed text `suffix, used to form interrogative 什～, what?, indefinite 这～ thus, etc`; the `(CL:條|条[tiao2])` note; the digit case of 号; `a|b`; a chain of two pairs; two separate pairs; a `|` at the start and at the end; idempotence on each example; a meaning without `|` unchanged. The existing property tests of the cleanup, `GhostPrompt.test.tsx` and the walkthrough tests pass unchanged
    - _Requirements: 2.23, 2.24, 2.25, 2.26, 2.27, 2.28, 2.29, 2.32_
  - [x] 5.6 Test the displayed clues of every record and report the change counts
    - Write `tests/unit/display-clues.test.ts` with the real datasets: for every record of all three levels, `maskTarget(cleanupMeaning(meaning), character)` contains no target character; for every record of levels 2 and 3 it contains no Han character (the existing displayed-meaning test of the harder-ghosts spec stays green and unchanged); count the clues whose display differs from the display of the pre-change cleanup (a literal copy of the old steps kept in the test), print `Displayed clue changes: level 1: N1, level 2: N2, level 3: N3`, and assert 1, 0 and 0. Run `npm test`; it passes. Report the three numbers
    - _Requirements: 2.30, 2.31, 2.33, 2.34_

- [x] 6. Item 3: a bigger Summon paper
  - [x] 6.1 Change `summonPaperSize`
    - In `app/src/engine/surfaceSize.ts` implement the new formula with the floor of 96, the approved ceiling (`SUMMON_PAPER_MAX_PX`, 560) and `SUMMON_OTHER_PX` (484); leave `writeSurfaceSize` unchanged
    - Existing assertions that change in `engine/surfaceSize.test.ts`, each approved by the human on condition that it is not loosened, old and new stated in the report: 'gives the budgeted size at the four viewports' (`[160, 150, 96, 160]` becomes `[284, 328, 156, 416]`) and 'caps at 160' (becomes 'caps at 560'). Add the five asserted values of R3.14 (284, 260, 328, 156, 96), the floor, integer results and the ceiling at 4000 × 4000
    - _Requirements: 3.4, 3.5, 3.14_
  - [x] 6.2 Compact the Summon step to the budget
    - Pull the levers of the design's Item 3 in order, measuring after each: shell and session padding, gaps, the step label beside the clue card, slot height, 12 px system-input note, the narrow-width header; add the optional `reservedPx` prop to `SummonStep` and pass it from `SeanceSession`; use lever 7 (status line) only if the other content still exceeds 480 px. Keep every control at least 44 px high, text at 12 px or more and at 4.5:1, and the Moon top room
    - Existing assertions that change, only if lever 7 is used: `SummonStep.test.tsx` lines 467 to 468 (`min-h-[2.5rem]`, `text-sm`); old and new stated, and not loosened. Check `App.test.tsx` and `WriteMode.test.tsx:222` still pass unedited
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 3.10, 3.11, 3.15_
  - [x] 6.3 Extend the fit tests
    - Add `summonOtherHeight(page)` to `e2e/helpers.ts` (adds a helper, changes none). In `e2e/fits-one-screen.spec.ts` add 320 × 640 to the Summon viewports; assert `ink-surface` square, at least 260 px at 1024 × 768 and at least 240 px at 375 × 812; cover a returning ghost, a non-guided first meeting and the Guided_Ghost; assert `summonOtherHeight` at most 480, computed font sizes at least 12 px, no vertical scroll and no horizontal overflow. After waiting for port 4173 to be free, run `fits-one-screen`, `no-horizontal-overflow` and `sky-cap`; they pass
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 3.9, 3.12, 3.13_

- [x] 7. Item 4: the summary as a reward
  - [x] 7.1 Carry the outcome of each ghost to the summary
    - Add `outcome: Outcome` to `ReturnRow` and the optional outcomes map to `buildReturnRows` (default `entry.lastOutcome`), add `mode?` to `SessionResults`, and keep `outcomesRef` next to `returnsRef` in `App.tsx`, filled in `handleOutcome`; leave `formatReturn` output unchanged. Extend `engine/formatReturn.test.ts` and `App.test.tsx`; change no existing expectation
    - _Requirements: 4.8, 4.9_
  - [x] 7.2 Add placement and size to `SealStamp`
    - Add the optional `placement` (`'corner'` default, `'flow'`) and `size` props; with no props the output is exactly today's. Extend `SealStamp.test.tsx`; change no existing assertion
    - _Requirements: 4.4_
  - [x] 7.3 Rebuild `SessionSummary` as tiles
    - Heading in `font-display`, count line with `role="status"` and the existing rule, a five-column list of Ghost_Tiles in play order (glyph, pinyin, visible outcome word, Return_Text), a seal for a clean ghost and a faint `GhostFigure` and no seal for a struggled or gave-up ghost, the accessible name of the design, the empty-séance case, no nested `min-h-screen`, "Begin another Séance" as the only `slip-primary`
    - Existing assertions that change in `SessionSummary.test.tsx`, approved by the human on condition that it is not loosened, old and new stated: 'lists each ghost in order with glyph, pinyin, meaning and return text' asserts the meaning with `toHaveAccessibleName` instead of `textContent`. Add tests for a clean, a struggled and a gave-up tile with their names, no `SealStamp` for the last two, and the empty séance
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.11, 4.12, 4.13, 4.14, 4.16, 4.18, 4.19_
  - [x] 7.4 Add the summary fit tests
    - Add `reachFullSummary(page)` to `e2e/helpers.ts`; add a full 10-ghost summary at 1024 × 768 and 375 × 812 to `fits-one-screen.spec.ts`, `sky-cap.spec.ts` and `no-horizontal-overflow.spec.ts`; assert the Moon top room, one `slip-primary`, no vertical scroll. After waiting for port 4173 to be free, run the three specs; they pass
    - _Requirements: 4.10, 4.12, 4.15, 4.17_
  - [x] 7.5 Add the summary screenshots
    - In `e2e/screenshots.spec.ts` add a `summary` capture at 1024 × 768 and at 375 × 812, reached with `reachFullSummary`, written by the file's existing naming as `summary-1024x768.png` and `summary-375x812.png`, with `expectMoonInside` as the existing captures do; change no existing capture. After waiting for port 4173 to be free, run `npm run test:e2e -- screenshots`; it passes and both PNGs exist
    - _Requirements: 4.10, 4.15_

- [x] 8. Item 5: a line when due ghosts from another level come first
  - [x] 8.1 Write the pure line builder
    - Write `app/src/engine/crossLevel.ts` (`PlannedGhost`, `isDueAt`, `otherLevelCounts`, `crossLevelLine`) and add `crossLevelReserve(text, width)` with `CROSS_LEVEL_LINE_PX` and `CROSS_LEVEL_LINE_WRAP_PX` to `surfaceSize.ts`; `scheduler.ts` stays unchanged. Write `engine/crossLevel.test.ts` with the cases of R5.16 (ten from one level, one, two, two levels including 1 and 1, none, Chosen_Level only, Chosen_Level due, other level not due, review, guided) and tests of the reserve
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.8, 5.9, 5.11, 5.16_
  - [x] 8.2 Report the plan and show the line
    - Add `report` to `SeancePlan` and `chosenLevel` and `levelOf` to `SeanceScope` in `App.tsx`; carry `crossLevelLine` in the seance view; render it in `SeanceSession` above the clue row only while `index === 0`, as plain text (no role, not a Slip), and pass the reserve as `reservedPx` to `SummonStep` and `WriteMode`. Add a `planSeance` case to `App.levels.test.tsx` (three due level 1 entries, level 2 chosen) and `SeanceSession` component tests: present at ghost 1, absent after "Next ghost", absent on the summary, not a Slip, at most one `slip-primary`
    - _Requirements: 5.4, 5.5, 5.6, 5.10, 5.12, 5.13, 5.14, 5.16_
  - [x] 8.3 Write the cross-level e2e test
    - In `e2e/harder-ghosts.spec.ts` seed three due level 1 ghosts with `level: 2`, assert "3 ghosts from level 1 return first." above the first ghost, assert it is gone after "Next ghost", and assert the one-screen fit of Summon and Write at 1024 × 768, 375 × 812 and 320 × 640. After waiting for port 4173 to be free, run the spec; it passes
    - _Requirements: 5.15, 5.17_

- [x] 9. Item 6: Graveyard order says what is true
  - [x] 9.1 Write the display reorder
    - Write `app/src/engine/graveyardOrder.ts` (`graveyardOrder`, `graveyardExplanation`) using `pickWalkthroughGhost` (never a hard-coded character). Write `engine/graveyardOrder.test.ts` with real level 1 data: the Guided_Ghost at index 0, the other 299 in `learningOrder` with no duplicate, 300 in total; a null Guided_Ghost gives `learningOrder`; levels 2 and 3 equal `learningOrder`. `learningOrder`, session order and history are unchanged
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.10, 6.12_
  - [x] 9.2 Use it in the Graveyard
    - In `Graveyard.tsx` build the model from `graveyardOrder(...)` and show the explanation of the design. Existing assertions that change in `Graveyard.test.tsx`, approved by the human on condition that it is not loosened, old and new stated: the level 1 explanation sentence, and the real-data positions 1 to 13 that move by one. Add tests of the names of graves 1 and 2 while unmet ("Ghost 1 of 300, never met", "Ghost 2 of 300, never met"), no Han character in grave 1, and both sentences. Record the case analysis a to d of R6.11 stays in the design
    - _Requirements: 6.2, 6.6, 6.7, 6.8, 6.9, 6.11, 6.13_

- [x] 10. Item 7: complete data credits, an honest first load, no unneeded font
  - [x] 10.1 Name every data file on the Sources screen
    - Add `DATA_FILES` to `app/src/data/credits.ts` and a "Data files" section to `Credits.tsx` for `characters.json`, `characters-level2.json`, `characters-level3.json`, `levels.json` and `oracle/power/data/oracle-data.json`, reusing the wording of `DATA_SOURCES` and adding no new licence claim and no Han glyph (the `levels.json` row also names the hanzi-writer-data outlines of the three samples under the Arphic Public License, as Requirement 7.3 states); the legend strokes row is added by task 16.7. Extend `Credits.test.tsx` to read the `.json` names in `app/public/data` and `oracle/power/data` at test time and fail if one is missing from the screen (the legend file is covered once it exists); add `tests/unit/credits-readme.test.ts` comparing `DATA_FILES` with the README table. The existing `DATA_SOURCES` assertions stay
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.12_
  - [x] 10.2 Print the real first load
    - In `scripts/check-bundle-size.ts` keep the first output line byte for byte and add the pure `firstLoad(files)` and the line "First load: <counted> bytes counted + <level1> bytes level 1 dataset = <sum> bytes gzip". The 300,000-byte budget still applies to the counted part only. Extend `tests/unit/bundle-size.test.ts` for `firstLoad` and its arithmetic. Record in the design that the legend strokes file is counted (not lazy), with the counted total at most 300,000
    - _Requirements: 7.8, 7.9_
  - [x] 10.3 State the first load in the README
    - Run `npm run build -w app` and `npm run check:bundle`; copy the counted bytes, the level 1 bytes and the sum into the README next to the 300,000-byte budget, state that the budget does not count the level 1 dataset, refresh the stale file table sizes, and add the "Data files shipped" table with the rows of `DATA_FILES`. Edit no other README section. The `credits-readme` test passes
    - _Requirements: 7.6, 7.7, 7.12_
  - [x] 10.4 Write the fresh-profile font-request e2e test, and fix if it fails
    - Write `e2e/font-requests.spec.ts`: a fresh browser context, `page.on('request')` registered before `goto`, intro, "Begin the Séance", the Level_Screen, level 1, the first Summon step; assert no request URL contains `lxgw-wenkai-subset-level2` or `lxgw-wenkai-subset-level3` and that the level 1 subset was requested. After waiting for port 4173 to be free, run it. If it fails, identify the glyph (list `[lang="zh"]` text and font fallbacks on each screen), remove the cause, record the glyph and the fix in the design, and run it again until it passes; report either way
    - _Requirements: 7.10, 7.11_

- [x] 11. Item 8: Give up is a paper slip
  - [x] 11.1 Restyle the Write step Give up
    - In `app/src/modes/WriteMode.tsx` change the Give up classes to `slip min-h-[44px] px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost disabled:opacity-50`, dropping `rounded-md`, `border`, `border-muted`; the logic is unchanged. Extend `WriteMode.test.tsx`: the classes, absent once resolved, disabled while loading and enabled after, one `gave-up` report, no `slip-primary`; the existing give-up tests stay
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.13, 8.14, 8.15_
  - [x] 11.2 Add the Write step to the slip e2e test
    - Add a "Write step" entry to the `SCREENS` table of `e2e/slips.spec.ts` (seed a met ghost, give up the Summon step, wait for "Write mode"; expected `slip-primary` count 0). After waiting for port 4173 to be free, run the spec; hover lifts 2 px with a glow, keyboard focus lifts, a press sinks 1 px, height at least 44 px
    - _Requirements: 8.10, 8.11, 8.12, 8.13_

- [x] 12. Item 9: the start menu fits one screen
  - [x] 12.1 Remove the nested full-height box and tighten the menu
    - In `StartMenu.tsx` drop `min-h-screen`, use `py-4`, the smaller ghost figure and title, `py-2` slips and `gap-2` as in the design; keep every accessible name, the sources hint text and one `slip-primary`. Extend `StartMenu.test.tsx` (names unchanged, hint unchanged, one `slip-primary`, 44 px by class); change no existing expectation
    - _Requirements: 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_
  - [x] 12.2 Add the plain fit test
    - In `e2e/fits-one-screen.spec.ts` add the Start menu without a notice at 375 × 812 and 1024 × 768 (`scrollHeight` and `scrollWidth` within the viewport, every slip at least 44 px, exactly one `slip-primary`, no text below 12 px). The worst case needs the review slip and is added by task 13.5, because Items 9 and 10 are built together. After waiting for port 4173 to be free, run the spec; it passes
    - _Requirements: 9.1, 9.2, 9.11_

- [x] 13. Item 10: review restless ghosts outside the nightly schedule
  - [x] 13.1 Write the pure review engine
    - Write `app/src/engine/review.ts` (`restlessCharacters`, `restlessCount`, `reviewPool`, `planReview`, `recordReview`) using `classifyEntry` and `selectSession`; `recordReview` returns null for a clean review and `applyReview` for a miss (approved by the human). `scheduler.ts` and its tests are not touched; confirm with `git diff --stat` in the report. Write `engine/review.test.ts`: the restless definition (missed ghost, clean and due, clean and not due, no entry), pool order across levels, `selectSession` order, cap of 10 with a pool of 11, fewer than 10, and `recordReview` for clean, struggled, gave-up and no prior entry
    - _Requirements: 10.1, 10.10, 10.11, 10.15, 10.16, 10.17, 10.18, 10.29, 10.30, 10.31_
  - [x] 13.2 Wire the Review_Run in `App` and `SeanceSession`
    - Add `mode` to the seance view, extract `ensureHistoryLevels`, add `startReview` (load failure shows the alert and leaves history unchanged), route `handleOutcome` through `recordReview` in review mode and keep the nightly path as today, fill `returnsRef` from the stored entry after the run, pass an empty `firstMeeting` set and no cross-level line, and select the review result texts by the approved answer (clean "Remembered. It rests after its next séance."; struggled with no "laid to rest"; gave-up unchanged). Add tests in `App.test.tsx` (stored history, failed level load, leave keeps earlier entries) and `SeanceSession.test.tsx` (result texts, returning behaviour)
    - _Requirements: 10.12, 10.13, 10.14, 10.19, 10.20, 10.23, 10.25, 10.26, 10.27, 10.28_
  - [x] 13.3 Add the review slip to the Start menu and the Graveyard
    - Add `restlessCount`, `onReviewRestless` and `reviewError` to `StartMenu` and the Graveyard; the "Review restless ghosts (N)" slip comes right after "Starting level" on the menu, appears only while N is at least 1, is a `slip` and not a `slip-primary`, is at least 44 px high, and the two counts equal (approved by the human). Extend `StartMenu.test.tsx` and `Graveyard.test.tsx`: present and absent, position among three controls, class, equal counts, the alert text on a failed start
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.32, 10.33_
  - [x] 13.4 Show the review summary
    - Extend `SessionSummary` with the review mode: count line "N of M ghosts remembered" ("1 of 1 ghost remembered"), no "laid to rest" anywhere, clean tiles keep the seal, Return_Text from the stored entry, "Begin another Séance" as the only `slip-primary` starting a nightly séance. Add tests for each of these
    - _Requirements: 10.21, 10.22, 10.23, 10.24_
  - [x] 13.5 Write the review e2e test and the Start menu worst case
    - Write `e2e/review.spec.ts`: seed three restless ghosts, run a Review_Run with one clean and two missed ghosts, assert the clean entry equals its seed, each missed entry has `step` 0 and `nextDue` equal to the recording time plus `relearnDelayMs`, and the Graveyard counts equal `buildGraveyard` over the stored history. Add the Start menu worst case (finished notice, "Move on" slip, review slip with a 4-digit count) at 375 × 812 and 1024 × 768 to `fits-one-screen.spec.ts` and `no-horizontal-overflow.spec.ts`, and at 375 × 812 to `sky-cap.spec.ts`. After waiting for port 4173 to be free, run these specs; they pass
    - _Requirements: 9.3, 9.4, 9.11, 9.12, 9.13, 9.14, 10.34, 10.35_

- [x] 14. Item 11: the level screen shows the ghost and one sample per level (gated on amendment 4)
  - [x] 14.1 Choose the samples in the pipeline
    - In `scripts/lib/levels.ts` add `chooseSample` (learning order of the level's own dataset, positions 31 and later, stroke count closest to the `averageStrokes` the manifest writes, ties to the lowest position) and make `buildManifest` write, for each level, `sample: { character, strokes }` where `strokes` is the unchanged `strokes` array of `data/raw/hanzi-writer-data/<char>.json` (no medians), read through a `strokesOf` function passed in by `build-data.ts`; fail naming the level (and the character) before any file is written when a level has fewer than 31 records or a stroke file is missing or invalid. Add `sample?: LevelSample` to `LevelInfo`, validate it in `isLevelManifest` (one code point, a non-empty array of non-empty strings; a missing sample is accepted) and write it in `serialiseManifest` after `exampleMeanings`. Run `npm run build:data`; `levels.json` is regenerated only by the pipeline, and `npm run check:levels` passes
    - Write `tests/unit/level-samples.test.ts` with real data: position at least 31 (1-based) and not among the first 30; no candidate at position 31 or later is closer in stroke count; ties go to the lowest position; the three samples are 两, 京 and 冒; the paths equal the `strokes` of the source file; determinism (two builds are equal); the own-dataset rule; failure for a fixture level of 30 records and for a missing stroke file. Report the new size of `levels.json`, raw and gzip level 9 (the design computes 6,252 and 2,597 bytes)
    - _Requirements: 11.6, 11.7, 11.8, 11.9, 11.10, 11.19_
  - [x] 14.2 Show the ghost and the samples on the Level screen
    - Add `app/src/components/LevelSample.tsx` (an `svg` with `role="img"`, `aria-label` "sample character of level N", `viewBox` `0 0 1024 1024`, one `path` per stroke inside the group `scale(1, -1) translate(0, -900)`, `fill="currentColor"`, the `inkOnPaper` token on a `card-slip` square) and use it in `LevelScreen.tsx` as a sibling of each level button, so the accessible names of the level Slips stay unchanged; add the `GhostFigure`, the labels "easy", "harder" and "hardest" beside the level numbers, the omitted square for a missing sample and no squares for a failed manifest; keep `describeLevel` and the three slips, no `slip-primary`, and no Han character in any text node or attribute
    - Keep the existing assertion in `LevelScreen.test.tsx` line 50 ('renders no Chinese character in text or attributes') unchanged, and add tests: exactly three `[role="img"]` samples with English labels and no Han character and with path data equal to the manifest, level button names unchanged, a missing sample, a failed manifest, no `slip-primary`, and 44 px by class
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.12, 11.13, 11.14, 11.16, 11.17_
  - [x] 14.3 Update the Level screen e2e test
    - In `e2e/harder-ghosts.spec.ts` keep the assertion at line 91 ("shows no Chinese character") and add the three-sample check (three `[role="img"]` samples with English labels, path data equal to `levels.json`, no sample among the first 30 characters of its level from `levelOrder(n)`); add a request check that no level 2 or 3 font subset is fetched on the Level screen, and keep the fit at every viewport the spec tests today. After waiting for port 4173 to be free, run the spec; it passes
    - _Requirements: 11.11, 11.15, 11.18_

- [x] 15. Item 12: a shorter Graveyard with more grass
  - [x] 15.1 Write the visible-row functions
    - Write `app/src/engine/graveyardRows.ts` (`columnCount`, `visibleGraveCount`, `notYetMetText`) and `engine/graveyardRows.test.ts`: no Met_Ghost, a Met_Ghost in the first row, in the last row, a last row that is not full, one column, fewer graves than one row, `columnCount` at 296, 343 and 768 px, and the paragraph texts
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.19, 12.20_
  - [x] 15.2 Double the grass pattern
    - In `engine/grassPattern.ts` set `HILL_SLOTS` to the approved count (24), add the near-ridge slots and the exported `NEAR_RIDGE_PATH`, `TABLET_TUFT_SCALE`, the second tablet tuft table and `tabletTufts(position)`; no `Math.random`, no `Date`
    - Existing assertions that change in `grassPattern.test.ts`, approved by the human on condition that it is not loosened, old and new stated: 'has 12 slots' (24), 'wraps past 11' (past 23) and the `crestY` check of every slot (per ridge). Add tests: slots 0 to 11 equal the old table, the pair differs in shape and sits on opposite sides, blade extents disjoint, boxes inside 48 px
    - _Requirements: 12.12, 12.13, 12.15_
  - [x] 15.3 Show only the rows that matter
    - In `Graveyard.tsx` add `useGridColumns` (`useLayoutEffect`, `ResizeObserver` with a window `resize` fallback), render `slice(0, shown)` with names from the full order and total, show the "N ghosts not yet met" paragraph after and outside the list, keep legend counts over all graves, draw the two tablet tufts and the doubled hill tufts, all `aria-hidden` and behind the grid. Extend `Graveyard.test.tsx` with a stubbed `clientWidth`: shown rows, the paragraph in its three forms, no `li` and no glyph for collapsed graves, legend counts, names, and a width change
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.13, 12.14, 12.15_
  - [x] 15.4 Update the Graveyard e2e tests
    - Existing assertions that change in `e2e/grass.spec.ts`, approved by the human on condition that it is not loosened, old and new stated: hill tuft count 12 becomes 24 and tufts per tablet 1 becomes 2, every other assertion applying to each tuft. Add to `e2e/graveyard-fit.spec.ts`, at 1024 × 768 and 375 × 812, the collapsed paragraph, the single blank row with no Met_Ghost, and Met_Ghosts across several rows; keep the Grass visibility pixel test passing. After waiting for port 4173 to be free, run both specs and `night-scene`; they pass
    - _Requirements: 12.16, 12.17, 12.18_

- [x] 16. Item 13: the legend line inks itself in (gated on amendment 5)
  - [x] 16.1 Build the legend strokes file
    - Write `scripts/lib/legend-strokes.ts` (`legendCharacters`, `buildLegendStrokes`), add `app/public/data/legend-strokes.json` to the outputs of `build-data.ts` (atomic with the other files; a missing or invalid stroke file fails naming the character), and run `npm run build:data`. Write `tests/unit/legend-strokes.test.ts` (six entries equal the source files, none for ，, two runs byte-identical, failure naming the character) and `tests/unit/legend-range.test.ts` (the seven code points lie in the first `@font-face` `unicode-range` of `fonts.css`)
    - _Requirements: 13.1, 13.2, 13.3, 13.15, 13.28, 13.29_
  - [x] 16.2 Write the loader
    - Write `app/src/data/legendStrokes.ts` with `loadLegendStrokes` returning `ok` or a reason of `network`, `status`, `json` or `empty`, never throwing, and `data/legendStrokes.test.ts` covering success, a partial file and each failure kind
    - _Requirements: 13.13, 13.30_
  - [x] 16.3 Write the timing and grain engines
    - Write `engine/legendInk.ts` (`planLegendInk` with the constants of the design) and `engine/grain.ts` (24 fixed grains), and move `prefersReducedMotion` into `engine/motion.ts`, imported by `SummonStep`. Tests with the real file: every stroke at most 199 ms, every character at most 840 ms, 51 strokes, a wipe step for ，, total under 5,600 ms; at most 24 grains, alpha at most 0.35, no `seal` or `candle` colour
    - _Requirements: 13.8, 13.9, 13.10, 13.16, 13.17, 13.25_
  - [x] 16.4 Ink the legend line in the intro
    - Build `useLegendReveal`, `LegendInk` and the grain layer in `IntroScreen.tsx` and the CSS in `index.css` as in the design: one `p[lang="zh"]` with the whole line for assistive technology, `aria-hidden` ink and grain, the fallback to the existing wipe, the 6000 ms safety timer, `data-legend-state` ending at `inked`, reduced motion fully inked with no grain, "Begin the Séance" the only `slip-primary`, and no change to layout
    - Existing assertions that change, approved by the human on condition that it is not loosened, old and new stated: in `styles/index.css.test.ts` the keyframe allow-list, the `animations()` name pattern and `AMBIENT` gain `grain-fall` (additive; the 200 to 600 ms bound for every other animation and the one-block rule are unchanged); in `IntroScreen.test.tsx` 'keeps the legend line as real static text in an ink-reveal blockquote' waits for the fallback phase before asserting the `ink-reveal` class and keeps its other expectations. Add component tests: reduced motion is `inked` at first render with no grain, a failing loader reaches `inked` with the wipe and no alert, success with a mocked writer runs the cells in order and ends `inked`, the grain attributes
    - _Requirements: 13.6, 13.7, 13.9, 13.11, 13.12, 13.13, 13.14, 13.16, 13.17, 13.18, 13.19, 13.20, 13.21, 13.22, 13.24, 13.25, 13.31_
  - [x] 16.5 Wait for the legend in the e2e helpers and specs
    - Add `waitForLegendReveal(page)` to `e2e/helpers.ts`. Existing assertions that change, approved by the human on condition that it is not loosened, old and new stated: `screenshots.spec.ts` and `night-scene.spec.ts` replace `waitForInkReveal` with `waitForLegendReveal` (the wait is for the same end state, with a longer limit); `fits-one-screen`, `sky-cap`, `slips` and `cursors` call it before any intro screenshot or colour check. `waitForInkReveal` stays for the fallback test only
    - _Requirements: 13.26, 13.27_
  - [x] 16.6 Write the legend e2e test
    - Write `e2e/legend-ink.spec.ts`: `inked` within 6000 ms of load; each Han cell takes at most 900 ms from `active` to `done`; each failure kind through `page.route` ends `inked` with the wipe and no error text; reduced motion is `inked` at once with no `.grain`; "Sources" is clickable 300 ms after load; no vertical scroll and no horizontal overflow at 1024 × 768, 375 × 812 and 320 × 640 during and after; every grain has an `animation-duration` of at least 12 s and `pointer-events: none`. Add `waitForLegendReveal` to the end of `e2e/font-requests.spec.ts`. After waiting for port 4173 to be free, run both; they pass
    - _Requirements: 13.9, 13.12, 13.13, 13.17, 13.18, 13.21, 13.22, 13.23_
  - [x] 16.7 Credit the legend file and recount the first load
    - Add the `legend-strokes.json` row (Arphic Public License) to `DATA_FILES` and to the README data table; leave `LAZY_PATHS` unchanged so the file is counted, and add the `isLazy('data/legend-strokes.json')` false assertion to `bundle-size.test.ts`; run `npm run build -w app` and `npm run check:bundle` and replace the README first-load figures with the new output (counted total at most 300,000). The credits test now covers the legend file
    - _Requirements: 7.9, 13.4, 13.5_
  - [x] 16.8 Capture the screenshots for review
    - In `e2e/screenshots.spec.ts` add calls only (the summary captures are added by task 7.5): the Level screen at 375 × 812, the Graveyard with met ghosts at 375 × 812 and 1024 × 768, and the intro during the ink-in (about 2000 ms after load) and after it at 375 × 812; call `expectMoonInside` for each screen, as the existing captures do. Change no existing capture
    - _Requirements: 4.15, 9.7, 13.23_

- [x] 17. Final checkpoint
  - Before every end-to-end run, wait until nothing listens on port 4173
  - Run `npm test` at the repository root; `npx tsc --noEmit`, `npx tsc --noEmit -p app` and `npx tsc --noEmit -p oracle` (no errors); `npm run build -w app`; `npm run check:bundle`; `npm run test:e2e` (port 4173 free first; wait for it to finish); `npm run check:data` and `npm run check:levels`
  - Report the exact commands and the passed, failed and skipped counts of `npm test` and `npm run test:e2e`, with no skipped test that was not skipped before this work
  - Report every changed existing assertion, each with the old assertion, the new assertion and why the new one is at least as strict, and the README first-load figures (counted, level 1, sum) as printed by `check:bundle`
  - Confirm with `git diff --stat` that `kiro-log.md`, `scheduler.ts` and the scheduler tests are untouched, that steering files changed only through tasks 3.1 to 3.5, and that data files changed only through the pipeline and the override CSV files; search the added and changed files for `any` and for personal names
  - Report the three numbers of "Displayed clue changes" printed by `tests/unit/display-clues.test.ts` (expected 1, 0, 0), the three Level samples with their stroke counts and learning positions, and the size of `levels.json`, raw and gzip level 9, as built
  - Retake the screenshots: delete the PNG files in the gitignored `e2e/screenshots/`, run `npm run test:e2e -- screenshots` (port 4173 free first), and list the paths of every PNG written, including `summary-1024x768.png` and `summary-375x812.png`, so the human can review them in task 18
  - Report anything not achieved: name each failing or skipped check, each requirement criterion not met, the file or test and the command; make no commit
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 2.33, 11.6, 14.10, 14.11, 14.12, 14.13, 14.14, 14.15, 14.16, 14.18_

- [ ] 18. Human-only screenshot review of the summary, the Level screen, the Graveyard and the intro ink-in
  - [ ] 18.1 HUMAN TASK: Human reviews the screenshots
    - Human-only, separate from Kiro work, and last, so that no Kiro task waits on it. Review the screenshots listed by task 17: the 10-ghost summary (reward feel), the Level screen (ghost, samples, labels), the Graveyard (shorter list, more grass) and the intro during and after the ink-in. Tone and feel are a judgement, not a measurement
    - Record the decision (accepted, or what to change) in the review notes the human keeps. Kiro does not review the screenshots and does not edit `kiro-log.md`. Any change the human asks for becomes a new task
    - _Requirements: 4.1, 11.1, 12.12, 13.6_

- [x] 19. Follow-up after the third review
  - Rules for this group: spec-only except 19.1 and 19.2; no steering, data, `kiro-log.md` or `tasks.meta.json` edit; no property-based test, no mutation test; no personal name; no existing assertion loosened
  - [x] 19.1 Grain keeps clear of controls
    - Settle and record in design Item 13 the mechanism (lanes that avoid the controls' boxes at every width, or clipping the grain layer to the legend card area), then implement it in `engine/grain.ts`, `IntroScreen.tsx` and `styles/index.css` without changing the intro layout or the one-screen fit; export the layout constants the unit test needs; keep 24 grains, alpha at most 0.35, the `ink` token, passes of at least 12 s, `pointer-events: none` and `aria-hidden`
    - Unit tests in `engine/grain.test.ts`: for every grain in `GRAINS` at 375 and 1024 px, no Grain_Path intersects a Control_Box (from the `GRAINS` table and the layout constants, if feasible; otherwise record why and cover the rule), plus the contrast of every intro text token over the `ink` token at alpha 0.35 is at least 4.5:1
    - E2E in `e2e/legend-ink.spec.ts` at 375 × 812 and 1024 × 768: compute each grain's left and size from its element and its fall extent (x range over the whole fall, y range 0 to 100 % of the layer), and assert that none crosses the bounding box (plus 4 px) of any button or link on the intro; keep the existing fit assertions. Wait for port 4173 to be free before the run
    - _Requirements: 13.32, 13.33, 13.34, 13.35, 13.36_
  - [x] 19.2 Move the README first-load comparison into `check:bundle`
    - In `tests/unit/readme-first-load.test.ts` keep the checks that need no build (counted + level 1 = sum, the 300,000 budget, the wording that the budget excludes the level 1 dataset) and remove every read of `app/dist`
    - In `scripts/check-bundle-size.ts` add the pure functions `parseReadmeFirstLoad` and `compareFirstLoad`; after printing the first-load line, read `README.md`, extract the stated counted, level 1 and total figures, and exit non-zero naming both figures when they differ from the printed ones
    - Add unit tests of the pure comparison on fixture README text (equal, differing counted, level 1 and total figures, no figures). Run `npm run build -w app` and `npm run check:bundle`; edit `README.md` only if the printed figures differ from it
    - _Requirements: 7.13, 7.14, 7.15, 7.16, 7.17_
  - [x] 19.3 Record the grass decision in the spec (done by this amendment)
    - Spec-only edit made as part of this amendment: requirements criterion 12.22 and the follow-up decisions, and the decision record in design Item 12. No grass code changes. Nothing remains to do; a later reader only verifies that the three documents carry the record
    - _Requirements: 12.22_

- [x] 20. Final checkpoint after the follow-up
  - Before every end-to-end run, wait until nothing listens on port 4173
  - Run `npm test` at the repository root and report the passed, failed and skipped counts
  - Run the intro e2e specs `legend-ink`, `fits-one-screen`, `screenshots`, `night-scene`, `sky-cap`, `slips`, `cursors` and `font-requests` (for example `npm run test:e2e -- legend-ink fits-one-screen screenshots night-scene sky-cap slips cursors font-requests`) and report the passed, failed and skipped counts
  - Run `npm run check:bundle` and confirm it exits 0 with the README figures equal to the printed ones; confirm `git diff --stat` shows no change to `kiro-log.md`, steering files, data files or `tasks.meta.json`; make no commit
  - Report anything not achieved: name each failing or skipped check, the file or test and the command
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 7.13, 7.15, 7.16, 13.32, 13.33, 13.35, 14.10, 14.11, 14.12_

## Notes

- There are no optional tasks. Every test task is required. No property-based test and no mutation test is added (decision of Nov 15); the existing property tests stay.
- Tasks 1.1 and 18.1 are human tasks. Kiro does not do them, does not answer questions, does not approve an amendment and does not review the screenshots. Task 18.1 is the last human-only task and no Kiro task waits for it; tasks 19 and 20 are the follow-up after the third review and run in Kiro's own order.
- After task 1.1, task 2.1 amends the spec first (requirements, design and this file), so the code tasks follow the human's answers.
- Tasks 4, 14 and 16 are gated on tasks 3.1 to 3.3, 3.4 and 3.5, which write the approved amendments 1 to 3, 4 and 5 into the steering files.
- Task 5.1 captures every hash fixture before task 5.2 edits any override file; task 5.3 is the first build after the edits. Tasks 5.5 and 5.6 add and test the display rule for traditional|simplified pairs, which changes no stored data.
- Items 9 and 10 are built together: task 12.2 checks the plain Start menu, task 13.5 adds the worst case that needs the review slip.
- Tasks run one wave at a time where they share files or the end-to-end server on port 4173; only the steering tests of different files run in parallel.

## Task Dependency Graph

```json
{
  "waves": [
    {"id": 0, "tasks": ["1.1"]},
    {"id": 1, "tasks": ["2.1"]},
    {"id": 2, "tasks": ["3.1", "3.2", "3.3"]},
    {"id": 3, "tasks": ["3.4", "3.5"]},
    {"id": 4, "tasks": ["4.1"]},
    {"id": 5, "tasks": ["4.2", "4.3"]},
    {"id": 6, "tasks": ["4.4"]},
    {"id": 7, "tasks": ["5.1"]},
    {"id": 8, "tasks": ["5.2"]},
    {"id": 9, "tasks": ["5.3"]},
    {"id": 10, "tasks": ["5.4"]},
    {"id": 11, "tasks": ["5.5"]},
    {"id": 12, "tasks": ["5.6"]},
    {"id": 13, "tasks": ["6.1"]},
    {"id": 14, "tasks": ["6.2"]},
    {"id": 15, "tasks": ["6.3"]},
    {"id": 16, "tasks": ["7.1"]},
    {"id": 17, "tasks": ["7.2"]},
    {"id": 18, "tasks": ["7.3"]},
    {"id": 19, "tasks": ["7.4"]},
    {"id": 20, "tasks": ["7.5"]},
    {"id": 21, "tasks": ["8.1"]},
    {"id": 22, "tasks": ["8.2"]},
    {"id": 23, "tasks": ["8.3"]},
    {"id": 24, "tasks": ["9.1"]},
    {"id": 25, "tasks": ["9.2"]},
    {"id": 26, "tasks": ["10.1"]},
    {"id": 27, "tasks": ["10.2"]},
    {"id": 28, "tasks": ["10.3"]},
    {"id": 29, "tasks": ["10.4"]},
    {"id": 30, "tasks": ["11.1"]},
    {"id": 31, "tasks": ["11.2"]},
    {"id": 32, "tasks": ["12.1"]},
    {"id": 33, "tasks": ["12.2"]},
    {"id": 34, "tasks": ["13.1"]},
    {"id": 35, "tasks": ["13.2"]},
    {"id": 36, "tasks": ["13.3"]},
    {"id": 37, "tasks": ["13.4"]},
    {"id": 38, "tasks": ["13.5"]},
    {"id": 39, "tasks": ["14.1"]},
    {"id": 40, "tasks": ["14.2"]},
    {"id": 41, "tasks": ["14.3"]},
    {"id": 42, "tasks": ["15.1"]},
    {"id": 43, "tasks": ["15.2"]},
    {"id": 44, "tasks": ["15.3"]},
    {"id": 45, "tasks": ["15.4"]},
    {"id": 46, "tasks": ["16.1"]},
    {"id": 47, "tasks": ["16.2"]},
    {"id": 48, "tasks": ["16.3"]},
    {"id": 49, "tasks": ["16.4"]},
    {"id": 50, "tasks": ["16.5"]},
    {"id": 51, "tasks": ["16.6"]},
    {"id": 52, "tasks": ["16.7"]},
    {"id": 53, "tasks": ["16.8"]},
    {"id": 54, "tasks": ["18.1"]},
    {"id": 55, "tasks": ["19.1", "19.3"]},
    {"id": 56, "tasks": ["19.2"]}
  ]
}
```
