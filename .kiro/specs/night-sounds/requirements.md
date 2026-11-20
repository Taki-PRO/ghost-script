# Requirements Document

## Introduction

The night-sounds feature gives Ghost Script a small set of quiet sounds, all made in code with the Web Audio API. It was requested by the human. The sounds are:

1. A soft wooden tap for each Summon key, and a duller tap for a wrong key.
2. A faint brush sweep when a key's strokes ink in, and when the Write step accepts a stroke.
3. A low paper thud when the Seal_Stamp appears after a clean outcome.
4. A soft, low chime when a ghost is laid to rest (clean or struggled), and a quiet falling tone when the player gave up.
5. An optional, very quiet night-wind loop on the menu and the Graveyard, off by default even when sound is on.

The feature adds no audio file, no sample, no third-party sound and no runtime dependency, so there is nothing to license. A small speaker toggle, fixed beside the Moon on every screen, turns the sounds on and off. A second toggle turns the wind on and off. Both choices are saved in schema 4 of the save. Nothing sounds before the player's first click, tap or key press. Sounds never delay or block play, never leak an answer, and fail silently when Web Audio is missing or broken.

This feature amends `.kiro/steering/art-direction.md`, whose "Sound" section says "None." and the `ink-and-candlelight` spec (an earlier acceptance criterion says the App plays no sound). The amendments are listed at the end of this document, and the human approved each of them. No task edits `kiro-log.md`; the human writes it.

Test decision of Nov 15: this feature adds no property-based test and no mutation testing. Every new test is a unit, component or end-to-end test.

## Investigation findings

Everything below was read from the repository before the requirements were written.

### Steering

- `.kiro/steering/art-direction.md` line 87 to 88: "## Sound" followed by "None.". `tests/unit/steering-art-direction.test.ts` line 17 requires the heading `## Sound` to stay, so the amendment replaces the body and keeps the heading.
- `art-direction.md` "Primary action per screen" table: Summon, writing, Graveyard, Sources & licences have no Primary_Action; the other screens have exactly one seal-red slip. The Sound_Toggle must never add a second one.
- `art-direction.md` Motion: the Ambient exemption names the two mist bands, the idle ghost float, the idle candle glow, the wisp of a restless tablet and the intro's Grain_Fall, "and nowhere else". Every animation sits inside the one `prefers-reduced-motion: no-preference` block. Sound is not motion, so the wind loop is not added to that list.
- `art-direction.md` Palette: no new colour tokens are needed. The toggle is a paper slip with an ink label (existing `.slip`). Slips need at least 44 px height; the Moon section keeps a top room of 4.75 rem below 992 px and a fixed Sky_Cap above scrolling content.
- `art-direction.md` Pointer: the rule `button:not(:disabled):not([aria-disabled="true"])` in `app/src/styles/index.css` (line 463) already gives every enabled button the Link_Cursor on fine pointers, so a new button needs no cursor rule. A button with `aria-disabled="true"` gets `not-allowed`.
- `.kiro/steering/product.md`: "Spooky but calm. Ink-wash, candlelight, quiet atmosphere." and "Works on every device. Never block a user for lacking a touchscreen". Sound must be optional and quiet; the game must play the same without it.
- `.kiro/steering/tech.md`: TypeScript strict, engine logic in `src/engine/`, UI in `src/components/`, small pure functions, Vitest, "no new property-based tests" (Nov 15). Fonts must be open-licensed and recorded in the README. There is no rule about audio files today, and no rule against runtime audio libraries; both come from this spec and appear in the amendments.
- `.kiro/steering/content-accuracy.md` lines 44 to 50: the never-reveal rules. A hidden character must not be exposed by anything the player can see or hear. The designed summon reveal, the ink strokes and the first-meeting display are approved. No sound may carry information about the target character.
- `.kiro/specs/ink-and-candlelight/requirements.md` line 355: "THE App SHALL play no sound." This criterion is superseded by this spec for the app; the old spec file is not edited.

### Storage

- `app/src/storage/storage.ts`: `CURRENT_SCHEMA_VERSION = 3`; `PersistedState` has `schemaVersion`, `introSeen`, `cangjieIntroSeen`, `level`, `levelChosen`, `history`. `SHIPPED_MIGRATIONS` has only `2`. A migration at key `v` migrates v to v+1, so schema 4 needs a new key `3` and a test.
- `validateState` returns `undefined` for any bad field, and `loadState` then returns `defaultState`, which drops the whole save including the history. A corrupt sound flag would therefore wipe progress unless the sound fields are handled separately (Requirement 16).
- `saveState` and `recordOutcome` copy each field by name. A new field that is not added to both is silently dropped on the next write, so both need it, and a test must prove it.
- `resetToDefaults` removes the key; the default state then applies.
- `e2e/helpers.ts` declares `SeedState.schemaVersion: 3` as a literal type. Seeds at version 3 still work through the migration, but a seed helper for version 4 is needed for the new e2e tests.

### Screens and layout

