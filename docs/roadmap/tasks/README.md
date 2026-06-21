# Tasks

Backlog.md-format task files (format convention only — no CLI). See
[`../TASK-TEMPLATE.md`](../TASK-TEMPLATE.md) and the Task format section in
[`../README.md`](../README.md).

IDs are globally sequential. **Next ID: `task-040`.**

Every task carries a `## Tests` section tagging its tests by the
[test taxonomy](../testing-strategy.md); we work test-first (ADR-0006).

## Phase 0 — Walking skeleton & toolchain

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-001 | Monorepo and TypeScript project-reference scaffolding | Done | — |
| task-002 | Vite build and dev pipeline | Done | 001 |
| task-003 | Lit component baseline | Done | 001, 002 |
| task-004 | Vitest unit-test harness | Done | 001 |
| task-005 | Module boundary lint | Done | 001 |
| task-006 | CI workflow (typecheck, lint, test, build) | Done | 001, 002, 004, 005 |
| task-007 | Walking skeleton — ink → kernel stub → Lit render | Done | 001–006 |

Suggested order: **001 → (002, 004, 005 in parallel) → 003 → 006 → 007**.
task-007 is the integrating proof for the phase.

## Phase 1 — Foundation contracts

Design: [`../phase-1-foundation-design.md`](../phase-1-foundation-design.md) ·
Decisions: [`../decisions/`](../decisions/)

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-008 | Kernel and snapshot contracts | To Do | 001 |
| task-009 | Open effect channel | To Do | 008 |
| task-010 | Single event bus and DomainEvent envelope | To Do | 008 |
| task-011 | System interface | To Do | 008, 009, 010 |
| task-016 | Multi-system router contract | To Do | 008, 011 |
| task-012 | Composition root | To Do | 011, 016 |
| task-013 | Chat system stub | To Do | 011 |
| task-014 | Cards system stub | To Do | 011 |
| task-015 | Two-vocabulary proof | To Do | 012, 013, 014, 016 |

Suggested order: **008 → (009, 010) → 011 → 016 → (012, 013, 014) → 015**.
task-015 is the integrating proof for the phase.

## Phase 2 — Chat simulation kernel (headless)

Epic: [`../phase-2-kernel.md`](../phase-2-kernel.md) · Strategy:
[`../testing-strategy.md`](../testing-strategy.md). TDD-led: the harness and the
invariant/regression suites come first (red), then the physics slices to green.

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-017 | Kernel test harness and fixtures | To Do | 004, 008, 011 |
| task-018 | Simulation-physics invariant suite (property-based) | To Do | 017 |
| task-019 | BUG-HISTORY regression suite | To Do | 017 |
| task-020 | Message routing and targetChat | To Do | 017, 018 |
| task-021 | Deferred queue and emergent notifications | To Do | 020 |
| task-022 | HWM read cursors and unread separator | To Do | 021 |
| task-023 | Forward-only time coherence | To Do | 017, 018 |
| task-024 | Read receipts | To Do | 020 |
| task-025 | Seeds | To Do | 020 |
| task-026 | Message grouping derivation | To Do | 020 |
| task-027 | Golden replay of Aricanga (phase proof) | To Do | 020–026 |

Suggested order: **017 → 018 → 019 → 020 → 021 → 022 → (023, 024, 025, 026) → 027**.
task-027 is the integrating proof for the phase.

## Phase 3 — Chat + phone view layer (Lit)

Epic: [`../phase-3-view-layer.md`](../phase-3-view-layer.md). TDD-led: backbone +
a11y harness first, then components (axe baked into each), then the a11y sweep and
the Aricanga parity proof.

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-028 | View-model contracts and UI host render loop | To Do | 003, 011, 012 |
| task-029 | Component and a11y test harness | To Do | 004, 028 |
| task-030 | chat-thread and message rendering | To Do | 028, 029 |
| task-031 | Rich message bubbles | To Do | 030 |
| task-032 | Receipts, typing, and choice buttons | To Do | 030 |
| task-033 | chat-hub | To Do | 028, 029 |
| task-034 | Notifications view (drawer + popup) | To Do | 028, 029 |
| task-035 | systems/phone — status bar, home indicator, overlay | To Do | 028, 029 |
| task-036 | Lock screen and battery context | To Do | 035 |
| task-037 | Navigation and view transitions | To Do | 030, 033 |
| task-038 | Accessibility acceptance sweep | To Do | 030–037 |
| task-039 | Aricanga view parity (phase proof) | To Do | 030–038 |

Suggested order: **028 → 029 → 030 → (031, 032, 033, 034, 035) → 036 → 037 → 038 → 039**.
task-039 is the integrating proof for the phase.
