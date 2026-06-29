# Phase 6 — Cards-on-phone experience

**Labels:** `type:epic`, `area:experience`, `area:cards`, `type:proof`
**Depends on:** Phases 3, 4 · **Contract:** ADR-0007

## Goal

Run a second, genuinely different system — cards — on the phone shell, proving the foundation is vocabulary-agnostic and that systems compose orthogonally.

## Context

cards is its own closed algebra, derived from first principles, not chat with fields removed:

- **Input:** `Story(InkStep)`, `Player(Swipe dir)`, `Lifecycle(Init|Reset)` — no open/close/choose chat affordances.
- **Effect:** `Present(StatChanged | CardShown | GameOver)`, `Persist(Save)` — no notify/typing/receipt.
- **State:** deck cursor, stats, decision history — no message/read/deferral/time concepts.

It runs on the same generic runtime and composes with the phone system, sharing the phone shell's `Present` chrome. This turns the two-vocabulary proof into its strongest form: two genuinely different closed `Input`/`Effect` algebras driven by one runtime, recombined with phone — proving system and phone are orthogonal axes.

## Proof / Definition of Done

cards-on-phone runs; phone reused unchanged; building cards touches zero `foundation/` source; the cards boundary passes the same exhaustiveness/purity/determinism guards as chat.

## Subtasks

- [ ] task-052 — Cards `Input`/`Effect` algebra + completeness check (swipe/stat vocabulary)
- [ ] task-053 — Cards `reduce` + `view` (deck, stats, game-over) — pure
- [ ] task-054 — Cards content (a thin deck, two stats, ink-driven)
- [ ] task-055 — Cards view components + phone composition
- [ ] task-056 — Vocabulary-agnostic proof (cards on the same runtime + phone, zero foundation edits)

## Non-goals

A thin probe, not a game. Derive the algebra and apply the same falsification method used for chat (ADR-0007).