- `app/src/App.tsx` screens: `loading`, `error`, `intro`, `level`, `menu`, `graveyard`, `credits`, `cangjie-guide`, `seance`, `summary`. `Shell` wraps each. The Séance uses `Shell compact` (class `no-moon-room`, `px-2 py-1`, one screen, no Top_Room). The other screens keep the 4.75 rem Top_Room below 992 px (`#root { padding-top: var(--moon-room) }`).
- The Moon is `body::before`, a 4 rem disc centred 2.5 rem from the top and the right (`--moon-inset-x`, `--moon-inset-y`, `--moon-size`), so it covers x from 0.5 rem to 4.5 rem from the right edge and y from 0.5 rem to 4.5 rem from the top. `--moon-room` is `clamp(0px, calc((992px - 100vw) * 1000), 4.75rem)`: 76 px below 992 px, 0 from 992 px.
- `SkyCap` is a fixed layer at z-index 10 that repaints the sky over the Top_Room below 992 px. The sticky headers of the Graveyard and of Sources & licences are `sticky sticky-below-moon z-20` with `top: var(--moon-room)`, `min-h-[64px]`, `-mx-4 px-4`, inside the `max-w-3xl` column.
- `SeanceSession.tsx` header: `flex w-full items-center justify-between gap-3 pr-[4.5rem]` holding the "Leave séance" button (`min-h-[44px]`, `max-[359px]:px-3 max-[359px]:text-sm`) and the heading "Ghost n of N". The `pr-[4.5rem]` keeps the row clear of the Moon. There is no room to the left of the Moon on this row at 320 px: Leave (about 95 px) + gap + heading (about 100 px) + a 44 px toggle + the 72 px Moon reserve is wider than the 320 px viewport minus its padding. The Séance header therefore needs re-flowing (Requirement 14).
- `StartMenu.tsx`: eight stacked slips (`slip min-h-[44px] px-6 py-2`), one `slip-primary`. The menu and the Graveyard scroll; the one-screen fit tests cover only the Summon and Write steps.
- Existing fit tests: `e2e/fits-one-screen.spec.ts` at 1024 x 768, 375 x 812 and (for Summon) 320 x 640; `e2e/no-horizontal-overflow.spec.ts`; `e2e/screenshots.spec.ts` calls `expectMoonInside`, and `moonIntruders` in `e2e/helpers.ts` fails when a control or text box meets the Moon disc.

### Where the sounds attach

- `app/src/modes/SummonStep.tsx`: a physical key goes through `applyKeyEvent` in a `window` `keydown` listener (line 183); an on-screen key goes through `enterKey`. Both compare the previous and the next `SummonState`: `filled` rises for an accepted key, `mistakes` rises for a counted wrong key (`reportMiss`, which calls `onWrongKey`). A key the engine ignores returns the same state and makes no sound. Ink is drawn by `writer.animateStroke(s)` inside `enqueueInk`, one call per stroke, queued one after another. `SUMMON_INK_SPEED = 2`, `SUMMON_REDUCED_SPEED = 1000` (reduced motion), `SUMMON_HOLD_MS = 1500`, `SUMMON_FADE_MS = 1500` (rite timing, unchanged).
- `app/src/modes/WriteMode.tsx`: hanzi-writer `quiz` callbacks `onMistake`, `onCorrectStroke` (line 123) and `onComplete`. The outcome is reported once through `resolve` to `SeanceSession`.
- `app/src/components/SeanceSession.tsx`: `handleOutcome` runs once per ghost (guarded by `resolvedRef` and `leftRef`), sets `result` and passes `sealed={result === 'clean'}` to `WriteMode`, which shows `SealStamp` only after a clean outcome. Outcomes: `clean`, `struggled`, `gave-up`.
- `app/src/engine/motion.ts` exports `prefersReducedMotion()`, safe where `matchMedia` is missing.

### Bundle and tests

- `npm run check:bundle` today prints 230,458 bytes counted (budget 300,000), plus 353,215 bytes for the level 1 dataset, 583,673 bytes first load. The README states 230,447 counted and 583,662 total (within the 1% tolerance of the README check). The largest counted files are the app script (83,958 B), the level 1 font subset (66,575 B), the heading fonts and the stylesheet (11,959 B). Headroom is about 69,500 B; this feature takes at most 8,000 B of it.
- `scripts/check-bundle-size.ts` compares the README's "Real first load" sentence and "Exact figures" line with the printed ones within 1%.
- jsdom has no `AudioContext`, so with feature detection the toggle is not rendered in the existing component tests and none of them changes. New tests install a mock.
- There is no audio file, audio API call or "sound" feature anywhere in `app/src`, `app/public`, `e2e` or `scripts` today (searched for `audio`, `sound`, `AudioContext`).

### Platform notes (unverified in this repository; the human checks them on a device after the build)

- Browsers keep a new `AudioContext` suspended until a user gesture, and iOS Safari only unlocks one from a `click`, `touchend` or `keydown` handler (not `touchstart`). The engine therefore listens to several gesture events (Requirement 2).
- hanzi-writer 3.7.3 listens to mouse and touch events, not Pointer Events. `pointerdown` on the document still fires for the same touches.
- iOS can mute Web Audio with the hardware silent switch, and the toggle cannot override this. The README makes no claim about the silent switch, because no device check has been made yet.

## Glossary

- **Sound_Engine**: The module under `app/src/audio/` that turns a sound request into scheduled audio. It has a pure part (Sound_Planner) and an AudioContext part (Synth).
- **Sound_Planner**: The pure functions of the Sound_Engine that decide, from the current planner state, the request and the time, whether a request is accepted, dropped or replaced. They never touch the AudioContext or the clock.
- **Synth**: The part of the Sound_Engine that builds Web Audio nodes for an accepted request.
- **Sound_Id**: One of `key-tap`, `key-wrong`, `ink-sweep`, `seal-thud`, `rest-clean`, `rest-struggled`, `rest-gave-up`.
- **Effect_Voice**: One playing instance of a Sound_Id. It has a start time and an end time.
- **Ambience_Voice**: The one looping night-wind voice.
- **Master_Chain**: The fixed output path: voices, then the Master_Gain, then the Limiter, then the destination.
- **Master_Gain**: The single gain node at the head of the Master_Chain.
- **Limiter**: A `DynamicsCompressorNode` at the end of the Master_Chain.
- **Gesture_Event**: A `pointerdown`, `touchend`, `click` or `keydown` event that the browser marks as a user activation, on the document.
- **Unlock**: The first time the Sound_Engine constructs the AudioContext and calls `resume()`. It happens only inside a Gesture_Event handler.
- **Sound_Setting**: The saved boolean `soundOn`.
- **Ambience_Setting**: The saved boolean `ambienceOn`.
- **Sound_Toggle**: The speaker button that changes the Sound_Setting. It is a paper slip.
- **Ambience_Toggle**: The button that changes the Ambience_Setting. It is a paper slip.
- **Web_Audio_Available**: True when `window.AudioContext` or `window.webkitAudioContext` is a function. Checked without constructing anything.
- **Top_Room**: The 4.75 rem (76 px) at the top of every non-Séance screen below 992 px, kept free of scrolling content (`--moon-room`).
- **Moon_Disc**: The 4 rem Moon at the top right.
- **Sticky_Header**: The sticky header of the Graveyard and of Sources & licences.
- **Link_Cursor**: The ghost cursor variant for buttons and links on fine pointers.
- **Reduced_Motion_Preference**: The state of `(prefers-reduced-motion: reduce)`.
- **Seal_Stamp**: The seal of `SealStamp`, shown only after a clean outcome.
- **Outcome**: One of `clean`, `struggled`, `gave-up`, the combined result of one ghost.
- **Counted_Bundle**: The gzip total that `npm run check:bundle` counts against the 300,000-byte budget.
- **Audio_File_Scan**: The unit test that walks `app/public` and `app/src` for audio files and audio loading calls.
- **Audio_Mock**: The Vitest test double for `AudioContext` and its nodes, which records constructions, `resume` and `suspend` calls, node creation, parameter automation and `start`/`stop` times.
- **Audio_Recorder**: The Playwright init script that wraps `window.AudioContext` and `AudioScheduledSourceNode.prototype.start` and records every construction, `resume()` call and source start.

