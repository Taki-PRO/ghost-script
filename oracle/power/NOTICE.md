# Cangjie Oracle Power: notice

This folder is generated. `server.mjs` is the bundled Cangjie Oracle server and `data/oracle-data.json` is a derived copy of the Cangjie code and decomposition fields of the three level datasets. To rebuild both, run `npm run build:power` in the repository root.

## Data sources

| Source | Version | Fields used | Licence | URL |
| --- | --- | --- | --- | --- |
| Unihan (`Unihan_DictionaryLikeData.txt`) | Unicode 18.0.0 | `kCangjie` (Cangjie codes) | Unicode License V3 | https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip |
| Make Me a Hanzi (`dictionary.txt`) | commit bddc96d41bef78427ed0e034e9f7e31d71fd1b92 | decomposition, radical, components, atomic flag | GNU LGPL v3.0 or later (LGPL-3.0-or-later) | https://github.com/skishore/makemeahanzi |

`data/oracle-data.json` is data derived from these two sources and keeps their terms: the Cangjie codes stay under the Unicode License V3 and the decomposition fields stay under LGPL-3.0-or-later. The code of this repository, including the code in `server.mjs` that is not from a package listed below, is MIT.

The data file contains no CC-CEDICT, Arphic or HSK list data.

Licence texts: `licenses/unihan-LICENSE.txt`, `licenses/make-me-a-hanzi-LICENSE.txt` and `licenses/make-me-a-hanzi-LGPL.txt`.

## npm packages bundled in `server.mjs`

| Package | Version | Licence | Licence file |
| --- | --- | --- | --- |
| @modelcontextprotocol/sdk | 1.32.2 | MIT | licenses/npm-modelcontextprotocol-sdk-LICENSE.txt |
| ajv | 8.20.0 | MIT | licenses/npm-ajv-LICENSE.txt |
| ajv-formats | 3.0.1 | MIT | licenses/npm-ajv-formats-LICENSE.txt |
| fast-deep-equal | 3.1.3 | MIT | licenses/npm-fast-deep-equal-LICENSE.txt |
| fast-uri | 3.1.9 | BSD-3-Clause | licenses/npm-fast-uri-LICENSE.txt |
| json-schema-traverse | 1.0.0 | MIT | licenses/npm-json-schema-traverse-LICENSE.txt |
| zod | 4.6.7 | MIT | licenses/npm-zod-LICENSE.txt |
| zod-to-json-schema | 3.25.2 | ISC | licenses/npm-zod-to-json-schema-LICENSE.txt |
