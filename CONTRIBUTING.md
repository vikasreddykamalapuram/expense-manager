# Contributing

## Branch naming convention

Use **`vrk/<short-context>`** (preferred) or **`vikasreddykamalapuram/<short-context>`**.

- ✅ `vrk/play-console-onboarding`
- ✅ `vrk/moneyiq-rebrand`
- ✅ `vikasreddykamalapuram/boutique-checkout`
- ❌ `v-vikaska-microsoft-...` (do **not** use the managed/EMU username prefix)
- ❌ raw generated names like `fluffy-fortnight`

`<short-context>` is a kebab-case summary of the work (2–5 words). Keep it descriptive.

> Note: some agent/IDE environments auto-generate a branch name prefixed with a managed
> account id. When that happens, rename the branch to the `vrk/...` form before opening a PR
> (or create the branch manually with `git switch -c vrk/<context>`).

## Commits
- Follow **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Author identity: `vikasreddykamalapuram <vikasreddykamalapuram@gmail.com>`.
- Do **not** add `Co-authored-by: Copilot` (or any AI co-author) trailers.

```bash
git config user.name  "vikasreddykamalapuram"
git config user.email "vikasreddykamalapuram@gmail.com"
```

## Workflow
1. Branch from `master`: `git switch -c vrk/<context>`.
2. Work inside the relevant project folder (`expense-manager/`, `boutique-app/`).
3. Validate before pushing: `npm run lint && npx tsc -b && npx vitest run`.
4. Open a PR into `master`. `master` is always deployable (GitHub Pages + release tags).

## Agents
Specialist agents (`planner`, `coder`, `tester`, `reviewer`, `security-auditor`) live in
`agents/` and `.claude/agents/`. See [`AGENTS.md`](./AGENTS.md) for how each tool discovers them.
