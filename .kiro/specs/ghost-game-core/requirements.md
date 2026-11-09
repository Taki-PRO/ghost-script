# Requirements Document

## Introduction

The ghost-game-core feature is the first playable version of Ghost Script: a React + Vite single-page web app in `app/` that turns forgotten Chinese characters into ghosts the player lays to rest by writing them from memory. It reads the pre-generated `app/public/data/characters.json` (produced by the character-dataset spec) and never modifies it. This spec delivers the legend intro screen, a 10-ghost "Nightly Séance" session chosen by a spaced-repetition haunting scheduler, Write mode with live per-stroke checking via hanzi-writer quiz mode, a display-only prompt cleanup rule, and local progress persistence. Build mode, component hints, Cangjie Type mode, the Oracle MCP server, and visual polish beyond a simple dark theme are out of scope.

## Glossary

- **App**: The React + Vite single-page web application in `app/`.
- **characters.json**: The generated dataset at `app/public/data/characters.json` (one `CharacterRecord` per character), produced by the character-dataset spec. It is read-only input to this feature.
- **CharacterRecord**: A record in characters.json with fields `character`, `pinyin`, `meanings`, `strokeCount`, `strokeData`, `decomposition`, `prompt` (`{ meaning, pinyin }`) and `sources`.
- **Ghost**: The in-game representation of a single character the player must recall. A ghost shows the character's prompt (meaning + pinyin) but hides the character glyph until it is correctly written.
- **Prompt**: The `prompt` object of a CharacterRecord: a chosen English `meaning` and a tone-mark `pinyin`. Used verbatim as the game clue, subject only to display cleanup.
- **Display cleanup**: A pure, display-only transformation applied to `prompt.meaning` before it is shown, which removes dictionary-style notes (see Requirement 4). It never alters characters.json and never changes the stored data.
- **Nightly Séance**: A single play session of exactly 10 ghosts selected by the haunting scheduler.
- **Write mode**: The interaction where the player draws the character stroke by stroke with finger, Apple Pencil, mouse, or trackpad, checked live per stroke by hanzi-writer quiz mode using the record's `strokeData`.
- **Haunting scheduler**: The spaced-repetition engine (pure functions in `app/src/engine/`) that decides which ghosts return and when, based on review history and a clock value.
- **Review history**: The persisted per-character record used by the scheduler and saved in localStorage; it stores, per character, the attempt outcomes and timestamps, the current Ladder step, the last Outcome, and the next-due timestamp.
- **Outcome**: The result of a ghost in Write mode, one of `clean`, `struggled`, or `gave-up` (see Requirement 5). The Haunting scheduler maps `clean` to a correct review and both `struggled` and `gave-up` to a missed review.
- **Clean outcome**: A ghost completed with NO stroke hints shown and total mistakes within the clean-mistake threshold (default 2, configurable). Treated by the scheduler as correct.
- **Struggled outcome**: A ghost completed but with at least one stroke hint shown OR total mistakes above the clean-mistake threshold. The ghost is still laid to rest visually, but the scheduler treats it as missed.
- **Gave-up outcome**: The player pressed the labelled "Give up" control; the App reveals the character with an animated stroke-order playthrough, records a missed review, and continues to the next ghost.
- **Interval ladder**: The ordered list of spaced-repetition intervals the scheduler advances through on clean reviews: 1 day, 3 days, 7 days, 14 days, 30 days, 60 days (step 0 through step 5).
- **Ladder step**: A character's current index into the Interval ladder, persisted in the Review history.
- **schemaVersion**: An integer version tag stored alongside all persisted data so the Storage module can migrate or reset on version mismatch (see Requirement 7).
- **Storage module**: The wrapped `localStorage` access layer in `app/src/storage/` that isolates persistence behind a small API and tolerates failures (see Requirement 7).
- **Stroke hint**: A progressive reveal in Write mode that shows the next expected stroke after repeated misses, without revealing the whole character up front.

---

## Requirements

### Requirement 1: Legend Intro Screen

**User Story:** As a first-time player, I want a short legend intro that frames forgotten characters as ghosts, so that I understand the game's premise before I start.

#### Acceptance Criteria

