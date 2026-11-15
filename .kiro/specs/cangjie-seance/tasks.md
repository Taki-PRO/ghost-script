# Implementation Plan: cangjie-seance

## Overview

Add Cangjie Séance to Ghost Script: a second way to lay a ghost to rest by typing its Cangjie code, plus a one-time "How Cangjie works" screen, a Write-mode "Reveal its shape" structure hint, a stricter never-reveal-the-target rule, and per-mode saved progress. Work proceeds in seven groups. First the data pipeline: the pinned, hash-verified Unihan file and licence are committed and recorded, `cangjie` enters the record types, loader, merge, serialiser and build, the existing character-dataset tests that this breaks are updated, the README is updated, and the pipeline is run to regenerate `characters.json`. Second, the pure engine modules (`outcome.ts`, `mask.ts`, `cangjie.ts`, `structureLayout.ts`). Third, storage schema version 2 with the shipped 1→2 migration. Fourth, the UI components and modes. Fifth, the App wiring and the cross-mode masking test. Sixth, a full-suite checkpoint. Seventh, a manual play-through by a human. Each property test sits right after the code it tests, and every design Correctness Property (1–20) has exactly one test sub-task.

## Tasks

- [ ] 1. Data pipeline: Unihan source, `cangjie` field, and updated dataset tests
  - [ ] 1.1 Commit the pinned Unihan data file
    - Download `https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip` and verify the zip's SHA-256 equals `4c93ea9c1f636451729a840978f1667a53886af37ba854fdcce109721c63d43e` BEFORE extracting; stop and report if it differs
    - Extract only `Unihan_DictionaryLikeData.txt` and commit it unmodified as `data/raw/unihan/Unihan_DictionaryLikeData.txt`
    - Compute and keep the SHA-256 of the extracted file for task 1.3; note the file date (expected 2026-07-31)
    - _Requirements: 1.1, 1.2, 1.10_

  - [ ] 1.2 Commit the Unicode License V3 text
    - Download the Unicode License V3 text from unicode.org (do not write it from memory) and save it unmodified as `data/raw/unihan/LICENSE`
    - _Requirements: 1.2_

  - [ ] 1.3 Record the Unihan source in `data/raw/SOURCES.md`
    - Add a Unihan section stating: Unicode version 18.0.0, file date, download URL, file and field used (`Unihan_DictionaryLikeData.txt`, `kCangjie`), licence Unicode License V3 (SPDX `Unicode-3.0`)
    - Record both hashes as lines of the form `- **SHA-256 (Unihan.zip):** <64 hex>` and `- **SHA-256 (Unihan_DictionaryLikeData.txt):** <64 hex>` so `readRecordedSha256` can read them
    - _Requirements: 1.1, 1.2, 1.10_

  - [ ] 1.4 Implement the shared `app/src/engine/cangjieRules.ts` with unit tests
    - Export `CANGJIE_CODE_PATTERN` (`/^[A-Y]{1,5}$/`), `isValidCangjieCode`, and `isPlayableInCangjie(code: string | null)` (non-null and does not start with `X`); the module imports nothing so `scripts/` can import it by relative path
    - Write `app/src/engine/cangjieRules.test.ts`: valid and invalid codes (empty, six keys, lower case, Z), `HXH` playable, `XRSLN` and `XCTA` not playable, `null` not playable
    - _Requirements: 1.8, 1.11, 4.2_

  - [ ] 1.5 Extend the shared record types in `app/src/data/types.ts`
    - Add `'unihan'` to `DatasetId`; add `cangjie: DatasetId | 'missing'` to `FieldSources`; add `cangjie: string | null` to `CharacterRecord` (after `prompt`)
    - _Requirements: 1.3, 1.8_

  - [ ] 1.6 Validate `cangjie` in `app/src/data/charDataLoader.ts`
    - In `isCharacterRecord`, accept `cangjie` only when it is `null` or a string passing `isValidCangjieCode`; a failing record returns `{ ok: false, reason: 'invalid-shape' }`
    - _Requirements: 1.8_

  - [ ] 1.7 Update the existing loader tests
    - Update `app/src/data/charDataLoader.test.ts`: record fixtures gain `cangjie`; add cases for `null`, a valid code, a lower-case code, a six-key code, a non-string value, and a missing field
    - Update `app/src/data/charDataLoader.hanziwriter.integration.test.ts` so its records carry `cangjie` (it reads the regenerated `characters.json` after task 1.26)
    - _Requirements: 1.8, 9.3_

  - [ ] 1.8 Write property test for the loader `app/src/data/charDataLoader.cangjie.property.test.ts`
    - `// Feature: cangjie-seance, Property 14: The loader accepts exactly null or well-formed codes`
    - fast-check, ≥100 runs; for any otherwise-valid record with generated `cangjie` value `v`, `loadDataset` accepts exactly when `v` is `null` or matches `^[A-Y]{1,5}$`
    - **Validates: Requirements 1.8**
    - _Requirements: 1.8, 9.2_

  - [ ] 1.9 Add `cangjie` to existing app test fixtures
    - Find every app test fixture that builds a `CharacterRecord` or a dataset served to the loader (start with `app/src/App.test.tsx`, `app/src/components/GhostPrompt.test.tsx`, `app/src/components/SeanceSession.test.tsx`, `app/src/components/SessionSummary.test.tsx`, `app/src/modes/WriteMode.test.tsx`; confirm the list with `tsc` in `app/`) and add `cangjie: null` or a valid code and `sources.cangjie`
    - Change nothing else in those tests
    - _Requirements: 1.3, 1.8, 9.3_

  - [ ] 1.10 Implement `scripts/lib/parse-unihan.ts` with fixtures and unit tests
    - `parseUnihanCangjie(rawText): Map<string, string[]>`: keep only `U+XXXX<TAB>kCangjie<TAB>value` lines, skip `#` lines and other fields, convert the codepoint with `String.fromCodePoint`, collect values per character in source order; no validation and no inference
    - Create fixtures `tests/fixtures/unihan/valid.txt`, `malformed-value.txt`, `duplicate-value.txt`, `missing-character.txt`
    - Write `tests/unit/parse-unihan.test.ts`: comments, other fields, duplicate lines, empty input
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ] 1.11 Write property test for Unihan parsing `tests/property/cangjie-parse-roundtrip.test.ts`
    - `// Feature: cangjie-seance, Property 9: Unihan parsing round trip`
    - fast-check, ≥100 runs; format a generated map as Unihan lines with interleaved comment lines and other-field lines, parse it, and assert the same map comes back
    - **Validates: Requirements 1.1, 1.3, 1.4**
    - _Requirements: 1.1, 1.3, 1.4, 9.2_

  - [ ] 1.12 Implement `scripts/lib/verify-sha256.ts` with unit tests
    - `sha256Hex`, `readRecordedSha256(sourcesMd, label)` (matches `- **SHA-256 (<label>):** <64 hex>`; `null` when absent or malformed), `verifyFileSha256(path, expected)` throwing `Sha256MismatchError` with `path`, `expected`, `actual`
    - Write `tests/unit/verify-sha256.test.ts`: matching hash passes; a one-byte change throws; `readRecordedSha256` finds, misses, and rejects malformed lines
    - _Requirements: 1.1, 1.10_

  - [ ] 1.13 Add the `cangjie` argument to `scripts/lib/merge.ts`
    - `mergeCharacter(..., prompt, cangjie: string | null)`; `null` never produces a failure; the record gets `cangjie` and `sources.cangjie = cangjie === null ? 'missing' : 'unihan'`
    - _Requirements: 1.3, 1.5_

  - [ ] 1.14 Update `tests/unit/merge.test.ts`
    - Add the new argument to every call; add cases for a code (`sources.cangjie === 'unihan'`) and for `null` (`'missing'`, no failure)
    - _Requirements: 1.3, 1.5, 9.3_

  - [ ] 1.15 Update `scripts/lib/serialise.ts`
    - Record key order becomes `character, pinyin, meanings, strokeCount, strokeData, decomposition, prompt, cangjie, sources`; `sources` key order becomes `pinyin, meanings, strokeCount, strokeData, decomposition, cangjie`
    - _Requirements: 1.3, 1.6_

  - [ ] 1.16 Update `tests/unit/serialise.test.ts`
    - Six `sources` keys, the new record key order, and `cangjie: null` serialised as `null`
    - _Requirements: 1.3, 1.6, 9.3_

  - [ ] 1.17 Update `tests/helpers/arbitraries.ts`
    - Add arbitraries for `cangjie` (`null` or a code matching `^[A-Y]{1,5}$`) and `sources.cangjie`, and include them in the record and `sources` arbitraries
    - _Requirements: 1.3, 9.3_

  - [ ] 1.18 Extend `scripts/build-data.ts`
    - `BuildOptions` gains `unihanPath` and `unihanSha256`; `buildDataset` includes `unihanPath` in the input-presence check, calls `verifyFileSha256` BEFORE reading the file, then `parseUnihanCangjie`
    - Per character (fail-slow, aggregated with other errors): more than one value gives `CangjieError { reason: 'multiple-values' }`; a value failing `isValidCangjieCode` gives `'invalid-format'`; no value gives `cangjie = null`; any error returns `{ ok: false, errors, cangjieErrors }` and writes no output
    - On success return `cangjieMissing` and `notPlayable` (using `isPlayableInCangjie`); `main()` reads the hash with `readRecordedSha256(..., 'Unihan_DictionaryLikeData.txt')`, and a missing hash or a `Sha256MismatchError` goes to stderr with a non-zero exit and no output
    - `main()` success summary states: count with a code (for example "300 of 300"), every character without one (or "none"), the Playable count (298 in the current data), and every character that is not Playable (别 错); on failure it prints each `CangjieError` as `character: values (reason)` to stderr
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.10, 1.11_

  - [ ] 1.19 Update the existing character-dataset Properties 4 and 10 in `tests/property/character-record-schema.test.ts`
    - Property 4 (schema completeness): records and serialised records have exactly nine keys including `cangjie`, in the new order
    - Property 10 (sources keys): `sources` has exactly six keys, with `cangjie` mapped to `'unihan'` or `'missing'`
    - Update the file's header comments to match
    - _Requirements: 1.3, 9.3_

  - [ ] 1.20 Update the other existing pipeline property tests
    - In `tests/property/record-fields.test.ts`, `tests/property/output-count.test.ts`, `tests/property/prompt-same-entry.test.ts`, `tests/property/pipeline-determinism.test.ts`, `tests/property/pipeline-errors.test.ts`, and `tests/property/hanzi-writer-parser.test.ts`: fixtures and `BuildOptions` gain `unihanPath` and `unihanSha256` (use `tests/fixtures/unihan/` files and their real hash), and expected records gain `cangjie`
    - _Requirements: 1.3, 1.6, 9.3_

  - [ ] 1.21 Update the existing integration and smoke tests
    - `tests/integration/full-pipeline.test.ts`: pass the Unihan input and assert the `cangjie` field and `sources.cangjie` in the output
    - `tests/smoke/dataset-files.test.ts`: assert `data/raw/unihan/Unihan_DictionaryLikeData.txt`, `data/raw/unihan/LICENSE`, and the Unihan section with both recorded hashes in `data/raw/SOURCES.md` exist
    - _Requirements: 1.2, 1.10, 9.3_

  - [ ] 1.22 Write unit tests for the build result and summary `tests/unit/build-summary.test.ts`
    - Using `tests/fixtures/unihan/` inputs: `cangjieMissing` lists characters without a value; `notPlayable` lists X-prefixed codes; the summary text states coverage, characters without a code, the Playable count, and the not-Playable list; a hash mismatch or missing recorded hash writes no output
    - _Requirements: 1.5, 1.10, 1.11_

  - [ ] 1.23 Write property test for build determinism `tests/property/cangjie-determinism.test.ts`
    - `// Feature: cangjie-seance, Property 12: Build determinism with Unihan input`
    - fast-check, ≥100 runs; for valid generated inputs including a Unihan file, two `buildDataset` runs give byte-identical output
    - **Validates: Requirements 1.6**
    - _Requirements: 1.6, 9.2_

  - [ ] 1.24 Write property test for invalid and duplicate values `tests/property/cangjie-errors.test.ts`
    - `// Feature: cangjie-seance, Property 13: Invalid or duplicate Unihan values fail the build`
    - fast-check, ≥100 runs; for any set of characters with malformed or duplicated values, `buildDataset` fails, lists every such character with its values and reason, and produces no output; a character with no value still builds with `cangjie: null`
    - **Validates: Requirements 1.4, 1.5**
    - _Requirements: 1.4, 1.5, 9.2_

  - [ ] 1.25 Update the README "Data and licences" section
    - List Unihan with version 18.0.0, URL, and Unicode License V3; state that `characters.json` also contains data under the Unicode License V3
    - _Requirements: 1.7_

  - [ ] 1.26 Run the pipeline and regenerate `characters.json`
    - Run `npm run build:data` from the repository root; it must exit 0
    - Report the coverage line ("N of 300" with a code), the list of characters without a code, the Playable count (expected 298) and the not-Playable list (expected 别 错); stop and report if any differ
    - Do not edit `app/public/data/characters.json` by hand; the script is the only writer
    - _Requirements: 1.3, 1.5, 1.6, 1.11_

  - [ ] 1.27 Write property test for well-formed codes and sources `tests/property/cangjie-record-wellformed.test.ts`
    - `// Feature: cangjie-seance, Property 10: Every non-null code is well-formed, and sources.cangjie is unihan exactly when the code is non-null`
    - fast-check, ≥100 runs over built records, plus the same check over every record in `app/public/data/characters.json`
    - **Validates: Requirements 1.3, 1.9**
    - _Requirements: 1.3, 1.9, 9.2_

  - [ ] 1.28 Write property test for raw Unihan equality `tests/property/cangjie-matches-raw.test.ts`
    - `// Feature: cangjie-seance, Property 11: Every non-null code equals the raw Unihan value`
    - fast-check, ≥100 runs sampling characters of `app/public/data/characters.json`; each non-null `cangjie` equals the single `kCangjie` value in the committed `data/raw/unihan/Unihan_DictionaryLikeData.txt`, and each `null` has no raw value
    - **Validates: Requirements 1.3, 1.9**
    - _Requirements: 1.3, 1.9, 9.2_

  - [ ] 1.29 Checkpoint: data tests and app tests pass
    - Run `npm test` from the repository root; the 129+ character-dataset tests and all app tests must pass before group 3 starts
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 9.3_

