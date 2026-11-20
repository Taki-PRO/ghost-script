# Implementation Plan: night-sounds

## Overview

Add seven quiet effect sounds and one optional night wind to Ghost Script, all synthesised with the Web Audio API (no audio file, sample or library), with a speaker toggle on every screen and two saved settings in storage schema 4. The plan runs in this order: the human's answers to the open questions, the steering amendments and the design departures (task 1, done); the spec is amended to those answers (task 2); the approved steering edits (task 3); a baseline of the bundle figures (task 4); then implementation in dependency order: storage schema 4 (task 5), the pure voice limiter (task 6), the recipes and the audio mock (task 7), the engine (task 8), the provider and the toggles (task 9), toggle placement on every screen with the séance header re-layout (task 10), the sound call sites (task 11), the ambience (task 12), the audio-file scan and the sound end-to-end tests (task 13), the README and the bundle figures (task 14); the final checkpoint (task 15); and a human-only listening and screenshot review (task 16), last, so that no Kiro task waits on it.

The module path is `app/src/audio/`, as approved by the human (Requirement 1.6).

Rules for every task:

- Task 1 was the gate for the human and is done. The human's answers are recorded in the "Decisions approved by the human" sections of the requirements and the design. Kiro changes none of them. Task 2 amends the spec to them before any steering or code task runs.
- Edit a steering file only in tasks 3.1 to 3.6, and only for the amendments A1 to A6 the human approved. No task edits `kiro-log.md`; the human writes it.
- Never write a personal name in a repository file. Approvals read "approved by the human".
- Add no property-based test, no mutation test and no optional task (decision of Nov 15, `tech.md`). The existing property tests stay unchanged and must pass. Every new test is a unit, component or end-to-end test, with fixed examples.
- Never weaken, skip, delete or loosen an existing test, except the assertions the design lists under "Existing assertions that change". The human approved those changes on condition that no rewrite loosens a test. Every task that changes one of them names it, and its report states the old assertion and the new assertion side by side and why the new one is at least as strict. If a rewrite cannot be made at least as strict, the task stops and reports. A test that fails and is not in that list is fixed by changing its inputs, never its expectation, and is added to the report with the reason.
- Add no `any`. Keep logic in `app/src/audio/` and UI in `app/src/components/`. No file under `app/src/audio/` except `SoundProvider.tsx` imports React. Add no entry to `dependencies` in `app/package.json` and no file to `app/public`.
- Every animation and transition stays inside the one `prefers-reduced-motion: no-preference` block of `app/src/styles/index.css`; this feature adds none and no `@media` block.
- Sound call sites call `play` without `await`, after the state update they belong to, and never add a timer or a delay. No sound may depend on the character, the code, a key name or a stroke index.
- Before every end-to-end run, wait until nothing listens on port 4173 (for example `lsof -i :4173` prints nothing), because the Playwright config starts its own server. Run only one end-to-end run at a time.
- No commits.

### Kiro features used

- **Specs**: this requirements-first spec (`.kiro/specs/night-sounds/`).
- **Steering**: `art-direction.md`, `tech.md` and `structure.md` are amended only for the amendments approved by the human (tasks 3.1 to 3.6).
- **Playwright e2e**: new `e2e/sound.spec.ts` and `e2e/sound-toggle-fit.spec.ts`, helpers `installAudioRecorder` and `recordMedia`, and additions to the existing fit, slips, cursors and sky-cap specs.

## Tasks

- [x] 1. Gate: the human answers the open questions and decides the amendments and departures
  - [x] 1.1 HUMAN TASK: Human answers the open questions and decides each amendment and departure
    - Human-only, done. The human approved the answer given with every open question, approved steering amendments A1 to A6 as worded in the design, and approved the design departures: the toggle position (16 px left of the Moon below 992 px, 16 px below it from 992 px), the séance heading moving into the step-label column at every width, the 16 px gap, the module path `app/src/audio/`, the 300 ms resume window and the sweep only for key-driven strokes
    - The human accepted the requirement corrections (Requirements 1.6, 2.2, 5.1, 14.3), the omission of the README silent-switch sentence, and the design's list "Existing assertions that change" on the condition that no rewrite loosens a test
    - Task 2 amends the spec to these answers before any steering or code task runs
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.7_

- [x] 2. Amend the spec to the human's answers
  - [x] 2.1 Update `requirements.md`, `design.md` and this `tasks.md` to the recorded answers
    - Update the requirements, the design and this file to the human's answers: the open questions are replaced by a short "Decisions approved by the human" list, the requirement corrections (Requirements 1.6, 2.2 and 2.10, 5.1, 14.3, 14.7 and 14.11) are applied, each steering amendment A1 to A6 reads "approved by the human", and no unresolved-answer marker and no unchosen alternative remains in the three documents
    - Tasks 3.1 to 3.6 and the night wind tasks stay, because the human approved every amendment and built the wind; `kiro-log.md` stays out of every task
    - Run `validate_spec_format` on each edited document until it reports no errors
    - Edit no code, no steering file, no data file and not `kiro-log.md`
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.7_

