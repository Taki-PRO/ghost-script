# Requirements Document

## Introduction

The character-dataset feature builds the data pipeline that produces `app/public/data/characters.json` — the single source of character data for the Ghost Script app. The pipeline reads open-source datasets downloaded into `data/raw/`, filters them against a curated list of ~300 common simplified Chinese characters in `data/character-list.txt`, and emits a deterministic, provenance-tracked JSON file. No character data is ever generated or guessed by an AI model; all field values are derived exclusively from the source datasets. The generated file is never hand-edited.

## Glossary

- **Pipeline**: The TypeScript script(s) in `scripts/` that read raw datasets and `character-list.txt` and write `app/public/data/characters.json`.
- **CharacterRecord**: A single JSON object in `characters.json` representing one simplified Chinese character and all its associated data fields.
- **character-list.txt**: The file `data/character-list.txt` containing the curated list of ~300 simplified Chinese characters, one per line, with a recorded source and licence.
- **hanzi-writer-data**: The open-source npm package (Arphic Public License) supplying per-stroke SVG path data and stroke counts.
- **Make Me a Hanzi**: The open-source dataset whose `dictionary.txt` file supplies component decomposition data.
- **CC-CEDICT**: The CC BY-SA 3.0 licensed Chinese–English dictionary supplying pinyin readings and English meanings.
- **Provenance**: A per-field record of which source dataset supplied the value.
- **Missing marker**: A sentinel value (e.g. `null`) written into a CharacterRecord field when the source dataset does not supply a value for that field. Missing values are never guessed or inferred.
- **Decoy component**: A component offered to the player in Build mode that is not part of the target character, used to make the task non-trivial.
- **Decomposition**: The structured breakdown of a character into its constituent visual components as recorded in Make Me a Hanzi `dictionary.txt`.

---

## Requirements

### Requirement 1: Character List Selection

**User Story:** As a developer, I want a curated list of ~300 common simplified Chinese characters stored in `data/character-list.txt`, so that the pipeline has a stable, sourced, licence-compliant input.

#### Acceptance Criteria

1. THE Pipeline SHALL read the character list exclusively from `data/character-list.txt`.
2. THE character-list.txt file SHALL contain between 280 and 320 simplified Chinese characters, one character per line, with no duplicates.
3. THE character-list.txt file SHALL include a `#`-prefixed comment on its first line recording the name of the published frequency or learner list it was derived from, its URL, and an SPDX licence identifier (or the full name of the licence if no SPDX identifier exists).
4. IF a character in `character-list.txt` is not a valid simplified Chinese character (i.e., its Unicode codepoint does not fall within CJK Unified Ideographs U+4E00–U+9FFF), THEN THE Pipeline SHALL emit an error to stderr identifying the offending character and its line number, exit with a non-zero exit code, and produce no output files.
5. WHERE the character source list requires attribution in derivative works, THE README SHALL include that attribution before the pipeline is first run in a production context.

---

### Requirement 2: Raw Dataset Acquisition

**User Story:** As a developer, I want the three required raw datasets present in `data/raw/` with their licence files, so that the pipeline can operate fully offline and licence obligations are visible in the repository.

#### Acceptance Criteria

1. THE repository SHALL contain the hanzi-writer-data stroke dataset under `data/raw/hanzi-writer-data/` with its Arphic Public License file placed in the same directory as the dataset files.
2. THE repository SHALL contain the Make Me a Hanzi `dictionary.txt` decomposition file under `data/raw/make-me-a-hanzi/` with its licence file placed in the same directory as the dataset files.
3. THE repository SHALL contain the CC-CEDICT dictionary file under `data/raw/cc-cedict/` with its CC BY-SA 3.0 licence file placed in the same directory as the dataset files.
4. WHEN the README is committed, IT SHALL include a dedicated section listing all three datasets, each with its name, URL, and licence, and that section SHALL appear before the pipeline usage instructions.
5. IF any required raw dataset file is absent when the Pipeline is invoked, THEN THE Pipeline SHALL emit an error to stderr naming each missing file path, exit with a non-zero status code, and produce no output files.

---

### Requirement 3: Pipeline Script

**User Story:** As a developer, I want a single TypeScript script in `scripts/` that I can run to regenerate `app/public/data/characters.json` from the raw datasets, so that the generated file is always reproducible and never needs to be hand-edited.

#### Acceptance Criteria

1. THE Pipeline SHALL be invokable with a single command (e.g. `npm run build:data`) from the repository root without requiring internet access after the raw datasets are downloaded.
2. THE Pipeline SHALL read `data/character-list.txt`, the hanzi-writer-data stroke files, the Make Me a Hanzi `dictionary.txt`, and the CC-CEDICT dictionary as its only inputs.
3. THE Pipeline SHALL write its output exclusively to `app/public/data/characters.json` and SHALL NOT modify any file in `data/raw/` or `data/character-list.txt`.
4. WHEN the Pipeline is run twice in succession with identical inputs, THE Pipeline SHALL produce byte-for-byte identical output (determinism).
5. THE Pipeline SHALL be written in TypeScript with `strict: true` and SHALL use explicit types for all values whose structure is known at design time; use of `unknown` with a type guard is preferred over `any` when handling untyped source boundaries.
6. IF any required field (`pinyin`, `meanings`, `strokeCount`/`strokeData`, or `decomposition`) is absent from the source datasets for any character in `data/character-list.txt`, THEN THE Pipeline SHALL process all characters before failing, emit to stderr a list of every affected character and which required fields are missing for each, exit with a non-zero status code, and produce no output file.
7. WHEN the Pipeline completes successfully, THE Pipeline SHALL print a summary to stdout stating the total number of characters processed and confirming that all four required fields (`pinyin`, `meanings`, `strokeCount`/`strokeData`, and `decomposition`) are non-null for every character record.

