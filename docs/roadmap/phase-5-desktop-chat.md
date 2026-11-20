# Phase 5 — Desktop chat experience

**Labels:** `type:epic`, `area:experience`, `type:proof`
**Depends on:** Phases 3, 4 · **Contract:** ADR-0007

## Goal

Run the chat system unchanged under a non-phone shell, proving the kernel is shell-independent.

## Context

An experience is `compose(systems) + host shell + injected resources`. Desktop chat reuses the chat system's `Input`/`Effect` algebra and `reduce` verbatim; only the imperative shell differs: a desktop effect-executor (no phone `Present` chrome), a desktop `RenderContext`, and desktop view components rendering the same view-models. This is the seam proven by subtraction — chat without phone — and it must require no change to the chat system or the foundation.

## Proof / Definition of Done

Desktop chat runs reusing `systems/chat` unchanged; the only new code is a desktop shell + experience composition; any forced edit to `foundation/` or `systems/chat` is a leak to fix here.

## Subtasks

- [ ] [#35](https://github.com/clombion/aricanga-files/issues/35) — Desktop host shell + effect executor (no phone `Present` effects)
- [ ] [#41](https://github.com/clombion/aricanga-files/issues/41) — Desktop view components (consume chat view-models, emit intents)
- [ ] [#45](https://github.com/clombion/aricanga-files/issues/45) — Desktop experience composition + a minimal story
- [ ] [#48](https://github.com/clombion/aricanga-files/issues/48) — Shell-independence proof (chat system byte-identical to its phone use)

## Non-goals

Not a full product — a thin seam-proving experience.
