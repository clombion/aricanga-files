# Phase 3 — Chat + phone view layer (Lit, model/view split)

**Labels:** `type:epic`, `area:ui`, `area:chat`, `area:phone`
**Blocked by:** Phase 2 · **Overlaps:** Phase 4

## Risk retired

Lit view-models can't reproduce the UI and accessibility.

## Goal

Build the chat UI as Lit components that consume view-models and emit intents
(holding no domain state): chat-hub, chat-thread, notification drawer/popup,
typing indicator, receipts, message/image/audio bubbles. Extract the phone
chrome (lock screen, status bar, home indicator, battery context) into
`systems/phone`. Wire effects → host → view. Accessibility baked in, not bolted
on.

## Proof / Definition of Done

Aricanga runs end-to-end on the new stack at behavioral parity with the POC
reference, phone + chat composed.

## Subtasks

See [`tasks/`](tasks/README.md) for the full task files; testing approach in
[`testing-strategy.md`](testing-strategy.md). TDD-led — backbone + a11y harness
first, axe baked into each component, then the sweep and parity proof.

- [ ] task-028 — View-model contracts and UI host render loop
- [ ] task-029 — Component and a11y test harness
- [ ] task-030 — chat-thread and message rendering
- [ ] task-031 — Rich message bubbles
- [ ] task-032 — Receipts, typing, and choice buttons
- [ ] task-033 — chat-hub
- [ ] task-034 — Notifications view (drawer + popup)
- [ ] task-035 — systems/phone — status bar, home indicator, overlay
- [ ] task-036 — Lock screen and battery context
- [ ] task-037 — Navigation and view transitions
- [ ] task-038 — Accessibility acceptance sweep
- [ ] task-039 — Aricanga view parity (phase proof)

## Non-goals

No new vocabularies (cards), no second experience.
