# Phase 4 — Build pipeline & config

**Labels:** `type:epic`, `area:build`, `area:tooling`
**Depends on:** Phase 1 · **Contract:** ADR-0007

## Goal

A typed build that produces the host-injected resources an experience needs and validates configuration against a schema, replacing the bespoke parity linters.

## Context

Under the algebra, the build produces exactly the **world the host shell injects**: the compiled ink story, the build-extracted seeds (the `Lifecycle(Init)` payload), the deterministic i18n/data fixtures the host binds to the `name`/`data` ink externals, the optimized assets, and validated config (chat registry used for host-side `Player(Open)` validation, grouping threshold, theme). A single schema is the source of truth, so config↔ink parity is a schema property rather than a fleet of ad-hoc checks.

## Proof / Definition of Done

Aricanga builds for en + fr from TOML + ink under schema validation; outputs are content-hashed; the parity/staleness linters are replaced by the schema; CI runs build + boundary lint + kernel suites + a11y.

## Subtasks

- [ ] [#22](https://github.com/clombion/aricanga-files/issues/22) — Config schema (Zod) as the single source of truth (characters, chats↔knots, theme, timings, locales)
- [ ] [#25](https://github.com/clombion/aricanga-files/issues/25) — Per-locale ink compile to JSON
- [ ] [#27](https://github.com/clombion/aricanga-files/issues/27) — Seed extraction → `Lifecycle(Init)` payload
- [ ] [#26](https://github.com/clombion/aricanga-files/issues/26) — i18n/data fixture generation (host-injected `name`/`data` lookups, locale-pinned)
- [ ] [#16](https://github.com/clombion/aricanga-files/issues/16) — Image optimization + content-hashed artifacts
- [ ] [#29](https://github.com/clombion/aricanga-files/issues/29) — Retire parity linters in favour of the schema; wire CI

## Non-goals

No runtime code. The build emits host-injected fixtures and validated config; it does not run the kernel.