## Requirements

### Requirement 1: Sound engine with a pure planner

**User Story:** As a developer, I want the scheduling and voice-limit logic to be pure and separate from the AudioContext, so that I can test it without audio.

#### Acceptance Criteria

1. THE Sound_Engine SHALL expose `play(id: Sound_Id)`, `setEnabled(on: boolean)`, `setAmbience(on: boolean)`, `unlock()`, `suspend()` and `dispose()` as its only public operations.
2. THE Sound_Planner SHALL accept the planner state, a request (Sound_Id and time in milliseconds) and return the new planner state and a decision of `accept` or `drop` with a reason, without reading any clock, AudioContext or global.
3. WHEN the Sound_Planner accepts a request, THE Sound_Planner SHALL record the Effect_Voice end time as the request time plus the duration of that Sound_Id from the recipe table in Requirement 3.
4. THE Synth SHALL receive only accepted requests and SHALL build the nodes for them.
5. THE Sound_Engine SHALL expose no function that takes a character, a ghost record, a Cangjie code or a key name as input to `play`.
6. THE Sound_Engine SHALL live under `app/src/audio/`, and no file under `app/src/audio/` other than the provider `SoundProvider.tsx` SHALL import React.

### Requirement 2: Lazy construction and autoplay policy

**User Story:** As a player, I want no sound before I have clicked or typed, so that the page never surprises me.

#### Acceptance Criteria

1. WHEN the page loads, THE Sound_Engine SHALL construct no AudioContext.
2. WHILE no Gesture_Event has occurred, THE Sound_Engine SHALL construct no AudioContext, SHALL start no source and SHALL drop every `play` request; after the first Gesture_Event, THE Sound_Engine SHALL accept a `play` request only WHILE the AudioContext is running or the resume window of Requirement 2.10 is open.
3. WHEN the first Gesture_Event occurs and the Sound_Setting is on and Web_Audio_Available is true, THE Sound_Engine SHALL construct exactly one AudioContext inside that event handler and SHALL call `resume()` on it.
4. WHILE the Sound_Setting is off, THE Sound_Engine SHALL construct no AudioContext, whatever the Gesture_Events.
5. WHEN the player turns the Sound_Setting on and no AudioContext exists, THE Sound_Engine SHALL construct the AudioContext inside that click handler and call `resume()`.
6. WHEN the AudioContext state is `suspended` or `interrupted` at a Gesture_Event and the Sound_Setting is on, THE Sound_Engine SHALL call `resume()` once for that event.
7. THE Sound_Engine SHALL listen to the Gesture_Events on the document with passive listeners and SHALL remove its listeners on `dispose()`.
8. THE Sound_Engine SHALL construct at most one AudioContext for the page session.
9. WHERE the browser offers only `webkitAudioContext`, THE Sound_Engine SHALL use it.
10. WHEN a `resume()` call made after a Gesture_Event has not settled, THE Sound_Engine SHALL accept `play` requests for up to 300 ms after that call, so that the first key tap stays audible, and SHALL drop them after that until the AudioContext is running.

### Requirement 3: Synth recipes and output safety

**User Story:** As a player, I want every sound to be short, soft and never startling, so that the game stays calm.

#### Acceptance Criteria

1. THE Synth SHALL build each Sound_Id from the recipe table below, with every peak gain, duration and frequency inside the stated bounds.
2. THE Synth SHALL connect every voice to the Master_Chain and to nothing else.
3. THE Synth SHALL set the Master_Gain value to at most 0.6.
4. THE Synth SHALL configure the Limiter with threshold −18 dB, knee 6 dB, ratio 12, attack 0.003 s and release 0.25 s.
5. THE Synth SHALL start every Effect_Voice envelope at gain 0, rise to the peak in at least 2 ms, and fall to at most 0.0001 before the source stops, so that no voice starts or ends with a click.
6. THE Synth SHALL pass every noise source through a low-pass or band-pass filter with a centre or cut-off frequency of at most 6,000 Hz.
7. THE Synth SHALL end every Effect_Voice at most 1,200 ms after its request time, including the 150 to 250 ms offset of the chime that follows the seal thud.
8. THE Synth SHALL generate its noise buffers with a fixed-seed pseudo-random generator, so that two runs produce the same samples.
9. THE Synth SHALL create each noise buffer lazily, on the first request that needs it, and SHALL reuse it for every later request.
10. THE Synth SHALL use no gain above 0.2 on any single voice, so that four simultaneous voices at the Master_Gain stay below 1.0 even without the Limiter.

Recipe bounds (all gains are linear, before the Master_Gain):