---

### Requirement 4: Character Record Schema

**User Story:** As a developer, I want each character record in `characters.json` to contain a defined set of fields with provenance metadata, so that the app and MCP server can rely on a stable, trustworthy schema.

#### Acceptance Criteria

1. THE Pipeline SHALL produce a `characters.json` file whose top-level value is a JSON object mapping each character string (a single Unicode codepoint in the CJK Unified Ideographs block, U+4E00–U+9FFF) to its CharacterRecord.
2. EACH CharacterRecord SHALL include exactly the following fields: `character` (string, single CJK codepoint), `pinyin` (array of one or more strings — always non-null in a successfully built record), `meanings` (array of one or more strings — always non-null in a successfully built record), `strokeCount` (integer ≥ 1 — always non-null in a successfully built record), `strokeData` (the hanzi-writer path object — always non-null in a successfully built record), `decomposition` (object — always non-null in a successfully built record), and `sources` (object mapping each of the five field names to a dataset identifier string; the `"missing"` sentinel applies only to optional fields not yet present in the schema); any CharacterRecord containing an unrecognised field or missing a required field SHALL cause the Pipeline to exit with a non-zero status code and emit an error message indicating which character and field is invalid.
3. WHEN CC-CEDICT contains one or more entries for a character, THE Pipeline SHALL populate `pinyin` as an array of all distinct pinyin strings found for that character and `meanings` as an array of all distinct meaning strings found for that character, in the order they appear in the dataset.
4. IF CC-CEDICT does not contain any entry for a character, THEN THE Pipeline SHALL record that character as having a missing required field and include it in the build failure list.
5. WHEN hanzi-writer-data contains stroke data for a character, THE Pipeline SHALL populate `strokeCount` as the integer count of strokes in that data and `strokeData` as the verbatim hanzi-writer path object for that character without modification.
6. IF hanzi-writer-data does not contain stroke data for a character, THEN THE Pipeline SHALL record that character as having a missing required field and include it in the build failure list.
7. WHEN Make Me a Hanzi `dictionary.txt` contains a decomposition entry for a character, THE Pipeline SHALL populate `decomposition` as the verbatim parsed object from that entry without modification.
8. IF Make Me a Hanzi `dictionary.txt` does not contain a decomposition entry for a character, THEN THE Pipeline SHALL record that character as having a missing required field and include it in the build failure list.
9. THE Pipeline SHALL NEVER set a field to a value that was generated or inferred by an AI model; every non-null field value SHALL be traceable to a specific line or record in a raw dataset file present in `data/raw/`.
10. THE `sources` object in each CharacterRecord SHALL contain exactly one key per data-bearing field (`pinyin`, `meanings`, `strokeCount`, `strokeData`, `decomposition`); each value SHALL be the dataset identifier string (`"cc-cedict"`, `"hanzi-writer-data"`, or `"make-me-a-hanzi"`) recording which dataset supplied that field; the `"missing"` sentinel is reserved for optional fields not yet present in the schema and SHALL NOT appear as a value for any required field in a successfully built record; a `sources` object with a missing key, an extra key, or an invalid value SHALL cause the Pipeline to exit with a non-zero status code and emit an error message indicating which character and key is invalid.
11. WHEN the Pipeline finishes writing `characters.json`, THE Pipeline SHALL verify that the total number of CharacterRecord entries in the file equals the number of non-empty, non-comment lines in `data/character-list.txt`; IF the counts differ, THEN THE Pipeline SHALL exit with a non-zero status code and emit an error message indicating the expected count and the actual count.

---

### Requirement 5: Dataset Property-Based Tests

**User Story:** As a developer, I want a property-based test suite using fast-check that verifies the invariants of the generated dataset, so that data errors are caught automatically and judges can trust the character data.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a property test asserting that every character listed in `character-list.txt` appears as a key in `characters.json` exactly once.
2. THE Test_Suite SHALL include a property test asserting that every CharacterRecord whose `pinyin` field is non-null contains at least one non-empty pinyin string.
3. THE Test_Suite SHALL include a property test asserting that every CharacterRecord whose `meanings` field is non-null contains at least one non-empty meaning string.
4. THE Test_Suite SHALL include a property test asserting that every CharacterRecord whose `strokeCount` field is non-null has a `strokeCount` value that is an integer greater than zero.
5. THE Test_Suite SHALL include a property test asserting that every component string listed in a CharacterRecord's `decomposition` field is one of: (a) a single Unicode codepoint in the CJK Unified Ideographs block (U+4E00–U+9FFF), (b) an Ideographic Description Character in the range U+2FF0–U+2FFB, or (c) a codepoint explicitly listed as a recognised component placeholder in the Make Me a Hanzi source data (e.g. `？` U+FF1F); any component value not matching one of these three categories SHALL cause the test to fail.
6. THE Test_Suite SHALL include a property test asserting that the sequence of components revealed by the hint engine for a character is a subsequence of (and contains only components drawn from) the non-null leaf components of that character's `decomposition` field as returned by the engine module in `src/engine/`.
7. THE Test_Suite SHALL include a determinism test that invokes the Pipeline function (or reads two separately produced output files) with identical inputs and asserts byte-for-byte string equality between the two resulting `characters.json` contents; "identical inputs" means the same `character-list.txt` content, the same raw dataset files (verified by content hash), and no environment-variable differences that affect output.
8. THE Test_Suite SHALL be runnable with `npm test` from the repository root and SHALL complete without network access after the raw datasets are present in `data/raw/`.
