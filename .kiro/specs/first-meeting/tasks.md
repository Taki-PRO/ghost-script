# Implementation Plan: first-meeting

## Overview

Teach the code on a ghost's first meeting, run a guided first ghost for a brand-new player, remove the forced guide before the first Séance, and show when each ghost returns in the session summary. The plan goes bottom-up: steering and spec amendments, the three pure engine modules, the UI, the App wiring, the end-to-end tests, the README and the accuracy review, then a final checkpoint. Each task names the files it edits, and the dependency graph keeps tasks that edit the same file in different waves.

Steering edits (tasks 1.1 and 1.2) and the spec amendments (task 1.3) are approved by the human. Do not edit steering files outside those tasks. The scheduler, `selectSession`, `buildSession`, the Summon reducer, outcomes, thresholds, storage and the dataset stay unchanged.

### Kiro features used

- **Specs**: this requirements-first spec with a wave plan (`.kiro/specs/first-meeting/`).
- **Steering**: `tech.md`, `structure.md`, `product.md` and `content-accuracy.md` shaped the requirements; two of them are edited by tasks 1.1 and 1.2.
- **Custom agent**: `accuracy-reviewer` runs over all new copy (task 6.2).
- **Playwright e2e**: `e2e/first-meeting.spec.ts` (task 5.2) and the helpers of task 5.1.

## Tasks

- [x] 1. Steering and spec amendments
  - [x] 1.1 Edit `.kiro/steering/content-accuracy.md` (steering edit, approved by the human)
    - Under "What is not an answer leak" add: the first-meeting display of a ghost met for the first time (the faint code letters, the highlight of the next slot and key, and the walkthrough lines) is intended and is not an answer leak, because the player is being taught; approved by the human
    - State in the same entry that the never-reveal rule still holds for returning ghosts and for the character itself as text on first meeting too: the faint code shows letters and key shapes, never the target character as text or in an attribute, and `maskTarget` still applies when a key shape equals the target
    - State that the session summary may show the glyph of every ghost, because each has run its rite
    - _Requirements: 7.7, 13.1_
  - [x] 1.2 Edit `.kiro/steering/product.md` (steering edit, approved by the human)
    - In "Core game loop", step 2, say that the first time a ghost is met its code is shown to copy, and that when the ghost returns the code is hidden; keep "Never the full answer at first" for hints after wrong answers and say so
    - In the "Must-have" list, note that the Nightly Séance summary lists when each ghost returns and that a brand-new player's first ghost is a short walkthrough
    - _Requirements: 13.2_
  - [x] 1.3 Apply the amendments to the other specs
    - Add an "Amended (approved by the human): see first-meeting Requirement N" note to each item listed under "Amendments to other specs" in this spec's `requirements.md`: ghost-game-core (`requirements.md` AC 1.2, 1.3, 1.5, 3.1, 3.3, 6.5 and a design note), cangjie-seance (`requirements.md` AC 6.1, 6.2, 7.2, 9.4, 3.1, 3.5, 3.7, 5.1, the Glossary entries "Code slot" and "Key hint", the Introduction; `design.md` screen flow, `App` section, Summon step slots and status text, the `App.test.tsx` row; `tasks.md` a short note beside task 6.1), visual-identity (`requirements.md` 25.1, 25.2, 26.1, 29.3, 29.4, 18.2c; `design.md` height budget), summon-ink (`requirements.md` AC 9.7)
    - Do not rewrite the history of those specs; add notes only, and do not edit any `tasks.meta.json`
    - _Requirements: 13.3_