| Sound_Id | Source | Frequency bounds | Duration | Peak gain |
|---|---|---|---|---|
| `key-tap` | sine body plus filtered noise click | body 180 to 320 Hz; noise band-pass 700 to 1,600 Hz | 40 to 100 ms | at most 0.10 |
| `key-wrong` | sine body plus low-passed noise | body 110 to 180 Hz; noise low-pass at most 500 Hz | 60 to 140 ms | at most 0.08 |
| `ink-sweep` | noise through a band-pass whose centre moves | centre 1,500 to 4,000 Hz, moving by at most 1,500 Hz | 120 to 300 ms | at most 0.04 |
| `seal-thud` | sine falling plus low-passed noise | sine from 90 Hz down to 50 Hz; noise low-pass at most 400 Hz | 200 to 400 ms | at most 0.20 |
| `rest-clean` | two sine partials | fundamental 262 to 330 Hz; second partial at 2 times the fundamental, gain at most 0.4 of the first | 700 to 1,000 ms | at most 0.12 |
| `rest-struggled` | the fundamental of `rest-clean`, no second partial | the same fundamental as `rest-clean` | 500 to 800 ms | at most 0.09 |
| `rest-gave-up` | one sine falling | from 330 Hz down to 196 Hz | 500 to 1,000 ms | at most 0.08 |
| ambience | looped noise, band-pass with a slow gain and centre LFO | centre 300 to 700 Hz; LFO 0.05 to 0.15 Hz | loop of 2 to 4 s; fade in 1,000 to 2,000 ms; fade out 300 to 600 ms | at most 0.03 |

`key-wrong` has a body at least 30% lower than `key-tap` and no energy above 500 Hz in its noise, so it sounds duller.

### Requirement 4: Summon key sounds

**User Story:** As a player, I want a soft tap when I press a Summon key and a duller tap when the key is wrong, so that typing feels physical.

#### Acceptance Criteria

1. WHEN the Summon step accepts a key (the `filled` count of the Summon state rises, from a physical key or an on-screen key), THE Summon_Step SHALL request `key-tap`.
2. WHEN the Summon step counts a wrong key (the `mistakes` count rises), THE Summon_Step SHALL request `key-wrong`.
3. WHEN the Summon step ignores a key (the state is unchanged), THE Summon_Step SHALL request no sound.
4. THE Summon_Step SHALL request the same Sound_Id for the same kind of key event for every character, every ghost, every key and every position in the code.
5. THE Sound_Engine SHALL play `key-tap` and `key-wrong` with the same parameters for every character, so the sound carries no information beyond the key being accepted or counted wrong, which the Summon step already shows in its status line and the flinch of the ghost.
6. WHEN the Summon step finishes the last key, THE Summon_Step SHALL request `key-tap` for that key and SHALL request no other sound for the forming of the character (the first-meeting hold and fade stay silent).

### Requirement 5: Ink sounds

**User Story:** As a player, I want a faint brush sweep when ink appears, so that drawing feels real.

#### Acceptance Criteria

1. WHEN an accepted Summon key makes the Summon step start the animation of one of its strokes through `animateStroke`, THE Summon_Step SHALL request `ink-sweep` at that moment, and the strokes drawn by the first-meeting forming of the character SHALL make no sound (Requirement 4.6).
2. WHEN the Write step receives `onCorrectStroke` from hanzi-writer, THE Write_Step SHALL request `ink-sweep`.
3. WHEN the Write step receives `onMistake`, THE Write_Step SHALL request no sound.
4. IF the ink animation of the Summon step has failed (the step has stopped animating), THEN THE Summon_Step SHALL request no further `ink-sweep`.
5. WHILE the Reduced_Motion_Preference is reduce, THE Summon_Step SHALL still request `ink-sweep` for each stroke, because the effect sounds are short and are not motion.
6. WHEN a ghost is resolved or the séance is left, THE Summon_Step and THE Write_Step SHALL request no further sound.

### Requirement 6: Seal, rest and gave-up sounds

**User Story:** As a player, I want a quiet sound when a ghost is laid to rest, so that I feel the moment without being startled.

#### Acceptance Criteria

1. WHEN the Séance session reaches the Outcome `clean` for a ghost, THE Séance_Session SHALL request `seal-thud` and, scheduled 150 to 250 ms later on the audio clock, `rest-clean`.
2. WHEN the Séance session reaches the Outcome `struggled` for a ghost, THE Séance_Session SHALL request `rest-struggled` and SHALL request no `seal-thud`.
3. WHEN the Séance session reaches the Outcome `gave-up` for a ghost, THE Séance_Session SHALL request `rest-gave-up`.
4. THE Séance_Session SHALL request the outcome sounds exactly once per ghost, at the same moment it records the Outcome, and SHALL request none when the player has left.
5. THE Séance_Session SHALL request the outcome sounds in the nightly mode, the review mode and the walkthrough ghost alike.
6. THE Séance_Session SHALL request no sound when the player presses "Next ghost", "Finish the séance", "Leave séance", "Stay" or "Leave", and none when the summary opens.

### Requirement 7: Voice limits and rate limiting

**User Story:** As a player who types fast, I want the sounds never to pile up into noise.

#### Acceptance Criteria

1. THE Sound_Planner SHALL allow at most 4 Effect_Voices at once, counted by end time against the request time.
2. THE Sound_Planner SHALL allow at most 3 Effect_Voices at once for `key-tap`, `key-wrong` and `ink-sweep` together, so that the fourth place is kept for an outcome sound.
3. THE Sound_Planner SHALL allow at most 2 Effect_Voices at once of the same Sound_Id among `key-tap`, `key-wrong` and `ink-sweep`.
4. THE Sound_Planner SHALL drop a `key-tap` or `key-wrong` request that comes less than 40 ms after the last accepted request of the same Sound_Id.
5. THE Sound_Planner SHALL drop an `ink-sweep` request that comes less than 80 ms after the last accepted `ink-sweep`.
6. IF a request is dropped for a voice limit or a spacing limit, THEN THE Sound_Planner SHALL discard it and SHALL NOT queue it for later.
7. THE Sound_Planner SHALL accept an outcome request (`seal-thud`, `rest-clean`, `rest-struggled`, `rest-gave-up`) whenever fewer than 4 Effect_Voices are active.
8. WHEN a request is dropped, THE Sound_Engine SHALL leave the game state, the focus and every timer unchanged.

