# Kiro Log — Ghost Script

A running record of how Kiro was used to build Ghost Script, for the Kiroween 2026 write-up.
Add an entry every time you use a Kiro feature or make a decision about how to use it.

**For each entry, note:**
- **What I did**: the task.
- **Kiro feature**: Specs / Steering / Hooks / MCP / Powers / Custom agents / Property-based tests / Vibe coding / IDE / CLI / Web.
- **Why**: why this feature, and not another way?
- **Result**: what worked, what didn't, what I changed.

---

## Nov 3, 2026: Setup

- Registered for Kiroween 2026 on Devpost; category: **Resurrection**.
- Requested the 4,000 hackathon Kiro credits (waiting for approval; working on the 50 free-tier credits meanwhile).
- Installed **Kiro IDE**.
- Created the public GitHub repo `ghost-script` (MIT licence) and this log.
- Plan: write steering docs by hand first (no credits needed), then start Spec 1 (Write mode) once credits arrive.

## Nov 3, 2026: First steering docs

- **What I did:** Added four steering files in `.kiro/steering/`: `product.md`, `tech.md`, `structure.md` (all `inclusion: always`) and `content-accuracy.md` (`inclusion: fileMatch` on data, scripts, oracle and test files). Also added a `.gitignore` that explicitly keeps `.kiro/` tracked.
- **Kiro feature:** Steering.
- **Why:** Written before any code, so every Kiro session starts with the same product scope, tech stack and data rules. Drafted with AI help outside Kiro (no credits used yet). The content-accuracy rules only load when working on data files, so they don't fill the context during UI work.
- **Result:** To review and edit inside Kiro before starting Spec 1. Check that Kiro picks up all four files ("Including Steering Documents").

## Nov 3, 2026: Checked steering in Kiro IDE

- **What I did:** Cloned the repo in Kiro IDE and checked the Agent Steering & Skills panel. The four workspace steering files only appeared after reloading the window.
- **Kiro feature:** Steering (IDE panel).
- **Why:** To confirm every session would load the project rules before creating the first spec.
- **Result:** All four showed under "Workspace", next to Kiro's built-in global skills (architecture-selection, quick-spec, bug-fix).

## Nov 3, 2026: Spec 1 (`character-dataset`): requirements

- **What I did:** Started the first spec with the built-in **Spec** agent: chose "Build a Feature" (not Quick Spec, so every phase is reviewed) and "Requirements first". Model on Auto. Autopilot was on during Spec 1; the review stops came from our prompts ("only generate requirements.md", "stop after task N"), which Kiro followed every time.
- **Kiro feature:** Specs (requirements-first, EARS acceptance criteria), steering.
- **Why:** Every game mode (Write, Build, hints, the Oracle) depends on correct character data, so the data pipeline is the first spec. Requirements-first because we knew *what* the data must guarantee before deciding *how* to build it.
- **Result:** Kiro produced 5 requirements (character list, raw datasets, pipeline script, record schema, property-based tests). About 4.8 credits.
  - **Steering issue found:** Kiro included only product, structure and tech. `content-accuracy.md` was skipped because its `fileMatch` pattern covered data and script files, not spec files. Fixed by adding `.kiro/specs/**/*` to the pattern, so data rules now load during spec work.
  - **Review caught a contradiction:** the requirements allowed partial records with null fields, but the tests required every record to be complete. Asked Kiro to revise (about 2.4 credits):
    1. Missing required fields (pinyin, meanings, stroke count, stroke data, decomposition) now **fail the build** with a full list of affected characters, instead of producing partial records.
    2. Characters restricted to the main CJK Unified Ideographs block (U+4E00–U+9FFF).
    3. Build-mode decoy tests moved out of this spec, because decoys come from game logic, not the dataset.

## Nov 3, 2026: Spec 1 (`character-dataset`): technical design

