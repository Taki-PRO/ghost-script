# Implementation Plan: character-dataset

## Overview

Build the data pipeline that transforms three open-source raw datasets into `app/public/data/characters.json`. Work proceeds in layers: scaffolding first, then shared types, then the real external data assets and character list, then individual parsers (each with tests), then merge/serialise, then the entry-point script that wires everything together, then the full property-based and smoke test suite, then the end-to-end run, and finally README attribution. Every step builds on the last; no hanging code is left unwired.

## Tasks

- [x] 1. Project scaffolding
  - Create directory structure: `data/raw/`, `scripts/lib/`, `tests/unit/`, `tests/property/`, `tests/smoke/`, `tests/integration/`, `tests/helpers/`, `app/public/data/`, `app/src/data/`
  - Add `package.json` at repo root (or update existing) with scripts: `"build:data": "tsx scripts/build-data.ts"`, `"test": "vitest run"`
  - Add `tsconfig.json` at repo root covering `scripts/`, `tests/`, and `app/src/data/types.ts` with `"strict": true`, `"module": "ESNext"`, `"moduleResolution": "bundler"`
  - Add `data/character-list.txt` placeholder file with a `#` comment header line only (no characters yet — populated in task 4)
  - Install dev dependencies: `tsx`, `vitest`, `fast-check`
  - _Requirements: 3.1, 3.5_

- [x] 2. Shared TypeScript types
  - [x] 2.1 Create `app/src/data/types.ts` with all canonical types: `Etymology`, `StrokeData`, `Decomposition`, `FieldSources`, `DatasetId`, `CharacterRecord`, `RequiredField`, `MissingFieldError`, `BuildOptions`, `BuildResult`
    - Types must match the data model section of the design exactly
    - Export everything; no `any`; use `unknown` + type guards at parse boundaries
    - _Requirements: 3.5, 4.2_

- [x] 3. Raw dataset acquisition
  - [x] 3.1 Download and place hanzi-writer-data
    - Install `hanzi-writer-data` via npm or download the per-character JSON files; place under `data/raw/hanzi-writer-data/`
    - Copy or symlink the Arphic Public License file into `data/raw/hanzi-writer-data/LICENSE`
    - _Requirements: 2.1_

  - [x] 3.2 Download and place Make Me a Hanzi `dictionary.txt`
    - Download `dictionary.txt` from the Make Me a Hanzi repository; place at `data/raw/make-me-a-hanzi/dictionary.txt`
    - Place the Make Me a Hanzi licence file at `data/raw/make-me-a-hanzi/LICENSE`
    - _Requirements: 2.2_

  - [x] 3.3 Download and place CC-CEDICT
    - Download `cedict_ts.u8` from cc-cedict.org; place at `data/raw/cc-cedict/cedict_ts.u8`
    - Place the CC BY-SA 3.0 licence file at `data/raw/cc-cedict/LICENSE`
    - _Requirements: 2.3_

- [x] 4. Populate character list
  - [x] 4.1 Populate `data/character-list.txt` with ~300 simplified Chinese characters
    - Derive characters from a published frequency or learner list (e.g. HSK 1–4 or TOCFL A1–B2)
    - Ensure the file has 280–320 non-comment, non-blank lines, no duplicates, all codepoints in U+4E00–U+9FFF
    - Update the `#` comment header with the source name, URL, and SPDX licence identifier
    - _Requirements: 1.2, 1.3, 1.5_

- [x] 5. Character-list parser
  - [x] 5.1 Implement `scripts/lib/parse-character-list.ts`
    - `parseCharacterList(raw: string): ParseCharacterListResult`
    - Strip `#`-prefixed comment lines and blank lines; trim whitespace
    - Validate each remaining character is a single codepoint in U+4E00–U+9FFF; emit `'not-cjk'` errors for violations
    - Detect and emit `'duplicate'` errors for repeated characters
    - Return `{ ok: true, characters }` only when zero errors are found; otherwise `{ ok: false, errors }`
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 5.2 Write unit tests for `parseCharacterList`
    - Test: valid list returns `ok: true` with correct character array
    - Test: comment and blank lines are stripped
    - Test: non-CJK codepoint returns `ok: false` with correct error
    - Test: duplicate character returns `ok: false` with correct error
    - Test: mixed valid + invalid returns all errors (not just first)
    - _Requirements: 1.4_

