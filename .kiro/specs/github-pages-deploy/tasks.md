# Implementation Plan: github-pages-deploy

## Overview

Prepare Ghost Script for GitHub Pages: production base path and favicon, consistent "wept" wording, a test-gated deploy workflow, and README guidance, then verify everything together. Deployment itself (pushing to `main`, enabling Pages) is a human action and not a task.

## Tasks

- [x] 1. Vite production base and favicon
  - Set `base: command === 'build' ? '/ghost-script/' : '/'` in `app/vite.config.ts`
  - Create `app/public/favicon.svg` (original ghost shape from basic paths)
  - Add `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` to `app/index.html`
  - Verify a build puts `/ghost-script/` on asset URLs and the favicon link in `app/dist/index.html`
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

- [x] 2. Align legend wording on "wept"
  - Update the IntroScreen test name and regex in `app/src/components/IntroScreen.test.tsx` to accept only "wept"
  - Update the legend text in `.kiro/specs/ghost-game-core/requirements.md`, `design.md` and `tasks.md`, and the legend line in `.kiro/steering/product.md`
  - Leave Dictionary_Data and the tests/fixtures that quote it unchanged
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Deploy workflow and CI prerequisites
  - Create `.github/workflows/deploy.yml` with jobs `build` and `deploy` as described in the design
  - Check that the root `package-lock.json`, `data/raw/`, `data/character-list.txt`, `data/prompt-overrides.csv` and `app/public/data/characters.json` are tracked by git; report any gap instead of committing it
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. README sections
  - Add a "Play it" section linking `https://taki-pro.github.io/ghost-script/`
  - Add a "Run it locally" section (`npm install` at the root, `npm run dev -w app`, never use `--host`)
  - State the one-time setting Settings → Pages → Source: "GitHub Actions"
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. Checkpoint - Verify the whole change
  - Run the root `npm test`, `tsc` for root and `app/`, and `npm run build -w app`
  - Inspect `app/dist` for base paths, the favicon link and `data/characters.json`
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 6.1, 6.2, 6.3_

## Notes

- No optional tasks: every task is required.
- Tasks 1 to 4 edit different files and can run in parallel; task 5 runs last.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3", "4"] },
    { "id": 1, "tasks": ["5"] }
  ]
}
```
