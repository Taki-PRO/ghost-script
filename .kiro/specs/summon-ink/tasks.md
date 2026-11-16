# Implementation Plan: summon-ink

## Overview

Add the `summonInk` field to the dataset, ink strokes in the Summon step on each correct key, and reorder the Learning order by class. The plan goes bottom-up: shared foundations and the pure classifier, then the pipeline and the regenerated dataset, then the loader and the Learning order, then the Summon step, then e2e tests, then steering and spec amendments, accuracy review and the final checkpoint. Each task names the files it edits, and the dependency graph keeps tasks that edit the same file in different waves.

Steering edits (`tech.md`, `content-accuracy.md`) are tasks here (8.1, 8.2), approved by the human. Do not edit them outside those tasks.

## Tasks

- [ ] 1. Foundations
  - [ ] 1.1 Record the existing-fields baseline from the committed dataset
    - BEFORE any change to the pipeline or to `characters.json`, read the committed file with `git show HEAD:app/public/data/characters.json`; for each of the 300 records compute the SHA-256 (hex) of `JSON.stringify(record)` with any `summonInk` key removed; write `tests/fixtures/summon-ink/existing-fields.sha256.json` as an object from character to hash with keys in code point order
    - Use a throwaway command (for example `tsx -e`) and do not commit the command
    - Add a provenance paragraph to `tests/fixtures/README.md`: what the file pins, that it comes from the committed dataset before summon-ink, and that it is regenerated the same way if a later spec changes existing fields on purpose
    - _Requirements: 8.3, 9.5_
  - [ ] 1.2 Move the Cangjie key table to `app/src/engine/cangjieRules.ts`
    - Move `CangjieKey`, `CangjieKeyInfo` and `CANGJIE_KEYS` from `app/src/engine/cangjie.ts` into `cangjieRules.ts` (which keeps importing nothing)
    - Re-export them from `cangjie.ts` (`export { CANGJIE_KEYS } from './cangjieRules'`, `export type { CangjieKey, CangjieKeyInfo } from './cangjieRules'`) and import what `cangjie.ts` still needs; `KEY_FACE_CHARACTERS` stays in `cangjie.ts`
    - Keep `app/src/engine/cangjie.keys.test.ts` passing unchanged; add one assertion to `cangjieRules.test.ts` that the table has 25 entries, X is 難 and the other 24 shapes are distinct
    - _Requirements: 1.2_
  - [ ] 1.3 Add the types to `app/src/data/types.ts`
    - Add `SummonInkClass`, `SummonInk` (documented as derived from `decomposition`, `cangjie` and the Key_Table, adding no dataset and no licence), the required `summonInk: SummonInk` field on `CharacterRecord` placed between `cangjie` and `sources`, and `summonInkCounts: Record<SummonInkClass, number>` on the success variant of `BuildResult`
    - Leave `FieldSources` unchanged
    - _Requirements: 2.4, 2.7, 3.1_

- [ ] 2. The classifier
  - [ ] 2.1 Implement `app/src/engine/summonInk.ts`
    - Export `IdsNode`, `parseIds`, `BASE_SHAPE_BY_KEY` (24 entries, built from `CANGJIE_KEYS` without X), `ClassifierInput` (with `character`), `classifySummonInk`, `isValidSummonInk` and `summonInkRank`, as in the design
    - Import only `./cangjieRules` and types so that `scripts/` can import the file by relative path
    - `classifySummonInk` follows Requirements 1.3 to 1.16 exactly: atomic single instance, tree leaves left to right, exact path assignment, forward-only first-fit cursor, X and unmatched keys leave the cursor, class rules, ascending `keyStrokes`, class-only `opaque`
    - `isValidSummonInk(value, code, strokeCount)` follows Requirements 3.3 to 3.7 and treats a hostile object (extra keys, `__proto__`) as data
    - No `any`; the function never throws on any input of the declared type
    - _Requirements: 1.1 to 1.16, 3.8_
  - [ ] 2.2 Write unit tests `app/src/engine/summonInk.test.ts`
    - The hand-built cases of Requirement 9.1 (atomic, nested path, repeated shape in order, `null` stroke, `？` leaf, key X, keys in a different order from the leaves, inner-node path, wrong-length `matches`, empty code, `null` code, malformed string)
    - `parseIds` on binary, ternary (⿲ ⿳) and malformed strings; `isValidSummonInk` accept and reject cases for each rule of Requirement 3; `summonInkRank`; `BASE_SHAPE_BY_KEY` has 24 entries and no X
    - Characters used in hand-built cases are written in the test; no codes of real records are typed
    - _Requirements: 9.1, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [ ] 2.3 Write the property-based test `app/src/engine/summonInk.property.test.ts` (the only new property test)
    - **Property 1: Classification invariants**
    - fast-check, 300 runs, one `it`; first line `// Feature: summon-ink, Property 1: Classification invariants`; generators as in the design Testing Strategy; includes the independent model of clause 3 and the extra-X check of clause 4
    - **Validates: Requirements 1.3, 1.4, 1.6, 1.8, 1.9, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16**
    - _Requirements: 9.2_

