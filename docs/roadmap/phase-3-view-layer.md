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

- [ ] (added when we break down this phase)

## Non-goals

No new vocabularies (cards), no second experience.
