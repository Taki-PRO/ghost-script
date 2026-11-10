# Implementation Plan: ghost-game-core

## Overview

Build the first playable version of Ghost Script: a React + Vite single-page app in `app/` that reads the read-only `app/public/data/characters.json` and turns forgotten characters into ghosts the player lays to rest in Write mode. Work proceeds in layers that each build on the last with no orphaned code: first the app + npm-workspace + dual-project Vitest bring-up (proving the existing 129 data tests and the new app tests run together under one `npm test`), then the pure engine (config, prompt cleanup, scheduler, storage, data loader) each with its unit and property tests written alongside, then the real-hanzi-writer offline integration test, then the UI bottom-up (prompt → write mode → intro → menu → session → summary) each with jsdom/testing-library tests, then the App wiring that connects data load, persistence, and the injected clock, then a full-suite checkpoint, and finally a single manual play-through verification recorded in `kiro-log.md`. The engine is pure and clock-injected; the UI owns `Date.now()` and all I/O.

## Tasks

- [x] 1. App scaffold, npm workspace, and dual-project test bring-up
  - Scaffold a Vite + React + TypeScript app under `app/` with `strict: true`: create `app/package.json`, `app/tsconfig.json`, `app/vite.config.ts`, `app/index.html`, `app/src/main.tsx`, `app/src/App.tsx` (placeholder), and a Tailwind CSS setup (`app/tailwind.config.ts`, `app/postcss.config.js`, `app/src/styles/index.css` with Tailwind directives)
  - In `app/package.json` pin EXACT versions (no caret) chosen to be compatible with the repo-root Vitest 2.1.9: dev `vite@5.4.x` (pick a concrete 5.4 patch, e.g. `5.4.11` — choose the latest 5.4 patch at implementation time), `@vitejs/plugin-react@4.3.x` (concrete 4.3 patch), `tailwindcss@3.4.x` (concrete 3.4 patch; v3-style config with `postcss` + `autoprefixer` as already planned); runtime `react@18.3.x` and `react-dom@18.3.x` (concrete 18.3 patch) UNLESS the chosen `@testing-library/react` version requires React 19 — in that case use the React version testing-library requires and note the deviation; runtime `hanzi-writer` EXACT `3.7.3`
  - Dev deps also include the testing-library set (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`) PLUS `@testing-library/dom` (exact pin) as an explicit dev dependency (it is a peer of `@testing-library/react`), and `typescript`, `postcss`, `autoprefixer`, `jsdom` (all exact pins)
  - Add `app/package.json` scripts: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"` (so the app can be run and the manual check in Task 18 can start the dev server)
  - Add `"workspaces": ["app"]` to the root `package.json`; keep the root `"test": "vitest run"` script unchanged
  - After the root `npm install`, run `npm ls` (and/or `npm ls --workspaces`) to check peer-dependency compatibility, and REPORT any peer-dependency warnings or conflicts (e.g. React version peers for testing-library, Vite plugin peers). Resolve or explicitly document any warning before moving on
  - Create root `vitest.config.ts` (NODE project): `include: ['tests/**/*.test.ts']`, `environment: 'node'`
  - Create `app/vitest.config.ts` (APP project): `include: ['app/**/*.test.{ts,tsx}']`, `environment: 'jsdom'`, `setupFiles: ['app/test/setup.ts']`
  - Create `app/test/setup.ts` importing `@testing-library/jest-dom`
  - Create root `vitest.workspace.ts` referencing BOTH projects (`'./vitest.config.ts'` and `'./app'`)
  - Add one trivial app test `app/src/smoke.test.ts` asserting `true` to prove the app jsdom project runs
  - Acceptance: a single root `npm install` installs root + app deps; `npm test` runs BOTH the existing 129 data tests (node project, unchanged) AND the trivial app test (jsdom project), all passing; the node project does NOT collect app tests and the app project does NOT collect data tests
  - _Requirements: 8.1, 8.3, 8.6, 8.9_

- [ ] 2. Engine config module
  - [ ] 2.1 Implement `app/src/engine/config.ts`
    - Define `DAY_MS`, the `EngineConfig` interface (`cleanMistakeThreshold`, `strokeHintAfterConsecutiveMisses`, `intervalLadderMs`, `relearnDelayMs`, `newPerSessionCap`, `sessionSize`), and `DEFAULT_CONFIG` exactly as in the design
    - All constants live here; no `any`; readonly fields
    - _Requirements: 5.8, 6.2, 6.3, 6.5, 8.1, 8.2_

- [ ] 3. Prompt display cleanup
  - [ ] 3.1 Implement `app/src/engine/promptCleanup.ts`
    - `cleanupMeaning(raw: string): string` — pure, display-only; removes `(CL:...)`, `CL:...`, `[pin1 yin1]`, `(e.g. ...)`, `Taiwan pr. [...]`, `(Taiwan pr. ...)`, `also pr. [...]`; trims and collapses whitespace left by removals; falls back to the original string when cleanup would yield empty/whitespace-only output
    - Never mutates any input or persisted data; `prompt.pinyin` is never passed through cleanup
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_

  - [ ] 3.2 Write unit tests `app/src/engine/promptCleanup.test.ts`
    - One representative case per note pattern removed; whitespace collapse; empty-result fallback to original
    - _Requirements: 4.2, 4.4_

  - [ ] 3.3 Write property test for cleanup non-emptiness `app/src/engine/promptCleanup.nonempty.property.test.ts`
    - `// Feature: ghost-game-core, Property 1: Cleanup never returns an empty string`
    - fast-check, ≥100 runs; assert output is always non-empty
    - **Validates: Requirements 4.4, 8.7**
    - _Requirements: 4.4, 8.6, 8.7_

  - [ ] 3.4 Write property test for cleanup additive-freeness `app/src/engine/promptCleanup.additive.property.test.ts`
    - `// Feature: ghost-game-core, Property 2: Cleanup never adds text`
    - fast-check, ≥100 runs; assert every character in the output was present in the input (aside from note removal / whitespace trimming)
    - **Validates: Requirements 4.5, 8.7**
    - _Requirements: 4.5, 8.6, 8.7_

  - [ ] 3.5 Write property test for cleanup idempotence `app/src/engine/promptCleanup.idempotent.property.test.ts`
    - `// Feature: ghost-game-core, Property 3: Cleanup is idempotent`
    - fast-check, ≥100 runs; assert `cleanupMeaning(cleanupMeaning(x)) === cleanupMeaning(x)`
    - **Validates: Requirements 4.6, 8.7**
    - _Requirements: 4.6, 8.6, 8.7_

- [ ] 4. Haunting scheduler — review application and next-due
  - [ ] 4.1 Implement review types and `applyReview` / `nextDue` in `app/src/engine/scheduler.ts`
    - Define `Outcome`, `AttemptRecord`, `ReviewEntry`, `ReviewHistory`
    - `applyReview(prior, outcome, now, config)` — clean advances step by 1 capped at ladder top, `nextDue = now + ladder[newStep]`; missed resets step to 0, `nextDue = now + relearnDelayMs`; pure, no `Date.now()`
    - `nextDue(entry)` returns the entry's next-due timestamp
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.11_

  - [ ] 4.2 Write unit tests for `applyReview` / `nextDue` `app/src/engine/scheduler.applyReview.test.ts`
    - Clean step-up and cap at step 5; missed reset to step 0 + 10-minute delay; first-ever review (prior undefined)
    - _Requirements: 6.2, 6.3_

  - [ ] 4.3 Write property test for non-negative intervals `app/src/engine/scheduler.nonneg.property.test.ts`
    - `// Feature: ghost-game-core, Property 5: Intervals and next-due offsets are never negative`
    - fast-check, ≥100 runs; assert `nextDue - now >= 0` and the chosen ladder interval is non-negative
    - **Validates: Requirements 6.4, 8.7**
    - _Requirements: 6.4, 8.6, 8.7_

  - [ ] 4.4 Write property test for the clean-review ladder step `app/src/engine/scheduler.ladder.property.test.ts`
    - `// Feature: ghost-game-core, Property 7: The interval ladder never skips a step on a clean review`
    - fast-check, ≥100 runs; assert a clean review sets new step to `min(s+1, topStep)` and that the ladder-interval sequence over consecutive clean reviews is non-decreasing
    - **Validates: Requirements 6.2, 6.8, 8.7**
    - _Requirements: 6.2, 6.8, 8.6, 8.7_

  - [ ] 4.5 Write property test for the missed-review reset `app/src/engine/scheduler.reset.property.test.ts`
    - `// Feature: ghost-game-core, Property 8: A missed review resets to step 0 with a 10-minute delay`
    - fast-check, ≥100 runs; assert a `struggled`/`gave-up` review sets step 0 and `nextDue = now + relearnDelayMs`
    - **Validates: Requirements 6.3, 8.7**
    - _Requirements: 6.3, 8.6, 8.7_

- [ ] 5. Haunting scheduler — session selection
  - [ ] 5.1 Implement `selectSession` in `app/src/engine/scheduler.ts`
    - `selectSession(history, characterList, now, config)` — assembles up to `config.sessionSize` distinct characters in the Req 6.5 order: (a) due, most-overdue first; (b) new in list order capped at `newPerSessionCap` unless nothing is due; (c) soonest not-yet-due; (d) extra new in list order, cap ignored; all ties broken by character-list order; deterministic; pure, clock injected
    - _Requirements: 6.5, 6.6, 6.7, 6.10, 6.11_

  - [ ] 5.2 Write unit tests for `selectSession` `app/src/engine/scheduler.selectSession.test.ts`
    - Concrete fixtures exercising each of the four bands and tie-breaking by list order
    - _Requirements: 6.5, 6.7_

  - [ ] 5.3 Write property test for missed-vs-clean ordering `app/src/engine/scheduler.missedVsClean.property.test.ts`
    - `// Feature: ghost-game-core, Property 4: A missed character is never scheduled later than a clean one with the same history`
    - fast-check, ≥100 runs; two characters, identical prior history, same `now`: missed `nextDue` ≤ clean `nextDue`
    - **Validates: Requirements 6.9, 8.7**
    - _Requirements: 6.9, 8.6, 8.7_

  - [ ] 5.4 Write property test for deterministic selection `app/src/engine/scheduler.deterministic.property.test.ts`
    - `// Feature: ghost-game-core, Property 6: Session selection is deterministic`
    - fast-check, ≥100 runs; two calls with identical inputs produce identical selection and order
    - **Validates: Requirements 6.6, 8.7**
    - _Requirements: 6.6, 8.6, 8.7_

  - [ ] 5.5 Write property test for the new-per-session cap `app/src/engine/scheduler.newcap.property.test.ts`
    - `// Feature: ghost-game-core, Property 9: The new-per-session cap holds whenever something is due`
    - fast-check, ≥100 runs; when at least one character is due, new (no-history) characters in the session ≤ `newPerSessionCap`
    - **Validates: Requirements 6.5, 8.7**
    - _Requirements: 6.5, 8.6, 8.7_

  - [ ] 5.6 Write property test for tie-breaking by list order `app/src/engine/scheduler.ties.property.test.ts`
    - `// Feature: ghost-game-core, Property 10: Ties are broken by character-list order`
    - fast-check, ≥100 runs; tied candidates are ordered by their position in the character list
    - **Validates: Requirements 6.5, 6.6, 8.7**
    - _Requirements: 6.5, 6.6, 8.6, 8.7_

  - [ ] 5.7 Write property test for exactly-10 distinct ghosts `app/src/engine/scheduler.tenDistinct.property.test.ts`
    - `// Feature: ghost-game-core, Property 11: A full dataset always yields exactly 10 distinct ghosts`
    - fast-check, ≥100 runs; ≥10 characters → exactly 10 distinct; <10 → all of them, no duplicates
    - **Validates: Requirements 3.1, 6.7, 8.7**
    - _Requirements: 3.1, 6.7, 8.6, 8.7_

- [ ] 6. Storage module
  - [ ] 6.1 Implement `app/src/storage/storage.ts`
    - `CURRENT_SCHEMA_VERSION`, `PersistedState`, `DEFAULT_STATE`; `loadState` (migrate on known older version, reset on unknown/newer/corrupt/shape-mismatch, never throw), `saveState` (no-op on write failure, never throw), `recordOutcome` (persist one outcome immediately), `getIntroSeen`/`setIntroSeen`, `resetToDefaults`
    - All reads/writes wrapped in `try/catch`; the rest of the app never touches `localStorage` keys directly
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 6.2 Write unit tests `app/src/storage/storage.test.ts`
    - Migration from a known older `schemaVersion`; reset on unknown/newer/corrupt blob; no-op on simulated write failure (storage throws); `recordOutcome` persists immediately; intro-seen get/set round-trip
    - _Requirements: 7.4, 7.5, 7.6_

- [ ] 7. Character data loader (offline hanzi-writer wiring)
  - [ ] 7.1 Implement `app/src/data/charDataLoader.ts`
    - `CharacterDataset`, `HanziWriterCharData`, `LoadResult`; `loadDataset(url?)` (fetch + validate each record against `CharacterRecord`; return `{ok:false, reason}` for fetch/parse/shape failures, never throw); `getRecord`; `toHanziWriterData` (pure projection of `StrokeData`); `makeCharDataLoader(dataset)` (synchronous loader resolving from our dataset, undefined for unknown chars — never the CDN)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 8.3_

  - [ ] 7.2 Write unit tests `app/src/data/charDataLoader.test.ts`
    - `loadDataset` fetch-failed / parse-failed / invalid-shape results; `toHanziWriterData` projection correctness; `makeCharDataLoader` resolves known chars and returns undefined for unknown
    - _Requirements: 2.4, 2.5, 5.1_

- [ ] 8. Real-hanzi-writer offline integration test
  - [ ] 8.1 Write `app/src/data/charDataLoader.hanziwriter.integration.test.ts` (real library — NOT mocked)
    - hanzi-writer MUST NOT be mocked in this test; the whole point is to exercise the real library against our data. Load the real `characters.json`, build `makeCharDataLoader(dataset)`, and call the real `HanziWriter.create` for 我, 口, 爱 in jsdom
    - jsdom does not implement some SVG/DOM APIs hanzi-writer may touch. IF (and only if) the real library needs browser APIs jsdom lacks, add MINIMAL polyfills for ONLY those specific APIs (e.g. `SVGElement.prototype.getBBox`, `getScreenCTM`/`getCTM`, `requestAnimationFrame` if missing) in the test's setup, and DOCUMENT in the test file exactly which APIs were polyfilled and why. Do not mock hanzi-writer itself; polyfill only the missing host APIs
    - Success criterion: using `makeCharDataLoader(dataset)` built from the real `characters.json`, hanzi-writer reports the character data LOADED for 我, 口, and 爱 (e.g. via its char-data-loaded signal / the loader resolving each to a non-empty `strokes` array and the writer reaching a ready state). Do NOT assert pixel/SVG paint
    - _Requirements: 2.1, 2.5, 5.1, 8.3_

- [ ] 9. Theme tokens
  - [ ] 9.1 Implement `app/src/styles/theme.ts` and dark-theme Tailwind tokens
    - A small, contrast-checked token set (background, surface, text, accent, success/accepted, error/rejected) wired into `app/tailwind.config.ts`; colour is never the only signal (tokens pair with text/icon cues used by components)
    - _Requirements: 8.5_

- [ ] 10. GhostPrompt component
  - [ ] 10.1 Implement `app/src/components/GhostPrompt.tsx`
    - Props `{ record: CharacterRecord }`; renders `cleanupMeaning(record.prompt.meaning)` and `record.prompt.pinyin` (as stored); hides the glyph
    - _Requirements: 4.1, 5.1_

  - [ ] 10.2 Write component test `app/src/components/GhostPrompt.test.tsx`
    - Asserts the cleaned meaning and stored pinyin render and the target glyph is not shown
    - _Requirements: 4.1, 4.7, 5.1_

- [ ] 11. WriteMode
  - [ ] 11.1 Implement `app/src/modes/WriteMode.tsx`
    - Props `{ record; dataset; config; onOutcome }`; hosts hanzi-writer quiz on a `touch-action: none` Pointer-Event surface sized `min(80vw, 420px)` (375px→1440px+); state `mistakeCount`, `consecutiveMissesByStroke`, `hintShown`, `status`
    - `onMistake` increments total mistakes per rejected stroke and derives `hintShown = true` when `mistakesOnStroke >= config.strokeHintAfterConsecutiveMisses`; `showHintAfterMisses` set to the same threshold; `onComplete` resolves `clean` (no hint AND mistakes ≤ `cleanMistakeThreshold`) else `struggled`
    - Labelled "Give up" control resolves `gave-up` in strict order: `cancelQuiz()` → `animateCharacter()` → resolve `'gave-up'`; non-colour accept/reject cues; accessible labels
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ] 11.2 Write component tests `app/src/modes/WriteMode.test.tsx` (hanzi-writer MOCKED)
    - Mock hanzi-writer so `onMistake`/`showHintAfterMisses`/`onComplete` callbacks can be simulated: verify mistake counting, the stroke-hint threshold sets `hintShown`, `clean` vs `struggled` resolution, and "Give up" yields `gave-up` with cancelQuiz→animateCharacter→resolve ordering; assert accessible labels and a non-colour cue
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.9, 5.10_