- [x] 2. Pure engine modules
  - [x] 2.1 Implement `app/src/engine/firstMeeting.ts` and `firstMeeting.test.ts`
    - Export `isBrandNewPlayer(history)` and `firstMeetingSet(history, characters)` as in the design, with own-property checks only and no input mutation
    - Tests: empty history, one entry, keys "constructor" and "__proto__", characters with and without entries, an empty `characters` list
    - _Requirements: 1.1, 2.3, 2.5, 3.1, 12.1_
  - [x] 2.2 Implement `app/src/engine/walkthrough.ts` and `walkthrough.test.ts`
    - Export `WALKTHROUGH_WRITE_LINE`, `pickWalkthroughGhost(order, dataset)`, `composeFirstSession(ghosts, walkthrough, size)` and `walkthroughSummonLines(record, dataset)` exactly as in the design; import `parseIds` from `./summonInk`, `isPlayableInCangjie` and `CANGJIE_KEYS` from `./cangjieRules`, `cleanupMeaning` and `maskTarget`; no React, no `any`
    - Tests: each clause of the rule on small hand-built datasets (the characters used there are written in the test, no real code typed from memory); `null` when nothing matches; the three line forms; `maskTarget`; an exhaustive loop over keys A–Y against the real `characters.json` read in the test
    - Add the one real-dataset test: `pickWalkthroughGhost(learningOrder(dataset), dataset)` is read from the rule's own output and compared with the literal 明; this is the only place the literal is written, and the same test checks the lines "Press A: the sun 日" and "Press B: the moon 月" through `walkthroughSummonLines` for the returned record
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.10, 12.1_
  - [x] 2.3 Implement `app/src/engine/formatReturn.ts` and `formatReturn.test.ts`
    - Export `formatReturn(nextDue, now)`, `ReturnRow` and `buildReturnRows(ghosts, entries)` as in the design; the day rule uses the local year, month and day of each timestamp through `Date.UTC`
    - Tests build every timestamp from local calendar fields (`new Date(y, m, d, h, min).getTime()`) so they pass in any time zone; cover the worked examples of the design, every boundary, singular forms, non-finite input, row order, skipped ghosts and cleaned meanings
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 12.1_
  - [x] 2.4 Add the reserved height to `app/src/engine/surfaceSize.ts` and extend `surfaceSize.test.ts`
    - Export `WALKTHROUGH_LINE_PX = 24`; give `summonPaperSize` and `writeSurfaceSize` a third parameter `reservedPx = 0` that is subtracted from the height before the existing formula
    - Tests: `reservedPx` 0 returns today's values (160 at 1024 × 768 and 150 at 375 × 812 for the Summon paper), 24 returns 144 and 150, the floors of 96 and 200 hold, and the existing cases still pass
    - _Requirements: 10.3, 10.4, 11.1_