### Requirement 8: Night wind ambience

**User Story:** As a player, I want an optional quiet night wind on the menu and the Graveyard, so that the quiet screens feel haunted.

#### Acceptance Criteria

1. THE Sound_Engine SHALL start the Ambience_Voice only WHILE the Sound_Setting is on, the Ambience_Setting is on, the AudioContext is running, the page is visible, the Reduced_Motion_Preference is not reduce, and the current screen is the menu or the Graveyard.
2. THE Ambience_Setting SHALL be off by default, including when the Sound_Setting is on.
3. WHEN the player moves between the menu and the Graveyard, THE Sound_Engine SHALL keep the Ambience_Voice playing without restarting it.
4. WHEN the current screen is none of the menu and the Graveyard, THE Sound_Engine SHALL fade the Ambience_Voice out within 300 to 600 ms and stop and release its nodes.
5. WHEN the Ambience_Voice starts, THE Synth SHALL fade it in over 1,000 to 2,000 ms to a peak gain of at most 0.03.
6. THE Synth SHALL build the ambience noise buffer only when the Ambience_Voice first starts.
7. THE Sound_Engine SHALL play the Ambience_Voice for no screen other than the menu and the Graveyard, including the Séance, the Summary, the intro, the Level screen, Sources & licences and the Cangjie guide.

### Requirement 9: Reduced motion

**User Story:** As a player who asks for less motion, I want the ambience to stay off.

#### Acceptance Criteria

1. WHILE the Reduced_Motion_Preference is reduce, THE Sound_Engine SHALL NOT start the Ambience_Voice.
2. WHEN the Reduced_Motion_Preference changes to reduce while the Ambience_Voice plays, THE Sound_Engine SHALL fade it out within 300 to 600 ms and stop it, and SHALL leave the saved Ambience_Setting unchanged.
3. WHEN the Reduced_Motion_Preference changes to no-preference while the Ambience_Setting, the Sound_Setting, the page visibility and the screen allow it, THE Sound_Engine SHALL start the Ambience_Voice.
4. WHILE the Reduced_Motion_Preference is reduce, THE Ambience_Toggle SHALL be rendered with `aria-disabled="true"` and with a visible text note that the wind is off while reduced motion is requested.
5. WHILE the Reduced_Motion_Preference is reduce, THE Sound_Engine SHALL still play the effect sounds of Requirements 4 to 6.
6. THE Sound_Engine SHALL listen to the `change` event of the `(prefers-reduced-motion: reduce)` media query and SHALL remove that listener on `dispose()`.
7. THE feature SHALL add no animation, transition or keyframe outside the one `prefers-reduced-motion: no-preference` block of `app/src/styles/index.css`, and SHALL NOT add the Ambience_Voice to the Ambient exemption list of the art direction.

### Requirement 10: Page visibility

**User Story:** As a player, I want the game to be silent when I switch tabs.

#### Acceptance Criteria

1. WHEN the document becomes hidden, THE Sound_Engine SHALL stop the Ambience_Voice and SHALL call `suspend()` on the AudioContext.
2. WHEN the document becomes visible and the Sound_Setting is on, THE Sound_Engine SHALL call `resume()` on the AudioContext, and SHALL restart the Ambience_Voice if the conditions of Requirement 8.1 hold.
3. WHILE the document is hidden, THE Sound_Engine SHALL drop every `play` request.
4. THE Sound_Engine SHALL remove its `visibilitychange` listener on `dispose()`.

### Requirement 11: Failure paths

**User Story:** As a player on a browser without working audio, I want the game to work exactly the same, silently.

#### Acceptance Criteria

1. IF Web_Audio_Available is false, THEN THE Sound_Engine SHALL make every operation a no-op, SHALL throw nothing, and THE App SHALL render no Sound_Toggle and no Ambience_Toggle.
2. IF the AudioContext constructor throws, THEN THE Sound_Engine SHALL catch the error, SHALL mark itself broken for the page session, SHALL make every later operation a no-op and SHALL NOT retry the constructor.
3. IF `resume()` rejects or throws, THEN THE Sound_Engine SHALL catch it, SHALL treat the context as not running, SHALL drop `play` requests, and SHALL try `resume()` again at the next Gesture_Event.
4. IF a node, parameter or `start` call throws while building a voice, THEN THE Synth SHALL catch the error, release the nodes already built for that voice and drop the request.
5. IF the AudioContext state is neither `running` nor resumable (for example `closed`), THEN THE Sound_Engine SHALL drop `play` requests.
6. THE Sound_Engine SHALL produce no unhandled promise rejection and no console error in any failure path above.
7. THE Sound_Engine SHALL keep the Sound_Setting and the Ambience_Setting unchanged in every failure path.

### Requirement 12: Sounds never block play and never reveal

**User Story:** As a player, I want the game to behave the same with or without sound.

#### Acceptance Criteria

1. THE callers of `play` SHALL call it without `await`, SHALL catch and ignore any error from it, and SHALL call it after the game state update they belong to.
2. WHEN `play` throws, THE Summon_Step, THE Write_Step and THE Séance_Session SHALL reach the same state, the same Outcome and the same saved history as when `play` does nothing.
3. THE Sound_Engine SHALL add no timer, no `await` and no delay to any key handler, stroke handler or outcome handler.
4. THE Sound_Engine SHALL give every character the same sounds, with the same parameters, so that a sound never tells the player which character is hidden, which key is next or which stroke is next.
5. WHEN the player presses a wrong Summon key, THE Sound_Engine SHALL play the duller tap, and this reveals nothing beyond the wrong-key feedback that the Summon step already shows on the screen.
6. THE Sound_Engine SHALL add no text, no attribute and no DOM node that names a character, a code, a key or a stroke.

### Requirement 13: The sound toggle