- [x] 3. Steering edits for approved amendments only
  - Rules for this group: the human approved all six amendments, and the design records "approved by the human" next to each. Each sub-task edits one steering file, matches the target text by content and not by line number (the working tree may hold other uncommitted changes to the same file, which stay untouched), uses the exact wording recorded in the design, and adds an assertion for the new text to its steering test (`tests/unit/steering-art-direction.test.ts` for `art-direction.md`; `tests/unit/steering-tech.test.ts` and `tests/unit/steering-structure.test.ts` are created if they do not exist, in the style of `steering-art-direction.test.ts`). Remove no existing assertion. `steering-art-direction.test.ts` must keep passing, including the `## Sound` heading check and the single "Ambient exemption" count, and so must `tests/unit/no-personal-names.test.ts`
  - [x] 3.1 Amendment A1: `art-direction.md`, "## Sound"
    - Replace the body "None." with the approved rules, keep the heading `## Sound`; add the assertions: the new lines are present, and `## Sound\nNone.` is absent
    - _Requirements: 20.1, 20.6_
  - [x] 3.2 Amendment A2: `art-direction.md`, "Primary action per screen"
    - Add the approved line that the Sound_Toggle and the Ambience_Toggle are paper slips and never a Primary_Action; test it
    - _Requirements: 20.2, 20.6_
  - [x] 3.3 Amendment A3: `art-direction.md`, "Motion"
    - Add the approved bullet that sound is not motion and that the night wind is not an ambient exemption, without adding the capitalised phrase "Ambient exemption"; test it, and keep the existing single-count assertion
    - _Requirements: 20.3, 20.6_
  - [x] 3.4 Amendment A4: `art-direction.md`, "Moon, mist and seal placement"
    - Add the approved bullet about the Sound_Toggle position (16 px left of the disc inside the Top_Room below 992 px, 16 px below it from 992 px, never meeting the disc, above the Sky_Cap and the sticky headers), as worded in the design's A4; test it
    - _Requirements: 14.3, 14.4, 14.11, 20.6, 20.8_
  - [x] 3.5 Amendment A5: `tech.md`, "Things to avoid"
    - Add the approved bullet that audio files, samples, `Audio` elements and audio libraries are not allowed and that all sound comes from the Web Audio API in code; add `tests/unit/steering-tech.test.ts` with an assertion for it
    - _Requirements: 20.4, 20.6_
  - [x] 3.6 Amendment A6: `structure.md`, the project tree
    - Add the approved `audio/` line after the `storage/` line of the tree; add `tests/unit/steering-structure.test.ts` with an assertion for it
    - _Requirements: 1.6, 20.6, 20.8_

- [x] 4. Baseline of the bundle figures, before any code changes
  - [x] 4.1 Record the bundle figures of the current build
    - Run `npm run build -w app` and `npm run check:bundle` before any implementation task has changed `app/src`, and record the printed counted total, the level 1 dataset size, the first-load sum and the README check result in `.kiro/specs/night-sounds/bundle-baseline.txt` (a new plain-text file, the only file this task writes); task 14.2 reads it
    - Run `git status --short app/src app/public` and record its output in the same file, so the later `git diff --stat` can tell this feature's changes from earlier uncommitted work
    - Edit no other file
    - _Requirements: 19.1, 19.2_

- [x] 5. Storage schema 4: `soundOn` and `ambienceOn`
  - [x] 5.1 Implement schema 4 in `app/src/storage/storage.ts`
    - `CURRENT_SCHEMA_VERSION` becomes 4; `PersistedState` gains `soundOn` and `ambienceOn` before `history`; `SHIPPED_MIGRATIONS` gains key `3` that keeps every field and sets `soundOn: true`, `ambienceOn: false` (overwriting any value in the old blob); the comment above it is updated
    - `validateState` keeps its `return undefined` lines for `introSeen`, `cangjieIntroSeen`, `level`, `levelChosen` and `history`, and repairs each sound field on its own (`typeof ... === 'boolean'`, else its default), so a bad sound field never drops the history; `defaultState` gains the two defaults
    - `saveState` and `recordOutcome` copy both fields by name (`state.soundOn`, `state.ambienceOn`; `prior.soundOn`, `prior.ambienceOn`); add `getSoundOn`, `setSoundOn`, `getAmbienceOn`, `setAmbienceOn` to the `Store` interface, the returned object and the default-store exports; each setter is `saveState({ ...loadState(), <field>: on })`
    - Do not edit any other file in this task; the existing storage tests are updated in task 5.2
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.11, 17.1, 17.2_
  - [x] 5.2 Update and extend `app/src/storage/storage.test.ts`
    - Existing assertions that change, each approved by the human on condition that it is not loosened, with old and new stated side by side in the report: line 99 `expect(CURRENT_SCHEMA_VERSION).toBe(3)` becomes `toBe(4)`; lines 100 to 107 `DEFAULT_STATE` becomes a schema 4 object with `soundOn: true` and `ambienceOn: false` (still `toEqual`); lines 150, 220 to 227, 675 to 682, 715 to 724 and 817 take `schemaVersion: 4` plus the two fields (`toEqual` stays `toEqual`, `toMatchObject` stays `toMatchObject`); lines 160 to 300 (the custom `currentVersion` and `migrations` tests) gain the two default fields in every expected state, because `validateState` now repairs missing sound fields for every version; lines 787 to 791 "resets a save newer than version 3" uses a `schemaVersion: 5` blob and is renamed "newer than version 4", keeping the rule that a newer save is never migrated; `validBlob` (lines 54 to 64) stays at schema 3 for the migration tests and a new `validBlobV4` helper serves the schema 4 tests
    - Add tests: schema 4 defaults; migration `3` from a schema 3 blob keeps every field; the chain 2 to 4 equals migrating 2 to 3 and then 3 to 4; a schema 4 blob with `soundOn: 'yes'`, a missing `soundOn`, a numeric `ambienceOn` is repaired field by field with the history kept; an invalid history, `level`, `levelChosen`, `introSeen` and `cangjieIntroSeen` still reset to the default state; each setter changes only its own field; `saveState` and `recordOutcome` keep `soundOn: false` and `ambienceOn: true` (the copy-by-name pitfall); a schema 5 blob resets; a missing backend or a failing write keeps the getters returning the defaults and `isSavingWorking()` false; `resetToDefaults` gives `true` and `false`
    - Run `npm test`; storage and every test that reads the saved state pass
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 21.7_

