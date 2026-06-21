---
id: task-016
title: Multi-system router contract
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
labels: [foundation, phase-1]
milestone: "Phase 1 — Foundation contracts"
dependencies: [task-008, task-011]
parent_task_id:
---

## Description

Define the `Router` contract that dispatches an ink `StoryChunk` to the system
that should handle it, so one or more systems can coexist in an experience
(ADR-0005). Ship the default strategy: route to the first system claiming one of
the chunk's tags, else the foreground system. Keep it small and swappable; the
explicit `# system:` override tag stays deferred.

## Acceptance Criteria

- [ ] #1 `Router.route(chunk, ctx) → SystemId` is defined; `RouteContext` exposes the foreground id and the system registry
- [ ] #2 The default strategy routes a tagged chunk to the system whose `tags` claim it (e.g. `# stat:` → cards, `# speaker:` → chat)
- [ ] #3 An untagged or ambiguous chunk routes to the `foreground` system
- [ ] #4 A single-system experience is the degenerate case — the router returns the one system, with no special-casing in the host loop
- [ ] #5 The router is swappable via `createExperience({ router })`; foundation ships the default
- [ ] #6 Routing references only `System.tags` and ids — never a chat- or card-specific type

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (pre-commit): #2, #3, #4 — a tagged chunk routes to the claiming system; an untagged chunk routes to `foreground`; a single system is always returned
- behaviour/example (pre-commit): #5 — a custom router passed via `createExperience` overrides the default
- constraint/architecture (pre-commit): #1, #6 — `Router`/`RouteContext` defined; routing references only `System.tags` and ids

## Implementation Plan

`packages/foundation/src/sim/router.ts`; default tag-ownership + foreground strategy.

## Implementation Notes

The explicit `# system:` disambiguation tag is deferred (ADR-0005) until a real
hybrid experience needs it.
