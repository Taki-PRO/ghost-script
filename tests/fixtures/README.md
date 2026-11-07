# Test fixtures

Fixtures used by the unit test suite. Every line in these files is copied
**verbatim** from a real source dataset — none are invented. Provenance is
recorded below so a reviewer can re-derive each line from the originals.

## `make-me-a-hanzi/sample-dictionary.txt`

Three lines copied verbatim from `data/raw/make-me-a-hanzi/dictionary.txt`
(Make Me a Hanzi `dictionary.txt`; licence GNU LGPL v3.0-or-later, see
`data/raw/make-me-a-hanzi/LICENSE` and `data/raw/SOURCES.md`).

> Note: `data/raw/SOURCES.md` does not yet record the upstream commit SHA for
> the Make Me a Hanzi `dictionary.txt`. Provenance here is given as the local
> file path + line number so the lines can be verified against the copy in the
> repository. The commit SHA should be backfilled in `SOURCES.md`.

| Line in fixture | Character | Source line in `dictionary.txt` | Why it is included |
|---|---|---|---|
| 1 | `我` | line 2572 | Non-atomic entry with a normal IDS decomposition (`⿰扌戈`); two leaf components `扌`, `戈`. |
| 2 | `一` | line 41 | Atomic entry — `decomposition` is exactly `？` (U+FF1F). |
| 3 | `㐆` | line 10 | Non-atomic entry whose IDS string contains an **interior** `？` (`⿻尸？`); the `？` must be excluded from components, leaving `尸`. |

Line numbers are 1-indexed against `data/raw/make-me-a-hanzi/dictionary.txt`
as present in this repository.