- [ ] 12. IntroScreen
  - [ ] 12.1 Implement `app/src/components/IntroScreen.tsx`
    - Props `{ onBegin }`; renders the legend copy (Cangjie invented writing; legend of wailing ghosts; forgotten characters are ghosts laid to rest by writing), attributes the wailing-ghosts line to the Huainanzi (天雨粟，鬼夜哭) and makes no other historical claim; labelled "Begin the Séance" control operable by touch and mouse/keyboard
    - _Requirements: 1.2, 1.3, 1.6, 1.7, 1.8_

  - [ ] 12.2 Write component test `app/src/components/IntroScreen.test.tsx`
    - Asserts the legend copy and Huainanzi attribution render, the begin control is labelled and keyboard-operable, and `onBegin` fires on activation
    - _Requirements: 1.2, 1.6, 1.8_

- [ ] 13. StartMenu
  - [ ] 13.1 Implement `app/src/components/StartMenu.tsx`
    - Props `{ onStartSeance; onReviewLegend }`; offers starting a Séance and a re-view-legend entry point that exists only outside an active session
    - _Requirements: 1.5, 3.6_

  - [ ] 13.2 Write component test `app/src/components/StartMenu.test.tsx`
    - Asserts start and re-view-legend controls render with accessible labels and fire their callbacks
    - _Requirements: 1.5, 3.6_

