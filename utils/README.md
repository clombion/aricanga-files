# Utils & Task Reference

This folder contains build scripts, linters, and analysis tools. Use `mise` to run tasks.

## Quick Reference

| Audience | Command | What it does |
|----------|---------|--------------|
| Writers | `mise qa` | Coverage, graphs, accessibility, tag validation |
| Writers | `mise play` | Play story in terminal |
| Developers | `mise test` | Unit + E2E tests |
| Developers | `mise lint` | All linters |
| Everyone | `mise build` | Compile ink + generate config |
| Everyone | `mise check` | Build + lint (pre-commit) |

## Task Categories

### Build (`mise build`)
- `build:config` - Generate config.js from TOML
- `build:ink` - Compile ink files for all locales
- `build:test-expectations` - Generate test fixtures

### QA (`mise qa`) - For Writers
- `qa:coverage` - Random agent coverage analysis
- `qa:guided` - Guided story progression check
- `qa:a11y` - Accessibility tests
- `ink:graph` - Narrative structure visualization
- `ink:heatmap` - Coverage heatmap
- `ink:deps` - Cross-chat variable dependencies
- `lint:tags:compiled` - Tag hygiene in compiled story

### Testing (`mise test`) - For Developers
- `test:unit` - Vitest unit tests
- `test:e2e` - Playwright E2E tests
- `test:e2e:ui` - Playwright with interactive UI
- `test:e2e:debug` - Playwright debugger

### Linting (`mise lint`)
- `lint:ink` - Ink compilation warnings
- `lint:tags` - Tag schema validation (source)
- `lint:js` - Biome JavaScript linting
- `lint:code` - JS CQO checks (dom, globals, events, ink-access)
- `lint:boundaries` - Boundary safety (CQO 14-17)

### Translation (`mise tl:*`)
- `tl` - Extract strings for translation
- `tl:import` - Import translated strings
- `tl:status` - Translation progress
- `tl:validate` - Validate translation file

## Common Workflows

### Writer: Check story quality
```bash
mise qa              # Full QA suite
mise play            # Quick terminal playthrough
LOCALE=fr mise play  # Play in French
```

### Developer: Pre-commit
```bash
mise check           # Build + all linters
mise test            # Run tests
```

### Developer: Debug failing test
```bash
mise test:e2e:debug  # Step through in browser
mise test:e2e:ui     # Interactive test runner
```

## Folder Structure

```
utils/
├── build/          # Config and test fixture generation
├── linting/        # Static analysis scripts
├── qa/             # Coverage and visualization tools
├── translation/    # i18n CLI and commands
├── lib/            # Shared utilities
├── bin/            # inklecate binary
└── analytics-collector/  # Optional demo analytics server
```

## Biome Configuration Notes

The `biome.json` file has specific rules disabled for project-specific reasons:

| Rule | Setting | Reason |
|------|---------|--------|
| `noConsole` | `off` | Debug panel uses console for state inspection |
| `noUnusedFunctionParameters` | `off` | Callback signatures require unused params (e.g., event handlers) |
| `noAssignInExpressions` | `off` | Pattern `while (x = getNext())` is common in ink parsing |
| `noEmptyBlockStatements` | `off` | Sometimes needed for intentional no-ops |
| `noForEach` | `off` | forEach is readable for side-effect loops |
| `noExplicitAny` | `off` | JSDoc types don't always have precise types available |

## Prerequisites

Run `mise setup:check` to verify:
- `inklecate` - Ink compiler
- `mise` - Task runner
- `node` - Node.js runtime