1. WHEN the App is opened and no prior visit is recorded in the Storage module, THE App SHALL display the legend intro screen before any Nightly Séance begins.
2. THE legend intro screen SHALL present, in English, the premise that Cangjie invented Chinese writing, that legend says ghosts wailed the night writing was created, and that in this game forgotten characters are ghosts the player lays to rest by writing them.
3. THE legend intro screen SHALL provide a clearly labelled control to begin (e.g. a button) that dismisses the intro and starts a Nightly Séance.
4. WHEN the player dismisses the legend intro screen, THE App SHALL record in the Storage module that the intro has been seen.
5. WHEN the App is opened and a prior visit is recorded, THE App SHALL skip directly past the legend intro to the session start, WHILE still offering a way to view the legend again on demand.
6. THE legend intro screen SHALL be operable by both touch and mouse/keyboard, and its begin control SHALL have an accessible label.
7. THE legend intro copy SHALL state only facts that are verifiable and sourced; it SHALL NOT invent statistics, exam requirements, or historical claims.
8. THE legend intro (or an accompanying "About" note reachable from it) SHALL attribute the wailing-ghosts line to its classical source — the Huainanzi, which records that when Cangjie created writing, Heaven rained grain/millet and the ghosts wept at night (天雨粟，鬼夜哭). No other historical claim SHALL be made in the intro copy.

---

### Requirement 2: Dataset Loading

**User Story:** As a player, I want the game to load its characters from the generated dataset, so that every ghost is backed by verified data and the app works offline.

#### Acceptance Criteria

1. THE App SHALL load character data exclusively from `app/public/data/characters.json` at runtime and SHALL NOT call any external API or network service for character data.
2. THE App SHALL NOT modify `app/public/data/characters.json`.
3. THE App SHALL access character data through a typed loader in `app/src/data/` that validates the shape of each record against the shared `CharacterRecord` type before use.
4. IF `characters.json` cannot be loaded or parsed, THEN THE App SHALL show a clear, non-technical error state and SHALL NOT crash to a blank screen.
5. THE App SHALL treat a character's `strokeData`, `prompt`, `pinyin`, and `meanings` as present for every record it uses, consistent with the dataset's guarantees.

---

### Requirement 3: Nightly Séance Session

**User Story:** As a player, I want a short daily session of about ten ghosts, so that practice is bite-sized and finishes with a clear sense of completion.

#### Acceptance Criteria

1. WHEN a Nightly Séance begins, THE App SHALL assemble a session of up to 10 ghosts using the Haunting scheduler's session-selection algorithm (Requirement 6), producing exactly 10 ghosts when the dataset and scheduler can supply that many, and fewer only when the dataset contains fewer than 10 characters.
2. THE App SHALL present the session's ghosts one at a time, advancing to the next ghost only after the current ghost reaches a terminal Outcome (`clean`, `struggled`, or `gave-up`).
3. WHEN every ghost in the session has been resolved, THE App SHALL show a session-complete summary indicating how many ghosts were laid to rest.
4. THE App SHALL record each ghost's Outcome (`clean`, `struggled`, or `gave-up`) with a timestamp to the Review history via the Storage module IMMEDIATELY when that Outcome is reached, so that leaving mid-session loses no completed ghost (see Requirement 7).
5. THE App SHALL NOT present the same character more than once within a single Nightly Séance session.
6. WHEN the player finishes a session, THE App SHALL offer to start another Nightly Séance.

---

### Requirement 4: Prompt Display Cleanup

**User Story:** As a player, I want the ghost's clue to read as a clean meaning and pronunciation, so that dictionary notes and cross-references do not clutter or confuse the clue.

#### Acceptance Criteria

1. THE App SHALL render each ghost's clue from the record's `prompt.meaning` and `prompt.pinyin`, applying the Display cleanup to `prompt.meaning` before display.
2. THE Display cleanup SHALL be a pure function that removes dictionary-style notes from a meaning string, including at least: classifier notes of the form `(CL:...)` and `CL:...`; bracketed pinyin references of the form `[pin1 yin1]`; example clauses of the form `(e.g. ...)`; and pronunciation notes of the form `Taiwan pr. [...]`, `(Taiwan pr. ...)`, and `also pr. [...]`.
3. THE Display cleanup SHALL be display-only: it SHALL NOT modify `characters.json`, the loaded `CharacterRecord`, or any persisted data.
4. WHEN the Display cleanup would otherwise produce an empty or whitespace-only string, THE App SHALL fall back to the original, un-cleaned `prompt.meaning` so that a non-empty clue is always shown.
5. THE Display cleanup SHALL NOT add any text that was not present in the input; every character in its output SHALL have been present in the input (aside from the removal of notes and the trimming/collapsing of whitespace left by a removal).
6. THE Display cleanup SHALL be idempotent: applying it to its own output SHALL return a string equal to that output.
7. THE `prompt.pinyin` value SHALL be displayed as stored (tone-mark form) without cleanup.