**User Story:** As a player, I want a clear speaker button to turn all sound on or off.

#### Acceptance Criteria

1. THE Sound_Toggle SHALL be a native `button` element with the accessible name "Sound" and `aria-pressed` set to `true` WHILE the Sound_Setting is on and `false` WHILE it is off.
2. THE Sound_Toggle SHALL show an inline SVG speaker icon with `aria-hidden="true"`: a speaker with sound waves WHILE on, and the same speaker with a diagonal slash WHILE off, so the state is never carried by colour alone.
3. THE Sound_Toggle SHALL have the classes `slip` and not `slip-primary`, a height and width of at least 44 px, and the same visible focus ring as the other buttons.
4. THE Sound_Toggle SHALL use only existing colour tokens and no Chinese text, no ghost shape and no new animation.
5. WHEN the player activates the Sound_Toggle by click, tap, Enter or Space, THE Sound_Toggle SHALL flip the Sound_Setting and save it.
6. WHEN the player turns the Sound_Setting off, THE Sound_Engine SHALL stop every voice, stop the Ambience_Voice and suspend the AudioContext.
7. WHEN the player turns the Sound_Setting on, THE Sound_Engine SHALL request one `key-tap` as confirmation, after Unlock.
8. THE Sound_Toggle SHALL keep the keyboard focus on itself after activation.
9. THE Sound_Toggle SHALL give the Link_Cursor on fine pointers through the existing button rule, with no new cursor rule.
10. THE Sound_Toggle SHALL come after the screen content in the DOM, so that the first Tab stop and the initial focus of every screen stay as they are.
11. WHEN the Sound_Toggle is rendered on the Cangjie guide or the intro, THE Sound_Toggle SHALL NOT be the Primary_Action, and every screen SHALL keep at most one seal-red slip.

### Requirement 14: Toggle placement on every screen

**User Story:** As a player, I want to find the sound button in the same place on every screen without it getting in the way.

#### Acceptance Criteria

1. THE Sound_Toggle SHALL be rendered once by the App, outside the screens, on the intro, Level, menu, Graveyard, Sources & licences, Cangjie guide, Séance (Summon and Write steps) and Summary screens.
2. THE Sound_Toggle SHALL have the same position and the same size, in CSS pixels, on all of those screens at a given viewport width.
3. WHILE the viewport is below 992 px, THE Sound_Toggle SHALL be a fixed 44 px square at the top of the viewport, with its right edge 16 px left of the left edge of the Moon_Disc, above the Sky_Cap and the Sticky_Header in stacking order.
4. THE Sound_Toggle SHALL NOT meet the Moon_Disc, so that `moonIntruders` reports nothing on every screen that calls `expectMoonInside`.
5. THE Sound_Toggle SHALL NOT overlap the box of any other control or any text on any screen at viewport widths from 320 to 1440 px, including 992 px (the width at which the Top_Room ends and the Sticky_Header moves to the top).
6. WHILE the viewport is below 992 px, THE Sound_Toggle SHALL sit inside the Top_Room and SHALL NOT change the height of the Top_Room.
7. THE Séance header SHALL hold only the "Leave séance" button, and THE Séance_Session SHALL show the heading "Ghost n of N", as one element, in the step-label column beside the ghost prompt at every viewport width, so that the Leave button, the heading and the Sound_Toggle neither overlap nor overflow horizontally at 1024 x 768, 375 x 812 and 320 x 640.
8. WHEN the Sound_Toggle is added, THE Summon step and THE Write step SHALL still fit one screen at 1024 x 768 and 375 x 812, and THE Summon step SHALL still fit at 320 x 640, with the same minimum paper sizes as today (260, 240 and 96 px).
9. WHEN the Sound_Toggle is added, THE Graveyard and Sources & licences SHALL keep the Sticky_Header below the Top_Room at scroll 0, and the Sticky_Header content SHALL NOT be covered by the Sound_Toggle at any width.
10. THE Sound_Toggle SHALL NOT be rendered on the loading screen or the error screen.
11. WHILE the viewport is 992 px or wider, THE Sound_Toggle SHALL be a fixed 44 px square centred under the Moon_Disc, with its top edge 16 px below the bottom edge of the Moon_Disc, above the Sticky_Header in stacking order.

### Requirement 15: The ambience toggle

**User Story:** As a player, I want to choose the night wind separately from the effects.

#### Acceptance Criteria

1. THE Ambience_Toggle SHALL be a native `button` with the accessible name "Night wind" and `aria-pressed` set to `true` WHILE the Ambience_Setting is on and `false` WHILE it is off.
2. THE Ambience_Toggle SHALL show the visible text "Night wind: on" or "Night wind: off", so the state is never carried by colour alone.
3. THE Ambience_Toggle SHALL have the classes `slip` and not `slip-primary`, a height of at least 44 px and the same visible focus ring as the other buttons.
4. THE Graveyard SHALL render the Ambience_Toggle, and no other screen SHALL render it, so the menu shows no Ambience_Toggle (approved by the human, because the toggle made the worst-case menu overflow one screen).
5. WHILE the Sound_Setting is off, THE Ambience_Toggle SHALL be rendered with `aria-disabled="true"` and with a visible text note that the wind needs sound on.
6. WHEN the player activates the Ambience_Toggle, THE Ambience_Toggle SHALL flip the Ambience_Setting and save it.
7. THE Ambience_Toggle SHALL NOT make the Graveyard show a seal-red slip.

### Requirement 16: Persistence (storage schema 4)

**User Story:** As a returning player, I want my sound choices remembered, and an old save to keep working.

#### Acceptance Criteria

