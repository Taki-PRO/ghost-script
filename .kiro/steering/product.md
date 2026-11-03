---
inclusion: always
---

# Product: Ghost Script

## One line
A haunted handwriting game that brings back the Chinese characters people have forgotten how to write, by teaching how each character is built, the Cangjie way.

## The problem
Many people can **read** Chinese but can no longer **write** it by hand, because they type everything with phonetic input on phones and laptops. This is known as character amnesia (提笔忘字). Existing apps drill handwriting by repetition; Ghost Script teaches the **structure** of each character.

## Who it is for
1. People who learned Chinese at school but have forgotten how to write characters (students, young adults).
2. Heritage learners (overseas Chinese families) who speak but cannot write.
3. Intermediate learners of Chinese who want to write, not just recognise.

## Hackathon context
- Built for **Kiroween 2026**, category **Resurrection**.
- The revived "dead technology" is handwriting itself plus the structural thinking of the **Cangjie input method** (invented 1976 by Chu Bong-Foo, named after Cangjie, the legendary inventor of Chinese writing).
- Theme: legend says ghosts wailed at night when Cangjie invented writing. In the game, forgotten characters are ghosts; writing them correctly lays them to rest.

## Core game loop
1. A ghost appears showing a character's **meaning** (English) and **pinyin**. The character itself is hidden.
2. The player recalls and produces the character:
   - **Write mode** (touchscreen / pencil): draw it stroke by stroke, each stroke checked live.
   - **Build mode** (laptop / mouse): pick the character's components in the right order and position from a set that includes decoys.
3. Wrong answers trigger **structure hints**: reveal one component at a time ("the left side is 女"), never just the full answer at first.
4. Correct: the character "comes back to life" in ink and the ghost is laid to rest.
5. **Haunting** (spaced repetition): characters the player struggled with return sooner; mastered ones return later.

## Scope

### Must-have (MVP, target: deployed by Nov 17)
- Simplified characters + Mandarin pinyin (default script).
- Write mode with live stroke checking.
- Build mode for laptops.
- Structure hints based on component breakdowns.
- Haunting engine (spaced repetition), progress saved locally in the browser.
- Nightly Séance: a short daily session (about 10 ghosts) drawn from about 300 checked characters.
- Legend intro screen. English interface.
- Cangjie Oracle MCP server (verified character-data lookups) + property-based tests.

### If time allows (strictly in this order, only after MVP is deployed and working)
1. Traditional character toggle.
2. Type mode: Cangjie keyboard input (traditional characters only).
3. Package the Cangjie Oracle as a Kiro Power.
4. Graveyard progress screen.
5. Exam Crypt mode using public learner exam lists (e.g. HSK).
6. Cantonese pronunciation.
7. Phone-as-pen (write on phone, appears on laptop; needs a realtime server).

### Out of scope
- User accounts, logins, cloud sync.
- Handwriting recognition beyond per-stroke checking.
- A full Chinese course or vocabulary/grammar teaching.
- Any paid service or API that costs money while judges use the app.

## Product principles
- **Works on every device.** iPad/phone get Write mode; laptops get Build mode. Never block a user for lacking a touchscreen.
- **Correctness over quantity.** 300 verified characters beat 3,000 unverified ones.
- **Teach structure, not just answers.** Hints reveal parts before the whole.
- **Spooky but calm.** Ink-wash, candlelight, quiet atmosphere. Never gory, never jump scares that interrupt learning.
- **Free and always available.** Static site, no backend for the MVP, so it costs nothing to run during judging.

## Claims and copy
Only state facts in the app or pitch that are verified and sourced. Do not invent statistics, exam requirements or historical claims.
