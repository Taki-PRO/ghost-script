# Implementation Plan: cangjie-seance

## Overview

Add the two-step rite to Ghost Script: every ghost is first SUMMONED by typing its Cangjie code, and the character forms in ink and fades; then it is LAID TO REST by writing it from memory in the existing Write mode. Ghosts without a playable code (null, or a code starting with X: 别 and 错) skip the Summon step. One Combined outcome per ghost is recorded once, at the end of the Lay-to-rest step, with the existing scheduler. The work proceeds in eight groups. First the data pipeline: the pinned, hash-verified Unihan file and licence are committed and recorded, `cangjie` enters the record types, merge, serialiser and build, the existing character-dataset tests that this breaks are updated, the README is updated, the pipeline is run, and the loader validates the new field. Second, a data checkpoint. Third, the pure engine modules. Fourth, storage schema version 2 (no migration). Fifth, the UI: the Summon step, the guide, the start menu and the two-step Séance flow. Sixth, the App wiring and the never-reveal test. Seventh, a full-suite checkpoint. Eighth, a manual play-through by a human. Tests are unit and component tests only.

## Tasks

- [x] 1. Data pipeline: Unihan source, `cangjie` field, and updated dataset tests
  - [x] 1.1 Commit the pinned Unihan data file
    - Download `https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip` and verify the zip's SHA-256 equals `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e` BEFORE extracting; stop and report if it differs
    - Extract only `Unihan_DictionaryLikeData.txt` and commit it unmodified as `data/raw/unihan/Unihan_DictionaryLikeData.txt`
    - Compute and report the SHA-256 of the extracted file for task 1.3, and note the file date (expected 2026-07-31)
    - _Requirements: 1.1, 1.2, 1.9_

  - [x] 1.2 Commit the Unicode License V3 text
    - Download the Unicode License V3 text from unicode.org (do not write it from memory) and save it unmodified as `data/raw/unihan/LICENSE`
    - _Requirements: 1.2_

  - [x] 1.3 Record the Unihan source in `data/raw/SOURCES.md`
    - Add a Unihan section stating: Unicode version 18.0.0, file date, download URL, file and field used (`Unihan_DictionaryLikeData.txt`, `kCangjie`), licence Unicode License V3 (SPDX `Unicode-3.0`), licence file path
    - Record both hashes as lines of the form `- **SHA-256 (Unihan.zip):** <64 hex>` and `- **SHA-256 (Unihan_DictionaryLikeData.txt):** <64 hex>` so `readRecordedSha256` can read them
    - _Requirements: 1.1, 1.2, 1.9_

  - [x] 1.4 Implement the shared `app/src/engine/cangjieRules.ts` with unit tests
    - Export `CANGJIE_CODE_PATTERN` (`/^[A-Y]{1,5}$/`), `isValidCangjieCode`, and `isPlayableInCangjie(code: string | null)` (non-null and does not start with `X`); the module imports nothing so `scripts/` can import it by relative path
    - Write `app/src/engine/cangjieRules.test.ts`: valid and invalid codes (empty, six keys, lower case, Z), `HXH` playable, `XRSLN` and `XCTA` not playable, `null` not playable
    - _Requirements: 1.8, 1.10, 1.11, 2.3_

  - [x] 1.5 Extend the shared record and build types in `app/src/data/types.ts`
    - Add `'unihan'` to `DatasetId`; add `cangjie: DatasetId | 'missing'` to `FieldSources`; add `cangjie: string | null` to `CharacterRecord` (after `prompt`)
    - Add `unihanPath` and `unihanSha256` to `BuildOptions`; add `CangjieError` (`character`, `values`, `reason: 'invalid-format' | 'multiple-values'`); extend `BuildResult` with `cangjieMissing` and `notPlayable` on success and `cangjieErrors` on failure
    - _Requirements: 1.3, 1.4, 1.5, 1.8, 1.10_

  - [x] 1.6 Implement `scripts/lib/parse-unihan.ts` with fixtures and unit tests
    - `parseUnihanCangjie(rawText): Map<string, string[]>`: keep only `U+XXXX<TAB>kCangjie<TAB>value` lines, skip `#` lines and other fields, convert the codepoint with `String.fromCodePoint`, collect values per character in source order; no validation and no inference
    - Create fixtures `tests/fixtures/unihan/valid.txt` (lines copied verbatim from the committed Unihan file for characters already used by other fixtures, for example 我, 一, 人, 口, plus comment and other-field lines), `malformed-value.txt`, `duplicate-value.txt`, `missing-character.txt`; the last three are marked synthetic in `tests/fixtures/README.md`, which also records the provenance of `valid.txt`
    - Write `tests/unit/parse-unihan.test.ts`: comments, other fields, duplicate lines, empty input, verbatim values
    - _Requirements: 1.1, 1.3, 1.4, 9.3_

  - [x] 1.7 Implement `scripts/lib/verify-sha256.ts` with unit tests
    - `sha256Hex`, `readRecordedSha256(sourcesMd, label)` (matches `- **SHA-256 (<label>):** <64 hex>`; `null` when absent or malformed), and `verifyFileSha256(path, expected)` throwing `Sha256MismatchError` with `path`, `expected` and `actual`
    - Write `tests/unit/verify-sha256.test.ts`: a matching hash passes; a one-byte change throws; `readRecordedSha256` finds, misses and rejects malformed lines
    - _Requirements: 1.1, 1.9, 9.3_

  - [x] 1.8 Add the `cangjie` argument to `scripts/lib/merge.ts` and update `tests/unit/merge.test.ts`
    - `mergeCharacter(..., prompt, cangjie: string | null)`; `null` never produces a failure; the record gets `cangjie` and `sources.cangjie = cangjie === null ? 'missing' : 'unihan'`
    - Update every call in the unit test; add cases for a code (`'unihan'`) and for `null` (`'missing'`, no failure)
    - _Requirements: 1.3, 1.5, 9.6_

  - [x] 1.9 Update `scripts/lib/serialise.ts` and `tests/unit/serialise.test.ts`
    - Record key order becomes `character, pinyin, meanings, strokeCount, strokeData, decomposition, prompt, cangjie, sources`; `sources` key order becomes `pinyin, meanings, strokeCount, strokeData, decomposition, cangjie`
    - Update the unit test: six `sources` keys, the new record key order, and `cangjie: null` serialised as `null`
    - _Requirements: 1.3, 1.6, 9.6_

  - [x] 1.10 Update `tests/helpers/arbitraries.ts`
    - Add arbitraries for `cangjie` (`null` or a code matching `^[A-Y]{1,5}$`) and `sources.cangjie` (`'unihan'` exactly when `cangjie` is non-null), and include them in the record and `sources` arbitraries
    - _Requirements: 1.3, 9.6_

  - [x] 1.11 Extend `scripts/build-data.ts`
    - Include `unihanPath` in the input-presence check; call `verifyFileSha256` BEFORE reading the file, then `parseUnihanCangjie`
    - Per character (fail-slow, aggregated with the other errors): more than one value gives `CangjieError { reason: 'multiple-values' }`; a value failing `isValidCangjieCode` gives `'invalid-format'`; no value gives `cangjie = null`; any error returns `{ ok: false, errors, cangjieErrors }` and writes no output
    - On success return `cangjieMissing` and `notPlayable` (using `isPlayableInCangjie`)
    - `main()` reads the hash with `readRecordedSha256(..., 'Unihan_DictionaryLikeData.txt')`; a missing hash or a `Sha256MismatchError` goes to stderr with a non-zero exit and no output
    - `main()` success summary states: count with a code (for example "300 of 300"), every character without one (or "none"), the Playable count (298 in the current data), and every character that is not Playable (别 错); on failure it prints each `CangjieError` as `character: values (reason)` to stderr
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.9, 1.10, 1.11_

  - [x] 1.12 Update the existing character-dataset Properties 4 and 10 in `tests/property/character-record-schema.test.ts`
    - Property 4 (schema completeness): records and serialised records have exactly nine keys including `cangjie`, in the new order
    - Property 10 (sources keys): `sources` has exactly six keys, with `cangjie` mapped to `'unihan'` or `'missing'`
    - Update the call to `mergeCharacter` and the file's header comments; add no new property
    - _Requirements: 1.3, 9.6_

  - [x] 1.13 Update the other existing pipeline tests for the Unihan input
    - In `tests/property/record-fields.test.ts`, `output-count.test.ts`, `prompt-same-entry.test.ts`, `pipeline-determinism.test.ts`, `pipeline-errors.test.ts`, `prompt-overrides.test.ts` and `hanzi-writer-parser.test.ts`: `BuildOptions` and `mergeCharacter` calls gain the Unihan inputs (use `tests/fixtures/unihan/valid.txt` and its real hash from `sha256Hex`), and expected records gain `cangjie`
    - Change nothing else in those tests and add no new property
    - _Requirements: 1.3, 1.6, 9.6_

  - [x] 1.14 Update the existing integration and smoke tests
    - `tests/integration/full-pipeline.test.ts`: pass the Unihan input and assert the `cangjie` field and `sources.cangjie` in the output
    - `tests/smoke/dataset-files.test.ts`: assert `data/raw/unihan/Unihan_DictionaryLikeData.txt`, `data/raw/unihan/LICENSE`, and the Unihan section with both recorded hashes in `data/raw/SOURCES.md` exist
    - _Requirements: 1.2, 1.9, 9.6_

  - [x] 1.15 Write unit tests for the build summary and the dataset codes
    - `tests/unit/build-summary.test.ts` (using `tests/fixtures/unihan/` inputs): `cangjieMissing` lists characters without a value; `notPlayable` lists X-prefixed codes; the summary states coverage, characters without a code, the Playable count and the not-Playable list; a malformed value or a duplicate value fails the build and names the character and values; a hash mismatch or a missing recorded hash writes no output
    - `tests/unit/cangjie-dataset.test.ts`: loop over every record of `app/public/data/characters.json` and the committed raw Unihan file: each non-null `cangjie` matches `^[A-Y]{1,5}$` and equals the single raw value; `sources.cangjie` is `"unihan"` exactly when `cangjie` is non-null; 298 characters are Playable and the others are exactly 别 and 错
    - _Requirements: 1.3, 1.4, 1.5, 1.9, 1.10, 9.3_

  - [x] 1.16 Update the README "Data and licences" section
    - List Unihan with version 18.0.0, URL and Unicode License V3; state that `characters.json` also contains data under the Unicode License V3
    - _Requirements: 1.7_

  - [x] 1.17 Run the pipeline and regenerate `characters.json`
    - Run `npm run build:data` from the repository root; it must exit 0
    - Report the coverage line ("N of 300" with a code), the list of characters without a code, the Playable count (expected 298) and the not-Playable list (expected 别 错); stop and report if any differ
    - Do not edit `app/public/data/characters.json` by hand; the script is the only writer
    - _Requirements: 1.3, 1.5, 1.6, 1.10_

  - [x] 1.18 Validate `cangjie` in `app/src/data/charDataLoader.ts` and update the loader tests
    - In `isCharacterRecord`, accept `cangjie` only when it is `null` or a string passing `isValidCangjieCode`; a failing record returns `{ ok: false, reason: 'invalid-shape' }`
    - Update `app/src/data/charDataLoader.test.ts`: record fixtures gain `cangjie` and `sources.cangjie`; add cases for `null`, a valid code, a lower-case code, a six-key code, a non-string value and a missing field
    - Update `app/src/data/charDataLoader.hanziwriter.integration.test.ts` so its records carry `cangjie`
    - _Requirements: 1.8, 9.6_

  - [x] 1.19 Add `cangjie` to the remaining app test fixtures
    - Find every other app test fixture that builds a `CharacterRecord` or a dataset served to the loader (start with `app/src/App.test.tsx`, `app/src/components/GhostPrompt.test.tsx`, `app/src/components/SeanceSession.test.tsx`, `app/src/modes/WriteMode.test.tsx`; confirm the full list with `tsc` in `app/`) and add `cangjie: null` or a valid code and `sources.cangjie`
    - Change nothing else in those tests
    - _Requirements: 1.3, 1.8, 9.6_