1. THE Store SHALL write `CURRENT_SCHEMA_VERSION = 4` and SHALL add the booleans `soundOn` and `ambienceOn` to `PersistedState`.
2. THE Store SHALL default `soundOn` to true and `ambienceOn` to false, in the default state and in every reset.
3. WHEN the Store loads a blob of schema 3, THE Store SHALL migrate it with a migration at key `3` that adds `soundOn: true` and `ambienceOn: false` and keeps every other field.
4. WHEN the Store loads a blob of schema 2, THE Store SHALL apply migrations 2 and 3 in order and SHALL give the same result as migrating 2 to 3 first and then 3 to 4.
5. IF `soundOn` or `ambienceOn` of a schema 4 blob is missing or not a boolean, THEN THE Store SHALL replace that one field with its default and SHALL keep the history and every other field.
6. IF the history, `level`, `levelChosen`, `introSeen` or `cangjieIntroSeen` of a blob is invalid, THEN THE Store SHALL keep today's behaviour and return the default state.
7. THE Store SHALL expose `getSoundOn`, `setSoundOn`, `getAmbienceOn` and `setAmbienceOn`, and each setter SHALL change only its own field.
8. THE Store SHALL copy `soundOn` and `ambienceOn` in `saveState` and in `recordOutcome`, so that recording an outcome never resets either setting.
9. IF a blob has a schema above 4, THEN THE Store SHALL return the default state, as it does today for a newer schema.
10. IF the storage backend is missing or a write fails, THEN THE App SHALL keep the Sound_Setting and the Ambience_Setting in memory for the page session and the toggles SHALL keep working.
11. WHEN `resetToDefaults` runs, THE Store SHALL remove the key, and the next load SHALL return `soundOn` true and `ambienceOn` false.

### Requirement 17: Default and first sound

**User Story:** As a first-time player, I want sound to be on but never to start by itself.

#### Acceptance Criteria

1. WHEN a player has no save, THE App SHALL start with the Sound_Setting on and the Ambience_Setting off.
2. WHEN a player has a save of schema 3, THE App SHALL start with the Sound_Setting on and the Ambience_Setting off.
3. THE App SHALL play no sound for any button press other than the Summon keys and the Sound_Toggle, and none on the intro, the legend line, the Level screen, Sources & licences and the Cangjie guide.
4. THE App SHALL show the Sound_Toggle on the intro, so a first-time player sees it before the first sound.

### Requirement 18: No audio files and no audio loading

**User Story:** As a maintainer, I want nothing to license, so that the sounds are certainly ours.

#### Acceptance Criteria

1. THE repository SHALL contain no file with the extension `.mp3`, `.wav`, `.ogg`, `.oga`, `.opus`, `.m4a`, `.aac`, `.flac`, `.aif`, `.aiff`, `.weba`, `.mid` or `.midi` under `app/public` or `app/src`.
2. THE source under `app/src` SHALL contain no `data:audio/` URI, no `new Audio(`, no `<audio`, no `createMediaElementSource`, no `decodeAudioData` and no `fetch` or `XMLHttpRequest` call that names an audio resource.
3. THE app SHALL request no resource of type `media` and no response with an `audio/*` content type during any end-to-end flow.
4. THE app SHALL add no entry to `dependencies` in `app/package.json` and no audio library.
5. THE README SHALL state that all sounds are synthesised in the browser with the Web Audio API and that there is nothing to license; THE Credits screen and `THIRD_PARTY_NOTICES.txt` SHALL stay unchanged.

### Requirement 19: Bundle budget

**User Story:** As a maintainer, I want the feature to stay light, so that the first load stays small.

#### Acceptance Criteria

1. THE feature SHALL add less than 8,000 bytes of gzip to the Counted_Bundle, measured as the difference of `npm run check:bundle` before the feature and after it.
2. THE Counted_Bundle after the feature SHALL stay at or below 300,000 bytes.
3. WHEN the feature is complete, THE README SHALL state the new first-load figures in the "Real first load" sentence and the "Exact figures" line, and `npm run check:bundle` SHALL print "README CHECK PASSED".
4. THE Synth SHALL create no audio buffer larger than 4 s of mono samples at the context sample rate.
5. THE feature SHALL add no file to `app/public`.

### Requirement 20: Steering and documentation amendments

**User Story:** As the human, I want the rules to match what the app does, and to approve each change.

#### Acceptance Criteria

1. THE art direction file SHALL keep the heading `## Sound` and SHALL replace "None." with the rules of this spec, in the text approved by the human.
2. THE art direction Primary-action section SHALL state that the Sound_Toggle and the Ambience_Toggle are slips and never a Primary_Action, as approved by the human.
3. THE art direction Motion section SHALL state that sound is not motion and that the wind loop is not an ambient exemption, as approved by the human.
4. THE tech file SHALL state that all audio is synthesised with the Web Audio API and that no audio file, sample or audio library is allowed, as approved by the human.
5. THE README SHALL gain a "Sound" section covering the list of sounds, the defaults, the autoplay rule, the reduced-motion rule and the no-licence statement, and SHALL make no claim about the hardware silent switch.
6. THE steering test `tests/unit/steering-art-direction.test.ts` SHALL keep passing, and SHALL gain an assertion for each amended Sound rule.
7. THE steering files and THE README SHALL be edited only by implementation tasks, and `kiro-log.md` SHALL be edited only by the human.
8. THE art direction Moon section SHALL state the position of the Sound_Toggle, and THE structure file SHALL list the `audio/` folder, as approved by the human.

### Requirement 21: Tests

**User Story:** As a maintainer, I want every rule above checked by an automated test of the right kind.

#### Acceptance Criteria

