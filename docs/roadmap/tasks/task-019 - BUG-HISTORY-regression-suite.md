---
id: task-019
title: BUG-HISTORY regression suite
status: To Do
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-28
labels: [chat, foundation, testing, phase-2]
milestone: "Phase 2 — Chat system kernel"
dependencies: [task-017, task-018]
parent_task_id:
---

## Description

A disposition audit with teeth, not a port-every-bug suite. Every historical bug
in `docs/agents/BUG-HISTORY.md` stays dead through the rewrite one of two ways:
**by construction** (the new pure-synchronous-reducer / effects-as-data / single-state
design makes the bug's *mechanism* impossible — most entries), or **by a regression
fixture** (the bug's *decision rule* relocated into `reduce` and could re-break — a
few). The deliverable is a machine-checked ledger routing every entry to its correct
home plus the positive fixtures for the genuine kernel-physics regressions.

The classification of all 32 entries (13 `BUG-NNN` + 19 legacy date-based):
~4 kernel-physics (decision relocated into the reducer), the rest structurally
eliminated, deferred (save migrations → task-059), or routed to Phase 3 (view) /
Phase 4 (build). "Architecture-eliminated" means the *mechanism* is structurally
absent — not "different now" and not "deferred"; those are separate dispositions.

## Acceptance Criteria

- [ ] #1 A typed manifest dispositions every BUG-HISTORY entry (each `BUG-NNN` + each of the 19 legacy date-based entries, assigned a stable id) as one of: `kernel-physics` | `structurally-eliminated` | `deferred → <task>` | `view → Phase 3` | `build → Phase 4`, with a one-line rationale
- [ ] #2 A meta-test enforces coverage: every `BUG-NNN:` header in the ledger appears in the manifest, the legacy-id set is frozen (count 19), and an untriaged future `BUG-NNN` fails CI
- [ ] #3 Each `kernel-physics` bug has a named positive fixture (a recorded `Input` stream) plus the predicate it asserts and its consuming physics task; the routing historical scenario is green now and asserts only `routingOwnership` (not `notifyOnce`, which the stub does not yet satisfy)
- [ ] #4 BUG-008 (typing effect with a null chatId) is covered by a new `effectsCarryChatId` guard predicate added to the chat predicate library (`@narratives/system-chat/testing`); it is consumed by **task-032** (which emits the typing effect) and is vacuous within Phase 2 — parity with the forward-declared `timeChanged`/`receiptChanged` predicates
- [ ] #5 No red / `.skip` / expected-red test is committed: the green assertion for each fixture lands with its consuming task (notify → 021, receipt → 024, typing → 032); task-019 ships the fixture data, the ledger, and the routing green test
- [ ] #6 BUG-005 (stale save missing a seed property) is classified `deferred → task-059` (save versioning/migrations), not eliminated

## Tests

This task **is** test code; coverage is measured against the BUG-HISTORY manifest.

- **Classes:** guard (regression + meta)
- guard/tripwire (CI): #2 — the meta-test fails if any entry is undispositioned or an untriaged `BUG-NNN` is added
- guard/regression (CI): #3 — the routing historical fixture is green via `routingOwnership`
- constraint/architecture (pre-commit): #1, #4, #6 — the manifest covers all entries; `effectsCarryChatId` exists; BUG-005 → 059

## Implementation Plan

- `packages/systems/chat/test/regression-ledger.ts` — the typed manifest (all 32
  entries, stable ids for the legacy 19, disposition + rationale + predicate/target).
- `packages/systems/chat/test/regression-ledger.test.ts` — the meta-test (parse
  `BUG-NNN:` headers from BUG-HISTORY.md; assert manifest coverage; freeze legacy count).
- Kernel-physics fixtures as `Input`-stream data (dup-notif, receipt-upgrade, typing,
  routing); the routing one asserted green now; notify/receipt/typing assertions land
  with tasks 021/024.
- `@narratives/system-chat/testing`: add the `effectsCarryChatId` predicate (a 7th
  in the task-018-owned barrel) and update that module's header comment accordingly.

## Implementation Notes

_None yet._
