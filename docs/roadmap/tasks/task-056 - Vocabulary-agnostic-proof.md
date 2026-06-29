---
id: task-056
title: Vocabulary-agnostic proof (zero foundation edits)
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, cards, proof, phase-6]
milestone: "Phase 6 — Cards-on-phone experience"
dependencies: [task-055]
parent_task_id:
---

## Description

The integrating proof for Phase 6: a second vocabulary (cards) runs on the same
foundation, generic runtime, and phone chrome with **zero edits** to
`foundation/` or `systems/phone`. The seam is proven by recombination — the
runtime carried no chat assumptions.

## Acceptance Criteria

- [ ] #1 No commit in this phase modifies `foundation/` or `systems/phone` to make cards work
- [ ] #2 The cards experience builds and runs on the generic runtime + phone chrome
- [ ] #3 Both algebras (chat, cards) drive the identical runtime and effect-executor contract
- [ ] #4 A boundary lint confirms cards depend on `foundation` + `systems/phone`, never on `systems/chat`

## Tests

- **Classes:** constraint (phase proof)
- constraint/architecture (CI): #2, #4 — build succeeds; boundary lint denies a `systems/chat` dependency
- constraint/architecture (PR): #1, #3 — phase diff touches no foundation/phone source; the runtime contract is shared, not forked

## Implementation Plan

Boundary rule in `eslint.config.js`; a phase-diff check asserting no foundation/phone edits.

## Implementation Notes

_None yet._