---

### Requirement 5: Write Mode with Live Per-Stroke Checking

**User Story:** As a player on a touchscreen or with a mouse, I want to draw the character stroke by stroke and be checked as I go, so that I practise recall and get immediate feedback.

#### Acceptance Criteria

1. WHEN a ghost is presented in Write mode, THE App SHALL hide the target character glyph and display only the cleaned prompt, offering a writing surface backed by hanzi-writer quiz mode initialised with that record's `strokeData`.
2. THE writing surface SHALL accept input from touch, Apple Pencil, mouse, and trackpad via Pointer Events, and SHALL be usable on screens from 375px wide phones to 1440px+ laptops.
3. WHEN the player draws a stroke, THE App SHALL check it live against the expected stroke using hanzi-writer quiz mode and SHALL give immediate feedback on whether the stroke was accepted, counting a rejected stroke as a mistake.
4. WHEN the player misses the SAME expected stroke on 3 consecutive attempts (a configurable consecutive-miss threshold, default 3), THE App SHALL reveal a Stroke hint for that next expected stroke, revealing one stroke at a time and never the whole character at once.
5. WHEN the player completes all strokes with NO Stroke hint shown and total mistakes within the clean-mistake threshold (default 2, configurable), THE App SHALL resolve the ghost with a `clean` Outcome, lay the ghost to rest, reveal the completed character in ink, and record a correct review to the Review history.
6. WHEN the player completes all strokes BUT at least one Stroke hint was shown OR total mistakes exceeded the clean-mistake threshold, THE App SHALL resolve the ghost with a `struggled` Outcome, still lay the ghost to rest visually and reveal the character in ink, and record a MISSED review to the Review history.
7. THE App SHALL provide a clearly labelled "Give up" control; WHEN the player activates it, THE App SHALL resolve the ghost with a `gave-up` Outcome, reveal the character via an animated stroke-order playthrough, record a MISSED review to the Review history, and then continue to the next ghost.
8. THE clean-mistake threshold and the consecutive-miss stroke-hint threshold SHALL be configurable constants (defaults 2 and 3 respectively), defined in the engine/config layer rather than hard-coded in UI components.
9. Colour SHALL NOT be the only signal for stroke-accepted or stroke-rejected feedback; a non-colour cue (e.g. text, icon, or motion) SHALL also convey the result.
10. Interactive controls in Write mode (including "Give up") SHALL have accessible labels, and text SHALL meet contrast guidelines on the dark theme.

---

### Requirement 6: Haunting Scheduler (Spaced Repetition)

**User Story:** As a learner, I want characters I struggle with to return sooner and mastered ones to return later, so that practice focuses on what I am forgetting.

#### Acceptance Criteria

1. THE Haunting scheduler SHALL be implemented as pure functions in `app/src/engine/` that depend only on their inputs (Review history and an injected clock value in milliseconds), with no I/O, no direct `localStorage` access, and no reliance on ambient time.
2. THE scheduler SHALL use the Interval ladder [1 day, 3 days, 7 days, 14 days, 30 days, 60 days] (steps 0–5). WHEN a review Outcome is `clean`, THE scheduler SHALL advance the character's Ladder step by exactly one, capped at the top step (step 5), and set next-due to the review time plus the new step's interval.
3. WHEN a review Outcome is `struggled` or `gave-up`, THE scheduler SHALL reset the character's Ladder step to step 0 and set next-due to the review time plus 10 minutes (making the character due again shortly within the same or next session).
4. THE scheduler SHALL compute review intervals and next-due offsets that are never negative.
5. THE scheduler's session-selection algorithm, given the Review history, the full character list (in character-list order), and the injected clock, SHALL assemble up to 10 ghosts in this order: (a) DUE characters (next-due <= now), ordered by most overdue first (largest now-minus-next-due); then (b) NEW characters (no Review history) in character-list order, capped at 5 new per session UNLESS nothing is due, in which case the new-character cap does not apply; then (c) if still short of 10, the not-yet-due characters due soonest (smallest next-due minus now). All ties SHALL be broken by character-list order.
6. THE session-selection SHALL be deterministic: identical inputs (Review history, character list, clock) SHALL produce an identical selection and ordering.
7. THE scheduler SHALL produce exactly 10 ghosts when at least 10 characters exist, and fewer only when the dataset has fewer than 10 characters; it SHALL never include the same character twice in one session.
8. WHEN a character is answered `clean` on consecutive reviews, THE resulting sequence of ladder intervals for that character SHALL be non-decreasing (mastered characters return later, not sooner).
9. FOR two characters with otherwise-identical history, THE scheduler SHALL schedule a character whose latest Outcome was a miss (`struggled`/`gave-up`) no later than one whose latest Outcome was `clean`.
10. WHEN a character has no Review history, THE scheduler SHALL treat it as a NEW candidate per the selection algorithm (clause 5b).
11. THE scheduler SHALL separate game-logic functions (ladder advancement, next-due computation, session selection) in `app/src/engine/` from the UI components in `app/src/components/`, so the logic is unit- and property-testable in isolation.

