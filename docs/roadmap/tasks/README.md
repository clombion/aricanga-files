# Tasks (closed)

The task records of work finished before the project moved to
[GitHub Issues](https://github.com/clombion/aricanga-files/issues). Open work,
including the rest of each phase below, is tracked there; see
[`../issues.md`](../issues.md).

## Phase 0 — Walking skeleton & toolchain

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-001 | Monorepo and TypeScript project-reference scaffolding | Done | — |
| task-002 | Vite build and dev pipeline | Done | 001 |
| task-004 | Vitest unit-test harness | Done | 001 |
| task-005 | Module boundary lint | Done | 001 |
| task-006 | CI workflow (typecheck, lint, test, build) | Done | 001, 002, 004, 005 |
| task-007 | Walking skeleton — ink → kernel stub → render | Done | 001–006 |


## Phase 1 — Foundation contracts

Design: [`../phase-1-foundation-design.md`](../phase-1-foundation-design.md) ·
Decisions: [`../decisions/`](../decisions/)

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-008 | Kernel and snapshot contracts | Done | 001 |
| task-009 | Open effect channel | Done | 008 |
| task-010 | Single event bus and DomainEvent envelope | Done | 008 |
| task-011 | System interface | Done | 008, 009, 010 |
| task-016 | Multi-system router contract | Done | 008, 011 |
| task-012 | Composition root | Done | 011, 016 |
| task-013 | Chat system stub | Done | 011 |
| task-014 | Cards system stub | Done | 011 |
| task-015 | Two-vocabulary proof | Done | 012, 013, 014, 016 |


## Phase 2 — Chat simulation kernel (headless)

Epic: [`../phase-2-kernel.md`](../phase-2-kernel.md) · Strategy:
[`../testing-strategy.md`](../testing-strategy.md). TDD-led: the harness and the
invariant/regression suites come first (red), then the physics slices to green.

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-040 | Foundation algebra contract | Done | — |
| task-041 | Generic Sans-IO host runtime | Done | 040 |
| task-062 | Reshape the merged Phase 1 foundation to the algebra | Done | 040, 041 |
| task-017 | Kernel test harness and fixtures | Done | 040, 041, 062 |
| task-018 | Simulation-physics invariant suite (property-based) | Done | 017 |
| task-019 | BUG-HISTORY regression suite | Done | 017, 018 |
| task-020 | Message routing and targetChat | Done | 017, 018 |
| task-021 | Deferred queue and emergent notifications | Done | 020 |
| task-022 | HWM read cursors and unread separator | Done | 021 |
| task-023 | Forward-only time coherence | Done | 017, 018 |