- [ ] 3. Pipeline and dataset
  - [ ] 3.1 Compute `summonInk` in `scripts/lib/merge.ts`
    - Import `classifySummonInk` by relative path from `../../app/src/engine/summonInk`; set `summonInk` on the record from the merged data as in the design (D7)
    - Update `tests/unit/merge.test.ts`: expected records gain `summonInk`; add one test with a transparent and one with an opaque input
    - _Requirements: 2.1, 2.2_
  - [ ] 3.2 Serialise `summonInk` in `scripts/lib/serialise.ts`
    - Add `summonInk` to `OrderedRecord` and `orderRecord` between `cangjie` and `sources`, rebuilt as `{ class }` or `{ class, keyStrokes }` in that key order; leave every other key as is
    - Update `tests/unit/serialise.test.ts`: key order check including the new key before `sources`, and nested key order
    - _Requirements: 2.3, 2.4_
  - [ ] 3.3 Count classes and extend the build summary in `scripts/build-data.ts`
    - Count the three classes while building and return `summonInkCounts` in the success result; add and export `formatSummonInkSummary(counts)` printing `Summon ink: transparent N, partial N, opaque N` and append it to the success output after the Cangjie lines
    - Update `tests/unit/build-summary.test.ts`: the new line, and that the three counts add up to the record count
    - _Requirements: 2.6_
  - [ ] 3.4 Update the shared test helpers and the existing pipeline tests
    - `tests/helpers/arbitraries.ts`: generated records gain a valid `summonInk` (computed with `classifySummonInk` from the generated record, so the helper cannot drift)
    - Update `tests/property/character-record-schema.test.ts`, `tests/property/record-fields.test.ts`, `tests/property/pipeline-determinism.test.ts` and `tests/integration/full-pipeline.test.ts` for the new field and its position; do not add any new property test, and keep Property 10 (the `sources` keys) unchanged
    - _Requirements: 2.3, 2.5, 9.9_
  - [ ] 3.5 Regenerate `app/public/data/characters.json`
    - Run `npm run build:data` twice and confirm the two outputs are byte-identical (compare checksums)
    - Confirm the summary prints transparent 15, partial 95, opaque 190, matching the design; if the numbers differ, stop and report
    - Confirm `git diff --numstat app/public/data/characters.json` shows 0 deleted lines
    - Do not edit the file by hand
    - _Requirements: 2.1, 2.5, 2.6, 2.8, 8.4_
  - [ ] 3.6 Write the dataset unit tests (node project)
    - `tests/unit/summon-ink-dataset.test.ts`: exhaustive over all 300 records: stored equals `classifySummonInk` recomputed; every stored value passes `isValidSummonInk`; every leaf of a non-atomic record is in `decomposition.components` or is `？`; `summonInk` is the key right before `sources`; the three class counts add up to 300 and each class is non-empty; the eight-character spot check (明 早 天 果 里 本 下 干) reading code, components and `matches` from the dataset: class `transparent`, each key's base shape (from `CANGJIE_KEYS`) equals the component at that position, and `keyStrokes` partition the strokes
    - `tests/unit/summon-ink-existing-fields.test.ts`: recompute each record's checksum without `summonInk` and compare with the fixture of task 1.1; report the characters that differ
    - _Requirements: 8.3, 9.3, 9.4, 9.5_
  - [ ] 3.7 Document the derived field in the README
    - In the README "Data and licences" section add one sentence: `summonInk` is derived from the decomposition (Make Me a Hanzi), the Cangjie code (Unihan) and the key table, and adds no dataset and no licence
    - _Requirements: 2.7_