- [ ] 2. Pure engine modules
  - [ ] 2.1 Move `resolveCompletion` to `app/src/engine/outcome.ts` with unit tests
    - Create `outcome.ts` with `resolveCompletion(anyHintUsed, mistakes, config)`: `clean` iff no hint and `mistakes <= config.cleanMistakeThreshold`, else `struggled`
    - In `app/src/modes/WriteMode.tsx` import it and re-export it (`export { resolveCompletion } from '../engine/outcome'`) so existing imports and `WriteMode.test.tsx` stay green
    - Write `app/src/engine/outcome.test.ts`: threshold boundary, hint forces `struggled`
    - _Requirements: 5.8, 6.4, 9.2_

  - [ ] 2.2 Move `maskTarget` to `app/src/engine/mask.ts` with unit tests
    - Create `mask.ts` with `maskTarget(text, char)` replacing every occurrence of `char` with "～" (U+FF5E); move the body unchanged from `GhostPrompt.tsx`
    - In `app/src/components/GhostPrompt.tsx` import and re-export it so `GhostPrompt.test.tsx` keeps passing
    - Write `app/src/engine/mask.test.ts`: no occurrence, several occurrences, empty text, surrogate-pair characters
    - _Requirements: 7.1, 7.2_

  - [ ] 2.3 Write property test for masking `app/src/engine/mask.property.test.ts`
    - `// Feature: cangjie-seance, Property 8: Masked display strings never contain the target`
    - fast-check, ≥100 runs over Unicode strings and targets; output contains no `target`, each occurrence became "～", every other codepoint is unchanged
    - **Validates: Requirements 7.1, 7.2, 9.2**
    - _Requirements: 7.1, 7.2, 9.2_

  - [ ] 2.4 Write property test for playability `app/src/engine/cangjieRules.property.test.ts`
    - `// Feature: cangjie-seance, Property 17: isPlayableInCangjie excludes exactly the null and X-prefixed codes`
    - fast-check, ≥100 runs over string codes and `null`; plus an assertion over `app/public/data/characters.json` that the non-Playable characters are exactly 别 and 错 and 298 are Playable
    - **Validates: Requirements 1.11, 4.2**
    - _Requirements: 1.11, 4.2, 9.2_

  - [ ] 2.5 Implement the key table and key-event parsing in `app/src/engine/cangjie.ts` with unit tests
    - Export `CangjieKey`, `CangjieKeyInfo`, `CANGJIE_KEYS` (25 entries A–Y, X → 難), `KEY_FACE_CHARACTERS`, `isPlayableInCangjie` (re-export from `cangjieRules`), `KeyEventLike`, and `parseKeyEvent`
    - `parseKeyEvent` returns the upper-case letter for a single letter A–Y in either case with no Ctrl, Alt, Meta, repeat, or composition and `key !== 'Process'`; otherwise `null` (Z included)
    - Write `app/src/engine/cangjie.keys.test.ts`: 25 entries, each shape, X → 難, no Z, `KEY_FACE_CHARACTERS` contains 一 中 人 十 口 大 女 山 手 日 月 木 水 火 and 難, `parseKeyEvent` examples
    - _Requirements: 5.2, 5.4, 7.3, 9.2_

  - [ ] 2.6 Write property test for key-event parsing `app/src/engine/cangjie.parseKeyEvent.property.test.ts`
    - `// Feature: cangjie-seance, Property 19: parseKeyEvent accepts exactly single unmodified A–Y letters`
    - fast-check, ≥100 runs over generated key events (letters, Z, multi-character names, modifiers, repeat, composition); the result is the upper-case letter exactly when all accept conditions hold, else `null`
    - **Validates: Requirements 5.2**
    - _Requirements: 5.2, 9.2_

  - [ ] 2.7 Implement the Cangjie reducer in `app/src/engine/cangjie.ts` with unit tests
    - Add `CangjieStatus`, `CangjieState`, `startCangjie`, `nextExpectedKey`, `isKeyHintVisible`, `applyKeyEntry`, `applyKeyEvent`, `giveUp` exactly as in the design: resolved state returns itself; a correct key advances and resets `missesOnSlot`; the last slot sets status with `resolveCompletion(hintShown, mistakes, config)`; a wrong key adds one mistake and one miss and sets `hintShown` sticky at the configured count; `applyKeyEvent` returns the same `state` object when the event is ignored
    - Write `app/src/engine/cangjie.reducer.test.ts` using inline codes: full entry, wrong key, hint after 3 misses for the same slot, hint disappears when the slot is filled but still forces `struggled`, `gave-up`, ignored Z
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 5.10, 5.12_

  - [ ] 2.8 Write property test for completion `app/src/engine/cangjie.complete.property.test.ts`
    - `// Feature: cangjie-seance, Property 1: Entering the code completes the ghost, and nothing shorter does`
    - fast-check, ≥100 runs; applying the keys of a generated code in order fills every slot with a non-`active` status, and any proper prefix leaves `active` with `filled` equal to the prefix length
    - **Validates: Requirements 5.5, 5.8, 9.2**
    - _Requirements: 5.5, 5.8, 9.2_

  - [ ] 2.9 Write property test for mistake counting `app/src/engine/cangjie.mistakes.property.test.ts`
    - `// Feature: cangjie-seance, Property 2: Mistake count equals the number of wrong key entries`
    - fast-check, ≥100 runs; over any key sequence A–Y applied until resolution, `mistakes` equals the number of entries that differed from the next expected key at entry time
    - **Validates: Requirements 5.6, 9.2**
    - _Requirements: 5.6, 9.2_

  - [ ] 2.10 Write property test for the Key hint `app/src/engine/cangjie.keyHint.property.test.ts`
    - `// Feature: cangjie-seance, Property 3: The Key hint appears exactly after the configured consecutive misses, and resets on a filled slot`
    - fast-check, ≥100 runs over codes, configs with small thresholds, and entry sequences; `isKeyHintVisible` is true exactly when the current slot has at least the configured consecutive wrong entries; `missesOnSlot` is 0 right after a slot is filled
    - **Validates: Requirements 5.7, 5.11, 9.2**
    - _Requirements: 5.7, 5.11, 9.2_

  - [ ] 2.11 Write property test for Outcome classification `app/src/engine/cangjie.outcome.property.test.ts`
    - `// Feature: cangjie-seance, Property 4: Cangjie Outcome classification matches the shared rule`
    - fast-check, ≥100 runs; for sequences that fill every slot the final status equals `resolveCompletion(hintShown, mistakes, config)`; and for any `anyHintUsed = true`, `mistakes`, and config, `resolveCompletion` returns `struggled`
    - **Validates: Requirements 5.8, 6.4, 9.2**
    - _Requirements: 5.8, 6.4, 9.2_

  - [ ] 2.12 Write property test for post-resolution immutability `app/src/engine/cangjie.resolved.property.test.ts`
    - `// Feature: cangjie-seance, Property 5: Nothing changes after resolution`
    - fast-check, ≥100 runs; for any resolved state (`clean`, `struggled`, `gave-up`) and any key entry, key event, or `giveUp`, the returned state equals the input
    - **Validates: Requirements 5.10, 9.2**
    - _Requirements: 5.10, 9.2_

  - [ ] 2.13 Write property test for ignored keys `app/src/engine/cangjie.ignored.property.test.ts`
    - `// Feature: cangjie-seance, Property 6: Z and non-letter keys never change the state`
    - fast-check, ≥100 runs; for any state and any event whose `key` is Z or z, a non-letter, a multi-character key name (`"Process"`, `"Enter"`, `"Shift"`), or anything outside A–Y, `applyKeyEvent` returns a state equal to the input
    - **Validates: Requirements 5.2, 5.6, 9.2**
    - _Requirements: 5.2, 5.6, 9.2_

  - [ ] 2.14 Add `pickGuideExample` to `app/src/engine/cangjie.ts` with unit tests
    - Return the first character in `learningOrder(dataset)` that is Playable and whose code has at least two keys, with its code read from `record.cangjie`; `null` when none exists; nothing hard-coded
    - Write `app/src/engine/cangjie.guide.test.ts` with a synthetic dataset: picks the first eligible, skips single-key and X-prefixed codes, returns `null` when none
    - _Requirements: 3.4_

  - [ ] 2.15 Implement `app/src/engine/structureLayout.ts` with unit tests
    - Export `LayoutNode`, `IdcInfo`, `IDC_INFO` (⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿹ ⿺ ⿻; ⿲ and ⿳ arity 3), `IDC_ARITY`, `parseIds` (prefix notation over codepoints; `null` for atomic `？`, any interior `？`, an unknown IDC in U+2FF0–U+2FFF, leftover input, or missing operands), `leaves`, and `isStructureHintEligible`
    - Write `app/src/engine/structureLayout.test.ts`: each of the 12 IDCs, nesting, `null` cases (atomic, interior `？`, unknown IDC, leftover, missing operands), eligibility
    - _Requirements: 6.3, 6.6_

  - [ ] 2.16 Write property test for layout leaves `app/src/engine/structureLayout.property.test.ts`
    - `// Feature: cangjie-seance, Property 7: The structure layout's leaves equal the IDS leaf codepoints`
    - fast-check, ≥100 runs over generated well-formed IDS trees using all 12 IDCs (including ⿲ and ⿳): `leaves(parseIds(ids))` equals the non-IDC codepoints in order; a second test in the same file checks every Eligible character in `app/public/data/characters.json` (259 expected): removing repeats from the leaves gives exactly `decomposition.components`, and the leaves never include the character itself
    - **Validates: Requirements 6.3, 6.6, 9.2**
    - _Requirements: 6.3, 6.6, 9.2_

  - [ ] 2.17 Write unit tests for verified example codes `app/src/engine/cangjie.dataset.test.ts`
    - Read `app/public/data/characters.json` and assert 我 `HQI`, 口 `R`, 爱 `BBKE`, 们 `OLS`, 车 `JQ` come from the dataset's `cangjie` field and each plays through `applyKeyEntry` to a non-`active` status
    - _Requirements: 1.3, 5.5, 5.8_

