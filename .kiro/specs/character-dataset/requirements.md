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
- **Atomic character**: A character whose `decomposition` field in Make Me a Hanzi starts with `？` (U+FF1F), meaning it cannot be meaningfully broken into sub-components. Examples: 一, 人, 口. An atomic character is not missing decomposition data — it has a valid decomposition entry; that entry simply communicates indivisibility.
- **Placeholder component**: The full-width question mark `？` (U+FF1F) used by Make Me a Hanzi inside an IDS decomposition string to represent an unrecognised or unnamed component. Placeholder characters must never appear in the `components` array of a CharacterRecord.
- **Prompt**: The per-character `prompt` field shown to the player as the ghost's clue. It contains a single chosen English `meaning` and a single chosen tone-mark `pinyin` reading, both selected from that character's own CC-CEDICT source data.
- **Numbered pinyin**: CC-CEDICT's pinyin notation using trailing tone digits 1–5 (e.g. `shang3`). The tone-mark form places the diacritic on the correct vowel (e.g. `shǎng`); tone 5 (neutral) carries no mark.
- **CC-CEDICT entry (sense group)**: One source line in CC-CEDICT for a character, consisting of a single reading and that reading's ordered list of English glosses. A character may have several entries (e.g. 了 has a `liao3` entry and a `le5` entry). A prompt's meaning and reading MUST come from the same entry.
- **Skipped-prefix meaning**: A CC-CEDICT meaning the prompt selector must not choose as the default because it is not a usable standalone gloss. The skip list is: meanings beginning (case-insensitively) with `surname `, `variant of`, `old variant of`, `used in`, `see `, `abbr.`, `CL:`, `also pr.`, or `Taiwan pr.`.
- **Proper-noun reading**: A CC-CEDICT pinyin reading whose first syllable is capitalised (e.g. `San` in `surname San`), indicating a proper noun; the prompt selector skips these when choosing a default reading.
- **Prompt override**: A human-authored row in `data/prompt-overrides.csv` that selects, BY INDEX only, which existing CC-CEDICT sense to use for a character's prompt. It names an `entryIndex` (which source entry) and a `meaningIndex` (which gloss within that entry); the reading is that entry's reading. An override can never introduce free-text meaning or pinyin.
- **Prompt review file**: The generated `data/prompt-review.csv` listing all characters with the chosen meaning and reading plus all alternatives, for human spot-checking. It is an output artefact, not an input to the build.

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
2. EACH CharacterRecord SHALL include exactly the following fields: `character` (string, single CJK codepoint), `pinyin` (array of one or more strings — always non-null in a successfully built record), `meanings` (array of one or more strings — always non-null in a successfully built record), `strokeCount` (integer ≥ 1 — always non-null in a successfully built record), `strokeData` (the hanzi-writer path object — always non-null in a successfully built record), `decomposition` (object — always non-null in a successfully built record), `prompt` (object with `meaning` string and `pinyin` tone-mark string — always non-null in a successfully built record), and `sources` (object mapping each of the five field names to a dataset identifier string; the `"missing"` sentinel applies only to optional fields not yet present in the schema). The `decomposition` object SHALL include an `atomic` boolean field and a `components` array field (see Requirement 4, AC7 and AC7a). Any CharacterRecord containing an unrecognised field or missing a required field SHALL cause the Pipeline to exit with a non-zero status code and emit an error message indicating which character and field is invalid. The `prompt` object's provenance is CC-CEDICT via the deterministic selection rule in Requirement 6; it is derived from the `meanings`/`pinyin` already sourced from CC-CEDICT and therefore does not add a new `sources` key.
3. WHEN CC-CEDICT contains one or more entries for a character, THE Pipeline SHALL populate `pinyin` as an array of all distinct pinyin strings found for that character and `meanings` as an array of all distinct meaning strings found for that character, in the order they appear in the dataset; AND THE Pipeline SHALL additionally retain the per-entry senses as an ordered list, each element pairing one entry's reading with that entry's ordered glosses, in source order, for use by prompt selection (Requirement 6). The flat `pinyin`/`meanings` lists remain the record fields; the per-entry senses are used only to choose the prompt.
4. IF CC-CEDICT does not contain any entry for a character, THEN THE Pipeline SHALL record that character as having a missing required field and include it in the build failure list.
5. WHEN hanzi-writer-data contains stroke data for a character, THE Pipeline SHALL populate `strokeCount` as the integer count of strokes in that data and `strokeData` as the verbatim hanzi-writer path object for that character without modification.
6. IF hanzi-writer-data does not contain stroke data for a character, THEN THE Pipeline SHALL record that character as having a missing required field and include it in the build failure list.
7. WHEN Make Me a Hanzi `dictionary.txt` contains a decomposition entry for a character whose `decomposition` string does NOT start with `？`, THE Pipeline SHALL classify the character as non-atomic, extract the leaf components (all codepoints found in the IDS string that fall within any of the following blocks: CJK Unified Ideographs U+4E00–U+9FFF, CJK Extension A U+3400–U+4DBF, CJK Radicals Supplement U+2E80–U+2EFF, Kangxi Radicals U+2F00–U+2FDF, or CJK Strokes U+31C0–U+31EF; excluding IDCs U+2FF0–U+2FFB and excluding the `？` placeholder U+FF1F), set `decomposition.atomic` to `false`, and set `decomposition.components` to the ordered array of those leaf components.
8. WHEN Make Me a Hanzi `dictionary.txt` contains a decomposition entry for a character whose `decomposition` string starts with `？`, THE Pipeline SHALL classify the character as atomic, set `decomposition.atomic` to `true`, and set `decomposition.components` to a single-element array containing the character itself. The pipeline SHALL NOT treat an atomic entry as missing decomposition data and SHALL NOT include the character in the build failure list for this reason.
9. IF Make Me a Hanzi `dictionary.txt` contains NO entry at all for a character, THEN THE Pipeline SHALL record that character as having a missing required field and include it in the build failure list.
10. THE Pipeline SHALL NEVER set a field to a value that was generated or inferred by an AI model; every non-null field value SHALL be traceable to a specific line or record in a raw dataset file present in `data/raw/`.
11. THE `sources` object in each CharacterRecord SHALL contain exactly one key per data-bearing field (`pinyin`, `meanings`, `strokeCount`, `strokeData`, `decomposition`); each value SHALL be the dataset identifier string (`"cc-cedict"`, `"hanzi-writer-data"`, or `"make-me-a-hanzi"`) recording which dataset supplied that field; the `"missing"` sentinel is reserved for optional fields not yet present in the schema and SHALL NOT appear as a value for any required field in a successfully built record; a `sources` object with a missing key, an extra key, or an invalid value SHALL cause the Pipeline to exit with a non-zero status code and emit an error message indicating which character and key is invalid.
12. WHEN the Pipeline finishes writing `characters.json`, THE Pipeline SHALL verify that the total number of CharacterRecord entries in the file equals the number of non-empty, non-comment lines in `data/character-list.txt`; IF the counts differ, THEN THE Pipeline SHALL exit with a non-zero status code and emit an error message indicating the expected count and the actual count.