- [x] 3. User interface and App wiring
  - [x] 3.1 Show the faint code, the highlight and the walkthrough line in `app/src/modes/SummonStep.tsx`
    - Add the optional props `firstMeeting` and `walkthroughLines` and the behaviour of the design: faint letters and the slot names "Slot {n}, type {LETTER}", the Next_Key_Highlight (ring, bold underlined key letter, `aria-current="true"`, key name ending ", next"), the status text "Copy the faint letters, one key at a time", the `data-testid="walkthrough-line"` paragraph, and the reserved paper height through `summonPaperSize(..., WALKTHROUGH_LINE_PX)` when `walkthroughLines` is given
    - Keep the reducer calls, `SUMMON_HOLD_MS`, `SUMMON_FADE_MS`, the Key hint rule and `maskTarget` unchanged; the faint letter span is `aria-hidden` and uses the `text-muted` class; the slot height does not change
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 2.1, 2.2, 4.5, 4.6, 7.1, 7.2, 7.3, 10.3, 10.4, 11.2, 11.3_
  - [x] 3.2 Update the Summon step tests: `SummonStep.test.tsx` and `SummonStep.neverReveal.test.tsx`
    - Extend `SummonStep.test.tsx` with the first-meeting, returning, highlight, walkthrough-line, wrong-key, `clean` and contrast cases listed in the design Testing Strategy (`contrastRatio(theme.muted, theme.surface) >= 4.5`)
    - Update `SummonStep.neverReveal.test.tsx` to render every Playable ghost as First_Meeting and as Returning, unresolved and after a Key hint, with and without `walkthroughLines`, and assert the target character appears nowhere in the DOM text, attributes or document title
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10, 1.11, 1.12, 2.1, 4.5, 4.6, 7.1, 7.2, 7.3, 7.4, 7.5, 12.2_
  - [x] 3.3 Pass the reserved height to `app/src/modes/WriteMode.tsx` and extend `WriteMode.test.tsx`
    - Add the optional prop `reservedPx` (default 0) and pass it as the third argument of `writeSurfaceSize`; nothing else changes
    - Test: with `reservedPx` the surface size handed to hanzi-writer is smaller by the reserved height at a short viewport; without it the size is today's
    - _Requirements: 10.2, 10.3, 12.2_
  - [x] 3.4 Wire first meeting and the walkthrough in `app/src/components/SeanceSession.tsx` and extend `SeanceSession.test.tsx`
    - Add the optional props `firstMeeting` (default empty set) and `walkthroughChar` (default `null`); pass `firstMeeting` per ghost and `walkthroughLines` (from `walkthroughSummonLines`, memoised) for the walkthrough ghost to `SummonStep`; render the Write line from `WALKTHROUGH_WRITE_LINE` in the write step while the ghost has no result and pass `reservedPx={WALKTHROUGH_LINE_PX}` to `WriteMode`
    - Tests as in the design (defaults, per-ghost display, Summon line then Write line, Write line gone on a result, none for other ghosts); keep the existing Leave, outcome and result-line tests passing unchanged
    - _Requirements: 1.1, 2.4, 2.6, 3.8, 3.9, 4.4, 4.5, 4.7, 4.8, 4.9, 12.2_
  - [x] 3.5 Show the return times in `app/src/components/SessionSummary.tsx` and extend `SessionSummary.test.tsx`
    - Add the optional `returns` and `finishedAt` fields to `SessionResults`; render the heading and the labelled list of Return_Rows (glyph with `lang="zh"`, pinyin with `lang="zh-Latn-pinyin"`, meaning, `formatReturn(row.nextDue, finishedAt)`) only when there are rows and `finishedAt` is finite; wrap long text so that nothing overflows at 375 px
    - Tests: rows in order for gave-up, struggled and clean ghosts, no list when empty or absent, the existing summary tests unchanged
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7, 7.6, 12.2_
  - [x] 3.6 Change the intro line in `app/src/components/IntroScreen.tsx` and update `IntroScreen.test.tsx`
    - Replace "You lay each one to rest by writing it." with "Type its shapes to summon it, then write it from memory." and keep everything else; update the premise test to check the new sentence and the absence of the old one
    - _Requirements: 6.1, 6.2, 12.2_
  - [x] 3.7 Wire the App in `app/src/App.tsx` and update `App.test.tsx` and `App.leaveSaved.test.tsx`
    - Export `planSeance`; use it in `startSeance`; store `firstMeeting` and `walkthroughChar` in the `seance` view and pass them to `SeanceSession`; remove `beginSeance` and the `origin` field so the intro, menu and summary buttons call `startSeance` directly; keep `setCangjieIntroSeen(true)` on the guide's Continue and stop importing `getCangjieIntroSeen`
    - Keep a `Map` of the `applyReview` entries in a ref (cleared in `startSeance`, filled in `handleOutcome`); in `onComplete` pass `{ ...results, returns: buildReturnRows(ghosts, map), finishedAt: Date.now() }` to the summary
    - Update the existing tests (first visit goes straight to the Séance; "guide unseen" starts directly; ten ghosts for an empty history start with the walkthrough ghost) and add the App tests of Requirement 12.3, including a failing-storage case
    - _Requirements: 1.1, 2.3, 2.4, 3.1, 3.5, 3.6, 3.10, 3.11, 3.12, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.1, 9.2, 9.8, 9.9, 11.1, 12.3, 12.4_

- [x] 4. Checkpoint - Engine and UI
  - Run `npm test` from the repository root and `tsc --noEmit` for `app/`; confirm `git diff --stat` shows `config.ts`, `scheduler.ts`, `outcome.ts`, `cangjie.ts`, `learningOrder.ts` and `app/src/storage/` untouched
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 11.1, 12.5_

