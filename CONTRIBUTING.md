# Contributing

## Task Runner

This project uses `mise`. Run tasks with `mise run <task>`.

Key tasks: `lint`, `dev`, `build`, `check`.

## Dev Environment

`mise run dev` starts all dev processes via [process-compose](https://f1bonacc1.github.io/process-compose/):

| Process | What it does |
|---------|-------------|
| `vite-app` | Vite dev server (port 8000) |
| `browser` | Chromium with remote debugging (port 9222, for MCP) |
| `compiler` | Watches and recompiles ink on change |

A `process-compose.local.yml` override file is gitignored for personal additions (e.g., backup jobs). If present, `mise run dev` merges it automatically.

## Branching

| Prefix | Use For |
|--------|---------|
| `feat/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring |

### Worktrees

If a branch for your work already exists, use a worktree instead of switching:

```bash
git worktree add ../<dir> <existing-branch>
```

Clean up after merge:

```bash
git worktree remove ../<dir>
```

## Merge Target

Merge directly to `main`. No PRs required.

```bash
git switch main
git pull origin main
git merge <your-branch>
git push origin main
git branch -d <your-branch>
```

## Remote

Push to `origin` after merge.

## Workflow

1. **Before implementation:** use `/planning` skill
2. **After implementation:** use `/done` checklist
