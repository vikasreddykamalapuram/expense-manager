# Personal Projects

Personal side projects workspace. Each project lives in its own directory with independent dependencies and configuration.

## Projects

| Project | Status | Tech Stack |
|---------|--------|------------|
| [Expense Manager](./expense-manager/) | 🚧 In Development | React, TypeScript, Tailwind CSS |

## Structure

```
Personal_Projects/
├── .github/copilot-instructions.md   # Copilot rules for all personal projects
├── agents/                            # Custom Copilot agents
│   ├── planner.agent.md              # Feature decomposition & task planning
│   ├── coder.agent.md                # Production code implementation
│   ├── tester.agent.md               # Test writing & quality assurance
│   └── reviewer.agent.md             # Code review & quality checks
├── expense-manager/                   # Expense Manager web app
└── README.md                          # This file
```

## Custom Agents

| Agent | Purpose |
|-------|---------|
| `planner` | Breaks features into tasks with acceptance criteria |
| `coder` | Writes production-ready TypeScript/React code |
| `tester` | Writes meaningful tests using Vitest + RTL |
| `reviewer` | Reviews code for bugs, performance, and quality |