- [x] 2. Checkpoint - Data layer
  - Run `npm test` from the repository root; all character-dataset tests and all existing app tests must pass before group 3 starts.
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 9.6_

- [ ] 3. Pure engine modules
  - [ ] 3.1 Implement `app/src/engine/outcome.ts` and move `resolveCompletion` into it
    - Create `outcome.ts` with `resolveCompletion(hintShown, mistakes, config)` (`clean` iff no hint and `mistakes <= config.cleanMistakeThreshold`, else `struggled`) and `combineOutcomes(summon: Outcome | null, write: Outcome): Outcome` (any `gave-up` wins, then any `struggled`, else `clean`)
    - In `app/src/modes/WriteMode.tsx` import `resolveCompletion` and re-export it (`export { resolveCompletion } from '../engine/outcome'`) so existing imports and `WriteMode.test.tsx` stay green
    - Write `app/src/engine/outcome.test.ts`: `resolveCompletion` threshold boundary and hint forcing `struggled`; the full `combineOutcomes` truth table (12 cells including the `null` row)
    - _Requirements: 3.8, 4.1, 4.2, 4.3, 4.4, 4.9_

  - [ ] 3.2 Implement `app/src/engine/mask.ts` and move `maskTarget` into it
    - Create `mask.ts` with `maskTarget(text, char)` replacing every occurrence of `char` with "～" (U+FF5E); move the body unchanged from `GhostPrompt.tsx`
    - In `app/src/components/GhostPrompt.tsx` import and re-export it so `GhostPrompt.test.tsx` keeps passing
    - Write `app/src/engine/mask.test.ts`: no occurrence, several occurrences, empty text, surrogate-pair characters
    - _Requirements: 5.2_

  - [ ] 3.3 Implement the key table and key-event parsing in `app/src/engine/cangjie.ts` with unit tests
    - Export `CangjieKey`, `CangjieKeyInfo`, `CANGJIE_KEYS` (25 entries A–Y, X → 難), `KEY_FACE_CHARACTERS`, `KeyEventLike` and `parseKeyEvent`
    - `parseKeyEvent` returns the upper-case letter for a single letter A–Y in either case with no Ctrl, Alt, Meta, repeat or composition and `key !== 'Process'`; otherwise `null` (Z included)
    - Write `app/src/engine/cangjie.keys.test.ts`: 25 entries, each shape, X → 難, no Z, `KEY_FACE_CHARACTERS` contains 一 中 人 十 口 大 女 山 手 日 月 木 水 火 and 難, `parseKeyEvent` examples for each ignore rule
    - _Requirements: 3.2, 3.4, 5.3, 9.3_

  - [ ] 3.4 Implement the Summon reducer in `app/src/engine/cangjie.ts` with unit tests
    - Add `SummonStatus`, `SummonState`, `startSummon`, `nextExpectedKey`, `isKeyHintVisible`, `applyKeyEntry`, `applyKeyEvent` and `giveUpSummon` exactly as in the design: a non-`active` state is returned unchanged; a correct key advances and resets `missesOnSlot`; the last slot sets `status` with `resolveCompletion(hintShown, mistakes, config)`; a wrong key adds one mistake and one miss and sets `hintShown` (sticky) at the configured count; `applyKeyEvent` returns the same `state` object when the event is ignored
    - Write `app/src/engine/cangjie.summon.test.ts` using real codes (for example `HQI`, `R`, `HXH`): full entry gives `clean`; wrong key adds one mistake and leaves slots unchanged; the Key hint appears after 3 consecutive wrong keys for the same slot and is not visible after 2; the hint disappears when the slot is filled but still gives `struggled`; mistakes above the threshold give `struggled`; Give up gives `gave-up` and shows no further change; entries after the Step result change nothing; Z and a modified key are ignored
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.12, 9.3_

