# AGENTS.md — Personal Projects workspace

Cross-tool agent + convention guide for this repository. Works with **GitHub Copilot CLI**,
**Claude Code**, **Google Antigravity**, **Cursor**, and any editor that reads `AGENTS.md`.

> This repo is a multi-project workspace. Each project lives in its own top-level folder with
> independent dependencies. Run commands from inside the relevant project folder, not the repo root.

## Projects

| Project | Folder | Stack |
|---------|--------|-------|
| MoneyIQ (personal finance) | `expense-manager/` | React 18 + TypeScript + Vite + Tailwind + Dexie + Capacitor |
| PABS Boutique (kids' e-commerce) | `boutique-app/` | Web e-commerce (see `Web_app_for_Boutique.txt` spec) |

## Custom agents

Reusable specialist agents live in **`agents/*.agent.md`** (canonical) and are mirrored to
**`.claude/agents/*.md`** for Claude Code auto-discovery. Each has YAML frontmatter (`name`,
`description`) and works unchanged across machines — no absolute paths.

| Agent | Use it for |
|-------|-----------|
| `planner` | Decompose a feature into ordered tasks with acceptance criteria |
| `coder` | Implement production TypeScript/React following conventions |
| `tester` | Write/maintain Vitest + React Testing Library tests |
| `reviewer` | Review a diff for bugs, perf, and quality |
| `security-auditor` | Audit for XSS/CSRF/injection and data-handling risks |

### How each tool discovers them
- **Claude Code** — reads `.claude/agents/*.md`; invoke with `@planner`, `@coder`, etc., or let it auto-route.
- **GitHub Copilot CLI** — reads `agents/*.agent.md`.
- **Google Antigravity / Cursor / others** — read this `AGENTS.md` plus the files in `agents/`. Point the tool's rules at `agents/` if it supports custom agent folders.
- **Any machine (Mac/Linux/Windows)** — the agents use repo-relative paths (`expense-manager/`), so they work after a plain `git clone` with no path edits.

## Global conventions (all projects)
- **Language:** TypeScript, strict mode, no `any` unless unavoidable.
- **React:** functional components, typed props, named exports; Tailwind utility-first.
- **Structure:** feature-based folders; data access via a repository/service layer, never raw `localStorage`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- **Commit author:** `vikasreddykamalapuram <vikasreddykamalapuram@gmail.com>` — no AI co-author trailer.
- **Branches:** `vrk/<short-context>` (e.g. `vrk/play-console-onboarding`). See `CONTRIBUTING.md`.
- **Tests:** Vitest + RTL; test behavior, not implementation. Run `npx vitest run` in the project folder.

## Common commands (run inside the project folder, e.g. `cd expense-manager`)
```bash
npm ci                 # install exact deps
npm run dev            # local dev server
npm run build          # production build (tsc -b && vite build)
npx vitest run         # unit tests
npm run lint           # eslint
```

## MoneyIQ — Play Store
Everything for Google Play onboarding is under `expense-manager/playstore/` and
`expense-manager/PLAY_STORE_PUBLISHING.md` (asset checklist, Data safety, IARC, feature graphic).
