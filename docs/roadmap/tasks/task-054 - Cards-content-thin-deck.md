---
id: task-054
title: Cards content (thin deck, two stats)
status: To Do
assignee: []
created_date: 2026-06-19
updated_date: 2026-06-19
labels: [experience, cards, content, phase-6]
milestone: "Phase 6 — Cards-on-phone experience"
dependencies: [task-052]
parent_task_id:
---

## Description

A minimal card deck authored in ink and validated by the config schema: a small
set of cards, each with two choices and effects on two stats, sufficient to
exercise the cards algebra end to end without building a full game.

## Acceptance Criteria

- [ ] #1 A small ink deck compiles through the Phase 4 pipeline to story JSON
- [ ] #2 Cards and stats are described by config validated against the schema
- [ ] #3 The deck exercises every cards `Input` kind at least once (swipe/choice, lifecycle)
- [ ] #4 Content is locale-pinned and reproducible from the build

## Tests

- **Classes:** behaviour (+ constraint)
- behaviour/example (CI): #1, #3 — the deck compiles and a scripted run exercises each input kind
- constraint/contract (CI): #2 — invalid card/stat config fails schema validation with a located error

## Implementation Plan

`experiences/cards-on-phone/content/`; reuse the Phase 4 pipeline + schema.

## Implementation Notes

_None yet._