- [ ] 14. SeanceSession
  - [ ] 14.1 Implement `app/src/components/SeanceSession.tsx`
    - Props `{ ghosts; onOutcome; onComplete }`; presents ghosts one at a time (GhostPrompt + WriteMode), advances only on a terminal Outcome, never repeats a character within the session, reports each Outcome immediately, and calls `onComplete` with `SessionResults` when all ghosts are resolved
    - _Requirements: 3.2, 3.4, 3.5_

  - [ ] 14.2 Write component test `app/src/components/SeanceSession.test.tsx`
    - Asserts advance only on terminal Outcome, no character repeats, and each Outcome reported immediately (WriteMode mocked/stubbed to emit outcomes)
    - _Requirements: 3.2, 3.4, 3.5_

- [ ] 15. SessionSummary
  - [ ] 15.1 Implement `app/src/components/SessionSummary.tsx`
    - Props `{ results; onPlayAgain }`; shows how many ghosts were laid to rest and offers another Séance
    - _Requirements: 3.3, 3.6_

  - [ ] 15.2 Write component test `app/src/components/SessionSummary.test.tsx`
    - Asserts the laid-to-rest count renders and the play-again control fires `onPlayAgain`
    - _Requirements: 3.3, 3.6_

- [ ] 16. App wiring and integration
  - [ ] 16.1 Implement `app/src/App.tsx` router/state and data load
    - On mount, `loadDataset()`; on failure render a clear, non-technical error screen (no blank page, no crash); on success route Intro (first visit only, via `getIntroSeen`) → StartMenu → SeanceSession → SessionSummary; build the session with `selectSession` passing `now = Date.now()`; persist intro-seen on dismiss and `recordOutcome` immediately per ghost; pass `DEFAULT_CONFIG` to engine/UI; legend re-view only outside a session
    - _Requirements: 1.1, 1.4, 1.5, 2.4, 3.1, 3.4, 6.1, 7.6, 8.7_

  - [ ] 16.2 Write integration test `app/src/App.test.tsx`
    - Covers the main flow (intro on first visit → session → summary) with the dataset loaded and the error screen rendered when `loadDataset` fails; asserts outcomes persist via the storage API
    - _Requirements: 1.1, 2.4, 3.3, 7.6_

