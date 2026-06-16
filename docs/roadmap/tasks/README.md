# Tasks

Backlog.md-format task files (format convention only — no CLI). See
[`../TASK-TEMPLATE.md`](../TASK-TEMPLATE.md) and the Task format section in
[`../README.md`](../README.md).

IDs are globally sequential. **Next ID: `task-016`.**

## Phase 0 — Walking skeleton & toolchain

| ID | Title | Status | Depends on |
|----|-------|--------|------------|
| task-001 | Monorepo and TypeScript project-reference scaffolding | To Do | — |
| task-002 | Vite build and dev pipeline | To Do | 001 |
| task-003 | Lit component baseline | To Do | 001, 002 |
| task-004 | Vitest unit-test harness | To Do | 001 |
| task-005 | Module boundary lint | To Do | 001 |
| task-006 | CI workflow (typecheck, lint, test, build) | To Do | 001, 002, 004, 005 |
| task-007 | Walking skeleton — ink → kernel stub → Lit render | To Do | 001–006 |

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
| task-012 | Composition root | To Do | 011 |
| task-013 | Chat system stub | To Do | 011 |
| task-014 | Cards system stub | To Do | 011 |
| task-015 | Two-vocabulary proof | To Do | 012, 013, 014 |

Suggested order: **008 → (009, 010) → 011 → (012, 013, 014) → 015**.
task-015 is the integrating proof for the phase.