- [ ] 4. Loader, Learning order and fixtures
  - [ ] 4.1 Validate `summonInk` in `app/src/data/charDataLoader.ts`
    - `isCharacterRecord` calls `isValidSummonInk(v.summonInk, v.cangjie, v.strokeCount)`; failure returns `invalid-shape`
    - Update `app/src/data/charDataLoader.test.ts`: fixtures gain `summonInk`; cases for each rejection of Requirements 3.3 to 3.7; the real dataset loads
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - [ ] 4.2 Change `app/src/engine/learningOrder.ts` and its tests
    - Sort by `summonInkRank`, then `strokeCount` (non-finite last), then code point sequence; widen the parameter type to accept records with an optional `summonInk`; update the doc comment
    - Update `learningOrder.test.ts` (class order on hand-built maps; a record without `summonInk` ranks as opaque; real dataset: class sequence non-decreasing and counts equal the stored classes) and amend `learningOrder.property.test.ts` in place so Property 12 expects class, then strokes, then code point; do not add a new property test
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 9.9_
  - [ ] 4.3 Add `summonInk` to the remaining test fixtures
    - Update fixtures in `app/src/components/SeanceSession.resultLine.test.tsx`, `SeanceSession.test.tsx`, `Graveyard.test.tsx`, `app/src/engine/graveyard.test.ts`, `oracle/tests/oracle.test.ts` and `oracle/tests/server.test.ts`; use `{ class: 'opaque' }` unless a test needs another class; adjust order expectations in the Graveyard tests to the new `learningOrder`
    - _Requirements: 7.5, 9.9_
  - [ ] 4.4 Update the guide and App tests for the new order
    - `app/src/components/CangjieGuide.test.tsx`: the hard-coded `想` and `DUP` test becomes `黑`, with the code read from the dataset; the Answer_Leak test (index at least 30) stays
    - `app/src/App.test.tsx`: the first ten ghosts still equal `learningOrder(dataset).slice(0, 10)`, 一 is still first; replace the "fewest strokes of all characters" check by a check that the first ten are transparent
    - _Requirements: 7.5, 7.6, 9.9_

