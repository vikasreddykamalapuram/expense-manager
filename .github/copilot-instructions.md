# Personal Projects — Copilot Instructions

## Scope
This workspace contains personal side projects, completely separate from official Microsoft work (MCH/HDS/HARS). All projects live under `D:\Repos\Personal_Projects\`.

## Projects
| Project | Directory | Status |
|---------|-----------|--------|
| Expense Manager | `expense-manager/` | Active |

## General Rules
- Use TypeScript for all projects unless explicitly stated otherwise
- Follow feature-based directory structure within each project
- Write production-ready code: proper error handling, accessibility, type safety
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Keep dependencies minimal and well-justified
- All components should be functional (React hooks, no class components)
- Prefer composition over inheritance
- Write self-documenting code; add comments only for non-obvious logic

## Code Style
- **TypeScript:** strict mode, no `any` unless absolutely necessary
- **React:** functional components, named exports, props interfaces
- **CSS:** Tailwind CSS utility-first, extract components for repeated patterns
- **Naming:** PascalCase for components, camelCase for functions/variables, UPPER_SNAKE for constants
- **Files:** one component per file, index.ts for barrel exports

## Custom Agents
Specialized agents are available in the `agents/` directory:
- **planner** — breaks down features into tasks, creates implementation plans
- **coder** — writes production code following project conventions
- **tester** — writes and runs tests, validates coverage
- **reviewer** — reviews code for quality, patterns, and potential issues

## Testing
- Unit tests with Vitest + React Testing Library
- Test files co-located with source: `Component.test.tsx`
- Aim for meaningful coverage, not 100% line coverage
- Test behavior, not implementation details

## Git Workflow
- `main` branch is always deployable
- Feature branches: `feature/<name>`
- Bug fixes: `fix/<name>`
- Always commit with descriptive messages