- **What I did:** Generated `design.md` from the approved requirements.
- **Kiro feature:** Specs (design phase), property-based testing plan.
- **Why:** Review the architecture before any code is written or credits are spent on implementation.
- **Result:** A five-stage pipeline (validate inputs → parse each dataset → merge per character → collect errors → write), with:
  - an atomic temp-file write, so a failed run never leaves a broken `characters.json`;
  - a "fail-slow" error report: every character is checked and all problems are listed in one run;
  - deterministic output (records sorted by codepoint, fixed key order);
  - shared TypeScript types in `app/src/data/types.ts` for the app, pipeline and Oracle;
  - one parser module per dataset in `scripts/lib/`.
  - **Atomic characters:** basic characters like 一, 人 and 口 cannot be broken down further, and a "must have a decomposition" rule would have wrongly rejected them. Kiro **read the Make Me a Hanzi README** to check how these are stored: a decomposition starting with `？` means atomic, and a `？` inside a decomposition means one unknown component. The design now marks atomic characters as valid (`atomic: true`, component = the character itself), strips unknown `？` components, and still fails on genuinely missing entries.
  - **Component range:** the main-block rule was correct for the 300 characters but too strict for components, which can be radical forms in other Unicode blocks (e.g. ⺮ bamboo). Components may now come from CJK Unified Ideographs, Extension A, Radicals Supplement, Kangxi Radicals and CJK Strokes. Placeholders (`？`) and structure symbols are never allowed.
  - The design now has **17 correctness properties** (Vitest + fast-check, at least 100 runs each), including determinism, schema completeness, no placeholder components, and atomic-character invariants.
- **Credits:** about 20 of the 50 free-tier credits used so far for Spec 1 (requirements about 7.1, design plus the two design revisions about 12.9). 30 left.
- **Next:** Generate the task list. Start implementation once the 4,000 hackathon credits arrive.

## Nov 3, 2026: Spec 1 (`character-dataset`): task list

- **What I did:** Generated `tasks.md` (20 tasks with a dependency graph of parallel "waves"), then revised it in review.
- **Kiro feature:** Specs (tasks phase).
- **Why:** Break the design into small, checkable steps before spending credits on implementation.
- **Result:** Kiro's first version had a good structure, but three choices worked against the project. They were revised (edited directly in `tasks.md`, no credits used):
  1. **All tests made required.** Kiro had marked every unit and property-based test optional (`*`) to get a faster MVP. For Ghost Script, those tests are the proof that the character data is correct, because judges can't check Chinese by reading it.
  2. **Real data moved to the start.** Downloading the three datasets and choosing the character list moved from tasks 16–17 to tasks 3–4, right after the shared types. Every parser is now built against the real files, so surprises like atomic characters and radical forms show up early.
  3. **Hint-engine property removed.** Property 17 tested a module from a later spec using a stub. It moves to the hint-engine spec, where it can test real code.
- **Next:** Start implementation one task at a time (not "Run All Tasks") once the 4,000 hackathon credits arrive.

## Nov 3, 2026: Spec 1, task 1: project scaffolding

- **What I did:** Ran task 1 of the `character-dataset` spec through the Kiro chat, with an explicit prompt: task 1 only, follow the steering docs, and install only the listed dev dependencies.
- **Kiro feature:** Spec task execution, steering (tech.md, structure.md).
- **Why:** Ran one task with a scoped prompt, instead of "Run All Tasks", to keep control of the 50 free-tier credits and review each step.
- **Result:** Kiro created the folder structure from `structure.md` (data, scripts, tests, app/public/data, app/src/data) with `.gitkeep` files, a root `package.json` (`build:data`, `test`), a strict `tsconfig.json`, and the `character-list.txt` header. It pinned exact versions of tsx, vitest, fast-check and typescript, so the build is reproducible. `npm install` and `npm test` passed. Checked on GitHub: `node_modules/` was not committed, `package-lock.json` was, and `.kiro/` is still tracked. About 3 credits; 25 left.
  - **Note for later:** `tests/unit/scaffold.test.ts` is a placeholder so the test runner has a file. Remove it once real tests exist (task 5.2).