---

### Requirement 5: Dataset Property-Based Tests

**User Story:** As a developer, I want a property-based test suite using fast-check that verifies the invariants of the generated dataset, so that data errors are caught automatically and judges can trust the character data.

#### Acceptance Criteria

1. THE Test_Suite SHALL include a property test asserting that every character listed in `character-list.txt` appears as a key in `characters.json` exactly once.
2. THE Test_Suite SHALL include a property test asserting that every CharacterRecord whose `pinyin` field is non-null contains at least one non-empty pinyin string.
3. THE Test_Suite SHALL include a property test asserting that every CharacterRecord whose `meanings` field is non-null contains at least one non-empty meaning string.
4. THE Test_Suite SHALL include a property test asserting that every CharacterRecord whose `strokeCount` field is non-null has a `strokeCount` value that is an integer greater than zero.
5. THE Test_Suite SHALL include a property test asserting that no string in any CharacterRecord's `decomposition.components` array is the placeholder character `？` (U+FF1F) or any IDC character (U+2FF0–U+2FFB); every element of `components` SHALL be a single codepoint whose value falls within one of the following allowed blocks: CJK Unified Ideographs U+4E00–U+9FFF, CJK Extension A U+3400–U+4DBF, CJK Radicals Supplement U+2E80–U+2EFF, Kangxi Radicals U+2F00–U+2FDF, or CJK Strokes U+31C0–U+31EF.
6. THE Test_Suite SHALL include a property test asserting that for every CharacterRecord where `decomposition.atomic` is `true`, the `decomposition.components` array has exactly one element and that element is identical to the record's `character` field.
7. THE Test_Suite SHALL include a property test asserting that the sequence of components revealed by the hint engine for a character is a subsequence of (and contains only components drawn from) the non-null leaf components of that character's `decomposition` field as returned by the engine module in `src/engine/`.
8. THE Test_Suite SHALL include a determinism test that invokes the Pipeline function (or reads two separately produced output files) with identical inputs and asserts byte-for-byte string equality between the two resulting `characters.json` contents; "identical inputs" means the same `character-list.txt` content, the same raw dataset files (verified by content hash), and no environment-variable differences that affect output.
9. THE Test_Suite SHALL be runnable with `npm test` from the repository root and SHALL complete without network access after the raw datasets are present in `data/raw/`.