- [x] 5. End-to-end tests
  - [x] 5.1 Add the e2e helpers to `e2e/helpers.ts`
    - Add `walkthroughRecord()` (calls `pickWalkthroughGhost(learningOrder(datasetMap()), datasetMap())` and returns the record; throws when `null`), `seedWithHistory(chars, outcome)` (history entries with `nextDue` 0 so the characters are due) and `slotName(index, letter)`; keep `seedState` and `seedBefore` as they are; name no character literally
    - _Requirements: 12.6, 3.4_
  - [x] 5.2 Write `e2e/first-meeting.spec.ts`
    - Cover, at the default viewport and at both Rite_Viewports where the design says so: a new player from the intro reaches the Summon step with no guide; the faint code and the first walkthrough line; the line advancing as the dataset's code is typed; a returning ghost showing "Slot 1, empty" and no letters; the fits of the walkthrough ghost's Summon and Write steps and of a first-meeting ghost that is not the walkthrough ghost; a full Séance by "Give up" with reduced motion and a raised timeout, whose summary lists a Return_Text for every ghost and passes the width check at 375 × 812
    - Read every letter, pinyin and meaning from `characters.json` at test time; type no code from memory
    - _Requirements: 1.2, 1.3, 1.4, 2.1, 3.8, 4.5, 4.7, 5.1, 9.4, 9.7, 10.1, 10.2, 10.5, 12.6, 12.7_
  - [x] 5.3 Update `e2e/fits-one-screen.spec.ts` and `e2e/summon-ink.spec.ts` where the feature requires it
    - Run both specs; where a seeded history now makes the first ghost a first meeting or the walkthrough ghost, change only what the run shows to fail (for example an expected status text or an assertion that assumed empty slots); keep every fit assertion
    - _Requirements: 12.8, 10.1_

- [x] 6. README and review
  - [x] 6.1 Update `README.md`
    - Update the e2e paragraph (the new spec file and what it checks) and add two short sentences: the first time a ghost is met its code is shown to copy, and the summary lists when ghosts return; make no claim beyond what the app does
    - _Requirements: 12.6, 13.4_
  - [x] 6.2 Run the accuracy review
    - Invoke the `accuracy-reviewer` agent on: the intro sentence, the Walkthrough_Lines and `WALKTHROUGH_WRITE_LINE` in `walkthrough.ts`, the status text and the slot and key names in `SummonStep.tsx`, the Return_Texts in `formatReturn.ts`, the heading and labels in `SessionSummary.tsx`, the README change and the edits of tasks 1.1 and 1.2; fix every finding in the file it names and run the agent again until it reports none
    - _Requirements: 13.4_

- [x] 7. Final checkpoint - Whole project
  - Run `npm test` from the repository root (all pass); `tsc --noEmit` for the root project, for `app/` and for `oracle/` (no errors); `npm run build -w app`; `npm run check:bundle`; `npm run test:e2e` (all pass, including the new spec)
  - Confirm with `git diff --stat` that `config.ts`, `scheduler.ts`, `outcome.ts`, `cangjie.ts`, `learningOrder.ts`, `app/src/storage/` and `app/public/data/characters.json` are untouched; search the added and changed files for `any`, for the literal 明 outside `walkthrough.test.ts` where it names the walkthrough ghost, and for personal names
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.5, 12.9, 13.5_

## Notes

- There are no optional tasks. No property-based test is added (tech.md, decision of Nov 15); the existing property tests stay as they are.
- There is no kiro-log or play-through task: `kiro-log.md` is written by the human, not by Kiro, and Kiro skips it. The human may also play one Séance with the keyboard and one with touch to judge the faint letters and the walkthrough by eye.
- Steering edits (tasks 1.1 and 1.2) and spec amendments (task 1.3) are approved by the human. Do not edit steering files anywhere else.
- Never write personal names in repo files; approvals are "approved by the human". Do not add `.kiro/` to `.gitignore`.
- `app/public/data/characters.json` is not touched by this feature.
- Task 2.2 names the literal 明 in exactly one test; every other test, helper and source file reaches the walkthrough ghost through `pickWalkthroughGhost`.
- Tasks 3.1 and 3.3 add the reserved height only through the optional parameters of task 2.4, so existing callers and tests keep today's sizes.
- Task 5.3 is a diagnose-then-fix task: run the two existing specs first and change only what fails because of this feature.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1", "2.2", "2.3", "2.4", "3.6"] },
    { "id": 1, "tasks": ["3.1", "3.3", "3.5", "5.1"] },
    { "id": 2, "tasks": ["3.2", "3.4"] },
    { "id": 3, "tasks": ["3.7"] },
    { "id": 4, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 5, "tasks": ["6.2"] }
  ]
}
```