- [ ] 3. Storage schema version 2
  - [ ] 3.1 Implement storage v2 in `app/src/storage/storage.ts`
    - Raise `CURRENT_SCHEMA_VERSION` to 2; export `Mode = 'write' | 'cangjie'`; `PersistedState` gains `cangjieIntroSeen` and `history: { write, cangjie }`
    - Add `SHIPPED_MIGRATIONS[1]` (v1 `history` moves under `write`, `cangjie` is `{}`, `introSeen` kept, `cangjieIntroSeen: false`); extend `validateState` (boolean `cangjieIntroSeen`, both histories pass `isValidHistory` including the forbidden-key rule)
    - Add `recordOutcome(mode, char, entry)` (changes only `history[mode][char]`), `getCangjieIntroSeen`, `setCangjieIntroSeen`, and module-level wrappers; keep every reset rule and the in-memory fallback
    - _Requirements: 8.1, 8.2, 8.3, 4.4, 4.5_

  - [ ] 3.2 Update the existing storage tests `app/src/storage/storage.test.ts`
    - Schema version 2, per-mode history, `cangjieIntroSeen`, the 1→2 migration example, corrupt and newer versions still reset, forbidden keys in either history reset, storage unavailable still works in memory
    - _Requirements: 8.1, 8.2, 8.3, 9.3_

  - [ ] 3.3 Write property test for migration `app/src/storage/storage.migration.property.test.ts`
    - `// Feature: cangjie-seance, Property 15: Migrating a v1 blob preserves history under write`
    - fast-check, ≥100 runs over valid v1 blobs with a fake storage backend; the loaded v2 state has `history.write` equal to the v1 history, empty `history.cangjie`, unchanged `introSeen`, and `cangjieIntroSeen` false
    - **Validates: Requirements 8.2, 8.3**
    - _Requirements: 8.2, 8.3, 9.2_

  - [ ] 3.4 Write property test for per-mode recording `app/src/storage/storage.recordOutcome.property.test.ts`
    - `// Feature: cangjie-seance, Property 16: Recording an Outcome in one Mode leaves the other Mode's history unchanged`
    - fast-check, ≥100 runs; `recordOutcome(mode, char, entry)` changes only `history[mode][char]`; the other mode's history and both seen flags are unchanged
    - **Validates: Requirements 4.4, 4.5**
    - _Requirements: 4.4, 4.5, 9.2_