- **Decision for task 4:** use the official HSK 3.0 handwriting list (书写字), elementary band, from `ivankra/hsk30` (MIT; transcribed from the Ministry of Education standard GF0025-2021). It's the list of characters learners must be able to write by hand, which matches what Ghost Script trains.

## Nov 7, 2026: Hackathon credits arrived

- The 4,000 Kiroween credits arrived (requested Nov 3, about 3.5 days). Spent Nov 4–6 waiting rather than using the last 25 free-tier credits on bigger tasks, to avoid running out partway through one.
- Next: Spec 1 task 2.1 (shared types), then tasks one at a time.

## Nov 7, 2026: Spec 1, tasks 2.1–10: types, data, character list, parsers (parallel wave)

- **What I did:** Ran task 2.1 (shared types), task 3 (download the three datasets), task 4 (character list), then tasks 5–10 with their unit tests as **one parallel wave**. Kiro ran up to 5 sub-agents at once.
- **Kiro feature:** Spec task execution, parallel sub-agents (task dependency waves), steering, unit tests with real-data fixtures.
- **Why:** The six modules only share the types from 2.1, so they could be built in parallel. Unit tests had to use fixtures copied from the real files, so real-data quirks surface now.
- **Result:**
  - 2.1: 10 types in `app/src/data/types.ts`; `tsc` clean.
  - 3: hanzi-writer-data 2.0.1 (9,574 files, 46 MB), Make Me a Hanzi at commit `bddc96d`, CC-CEDICT release 2026-11-06. 58 MB in total. 7 credits. Kiro read each source's own licence and flagged that CC-CEDICT is **CC BY-SA 4.0** (steering said 3.0) and Make Me a Hanzi `dictionary.txt` is **LGPL-3.0-or-later**. Steering updated.
  - 4: the 300 HSK 3.0 handwriting characters (writing level 1) from `ivankra/hsk30`, pinned commit. Checked independently against the source CSV: identical list, same order.
  - 5–10: six modules, 35 unit tests passing, 21 credits. Real fixtures include 我 (normal), 一 (atomic `？`), 㐆 (interior `？`) and 行 (three readings, 16 meanings). Kiro installed `@types/node` and added `"types": ["node"]` to tsconfig, which task 1 had missed.
- **Problems found in review (fixed by hand, no credits):**
  1. **Parallel sub-agents overwrote each other's notes.** `data/raw/SOURCES.md` only had hanzi-writer-data and the character list. The Make Me a Hanzi and CC-CEDICT entries written in task 3 were lost, even though Kiro's summary said they were recorded. Added both back, with commit, release date and licences. **Lesson:** parallel tasks shouldn't write to the same shared file; check shared files after a wave.
  2. **Fixtures were not truly verbatim.** Two Make Me a Hanzi lines had non-breaking spaces (U+00A0) silently turned into normal spaces, despite the fixture README saying "copied verbatim". Restored the exact lines; all three now match the source byte for byte. Tests still pass.
  3. **Missing licence text.** Make Me a Hanzi's licence points to a separate `LGPL` file, which wasn't copied. Added it from the repo at the pinned commit.
- **Next:** tasks 11–12 (pipeline entry point, unit-test checkpoint), then a first real `npm run build:data`.

## Nov 7, 2026: Spec 1, tasks 11–12 and the first real build

- **What I did:** Ran tasks 11.1–11.2 (`buildDataset` + `main()`) and 12 (unit-test checkpoint), then the first `npm run build:data` on the real data, with the instruction not to change the character list to make it pass.
- **Kiro feature:** Spec task execution.
- **Result:** Build succeeded first time: all 300 characters complete, 9 atomic (一人八又女手牛而身), 0 components outside the allowed Unicode ranges. 35/35 tests pass. `characters.json` is 1.6 MB.
  - **Independent checks:** rebuilt twice on a different machine (Linux vs his Mac). The output was byte-for-byte identical to the committed file, so the determinism requirement holds across platforms.
  - **Content check found a gap the spec didn't cover:** CC-CEDICT's first meaning is often unusable as a game prompt. 88 of 300 start with "surname …", "variant of …", "used in …", "abbr. …" or "(bound form)". For example 三 → "surname San" and 东 → "surname Dong". Pinyin is in numbered form (shang3) with capitalised surname readings, so it isn't ready to display. A simple filter rule fixed most cases but still chose wrong senses for some (后 → "empress", 号 → "to wail", 体 → "Taiwan pr."), because CC-CEDICT doesn't order senses by how common they are.