- [ ] 17. Checkpoint — full suite passes
  - Run `npm test` from the repo root: the 129 data tests plus all app unit, property, component, and integration tests pass; `tsc` is clean across root and app; no `any` in app source. Ask the user if any questions arise.

- [ ] 18. Manual verification — one full Nightly Séance with a mouse (NON-CODING, performed by a human)
  - This is the single manual, non-coding task. This manual play-through is performed by a human, not by Kiro. Kiro/the agent SHALL run nothing for this task and SHALL NOT append the `kiro-log.md` entry
  - The human tester runs the Vite dev server (`npm run dev` in `app/` or via the workspace) and plays ONE full Nightly Séance with a MOUSE (laptop Write mode), verifying: the legend intro appears on first visit, the session has 10 ghosts, live per-stroke checking works, at least one `clean`, one `struggled`, and one `gave-up` outcome occur, each ghost is laid to rest, the session summary shows the laid-to-rest count, and progress persists across a page reload
  - The human tester records the result (date, what worked, any issues) in `kiro-log.md` at the repo root themselves, without deleting existing entries (keep `kiro-log.md` updated per the structure steering doc)
  - _Requirements: 1.1, 3.1, 3.3, 5.1, 7.6_

## Notes

- The existing 129 character-dataset tests under `tests/` are never moved or modified; task 1 only adds the workspace and the app jsdom project around them, and the node project's `tests/**/*.test.ts` glob and the app project's `app/**/*.test.{ts,tsx}` glob never overlap.
- The engine (`config`, `promptCleanup`, `scheduler`) is pure and clock-injected: engine functions take `now: number` and never call `Date.now()`; only the UI (App) reads the real clock and performs I/O.
- All tests are required — there are no optional tests and nothing is marked with `*`. Tests live next to the code they cover and are written in the same task group as that code.
- Property tests use fast-check at ≥100 runs each and are tagged `// Feature: ghost-game-core, Property N: <title>`, one test per design Property (1–11).
- `hanzi-writer` is pinned EXACT `3.7.3` in `app/package.json` and always loaded via our `makeCharDataLoader` from `characters.json` — never the CDN. Task 8 proves this against the real library offline.
- The writing surface uses `touch-action: none` with Pointer Events; Give-up ordering is strictly `cancelQuiz` → `animateCharacter` → resolve `'gave-up'`; `hintShown` is derived inside `onMistake` at the stroke-hint threshold.
- Task 18 is the ONLY manual, non-coding task; every other task is a coding task. Task 18 is performed by a human — Kiro does not run it and does not write that `kiro-log.md` entry; the human tester records it.
- Do not add `.kiro/` to `.gitignore`; it must stay in the repo for judging.
- Run tasks one at a time and review each result. Do not use "Run All Tasks".

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "9.1"] },
    { "id": 2, "tasks": ["3.1", "4.1", "6.1", "7.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "3.5", "4.2", "4.3", "4.4", "4.5", "5.1", "6.2", "7.2"] },
    { "id": 4, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "8.1", "10.1", "12.1", "13.1", "15.1"] },
    { "id": 5, "tasks": ["10.2", "11.1", "12.2", "13.2", "15.2"] },
    { "id": 6, "tasks": ["11.2", "14.1"] },
    { "id": 7, "tasks": ["14.2", "16.1"] },
    { "id": 8, "tasks": ["16.2"] },
    { "id": 9, "tasks": ["18"] }
  ]
}
```
