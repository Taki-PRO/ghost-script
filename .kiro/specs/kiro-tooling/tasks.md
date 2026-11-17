# Implementation Plan: kiro-tooling

## Overview

Build the three Kiro-native tools in small steps: the data check (pipeline message, runner script, hook), the read-only accuracy-reviewer agent, and the Cangjie Oracle MCP server with its workspace registration. Then package the Oracle as a Power (last, skippable), document everything, log the Kiro usage, and run the final checks. A follow-up (tasks 10 to 12) makes the Power self-contained: a bundled server, its own data copy, a build script, staleness and standalone tests, and a human re-test of the import. All tests are Vitest unit tests; no property-based tests are added (decision of Nov 15 in `tech.md`). The design is TypeScript, so no language question applies. Do not touch `app/public/data/characters.json`.

## Tasks

- [x] 1. Data check pipeline: clear override failure and check runner
  - [x] 1.1 Improve the override failure message in `scripts/build-data.ts`
    - Add `const OVERRIDE_ERROR_HELP: Record<PromptOverrideFailure, string>` with one plain-words message per reason, each naming `data/prompt-overrides.csv` and the column to fix (`entryIndex` or `meaningIndex`, or "remove the row or add the character to `data/character-list.txt`" for `unknown-character`)
    - Export `formatError` and use the map for `overrideError`; keep the `missing:` and `prompt:` parts unchanged; do not change `buildDataset`, the types or the written files
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.2 Write unit tests `tests/unit/build-override-errors.test.ts`
    - Reuse the temporary-directory fixture approach of `tests/unit/build-summary.test.ts`
    - Cases: `entryIndex` too large, `entryIndex` negative, `meaningIndex` too large, unknown character, each returns `ok: false` with the right `overrideError` and character and no `output`; a valid override still builds
    - `formatError` text contains the character, the reason, `data/prompt-overrides.csv` and the column name
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.3_

  - [x] 1.3 Create `scripts/data-check.ts` and the npm scripts
    - Export `CheckStep`, `StepResult`, `StepRunner`, `CheckOutcome`, `DATA_CHECK_STEPS`, `runDataCheck`, `tailLines` as in the design
    - Real runner: `spawnSync('npm', ['run', ...], { encoding: 'utf8', cwd: repo root })`, output = stdout + stderr; run `main()` only under the ESM direct-execution guard
    - Add root `package.json` scripts `test:data` (`vitest run --project node`) and `check:data` (`tsx scripts/data-check.ts`)
    - _Requirements: 1.4, 1.5, 1.6, 1.7_

  - [x] 1.4 Write unit tests `tests/unit/data-check.test.ts`
    - Fake `StepRunner`: both pass (exit 0, first line `DATA CHECK PASSED`); build fails (exit 1, tests not run, stderr starts `DATA CHECK FAILED`, names `build:data`, at most 40 tail lines); tests fail (names `test:data`); `status: null` fails
    - `tailLines` with fewer lines than the count, exact count, and empty text
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 9.1, 9.3_

- [x] 2. Agent hook for the data check
  - [x] 2.1 Create `.kiro/hooks/data-check-on-save.json`
    - Hook "Data check on save": trigger `PostFileSave`, matcher `(^|/)data/(character-list\\.txt|prompt-overrides\\.csv|raw/.+)$`, command action `npm run check:data --silent`, `timeout` 300
    - Create the file with the file tools (not through the IDE form) so the JSON matches the design exactly
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Write unit tests `tests/unit/kiro-hook.test.ts`
    - Parse the hook file: `version` `v1`, trigger, action type and command, timeout 300
    - Matcher accepts `data/character-list.txt`, `data/prompt-overrides.csv` and a `data/raw/**` file, both relative and absolute; rejects `app/public/data/characters.json`, `data/prompt-review.csv` and `app/src/App.tsx`
    - Root `package.json` defines `check:data` and `test:data`
    - _Requirements: 1.1, 1.2, 1.3, 9.1, 9.3_

