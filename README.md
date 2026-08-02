# Personal Projects

Personal side-projects workspace. Each project lives in its own top-level folder with independent
dependencies and configuration. Run commands from inside the project folder, not the repo root.

## Projects

| Project | Folder | Status | Stack |
|---------|--------|--------|-------|
| **MoneyIQ** — personal finance manager | [`expense-manager/`](./expense-manager/) | Production ([live](https://vikasreddykamalapuram.github.io/expense-manager/)) - Play Store onboarding | React 18 - TypeScript - Vite - Tailwind - Dexie - Capacitor |

## Structure

```
Personal_Projects/
├── .github/copilot-instructions.md   # Copilot rules for all personal projects
├── .github/workflows/                # CI: deploy, android build, e2e, price updates
├── .claude/agents/                   # Agents for Claude Code (mirror of agents/)
├── agents/                           # Canonical custom agents (Copilot CLI + others)
├── AGENTS.md                         # Cross-tool agent + convention guide
├── CONTRIBUTING.md                   # Branch naming + commit conventions
├── expense-manager/                  # MoneyIQ app
└── README.md                         # This file
```

## Custom agents (portable)

Reusable specialist agents work across **Copilot CLI**, **Claude Code**, **Antigravity**, **Cursor**,
and any machine (no hardcoded paths). See [`AGENTS.md`](./AGENTS.md).

| Agent | Purpose |
|-------|---------|
| `planner` | Feature decomposition & task planning |
| `coder` | Production TypeScript/React implementation |
| `tester` | Vitest + RTL tests |
| `reviewer` | Code review for bugs, perf, quality |
| `security-auditor` | XSS/CSRF/injection & data-handling audit |

## Conventions

- **Branches:** `vrk/<short-context>` — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **Commits:** Conventional Commits, author `vikasreddykamalapuram <vikasreddykamalapuram@gmail.com>`, no AI co-author trailer.
- **`master`** is always deployable (GitHub Pages + release tags).