- [ ] 4. Storage schema version 2
  - [ ] 4.1 Implement schema 2 in `app/src/storage/storage.ts`
    - Raise `CURRENT_SCHEMA_VERSION` to 2; `PersistedState` gains `cangjieIntroSeen`; `SHIPPED_MIGRATIONS` stays empty so a version-1 blob resets to defaults
    - Extend `validateState` (boolean `cangjieIntroSeen`); `saveState`, `recordOutcome` and `setIntroSeen` preserve it; add `getCangjieIntroSeen` and `setCangjieIntroSeen` to `Store` and as module-level wrappers; keep `recordOutcome(char, entry)` and every reset rule and the in-memory fallback unchanged
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 4.2 Update the existing storage tests in `app/src/storage/storage.test.ts`
    - Schema version 2 and the new default state; `cangjieIntroSeen` round trip through `setCangjieIntroSeen` and `getCangjieIntroSeen`; `recordOutcome` and `setIntroSeen` keep it; a version-1 blob resets to defaults (no migration); corrupt, newer and forbidden-key blobs still reset; storage unavailable still works in memory
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.6_

- [ ] 5. UI: Summon step, guide, start menu, two-step Séance
  - [ ] 5.1 Implement `app/src/modes/SummonStep.tsx`
    - Props `{ record, dataset, config, onDone }`; export the named constants `SUMMON_HOLD_MS` (1500, the 1.5 s hold) and `SUMMON_FADE_MS` (1500, the 1.5 s fade), the only source of the timings; Code slots (one per key, accessible name "Slot N, empty", filled shows letter and shape with `lang="zh"`, shapes passed through `maskTarget` before the step ends); `window` `keydown` listener using `applyKeyEvent` that skips editable targets and calls `preventDefault` only for accepted entries; 25 on-screen buttons in QWERTY rows without Z (at least 44 px, `aria-label` "Key A", letters only when `KEY_FACE_CHARACTERS.has(record.character)`, disabled once the step ends)
    - `role="status"` `aria-live="polite"` feedback with text and a symbol plus the mistake count; the automatic Key hint outline and "Hint: press X" text with no hint control; the IME note; the source note "Codes: Unicode Unihan kCangjie"; a "Give up" button
    - No hanzi-writer instance before the step ends; then `animateCharacter()` forms the character, the component holds `SUMMON_HOLD_MS`, fades over `SUMMON_FADE_MS` (no transition under `prefers-reduced-motion`), empties the container and calls `onDone(status)` once; a hanzi-writer failure falls back to the character as plain text for the same hold and fade; timers are cleared on unmount
    - _Requirements: 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.13, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 5.2 Write component tests `app/src/modes/SummonStep.test.tsx` (hanzi-writer mocked, fake timers)
    - Slot count equals code length; physical keys fill slots; on-screen keys fill slots; a wrong key adds one mistake and leaves slots unchanged; Z, a modified key and a composing event are ignored; the editable-target skip; the Key hint appears after 3 consecutive wrong keys for the same slot with no hint control, and disappears when the slot is filled
    - Clean and struggled Step results; Give up shows the full code and gives `gave-up`; the character forms (writer created only after the step ends), is held 1.5 s (`SUMMON_HOLD_MS`), fades over 1.5 s (`SUMMON_FADE_MS`) and is removed before `onDone` is called exactly once; later keys are ignored; a hanzi-writer failure shows the plain-text fallback and still calls `onDone`
    - IME note and source note visible; letters-only keyboard for a key-face target (for example 口) and shapes shown otherwise (for example 我); the target is absent from DOM text and attributes before completion
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.13, 5.1, 5.3, 9.4_

  - [ ] 5.3 Implement `app/src/components/CangjieGuide.tsx`
    - Props `{ dataset, onContinue }`; export `pickGuideExample(dataset)` (first character in `learningOrder(dataset)` that is Playable and has a code of at least 2 keys, code read from `record.cangjie`, `null` when none)
    - Show the 25 keys from `CANGJIE_KEYS` (X as 難, explained), that a code is one to five keys typed in order, that each key stands for a family of related shapes of which only the base shape is shown, the example (omitted when `null`), "developed in the 1970s" by Chu Bong-Foo plus exactly the three other whitelisted claims, the statement that the codes follow the Unicode Unihan `kCangjie` field which Unihan marks provisional so some typists know different codes for some characters, and a visible citation giving each title and URL as text ("Cangjie input method" `https://en.wikipedia.org/wiki/Cangjie_input_method`, "Chu Bong-Foo" `https://en.wikipedia.org/wiki/Chu_Bong-Foo`)
    - A "Continue" button with an accessible label; shapes carry `lang="zh"`
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ] 5.4 Write component tests `app/src/components/CangjieGuide.test.tsx`
    - 25 keys with X as 難; the claim "developed in the 1970s" and the three other whitelisted claims only (no other year, statistic or "dying" wording); the Unihan source statement including "provisional"; both citations with titles and URLs as text; the example code equals the dataset record's `cangjie`; `pickGuideExample` picks the first eligible, skips single-key and X-prefixed codes, returns `null` when none; Continue calls `onContinue`
    - _Requirements: 6.4, 6.5, 6.6, 6.7, 6.8, 9.4_

  - [ ] 5.5 Update `app/src/components/StartMenu.tsx`
    - Props `{ onStartSeance, onReviewLegend, onReviewCangjieGuide }`; three buttons, each at least 44 px high with the existing focus ring: "Begin a Nightly Séance", "Read the legend again", "How Cangjie works"
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 5.6 Update the StartMenu tests in `app/src/components/StartMenu.test.tsx`
    - Three buttons with accessible names; each calls its callback; no mode choice is present
    - _Requirements: 7.1, 7.2, 9.4_

  - [ ] 5.7 Implement the two-step ghost flow in `app/src/components/SeanceSession.tsx`
    - Props unchanged; per-ghost `step` state (`summon` when `isPlayableInCangjie(record.cangjie)`, else `write`), reset in `handleAdvance`; `summonResultRef` cleared per ghost; a text label for the active step; render `SummonStep` (with `key={record.character}`) and then `WriteMode`
    - `handleSummonDone` stores the Step result and switches to `write`; `handleWriteOutcome` calls `combineOutcomes(summonResultRef.current, writeResult)` and passes it to the existing guarded `handleOutcome`, so `onOutcome(char, combined, Date.now())` fires once; nothing is reported at the end of the Summon step; "Next ghost" appears only after the Lay-to-rest step ends
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 2.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 5.5, 5.6, 5.7_

  - [ ] 5.8 Update the Séance tests in `app/src/components/SeanceSession.test.tsx` (hanzi-writer mocked, fake timers)
    - A Playable ghost runs summon, then write, then one `onOutcome` call with the combined Outcome (cases: clean and clean; summon struggled; write struggled; summon Give up still proceeds to writing and records `gave-up`; write Give up); nothing is recorded at the end of the Summon step
    - 别 and 错 skip the Summon step and go straight to writing, and 身 has a Summon step; the step label changes between "Step 1 of 2: Summon" and "Step 2 of 2: Lay to rest" ("Lay to rest" alone for 别 and 错); the target character is absent from the DOM text and attributes from the end of the fade until the Lay-to-rest step ends; "Next ghost" appears only after the Lay-to-rest step; the last ghost leads to the summary
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.9, 4.1, 4.2, 4.3, 4.4, 4.5, 5.5, 9.4_