- [ ] 4. UI components and modes
  - [ ] 4.1 Implement `app/src/components/StructureHint.tsx` with component tests
    - Props `{ layout: LayoutNode; target: string }`; render nested boxes for all 12 IDCs (row for ⿰ ⿲, column for ⿱ ⿳, outer-and-inner box for the surround IDCs, two offset boxes with the text "overlapping" for ⿻); `role="group"` with `aria-label` from `IDC_INFO`; leaf boxes labelled `"<position>: <component>"`, `lang="zh"`, and passed through `maskTarget`; system fonts only
    - Write `app/src/components/StructureHint.test.tsx`: one case per IDC, leaf labels, the target never appears in text or attributes
    - _Requirements: 6.3, 6.7, 7.1_

  - [ ] 4.2 Add "Reveal its shape" to `app/src/modes/WriteMode.tsx`
    - State `strokeHintShown` and `structureHintUsed` (with a ref mirror for the `onComplete` closure), both reset when the record changes; `layout = useMemo(parseIds…)`, `eligible = isStructureHintEligible(record)`
    - While writing: eligible and no stroke hint and not yet used shows the "Reveal its shape" button; used keeps `StructureHint` visible until resolution; not eligible shows "This ghost's shape cannot be revealed." with no active control; a shown stroke hint withdraws the button; `onComplete` calls `resolveCompletion(hintShown || structureHintRef.current, total, config)`
    - Offered in Write mode only
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.8_

  - [ ] 4.3 Add structure-hint cases to `app/src/modes/WriteMode.test.tsx`
    - Button shown only while unresolved, eligible, and without a stroke hint; a stroke hint withdraws it; using it makes completion `struggled` never `clean`; ineligible note and no active control; layout stays visible until resolution; existing cases unchanged
    - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.8_

  - [ ] 4.4 Implement `app/src/components/CangjieGuide.tsx` with component tests
    - Props `{ dataset, onContinue }`; show the 25 keys from `CANGJIE_KEYS` (X explained), that a code is one to five keys typed in order, that each key stands for a family of shapes of which only the base shape is shown, an example from `pickGuideExample(dataset)` (omitted when `null`), exactly the four whitelisted claims, and a visible citation giving each title and URL as text ("Cangjie input method" `https://en.wikipedia.org/wiki/Cangjie_input_method`, "Chu Bong-Foo" `https://en.wikipedia.org/wiki/Chu_Bong-Foo`); a "Continue" button with an accessible label; shapes carry `lang="zh"`
    - Write `app/src/components/CangjieGuide.test.tsx`: 25 keys, four whitelisted claims only (no other year, statistic, or "dying" wording), both citations with URLs as text, example code equals the dataset record's `cangjie`, continue calls `onContinue`
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

  - [ ] 4.5 Implement `app/src/modes/CangjieMode.tsx`
    - Props `{ record, dataset, config, onOutcome }`; Code slots (one per key, accessible name "Slot N, empty", filled shows letter and shape with `lang="zh"`, shapes masked with `maskTarget` before resolution); `window` `keydown` listener using `applyKeyEvent` that skips editable targets and calls `preventDefault` only for accepted entries; 25 on-screen buttons in QWERTY rows without Z (≥44 px, `aria-label` "Key A", letters only when `KEY_FACE_CHARACTERS.has(record.character)`); `role="status"` `aria-live="polite"` feedback with text and symbol plus mistake count; automatic Key hint outline and "Hint: press X" text with no hint control; the IME note; "Give up"
    - Completion calls `onOutcome` exactly once, shows the full code and the character in ink via hanzi-writer `showCharacter()`; Give up stops entry, shows the full code, reports `gave-up` once, then plays `animateCharacter()`; a hanzi-writer failure leaves the Outcome standing and shows the character as text; a null or non-Playable record shows an alert and reports `gave-up` once
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 7.1, 7.2, 7.3, 9.4_

  - [ ] 4.6 Write component tests `app/src/modes/CangjieMode.test.tsx` (hanzi-writer mocked)
    - Slot count equals code length; physical keys fill slots; on-screen keys fill slots; a wrong key adds one mistake and leaves slots unchanged; Z and modified keys are ignored; the editable-target listener skip; the Key hint appears after 3 consecutive wrong entries for the same slot, with no hint control; clean, struggled (hint shown or too many mistakes), and gave-up Outcomes; Give up shows the full code and plays the animation; animation failure leaves the Outcome standing; `onOutcome` called exactly once and later keys ignored; IME note visible; letters-only keyboard for key-face targets and shapes shown otherwise; unplayable record alert
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 7.3_

  - [ ] 4.7 Write property test for the on-screen keyboard `app/src/modes/CangjieMode.keyboard.property.test.tsx`
    - `// Feature: cangjie-seance, Property 20: The On-screen Cangjie keyboard shows letters only for key-face characters`
    - fast-check, ≥100 runs (hanzi-writer mocked) with targets drawn from `KEY_FACE_CHARACTERS` and from other characters; for key-face targets no key shows a base shape, for others every key does
    - **Validates: Requirements 7.3**
    - _Requirements: 7.3, 9.2_

  - [ ] 4.8 Update `app/src/components/StartMenu.tsx`
    - Props `{ onStartSeance: (mode: Mode) => void; onReviewLegend; onReviewCangjieGuide }`; four buttons ≥44 px high with the existing focus ring: "Begin a Write Séance", "Begin a Cangjie Séance", "Read the legend again", "How Cangjie works"
    - _Requirements: 2.1, 2.2_

  - [ ] 4.9 Update `app/src/components/StartMenu.test.tsx`
    - New props; four labelled controls; each calls the right handler (Write and Cangjie pass their mode); keyboard operable
    - _Requirements: 2.1, 2.2, 9.3_

  - [ ] 4.10 Add `mode` to `app/src/components/SeanceSession.tsx`
    - `SeanceSessionProps` gains `mode: Mode`; render `WriteMode` or `CangjieMode` (`key={record.character}`) after `GhostPrompt`; the rest of the flow (dedupe, one Outcome per ghost, "Next ghost", summary) is unchanged
    - _Requirements: 2.3, 4.3_

  - [ ] 4.11 Update `app/src/components/SeanceSession.test.tsx`
    - Pass `mode`; add a Cangjie case (renders `CangjieMode`, one Outcome per ghost, "Next ghost" after each Outcome, last one leads to the summary) with hanzi-writer mocked
    - _Requirements: 2.3, 4.3, 9.3_

