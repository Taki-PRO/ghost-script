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
  - **Independent checks:** rebuilt twice on a different machine (Linux vs my Mac). The output was byte-for-byte identical to the committed file, so the determinism requirement holds across platforms.
  - **Content check found a gap the spec didn't cover:** CC-CEDICT's first meaning is often unusable as a game prompt. 88 of 300 start with "surname …", "variant of …", "used in …", "abbr. …" or "(bound form)". For example 三 → "surname San" and 东 → "surname Dong". Pinyin is in numbered form (shang3) with capitalised surname readings, so it isn't ready to display. A simple filter rule fixed most cases but still chose wrong senses for some (后 → "empress", 号 → "to wail", 体 → "Taiwan pr."), because CC-CEDICT doesn't order senses by how common they are.
- **Decision:** add a "game prompt" requirement to the spec before writing the property tests. A rule picks a default meaning and reading for each character; a small human-reviewed override file corrects the rest. Every prompt must be chosen *from* the source data, never written freely, and property tests will enforce that.

## Nov 7, 2026: Prompt same-entry fix, implementation and review

- **What I did:** Asked Kiro to fix a design flaw before implementing: meanings and readings were picked from separate lists, so a prompt could pair a meaning with the wrong pronunciation (e.g. 了 "to finish" with *le*). Kiro updated requirements, design and tasks (per-entry senses, `entryIndex` + `meaningIndex` overrides, a new same-entry property), then implemented tasks 4.2, 8.3, 10.3–10.6 and the updated 11.1–11.2.
- **Kiro feature:** Spec iteration (changing an approved spec in response to real data), sub-agents, unit tests on real fixtures (三, 后, 号, 了, 中).
- **Result:** 65/65 tests pass; build succeeds; `prompt-review.csv` lists all 300 prompts with every alternative grouped by entry.
- **Review:** the default rule gave usable but often wrong senses. All 300 characters were screened against the review file and 48 overrides were proposed. I approved all 48, including the six marked "your call" (觉, 地, 本, 所, 现, 然). `reviewedBy` records "which I approved". Notable fixes: 比 had defaulted to a vulgar euphemism (now "to compare"); wrong readings for 说, 听, 看, 要, 跑, 作, 行; rare senses for 号, 后, 几, 打, 电, 店, 跟, 热, 太, 字. All overrides select existing CC-CEDICT senses by index; the build validated every index.
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

## Nov 9, 2026: Spec 1, task 14.5: prompt-selection property tests (Properties 18, 19, 20)