- [ ] 5. Checkpoint - Data and engine
  - Run `npm test` and `tsc --noEmit` for the root project, `app/` and `oracle/` (app Summon step tests may still fail until task 6.2; everything else must pass)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Summon step
  - [ ] 6.1 Implement ink in `app/src/modes/SummonStep.tsx`
    - Add `SUMMON_INK_SPEED` (2) and the reduced-motion speed (1000); create the Ink_Writer at mount for `transparent` and `partial` records with `showCharacter: false`, `strokeAnimationSpeed` by reduced-motion preference, the existing loader and `onLoadCharDataError` marking the writer broken
    - Add the promise queue (`enqueueInk`, one `animateStroke` at a time, strokes queued once), call it from `commit` for the key at index `prev.filled`, and in the forming effect draw every stroke not yet queued, then hold and fade with the existing constants; keep the opaque path as it is today; surface `hidden` only when typing an opaque character
    - On a broken writer at completion use the existing plain-text fallback; on unmount stop the queue, clear timers, empty the container; `onDone` once
    - Extend `describe` with the Inkless_Key text "This key's shape is one the game doesn't show yet." for `partial` characters only
    - Keep `SUMMON_HOLD_MS` and `SUMMON_FADE_MS` defined once, unchanged
    - _Requirements: 4.1 to 4.13, 5.1, 5.2, 5.3, 6.2, 8.2_
  - [ ] 6.2 Write the component tests for the ink
    - Update `app/src/modes/SummonStep.test.tsx` (mock gains `animateStroke`; fixtures gain `summonInk`) and add `app/src/modes/SummonStep.ink.test.tsx` with the cases listed in the design (writer from mount for ink classes only; exact strokes per key; wrong key draws nothing; quick keys never overlap; completion draws only undrawn strokes in ascending order; Give up; reduced motion; create throws and `animateStroke` rejects lead to the text fallback; unmount; Inkless_Key text for `partial` only; no `path` element when `onDone` runs)
    - Use real records: the first transparent, the first partial with an inkless key, the first opaque one in `learningOrder`
    - _Requirements: 4.1 to 4.11, 5.1, 5.2, 5.3, 6.2, 9.6_
  - [ ] 6.3 Extend the never-reveal test
    - In `app/src/modes/SummonStep.neverReveal.test.tsx`, loop over every playable transparent and partial record: after each correct key the target character appears in no text node and no attribute of the Summon step and the clue
    - _Requirements: 6.1, 9.6_
  - [ ] 6.4 Write the real-library integration test
    - `app/src/modes/SummonStep.hanziwriter.integration.test.ts`, in the style of `charDataLoader.hanziwriter.integration.test.ts`: real hanzi-writer in jsdom for 明 from the dataset with `showCharacter: false`; all stroke paths have effective opacity 0 at mount; `await animateStroke(0)` then `await animateStroke(1)` leave exactly those two main-layer paths visible; `animateStroke(4)` and `animateStroke(5)` called without awaiting leave stroke 4 invisible; document in comments that this is why the step queues strokes
    - If jsdom lacks a usable `requestAnimationFrame`, install a timer-based one inside the test and say so in a comment
    - _Requirements: 4.6, 9.6_

- [ ] 7. End-to-end tests
  - [ ] 7.1 Share the e2e helpers
    - In `e2e/helpers.ts` add `datasetMap()`, `datasetRecord(char)`, `seedBefore(char)` (uses `learningOrder` from `app/src/engine/learningOrder` over the dataset read at test time; marks every earlier character reviewed `clean` with `nextDue` 30 days ahead) and `visibleInkPaths(page)` (counts `path[clip-path]` under `[data-testid="ink-container"]` with a positive effective opacity and no `display: none`); move `expectInside` and `expectNoVerticalScroll` from `fits-one-screen.spec.ts` into `helpers.ts` and import them there
    - No hook or backdoor in the App
    - _Requirements: 9.7, 9.8_
  - [ ] 7.2 Write `e2e/summon-ink.spec.ts`
    - Test 1 (ink after the first key): seed before 明, begin a Séance, confirm the page shows 明's prompt pinyin read from the data, press the first key of 明's code read from the data, poll until `visibleInkPaths` equals the length of `keyStrokes[0]`
    - Test 2 (honest wording): seed before the first partial character in the learning order, type its code up to and including the first key with an empty `keyStrokes` entry, expect the status line to contain "This key's shape is one the game doesn't show yet."
    - Test 3 (fit): at 1024 by 768 and 375 by 812, after the first key on 明 and after the inkless key of test 2, the controls checked in `fits-one-screen.spec.ts` are inside the viewport and there is no vertical scroll
    - _Requirements: 4.2, 4.13, 5.1, 5.5, 9.7, 9.8_