- [x] 3. Accuracy reviewer agent
  - [x] 3.1 Create `.kiro/agents/accuracy-reviewer.json` and `.kiro/agents/accuracy-reviewer.prompt.txt`
    - Config as in the design: `tools: ["read"]`, `deny` rules for `fs_write` and `shell`, `includeMcpJson: false`, resources `content-accuracy.md`, `product.md`, `data/raw/SOURCES.md`, prompt via `file://./accuracy-reviewer.prompt.txt`
    - Prompt: the five rules, the four History_Claims, the licence list, the Answer_Leak definition, and the output format `path:line  [rule]  "quoted text"` or `No findings` plus the files checked; the agent never proposes replacement character data
    - Keep the prompt as `.txt` so Kiro does not read it as an agent definition
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 3.2 Write unit tests `tests/unit/accuracy-reviewer-agent.test.ts`
    - Config: `tools` equals `["read"]`; `deny` rules for `fs_write` and `shell`; no `allow` rule for either; `content-accuracy.md` in `resources`; prompt file exists
    - Prompt text mentions each History_Claims topic, "dead", "dying", the five licences, "answer", `path:line` and `No findings`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.3_

- [x] 4. Cangjie Oracle MCP server
  - [x] 4.1 Scaffold the `oracle` workspace
    - Create `oracle/package.json` (private, `type: module`), `oracle/tsconfig.json` (strict; include `oracle/src`, `oracle/tests` and the two files `app/src/engine/cangjieRules.ts` and `app/src/data/types.ts`) and `oracle/vitest.config.ts` (project name `oracle`, environment `node`, include `tests/**/*.test.ts`)
    - Add `oracle` to the root `workspaces`, add the root script `oracle` (`tsx oracle/src/index.ts`), add `./oracle` to `vitest.workspace.ts`
    - Install `@modelcontextprotocol/sdk` 1.32.2 (v1, decided) and a compatible `zod` with exact pinned versions, and record both versions in the task notes
    - Installed versions (exact, in `oracle/package.json`): `@modelcontextprotocol/sdk` 1.32.2, `zod` 4.6.7 (the SDK's peer range is `^3.25 || ^4.0`)
    - _Requirements: 4.1, 9.2_

  - [x] 4.2 Implement `oracle/src/dataset.ts` and `oracle/src/oracle.ts`
    - `loadDataset` and `OracleDataError` (missing file, invalid JSON, wrong shape; message names the path); default path from `import.meta.url`
    - `CANGJIE_SOURCE`, result types, `OracleInputError`, `parseCharacterInput`, `parseCodeInput` (convert to upper case, then validate with `isValidCangjieCode`, return the normalised code), `lookup`, `verify` (result includes `normalisedCode`), `decompose` as in the design, importing `isPlayableInCangjie`, `isValidCangjieCode` and `CharacterRecord` from `app/src` by relative path
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_

  - [x] 4.3 Write unit tests `oracle/tests/oracle.test.ts`
    - Small in-memory dataset: `lookup` (coded, X-prefixed, null code, not in dataset), `verify` (no-code), `decompose` (atomic, composite), every invalid input listed in the design throws `OracleInputError`
    - `verify` cases: `("我", "hqi")` → `matches: true`, `normalisedCode: "HQI"`; wrong valid code → `matches: false`; `"hqz"` and `"abcdef"` (invalid after normalising) → error; unknown character → not-found (`found: false`, `not-in-dataset`)
    - Exhaustive loop over the real `app/public/data/characters.json` (300 records): `lookup`, `verify` and `decompose` return the stored values verbatim; `playable` equals `isPlayableInCangjie`; `source` is non-null exactly when `sources.cangjie` is `unihan`
    - Check that `data/raw/SOURCES.md` states Unicode version 18.0.0, matching `CANGJIE_SOURCE.version`
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 9.1, 9.3_

  - [x] 4.4 Implement `oracle/src/server.ts` and `oracle/src/index.ts`
    - `createServer(dataset)` registers `lookup`, `verify`, `decompose` with descriptions, zod input shapes, JSON text content plus `structuredContent`, and `isError: true` for `OracleInputError`; check the exact `registerTool` signature against the installed SDK version
    - `index.ts`: load the dataset, connect `StdioServerTransport`; on `OracleDataError` write the message to stderr and set exit code 1; no stdout writes of its own
    - _Requirements: 4.1, 4.2, 5.3, 5.5, 5.6, 5.7, 5.8_

  - [x] 4.5 Write unit tests `oracle/tests/server.test.ts` and `oracle/tests/no-network.test.ts`
    - Server: SDK `Client` connected through the SDK in-memory transport pair; `listTools` returns exactly the three tools; a call returns the same JSON as the pure function; an invalid argument gives `isError: true`; `loadDataset` throws `OracleDataError` naming the path for a missing file and for invalid JSON
    - No network: every file in `oracle/src` has no `node:http`, `node:https`, `node:net`, `node:tls`, `node:dgram`, `node:dns` import, no `fetch(`, no `process.env`, no `console.log`
    - _Requirements: 4.1, 4.2, 5.3, 5.5, 5.6, 5.7, 5.8, 9.1, 9.3_

- [x] 5. Register the Oracle in the workspace MCP config
  - [x] 5.1 Create `.kiro/settings/mcp.json`
    - Server `cangjie-oracle`: `command` `npx`, `args` `["--no-install", "tsx", "oracle/src/index.ts"]`, `disabled` false, `autoApprove` the three tool names; no `env`, `url` or `headers`
    - Create the `.kiro/settings/` directory; confirm `.gitignore` does not ignore `.kiro/`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.2 Write unit tests `tests/unit/mcp-config.test.ts`
    - Parse the file: server name, `command`, `args`, no `env`/`url`/`headers`, `autoApprove` equals the three tool names, the entry file named in `args` exists, `.gitignore` has no `.kiro` ignore line
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.1, 9.3_

- [x] 6. Oracle Power (later task; skip first if time runs out)
  - [x] 6.1 Create `oracle/power/`
    - `plugin.json` (name `cangjie-oracle`, `author.name` `Ghost Script`, keywords, MIT), `mcp.json` (same stdio command as the workspace config, no `env`, no `url`) and `skills/cangjie-oracle/SKILL.md` (front matter `name` and `description`; when to call each tool; report `found: false` as "not in the dataset")
    - Try Powers panel → Add Custom Power → Import power from a folder; record whether the relative command path works after installation; if not, document the "install from a clone of this repository" limitation in the README task
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 6.2 Write unit tests `tests/unit/oracle-power.test.ts`
    - Parse `plugin.json`, `mcp.json` and the `SKILL.md` front matter for the required fields; no `env` or `url`; no personal names in the three files
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 9.1, 9.3_

- [x] 7. README
  - [x] 7.1 Add a "Kiro tooling" section to `README.md`
    - How to use the hook (what it watches, that saves by the agent or by a person fire it once hooks are loaded, that a window reload may be needed after the hook file is first created, the pass and fail lines); state that the Kiro IDE cannot create a manual-trigger hook, so a person runs `npm run check:data` in a terminal for the same check on demand
    - How to use the Accuracy_Reviewer (pick it in the agent picker; it is read-only), and the Oracle (`npm run oracle`, the registered MCP server, the three tools, sources; it reads only `app/public/data/characters.json` and returns no generated data)
    - If the Power exists, add the import steps and any limitation found in 6.1
    - Note from 6.1: Kiro did not try the Powers panel import (it cannot click the panel). A human must try Add Custom Power → Import power from a folder → `oracle/power/`, then check whether `oracle/src/index.ts` resolves from the install location (the Power's `mcp.json` uses the workspace-relative path `oracle/src/index.ts`, and the docs do not give the server's working directory). Expected limitation unless proven otherwise: the Power only works when installed from a clone of this repository with the workspace root as working directory, and the Power folder alone (or a copy of it) will not find the server. Document that limitation in the README.
    - _Requirements: 8.1, 8.2, 8.5_

- [ ] 8. Kiro log
  - [~] 8.1 Add entries to `kiro-log.md`
    - One entry per Kiro feature used here: Specs, Steering, Hooks, Custom agents, MCP and, if built, Powers, each with What I did, Kiro feature, Why and Result, dated with the day the task runs
    - Record the manual-save outcome for `PostFileSave`, which is now known: a human editor save fires the hook after a window reload (bad 吧 entryIndex reported `DATA CHECK FAILED: build:data`, reverting reported `DATA CHECK PASSED`), and the agent's own `str_replace` saves returned no hook output to the agent (observation only). Also record the working-directory check for the MCP server
    - No personal names and no approval wording in these entries
    - _Requirements: 8.3, 8.4_

- [x] 9. Final checkpoint - Verify the whole change
  - Run the root `npm test`
  - Run `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json` and `npx tsc -p oracle/tsconfig.json`
  - Run `npm run build -w app`
  - Confirm `git status` shows no change to `app/public/data/characters.json` and no `.kiro/` entry in `.gitignore`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 9.4, 9.5, 9.6_

- [x] 10. Self-contained Power: entry point, build script and generated files
  - [x] 10.1 Add the Power entry point `oracle/src/power.ts`
    - Add the exported function `powerDatasetPath()` to `oracle/src/dataset.ts`: `fileURLToPath(new URL('./data/oracle-data.json', import.meta.url))`; do not change `loadDataset`, `defaultDatasetPaths`, `index.ts` or any tool code
    - Create `oracle/src/power.ts` as a copy of the `index.ts` flow that calls `loadDataset(powerDatasetPath())`, with the same stderr message and exit code 1 on `OracleDataError`; no `process.cwd()`, no `process.env`, no `console.log`
    - Add `oracle/tests/power.test.ts`: `powerDatasetPath()` ends in `data/oracle-data.json`, is the same after `process.chdir` to a temporary directory, and `loadDataset` on a missing path throws `OracleDataError` naming the path
    - Keep `oracle/tests/no-network.test.ts` passing (it scans every file in `oracle/src`)
    - _Requirements: 10.2, 5.7, 5.8_

  - [x] 10.2 Add esbuild and the `scripts/build-power.ts` build script
    - Add `esbuild` `0.25.12` (exact, the version already installed through `tsx`) to the root `devDependencies`; run `npm install` and confirm `package-lock.json` changes only by recording the direct dependency; add the root script `"build:power": "tsx scripts/build-power.ts"`
    - Create `scripts/build-power.ts` as in the design: `deriveOracleData`, `buildPowerFiles` (esbuild JavaScript API with `write: false`, the option table of the design, `metafile` read in memory, warnings fail the build, `\n` line endings), `main` with the direct-execution guard; it writes only `oracle/power/server.mjs`, `oracle/power/data/oracle-data.json`, `oracle/power/NOTICE.md` and `oracle/power/licenses/*`
    - `NOTICE.md` content from a template in the script: the two data sources (Unihan `kCangjie`, Unicode License V3; Make Me a Hanzi `dictionary.txt`, GNU LGPL v3.0 or later) with version or commit and URL as in the README table, the statement that `data/oracle-data.json` keeps those terms and the code is MIT, the sorted list of bundled npm packages with version and licence read from their `package.json`, and a line telling readers to run `npm run build:power`
    - `licenses/`: byte copies of `data/raw/unihan/LICENSE`, `data/raw/make-me-a-hanzi/LICENSE` and `data/raw/make-me-a-hanzi/LGPL`, and the licence file of each bundled npm package
    - Type the Power_Data record against `CharacterRecord` so a renamed source field fails `tsc`; add no personal name to any generated file
    - _Requirements: 10.1, 10.3, 10.6, 10.7, 10.8_

  - [x] 10.3 Generate the Power files and rewrite `oracle/power/mcp.json`
    - Run `npm run build:power` once and commit its output; run it a second time and confirm `git status` shows no further change (determinism); record the sizes in the task notes
    - Rewrite `oracle/power/mcp.json`: keep `$schema` (`https://agent-plugins.org/schemas/1.0.0/mcp.schema.json`) and `"type": "stdio"`; set `"command": "node"`, `"args": ["${PLUGIN_ROOT}/server.mjs"]` and `"cwd": "${PLUGIN_ROOT}"`; no `env`, no `url`
    - Update the one paragraph of `skills/cangjie-oracle/SKILL.md` that names the three `app/public/data` files so it says the Power reads its own derived copy of the same 1,200 records; keep the front matter and the three tool sections; leave `plugin.json` unchanged (version stays `1.0.0` unless the human asks for a bump)
    - Do not edit `.kiro/settings/mcp.json`
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.8_

  - [x] 10.4 Write unit test `tests/unit/oracle-power-build.test.ts` (Power_Staleness_Test)
    - `buildPowerFiles()` output equals the committed `server.mjs`, `data/oracle-data.json`, `NOTICE.md` and `licenses/*` byte for byte; the failure message names the file and `npm run build:power`
    - For all 1,200 characters and the three tools: `lookup`, `verify` (stored code and a wrong valid code) and `decompose` from the Power_Data equal those from the three Level_Datasets (`toEqual`); the key sets and the count of 1,200 are equal
    - `deriveOracleData` keeps exactly the seven fields and drops all others; a character present in two inputs fails; the bundle and the data contain no `/Users/` and no drive-letter path; `NOTICE.md` names Unicode License V3 and LGPL-3.0-or-later and the README table names both; `licenses/` copies equal their originals under `data/raw/`
    - Plain unit tests: no property-based test
    - _Requirements: 10.3, 10.4, 10.6, 10.7, 10.8, 10.9, 10.10, 10.14, 9.1_

  - [x] 10.5 Write unit test `tests/unit/oracle-power-standalone.test.ts` (Power_Standalone_Test)
    - Copy `oracle/power/` into `fs.mkdtempSync` under `os.tmpdir()` (assert the path is outside the repository), assert no `node_modules` directory above the copy and `NODE_PATH` unset, read `oracle/power/mcp.json` and start `process.execPath` with the `args` of the file (`${PLUGIN_ROOT}` replaced by the copy) and `cwd` the copy, using the SDK `Client` with `StdioClientTransport`
    - `listTools` returns exactly `lookup`, `verify`, `decompose`; for 明 (stored code `AB`) and for one character with a code from each of the three level datasets, call the three tools and compare with values read from the app datasets (and `isPlayableInCangjie`), not typed in the test
    - `verify` with a valid wrong code for 明 gives `matches: false`; `verify` with `hqz` gives `isError: true`; a valid character outside the dataset gives `found: false`
    - Close the client and remove the temporary directory in `finally`; timeout 30 seconds
    - _Requirements: 10.1, 10.2, 10.5, 10.11, 10.12, 9.1_

  - [x] 10.6 Update the existing Power and workspace-config tests
    - `tests/unit/oracle-power.test.ts`: replace the case "uses the same command and args as the workspace MCP config" with checks of the new `mcp.json` (`$schema`, `type` `stdio`, `command` `node`, `args` equals `["${PLUGIN_ROOT}/server.mjs"]`, `cwd` equals `${PLUGIN_ROOT}`, no `env`, no `url`, no `npx` or `tsx` anywhere in the file); keep the plugin, SKILL and personal-name cases and extend the personal-name case to `NOTICE.md`
    - `tests/unit/mcp-config.test.ts`: leave unchanged. The case "is enabled" keeps expecting `disabled: false` and fails while the human has the server disabled for the import test (known, expected failure); no test is weakened and no digest pin is added. No task edits `.kiro/settings/mcp.json`
    - _Requirements: 10.5, 10.13, 10.17, 6.1, 6.2, 6.3_

  - [x] 10.7 Update the README and the licence statements
    - In the "Oracle Power" part of `README.md`: replace the "Limitation (expected, not yet verified)" paragraph with the self-contained description (folder import, `node` plus `${PLUGIN_ROOT}/server.mjs`, own data copy of 1,200 records), name `npm run build:power`, say the generated files are committed and that `npm test` fails if they are stale, and give the bundle and data sizes
    - In "Data and licences": add one sentence that `oracle/power/data/oracle-data.json` is a further derived file that keeps the Unihan (Unicode License V3) and Make Me a Hanzi (LGPL-3.0-or-later) terms, and point to `oracle/power/NOTICE.md`; in "Cangjie Oracle": state that the registered workspace server reads the three Level_Datasets and the Power reads its own derived copy (Requirement 8.2 wording stays true for the workspace server)
    - Leave `app/public/THIRD_PARTY_NOTICES.txt` unchanged (it covers app runtime dependencies only) and confirm `tests/unit/third-party-notices.test.ts` and `tests/unit/credits-readme.test.ts` still pass
    - _Requirements: 10.6, 10.15, 8.2_

- [ ] 11. Human-only: re-test the Power import in Kiro
  - [~] 11.1 The human re-tests the import in the Kiro Powers panel (Kiro never does this step)
    - With the workspace `cangjie-oracle` server still disabled: Powers panel, Add Custom Power, Import power from a folder, choose `oracle/power/`; confirm the server connects (no "Connection closed") and that `lookup`, `verify` and `decompose` answer for 明
    - Record the result, and what the install location and server name look like, in `kiro-log.md` (written by the human); if it still fails, copy the Kiro error text into the task notes so the design can be revised
    - After the import test, set `disabled: false` in `.kiro/settings/mcp.json` and run `npx vitest run tests/unit/mcp-config.test.ts`; the case "is enabled" then passes
    - _Requirements: 10.16, 10.17_

- [x] 12. Final checkpoint - Verify the self-contained Power
  - Run the root `npm test` (includes the Power_Staleness_Test and the Power_Standalone_Test), `npx tsc -p tsconfig.json`, `npx tsc -p app/tsconfig.json` and `npx tsc -p oracle/tsconfig.json`
  - Run `npm run build -w app`, `npm run check:bundle` (the app budget of 300,000 bytes must be unaffected, since `oracle/power/` is not part of the app bundle), `npm run test:e2e` and `npm run check:data`
  - Run `npm run build:power` and confirm `git status` shows no change to `oracle/power/`; confirm with `git diff -- .kiro/settings/mcp.json` and `git status` that this work did not change `.kiro/settings/mcp.json` (the human's own change of the `disabled` key is the only difference allowed); confirm no change to `app/public/data/*.json`
  - Report: the size of `oracle/power/server.mjs` and of `oracle/power/data/oracle-data.json`, each raw and gzip (level 9); the app `check:bundle` total; the time `npm test` takes; whether `no-personal-names` needed an exemption; and anything not achieved (for example, a failed step or the human's import test not yet done)
  - Expected failure: while the human has not yet re-enabled the workspace server, the case "is enabled" in `tests/unit/mcp-config.test.ts` fails. Report it by name as known and expected; every other test must pass, and no test may be weakened
  - Ensure all other tests pass, ask the user if questions arise.
  - _Requirements: 9.4, 9.5, 9.6, 10.1, 10.13, 10.14, 10.17_

## Notes

- No optional tasks: every task is required, including the unit tests. Task 6 is the "later" Power task and can be skipped without affecting the others; if it is skipped, skip 6.2 and the Power parts of 7.1 and 8.1 too.
- Tasks 1.1 to 1.3 edit `scripts/` and the root `package.json`; task 4.1 edits the root `package.json` afterwards, which is why it sits in a later wave.
- The root `package.json` script `oracle` is added in 4.1, not 1.3.
- Wave 4 is the first point where `oracle/src/index.ts` exists, so the MCP config test (5.2) runs there.
- Unit tests only. No property-based tests are added.
- Decisions approved by the human: the hook fires on human and agent saves once hooks are loaded (verified by a human); no manual-trigger hook (the IDE cannot create one, so the README documents `npm run check:data`); `verify` upper-cases the code and reports `normalisedCode`; task 6 (Power) stays; `@modelcontextprotocol/sdk` stays on v1 (1.32.2).
- Task 8.1 (`kiro-log.md`) stays in the plan. The human writes it this time rather than Kiro.
- No tasks were added or removed, so the waves are unchanged.
- Task 9 is a checkpoint and is not in the dependency graph; it runs after wave 6.
- Tasks 10 to 12 are a follow-up, "Self-contained Power", approved by the human after the first Powers-panel import failed with `Connection closed` (the Power's `mcp.json` ran the repository-relative path `oracle/src/index.ts`). Tasks 1 to 9 are not renumbered or unchecked. Task 12 is the new final checkpoint and, like task 9, is not in the dependency graph; it runs after wave 11.
- Task 11.1 is human-only: Kiro never imports the Power in the Powers panel. It sits in the last wave only so the graph lists every incomplete leaf task once; an agent run skips it.
- Wave 7 to 9 run one task each because tasks 10.1 to 10.3 build on one another and 10.2 and 10.3 write the root `package.json` and `oracle/power/` files. The four tasks in wave 10 write different files.
- The generated files `oracle/power/server.mjs`, `data/oracle-data.json`, `NOTICE.md` and `licenses/*` are written only by `npm run build:power` and are committed. When a Level_Dataset changes, run it again; the Power_Staleness_Test in `npm test` tells you when.
- Decisions approved by the human for the follow-up: bundle with esbuild (ES module, `.mjs`, run with plain `node`), derived data file with only the fields the three tools read, `.kiro/settings/mcp.json` is edited by no task (the final checkpoint confirms with `git diff` and `git status`), no new property-based tests (Nov 15 decision).
- The human disabled the workspace server only for the import test and re-enables it (`disabled: false`) afterwards (approved by the human). Until then the case "is enabled" in `tests/unit/mcp-config.test.ts` is a known, expected failure that task 12 reports by name; the test is not relaxed.
- Also decided by the human: `plugin.json` version stays `1.0.0`; `server.mjs` is committed minified; the `kiro-log.md` entry for task 11.1 is the human's.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "2.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "1.4", "2.2", "3.2", "4.1"] },
    { "id": 2, "tasks": ["4.2", "5.1"] },
    { "id": 3, "tasks": ["4.3", "4.4"] },
    { "id": 4, "tasks": ["4.5", "5.2", "6.1"] },
    { "id": 5, "tasks": ["6.2"] },
    { "id": 6, "tasks": ["7.1", "8.1"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2"] },
    { "id": 9, "tasks": ["10.3"] },
    { "id": 10, "tasks": ["10.4", "10.5", "10.6", "10.7"] },
    { "id": 11, "tasks": ["11.1"] }
  ]
}
```
