# Requirements Document

## Introduction

The github-pages-deploy feature publishes Ghost Script as a free static site on GitHub Pages at `https://taki-pro.github.io/ghost-script/` (repository `https://github.com/Taki-PRO/ghost-script`, branch `main`). It adds a GitHub Actions workflow that tests, builds and deploys the app, sets the Vite production base, adds an original favicon, aligns the legend wording on "wept", and documents how to play and run the app. No game behaviour changes. Deployment itself (pushing to `main`, enabling Pages) is a human action.

## Glossary

- **Deploy_Workflow**: The GitHub Actions workflow at `.github/workflows/deploy.yml`.
- **App**: The React + Vite single-page app in `app/`, built with `npm run build -w app` into `app/dist`.
- **Production_Build**: A Vite build run with the `build` command.
- **Pages_Site**: The GitHub Pages site served under `/ghost-script/`.
- **Favicon**: The SVG icon at `app/public/favicon.svg`.
- **Legend_Wording**: The English text saying that legend says ghosts "wept" when writing was invented.
- **Dictionary_Data**: CC-CEDICT source data and the tests/fixtures that quote it (including the word "wail" in the entry for 号).
- **README**: The repository file `README.md`.

## Requirements

### Requirement 1: Test, build and deploy workflow

**User Story:** As a maintainer, I want every push to `main` tested, built and deployed automatically, so that the Pages_Site always shows a passing build.

#### Acceptance Criteria

1. WHEN a commit is pushed to `main` or a maintainer starts `workflow_dispatch`, THE Deploy_Workflow SHALL run checkout, Node 22 setup with the npm cache, `npm ci`, the root `npm test`, `npm run build -w app`, upload of `app/dist` as a Pages artifact, and deployment to GitHub Pages in that order.
2. IF any Deploy_Workflow step fails, including any test, THEN THE Deploy_Workflow SHALL skip deployment.
3. THE Deploy_Workflow SHALL request only the permissions `contents: read`, `pages: write` and `id-token: write`.
4. THE Deploy_Workflow SHALL use a `concurrency` group that leaves an in-progress deployment running.

### Requirement 2: Production base path

**User Story:** As a player, I want the deployed app to load all its files, so that the game works under the `/ghost-script/` sub-path.

#### Acceptance Criteria

1. WHEN a Production_Build runs, THE App SHALL use the Vite `base` value `/ghost-script/`.
2. WHILE the App runs under the Vite dev server or the test runner, THE App SHALL use the Vite `base` value `/`.
3. WHEN a Production_Build completes, THE App SHALL reference its script, style, favicon and dataset URLs under `/ghost-script/`.

### Requirement 3: Favicon

**User Story:** As a player, I want a ghost icon in the browser tab, so that the game is recognisable.

#### Acceptance Criteria

1. THE Favicon SHALL be an original SVG ghost shape drawn from basic paths, without copyrighted art.
2. THE App SHALL link the Favicon from `app/index.html` so that the link resolves under the production base.

### Requirement 4: Legend wording

**User Story:** As a maintainer, I want one consistent legend wording, so that the app, tests and specs agree.

#### Acceptance Criteria

1. THE App SHALL use the Legend_Wording "wept" in app code, app tests, the ghost-game-core spec text and the legend line of `.kiro/steering/product.md`, with no use of "wailed" or "wailing" in those places.
2. THE IntroScreen test SHALL accept only the wording "wept" for the legend line.
3. THE Dictionary_Data SHALL remain unchanged.

### Requirement 5: README guidance

**User Story:** As a visitor, I want to find the live game and local run steps, so that I can play or develop it.

#### Acceptance Criteria

1. THE README SHALL contain a "Play it" section linking `https://taki-pro.github.io/ghost-script/`.
2. THE README SHALL contain a "Run it locally" section giving `npm install` at the repository root followed by `npm run dev -w app`, with a note to omit `--host` so the dev server stays on localhost only.
3. THE README SHALL state the one-time repository setting Settings → Pages → Source: "GitHub Actions".

### Requirement 6: No regressions

**User Story:** As a maintainer, I want the existing checks to keep passing, so that deployment changes do not break the game.

#### Acceptance Criteria

1. WHEN the root `npm test` runs, THE test suite SHALL pass.
2. WHEN `tsc` runs for the root and for `app/`, THE type check SHALL pass.
3. WHEN `npm run build -w app` runs, THE build SHALL succeed.