- [ ] 6. App wiring and never-reveal test
  - [ ] 6.1 Wire the guide and the menu in `app/src/App.tsx`
    - Add the `cangjie-guide` view (`origin: 'before-seance' | 'review'`); add `beginSeance(dataset)` (guide first when `getCangjieIntroSeen()` is false, else `startSeance`); the intro's `onBegin` calls `setIntroSeen(true)` then `beginSeance`; the menu's `onStartSeance` and the summary's `onPlayAgain` call `beginSeance`; the menu's `onReviewCangjieGuide` shows the guide with `origin: 'review'`
    - The guide's `onContinue` calls `setCangjieIntroSeen(true)`, then starts the Séance (`before-seance`) or returns to the menu (`review`); `buildSession` and `handleOutcome` stay unchanged
    - _Requirements: 2.8, 6.1, 6.2, 6.3, 7.2, 7.4_

  - [ ] 6.2 Update the App tests in `app/src/App.test.tsx`
    - First visit: intro, then the guide, then a Séance; returning visit with the guide seen: menu, and "Begin a Nightly Séance" starts a Séance directly; returning visit with the guide unseen: the guide first; "How Cangjie works" shows the guide and Continue returns to the menu; one Combined outcome per ghost reaches the saved history once; a version-1 saved blob resets to the legend intro and an empty history
    - _Requirements: 6.1, 6.2, 6.3, 7.2, 7.4, 8.3, 9.4_

  - [ ] 6.3 Write the never-reveal component test `app/src/modes/SummonStep.neverReveal.test.tsx` (hanzi-writer mocked)
    - Read `app/public/data/characters.json`; for every Playable ghost render `GhostPrompt` and `SummonStep` in the unresolved state, and again after three wrong keys for the first slot (Key hint visible), and assert the target character appears nowhere in the DOM text, any attribute (including `aria-label`), or `document.title`
    - _Requirements: 3.7, 5.1, 5.2, 5.3, 9.5_