---

### Requirement 6: Per-Character Ghost Prompt

**User Story:** As a player, I want each ghost to show a clear English meaning and a readable tone-mark pinyin, so that the clue is usable and not a surname, abbreviation, or grammatical note.

#### Acceptance Criteria

1. EACH CharacterRecord SHALL include a `prompt` object with exactly two fields: `meaning` (a non-empty string) and `pinyin` (a non-empty string written with tone marks, e.g. `shàng`).
2. THE `prompt.meaning` value SHALL be one of the character's own CC-CEDICT `meanings` strings, except that a single leading `(bound form) ` prefix MAY be stripped from the chosen meaning; after any such stripping the result SHALL be non-empty.
3. THE `prompt.pinyin` value SHALL be the tone-mark rendering of one of the character's own CC-CEDICT numbered `pinyin` readings; the pipeline SHALL convert the numbered form (tone digits 1–5) to the tone-mark form and SHALL NOT introduce a reading absent from the source data.
4. WHEN no human override applies to a character, THE Pipeline SHALL choose the default `prompt` deterministically by walking the character's CC-CEDICT entries IN SOURCE ORDER and, for each entry in turn: (a) skip the entry if its reading is a proper-noun (capitalised-first-syllable) reading; (b) within the entry, consider glosses in source order, stripping a single leading `(bound form) ` prefix for comparison and output, and skip any gloss that after stripping begins case-insensitively with a skipped prefix (`surname `, `variant of`, `old variant of`, `used in`, `see `, `abbr.`, `CL:`, `also pr.`, `Taiwan pr.`); (c) the FIRST entry that yields a usable gloss determines BOTH the prompt meaning (that gloss) AND the prompt pinyin (that entry's reading, tone-mark form). The meaning and reading therefore always come from the same entry.
5. IF, after applying the skip rules, a character has no remaining usable meaning OR no usable reading, THEN THE Pipeline SHALL record that character as having a prompt-selection failure, include it in the build failure list with the reason, exit non-zero, and produce no output file (the human must add an override).
6. THE Pipeline SHALL read human prompt overrides exclusively from `data/prompt-overrides.csv`, whose columns SHALL be `character`, `entryIndex`, `meaningIndex`, and `reviewedBy`. An override SHALL select an existing CC-CEDICT sense for that character BY ZERO-BASED INDEX only — `entryIndex` names the source entry and `meaningIndex` names the gloss within that entry; the reading is that entry's reading. An override SHALL NOT contain free-text meaning or pinyin.
7. IF a prompt-override row references a `character` not in `character-list.txt`, OR an `entryIndex` outside the range of that character's CC-CEDICT entries, OR a `meaningIndex` outside the range of the glosses within the selected entry, OR an empty `reviewedBy`, THEN THE Pipeline SHALL emit an error identifying the offending row, exit non-zero, and produce no output file.
8. WHEN a valid override exists for a character, THE Pipeline SHALL use the override-selected entry's reading and the override-selected gloss within that entry (with `(bound form) ` stripping still applied) in preference to the deterministic default; the meaning and reading therefore still come from the same entry.
9. WHEN the Pipeline runs, IT SHALL also write `data/prompt-review.csv` listing every character in `character-list.txt` with: the character, the chosen meaning, the chosen tone-mark pinyin, whether the choice came from an override or the default rule, and all alternative senses grouped by CC-CEDICT entry, with each entry's reading shown next to its group of glosses. This file is an output for human review and SHALL NOT be read back as a pipeline input.
10. THE prompt selection and tone-mark conversion SHALL be deterministic: identical inputs (character list, raw datasets, overrides file) SHALL produce byte-for-byte identical `prompt` fields and `prompt-review.csv`.
11. THE Pipeline SHALL NEVER set `prompt.meaning` or `prompt.pinyin` to a value generated or inferred by an AI model; both SHALL be traceable to a specific CC-CEDICT reading/meaning for that character (tone-mark conversion and `(bound form) ` stripping are permitted mechanical transforms).
12. THE `prompt.meaning` and `prompt.pinyin` of every successfully built CharacterRecord SHALL originate from the SAME CC-CEDICT entry: the chosen gloss SHALL be one of the glosses of the entry whose reading (in tone-mark form) equals `prompt.pinyin`.
