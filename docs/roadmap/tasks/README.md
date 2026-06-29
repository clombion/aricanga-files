# Tasks

Backlog.md-format task files (format convention only — no CLI). See
[`../TASK-TEMPLATE.md`](../TASK-TEMPLATE.md) and the Task format section in
[`../README.md`](../README.md).

IDs are globally sequential. **Next ID: `task-063`.**

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
| task-008 | Kernel and snapshot contracts | Done | 001 |
| task-009 | Open effect channel | Done | 008 |
| task-010 | Single event bus and DomainEvent envelope | Done | 008 |
| task-011 | System interface | Done | 008, 009, 010 |
| task-016 | Multi-system router contract | Done | 008, 011 |
| task-012 | Composition root | Done | 011, 016 |
| task-013 | Chat system stub | Done | 011 |
| task-014 | Cards system stub | Done | 011 |
| task-015 | Two-vocabulary proof | Done | 012, 013, 014, 016 |

Suggested order: **008 → (009, 010) → 011 → 016 → (012, 013, 014) → 015**.
task-015 is the integrating proof for the phase.

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
| task-021 | Deferred queue and emergent notifications | To Do | 020 |
| task-022 | HWM read cursors and unread separator | To Do | 021 |
| task-023 | Forward-only time coherence | To Do | 017, 018 |
| task-024 | Read receipts | To Do | 020 |
| task-025 | Seeds | To Do | 020 |
| task-026 | Message grouping derivation | To Do | 020 |
| task-027 | Golden replay of Aricanga (phase proof) | To Do | 020–026 |

Suggested order: **040 → 041 → 062 → 017 → 018 → 019 → 020 → 021 → 022 → (023, 024, 025, 026) → 027**.
task-040/041 establish the generic algebra + runtime, task-062 migrates the
merged Phase 1 foundation onto them, and task-027 is the phase proof.

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

## Phase 4 — Build pipeline & config

Epic: [`../phase-4-build-pipeline.md`](../phase-4-build-pipeline.md). The build emits the host-injected world (story, seeds, i18n/data fixtures, validated config).

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-042 | Config schema (Zod) — single source of truth | To Do | — |
| task-043 | Per-locale ink compile to JSON | To Do | 042 |
| task-044 | Seed extraction → `Lifecycle(Init)` payload | To Do | 043 |
| task-045 | i18n/data fixtures (host-injected `name`/`data`, locale-pinned) | To Do | 042 |
| task-046 | Image optimization + content-hashed artifacts | To Do | — |
| task-047 | Retire parity linters in favour of the schema; wire CI | To Do | 042–046 |

## Phase 5 — Desktop chat experience

Epic: [`../phase-5-desktop-chat.md`](../phase-5-desktop-chat.md). Same chat algebra, different shell (seam by subtraction).

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-048 | Desktop host shell + effect executor | To Do | Phase 3, 4 |
| task-049 | Desktop view components | To Do | 048 |
| task-050 | Desktop experience composition + minimal story | To Do | 048, 049 |
| task-051 | Shell-independence proof | To Do | 050 |

## Phase 6 — Cards-on-phone experience

Epic: [`../phase-6-cards-on-phone.md`](../phase-6-cards-on-phone.md). A second closed algebra on one runtime (seam by recombination).

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-052 | Cards `Input`/`Effect` algebra + completeness check | To Do | Phase 3, 4 |
| task-053 | Cards `reduce` + `view` (pure) | To Do | 052 |
| task-054 | Cards content (thin deck, two stats) | To Do | 052 |
| task-055 | Cards view components + phone composition | To Do | 053, 054 |
| task-056 | Vocabulary-agnostic proof (zero foundation edits) | To Do | 055 |

## Phase 7 — Hardening & standing guards

Epic: [`../phase-7-hardening.md`](../phase-7-hardening.md). Make the algebra's guarantees standing CI gates; retire the reference.

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-057 | Standing CI guards (exhaustiveness, purity, determinism, boundary, a11y) | To Do | Phases 5, 6 |
| task-058 | Event-sourced analytics over the `Effect` stream | To Do | — |
| task-059 | Save snapshot versioning + migrations | To Do | — |
| task-060 | Docs consolidation to the algebra contract | To Do | — |
| task-061 | Delete the POC reference branch | To Do | all |
