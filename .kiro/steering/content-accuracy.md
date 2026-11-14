---
inclusion: fileMatch
fileMatchPattern: ["data/**/*", "scripts/**/*", "oracle/**/*", "app/src/data/**/*", "tests/**/*", ".kiro/specs/**/*"]
---

# Content accuracy rules (character data)

Judges may not read Chinese, so they cannot spot a wrong character. Correctness must be **proven by the data pipeline and tests**, never assumed.

## Hard rules
1. **Never generate character data with an AI model.** Components, pinyin, meanings, stroke order, stroke counts and Cangjie codes all come from the source datasets via `scripts/`. If a value is missing in the sources, mark it missing; do not guess.
2. **Every field has a source.** Each character record notes which dataset each field came from.
3. **Simplified is the default script.** Traditional forms are only added through the traditional-toggle feature, from source data.
4. **Licences are respected** (verified from the downloaded files, Nov 7 2026; details in `data/raw/SOURCES.md`):
   - CC-CEDICT (pinyin, English definitions): **CC BY-SA 4.0**, as stated in the file header. Credit it; any modified dictionary data we publish keeps CC BY-SA 4.0.
   - hanzi-writer-data 2.0.1 (stroke data): **Arphic Public License**. Keep the licence file with the data.
   - Make Me a Hanzi `dictionary.txt` (decompositions, radicals, etymology): **GNU LGPL v3.0 or later**. Keep the licence file with the data; data derived from it in `characters.json` stays under LGPL-3.0-or-later.
   - HSK 3.0 character list (`ivankra/hsk30`): **MIT**, transcribed from the Ministry of Education standard GF0025-2021.
   - `characters.json` combines all of the above, so the README must state that it carries each source's licence terms for its fields. Our own code stays MIT.
   - Any new dataset must have its licence checked and recorded in `data/raw/SOURCES.md` and the README **before** it is used.

## Sources to use (verify licence before first use)
- Stroke data: `hanzi-writer-data` (derived from Make Me a Hanzi).
- Component decomposition: Make Me a Hanzi `dictionary.txt` (decomposition / radical fields). Check its licence.
- Pinyin and meanings: CC-CEDICT.
- Cangjie codes: Unicode Unihan `kCangjie` field (Unicode 18.0.0, Unicode License V3). Unihan codes simplified forms directly, so no traditional mapping is needed.
- Cangjie history: only these claims may appear in the app, each citing the English Wikipedia articles "Cangjie input method" and "Chu Bong-Foo": invented in 1976 by Chu Bong-Foo; named after Cangjie, the legendary inventor of Chinese writing; the first Chinese input method to use the standard QWERTY keyboard; released to the public in 1982. Nothing else (no usage statistics, no claims that it is "dying") without a new source.
- Character selection: HSK 3.0 handwriting characters (书写字), writing level 1 (exactly 300), from `ivankra/hsk30` `hsk30-chars.csv`, column `WritingLevel`.

## Required property-based tests on the dataset
- Every character in `character-list.txt` exists in the generated dataset, exactly once.
- Every character has stroke data, at least one pinyin reading and at least one meaning.
- Every component listed for a character is a valid single character or recognised component.
- Hint order is consistent with the decomposition (hints never reveal a component that is not part of the character).
- In the Cangjie Séance, the expected code is always the verbatim Unihan `kCangjie` value; the app never derives or guesses a code.
- The dataset build is deterministic: running the pipeline twice produces identical output.

## Manual review
- A human spot-checks a random sample of characters (meaning, pinyin, components) before each deploy and records the result in `kiro-log.md`.
