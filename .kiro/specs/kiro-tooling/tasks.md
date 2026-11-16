# Implementation Plan: kiro-tooling

## Overview

Build the three Kiro-native tools in small steps: the data check (pipeline message, runner script, hook), the read-only accuracy-reviewer agent, and the Cangjie Oracle MCP server with its workspace registration. Then package the Oracle as a Power (last, skippable), document everything, log the Kiro usage, and run the final checks. All tests are Vitest unit tests; no property-based tests are added (decision of Nov 15 in `tech.md`). The design is TypeScript, so no language question applies. Do not touch `app/public/data/characters.json`.

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
    { "id": 6, "tasks": ["7.1", "8.1"] }
  ]
}
```