- [x] 6. hanzi-writer-data parser
  - [x] 6.1 Implement `scripts/lib/parse-hanzi-writer-data.ts`
    - `parseHanziWriterData(dataDir: string, characters: string[]): Map<string, HanziWriterEntry>`
    - For each character, attempt to read `<dataDir>/<char>.json`; parse with `unknown` + type guard
    - Characters with no file on disk are simply absent from the returned Map (missing-field handling is in `merge.ts`)
    - Export `HanziWriterEntry` interface matching the design
    - _Requirements: 4.5, 4.6_

  - [x] 6.2 Write unit tests for `parseHanziWriterData`
    - Test: correctly reads a fixture JSON file and populates Map with `strokes`, `medians`, `radStrokes`
    - Test: missing file → character absent from Map (no throw)
    - Test: malformed JSON → character absent from Map (no throw)
    - _Requirements: 4.5, 4.6_

- [x] 7. Make Me a Hanzi parser
  - [x] 7.1 Implement `scripts/lib/parse-make-me-a-hanzi.ts`
    - `parseMakeMeAHanzi(rawText: string): Map<string, MakeMeAHanziEntry>`
    - Parse each `\n`-delimited JSON line using `isMakeMeAHanziLine` type guard
    - After parsing each line, compute `atomic` and `components`:
      - Atomic (`decomposition` starts with `？`): `atomic = true`, `components = [character]`
      - Non-atomic: `atomic = false`, run `extractLeafComponents` on the IDS string
    - Implement `extractLeafComponents(idsString: string): string[]` — keep only codepoints in U+4E00–U+9FFF, U+3400–U+4DBF, U+2E80–U+2EFF, U+2F00–U+2FDF, U+31C0–U+31EF; skip IDCs U+2FF0–U+2FFB and `？` U+FF1F; preserve left-to-right first-occurrence order
    - Export `MakeMeAHanziEntry`, `Etymology`, `extractLeafComponents`
    - _Requirements: 4.7, 4.8, 4.9_

  - [x] 7.2 Write unit tests for `parseMakeMeAHanzi` and `extractLeafComponents`
    - Test: non-atomic entry → correct `decomposition`, `radical`, `components`, `atomic: false`
    - Test: atomic entry (starts with `？`) → `atomic: true`, `components` = `[character]`
    - Test: entry with interior `？` in IDS string → `？` excluded from `components`
    - Test: IDCs excluded from `components`
    - Test: `extractLeafComponents` preserves left-to-right first-occurrence order
    - Test: malformed JSON line → skipped (character absent from Map)
    - _Requirements: 4.7, 4.8_

- [x] 8. CC-CEDICT parser
  - [x] 8.1 Implement `scripts/lib/parse-cc-cedict.ts`
    - `parseCcCedict(rawText: string): Map<string, CcCedictEntry>`
    - Skip `#`-prefixed comment lines
    - Parse data lines in the format `Traditional Simplified [pin1 yin1] /meaning1/meaning2/`
    - For each simplified character, collect all matching entries; deduplicate `pinyin` and `meanings` preserving first-occurrence order
    - Export `CcCedictEntry`
    - _Requirements: 4.3, 4.4_

  - [x] 8.2 Write unit tests for `parseCcCedict`
    - Test: single entry → correct `pinyin` and `meanings` arrays
    - Test: multiple entries for same character → pinyin/meanings deduplicated, order preserved
    - Test: comment lines skipped
    - Test: character with no entry → absent from Map
    - _Requirements: 4.3_

