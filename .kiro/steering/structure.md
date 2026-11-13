---
inclusion: always
---

# Project structure

```
ghost-script/
├── .kiro/
│   ├── steering/        # product, tech, structure, content-accuracy rules
│   ├── specs/           # one folder per feature spec (requirements.md, design.md, tasks.md)
│   └── hooks/           # agent hooks (JSON)
├── app/                 # the web app (React + Vite)
│   ├── public/
│   │   └── data/        # generated characters.json used by the app (do not hand-edit)
│   └── src/
│       ├── engine/      # pure game logic: scheduler (haunting), scoring, hints, session builder
│       ├── components/  # React UI components
│       ├── modes/       # WriteMode, CangjieMode
│       ├── data/        # typed loaders for characters.json
│       ├── storage/     # localStorage wrapper
│       └── styles/
├── data/
│   ├── raw/             # downloaded source datasets (keep their licence files next to them)
│   └── character-list.txt  # the chosen ~300 characters, one per line
├── scripts/             # data pipeline: build characters.json from data/raw + character-list.txt
├── oracle/              # Cangjie Oracle MCP server (TypeScript)
├── tests/               # cross-cutting and property-based tests for the dataset
├── kiro-log.md          # running log of how Kiro was used (source for the write-up)
├── README.md
└── LICENSE              # MIT (code). Data keeps its own licences, see README.
```

## Rules
- Generated files (`app/public/data/characters.json`) are produced only by `scripts/` and never edited by hand.
- Raw data in `data/raw/` keeps its original licence file alongside it.
- New features get a spec in `.kiro/specs/<feature-name>/` before implementation.
- Keep `kiro-log.md` updated whenever a Kiro feature is used or a decision about Kiro usage is made.
