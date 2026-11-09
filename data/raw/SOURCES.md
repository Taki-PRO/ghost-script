# Raw Dataset Sources

This file records the provenance and licence of every raw dataset in `data/raw/`.

## hanzi-writer-data
- **Version:** 2.0.1
- **Source URL:** https://www.npmjs.com/package/hanzi-writer-data
- **Data URL:** https://github.com/chanind/hanzi-writer-data
- **Licence:** Arphic Public License
- **Licence file:** data/raw/hanzi-writer-data/LICENSE
- **Used for:** stroke data (strokes, medians, radStrokes) per character
## Make Me a Hanzi (`dictionary.txt`)
- **Commit SHA:** bddc96d41bef78427ed0e034e9f7e31d71fd1b92
- **Source URL:** https://github.com/skishore/makemeahanzi
- **File:** dictionary.txt
- **Licence:** GNU LGPL v3.0 or later (dictionary.txt); Unihan-derived data also carries the Unicode notice in `LGPL`. The Arphic Public License in the same repo covers `graphics.txt`, which we do not use.
- **Licence files:** data/raw/make-me-a-hanzi/LICENSE (the repo's COPYING), data/raw/make-me-a-hanzi/LGPL (full text, copied from the repo at the pinned commit)
- **Used for:** decomposition (IDS), radical, etymology, atomic flag and components

## CC-CEDICT
- **Release:** 2026-11-06T08:10:12Z (from the file header), 125,369 entries
- **Source URL:** https://www.mdbg.net/chinese/dictionary?page=cc-cedict
- **File:** cedict_ts.u8
- **Licence:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), as stated in the file header
- **Licence file:** data/raw/cc-cedict/LICENSE
- **Used for:** pinyin readings and English meanings

## Character list (HSK 3.0 writing level 1)
- **Commit SHA:** 4ff9e3915ce87baaecd7ebe263085573a4ea3192
- **Source URL:** https://github.com/ivankra/hsk30
- **File:** hsk30-chars.csv (rows where WritingLevel == 1)
- **Licence:** MIT
- **Original standard:** Ministry of Education GF0025-2021 (2021)
- **Licence file:** data/raw/hsk30/LICENSE (copied from the repo at the pinned commit)
- **Used for:** character-list.txt (the ~300 characters taught in the app)