- [x] 6. The pure voice limiter
  - [x] 6.1 Write `app/src/audio/voices.ts`
    - Export `SoundId`, `MAX_VOICES` (4), `MAX_KEY_INK_VOICES` (3), `MAX_PER_ID` (2), `SPACING_MS` (40, 40, 80), `PlannerState`, `Decision`, `DropReason`, `EMPTY_PLANNER`, the pure `plan(state, id, now, durationMs)` and `createLimiter(clock, durations)`; decision order: spacing, then per-id and group for `key-tap`, `key-wrong` and `ink-sweep` only, then total; a dropped request is never queued; no React import, no clock or global read inside `plan`
    - _Requirements: 1.2, 1.3, 1.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - [x] 6.2 Write `app/src/audio/voices.test.ts`
    - Fixed examples with a fake clock (`let t = 0; const clock = () => t`): fifth voice dropped (`total`); a fourth key or ink voice dropped (`group`) while an outcome is accepted; a third voice of one id dropped (`per-id`); `key-tap` at 39 ms dropped and at 40 ms accepted; `ink-sweep` at 79 ms dropped and at 80 ms accepted; a drop changes nothing but the pruned state and is not accepted later; a voice frees its place exactly at its end time; `plan` returns equal results for equal inputs; an outcome is accepted whenever fewer than 4 voices are active
    - _Requirements: 21.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 7. Recipes, noise and the audio mock
  - [x] 7.1 Write `app/src/audio/recipes.ts`
    - Export `MASTER_GAIN` (0.5), `LIMITER` (threshold −18, knee 6, ratio 12, attack 0.003, release 0.25), `FLOOR` (0.0001), the `RECIPES` table with the values of the design's recipe table, `AMBIENCE`, `DURATION_MS` (delay plus envelope end; `rest-clean` is 1,080), `outcomeSounds(outcome)` (the only mapping from a game result to sounds: `clean` gives `seal-thud` then `rest-clean`, `struggled` gives `rest-struggled`, `gave-up` gives `rest-gave-up`), `fillNoise` (fixed-seed generator, optional smoothing for the wind) and `buildVoice(ctx, dest, recipe, noise, t0, sources)`; no function takes a character, a code, a key name or a stroke; no React import
    - _Requirements: 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 6.1, 6.2, 6.3, 12.4_
  - [x] 7.2 Write the test double `app/src/audio/audioMock.ts`
    - A fake `AudioContext` and nodes that record constructions, `resume` and `suspend` calls, node creation, parameter automation (`setValueAtTime`, ramps, `setTargetAtTime`), connections, and `start` and `stop` times; options to make the constructor throw, `resume()` reject or hang, a node method throw, and the state be `suspended`, `interrupted`, `running` or `closed`; imported by tests only, never by app code (task 13.1 checks that no non-test file imports it)
    - _Requirements: 21.2, 21.3_
  - [x] 7.3 Write `app/src/audio/recipes.test.ts`
    - Table-driven over `RECIPES` against the bounds of Requirement 3 (peak sum, frequency, duration, filter limits, partial ratio, `key-wrong` body at least 30% below `key-tap`, `rest-struggled` fundamental equal to `rest-clean`); every attack at least 2 ms; every envelope ends at 0.0001; no component peak above 0.2; every noise centre or cut-off at most 6,000 Hz; every voice ends at most 1,200 ms after its request including the delay; `outcomeSounds` for each outcome; `fillNoise` twice gives equal arrays and a fixed first-four-sample check; the `AMBIENCE` bounds; `buildVoice` on the mock: first gain event 0, rise no sooner than 2 ms, every source reaches the master chain, no gain above 0.2, each noise source has a filter, the noise buffer is created once for many voices, a throwing node method drops the voice and releases its nodes
    - _Requirements: 21.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 11.4, 19.4_

