# Phase 5 — Experience: desktop chat (seam by subtraction)

**Labels:** `type:epic`, `area:experience`, `type:proof`
**Blocked by:** Phases 3, 4 · **Parallel with:** Phase 6

## Risk retired

Chat isn't truly separable from phone.

## Goal

Reuse `systems/chat` with a minimal desktop host and no phone chrome. This
proves chat works *without* phone (the phone/chat split, by subtraction).

## Proof / Definition of Done

Desktop chat runs reusing the chat system unchanged; the only new code is a host
+ experience composition. Any edit forced into `foundation/` or `systems/chat`
is a leak — fix it here.

## Subtasks

- [ ] (added when we break down this phase)

## Non-goals

Not a full game — a thin seam-proving experience.
