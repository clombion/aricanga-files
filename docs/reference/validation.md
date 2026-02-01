# Validation Reference

Map of all linting, testing, and QA infrastructure.

---

## Quick Start

```bash
mise run check          # build + all linters (pre-commit)
mise run lint           # all linters only
mise run test           # all tests
mise run qa             # QA tools (coverage, guided, a11y, graph, heatmap, deps, tag audit)
```

---

## Linting Architecture

### Directory Layout

| Directory | Count | Scope |
|-----------|-------|-------|
| `utils/linting/source/` | 7 | JS/component source code |
| `utils/linting/repo/` | 15 | Repository structure and cross-cutting |
| `utils/linting/lib/` | 2 | Shared utilities (`ink-utils.js`, `remark-utils.js`) |
| `experiences/aricanga/utils/ink/` | 12 | Ink content and localization |
| `experiences/aricanga/utils/implementation/` | 4 | Implementation-specific code |

### Aggregate Commands

| Command | Scope | Includes |
|---------|-------|----------|
| `lint` | All linters | 25 tasks (ink, tags, CSS, DOM, imports, etc.) |
| `lint:boundaries` | Boundary safety (CQO 14–17) | events, ink-access, action-guards, component-params |
| `lint:code` | JS source (CQO 7, 12, 14, 15) | dom, globals, events, ink-access |
| `check` | Pre-commit gate | build + lint |

### Linter Index

#### Source Linters (`utils/linting/source/`)

| Linter | File | CQO | Command |
|--------|------|-----|---------|
| DOM mutations | `lint-dom.js` | CQO-7 | `lint:dom` |
| SVG accessibility | `lint-svg-a11y.js` | CQO-8 | `lint:svg-a11y` |
| Window globals | `lint-globals.js` | CQO-12 | `lint:globals` |
| Event factory usage | `lint-events.js` | CQO-14 | `lint:events` |
| Named imports | `lint-imports.js` | — | `lint:imports` |
| Component registration | `lint-component-registration.js` | — | `lint:component-registration` |
| Test skip rationale | `lint-test-skips.js` | CQO-19 | — |

#### Repo Linters (`utils/linting/repo/`)

| Linter | File | CQO | Command |
|--------|------|-----|---------|
| Barrel completeness | `lint-barrel-completeness.js` | — | `lint:barrel-completeness` |
| Doc link resolution | `lint-doc-links.js` | — | `lint:doc-links` |
| Doc–code consistency | `lint-doc-code-refs.js` | CQO-26 | `lint:doc-code-refs` |
| Event wiring | `lint-event-wiring.js` | — | `lint:event-wiring` |
| Export parity | `lint-export-parity.js` | — | `lint:export-parity` |
| External functions | `lint-external-functions.js` | CQO-27 | `lint:external-functions` |
| File structure | `lint-file-structure.js` | — | `lint:file-structure` |
| HTML imports | `lint-html-imports.js` | — | `lint:html-imports` |
| Import graph (cycles) | `lint-import-graph.js` | — | `lint:import-graph` |
| Path mapping | `lint-path-mapping.js` | — | `lint:path-mapping` |
| Seed freshness | `lint-seeds.js` | — | `lint:seeds` |
| Test assumptions | `lint-test-assumptions.js` | CQO-23/24 | `lint:test-assumptions` |
| Test parity | `lint-test-parity.js` | — | `lint:test-parity` |
| Test paths | `lint-test-paths.js` | — | `lint:test-paths` |
| Workspace resolution | `lint-workspace-resolution.js` | — | `lint:workspace-resolution` |

#### Ink Linters (`experiences/aricanga/utils/ink/`)

| Linter | File | CQO | Command |
|--------|------|-----|---------|
| Tag schema | `lint-tags.sh` | CQO-2 | `lint:tags` |
| Asset paths | `lint-image-paths.sh` | — | `lint:image-paths` |
| Ink comments | `lint-ink-comments.sh` | CQO-5 | `lint:ink-comments` |
| Time tag progression | `lint-time-tags.js` | CQO-13 | `lint:time-tags` |
| Current chat variable | `lint-current-chat.sh` | CQO-18 | `lint:current-chat` |
| Cross-chat deprecation | `lint-cross-chat.sh` | CQO-20 | `lint:cross-chat` |
| Config–ink mapping | `lint-config-ink.js` | — | `lint:config-ink` |
| Locale parity | `lint-locale-parity.js` | — | `lint:locale-parity` |
| i18n key parity | `lint-i18n-parity.js` | — | `lint:i18n-parity` |
| Glossary parity | `lint-glossary-parity.js` | — | `lint:glossary-parity` |
| Link preview deps | `lint-link-preview.js` | — | `lint:link-preview` |
| TOML validation | `lint-toml.js` | — | `lint:toml` |

#### Implementation Linters (`experiences/aricanga/utils/implementation/`)

