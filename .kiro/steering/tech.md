---
inclusion: always
---

# Tech stack and conventions

## Stack
- **Language:** TypeScript everywhere (app, scripts, MCP server). `strict: true`.
- **App:** React + Vite, single-page web app. No backend for the MVP.
- **Styling:** Tailwind CSS.
- **Handwriting:** `hanzi-writer` (MIT) with stroke data from `hanzi-writer-data` (Arphic Public License). Use its quiz mode for live per-stroke checking.
- **Input:** Pointer Events so finger, Apple Pencil, mouse and trackpad all work. Pages must be usable with touch and with mouse/keyboard.
- **Storage:** `localStorage` (wrapped in a small storage module with try/catch). No accounts, no server.
- **Testing:** Vitest for unit tests, **fast-check** for property-based tests.
- **Data pipeline:** Node + TypeScript scripts in `scripts/` that build one JSON dataset from the raw sources. The app never calls external APIs at runtime.
- **MCP server (Cangjie Oracle):** TypeScript, `@modelcontextprotocol/sdk`, stdio transport, reads the same generated dataset.
- **Hosting:** a free static host (Vercel, Netlify or GitHub Pages). Must stay free and online until Jan 29, 2027 (end of judging).
- **Fonts:** open-licensed only (e.g. Noto Sans SC / Noto Serif SC; a brush-style font under the SIL Open Font License). Record each font's licence in the README.

## Device targets
- iPad Safari (with Apple Pencil) and iPhone/Android browsers: Write mode is primary.
- Laptop Chrome/Safari/Edge with mouse or trackpad: Build mode is primary.
- Layout must be responsive from 375px wide phones to 1440px+ laptops.

## Code conventions
- Small, pure functions for game logic (scheduling, scoring, hint selection) so they are easy to property-test.
- Keep UI components separate from game logic: logic in `src/engine/`, UI in `src/components/`.
- No `any` unless unavoidable; prefer explicit types for character data.
- Every engine module has tests; every invariant worth stating gets a property-based test.
- Accessibility: buttons have labels, colour is never the only signal, text meets contrast guidelines on the dark theme.

## Testing rules
- Run `npm test` before committing.
- Property-based tests must cover at least:
  - the haunting scheduler (e.g. a missed character is never scheduled later than the same character answered correctly; intervals are never negative);
  - the character dataset (see `content-accuracy.md`).

## Things to avoid
- Paid APIs, API keys in the frontend, or any runtime LLM calls in the shipped app.
- Generating character data (components, pinyin, meanings, stroke order, Cangjie codes) with an AI model. All character data comes from the data pipeline.
- Adding `.kiro/` to `.gitignore`. It must stay in the repo for judging.
