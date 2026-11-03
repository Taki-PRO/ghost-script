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

- **What I did:** Started the first spec with the built-in **Spec** agent: chose "Build a Feature" (not Quick Spec, so every phase is reviewed) and "Requirements first". Autopilot off, model on Auto.
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

---

## Template for new entries

## [Date]: [Short title]

- **What I did:**
- **Kiro feature:**
- **Why:**
- **Result:**