- **Decision:** add a "game prompt" requirement to the spec before writing the property tests. A rule picks a default meaning and reading for each character; a small human-reviewed override file corrects the rest. Every prompt must be chosen *from* the source data, never written freely, and property tests will enforce that.

## Nov 7, 2026: Prompt same-entry fix, implementation and review

- **What I did:** Asked Kiro to fix a design flaw before implementing: meanings and readings were picked from separate lists, so a prompt could pair a meaning with the wrong pronunciation (e.g. 了 "to finish" with *le*). Kiro updated requirements, design and tasks (per-entry senses, `entryIndex` + `meaningIndex` overrides, a new same-entry property), then implemented tasks 4.2, 8.3, 10.3–10.6 and the updated 11.1–11.2.
- **Kiro feature:** Spec iteration (changing an approved spec in response to real data), sub-agents, unit tests on real fixtures (三, 后, 号, 了, 中).
- **Result:** 65/65 tests pass; build succeeds; `prompt-review.csv` lists all 300 prompts with every alternative grouped by entry.
- **Review:** the default rule gave usable but often wrong senses. All 300 characters were screened against the review file and 48 overrides were proposed. All 48 were approved by Takshil, including the six marked "your call" (觉, 地, 本, 所, 现, 然). `reviewedBy` records "approved by Takshil". Notable fixes: 比 had defaulted to a vulgar euphemism (now "to compare"); wrong readings for 说, 听, 看, 要, 跑, 作, 行; rare senses for 号, 后, 几, 打, 电, 店, 跟, 热, 太, 字. All overrides select existing CC-CEDICT senses by index; the build validated every index.
- **Still to handle (display, not data):** 午 has only a long astrology-style gloss, and some glosses contain dictionary notes like "(CL:棵[ke1])". These will be trimmed by a display rule in the game-UI spec; the stored data stays identical to the source.
- **Next:** tasks 13–14, property-based tests.

## Nov 7, 2026: End of session

- **Credits:** 87 of the 4,000 hackathon credits used so far (plus 25 of the 50 free-tier credits earlier). Spec 1 is about two-thirds done.
- **State:** tasks 1–12 and the prompt wave complete; 300-character dataset built, deterministic, with 48 approved prompt overrides; 65/65 tests passing.
- **Resume with:** tasks 13–15 (property-based tests and smoke tests), using the saved prompt.

## Nov 9, 2026: Spec 1, tasks 13–15: property-based and smoke tests