- [ ] 5. App wiring
  - [ ] 5.1 Wire modes into `app/src/App.tsx`
    - `buildSession(dataset, history, now, config, mode)` filters `learningOrder` to `isPlayableInCangjie` characters when `mode === 'cangjie'`; `View` gains `{ screen: 'cangjie-guide'; dataset; origin: 'start' | 'review' }`, and the seance and summary views carry `mode`
    - `startSeance(dataset, mode)` uses `loadState().history[mode]` and `Date.now()`; "Begin a Cangjie Séance" shows the guide first when `getCangjieIntroSeen()` is false (continue calls `setCangjieIntroSeen(true)` then starts the Séance); "How Cangjie works" shows the guide with `origin: 'review'` (continue records seen and returns to the menu); the legend intro's begin starts a Write Séance
    - `handleOutcome(mode, char, outcome, now)` computes `applyReview` from `priorEntry(history[mode], char)` and calls `recordOutcome(mode, char, entry)` immediately; "Begin another Séance" starts another Séance in the summary's mode
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 5.2 Update `app/src/App.test.tsx`
    - `buildSession` with `mode`; menu with two Begin buttons and the guide control; guide shown on first Cangjie start only and re-viewable from the menu; summary keeps the mode; an Outcome is recorded immediately under the right mode and leaves the other mode's history unchanged; existing cases kept
    - _Requirements: 2.2, 2.4, 3.1, 3.2, 4.3, 4.4, 4.5, 9.3_

  - [ ] 5.3 Write property test for session selection `app/src/App.session.property.test.ts`
    - `// Feature: cangjie-seance, Property 18: A Cangjie session contains only Playable, distinct ghosts`
    - fast-check, ≥100 runs over generated Cangjie histories and clocks; `buildSession(…, 'cangjie')` has no duplicates, at most `config.sessionSize` ghosts, and only characters for which `isPlayableInCangjie` holds
    - **Validates: Requirements 4.1, 4.2**
    - _Requirements: 4.1, 4.2, 9.2_

  - [ ] 5.4 Write the cross-mode masking test `app/src/App.masking.test.tsx`
    - For every character in `app/public/data/characters.json` that is playable in the mode (hanzi-writer mocked), render the ghost unresolved in Write mode and in Cangjie mode, then again after "Reveal its shape" (Write) or after three consecutive wrong keys (Cangjie), and assert the target character appears in no DOM text, attribute, accessible name, or `document.title`
    - _Requirements: 7.1, 7.2, 7.4_

