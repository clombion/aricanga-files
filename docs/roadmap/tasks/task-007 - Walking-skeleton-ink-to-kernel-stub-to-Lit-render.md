---
id: task-007
title: Walking skeleton — ink to kernel stub to Lit render
status: Done
assignee: []
created_date: 2026-06-16
updated_date: 2026-06-19
labels: [foundation, ui, phase-0]
milestone: "Phase 0 — Walking skeleton & toolchain"
dependencies: [task-001, task-002, task-003, task-004, task-005, task-006]
parent_task_id:
---

## Description

Thread the whole pipeline end to end with throwaway stubs: a one-line ink story
compiled to JSON, loaded by an InkRuntime wrapper, passed through a stub
`reduce` (passthrough), and rendered by one Lit component. This is Phase 0's
integrating proof — it retires the "does the stack hang together" risk. The
kernel stub is deliberately trivial; real contracts arrive in Phase 1.

## Acceptance Criteria

- [ ] #1 A trivial `.ink` story compiles to JSON as part of the build
- [ ] #2 The app loads the story, advances it, and a single message string flows through a stub `reduce(state, chunk)` into a view-model
- [ ] #3 A Lit component renders that message text in the browser
- [ ] #4 The whole thread runs under `vite dev` and is covered by one end-to-end smoke test
- [ ] #5 Typecheck, boundary lint, and CI are all green with the skeleton in place

## Tests

- **Classes:** guard (+ light behaviour)
- guard/smoke (CI gate): #1, #3, #4 — shallow e2e: the story compiles, the app boots under `vite dev`, the message text appears
- behaviour/example (CI): #2 — the stub `reduce` maps a chunk to the expected view-model
- constraint/architecture (pre-commit): #5 — boundary lint + typecheck are green

> Carve-out: this is a spike — explore the real inkjs `StoryChunk` shape first
> (the "discover" open question), then harden the smoke test once the shape is
> known. Test-first applies to the hardened skeleton, not the exploration.

## Implementation Plan

Minimal InkRuntime wrapper over inkjs; passthrough `reduce`; one Lit component;
a Playwright or Vitest smoke test asserting the rendered text.

## Implementation Notes

Thread: `story.ink` → a Vite ink plugin compiles it to `public/story.json` on both
dev and build (AC #1) → foundation `InkRuntime` (the single inkjs touchpoint;
`StoryChunk = { text, tags }`) → system-chat stub `reduceChunk` → Lit
`<sk-message>` render.

Spike discovery (the "discover" open question): real inkjs shape — `Compiler` from
`inkjs/full`, `Story` from `inkjs`, `Continue()` + `currentTags` (tags like
`"speaker: Skeleton"`, no `#`).

Verified: `reduceChunk` unit tests (AC #2); a happy-dom e2e smoke
(`skeleton.test.ts`: ink → reduce → shadow-DOM render, asserts `"Skeleton:"` —
AC #2/#3); `vite dev` serves the app + compiled `story.json` (AC #4); and
tsc + boundary lint + tests + build all green (AC #5).

The kernel stub is throwaway — Phase 1 replaces it with the real
`reduce`/`Effect`/`Snapshot` contracts. Browser-level Playwright e2e is deferred to
the Phase 3 harness (task-029) per the spike carve-out.