| Linter | File | CQO | Command |
|--------|------|-----|---------|
| Typed ink access | `lint-ink-access.js` | CQO-15 | `lint:ink-access` |
| XState action guards | `lint-action-guards.js` | CQO-16 | `lint:action-guards` |
| Component param validation | `lint-component-params.js` | CQO-17 | `lint:component-params` |
| Hardcoded CSS colors | `lint-css.sh` | CQO-9 | `lint:css` |

#### Other Lint Commands

| Command | Description |
|---------|-------------|
| `lint:ink` | Compile all locale ink files (requires `IMPL`) |
| `lint:js` | Biome JS linting |
| `lint:tags:compiled` | Tag hygiene in compiled story (inkjs-based) |
| `lint:dead-code` | Unreachable ink content (runs `dead-code.test.ts`) |

---

## Test Architecture

### Configuration

| Config | Runner | Environment | Key Settings |
|--------|--------|-------------|--------------|
| `playwright.config.ts` | Playwright | Browser | 6 projects, 8 workers, 30s timeout, 5s expect |
| `vitest.config.ts` | Vitest | happy-dom | globals enabled |

### Playwright Projects

| Project | Device | Purpose |
|---------|--------|---------|
| `engine` | Desktop Chrome | Foundation tests |
| `implementation` | iPhone 14 | Experience-specific E2E |
| `quality` | Desktop Chrome | CQO/quality tests |
| `Mobile Safari` | iPhone 14 | Cross-browser |
| `Mobile Chrome` | Pixel 7 | Cross-browser |
| `Desktop Chrome` | Desktop Chrome | Cross-browser |

### Test Organization

| Category | Location | Runner | Purpose |
|----------|----------|--------|---------|
| Unit | `packages/tests/unit/` | Vitest | Pure logic (chunk helpers, event factories, etc.) |
| Foundation | `packages/tests/foundation/` | Vitest | Framework internals (context registry) |
| Systems | `packages/tests/systems/` | Vitest | System integrity, conversation context |
| Contract | `packages/tests/contract/` | Playwright | Component API contracts |
| Quality | `packages/tests/quality/` | Both | Architecture, accessibility, ink invariants |
| Impl unit | `experiences/aricanga/tests/unit/` | Vitest | Game state logic |
| Impl contract | `experiences/aricanga/tests/contract/` | Both | Analytics, choices, controller, i18n, ink writer |
| Impl E2E | `experiences/aricanga/tests/e2e/` | Playwright | Navigation, persistence, cross-chat, time coherence |

### Test Utilities (`packages/test-utils/`)

| Module | Exports | Purpose |
|--------|---------|---------|
| `fakes/` | `fake-event-bus`, `fake-runtime` | Stubs for isolation |
| `fixtures/` | `clock` | Time control for delay-heavy tests |
| `helpers/` | `locale-config`, `doc-parser`, `app-utils` | Common test setup |
| `pages/` | `chat-thread`, `chat-hub`, `notification`, `status-bar` | Page objects for Playwright |

### Commands

| Command | Description |
|---------|-------------|
| `test` | All tests |
| `test:unit` | Vitest unit tests |
| `test:e2e` | Playwright E2E |
| `test:engine` | Engine tests only (no game data) |
| `test:impl` | Implementation tests (requires game data) |
| `test:quality` | Quality/CQO tests |
| `test:e2e:ui` | Playwright with UI |
| `test:e2e:debug` | Debug Playwright |
| `test:e2e:mobile` | Mobile tests only |

---

## QA Tools

Writer-facing QA tools for narrative validation. See [QA Tools Reference](qa-tools.md) for full details.

| Command | Purpose |
|---------|---------|
| `qa` | Run all QA analysis |
| `qa:coverage` | Random agent for ink coverage |
| `qa:guided` | Guided agent for story progression |
| `qa:a11y` | CQO-8 accessibility tests (axe-core) |
| `ink:graph` | Narrative graph (DOT + SVG) |
| `ink:heatmap` | Coverage heatmap (DOT + SVG) |
| `ink:deps` | Cross-chat variable dependencies |

---

## Enforcement

### Pre-commit

`mise run check` — builds then runs all linters. Used as the pre-commit gate.

### Stop Hook

`.claude/hooks/end-of-turn.sh` runs after each agent turn with blocking enforcement (exit code 2):

| Check | CQO |
|-------|-----|
| Ink compilation (inklecate) | CQO-1 |
| Tag schema validation | CQO-2 |
| CSS variable enforcement | CQO-9 |

### Snapshot Linters

These linters compare current state against a saved snapshot. Used during restructuring to catch regressions:

| Linter | Snapshot Command | Compare Command |
|--------|-----------------|-----------------|
| Export parity | `lint:export-parity:snapshot` | `lint:export-parity` |
| Event wiring | `lint:event-wiring:snapshot` | `lint:event-wiring` |
| Test parity | `lint:test-parity:snapshot` | `lint:test-parity` |

---

## Related

- [CQO Reference](cqo.md) — full CQO definitions and rationale
- [Testing Reference](testing.md) — test patterns, time mocking, localStorage, page objects
- [Testing Guide](../guides/developers/testing.md) — E2E patterns and debugging
- [QA Tools Reference](qa-tools.md) — writer-facing QA tool details
