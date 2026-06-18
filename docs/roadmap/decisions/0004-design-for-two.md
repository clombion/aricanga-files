# ADR-0004: Design the foundation for two vocabularies

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

The POC's "composable systems" boundary existed in docs but was never crossed
twice — only one system (chat, with phone tangled inside) was ever built. A reuse
boundary exercised once is fiction; it tends to be secretly shaped like its single
consumer.

## Decision

Design the foundation contracts against **two** genuinely different vocabularies
from the start: **chat** (message physics, time, read state) and **cards**
(deck + stats, no time/HWM/notifications). Prove generality two ways:

1. **Compile-time, now (Phase 1):** chat and cards *stubs* both implement the
   `System` interface and wire through one composition root; switching touches
   zero foundation code.
2. **Runtime, later:** a desktop-chat experience (chat without phone, by
   subtraction, Phase 5) and a cards-on-phone experience (phone without chat, by
   recombination, Phase 6).

## Consequences

- A leaky, chat-shaped foundation is caught at compile time in Phase 1 instead of
  at the third experience.
- Scenes/cards beyond the stub are **not** built speculatively; only the seam is
  made honest. The `# system:` routing tag stays unbuilt until a multi-system
  experience exists.