- **What I did:** Ran tasks 13–15 with explicit rules: fast-check with at least 100 runs, realistic generators (real IDS structures, real CC-CEDICT line shapes, real pinyin syllables), and "if a property finds a bug, fix the code, never weaken the test".
- **Kiro feature:** Property-based testing, spec task waves with parallel sub-agents (5 at a time), shared arbitraries gated as the first task.
- **Result:** 18 correctness properties (1–16, 18–22; 17 is deferred to the hint-engine spec), **111 tests across 24 files**, all passing; `tsc` clean. No bugs found.
- **Checking the tests themselves (mutation testing, by hand):** "No bugs found" can mean the tests are too weak, so we deliberately broke the code in 10 ways and re-ran the suite:

  | Deliberate bug | Caught? |
  |---|---|
  | `？` placeholder allowed into components | ✅ 6 tests failed |
  | IDS structure symbols allowed into components | ✅ 10 failed |
  | Atomic characters get no component | ✅ 2 failed |
  | Prompt takes its reading from the wrong entry | ✅ 9 failed |
  | Surname readings not skipped | ✅ 1 failed |
  | Skip-prefix list ignored ("surname …" allowed) | ✅ 2 failed |
  | Override uses the wrong entry's reading | ✅ 3 failed |
  | Tone mark placed on the wrong vowel | ✅ 2 failed |
  | Neutral-tone syllable keeps its digit | ✅ 2 failed |
  | Output order reversed (breaks determinism) | ✅ 1 failed |

  All 10 caught. (One extra mutant was "equivalent": it changed the code without changing behaviour, so it couldn't fail.)
- **Spec fix:** Kiro flagged that design Property 16 allowed only three categories of codepoint in IDS strings. Checked against the real `characters.json`: it contains 11 CJK Radicals Supplement codepoints, so the old wording would have rejected valid data. Corrected Property 16 to the same five component blocks as Requirement 4.7 and Property 8.
- **Next:** tasks 16–20 (integration test on the real data, end-to-end run, README, final checkpoint).

## Nov 9, 2026: Spec 1 (`character-dataset`) complete

- **What I did:** Ran tasks 16–20: an integration test on the real data, the end-to-end build, the README, and the final checkpoint.
- **Kiro feature:** Spec task execution; property checks run against the real output.
- **Result:** **66/66 tasks done, 129 tests across 25 files**, `tsc` clean. The integration test checks Properties 8, 9, 11–16 and 18–22 on all 300 real records; all pass. Kiro noticed the 48 overrides and adjusted the checks correctly (Property 20 only for the 252 default prompts; reviewer attribution for the 48).
- **Review fixes (no credits):** added the MIT licence file for the HSK character list (`data/raw/hsk30/LICENSE`); made the README say exactly how the overrides were made (approved by Takshil). Kiro's summary guessed 了 was overridden; it wasn't (it keeps the default "(completed action marker)").
- **Credits:** 170 of 4,000 hackathon credits used in total (plus 25 of the 50 free-tier credits before they arrived). Tasks 13–20 took 83 (property and smoke tests, integration test, README); everything before took 87.
- **Spec 1 in numbers:** 300 characters · 3 datasets + 1 list, all pinned · 22 designed properties (21 tested here, 1 deferred) · 129 tests · 10/10 deliberate bugs caught · deterministic across Mac and Linux.

## Nov 9, 2026: Spec 2 (`ghost-game-core`): requirements, analysis, design, tasks

- **What I did:** Started the second spec (Spec agent → Build a Feature → Requirements first): the first playable game, with the legend intro, a 10-ghost Nightly Séance, Write mode with live stroke checking, the haunting scheduler, display cleanup of prompts, and progress saved in the browser. Reviewed each phase before moving on.
- **Kiro feature:** Specs (requirements → design → tasks), the **requirements analysis tool**, steering.
- **Requirements review caught five gaps** in Kiro's first draft:
  1. "Correct" meant *any* finished character, even with every stroke hinted. Replaced with three outcomes: **clean** (no hints, ≤ 2 mistakes), **struggled** (hints or more mistakes; laid to rest but scheduled as missed) and **gave up**.
  2. The scheduler had properties but no algorithm. Added an interval ladder (1, 3, 7, 14, 30, 60 days; a miss resets with a 10-minute relearn delay) and a precise session-filling order.
  3. No "give up" control or rule.
  4. Saved progress wasn't versioned. Added `schemaVersion` with migrate-or-reset.
  5. The cleanup missed "Taiwan pr. […]" notes. The legend now names its source: *Huainanzi*, 天雨粟，鬼夜哭.
  - A second review found an edge case in session filling: a player with 2 practised characters would get only 7 ghosts. Added a final "fill with more new characters" step and a property test that a session always has exactly 10.
- **Requirements analysis tool:** asked four clarifying questions. Answers: mistake counting is scoped to the stroke event; the legend can only be re-viewed outside a session (no pause/resume); unknown schema versions always reset (migrate only known older versions); and the 8.7 property-test list had been written as sub-bullets the analyser couldn't read, so it was rewritten inline as 11 numbered cases.
- **Design review caught four implementation bugs before any code existed:**
  1. The node test project would also have collected the new app tests (no `include` set), running browser tests under node.
  2. A separate `app/package.json` would need a second `npm install`. Switched to **npm workspaces**.
  3. hanzi-writer has **no "hint shown" event**. Hint use is now derived from `mistakesOnStroke` reaching the threshold.
  4. "Give up" could count extra mistakes during the reveal. Now `cancelQuiz()` runs before `animateCharacter()`.
  - Added one test that uses the **real** hanzi-writer (not mocked) to prove our stroke data loads offline.
- **Task list (18 tasks, no optional tests) review:** pinned versions compatible with Vitest 2.1.9 (Vite 5.4, React plugin 4.3, Tailwind 3.4 with its v3 setup, React 18.3, plus `@testing-library/dom`). hanzi-writer 3.7.3 was confirmed on npm (MIT). Task 18 (play one Séance with a mouse) is marked as a human manual check, so Kiro can't write that log entry.
- **Credits:** 212 of 4,000 used in total. Spec 2 planning (requirements, analysis, design, tasks and their revisions) took 42.
- **Next:** task 1 (app scaffold, workspace, both test projects) and confirm the 129 data tests still pass.

## Nov 10, 2026: Spec 2, task 1: app scaffold and dual test projects

- **What I did:** Ran task 1 alone: a Vite + React + TypeScript app in `app/`, npm workspaces, and a Vitest workspace with two projects (node for the data tests, jsdom for the app).
- **Kiro feature:** Spec task execution.
- **Result:** Exact pins as planned: vite 5.4.21, @vitejs/plugin-react 4.3.4, tailwindcss 3.4.19, react 18.3.1, hanzi-writer 3.7.3, jsdom 31.0.0, @testing-library/react 16.3.3 and @testing-library/dom 10.4.2. `npm ls` shows no peer warnings. **130 tests pass** (129 data + 1 app smoke test); `tsc` is clean for root and app. Verified again on a fresh clean install on Linux.
  - **Bug Kiro caught:** the design's app test glob (`app/**/*.test.{ts,tsx}`) matched nothing, because the `./app` workspace entry makes `app/` the project root. App tests would have been **silently skipped** while the run still looked green. Fixed with globs relative to `app/`, plus project names (`node`, `app`) in the output so it's visible which project ran each file. design.md and tasks.md updated to match.
  - **`npm audit`:** 6 findings (2 critical, 1 high, 3 moderate), all in development tooling: vitest 2.1.9, its tinypool/mocker/vite-node, vite 5.4.21 and esbuild. None of it ships in the built app, which is static files. The fixes need vitest 5 and vite 8, which would break the pinned setup mid-hackathon. Decision: keep the pins; don't run the Vitest UI; never expose the dev server to a network (`--host`); test on iPad through the deployed site instead. Revisit upgrades after judging.
- **Next:** tasks 2.1 (engine config) and 9.1 (theme tokens).

---

## Template for new entries

## [Date]: [Short title]

- **What I did:**
- **Kiro feature:**
- **Why:**
- **Result:**

## Task 14.5: Prompt-selection property tests (Properties 18, 19, 20)

- **What I did:** Added `tests/property/prompt-selection.test.ts` exercising `selectPrompt` (DEFAULT rule) against `arbitraryCcCedictEntry()`. Property 18 (meaning is a bound-form-stripped source gloss of the chosen entry), Property 19 (pinyin is `numberedToToneMarks` of the chosen entry's reading), Property 20 (no skipped-prefix meaning). Added a justification check for `no-usable-sense` failures and a bonus same-entry check.
- **Kiro feature:** Property-based tests (fast-check + Vitest).
- **Why:** These prove the ghost clue never shows a surname/variant/abbr gloss and that meaning + reading always come from one CC-CEDICT entry — correctness judges cannot verify by reading Chinese.
- **Result:** `npx tsc --noEmit` clean; all 5 tests pass (numRuns 200). No bug surfaced in `prompt.ts`; no changes to source needed.