- [ ] 8. Steering, spec amendments and review
  - [ ] 8.1 Edit `.kiro/steering/tech.md` (steering edit, approved by the human)
    - After the "Decision (Nov 15)" sentence in "Code conventions" add: the decision has one exception, approved by the human: the summon-ink classification (`app/src/engine/summonInk.ts`) gets exactly one property-based test; no other new property tests and no mutation testing
    - _Requirements: 10.1_
  - [ ] 8.2 Edit `.kiro/steering/content-accuracy.md` (steering edit, approved by the human)
    - Under "What is not an answer leak" add: the parts of a character drawn as strokes during the Summon step, as each correct key is typed (spec summon-ink), approved by the human; parts appear only as drawn paths, never as text or in an attribute, and the Paper is empty before the Lay-to-rest step
    - Add a short note on derived fields: a field the pipeline derives from other sourced fields (for example `summonInk`) records no new dataset, has its derivation named in the type documentation and the README, and needs no entry in `sources`
    - _Requirements: 2.7, 6.4_
  - [ ] 8.3 Apply the amendments to the other specs
    - ghost-game-core: `requirements.md` AC 6.12 and the Glossary "Learning order", `design.md` (learningOrder section, architecture label, Property 12, Testing Strategy rows), `tasks.md` a note beside tasks 5.8 to 5.10; each with "Amended (approved by the human): see summon-ink Requirement 7"
    - cangjie-seance: `design.md` (the sentence "No hanzi-writer instance exists before this moment", the "Forming and fading" paragraph, decision D10 note) and `requirements.md` (notes on AC 2.4 and AC 5.1), each with an "Amended (approved by the human)" note pointing at summon-ink Requirements 4 and 6
    - character-dataset: `requirements.md` and `design.md` note the new field and key order; Property 10 is unchanged
    - Do not edit `tasks.meta.json` files
    - _Requirements: 10.2_
  - [ ] 8.4 Run the accuracy review
    - Invoke the `accuracy-reviewer` agent on: the new status text in `SummonStep.tsx`, the README sentence, the unchanged guide sentence, and the edits of tasks 8.1 and 8.2; fix every finding in the file it names and run the agent again until it reports none
    - _Requirements: 5.6, 10.3_

- [ ] 9. Final checkpoint - Whole project
  - Run `npm test` from the repository root (all pass); `tsc --noEmit` for the root project, for `app/` and for `oracle/` (no errors); `npm run build:data` twice with identical output and `git diff --numstat app/public/data/characters.json` showing 0 deleted lines; the existing-fields test; `npm run build -w app`; `npm run check:bundle`; `npm run test:e2e` (all pass, including the new spec)
  - Confirm with `git diff --stat` that `config.ts`, `scheduler.ts`, `outcome.ts` and `app/src/storage/` are untouched, and search the added and changed files for `any` and for personal names
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 10.3, 10.4_

- [ ] 10. Manual step by the human (non-coding)
  - [ ] 10.1 Log the feature in `kiro-log.md`
    - This task is NON-CODING and is done by the human, not by Kiro. `structure.md` asks that `kiro-log.md` records Kiro usage; add an entry for this spec: requirements-first spec, steering edits, the oracle spot-check, the accuracy-reviewer run, the data-check hook, and the Playwright e2e. Delete this task if the human prefers to log elsewhere.
    - Also play one Séance with the keyboard and one with touch to see the ink; note the stroke speed (`SUMMON_INK_SPEED`) and adjust it if it feels slow or fast.
    - _Requirements: 4.2, 4.9_

## Notes

- There are no optional tasks. Exactly one new property-based test is added (task 2.3); the existing property tests are updated in place only where the record shape or the Learning order changes (tasks 3.4 and 4.2).
- Steering edits (tasks 8.1 and 8.2) and spec amendments (task 8.3) are approved by the human. Do not edit steering files anywhere else.
- Never write personal names in repo files; approvals are "approved by the human". Do not add `.kiro/` to `.gitignore`.
- `app/public/data/characters.json` is produced only by `npm run build:data`.
- The new dataset tests live in `tests/unit/`, so the `data-check-on-save` hook (`npm run check:data`) runs them in its `test:data` step when data inputs are saved.
- Task 1.1 must run before task 3.5: it records the baseline from the committed file.
- Tests that read `characters.json` with `summonInk` need task 3.5 first (tasks 3.6, 4.4, 6.2, 6.3).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "8.1", "8.2", "8.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1", "3.2", "4.1", "4.2"] },
    { "id": 3, "tasks": ["3.3", "3.4", "3.7", "4.3", "6.1"] },
    { "id": 4, "tasks": ["3.5", "6.4"] },
    { "id": 5, "tasks": ["3.6", "4.4", "6.2", "6.3"] },
    { "id": 6, "tasks": ["7.1", "8.4"] },
    { "id": 7, "tasks": ["7.2"] },
    { "id": 8, "tasks": ["10.1"] }
  ]
}
```
