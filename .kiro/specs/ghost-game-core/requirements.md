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
- **Review history**: The persisted per-character record of past attempts (outcomes and timestamps) used by the scheduler and saved in localStorage.
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

1. WHEN a Nightly Séance begins, THE App SHALL assemble a session of exactly 10 ghosts selected by the Haunting scheduler from the characters in characters.json, OR all available characters when fewer than 10 exist.
2. THE App SHALL present the session's ghosts one at a time, advancing to the next ghost only after the current ghost is resolved (laid to rest or skipped per the session rules).
3. WHEN every ghost in the session has been resolved, THE App SHALL show a session-complete summary indicating how many ghosts were laid to rest.
4. THE App SHALL record the outcome of each ghost in the session (correct or missed, with a timestamp) to the Review history via the Storage module.
5. THE App SHALL NOT present the same character more than once within a single Nightly Séance session.
6. WHEN the player finishes a session, THE App SHALL offer to start another Nightly Séance.

---

### Requirement 4: Prompt Display Cleanup

**User Story:** As a player, I want the ghost's clue to read as a clean meaning and pronunciation, so that dictionary notes and cross-references do not clutter or confuse the clue.

#### Acceptance Criteria

1. THE App SHALL render each ghost's clue from the record's `prompt.meaning` and `prompt.pinyin`, applying the Display cleanup to `prompt.meaning` before display.
2. THE Display cleanup SHALL be a pure function that removes dictionary-style notes from a meaning string, including at least: classifier notes of the form `(CL:...)` and `CL:...`; bracketed pinyin references of the form `[pin1 yin1]`; and example clauses of the form `(e.g. ...)`.
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
3. WHEN the player draws a stroke, THE App SHALL check it live against the expected stroke using hanzi-writer quiz mode and SHALL give immediate feedback on whether the stroke was accepted.
4. WHEN the player completes all strokes correctly, THE App SHALL mark the ghost as laid to rest, reveal the completed character in ink, and record a correct outcome to the Review history.
5. WHEN the player misses the same expected stroke repeatedly (a configurable threshold of consecutive misses on that stroke), THE App SHALL reveal a Stroke hint for the next expected stroke, revealing one stroke at a time rather than the whole character at once.
6. THE App SHALL record a missed outcome to the Review history for a ghost that the player fails to complete or chooses to give up on.
7. Colour SHALL NOT be the only signal for stroke-accepted or stroke-rejected feedback; a non-colour cue (e.g. text, icon, or motion) SHALL also convey the result.
8. Interactive controls in Write mode SHALL have accessible labels, and text SHALL meet contrast guidelines on the dark theme.

---

### Requirement 6: Haunting Scheduler (Spaced Repetition)

**User Story:** As a learner, I want characters I struggle with to return sooner and mastered ones to return later, so that practice focuses on what I am forgetting.

#### Acceptance Criteria

1. THE Haunting scheduler SHALL be implemented as pure functions in `app/src/engine/` that depend only on their inputs (Review history and a clock value), with no I/O, no direct `localStorage` access, and no reliance on ambient time.
2. WHEN given a Review history and a clock value, THE scheduler SHALL compute, for each character, a next-due value and SHALL select the session's due ghosts deterministically — identical inputs SHALL produce an identical selection and ordering.
3. THE scheduler SHALL compute review intervals that are never negative.
4. FOR any two characters with otherwise-identical history, THE scheduler SHALL schedule a character whose latest relevant attempt was a miss no later than a character whose latest relevant attempt was correct (missed characters return at least as soon as correct ones).
5. WHEN a character is answered correctly on consecutive reviews, THE scheduler SHALL produce non-decreasing intervals for that character (mastered characters return later, not sooner).
6. WHEN a character has no Review history, THE scheduler SHALL treat it as eligible to appear (a new, un-practised character is a candidate ghost).
7. THE scheduler SHALL separate the game-logic functions (scheduling, selection) in `app/src/engine/` from the UI components in `app/src/components/`, so the logic is unit- and property-testable in isolation.

---

### Requirement 7: Local Progress Persistence

**User Story:** As a returning player, I want my progress saved in my browser, so that the haunting scheduler remembers what I have practised without any account or server.

#### Acceptance Criteria

1. THE App SHALL persist Review history and the intro-seen flag exclusively in the browser's `localStorage`, with no accounts, no server, and no cloud sync.
2. THE App SHALL access `localStorage` only through a Storage module in `app/src/storage/` that wraps reads and writes in `try/catch`.
3. IF a `localStorage` read, write, or parse fails (e.g. storage disabled, quota exceeded, or corrupt data), THEN THE Storage module SHALL degrade gracefully — returning a safe default or no-op — and the App SHALL continue to run rather than crash.
4. WHEN persisted data is read back, THE Storage module SHALL validate it against the expected shape and SHALL discard or reset data that does not match, rather than passing malformed data to the scheduler.
5. THE Storage module SHALL expose a small typed API (e.g. load/save Review history, get/set intro-seen) so that the rest of the App does not touch `localStorage` keys directly.

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
7. THE property-based tests SHALL cover at least: the Display cleanup (never returns empty for a non-empty-after-cleanup or via fallback, never adds text, is idempotent) and the Haunting scheduler (a missed character is never scheduled later than the same-history character answered correctly; intervals are never negative; selection is deterministic given the same history and clock).
8. THE feature SHALL have a spec in `.kiro/specs/ghost-game-core/` and SHALL NOT add `.kiro/` to `.gitignore`.

---