- [x] 9. Merge function
  - [x] 9.1 Implement `scripts/lib/merge.ts`
    - `mergeCharacter(char, hanziWriter, makeMeAHanzi, ccCedict): MergeResult`
    - Pure function; assembles `CharacterRecord` from three parsed entries
    - Returns `{ ok: false, missingFields }` listing every absent required field; never throws
    - Sets `sources` object with correct `DatasetId` values per field
    - _Requirements: 3.6, 4.2, 4.10, 4.11_

  - [x] 9.2 Write unit tests for `mergeCharacter`
    - Test: all fields present → `ok: true`, correct `sources` object
    - Test: missing `ccCedict` → `ok: false`, lists `pinyin` and `meanings` as missing
    - Test: missing `hanziWriter` → `ok: false`, lists `strokeCount` and `strokeData` as missing
    - Test: missing `makeMeAHanzi` → `ok: false`, lists `decomposition` as missing
    - Test: all three missing → all five required fields listed in failure
    - _Requirements: 3.6, 4.11_

- [x] 10. Serialiser
  - [x] 10.1 Implement `scripts/lib/serialise.ts`
    - `serialiseDataset(records: Map<string, CharacterRecord>): string`
    - Sort records by Unicode codepoint ascending (`char.codePointAt(0)`)
    - Serialise to JSON with fixed key order per record: `character`, `pinyin`, `meanings`, `strokeCount`, `strokeData`, `decomposition`, `sources`
    - Use `JSON.stringify(sorted, null, 2)` for human-readable, deterministic output
    - _Requirements: 3.4, 5.7_

  - [x] 10.2 Write unit tests for `serialiseDataset`
    - Test: output is valid JSON parseable back to the original records
    - Test: keys appear in the fixed order specified in the design
    - Test: records are sorted by codepoint ascending
    - Test: two calls with the same Map produce byte-for-byte identical strings
    - _Requirements: 3.4_

- [x] 11. Pipeline entry point
  - [x] 11.1 Implement `scripts/build-data.ts` — `buildDataset(opts: BuildOptions): Promise<BuildResult>`
    - Accept `BuildOptions`; call all parsers; call `mergeCharacter` per character in fail-slow pass
    - Collect all `MissingFieldError` items; if any exist, return `{ ok: false, errors }` without writing output
    - On success: call `serialiseDataset`, write to a temp file, rename atomically to final path
    - Verify final record count matches character-list line count; abort with error if mismatch
    - _Requirements: 3.2, 3.3, 3.6, 4.12_

  - [x] 11.2 Implement `main()` in `scripts/build-data.ts`
    - Resolves hardcoded paths from repo root; calls `buildDataset`; handles missing-file errors (emits to stderr, exits non-zero)
    - On `ok: false` from `buildDataset`: emit full missing-field report to stderr, exit non-zero
    - On `ok: true`: print success summary to stdout (character count, all required fields non-null), write `app/public/data/characters.json`
    - _Requirements: 3.1, 3.7, 4.12_

- [x] 12. Checkpoint — unit test suite passes
  - Ensure all unit tests pass with `npm test`. Ask the user if any questions arise before continuing.

