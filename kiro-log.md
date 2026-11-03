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

---

## Template for new entries

## [Date]: [Short title]

- **What I did:**
- **Kiro feature:**
- **Why:**
- **Result:**