- [x] 8. The sound engine
  - [x] 8.1 Write `app/src/audio/engine.ts`
    - `createSoundEngine(deps)` with exactly `play`, `setEnabled`, `setAmbience`, `unlock`, `suspend`, `dispose`, and `isWebAudioAvailable()`; injectable `createContext`, `now`, `doc`, `matchMedia`; no context at construction; capture and passive listeners for `pointerdown`, `touchend`, `click` and `keydown`, a `visibilitychange` listener and a reduced-motion `change` listener (with the `addListener` fallback), all removed on `dispose()`; at most one context, built only in a gesture handler or in `unlock()` with sound on; `webkitAudioContext` fallback; `resume()` once per gesture while `suspended` or `interrupted`; the 300 ms resume window; lazy effect noise buffer (1 s) and wind buffer (3 s, built at first wind start); master chain (gain 0.5, then compressor, then destination); failure latching (constructor throw is permanent, `resume()` rejection retried at the next gesture, voice build errors caught, `closed` drops, no console output, no unhandled rejection, settings never touched); the wind (`setAmbience(wanted)` plus the engine's own conditions: enabled, gesture, running, visible, not reduced; fade in 1.5 s, fade out 0.45 s, continues across menu and Graveyard, stops and releases nodes when a condition fails)
    - _Requirements: 1.1, 1.4, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.2, 3.9, 7.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.3_
  - [x] 8.2 Write `app/src/audio/engine.test.ts`
    - With the audio mock and injected `createContext`, `now`, `doc`, `matchMedia`: no construction at creation, before a gesture or while disabled; the first gesture builds exactly one context and calls `resume()` once; a gesture while `running` does not call `resume()`; one `resume()` per gesture while `suspended` or `interrupted`; `setEnabled(true)` then `unlock()` builds the context in the same call; `webkitAudioContext` only; hidden document suspends and drops `play`, visible resumes; constructor throws: broken, not retried, no throw, no console call; `resume()` rejects: no unhandled rejection, `play` dropped, next gesture retries; a throwing node drops that voice; `closed` drops; the 300 ms window; `setEnabled(false)` stops sources and suspends; `dispose()` removes the four gesture listeners, the visibility listener and the media listener (counted through `removeEventListener` spies); a dropped request changes no timer; the wind starts only when enabled, wanted, after a gesture, running, visible and not reduced (one test per condition); a second `setAmbience(true)` does not restart it; `setAmbience(false)` fades in 0.45 s and releases the nodes; a reduced-motion change to reduce stops it and back to no-preference starts it; the wind buffer is built once and is 3 s; base gain plus LFO gain at most 0.03; the engine never touches storage
    - _Requirements: 21.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.6, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [x] 9. The provider, the hook and the toggles
  - [x] 9.1 Write `app/src/audio/SoundProvider.tsx`
    - `SoundApi` (`available`, `soundOn`, `ambienceOn`, `reducedMotion`, `play`, `setSoundOn`, `setAmbienceOn`, `setAmbientScreen`), `SoundApiContext` whose default value is a no-op API with `available: false`, `SoundProvider` (optional `createEngine` for tests) and `useSound()`; the engine is created in an effect and disposed in its cleanup (safe under `StrictMode`) and is not created when Web Audio is missing; initial state from `getSoundOn()` and `getAmbienceOn()`, with React state as the source of truth when saving fails; `setSoundOn(true)` saves, calls `setEnabled(true)`, `unlock()` and plays one `key-tap`; `setSoundOn(false)` saves and calls `setEnabled(false)`; an effect calls `engine.setAmbience(ambienceOn && ambientScreen)`; `play` has a stable identity, never throws and never awaits; `reducedMotion` read from `matchMedia` with a `change` listener
    - _Requirements: 11.1, 12.1, 12.2, 13.5, 13.6, 13.7, 16.10, 17.1_
  - [x] 9.2 Write `SoundToggle.tsx` and `AmbienceToggle.tsx` in `app/src/components/`
    - `SoundToggle`: a native `button` with `type="button"`, `data-testid="sound-toggle"`, accessible name "Sound", `aria-pressed`, classes `slip sound-toggle h-11 w-11 p-0` plus the existing focus-ring string, no `slip-primary`, an inline SVG icon (`aria-hidden`, paths only, no text; speaker with two arcs when on, speaker with a diagonal slash when off), `null` when `available` is false; focus stays on the button after activation
    - `AmbienceToggle`: a native `button` with accessible name "Night wind", `aria-pressed`, visible text "Night wind: on" or "Night wind: off", classes `slip min-h-[44px] px-6 py-2 text-base` plus the focus-ring string, no `slip-primary`; `aria-disabled="true"` while sound is off or reduced motion is requested, with a note paragraph linked by `aria-describedby` ("Turn sound on to hear the night wind." or "The night wind is off while reduced motion is requested."); no flip while disabled; `null` when `available` is false
    - Use only existing colour tokens, no Chinese text, no ghost shape and no animation; add no new cursor rule
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.8, 13.9, 9.4, 15.1, 15.2, 15.3, 15.5, 15.6, 15.7_
  - [x] 9.3 Write the provider and toggle tests
    - `app/src/audio/SoundProvider.test.tsx`: no-op API outside a provider; the engine is built once under `StrictMode` and the first one disposed; `setSoundOn` saves, plays one confirming `key-tap` on turning on, and calls `setEnabled(false)` on turning off; the in-memory choice survives a failing save; `setAmbientScreen` and the ambience choice reach `engine.setAmbience`
    - `app/src/components/SoundToggle.test.tsx`: name, `aria-pressed` true then false, classes `slip`, `sound-toggle`, `h-11 w-11` and no `slip-primary`, the SVG is `aria-hidden`, differs between states and has no `<text>`, click, Enter and Space flip it, `document.activeElement` stays on the button, not rendered when `available` is false
    - `app/src/components/AmbienceToggle.test.tsx`: name, `aria-pressed`, the visible text on and off, `aria-disabled` and each note, no flip when disabled, `slip` and not `slip-primary`, 44 px class
    - _Requirements: 21.4, 21.5, 13.1, 13.2, 13.3, 13.5, 13.8, 15.1, 15.2, 15.3, 15.5, 15.6, 11.1_

- [x] 10. Toggle placement on every screen and the séance header
  - [x] 10.1 Place the toggle: CSS and `App.tsx`
    - In `app/src/styles/index.css` add the `.slip.sound-toggle` rule of the design after the `@layer components` block (fixed, z-index 30, 2.75 rem square, two `clamp()` offsets that switch at 992 px, no `@media`, no transition or animation); in `app/src/App.tsx` wrap the app in `<SoundProvider>`, move the screen `switch` into `renderScreen()` and render `<SoundToggle />` as the last child of `#root` for every screen except `loading` and `error`
    - Add to `app/src/styles/index.css.test.ts` (additions only): `.slip.sound-toggle` is `position: fixed` with a z-index above the Sky_Cap (10) and the sticky headers (20) and has no `transition` or `animation`; the set of `@media` conditions is unchanged
    - If anything threatens the one-screen fit or the existing e2e suite, stop and report; never loosen a test.
    - _Requirements: 13.10, 14.1, 14.2, 14.3, 14.4, 14.6, 14.10, 14.11, 9.7_
  - [x] 10.2 Re-lay out the séance header in `SeanceSession.tsx`
    - Move the `h2` "Ghost n of N" out of the header row into one column with the step label beside the ghost prompt (the column placed first in the DOM, the row `flex-row-reverse`), so the header row holds only "Leave séance"; keep the `h2` text and classes, keep `pr-[4.5rem]` on the header row, keep one `h2` element; the prompt row keeps its 72 px height and the paper keeps its minimum sizes
    - No existing test expectation changes: `getByText('Ghost 1 of 10')`, the role query in `e2e/helpers.ts` and the `pr-[4.5rem]` assertion in `App.test.tsx` stay as they are. Run `npm test`; if a test fails, fix its inputs, not its expectation, and report it
    - If anything threatens the one-screen fit or the existing e2e suite, stop and report; never loosen a test.
    - _Requirements: 14.7, 14.8_
  - [x] 10.3 Add the end-to-end helpers
    - In `e2e/helpers.ts` (additions and one type widening): `installAudioRecorder(page)` (the init script of the design that wraps `AudioContext`, `resume`, `suspend` and `AudioScheduledSourceNode.prototype.start` and exposes `window.__audio`), `recordMedia(page)` (collects any `media` request and any `audio/*` response), and widen `SeedState.schemaVersion` from the literal `3` to `3 | 4` with optional `soundOn` and `ambienceOn`; the default seeds stay at version 3. Change no existing helper behaviour
    - Existing assertion that changes: the `SeedState` type at `e2e/helpers.ts` lines 22 to 29 (type only, approved by the human, not loosened; old and new stated in the report)
    - If anything threatens the one-screen fit or the existing e2e suite, stop and report; never loosen a test.
    - _Requirements: 21.9, 18.3_
  - [x] 10.4 Teach the existing end-to-end specs about the toggle
    - `e2e/sky-cap.spec.ts` line 135: add `[data-testid="sound-toggle"]` to the elements excluded from the "beneath the band" check, and add one assertion that the toggle is `position: fixed`, has a z-index above the cap and lies inside the Moon_Room box below 992 px; line 195: the reference and the capped run both hide `.sound-toggle` (`.sky-cap,.sound-toggle{display:none!important}`) so the compared pixels are the sky's. Each is approved by the human on condition that it is not loosened; the report states old and new and why the new one is at least as strict (the check still fails for any other element in the band)
    - Additions only (no existing assertion changes) in `e2e/slips.spec.ts` (the toggle is a slip: lift, glow, press, at least 44 px, no `slip-primary`), `e2e/cursors.spec.ts` (the toggle has the Link_Cursor on a fine pointer, an `aria-disabled` Ambience_Toggle has `not-allowed` where the spec reaches the menu), `e2e/no-horizontal-overflow.spec.ts` and `e2e/fits-one-screen.spec.ts` (the toggle is present and the existing fit assertions still hold at 1024 × 768, 375 × 812 and, for Summon, 320 × 640)
    - After waiting for port 4173 to be free, run `sky-cap`, `slips`, `cursors`, `no-horizontal-overflow` and `fits-one-screen`; they pass, with `moonIntruders` unchanged and empty
    - If anything threatens the one-screen fit or the existing e2e suite, stop and report; never loosen a test.
    - _Requirements: 14.3, 14.4, 14.5, 14.6, 14.8, 14.9, 13.3, 13.9, 21.10_
  - [-] 10.5 Write `e2e/sound-toggle-fit.spec.ts`
    - At 1024 × 768, 375 × 812, 320 × 640, 992 × 768 and 991 × 768, on the intro, Level, menu, Graveyard, Sources & licences, Cangjie guide, séance Summon, séance Write and Summary: the toggle has the same bounding box as on the first screen at that width, is 44 × 44, meets no other control or text box, and `moonIntruders` is empty; the toggle is absent on the loading and error screens; the Graveyard and Sources sticky headers sit at their place at scroll 0 and their Back button is not covered; the séance heading, Leave button and toggle do not overlap; the 16 px gap to the Moon holds below 992 px and the 16 px gap below the Moon holds from 992 px
    - After waiting for port 4173 to be free, run the spec; it passes
    - If anything threatens the one-screen fit or the existing e2e suite, stop and report; never loosen a test.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.9, 14.10, 14.11, 21.10_
  - [x] 10.6 Write `app/src/App.sound.test.tsx`
    - With a provider and a fake engine: the toggle renders on intro, menu, Graveyard, Sources, guide, séance and summary and not on loading or error; it is the last element in `#root`; the first Tab stop on the menu is unchanged; `setAmbientScreen` receives true on the menu and Graveyard and false on every other screen; no provider is created when `AudioContext` is missing; at most one `slip-primary` on each screen
    - If anything threatens the one-screen fit or the existing e2e suite, stop and report; never loosen a test.
    - _Requirements: 13.10, 13.11, 14.1, 14.10, 17.4, 8.7, 11.1_

- [x] 11. Sound call sites
  - [x] 11.1 Summon step key and ink sounds in `app/src/modes/SummonStep.tsx`
    - Read `play` from `useSound()` through a ref (as `onDone` is read); add `soundForKey(prev, next)` (`key-tap` when `filled` rises, else `key-wrong` when `mistakes` rises) after `commit` and `reportMiss` in the physical key handler and after `reportMiss` in `enterKey`; add the `sweep: boolean` parameter to `enqueueInk`, call `play('ink-sweep')` just before `await writer.animateStroke(s)` after the `disposedRef` and `brokenRef` guard, pass `true` from `afterKey` and `false` from the first-meeting forming; no sound for ignored keys, give up, hold, fade or `animateCharacter`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.4, 5.5, 5.6, 12.1, 12.3, 12.4, 12.6_
  - [x] 11.2 Write step stroke sound in `app/src/modes/WriteMode.tsx`
    - Read `play` through a ref (not a dependency of the quiz effect, so the quiz never restarts); call `play('ink-sweep')` in `onCorrectStroke` after the `resolvedRef` guard and the feedback update; no call in `onMistake` or `onComplete`
    - _Requirements: 5.2, 5.3, 5.5, 5.6, 12.1, 12.3_
  - [x] 11.3 Outcome sounds in `app/src/components/SeanceSession.tsx`
    - In `handleOutcome`, after `onOutcomeRef.current(...)` and inside the existing `resolvedRef` and `leftRef` guard, call `outcomeSounds(outcome).forEach(play)` through a ref; no call in advance, finish, leave, stay or on the summary
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 12.1, 12.2_
  - [ ] 11.4 Write the Summon and Write sound tests
    - `app/src/modes/SummonStep.sound.test.tsx` with `SoundApiContext.Provider` and a recording `play`: accepted physical key `['key-tap']`; wrong key `['key-wrong']`; on-screen keys the same; a non-letter key and a key after completion request nothing; the last key requests one `key-tap` and nothing during the 1,500 + 1,500 ms hold and fade; one `ink-sweep` per key-driven `animateStroke`, none for the first-meeting forming, none after the animation failed, still one under reduced motion; two different characters with equally long codes request the same list; a throwing `play` leaves the same state, status text and `onDone` result
    - `app/src/modes/WriteMode.sound.test.tsx`: `onCorrectStroke` plays `ink-sweep`, `onMistake` plays nothing, nothing after resolve or give up, a throwing `play` leaves the outcome unchanged
    - Run the existing `SummonStep.neverReveal.test.tsx`, `SummonStep.test.tsx`, `SummonStep.ink.test.tsx` and `WriteMode.test.tsx` unchanged; they pass (the never-reveal tests stay green)
    - _Requirements: 21.6, 4.1, 4.2, 4.3, 4.4, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 12.2, 12.4_
  - [ ] 11.5 Write the outcome sound tests
    - `app/src/components/SeanceSession.sound.test.tsx`: `clean` requests `seal-thud` then `rest-clean`; `struggled` requests `rest-struggled` only; `gave-up` requests `rest-gave-up`; exactly once per ghost even when the outcome callback fires twice; none after Leave; none on "Next ghost", "Finish the séance", "Leave séance", "Stay" and "Leave" or when the summary opens; the same in the review mode and for the walkthrough ghost; a throwing `play` leaves `onOutcome` calls and the saved history identical to a run where `play` does nothing
    - Run the existing `SeanceSession.test.tsx`, `SeanceSession.resultLine.test.tsx` and `App.test.tsx` unchanged; they pass
    - _Requirements: 21.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 12.2_

- [x] 12. Night wind on the menu and the Graveyard
  - [x] 12.1 Place the Ambience_Toggle and the ambient screen
    - Add `<AmbienceToggle />` to `app/src/components/StartMenu.tsx` after the "Graveyard" button and before the "Sources & licences" block, and to `app/src/components/Graveyard.tsx` after the paragraph "Your séances draw new ghosts from level …" in a `self-start` wrapper; no new props; call `setAmbientScreen(view.screen === 'menu' || view.screen === 'graveyard')` in an effect keyed on the screen name in `App.tsx`; the wind is never started by any other screen and the Primary_Action of the menu stays the one `slip-primary`
    - _Requirements: 8.1, 8.3, 8.4, 8.7, 15.4, 15.7_
  - [x] 12.2 Write the ambience placement tests
    - With a provider and a fake engine in `StartMenu.test.tsx` and `Graveyard.test.tsx` (additions only; the existing tests render without a provider and the toggle renders nothing there, so none changes): the toggle is present on both and absent on the other screens; the menu keeps exactly one `slip-primary`; the toggle is disabled with its note while sound is off and while reduced motion is requested; a click flips and saves `ambienceOn`; the wind wish passed to the engine is true only on the menu and the Graveyard and stays true when moving between them
    - _Requirements: 21.5, 8.3, 8.7, 9.4, 15.1, 15.4, 15.5, 15.6, 15.7_

- [x] 13. Audio-file scan and sound end-to-end tests
  - [x] 13.1 Write `tests/unit/no-audio-files.test.ts`
    - Walk `app/public` and `app/src` (not `app/dist`) and fail on any file ending in `.mp3`, `.wav`, `.ogg`, `.oga`, `.opus`, `.m4a`, `.aac`, `.flac`, `.aif`, `.aiff`, `.weba`, `.mid` or `.midi`; read every non-test source file under `app/src` and fail on `data:audio/`, `new Audio(`, `<audio`, `createMediaElementSource`, `decodeAudioData`, and on `fetch(` or `XMLHttpRequest` calls that name an audio extension; read `app/package.json` and expect the `dependencies` keys to equal `['@fontsource/cormorant-garamond', 'hanzi-writer', 'react', 'react-dom']` (R18.4); list `app/public` and expect only the files known before this feature; fail if a non-test file under `app/src` imports `audioMock`; add one synthetic-fixture test per rule proving the scan detects it
    - _Requirements: 21.8, 18.1, 18.2, 18.4, 19.5_
  - [x] 13.2 Write `e2e/sound.spec.ts`
    - Using `installAudioRecorder` and `recordMedia`: zero `AudioContext` constructions after load; exactly one after the first click or key press with sound on (default and schema 3 seeds); zero after a click with `soundOn: false` seeded; the Sound_Toggle flips, shows the new `aria-pressed` and persists across `page.reload()` and across a recorded outcome (schema 4 seed); turning sound on constructs the context in the same gesture and starts a source; a physical Summon key press starts a source, a wrong key starts a source; the wind is off by default and no looping source starts on the menu; with `ambienceOn` seeded and reduced motion `no-preference` a looping source starts on the menu and the wind stops on the séance; `page.emulateMedia({ reducedMotion: 'reduce' })` stops it and `'no-preference'` brings it back; no `media` request and no `audio/*` response across the menu, a Summon step and a Write step; no console error in any of these flows. Chromium's default autoplay policy is kept
    - After waiting for port 4173 to be free, run the spec; it passes
    - _Requirements: 21.9, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 9.1, 9.2, 9.3, 13.5, 13.6, 13.7, 16.10, 17.1, 17.2, 17.3, 18.3_

- [ ] 14. README and bundle figures
  - [x] 14.1 Write the README "Sound" section
    - Add a "## Sound" section after "## What the game contains" with the approved text of the design's A9 (the list of sounds, the defaults, the autoplay rule, the reduced-motion rule, the night wind, the saved choices, and the statement that all sounds are synthesised with the Web Audio API so there is nothing to license), with no sentence about the hardware silent switch, because no device check has been made yet; leave the Credits screen and `THIRD_PARTY_NOTICES.txt` unchanged; edit no other README section in this task
    - _Requirements: 18.5, 20.5_
  - [ ] 14.2 Measure the bundle and update the README figures
    - Run `npm run build -w app` and `npm run check:bundle`; compare the counted total with the baseline in `.kiro/specs/night-sounds/bundle-baseline.txt`: the counted growth must be less than 8,000 bytes gzip and the counted total at most 300,000; if not, stop and report with the per-file sizes. Update the README "Real first load" sentence and the "Exact figures" line (and the file-weight table if its rows changed) with the printed numbers, so the README comparison of `check:bundle` stays within its 1% tolerance and prints "README CHECK PASSED"; report the before and after counted totals and the growth
    - _Requirements: 19.1, 19.2, 19.3, 19.5_

- [ ] 15. Final checkpoint
  - [ ] 15.1 Run every check and report
    - Before every end-to-end run, wait until nothing listens on port 4173
    - Run `npm test` at the repository root; `npx tsc --noEmit`, `npx tsc --noEmit -p app` and `npx tsc --noEmit -p oracle` (no errors); `npm run build -w app`; `npm run check:bundle` (exit 0; report the counted growth against the baseline and the README check result); `npm run test:e2e` (port 4173 free first; wait for it to finish); `npm run check:data` and `npm run check:levels` (unaffected: both pass and no data file changed)
    - Report the real gzip size the sound code adds: the counted total printed by `npm run check:bundle` now, minus the counted total recorded before any code change in `.kiro/specs/night-sounds/bundle-baseline.txt` by task 4.1, in bytes, with the per-file sizes
    - Report the exact commands and the passed, failed and skipped counts of `npm test` and `npm run test:e2e`, with no skipped test that was not skipped before this feature
    - Report every changed existing assertion (the storage tests of task 5.2, the `SeedState` type of task 10.3, the two `sky-cap.spec.ts` lines of task 10.4), each with the old assertion, the new assertion and why the new one is at least as strict, and every existing test that needed changed inputs
    - Confirm with `git diff --stat` and the baseline `git status` record that `kiro-log.md`, every data file and `app/public` are untouched by this feature, that steering files changed only through tasks 3.1 to 3.6, and that `dependencies` in `app/package.json` is unchanged; search the added and changed files for `any`, for personal names, for `bg-candle`, `border-candle` and `text-candle`, and for any new `@media` block or animation outside the motion block
    - Retake the screenshots: delete the PNG files in the gitignored `e2e/screenshots/`, run `npm run test:e2e -- screenshots` (port 4173 free first), and list the path of every PNG written, so the human can review the toggle placement in task 16
    - If anything threatens the one-screen fit or the existing e2e suite, stop and report; never loosen a test
    - Report anything not achieved: name each failing or skipped check, each requirement criterion not met, the file or test and the command; make no commit
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 14.8, 19.1, 19.2, 19.3, 21.11, 21.12_

- [ ] 16. Human-only listening review and screenshot review
  - [ ] 16.1 HUMAN TASK: Human listens on a laptop and a phone and reviews the toggle placement screenshots
    - Human-only, separate from Kiro work, and last, so that no Kiro task waits on it. Listen on one laptop and one phone: volume of the taps, sweep, thud, chimes, falling tone and night wind; whether any sound is annoying or startling; whether the first sound after the first click or key press plays on iOS Safari (unlock), with the hardware silent switch off, and what the silent switch does; whether the focus stays on the speaker button after a tap on Safari
    - Review the screenshots listed by task 15.1 for the Sound_Toggle placement: beside the Moon below 992 px, below it from 992 px, and the séance header with the heading moved
    - Record the decision (accepted, or what to change) in the review notes the human keeps. Kiro does not listen, does not review the screenshots and does not edit `kiro-log.md`. A change the human asks for becomes a new task; a number that changes is changed in `RECIPES` and in the design table together
    - _Requirements: 3.1, 13.8, 14.3, 20.1_

## Notes

- There are no optional tasks. Every test task is required. No property-based test and no mutation test is added (decision of Nov 15); the existing property tests stay.
- Tasks 1.1 and 16.1 are human tasks. Kiro does not do them, does not decide an amendment and does not review the screenshots or listen to the sounds. Task 16.1 sits in its own wave after the final checkpoint, so no Kiro task waits on it, and task 1.1 sits first.
- After task 1.1, task 2.1 amends the spec first, so the steering and code tasks follow the human's answers.
- Task 4.1 measures the bundle before any code changes, so task 14.2 can state the counted growth.
- Files that several tasks edit (`App.tsx`, `SeanceSession.tsx`, `index.css`, `e2e/helpers.ts`, `README.md`, `art-direction.md`) sit in different waves of the graph. End-to-end runs are in different waves because the Playwright config starts its own server on port 4173.
- The design's "Existing assertions that change" list is the only licence to change an existing assertion; the human approved those on condition that none is loosened.
- The human's device check of the iOS unlock and the silent switch is not a test; it is task 16.1. A README sentence about the silent switch would be a new task after that check.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1", "3.5", "3.6"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["3.4"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["5.1"] },
    { "id": 8, "tasks": ["5.2", "6.1"] },
    { "id": 9, "tasks": ["6.2", "7.1", "7.2"] },
    { "id": 10, "tasks": ["7.3", "8.1"] },
    { "id": 11, "tasks": ["8.2", "9.1"] },
    { "id": 12, "tasks": ["9.2"] },
    { "id": 13, "tasks": ["9.3", "10.1", "10.2", "10.3"] },
    { "id": 14, "tasks": ["10.4", "10.6"] },
    { "id": 15, "tasks": ["10.5"] },
    { "id": 16, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 17, "tasks": ["11.4", "11.5"] },
    { "id": 18, "tasks": ["12.1"] },
    { "id": 19, "tasks": ["12.2"] },
    { "id": 20, "tasks": ["13.1", "13.2"] },
    { "id": 21, "tasks": ["14.1"] },
    { "id": 22, "tasks": ["14.2"] },
    { "id": 23, "tasks": ["15.1"] },
    { "id": 24, "tasks": ["16.1"] }
  ]
}
```