- **What I did:** Added `tests/property/prompt-selection.test.ts` exercising `selectPrompt` (DEFAULT rule) against `arbitraryCcCedictEntry()`. Property 18 (meaning is a bound-form-stripped source gloss of the chosen entry), Property 19 (pinyin is `numberedToToneMarks` of the chosen entry's reading), Property 20 (no skipped-prefix meaning). Added a justification check for `no-usable-sense` failures and a bonus same-entry check.
- **Kiro feature:** Property-based tests (fast-check + Vitest).
- **Why:** These prove the ghost clue never shows a surname/variant/abbr gloss and that meaning + reading always come from one CC-CEDICT entry — correctness judges cannot verify by reading Chinese.
- **Result:** `npx tsc --noEmit` clean; all 5 tests pass (numRuns 200). No bug surfaced in `prompt.ts`; no changes to source needed.

## Nov 9, 2026: Spec 1 (`character-dataset`) complete

- **What I did:** Ran tasks 16–20: an integration test on the real data, the end-to-end build, the README, and the final checkpoint.
- **Kiro feature:** Spec task execution; property checks run against the real output.
- **Result:** **66/66 tasks done, 129 tests across 25 files**, `tsc` clean. The integration test checks Properties 8, 9, 11–16 and 18–22 on all 300 real records; all pass. Kiro noticed the 48 overrides and adjusted the checks correctly (Property 20 only for the 252 default prompts; reviewer attribution for the 48).
- **Review fixes (no credits):** added the MIT licence file for the HSK character list (`data/raw/hsk30/LICENSE`); made the README say exactly how the overrides were made (I approved each one). Kiro's summary guessed 了 was overridden; it wasn't (it keeps the default "(completed action marker)").
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

## Nov 10, 2026: Spec 2, tasks 2.1 and 9.1: engine config and theme

- **What I did:** Ran tasks 2.1 (one config module with every game threshold) and 9.1 (dark theme tokens wired into Tailwind).
- **Kiro feature:** Spec task execution.
- **Result:** `config.ts` holds the clean-mistake threshold (2), hint after 3 misses, the ladder (1/3/7/14/30/60 days), the 10-minute relearn delay, the new-per-session cap (5) and the session size (10), all read-only. The theme has 7 colour tokens, and Kiro added a test that checks each text colour against WCAG AA contrast (at least 4.5:1) instead of just claiming it. **143 tests pass**; `tsc` is clean for root and app.
  - Git: the sync happened after Kiro had already edited `tasks.md` while a newer version was on GitHub; committing first and then syncing merged both cleanly, with no conflict markers.
- **Next:** tasks 3 (prompt cleanup with its property tests) and 4 (scheduler review logic with its property tests).

## Nov 11, 2026: Spec 2, tasks 3 and 4: prompt cleanup and scheduler

- **What I did:** Ran tasks 3 (3.1–3.5: clean-up of dictionary notes in the ghost's clue) and 4 (4.1–4.5: spaced-repetition review logic), each with its property tests.
- **Kiro feature:** Spec task execution with parallel sub-agents (five test files at once, each with its own inline generators so no two agents wrote the same file); property-based tests.
- **Result:** 45 new app tests; **188 tests pass**; `tsc` clean for root and app; no `any` in app source. The property tests found no bugs, so no code or test was changed to make them pass.
  - Cleanup checked against all 300 real clues: 13 change, and none still contain `CL:`, `[` or `e.g.` (e.g. `mountain; hill (CL:座[zuo4])` → `mountain; hill`).
  - Kiro widened the `pr.` rule beyond the spec because real data needed it: 那 was left with `(colloquial pr. )`. Kept, and added to Req 4.2.
  - Kiro flagged that a character relearned after a miss jumped straight to the 3-day gap, skipping 1 day.

## Nov 11, 2026: Requirements change: relearned characters restart at 1 day

- **What I did:** Changed the rule so a clean review after a miss lands on step 0 (1 day), the same as a new character, instead of 3 days. I approved it.
- **Kiro feature:** Spec-driven change: requirements (AC 6.2, AC 4.2), design (Property 7), code and tests updated together in one pass.
- **Why:** A character forgotten ten minutes ago shouldn't wait 3 days; mainstream spaced-repetition apps also send relearned cards back to about a day.
- **Result:** The rule reads the last outcome rather than the step, so it also holds for corrupt or hand-built entries. Sequence miss → clean → clean → clean gives steps 0, 0, 1, 2. **192 tests pass**; `tsc` clean. Leftover descriptions of the old rule in tasks.md and design.md updated to match.
- **Credits:** 265 of 4,000 used in total (53 since Spec 2 planning: tasks 1, 2.1, 9.1, 3, 4 and this change).
- **Next:** tasks 5.1 (session selection), 6.1 (save data) and 7.1 (stroke-data loader).

## Nov 11, 2026: Spec 2, tasks 5–7: session picker, save data, stroke-data loader

- **What I did:** Ran tasks 5 (5.1–5.7: choosing the 10 characters for a Séance), 6 (6.1–6.2: saving progress in the browser) and 7 (7.1–7.2: loading our own stroke data into hanzi-writer), with their tests.
- **Kiro feature:** Spec task execution with parallel sub-agents; property-based tests (Properties 4, 6, 9, 10, 11).
- **Result:** 137 new app tests; **329 tests pass** (129 data + 200 app); `tsc` clean for root and app; no `any`. Also passes on Linux with Node 22, not just my Mac's Node 26. No property test found a code bug.
  - **Spec bug Kiro caught:** Property 9 ("at most 5 new characters whenever something is due") contradicts Req 6.5(d), which tops up a short session with extra new characters so it still has 10. The code follows the requirement; the property wording needs fixing.
  - **Ordering gap Kiro caught:** the app only sees `characters.json`, which is sorted by codepoint, so new characters would be introduced in Unicode order. The HSK list is alphabetical by pinyin, so neither is a learning order. Needs a decision before task 16.
  - **Test-environment bug Kiro caught:** on Node 26 the built-in `localStorage` hid jsdom's, and its first fix (a Node flag in the app's Vitest config) never reached the test workers, because Vitest 2.1.9 ignores that setting inside a workspace project. 3 storage tests failed under the real `npm test` while passing when run alone. Fixed with a small typed shim in `app/test/setup.ts`.
  - Matched hanzi-writer 3.7.3's real loader signature `(char, onLoad, onError)` instead of the two-argument version in the design.
- **Next:** fix the Property 9 wording and stale design text, settle the learning order, then the UI tasks.

## Nov 13, 2026: Spec fixes and learning order (fewest strokes first)

- **What I did:** Fixed the Property 9 wording, brought the design up to date with what was actually built, removed an unused parameter from the save-data API, and added a new requirement: new characters are introduced fewest strokes first. I approved it.
- **Kiro feature:** Spec-driven change: requirements (AC 6.12, AC 8.7), design, tasks and code updated in one pass; property-based test (Property 12).
- **Why:** The dataset is stored in Unicode order and the HSK list is alphabetical by pinyin, so neither is a sensible order to learn in. Fewest strokes first suits a handwriting game: a learner writes 一, 二, 十, 人, 口 before anything complex, and all 300 characters are beginner level anyway. It uses stroke counts we already have, so no new data source.
- **Result:** `learningOrder(dataset)` is a pure function: stroke count ascending, ties by codepoint, and a missing or broken stroke count sorts last instead of crashing. Task 16 now states the session picker must receive `learningOrder(dataset)`, not the file's key order. `recordOutcome` no longer takes an unused time argument. **341 tests pass**; `tsc` clean for root and app.
- **Next:** the UI components: the real-hanzi-writer offline test (8), GhostPrompt (10), WriteMode (11), IntroScreen (12), StartMenu (13) and SessionSummary (15).

## Nov 13, 2026: Spec 2, tasks 8, 10–13, 15: the game screens

- **What I did:** Ran six tasks in parallel waves: a real-hanzi-writer offline test (8), the ghost's clue (10), WriteMode, the core writing game (11), the legend intro (12), the start menu (13) and the end-of-séance summary (15), each with its tests.
- **Kiro feature:** Spec task execution with parallel sub-agents (five implementations at once, then their tests).
- **Result:** 69 new tests; **410 tests pass** (129 data + 281 app); `tsc` clean for root and app; no `any`.
  - **Kiro corrected my prompt:** I wrote that the outcome rules were in "Req 1–3"; Kiro checked the spec, found they are Requirement 5, and built to that.
  - **Answer leak caught and fixed:** a test that renders all 300 clues found two that showed their own character: 么 (its meaning quotes 什么 and 这么) and 第 (quotes 第六). The clue now replaces the target character with ～ on screen only; the data is unchanged.
  - **Verified against the library source, not assumed:** hanzi-writer counts the current miss before calling `onMistake` and shows its hint on the same threshold, so our "hint shown" flag is true exactly when a hint really appears.
  - **The real, unmocked hanzi-writer** loads 我, 口 and 爱 from our own data with zero network requests, and a missing character (龘) goes to the error path.
  - **Spec wording was wrong:** hanzi-writer 3.7.3 uses mouse and touch events, not Pointer Events. Finger, Pencil, mouse and trackpad all still work. Steering doc `tech.md` corrected; the requirement is next.
  - Give-up is tested to run exactly `cancelQuiz` → `animateCharacter` → record `gave-up`.
- **Open decisions handed to the next task:** who moves on to the next ghost (WriteMode reports the outcome and keeps the answer on screen), and keyboard-only players (drawing needs a pointer).
- **Next:** spec amendments, then task 14 (SeanceSession).

## Nov 13, 2026: Spec amendments and task 14: the Séance flow

- **What I did:** Amended the spec (I approved the changes) and ran task 14, SeanceSession, which runs the 10 ghosts one after another.
  - Req 5.1: the clue hides the answer character with ～.
  - Req 5.2: input is mouse and touch events, not Pointer Events.
  - Req 8.4: every button works by keyboard; drawing needs touch, pen, mouse or trackpad.
  - Req 3.2: after each ghost the answer stays on screen with a "Next ghost" button, so the player sees the correct character before moving on.
- **Kiro feature:** Spec-driven change (requirements, design and tasks updated together) plus spec task execution with parallel sub-agents.
- **Result:** 16 new tests; **426 tests pass**; `tsc` clean for root and app; no `any`.
  - Each outcome is saved the moment it happens, exactly once; a double-click can't skip a ghost; focus moves to "Next ghost" so Enter or Space advances.
  - Kiro noticed the design's SeanceSession props were missing `dataset` and `config`, which WriteMode needs, and fixed the design.
  - Added the missing test: give-up still records exactly once, with no unhandled error, when the reveal animation fails.
- **Credits:** 375 of 4,000 used in total (110 since the last count: tasks 5–7, spec fixes, the six screens, and this run).
- **Next:** task 16 (wire everything into the app) and 17 (full-suite checkpoint), then the first real play-through.

## Nov 13, 2026: Spec 2, tasks 16 and 17: the playable app

- **What I did:** Ran task 16 (wire every screen, the scheduler and saving into `App.tsx`) and task 17 (full-suite checkpoint), and asked Kiro to confirm the production build.
- **Kiro feature:** Spec task execution.
- **Result:** Every coding task in ghost-game-core is complete. **438 tests pass**; `tsc` clean for root and app; `npm run build -w app` succeeds. The JS bundle is 197 kB (63 kB gzipped), and the same build on Linux produced the identical file hash as on my Mac.
  - The app is the only place that reads the clock; the first Séance is the 10 fewest-stroke characters, starting with 一.
  - App tests play a full 10-ghost Séance end to end, check each result is saved before "Next ghost" is pressed, check missed characters come back first 11 minutes later, and check the game still works with browser storage disabled.
  - Kiro noted the bundle still contains hanzi-writer's built-in CDN address. It is never used: we always pass our own loader, and the real-library test proves no request is made.
  - Not yet run in a real browser: drawing, the hint and the give-up animation have only been tested in jsdom. That is task 18.
- **Next:** task 18, one full Séance played by hand with a mouse.

## Nov 13, 2026: Spec 2, task 18: first real play-through (manual, by a human)

- **What I did:** Played one full Nightly Séance by hand with a mouse in a real browser, running the app locally only (`npm run dev -w app`, no network exposure). Kiro did not run or write up this check.
- **Kiro feature:** None. This is the human check that closes the spec.
- **Result:** All 9 checks passed:
  1. The intro and legend appear, and "Begin the Séance" starts a session.
  2. Each clue shows a meaning and pinyin, never the character.
  3. A clean write gives "Laid to rest" and "Next ghost".
  4. Three misses on the same stroke light up exactly one stroke, and the ghost "will return soon".
  5. Give up animates the character stroke by stroke.
  6. "Next ghost" works from the keyboard.
  7. The summary count matches what happened.
  8. After a reload the app opens on the menu, so progress was saved.
  9. In a phone-width window the writing box still fits and the page doesn't scroll while drawing.
- **Second check, automated in headless Chrome:** a script played the production build with real mouse strokes traced from the stroke data. It drew 8 ghosts cleanly, made 3 wrong strokes on 七 (exactly one hint stroke lit up, and the result was "will return soon"), gave up on 九, and advanced one ghost with Enter. The summary read "9 of 10 ghosts laid to rest". The menu showed after a reload. At 375px wide the writing box was 300px with no sideways scroll, and `touch-action: none` was set. No clue showed its own character, and no request left localhost. Only a missing favicon (404) appeared in the console.
- **Feedback:** Everything works, but the look is plain. That is expected at this stage and goes into Spec 5 (visual design).
- **Spec 2 (ghost-game-core) is complete.**
- **Next:** Spec 3: Build mode for laptops, and Cangjie structure hints.

## Nov 13–15, 2026: Spec 3 planning: the Cangjie Séance

- **What I did:** Started Spec 3, `cangjie-seance`, after an honest review: the app worked but was a well-built flashcard game, and the Resurrection theme existed only in the legend text. The fix is to make the dying technology playable: you summon each ghost by typing its Cangjie code (倉頡輸入法), the shape-based input method from 1976 that builds every character from 24 basic shapes on the QWERTY keys.
- **Kiro feature:** Spec workflow (requirements, then design) with a data check before any requirements were written; cross-spec amendments.
- **Result:**
  - **Data check first:** Kiro downloaded Unicode's Unihan 18.0.0 (Unicode License V3) and found a Cangjie code for **all 300** characters, coded for the simplified forms directly (e.g. 们 = OLS). 别 and 错 have an undocumented leading X, so they are left out of Cangjie mode: **298 playable**. 身 (HXH) stays, so the on-screen keyboard has 25 keys.
  - **Decisions (I approved them):** a separate review history per mode (writing by hand and knowing a code are different skills), so saved data moves to schema v2 with the first real migration. Single-key characters such as 口 get a letters-only keyboard, because the key face would be the answer. Empty slots show the code length. The hint stays automatic after 3 misses. Keys are ignored while a system input method is composing.
  - **History claims are whitelisted:** the "How Cangjie works" screen may say only four things, each cited to Wikipedia: invented in 1976 by Chu Bong-Foo; named after Cangjie, the legendary inventor of writing; the first Chinese input method on a standard QWERTY keyboard; released to the public in 1982. No usage statistics and no "dying" claims.
  - **Write mode gains "Reveal its shape":** an optional layout hint built from the component breakdown, for the 259 characters that have one. It counts as a hint.
  - Kiro amended the two earlier specs to match: the dataset gains a `cangjie` field (the only one allowed to be missing) and a fourth source, and "clean" now means no hint of any kind. Steering docs and a few stale property references were also brought up to date.
- **Next:** tasks.md for cangjie-seance, then implementation.

## Nov 15, 2026: Course correction after an outside review, and first deployment

- **What I did:** Had the project reviewed against the official judging criteria by a separate AI reviewer acting as a judge. It estimated about 19/50 today and 34/50 if the plan were delivered, short of a winner. Its main reasons: the resurrection was in the text, not on screen; the look was planned last; and the 300 characters are the easiest ones. I'm following its plan:
  - deploy now;
  - reframe the premise and audience;
  - trim the Cangjie Séance and fold it into one rite (summon by typing the code, then write it);
  - move the visuals ahead of the MCP work, and build hooks, a reviewer agent and the Oracle MCP while doing them;
  - test with five real people;
  - feature freeze on Nov 27.
- **Kiro feature:** Spec workflow. Kiro created a small `github-pages-deploy` spec for the deployment instead of editing files directly, because the steering says new work gets a spec first.
- **Result:**
  - **Live at https://taki-pro.github.io/ghost-script/.** A GitHub Actions workflow runs `npm ci`, all 438 tests and the build on Node 22, and deploys only if everything passes. Checked in a real browser: the page, script, styles and the 1.6 MB dataset all load from GitHub Pages, and a Séance starts with 一.
  - The first run failed because Pages wasn't switched on for the repository. I enabled it and re-ran.
  - Also added an original SVG ghost favicon, used "wept" consistently, and added "Play it" and "Run it locally" sections to the README.
  - Premise reworded so Cangjie is never called dead. Phonetic typing caused the forgetting, and the shape-based keyboard it displaced is brought back as the cure. The audience is heritage and second-language learners. History now says "developed in the 1970s".
- **Next:** re-scope `cangjie-seance` to the trimmed one-rite version, then build it.

## Nov 15, 2026: Spec 3 re-scoped to one rite

- **What I did:** Rewrote `cangjie-seance` to follow the review; I approved it. There is no mode choice any more. Every ghost is one rite: summon it by typing its Cangjie code, watch the character form and fade, then write it from memory.
- **Kiro feature:** Spec workflow (requirements, design and tasks rewritten together, with waves for parallel execution).
- **Result:**
  - The tasks are 37 leaf tasks in 8 groups and 13 waves. Kiro checked that no wave has two tasks editing the same file.
  - Cut: "Reveal its shape", the layout parser, the mode choice, per-mode histories and the save-data migration. The save schema moves to 2 and old data resets; nobody has saved progress yet.
  - Kept: Unihan codes in the pipeline, the X-code exclusion (别 and 错 skip the summon step, so 298 of 300 have one), letters-only keys for single-key characters, IME handling, the never-reveal rule, and a "How Cangjie works" guide that says "developed in the 1970s" and names Unihan `kCangjie` as the code source.
  - Kiro's own choices, accepted: the formed character holds 1.5 s and fades over 1.5 s. Giving up while summoning still goes on to writing, but the outcome stays gave-up. Steps are labelled "Step 1 of 2: Summon" and "Step 2 of 2: Lay to rest".
  - No new property tests. The verbatim-Unihan check becomes an exhaustive unit test over all 300 records, and the steering docs were updated to say so.
  - Kiro found that the earlier specs still held the withdrawn amendments (mode choice, per-mode history, shape hint). Those are fixed next.
- **Credits:** 490 of 4,000 used in total (115 since the last count: Spec 3 planning, the deploy spec, and this re-scope).
- **Next:** align the two earlier specs, then build the data pipeline group.

## Nov 15, 2026: Cangjie Séance groups 1–2: Cangjie codes in the dataset

- **What I did:** Aligned the two earlier specs with the one-rite plan, then ran groups 1 and 2 of `cangjie-seance`: the data pipeline and its checkpoint.
- **Kiro feature:** Spec task execution with parallel sub-agents in waves (19 tasks across six waves), plus cross-spec amendments.
- **Result:**
  - **The data:** Unicode's Unihan 18.0.0 file (Unicode License V3) is committed under `data/raw/unihan/` with its licence. The build checks the file's SHA-256 against `SOURCES.md` before reading it, and refuses to build on a mismatch, a malformed code or a character with two codes.
  - **Build summary:** "Cangjie code: 300 of 300 characters have one. Playable in Cangjie: 298 of 300. Not playable: 别 错."
  - **Spot checks:** 我 = HQI, 口 = R, 爱 = BBKE, 们 = OLS, 身 = HXH.
  - **Determinism:** rebuilding on Linux reproduced the Mac's `characters.json` with zero differences.
  - **Kiro caught a flaw in its own plan:** wave 3 ran a test that reads `characters.json` alongside the task that regenerates it. Kiro reordered them instead of risking a test against stale data.
  - **Tests:** 65 new, none of them property tests, as decided. That includes an exhaustive check of all 300 codes against the raw Unihan file. **503 tests pass**; `tsc` clean for root and app. The loader now rejects a malformed code.
  - The earlier specs no longer mention the withdrawn mode choice, per-mode history or shape hint. Req 5.1 now says the character stays hidden until the summon completes and fades before writing.
- **Next:** groups 3–4: the summon engine and save-data schema 2.

## Nov 15, 2026: Cangjie Séance groups 3–4: summon engine and save data v2

- **What I did:** Ran groups 3 and 4 of `cangjie-seance`: the pure engine for the summon step, and save-data schema 2.
- **Kiro feature:** Spec task execution with parallel sub-agents.
- **Result:**
  - **Engine:**
    - `outcome.ts` holds the shared outcome rules. `combineOutcomes` gives gave-up if either step gave up, then struggled if either struggled, otherwise clean.
    - `mask.ts` hides the target character and handles characters outside the Basic Multilingual Plane.
    - `cangjie.ts` has the 25-key table (24 shapes plus 難), keyboard parsing that ignores Z, modifier keys, auto-repeat and input-method composition, and a summon reducer. One wrong key is one mistake, and three misses in a row on the same slot show the next key.
  - **Save data:** schema 2 adds "How Cangjie works seen". Version-1 data resets to defaults, with no migration, as decided.
  - **Kiro kept the tests honest:** the corrupt-data tests now start from valid version-2 data, so they fail for the field being checked, not just because the version is old.
  - **Kiro checked its own sub-agent:** one agent only read part of the design, so Kiro compared that agent's exported signatures and rules against the full design itself. They match.
  - **Tests:** 52 new, none of them property tests. **555 tests pass**; `tsc` clean for root and app. The live site redeployed.
- **Next:** groups 5–6: the summon screen, the guide, and wiring the two-step rite into the Séance.

## Nov 15, 2026: Cangjie Séance groups 5–7: the rite is playable

- **What I did:** Ran groups 5, 6 and 7 of `cangjie-seance`: the summon screen, the "How Cangjie works" guide, a third menu button, wiring the two-step rite into the Séance and the App, and the final checkpoint.
- **Kiro feature:** Spec task execution with parallel sub-agents, plus an exhaustive never-reveal test generated over the real dataset.
- **Result:**
  - **The rite:** "Step 1 of 2: Summon" shows empty slots, one per key in the code. Each correct key fills a slot with its shape, then the character draws itself, holds and fades. "Step 2 of 2: Lay to rest" is written from memory. 别 and 错 go straight to writing.
  - **The guide** shows all 25 keys and an example taken from the dataset (七 = JU: 十 then 山). It makes only the four sourced history claims, cites both Wikipedia articles, and says the codes follow Unihan `kCangjie`, which Unicode marks provisional.
  - **Never-reveal test:** for each of the 298 playable characters, it renders the clue and the summon step, then searches every text node and attribute for the character, before any key and again after a key hint. No leaks.
  - **Kiro fixed two gaps between its code and the design while writing tests.** The mistake count now sits inside the screen-reader status line, and the on-screen keys are labelled with their shape.
  - **Tests:** 350 new (299 of them are the never-reveal sweep), none of them property tests. **905 tests pass**; `tsc` clean; the build succeeds.
- **Automated play-through in headless Chrome** of the production build, with real key presses and mouse strokes traced from the stroke data:
  - The guide appeared before the first Séance.
  - 一 (M): typed cleanly, then written: clean.
  - 七 (JU): three wrong keys showed "Hint: press J (十)" and the J key lit up. Correct keys, then a clean write, gave **struggled**.
  - 九: gave up during the summon. The code was revealed, writing still followed, and the result was **gave-up**.
  - 了 (NN) was summoned by clicking the on-screen keys.
  - The summary read "9 of 10 ghosts laid to rest", which is correct.
  - The character never appeared in the page text or attributes during the summon step, or after it faded during writing.
  - No console errors. At 375px wide there was no sideways scroll.
- **Notes for the visual work:**
  - On a phone the key rows wrap unevenly (6 + 4, 6 + 3, 6), losing the keyboard shape.
  - The formed character appears below the slots and pushes the keyboard down.
- **Next:** the human check (group 8), then visual identity.

## Nov 16, 2026: kiro-tooling: data hook, accuracy reviewer, Cangjie Oracle MCP and Power

- **What I did:** Wrote and built a `kiro-tooling` spec in one pass, so that hooks, a custom agent, MCP and a Power do real work for the rest of the build, not just appear in the write-up.
- **Kiro features:** agent hooks, custom agents, MCP, Powers, specs, steering.
- **Result:**
  - **Data check hook** (`.kiro/hooks/data-check-on-save.json`): on saving `data/character-list.txt`, `data/prompt-overrides.csv` or anything under `data/raw/`, it runs `npm run check:data`. That rebuilds the dataset, runs the dataset tests and prints `DATA CHECK PASSED` or `DATA CHECK FAILED`. Its pattern skips the build's own outputs, so it can't trigger itself.
    - Changing 吧's override to entry 9 fails with: "吧: override entry-index-out-of-range … Fix this row in data/prompt-overrides.csv (column entryIndex). No output written." Reverting it passes.
    - **Not yet confirmed:** the hook did not visibly fire when Kiro's own agent saved the file, even though the docs say agent saves trigger it. To be checked by hand in the IDE.
  - **`accuracy-reviewer` agent** (`.kiro/agents/`): read-only, with file writes and shell commands denied. It checks text against `content-accuracy.md` and reports `path:line [rule] "quote"`.
    - **Its first review, run as an emulation (a Kiro sub-agent following the reviewer's prompt, not the custom agent itself), found a real answer leak.** The "How Cangjie works" guide used 七 (JU) as its example, and 七 is the second ghost a new player meets, so the guide gave away that ghost's code.
    - It also flagged an uncited history line in the README and three unsourced sentences in the guide.
  - **Cangjie Oracle MCP server** (`oracle/`, stdio, SDK 1.32.2, no network): `lookup`, `verify` and `decompose` answer only from the committed dataset. Called over real stdio: 我 → HQI from Unihan 18.0.0 `kCangjie` (marked provisional), playable; "hqi" verifies as HQI; 好 → ⿰女子 from Make Me a Hanzi.
    - Registered in `.kiro/settings/mcp.json`. Kiro is blocked from writing its own settings folder, so I created that file myself.
  - **Oracle Power** (`oracle/power/`): manifest, MCP config and a skill telling Kiro never to state codes from memory. Importing it into Kiro is still to be tried.
  - **Tests:** 128 unit tests, including the Oracle checked against all 300 records and a scan proving it has no network code. **1033 tests pass**; `tsc` clean for root, app and oracle.
- **Next:** fix the leak and the unsourced lines, confirm the hook by hand, then visual identity.

## Nov 16, 2026: Hook and Oracle verified by hand; first real accuracy review

- **What I did:** Checked the tooling by hand in the Kiro IDE, then had Kiro fix what the accuracy reviewer found and run the reviewer agent itself for the first time (the earlier run was an emulation).
- **Kiro features:** agent hooks, MCP, custom agents, spec amendments.
- **Result:**
  - **The data hook works on a human save.** At first it didn't fire, because Kiro loads hook files when a session starts and this one was new. After a window reload, saving `data/prompt-overrides.csv` with 吧 set to entry 9 made the chat report `DATA CHECK FAILED: build:data` and the exact row and column to fix. Saving the reverted row reported `DATA CHECK PASSED`. Both were recorded for the video.
  - **The Oracle works inside Kiro.** It first showed "Connection Failed", then connected (3 tools) on Retry. Asked in chat to look up 我 and decompose 好 "not from memory", Kiro called the MCP tools and answered HQI from Unihan 18.0.0 (provisional) and ⿰女子 from Make Me a Hanzi. Recorded for the video. Kiro's chat font draws ⿰ as an empty box; the data is correct.
  - **The guide no longer gives away an early ghost.** Its example is now 想 = DUP (木 山 心), at position 290 of 300 in the learning order, instead of 七, the second ghost. A test checks the example is at position 30 or later.
  - **Guide wording:** dropped the unsourced lines about the X key; the "family of related shapes" sentence now sits under the Wikipedia citation.
  - **Security:** the Oracle's zod went from 3.25.76 to 4.6.7, clearing a high-severity advisory. The remaining audit warnings are all in dev and test tooling.
  - **The real reviewer** found more: the README premise was worded as fact, the Huainanzi line had no recorded source, and two guide lines about how codes work read like claims about Cangjie. It also flagged the designed summon reveal. Decisions, which I approved:
    - The premise is now worded as a premise.
    - The Huainanzi line is sourced to Lau's concordance (8/62/27–28), as quoted by Puett.
    - Game instructions are worded as being about this game.
    - The designed reveal and a late guide example are recorded as not leaks.
  - **1038 tests pass**; `tsc` clean for root, app and oracle.
- **Next:** visual identity.

## Nov 16, 2026: visual-identity: ink, paper, ghosts, graveyard, credits

- **What I did:** Wrote the `visual-identity` spec in one pass, answered Kiro's eight questions (I approved the answers), then ran every task except the log entry and the phone check.
- **Kiro features:** spec workflow with parallel waves; the `accuracy-reviewer` custom agent run as a task inside the spec.
- **Result:**
  - **The look:**
    - Writing happens on a cream paper surface with a faint red 米字格 practice grid, and strokes draw in near-black ink.
    - The clue card has a small ghost: it fades away when laid to rest, flickers once and stays half-visible when struggled, and drifts off on give-up. All motion sits behind `prefers-reduced-motion`.
    - Headings use Cormorant Garamond (SIL OFL, 23 kB); Chinese uses the device's own fonts.
  - **Graveyard:** all 300 characters as tombstones in learning order: dashed for never met (no glyph, enforced by the data type), red for restless, green for at rest, with counts and accessible names.
  - **Credits:** every data source and licence (checked against the README by a test), the Huainanzi source, the Cangjie citations, the font, and a "Software" section.
    - The full licence texts of the 7 runtime packages are generated into `THIRD_PARTY_NOTICES.txt`, and a test fails if that file goes stale. The build strips licence comments, so this closes a real licence gap.
  - **Phone keyboard:** keeps its 10 / 9 / 6 rows at every width, and the formed character has a fixed space, so the keys no longer jump.
  - **Accuracy reviewer, real agent, as a spec task:** the first run flagged two unsourced claims about which devices have Chinese fonts, in the design doc itself. They were reworded as unverified assumptions, and the second run returned "No findings".
  - **Tests:** 106 new (no property tests). **1144 tests pass**; `tsc` clean for root, app and oracle. The new bundle check passes at 132,505 bytes gzipped against a 300,000-byte budget, with `characters.json` excluded.
- **Automated play-through in headless Chrome** of the production build at 1440, 768 and 375 px wide:
  - 一 clean, 七 struggled, 九 gave up, 了 and 二 clean. The ghost states matched each time: faded, flickering, drifted.
  - No character leaked during writing.
  - The graveyard showed exactly 一七九了二 out of 300, the rest hidden.
  - The licence link loads.
  - Phone keys are 32.5 px wide in 10 / 9 / 6 rows with no sideways scroll; tablet keys are 48 px.
  - No console errors.
- **Polish noticed:** after a ghost is laid to rest, "Laid to rest" appears twice and a greyed-out "Give up" stays on screen.
- **Next:** the polish, one job in Kiro CLI or Web, then five testers.

## Nov 16, 2026: Polish: one result line, Give up hidden after the outcome

- **What I did:** Asked Kiro (IDE) for two small fixes found in the browser check: "Laid to rest" appeared twice, and a greyed-out Give up stayed on screen.
- **Kiro feature:** Kiro recorded the change as Requirement 17 and task 12.1 in the `visual-identity` spec, so even a small polish has a spec trail.
- **Result:**
  - Only the Séance's result line remains. The old duplicate could even disagree with it: a struggled summon followed by a clean write showed "Laid to rest" from the writing step alone.
  - Give up disappears once a ghost is resolved, and also while a summoned character forms and fades.
  - **Kiro found a bug I hadn't asked about:** Give up could be pressed before the writing surface had loaded. It now stays disabled until hanzi-writer's quiz has started. Kiro checked in the library source that this happens at the start of writing, not the end.
  - A new test runs the real WriteMode inside the Séance and checks for exactly one result line. **1151 tests pass**; `tsc` clean.

## Nov 16, 2026: Kiro CLI: the same accuracy reviewer, from the terminal

- **What I did:** Ran the `accuracy-reviewer` custom agent from Kiro CLI V3 (`kiro-cli chat --agent accuracy-reviewer`) over the README, `app/src/components` and `app/src/data`.
- **Kiro features:** Kiro CLI, custom agents. One agent file in `.kiro/agents/` works in both the IDE and the CLI.
- **Result:** It read 33 files in 1m 45s for 8.82 credits, changed nothing, and found four things:
  - **The README named "character amnesia" without a source.** Fixed: it now cites the Wikipedia article and says how widespread it is is debated.
  - **The README didn't state that each field of `characters.json` carries its source's licence.** Fixed.
  - **Two flags on the Graveyard showing a gave-up character.** Not leaks: giving up reveals the character on screen, so it is no longer hidden. Recorded as a human decision in `content-accuracy.md`.
- **CLI vs IDE:** It felt good: different from the IDE but easy to use and easy to understand. The agent's welcome line, the tool-call summary and the credit cost per turn were all on screen, so it was clear what it read and what it cost.

## Nov 16, 2026: First tester feedback

- **What I did:** Shared the live link with testers and collected their first reactions.
- **Feedback:**
  1. There is no way out: no exit button during a Séance.
  2. In the Graveyard, "Back to menu" is at the bottom, below 300 tombstones; you have to scroll all the way down to leave.
  3. The Credits button is unclear: "Also what is the credits button for?"
  4. The design is still too plain: "just plain black".
- **Next:** a spec amendment covering all four, which I approved, built by Kiro.

## Nov 16, 2026: Tester fixes: exit, sticky headers, clearer naming, night scene

- **What I did:** Turned the first tester feedback into new requirements in the `visual-identity` spec, which I approved, then had Kiro build them.
- **Kiro features:** spec amendments across two specs; the `accuracy-reviewer` agent run as a spec task, three rounds until clean.
- **Result:**
  - **Exit:** a "Leave séance" button on every Séance screen, with an inline Leave / Stay prompt instead of a browser dialog. Focus goes to Stay; Escape closes it. Finished ghosts are already saved, and the unfinished one isn't recorded. This replaces the old "no menu during a Séance" rule.
  - **Sticky headers:** the Graveyard and the sources screen keep the title and "Back to menu" at the top while scrolling.
  - **Naming:** "Credits" is now "Sources & licences", with the caption "Where the words, strokes, codes and fonts come from."
  - **Night scene, CSS only:** a blue-black sky gradient, two slow mist layers, a moon glow behind a large Cormorant title with the ghost above it, and a candle-gold main button and focus rings. Tests check every text colour at 4.5:1 or better even under the brightest mist and moon (lowest 5.64:1).
  - **The reviewer wouldn't let an untrue sentence ship.** The Leave prompt was to say "Ghosts you've finished are saved." The reviewer showed this is false when the browser can't save, so the text now depends on whether every save this visit worked. Two more rounds tightened the wording and the save flag. The third run returned "No findings".
  - **1223 tests pass**; `tsc` clean; bundle 134,057 bytes gzipped, under the 300,000 budget.
- **Automated browser check (headless Chrome):** the Leave prompt opened with focus on Stay, and Leave went back to the menu. "Back to menu" stayed visible after scrolling the 300 graves. No console errors.
  - **Bug found:** on a phone (375 px) the sources screen's tables are about 975 px wide, so the whole page scrolls sideways.
- **Next:** fix the phone overflow, then more testers.

## Nov 16, 2026: Phone overflow fixed, with a real-browser width test

- **What I did:** Asked Kiro to fix the sideways scroll on the sources screen and to add a test that would catch it. Kiro pointed out that the existing jsdom tests can't measure widths (every element reports 0), so a real-browser test was needed. I chose Playwright as a dev-only tool, which I approved.
- **Kiro features:** spec amendment (Requirement 24, tasks 22.1–23); parallel sub-agents; a diagnosis done with a throwaway browser script.
- **Result:**
  - **Narrow screens:** below 640 px, each data source and software package is a stacked card instead of a table row. Long commit hashes and URLs wrap.
  - **New `npm run test:e2e`:** `@playwright/test` 1.65.1, dev-only, not in the shipped bundle or `npm test`. It builds the app, serves it under `/ghost-script/`, and checks five screens at 375 × 812 for any element wider than the page. A guard test adds a 600 px element and checks it gets reported, so the check can't pass by accident.
  - **The new test caught a second bug I hadn't seen:** the "How Cangjie works" guide was 378 px wide on a phone. Kiro traced it, by hiding elements one at a time in a real browser, to the long Wikipedia URL in its sources line, and applied the same wrap fix.
  - **1229 unit tests and 6 e2e tests pass**; `tsc` clean; bundle 134,346 bytes gzipped.
- **My own browser check:** at 375 px and 768 px, the sources screen, the Graveyard and the guide are exactly as wide as the screen. At 320 px (the smallest phones) the sources screen is still 21 px too wide.

## Nov 16, 2026: Second outside review, and step 1: the rite on one screen

- **What I did:** Had the project reviewed again by the same outside AI reviewer. It scored the project about 26 of 50 with no video yet (up from 19), and named one gap above all: typing a Cangjie code is guesswork, so the game never shows its own premise working. I'm taking its order of work: layout, keys that ink their own part of the character, a learnable order, a full design pass, a paper test with real people, harder characters, then freeze and video.
  - **Not taken:** traditional characters, unless everything else is finished.
  - **Corrections it prompted:** this log had credited the reviewer agent with a catch made by an emulation of it; fixed. The log and README now record approvals in the first person, and the no-names rule has no exceptions.
- **Kiro features:** spec amendment (visual-identity, tasks 24–25); parallel sub-agents; Playwright e2e tests.
- **Result (step 1):**
  - **One screen:** the Summon and Write steps fit without scrolling at 1024 × 768 and 375 × 812. The paper is sized from the viewport, and the clue card is compact.
  - **Scroll reset:** the page returns to the top on every screen change and each new ghost.
  - **320 px:** the sources screen fits; the cause was one unbreakable URL in the font copyright line.
  - **Keys on tiny phones:** Kiro worked out that ten 32 px keys need a 370 px screen, so below that the keys narrow (about 27 px at 320 px) and stay 44 px tall in three rows. I chose that over keys that touch.
  - **e2e tests went from 6 to 20:** width checks at 375 and 320 px, plus fit and scroll-reset checks at laptop and phone sizes.
  - **Names:** the specs say "approved by the human" and the data says "human-approved". `characters.json` is byte-identical after the rebuild, and a new test fails if a personal name appears in tracked files.
  - **1261 unit tests and 20 e2e tests pass**; `tsc` clean; bundle 134,677 bytes gzipped.
- **My own browser check:** at 1024 × 768 and 375 × 812 neither step scrolls. At 320 × 640 the Summon step is 20 px taller than the screen, which is outside the sizes the fit rule covers.
- **Next:** step 2, each key inking its own part of the character.

## Nov 17, 2026: summon-ink: each key inks its own part of the character

- **What I did:** Wrote and built the `summon-ink` spec, the main change from the second review: typing a code was guesswork because the keys never visibly built the character.
- **Kiro features:** spec in one pass with parallel waves; the Cangjie Oracle MCP used during design; one property-based test; the `accuracy-reviewer` agent as a spec task; Playwright e2e.
- **Result:**
  - **A rule in the data pipeline** sorts every character by how visible its code is, with no hand-written lists. It compares each key's base shape with the leaves of the character's decomposition and the strokes matched to them. Build summary: "Summon ink: transparent 15, partial 95, opaque 190".
  - **Transparent:** every key inks its part. For 明 (AB), pressing A draws the four strokes of 日 and B draws the four of 月.
  - **Partial:** matching keys ink their part, and other keys say "This key's shape is one the game doesn't show yet."
  - **Opaque:** the character forms at the end as before, with one note: "This code uses shapes the game doesn't show yet."
  - **Learning order** is now transparent first, then partial, then opaque, fewest strokes first within each. A new player starts with 一 二 人 下 女 instead of 一 七 九 了 二.
  - **Kiro used the Oracle's `decompose` tool** to spot-check 明 早 天 果 里 本 下 干 before designing. It also found that the rule must read the decomposition tree's leaves, because the stored component list drops repeats such as 林 = 木 木.
  - **Checked against the library source:** hanzi-writer's `animateStroke` calls cancel each other if they overlap, so strokes are queued one at a time. A test with the real library proves both behaviours.
  - **The dataset only gained lines:** 1,917 added, none removed. A per-record checksum taken beforehand proved every existing field byte-identical, and was then deleted. The rebuild on Linux matches the Mac's.
  - **The reviewer agent caught an unsourced claim in the spec itself**, that shapes like 亻 are "variant forms" of 人. It was reworded to what the data shows, and the second run returned "No findings".
  - **Tests:** about 427 new unit tests (298 are a never-reveal sweep after every correct key) and 9 new e2e tests. **1688 unit and 29 e2e tests pass**; `tsc` clean; bundle 135,450 bytes gzipped.
- **My own browser check (headless Chrome, production build):** played the first ten ghosts, 一 二 人 下 女 干 从 天 手 本. After each key, the number of visible inked strokes matched the data exactly (本: 4 after D; 天: 1 after M). No console errors.
- **Still weak:** four of the first ten ghosts (一 人 女 手) have one-key codes, so the first press is still a guess.
- **Next:** show the code on first meeting, hide it on return, and open with a guided 明.

## Nov 17, 2026: first-meeting: taught the first time, tested on return

- **What I did:** Wrote and built the `first-meeting` spec in one pass, the next step from the second review: a new player still had to guess codes, and a wall of 25 keys came before anything happened.
- **Kiro features:** spec in one pass; the `accuracy-reviewer` agent as a spec task; Playwright e2e.
- **Result:**
  - **First meeting:** a ghost with no saved history shows its code as faint letters in the slots, with the next key highlighted (ring, bold and underline, so colour isn't the only signal). Copying it can still end clean. A returning ghost hides the code, so the spaced repetition now tests something real.
  - **Guided first ghost:** a brand-new player starts on 明 with one line per step, built from the dataset's own meanings: "Press A: the sun 日", "Press B: the moon 月", "Now write it from memory".
    - It is picked by rule, not by name. **Kiro caught that my rule was too loose:** it picked 从 (人 beside 人). I chose "two different keys", and a test confirms the rule picks 明.
  - **The guide no longer blocks the first Séance.** It stays on the menu.
  - **The summary shows the haunting:** each ghost with when it returns ("returns in 10 minutes", "returns tomorrow").
  - **The reviewer agent asked where the key-to-shape table comes from.** Kiro checked all 25 pairs against the Wikipedia article and recorded it as the source. The second run returned "No findings".
  - **Tests:** every playable character is now swept for leaks both as a first meeting and as a returning ghost. **3578 unit and 39 e2e tests pass**; `tsc` clean; bundle 136,755 bytes gzipped. The dataset, scheduler and save format are unchanged.
- **My own browser check (headless Chrome, production build):** as a new player I got 明 first with the faint "A B" and "Press A: the sun 日". After A the line changed to "Press B: the moon 月". The write step said "Now write it from memory" with no 明 on the page. Writing it gave a clean result, and the summary listed 明 as "returns tomorrow" and the ghosts I gave up on as "returns in 10 minutes". No console errors.
- **To fix:** the intro says "characters … are ghosts. Type its shapes", which doesn't agree in number.
- **Next:** the design pass: ink and paper by candlelight.

## Nov 17, 2026: ink-and-candlelight: one art direction for every screen

- **What I did:** Wrote and built the `ink-and-candlelight` spec, the design pass from the second review, which called the look tidy but generic. Direction: a séance at a writing desk, ink and paper by candlelight. I accepted Kiro's defaults on thirteen open choices except one: the seal carries the ghost's own character.
- **Kiro features:** a new always-on steering file (`art-direction.md`) so later screens follow the same rules; spec with parallel waves; the `accuracy-reviewer` agent; Playwright screenshots as test artefacts.
- **Result:**
  - **Palette:** ink black, aged paper and one accent, seal red, used only for the primary action, success and the stamp. Candle amber appears only as light.
  - **Seal:** a clean ghost gets a red seal stamped on the paper carrying its own character. A test checks no seal exists before the outcome.
  - **Keys** look like worn keycaps, finished strokes have an ink-bleed edge, and buttons are paper slips.
  - **Chinese font:** LXGW WenKai Regular v1.530 (SIL OFL 1.1), subset to the 321 glyphs the app shows: 66,532 bytes, built reproducibly with its checksum and both copyright lines recorded. Kiro rejected four brush fonts because they lack 難, which the X key needs.
  - **Honest limits Kiro reported:** hanzi-writer can't vary stroke width, so "brush strokes" are a wider stroke plus a bleed filter. Only 天 and 雨 of the legend line are in the dataset, so that line is revealed with a CSS wipe, not drawn stroke by stroke.
  - **The new screenshot test caught the moon overlapping two headings**, so the disc was made smaller and moved to the top edge, which breaks the spec's own size rule.
  - **3667 unit and 47 e2e tests pass**; `tsc` clean; bundle 207,858 bytes gzipped against 300,000. The reviewer agent returned "No findings". No game rules, data or save format changed.
- **My own browser check (headless Chrome, 1024 × 768 and 375 × 812):** played 明 to a clean result. The seal appeared with 明 in it, the font loaded, nothing scrolled, and there were no console errors.
  - **What works:** the seal, the keycaps, the inked strokes, the red primary button.
  - **What doesn't yet:** the moon is a dim half-disc cut off by the top edge and reads as a glitch. The mist isn't visible in a still. The Graveyard is still a grid of dashed squares, not a hillside. The ghost is a flat silhouette, not an ink wash.
- **Next:** fix those four, then the paper test with real people.

---

## Nov 17, 2026: ink-and-candlelight follow-up from my screenshot review

- **What I did:** Gave Kiro the six things my screenshot review found (moon, mist, Graveyard, ghost, intro legend, seal position). It amended the spec and built them.
- **Kiro features:** spec amendment with parallel sub-tasks; the `accuracy-reviewer` agent; Playwright tests that measure the picture instead of trusting it.
- **Result:**
  - **Moon:** a full disc in the top-right corner. Below 992 px wide, screens keep empty space at the top for it. A test fails if the disc is cut off or lies under text, at three screen sizes.
  - **Mist:** two bands in the lower third. Kiro reported the limit: any stronger and the green success text falls below 4.5:1 contrast.
  - **Graveyard:** every grave is an arched stone tablet with a small fixed tilt. Never-met tablets are blank stone.
  - **Ghost:** an ink wash with uneven tone and a soft lower edge.
  - **Intro legend:** a paper slip with the line set large in WenKai.
  - **Seal:** smaller and in the paper's corner margin. A test measures the gap to every stroke on four characters; the smallest is 26 px.
  - **Kiro caught its own design error:** the design said error text on the moon reached 4.72:1. Measured with the glow and grain included it was 4.20:1, so the disc was dimmed from 0.70 to 0.65 (4.59:1).
  - **The reviewer agent flagged two intro lines with no source shown.** Kiro added both citations to the intro, and the re-run returned "No findings".
  - **3692 unit and 68 e2e tests pass**; `tsc` clean; bundle 208,364 bytes gzipped against 300,000.
- **My own browser check (headless Chrome, 1024 × 768 and 375 × 812):** I ran the 68 browser tests myself and looked at the screenshots.
  - **What works:** the tablets, the seal in the margin, the paper slip, the full moon disc.
  - **What the fix broke:** the two citations made the intro too tall. The "Begin the Séance" button is now below the fold on both sizes (902 px of page on a 768 px screen; 1214 px on 812 px), and the night sky stops at the first screen's height. No test covers the intro's height, which is why nothing failed.
  - **Smaller:** the intro screenshot is taken before the legend line finishes appearing, so the saved picture shows an empty slip. The hill behind the Graveyard can't be seen. The moon is a flat disc.
- **Next:** shorten the intro's sources to one link to the Sources & licences screen, add the intro to the one-screen test, then the paper test with real people.

---

## Nov 17, 2026: Intro fix: one screen again, and a night that covers the whole page

- **What I did:** Gave Kiro the faults my last check found: the intro no longer fit one screen, the sky stopped after the first screen, the intro screenshot was taken too early, the moon was flat and the Graveyard hill couldn't be seen.
- **Kiro features:** spec amendment with parallel sub-tasks; the `accuracy-reviewer` agent; steering updated so the decision is on record; an "Input required" question when an old test contradicted the approved design.
- **Result:**
  - **Intro:** the long citations and raw links are gone. One small "Sources" link under the button opens Sources & licences, where the full citations already are. `content-accuracy.md` records that this link meets the citation rule. The reviewer agent returned "No findings".
  - **A test now covers what broke:** the one-screen test checks the intro at 1024 × 768, 375 × 812 and 320 × 640, and that the button is inside the screen. Space left under the button: 120, 150 and 53 px.
  - **Night scene:** Kiro found the cause. The sky, grain and mist were fixed layers one screen tall. They now run the full page height, and a new test samples pixels down the whole page.
  - **Moon and hill:** the moon has a soft shade on one side. The Graveyard has a hill behind its first rows.
  - **One judgement call I made:** an older test required the hill picture to cover the whole grid, which the approved design no longer does. I chose to rewrite the check to measure the hill and its ground together, not to delete it.
  - **3724 unit and 83 e2e tests pass**; `tsc` clean; bundle 209,020 bytes gzipped against 300,000.
- **My own browser check (headless Chrome):** I ran all 83 browser tests myself and looked at the intro and Graveyard screenshots at both sizes. The intro fits with the button and the "Sources" link visible, the legend line is complete, and the hill shows behind the first rows.
- **Limits Kiro reported:** only 53 px spare under the button at 320 × 640; the mist now scrolls with the page; never-met tablets stand out only faintly against the near hill.
- **Next:** the design pass is done. The paper test with real people is next.

---

## Nov 17–18, 2026: harder-ghosts: 900 more ghosts in two new levels

- **What I did:** Wrote and built the `harder-ghosts` spec. The game had only the 300 HSK 3.0 level 1 characters, which most people with character amnesia can already write. It now has levels 2 and 3 as well (400 and 500 characters, 1,200 in all), and a first-run screen asks where to start.
- **Kiro features:** spec with a hard source gate before any build task; parallel sub-agent waves; steering amendments to `content-accuracy.md`, `art-direction.md` and `product.md`; the `accuracy-reviewer` agent; the Cangjie Oracle extended to all 1,200 characters; "Input required" questions.
- **Decisions I made:**
  - Minify the two new data files (level 3 went from about 3.3 MB to 1.6 MB raw). Level 1 stays byte-identical, and a hash test enforces it.
  - Unreviewed prompts may ship, but the README and the Sources & licences screen state the reviewed and unreviewed counts, computed from the data.
  - A random sample of 50 prompts per level for me to review, with a fixed, recorded seed.
  - Kiro's sandbox refused to download the pinned HSK list, so I downloaded it myself. Kiro then checked its size and SHA-256 before using it.
  - The new review files must not hold personal names: `reviewedBy` is `human` or empty. Level 1's existing `human-approved` values stay as they are.
- **Result:**
  - **Source gate passed exactly as predicted:** every new character is in every source, with one Cangjie code each. 13 characters skip the Summon step under the existing rule.
  - **Loading:** new levels and their font subsets download only when a player picks them. The counted first load is 214,206 bytes gzipped against 300,000.
  - **Save:** schema 3 with a tested migration; an old save keeps its history and starts at level 1.
  - **Kiro's e2e test found a real bug:** the new level screen didn't fit one screen at any size, because it stacked a second full-screen height inside the page shell. Kiro fixed it.
  - **4024 unit tests and 95 e2e tests pass**; `tsc` clean.
- **What my own check found:** I compared each new prompt's reading with the readings in the HSK list's own example words, using CC-CEDICT. About 55 of the 900 new prompts use a rare or wrong reading. Examples: 鸟 is glossed "penis", 胖 "healthy", 读 "comma", 叶 "to be in harmony", 柜 "Salix multinervis". The default prompt rule takes the first CC-CEDICT entry, which is fine for level 1 (a human reviewed all 300) but not for 900 unreviewed ones. 29 new prompts also show other Chinese characters, some the ghost's own traditional form ("variant of 贊|～").
- **Next:** a sourced rule that picks the reading the HSK examples use and skips meanings containing Chinese characters, then my review of the changed prompts and the samples.

---

## Template for new entries

## [Date]: [Short title]

- **What I did:**
- **Kiro feature:**
- **Why:**
- **Result:**
