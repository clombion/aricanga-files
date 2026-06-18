# Phase 4 — Typed build pipeline & config schema

**Labels:** `type:epic`, `area:build`, `area:tooling`
**Blocked by:** Phase 1 · **Overlaps:** Phase 3 · **Blocks:** Phases 5, 6

## Risk retired

The 60-linter governance pile doesn't actually collapse.

## Goal

One typed build module with explicit inputs → outputs:

- Zod-validated TOML (the schema becomes the source of truth)
- Per-locale ink compile
- Seed extraction
- Image optimization
- Content-hashed artifacts

Retire the parity/staleness linters in favor of the schema; wire the i18n load
path.

## Proof / Definition of Done

Aricanga builds for en+fr from TOML+ink under schema validation; governance
shrinks to a handful of genuine domain checks; CI = build + boundary lint +
kernel invariants + a11y.

## Subtasks

- [ ] (added when we break down this phase)

## Non-goals

No new experiences.
