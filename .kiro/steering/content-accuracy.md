---
inclusion: fileMatch
fileMatchPattern: ["data/**/*", "scripts/**/*", "oracle/**/*", "app/src/data/**/*", "tests/**/*"]
---

# Content accuracy rules (character data)

Judges may not read Chinese, so they cannot spot a wrong character. Correctness must be **proven by the data pipeline and tests**, never assumed.

## Hard rules
1. **Never generate character data with an AI model.** Components, pinyin, meanings, stroke order, stroke counts and Cangjie codes all come from the source datasets via `scripts/`. If a value is missing in the sources, mark it missing; do not guess.
2. **Every field has a source.** Each character record notes which dataset each field came from.
3. **Simplified is the default script.** Traditional forms are only added through the traditional-toggle feature, from source data.
4. **Licences are respected:**
   - CC-CEDICT (pinyin, English definitions): CC BY-SA 3.0. Credit it; any modified dictionary data we publish keeps CC BY-SA.
   - hanzi-writer-data / Make Me a Hanzi graphics (stroke data): Arphic Public License. Keep the licence file with the data.
   - Any other dataset (component decompositions, frequency lists, Cangjie codes from Unicode Unihan) must have its licence checked and recorded in the README **before** it is used.

## Sources to use (verify licence before first use)
- Stroke data: `hanzi-writer-data` (derived from Make Me a Hanzi).
- Component decomposition: Make Me a Hanzi `dictionary.txt` (decomposition / radical fields). Check its licence.
- Pinyin and meanings: CC-CEDICT.
- Cangjie codes (traditional, for Type mode later): Unicode Unihan `kCangjie` field.
- Character selection: a published frequency or learner list. Check its licence.

## Required property-based tests on the dataset
- Every character in `character-list.txt` exists in the generated dataset, exactly once.
- Every character has stroke data, at least one pinyin reading and at least one meaning.
- Every component listed for a character is a valid single character or recognised component.
- Hint order is consistent with the decomposition (hints never reveal a component that is not part of the character).
- In Build mode, the correct component set for a character is always present among the offered options, and decoys never include an exact duplicate of a correct component.
- The dataset build is deterministic: running the pipeline twice produces identical output.

## Manual review
- A human spot-checks a random sample of characters (meaning, pinyin, components) before each deploy and records the result in `kiro-log.md`.