- [ ] 7. Final checkpoint - Whole project
  - Run `npm test` from the repository root (all tests pass), `tsc --noEmit` for the root project and for `app/` (no errors), a search that finds no `any` in the new code, and `npm run build -w app` (builds without errors).
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 9.1, 9.6_

- [ ] 8. Manual check by a human (non-coding)
  - [ ] 8.1 Human play-through of two full Séances
    - This task is NON-CODING and is performed by a human, not by Kiro. Kiro runs nothing for it and does not write its `kiro-log.md` entry.
    - Play one full Séance with a physical keyboard and one with touch or mouse (on-screen keyboard). Check: "How Cangjie works" appears on first start; the Code slots show the code length; the automatic Key hint appears after 3 wrong keys; the character forms in ink and then fades before writing starts; writing from memory works; the results `clean`, `struggled` and `gave-up` each come out as expected; a 别 or 错 ghost skips the summon step if one comes up; the summary is correct; and progress persists across a reload.
    - _Requirements: 2.1, 2.3, 2.4, 3.1, 3.7, 4.5, 6.1, 8.1_

## Notes

- There are no optional tasks; nothing is marked with `*`.
- No new property-based tests are added and no mutation testing is run (approved by Takshil). Existing property tests are updated only where the record shape or pipeline inputs change (tasks 1.12 and 1.13).
- The ghost-game-core and character-dataset tasks are not reopened. Their spec documents have been amended already (see "Amendments to other specs" in `requirements.md`).
- The last task (8.1) is performed by a human and is not logged by Kiro.
- Never write personal names in repo files; refer to "the human". Do not add `.kiro/` to `.gitignore`.
- Generated files (`app/public/data/characters.json`) are produced only by `scripts/`.
- Tests that read the real `characters.json` need task 1.17 done first; app fixtures need task 1.19.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4", "1.5", "1.7"] },
    { "id": 1, "tasks": ["1.3", "1.6", "1.8", "1.9", "1.10"] },
    { "id": 2, "tasks": ["1.11", "1.12", "1.16"] },
    { "id": 3, "tasks": ["1.13", "1.14", "1.15", "1.17"] },
    { "id": 4, "tasks": ["1.18"] },
    { "id": 5, "tasks": ["1.19"] },
    { "id": 6, "tasks": ["3.1", "3.2", "3.3", "4.1"] },
    { "id": 7, "tasks": ["3.4", "4.2"] },
    { "id": 8, "tasks": ["5.1", "5.3", "5.5"] },
    { "id": 9, "tasks": ["5.2", "5.4", "5.6", "5.7", "6.3"] },
    { "id": 10, "tasks": ["5.8", "6.1"] },
    { "id": 11, "tasks": ["6.2"] },
    { "id": 12, "tasks": ["8.1"] }
  ]
}
```
