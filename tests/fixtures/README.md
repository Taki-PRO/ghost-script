# Test fixtures

Fixtures used by the unit test suite. Every line in these files is copied
**verbatim** from a real source dataset — none are invented. Provenance is
recorded below so a reviewer can re-derive each line from the originals.

## `make-me-a-hanzi/sample-dictionary.txt`

Three lines copied verbatim from `data/raw/make-me-a-hanzi/dictionary.txt`
(Make Me a Hanzi `dictionary.txt`; licence GNU LGPL v3.0-or-later, see
`data/raw/make-me-a-hanzi/LICENSE` and `data/raw/SOURCES.md`).

> Upstream commit: `bddc96d41bef78427ed0e034e9f7e31d71fd1b92` (recorded in `data/raw/SOURCES.md`).
> The lines keep the source's non-breaking spaces (U+00A0) exactly; an earlier
> version had normalised them to ordinary spaces.

| Line in fixture | Character | Source line in `dictionary.txt` | Why it is included |
|---|---|---|---|
| 1 | `我` | line 2572 | Non-atomic entry with a normal IDS decomposition (`⿰扌戈`); two leaf components `扌`, `戈`. |
| 2 | `一` | line 41 | Atomic entry — `decomposition` is exactly `？` (U+FF1F). |
| 3 | `㐆` | line 10 | Non-atomic entry whose IDS string contains an **interior** `？` (`⿻尸？`); the `？` must be excluded from components, leaving `尸`. |

Line numbers are 1-indexed against `data/raw/make-me-a-hanzi/dictionary.txt`
as present in this repository.

## `cc-cedict/sample-cedict.u8`

Data lines copied **verbatim** from `data/raw/cc-cedict/cedict_ts.u8`
(CC-CEDICT; licence CC BY-SA 4.0, see `data/raw/cc-cedict/LICENSE` and
`data/raw/SOURCES.md`). The `#`-prefixed header lines illustrate comment
handling and are not real dictionary entries.

| Character in fixture | Source line(s) in `cedict_ts.u8` | Why it is included |
|---|---|---|
| `人` | `人 人 [ren2] /...` | Single-entry baseline. |
| `了` | lines 4605 (`了 了 [le5] /...`) and 4606 (`了 了 [liao3] /...`) | Multiple source entries whose readings differ (`le5`, `liao3`); exercises per-entry `entries` retention. |
| `口` | `口 口 [kou3] /...` | Single-entry baseline with multiple glosses. |
| `行` | three lines `行 行 [hang2] /...`, `行 行 [heng2] /...`, `行 行 [xing2] /...` | Three source entries in file order; exercises both flat dedup and `entries` ordering. |
| `三` | lines 1187 (`三 三 [San1] /surname San/`) and 1188 (`三 三 [san1] /three/3/`) | A proper-noun reading (`San1`) entry followed by a usable entry; the default selector must skip the surname entry and choose "three" with reading `sān`. |
| `后` | lines 20366 (`后 后 [Hou4] /surname Hou/`) and 20367 (`后 后 [hou4] /empress/queen/.../`) | Proper-noun reading first, then a usable entry; meaning and reading (`hòu`) come from the same entry. |
| `号` | lines 97073 (`號 号 [hao2] /(bound form) to wail; to howl/`) and 97074 (`號 号 [hao4] /.../`) | Simplified `号` (traditional `號`); first usable gloss is `(bound form) to wail; to howl` on the `hao2` entry, stripped to "to wail; to howl". |
| `中` | lines 3263–3265 (`中 中 [Zhong1] /...`, `中 中 [zhong1] /...`, `中 中 [zhong4] /...`) | Proper-noun reading (`Zhong1`) entry, then a usable `zhong1` entry whose first gloss "within; among; in" is chosen with reading `zhōng`. |

Line numbers for `了` (4605–4606), `三` (1187–1188), `后` (20366–20367),
`号`/`號` (97073–97074), and `中` (3263–3265) are 1-indexed against
`data/raw/cc-cedict/cedict_ts.u8` as present in this repository.

## `unihan/`
### `unihan/valid.txt` (real data)
Lines copied **verbatim** from `data/raw/unihan/Unihan_DictionaryLikeData.txt`
(Unicode Unihan database, Unicode 18.0.0, dated 2026-07-31; Unicode License V3,
see `data/raw/unihan/LICENSE` and `data/raw/SOURCES.md`). Line numbers are
1-indexed against that file as present in this repository, and lines keep
their source order.

| Source line(s) | Content | Why it is included |
|---|---|---|
| 1–25 | Header comment lines | Comment handling. |
| 40–41 | `㐆` kCangjie, kMojiJoho | Character from the Make Me a Hanzi fixture. |
| 15731, 15732, 15737 | `一` kCangjie, kFenn, kMojiJoho | Used by several fixtures. |
| 15782–15783 | `三` kCangjie, kFenn | Character from the CC-CEDICT fixture. |
| 15992–15993 | `中` kCangjie, kFenn | Character from the CC-CEDICT fixture. |
| 16412–16413 | `了` kCangjie, kFenn | Character from the CC-CEDICT fixture. |
| 16701–16702 | `人` kCangjie, kFenn | Used by several fixtures. |
| 23534–23535 | `口` kCangjie, kFenn | Character from the CC-CEDICT fixture. |
| 23676, 23678 | `号` kCangjie, kMojiJoho | Character from the CC-CEDICT fixture. |
| 23806–23807 | `后` kCangjie, kFenn | Character from the CC-CEDICT fixture. |
| 41747–41748, 41752 | `我` kCangjie, kFenn, kMojiJoho | Used by several fixtures. |
| 89778–89779 | `行` kCangjie, kFenn | Character from the CC-CEDICT fixture. |

Lines 23676 and 23678 are not adjacent in the source (line 23677 is a
`kFourCornerCode` line that is left out).

### Synthetic fixtures (not real Unihan data)
These three files are **synthetic**: hand-written to exercise parser and build
error paths. They contain no claim about real Unihan values.

- `unihan/malformed-value.txt`: `kCangjie` lines with values that are not valid codes (`m1`, empty, `R S`).
- `unihan/duplicate-value.txt`: two `kCangjie` lines for the same character (`我`).
- `unihan/missing-character.txt`: a character (`人`) with other fields but no `kCangjie` line.