1. THE unit tests of the Sound_Planner SHALL cover the voice limit, the per-group limit, the per-id limit, the spacing limits, drop-not-queue, outcome priority and the end-time bookkeeping, with fixed examples and without any property-based test.
2. THE unit tests of the Synth SHALL use the Audio_Mock and SHALL check every row of the recipe table (gain, frequency and duration bounds), the Master_Gain, the Limiter settings, the click-free envelope, the noise filter bounds and the fixed-seed noise.
3. THE unit tests of the Sound_Engine SHALL use the Audio_Mock and SHALL check lazy construction, no construction before a Gesture_Event, no construction while the Sound_Setting is off, `resume()` on the first Gesture_Event, suspend and resume on visibility change, every failure path of Requirement 11, the reduced-motion ambience (start, stop and live change) and listener removal on `dispose()`.
4. THE component tests of the Sound_Toggle SHALL check the name, `aria-pressed`, the `slip` class, the absence of `slip-primary`, the 44 px size class, the icon change, keyboard activation and that it is not rendered when Web_Audio_Available is false.
5. THE component tests of the Ambience_Toggle SHALL check the name, `aria-pressed`, the visible text, and the disabled states for sound off and for reduced motion.
6. THE component tests of the Summon step, the Write step and the Séance session SHALL check which Sound_Id each event requests, that no sound is requested for an ignored key or a rejected stroke, that outcome sounds are requested once per ghost, and that a throwing `play` changes neither the state nor the saved history.
7. THE storage tests SHALL check schema 4 defaults, the migration 3 to 4, the chain 2 to 4, repair of a bad sound field without losing history, rejection of a bad history, the new getters and setters, that `recordOutcome` keeps both settings, and a schema above 4.
8. THE Audio_File_Scan SHALL fail on any audio file extension or audio loading call of Requirement 18.
9. THE end-to-end tests SHALL use the Audio_Recorder and SHALL check: no AudioContext is constructed before the first Gesture_Event; one is constructed after the first click or key press when sound is on; none is constructed when the Sound_Setting is off; the Sound_Toggle flips and persists across a reload; the Ambience_Setting is off by default and no looping source starts; a Summon key press starts a source; no audio request is made.
10. THE end-to-end tests SHALL check that the Sound_Toggle has the same bounding box on every screen of Requirement 14.1 at 1024 x 768, 375 x 812 and 320 x 640, that it meets no Moon_Disc, control or text, and that the existing fit and overflow tests still pass at those viewports.
11. THE feature SHALL add no property-based test and no mutation testing, and every new test SHALL be a unit, component or end-to-end test.
12. WHEN the feature is complete, `npm test` SHALL pass and the end-to-end suite SHALL pass.

## Decisions approved by the human

The human approved the answer given with every open question, including the ones the design added. The design and the tasks follow these decisions.

- **Key tap:** an ignored key is silent; one tap recipe for every key; `key-wrong` fires for each counted miss only.
- **Ink:** one sweep per `animateStroke` call of an accepted key (never for the first-meeting forming); a rejected Write stroke is silent; the sweep also plays under reduced motion.
- **Seal and chimes:** the thud plays only for a clean outcome and the chime follows 180 ms later; struggled has the same fundamental, shorter, quieter, with no second partial; the gave-up tone is quiet and gentle (330 Hz down to 196 Hz, peak 0.06).
- **Night wind:** built, off by default even when sound is on, played only on the menu and the Graveyard and kept running between them; its toggle lives in the page content of the Graveyard only (the menu shows none) and is disabled with a visible note while sound is off or reduced motion is requested.
- **Toggle:** accessible name "Sound" with `aria-pressed`; not shown on the loading and error screens; turning sound on plays one confirming `key-tap`; hidden when Web Audio is missing.
- **Position:** 16 px left of the Moon_Disc below 992 px and 16 px below it from 992 px (supersedes "to the left of the Moon_Disc" at every width and the 8 px gap, Requirements 14.3 and 14.11).
- **Séance header:** the heading "Ghost n of N" moves into the step-label column at every width, as one element (Requirement 14.7).
- **Default and autoplay:** sound on by default, never before the first gesture; an old save (schema 3) gets sound on; the unlock events are `pointerdown`, `touchend`, `click` and `keydown`.
- **Persistence:** one blob in schema 4; a corrupt sound field is repaired on its own and the history is kept.
- **Reduced motion:** effect sounds stay on; a live change never clears the saved wind choice.
- **Failure and limits:** no retry after the constructor throws; at most 4 voices, 3 for keys and ink, 2 per id, 40 ms and 80 ms spacing, no voice stealing.
- **Bundle and tests:** the ceiling is 8,000 bytes gzip; the end-to-end checks use the recorder only; the audio-file scan covers `app/src` and `app/public`, not `app/dist`.
- **Departures from the first requirements, now amended in place:** the module path `app/src/audio/` (Requirement 1.6); the 300 ms resume window (Requirements 2.2 and 2.10); the sweep only for strokes inked by an accepted key (Requirement 5.1); the toggle position (Requirements 14.3 and 14.11).
- **Existing assertions:** the design's list of changed existing assertions is approved on the condition that no rewrite loosens a test.
- **README:** the sentence about the hardware silent switch is omitted, because no device check has been made yet.
- **`kiro-log.md`:** no task edits it; the human writes it.

## Steering amendments approved by the human

Each amendment is applied by an implementation task. The wording is in the design.

1. A1, approved by the human: `.kiro/steering/art-direction.md`, "## Sound": replace "None." with the Sound rules.
2. A2, approved by the human: `art-direction.md`, "Primary action per screen": the Sound_Toggle and the Ambience_Toggle are slips, never a Primary_Action.
3. A3, approved by the human: `art-direction.md`, "Motion": sound is not motion and the wind loop is not an ambient exemption.
4. A4, approved by the human: `art-direction.md`, "Moon, mist and seal placement": the Sound_Toggle position, including the 992 px split.
5. A5, approved by the human: `.kiro/steering/tech.md`, "Things to avoid": no audio files, samples, `Audio` elements or audio libraries.
6. A6, approved by the human: `.kiro/steering/structure.md`: the `audio/` line in the project tree.
7. `product.md` and `content-accuracy.md` stay unchanged. `.kiro/specs/ink-and-candlelight/requirements.md` line 355 stays as a record; this spec supersedes it for the app.
8. `README.md` gains a "Sound" section and the new bundle figures. Credits and `THIRD_PARTY_NOTICES.txt` stay unchanged.
9. `tests/unit/steering-art-direction.test.ts` gains an assertion for each amended rule, and `tests/unit/steering-tech.test.ts` and `tests/unit/steering-structure.test.ts` cover A5 and A6.