---

### Requirement 7: Local Progress Persistence

**User Story:** As a returning player, I want my progress saved in my browser, so that the haunting scheduler remembers what I have practised without any account or server.

#### Acceptance Criteria

1. THE App SHALL persist Review history and the intro-seen flag exclusively in the browser's `localStorage`, with no accounts, no server, and no cloud sync.
2. THE App SHALL store a `schemaVersion` integer alongside ALL persisted data.
3. THE App SHALL access `localStorage` only through a Storage module in `app/src/storage/` that wraps reads and writes in `try/catch`.
4. WHEN persisted data is read and its `schemaVersion` is older than the current version, THE Storage module SHALL migrate it to the current shape when a migration is defined, and otherwise reset to defaults; WHEN the `schemaVersion` is unknown or newer than the current version, or the data is corrupt/does not match the expected shape, THE Storage module SHALL reset to defaults. In every case it SHALL NOT crash.
5. IF a `localStorage` read, write, or parse fails (e.g. storage disabled, quota exceeded), THEN THE Storage module SHALL degrade gracefully — returning a safe default or performing a no-op — and the App SHALL continue to run.
6. THE App SHALL persist each ghost's Outcome IMMEDIATELY when it is reached (not only at session end), so that leaving mid-session loses no completed ghost.
7. THE Storage module SHALL expose a small typed API (e.g. load/save Review history, get/set intro-seen, current schemaVersion) so that the rest of the App does not touch `localStorage` keys directly.

---

### Requirement 8: Platform, Tech, and Quality Constraints

**User Story:** As a judge and as a developer, I want the app to meet the project's technical and quality bars, so that it is trustworthy, accessible, and runs for free during judging.

#### Acceptance Criteria

1. THE App SHALL be implemented in TypeScript with `strict: true`, React + Vite, and Tailwind CSS, with game logic in `app/src/engine/` and UI in `app/src/components/`.
2. THE App SHALL avoid `any` except where unavoidable, preferring explicit types for character data.
3. THE App SHALL be a static single-page app with no backend for this feature, deployable to a free static host and runnable fully offline after assets load, with no paid APIs, no API keys in the frontend, and no runtime LLM calls.
4. THE App SHALL be responsive and usable from 375px-wide phones to 1440px+ laptops, with Write mode operable by touch and by mouse/keyboard.
5. THE App SHALL meet basic accessibility expectations: interactive elements have accessible labels, colour is never the only signal, and text meets contrast guidelines on the dark theme.
6. THE engine modules SHALL have unit tests, and every stated scheduler invariant and the Display cleanup invariants SHALL have property-based tests using Vitest and fast-check.
7. THE property-based tests SHALL cover at least:
   - Display cleanup: never returns empty (a non-empty input yields a non-empty display string, via cleanup or the original-text fallback), never adds text, is idempotent.
   - Scheduler: a `clean` review advances the Ladder step by exactly one and never skips a step; a `struggled`/`gave-up` review resets to step 0; intervals are never negative; the new-character cap of 5 per session holds unless nothing is due; session selection and tie-breaking are deterministic given the same history, character list, and clock; a missed character is never scheduled later than the same-history character answered `clean`.
8. THE feature SHALL have a spec in `.kiro/specs/ghost-game-core/` and SHALL NOT add `.kiro/` to `.gitignore`.
9. THE repository's root `npm test` SHALL run BOTH the existing character-dataset test suite (the 129 data tests under `tests/`) AND the new ghost-game-core app tests (under `app/`), via a single Vitest invocation or an aggregate test script, so that one command verifies the whole project. Adding the app tests SHALL NOT remove or break the existing data tests.

---
