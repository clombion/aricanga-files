# Phase 6 — Experience: cards-on-phone (seam by recombination)

**Labels:** `type:epic`, `area:experience`, `area:cards`, `type:proof`
**Blocked by:** Phases 3, 4 · **Parallel with:** Phase 5

## Risk retired

The foundation isn't genuinely vocabulary-agnostic — the real seam.

## Goal

Build `systems/cards` — a genuinely different vocabulary from chat:

- Tags: `# card:`, `# stat:`
- A simple machine slice (no time coherence, no HWM, no notifications)
- A card + stat-bar Lit view

Compose it with `systems/phone`. This stresses foundation generality **and**
recombines phone with a non-chat vocabulary, proving phone ⊥ chat are orthogonal
axes, not just a separable pair.

### What this forces into the open

- **Snapshot shape** — cards has no `messageHistory`/`deferredMessages`, forcing
  `Snapshot<TSystemState>` to be truly generic.
- **Effect channel** — `STAT_CHANGED`/`CARD_SHOWN` vs chat's `NOTIFICATION_SHOW`,
  forcing the effect type to be system-extensible.
- **Tag registry** — a different tag set forces per-system tag plug-ins.
- **Layer placement** — cards needs neither forward-only time nor read cursors,
  proving those belong in the chat system, not the foundation.
- **Analytics** — swipe decisions vs choice-in-chat, forcing a generic sink.

## Proof / Definition of Done

Cards-on-phone runs; phone reused unchanged; building cards required **zero edits
to `foundation/`** (or the edits it forced are the final generalizations, after
which it's zero).

## Subtasks

- [ ] (added when we break down this phase)

## Non-goals

Thin probe — a handful of cards, two stats, swipe L/R, ink-driven, no art.