- [ ] 6. Final checkpoint
  - [ ] 6.1 Run the whole test suite
    - Run `npm test` from the repository root; every suite (character-dataset, ghost-game-core, cangjie-seance) must pass
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 9.2, 9.3_

  - [ ] 6.2 Type-check both projects
    - Run `tsc --noEmit` at the repository root and in `app/`; both must report no errors with `strict: true`
    - _Requirements: 9.1_

  - [ ] 6.3 Confirm no `any` in new or changed code
    - Search the files this spec added or changed (`scripts/`, `app/src/`, `tests/`) for `any` types and replace each with an explicit type
    - _Requirements: 9.1_

  - [ ] 6.4 Build the app
    - Run `npm run build -w app`; it must succeed
    - _Requirements: 9.1, 9.4_

- [ ] 7. Final human manual check (NON-CODING, performed by a human)
  - [ ] 7.1 Human play-through of the Cangjie Séance
    - This task is performed by a human, the human. It is NOT a coding task. Kiro runs nothing for this task and SHALL NOT write the `kiro-log.md` entry; the human records the result
    - The human starts the dev server (`npm run dev -w app`) and plays one Cangjie Séance with a physical keyboard and one with the on-screen keyboard (touch or mouse)
    - Check: the "How Cangjie works" guide on the first Cangjie start; Code slots; mistakes; the automatic Key hint after 3 consecutive misses on one slot; a clean, a struggled and a gave-up Outcome; the summary; and that progress persists across a reload while Write-mode progress is unaffected
    - _Requirements: 3.1, 4.3, 4.4, 4.5, 5.1, 5.4, 5.6, 5.7, 5.8, 5.9, 8.1, 8.2, 9.4_