- [ ] 13. Property-based tests — parsers and merge
  - [ ] 13.1 Create `tests/helpers/arbitraries.ts` with shared fast-check arbitraries
    - `arbitraryCharacter()` — `fc.integer` filtered to U+4E00–U+9FFF mapped to `String.fromCodePoint`
    - `arbitraryCharacterList()` — `fc.uniqueArray(arbitraryCharacter(), { minLength: 1, maxLength: 320 })`
    - `arbitraryCcCedictEntry()` — random ASCII pinyin syllables + meaning strings
    - `arbitraryStrokeData()` — random non-empty `strokes` array, `medians`, `radStrokes`
    - `arbitraryDecomposition()` — random IDS strings using valid CJK codepoints + IDCs
    - `arbitraryCharacterRecord()` — full record with all required fields present
    - _Requirements: 5.1–5.8_

  - [ ] 13.2 Write property test: CJK range validation (Property 1)
    - **Property 1: CJK range validation rejects non-CJK codepoints**
    - **Validates: Requirements 1.4**
    - Generate strings with at least one non-CJK codepoint; assert `parseCharacterList` returns `ok: false`
    - numRuns: 100
    - _Requirements: 1.4_

  - [ ] 13.3 Write property test: pipeline determinism (Property 2)
    - **Property 2: Pipeline determinism**
    - **Validates: Requirements 3.4, 5.7**
    - Generate random `BuildOptions`-shaped inputs; call `buildDataset` twice; assert results are deeply equal
    - numRuns: 100
    - _Requirements: 3.4, 5.8_

  - [ ] 13.4 Write property test: fail-slow error aggregation (Property 3)
    - **Property 3: Fail-slow error aggregation**
    - **Validates: Requirements 3.6**
    - Generate character lists where a random subset is missing fields; assert failure result includes every affected character
    - numRuns: 100
    - _Requirements: 3.6_

  - [ ] 13.5 Write property test: CC-CEDICT deduplication preserves order (Property 5)
    - **Property 5: CC-CEDICT multi-entry deduplication preserves order**
    - **Validates: Requirements 4.3**
    - Generate sequences of entries for a character with random duplicate pinyin/meanings; assert output arrays equal deduplicated first-occurrence-order lists
    - numRuns: 100
    - _Requirements: 4.3_

  - [ ] 13.6 Write property test: stroke data round-trip (Property 6)
    - **Property 6: Stroke data extraction round-trip**
    - **Validates: Requirements 4.5**
    - Generate arbitrary `HanziWriterEntry` objects; assert `strokeCount` = `strokes.length` and `strokeData` deep-equals input
    - numRuns: 100
    - _Requirements: 4.5_

  - [ ] 13.7 Write property test: decomposition verbatim pass-through (Property 7)
    - **Property 7: Decomposition verbatim pass-through**
    - **Validates: Requirements 4.7**
    - Generate arbitrary Make Me a Hanzi dictionary lines; assert parsed `decomposition` field equals original value
    - numRuns: 100
    - _Requirements: 4.7_

- [ ] 14. Property-based tests — output invariants
  - [ ] 14.1 Write property tests: CharacterRecord schema completeness and sources validity (Properties 4 and 10)
    - **Property 4: CharacterRecord schema completeness**
    - **Property 10: sources object has exactly the required keys with valid values**
    - **Validates: Requirements 4.2, 4.10**
    - Generate arbitrary `CharacterRecord` values via `arbitraryCharacterRecord()`; assert no unexpected keys; assert sources has exactly five keys with valid `DatasetId` values
    - numRuns: 100
    - _Requirements: 4.2, 4.10_

  - [ ] 14.2 Write property tests: no placeholder in components, atomic invariant, IDS codepoints (Properties 8, 9, 16)
    - **Property 8: No placeholder in components array**
    - **Property 9: Atomic record has exactly one component equal to the character**
    - **Property 16: Decomposition IDS string contains only valid codepoints**
    - **Validates: Requirements 5.5, 5.6**
    - Use `arbitraryDecomposition()` + `arbitraryCharacterRecord()`; assert `components` elements are all valid CJK/radical codepoints; assert atomic invariant; assert IDS string codepoints
    - numRuns: 100
    - _Requirements: 5.5, 5.6_

  - [ ] 14.3 Write property tests: output record count and every list character is a key (Properties 11 and 12)
    - **Property 11: Output record count equals character-list entry count**
    - **Property 12: Every list character is a key in the output, exactly once**
    - **Validates: Requirements 4.12, 5.1**
    - Generate random character lists + matching full dataset inputs; assert count invariant and bijection
    - numRuns: 100
    - _Requirements: 4.12, 5.1_

  - [ ] 14.4 Write property tests: non-null arrays have at least one non-empty element (Properties 13, 14, 15)
    - **Property 13: Non-null pinyin contains at least one non-empty string**
    - **Property 14: Non-null meanings contains at least one non-empty string**
    - **Property 15: strokeCount is a positive integer**
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - Use `arbitraryCharacterRecord()`; assert `pinyin.length >= 1`, all elements non-empty; same for `meanings`; `strokeCount > 0` and integer
    - numRuns: 100
    - _Requirements: 5.2, 5.3, 5.4_

