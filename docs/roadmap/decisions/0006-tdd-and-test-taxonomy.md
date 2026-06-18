# ADR-0006: Test-first workflow and the test taxonomy

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

The rebuild's architecture is unusually test-friendly: a pure `reduce` kernel,
effects-as-data, a pure `deriveViewModel`, instance-scoped (injectable) services,
boundary lint, and contract-first design. Acceptance criteria are already written
as outcome-focused, testable conditions. The POC's testing failure modes were
**vacuous tests** (`expect(true).toBe(true)`) and **e2e DOM-poking** (Playwright
reaching into shadow roots for logic that belongs in a unit test).

## Decision

- **Test-first (TDD).** Each behaviour/constraint acceptance criterion becomes a
  failing test before implementation. A task is **Done** only when every AC has a
  passing, tagged test — nothing is "manually verified". A phase's
  integrating-proof task is that phase's acceptance test.
- **Adopt the multi-axis test taxonomy** (Scope · Property · Constraint · Purpose
  · Technique; four intent classes: behavior, non-functional, constraint, guard)
  to tag each task's tests.
- **`## Tests` section** added to the task template.
- **Carve-outs** (strict red-green is the wrong tool):
  - *Contract/type tasks* (Phase 1) are driven by `tsc --build` + stub conformance
    + boundary lint (compile-first), not example assertions.
  - *Spike/discovery tasks* (walking skeleton; the `StoryChunk`-shape question)
    are *spike-then-harden* — test-first applies to the hardened deliverable.
- **Enforcement ladder (shift-left):** a test's gate is a function of its cost and
  determinism, not its label. Cheap/deterministic checks run pre-commit; slow or
  environment-hungry ones run in CI, then nightly.

## Consequences

- Designs out the POC's vacuous-test and DOM-poking modes by pushing behaviour to
  unit/property tests on the pure kernel.
- `docs/agents/BUG-HISTORY.md` becomes a regression/tripwire suite.
- Enables mutation testing (kernel) and fuzz (tag/ink parsing) as nightly checks.
- See [`../testing-strategy.md`](../testing-strategy.md) for the per-layer mapping
  and the enforcement ladder.