## Notes

- There are no optional tasks. Every property test runs at least 100 fast-check runs and carries the tag `// Feature: cangjie-seance, Property N: <title>`.
- Each of design Properties 1–20 has exactly one test sub-task; unit and component tests are separate sub-tasks or part of the implementation task for small pure modules.
- The existing character-dataset and ghost-game-core tasks are not reopened. The tests this spec breaks are updated here: 1.7, 1.9, 1.14, 1.16, 1.19, 1.20, 1.21, 3.2, 4.9, 4.11, 5.2.
- Group 1 reads `app/public/data/characters.json` in tests only after task 1.26 regenerates it; 1.7's integration test is expected to stay red until 1.26 completes.
- Between task 3.1 (storage API change) and 5.2, `App.tsx` and `App.test.tsx` are intentionally out of step with the new storage, `StartMenu` and `SeanceSession` APIs. Only the checkpoints 1.29 and 6.x are run on the whole app.
- The final task 7.1 is the only non-coding task and is not logged by Kiro.
- Do not add `.kiro/` to `.gitignore`.
- Parallel notes (tasks inside one wave touch different files and can run in parallel; a wave starts only after earlier waves finish):
  - Wave 0: 1.1, 1.2, 1.4, 1.5, 1.10, 1.12, 2.1, 2.2 are independent.
  - Wave 1: 1.3, 1.6, 1.9, 1.11, 1.13, 1.15, 1.17, 2.3, 2.5, 2.15 are parallel; 1.9 touches only app test files.
  - Wave 2: 1.7, 1.8, 1.14, 1.16, 1.18, 1.25, 2.6, 2.7, 4.1 are parallel; 2.7 edits `cangjie.ts` after 2.5.
  - Wave 3: 1.19, 1.20, 1.22, 1.23, 1.24, 1.26, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 4.2, 4.5 are parallel; 2.14 edits `cangjie.ts` after 2.7, and 4.2 edits `WriteMode.tsx` after 2.1.
  - Wave 4: 1.21, 1.27, 1.28, 2.4, 2.16, 2.17, 4.3, 4.4, 4.6, 4.7 are parallel; they need the regenerated `characters.json` or the components built in wave 3.
  - Wave 5: 1.29 runs alone because it runs the whole suite.
  - Wave 6: 3.1 alone, because it changes `storage.ts`.
  - Wave 7: 3.2, 3.3, 3.4, 4.8, 4.10 are parallel; they need `Mode` from `storage.ts`.
  - Wave 8: 4.9, 4.11, 5.1 are parallel; 5.1 edits `App.tsx` and needs 4.4, 4.8, 4.10.
  - Wave 9: 5.2, 5.3, 5.4 are parallel; 5.2 is the only task editing `App.test.tsx`.
  - Wave 10: 6.2, 6.3. Wave 11: 6.1, 6.4 (so fixes made in wave 10 are covered). Wave 12: 7.1 (human).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4", "1.5", "1.10", "1.12", "2.1", "2.2"] },
    { "id": 1, "tasks": ["1.3", "1.6", "1.9", "1.11", "1.13", "1.15", "1.17", "2.3", "2.5", "2.15"] },
    { "id": 2, "tasks": ["1.7", "1.8", "1.14", "1.16", "1.18", "1.25", "2.6", "2.7", "4.1"] },
    { "id": 3, "tasks": ["1.19", "1.20", "1.22", "1.23", "1.24", "1.26", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13", "2.14", "4.2", "4.5"] },
    { "id": 4, "tasks": ["1.21", "1.27", "1.28", "2.4", "2.16", "2.17", "4.3", "4.4", "4.6", "4.7"] },
    { "id": 5, "tasks": ["1.29"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["3.2", "3.3", "3.4", "4.8", "4.10"] },
    { "id": 8, "tasks": ["4.9", "4.11", "5.1"] },
    { "id": 9, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 10, "tasks": ["6.2", "6.3"] },
    { "id": 11, "tasks": ["6.1", "6.4"] },
    { "id": 12, "tasks": ["7.1"] }
  ]
}
```