- [ ] 15. Smoke tests
  - [ ] 15.1 Write `tests/smoke/dataset-files.test.ts`
    - Assert all required raw dataset paths and licence files exist on disk
    - Assert `app/public/data/` directory exists
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 15.2 Write `tests/smoke/character-list-bounds.test.ts`
    - Assert `data/character-list.txt` has 280–320 non-comment lines
    - Assert no duplicate characters
    - Assert first line is a `#` comment
    - _Requirements: 1.2, 1.3_

  - [ ] 15.3 Write `tests/smoke/npm-script.test.ts`
    - Assert `package.json` contains a `build:data` script entry
    - _Requirements: 3.1_

- [ ] 16. Integration test
  - [ ] 16.1 Write `tests/integration/full-pipeline.test.ts`
    - Call `buildDataset` with the actual paths in `data/raw/` and `data/character-list.txt`
    - Assert `result.ok === true`
    - Parse the resulting JSON; spot-check 3–5 well-known characters for expected field shapes (`pinyin`, `meanings`, `strokeCount`, `strokeData`, `decomposition`)
    - Assert record count equals character-list line count
    - _Requirements: 3.4, 4.12, 5.1_

- [ ] 17. Checkpoint — full test suite passes
  - Run `npm test`. Ensure all unit tests, property tests, smoke tests, and integration test pass. Ask the user if any questions arise.

- [ ] 18. End-to-end pipeline run
  - [ ] 18.1 Run `npm run build:data` and verify `app/public/data/characters.json` is produced
    - Confirm stdout summary shows correct character count and all required fields non-null
    - Run `npm test` to confirm integration test now passes
    - Fix any missing-field errors surfaced by the pipeline for characters absent from the datasets
    - _Requirements: 3.1, 3.7, 4.12_

- [ ] 19. README updates
  - [ ] 19.1 Add dataset attribution section to `README.md`
    - List all three datasets with name, URL, and licence (CC BY-SA 3.0, Arphic Public License as applicable)
    - Section must appear before the pipeline usage instructions
    - Record any font licences in the same section
    - _Requirements: 2.4, 1.5_

  - [ ] 19.2 Add pipeline usage instructions to `README.md`
    - Document `npm run build:data` command and prerequisites
    - Document `npm test` command
    - _Requirements: 3.1_

- [ ] 20. Final checkpoint — full suite passes and pipeline output verified
  - Run `npm test` from repo root. Confirm all tests pass. Ask the user if questions arise.

## Notes

- All tasks are required, including the unit and property-based tests. They are the correctness guarantee for the character data, which judges cannot check by reading Chinese.
- The raw datasets (task 3) and the character list (task 4) come before the parsers, so every parser is built and tested against the real files from the start. Real-data surprises (atomic characters, radical forms, missing entries) surface early, not at the end-to-end run.
- Task 4 requires a human decision about which source list to use; the `#` comment header must record it.
- Property-based tests in tasks 13 and 14 use fast-check arbitraries defined in task 13.1. Complete 13.1 before any property test task.
- Property 17 (hint sequence is a subsequence of decomposition components) is deferred to the hint-engine spec, where `src/engine/hints.ts` is built. It is not stubbed here; Requirement 5.7 will be verified there.
- The `buildDataset` function is kept pure (accepts paths as parameters) so property tests can exercise it with in-memory fixtures rather than touching the real `data/raw/` files.
- Each property test is tagged with a comment: `// Feature: character-dataset, Property N: <title>`.
- Run tasks one at a time and review each result. Do not use "Run All Tasks".

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["5.1", "6.1", "7.1", "8.1", "9.1", "10.1"] },
    { "id": 5, "tasks": ["5.2", "6.2", "7.2", "8.2", "9.2", "10.2"] },
    { "id": 6, "tasks": ["11.1"] },
    { "id": 7, "tasks": ["11.2"] },
    { "id": 8, "tasks": ["13.1"] },
    { "id": 9, "tasks": ["13.2", "13.3", "13.4", "13.5", "13.6", "13.7"] },
    { "id": 10, "tasks": ["14.1", "14.2", "14.3", "14.4", "15.1", "15.2", "15.3"] },
    { "id": 11, "tasks": ["16.1"] },
    { "id": 12, "tasks": ["18.1"] },
    { "id": 13, "tasks": ["19.1", "19.2"] }
  ]
}
```
