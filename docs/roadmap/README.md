# Framework Rebuild Roadmap

Tracking document for the from-scratch rebuild to the target architecture.
Greenfield on a new branch; the current code stays as a read-only reference and
is deleted in Phase 7. Sequenced by **risk retirement** — each phase exists to
kill one named risk and has a concrete proof it's dead before the next begins.

> **Tracking:** open work is in [GitHub Issues](https://github.com/clombion/aricanga-files/issues),
> organised as described in [`issues.md`](issues.md). The phase files below hold
> each phase's risk, goal and proof; their subtask lists link to the issues.

## Principles

- **Greenfield, not migration** — no coexistence, no incremental cutover. The
  POC is a read-only reference, deleted in Phase 7.
- **Design for two, build for one, prove with the rest** — the foundation is
  designed against chat *and* cards in Phase 1 so its generality is never
  retrofitted.
- **Content survives, code is rebuilt** — ink/TOML/assets carry over almost
  unchanged; the POC is a behavioral oracle to diff against.
- **Lightweight gates** — a phase's proof is *does it compile / do the invariants
  pass / did I have to touch `foundation/`*, not heavyweight ceremony.

## Target architecture (north star)

A **headless, deterministic simulation kernel** with a **thin reactive view
layer** (Solid 2.0), **one event/effect backbone**, **real TypeScript types**, and a
**composition root** instead of global singletons.

```
packages/
  foundation/          # zero DOM, zero chat-vocabulary
    ink/               # InkRuntime — the only inkjs touchpoint
    sim/               # closed Input/Effect algebra: reduce(state, input) -> {state, effects} (ADR-0007)
    services/          # Clock, Storage, Analytics sink, EventBus (instance-scoped)
    types/             # shared discriminated unions
  systems/
    chat/  { model/ view/ }     # chat vocabulary + components
    phone/ { model/ view/ }     # phone chrome
    cards/ { model/ view/ }     # card vocabulary (Phase 6)
  build/               # one typed pipeline; Zod-validated TOML
experiences/
  aricanga/            # content + thin composition root + bespoke UI
  desktop-chat/        # proves chat works without phone (Phase 5)
  cards-on-phone/      # proves phone works without chat (Phase 6)
```

## Phases (Epics)

| Phase | Epic | Risk retired |
|-------|------|--------------|
| 0 | [Walking skeleton & toolchain](phase-0-skeleton.md) | The new stack doesn't hang together |
| 1 | [Foundation contracts](phase-1-foundation.md) | The foundation is secretly chat-shaped |
| 2 | [Chat simulation kernel (headless)](phase-2-kernel.md) | Can't reproduce the physics as pure logic |
| 3 | [Chat + phone view layer (Solid)](phase-3-view-layer.md) | A Solid view over the kernel's snapshots can't reproduce UI + a11y |
| 4 | [Typed build pipeline & config schema](phase-4-build-pipeline.md) | The 60-linter governance pile doesn't collapse |
| 5 | [Experience: desktop chat](phase-5-desktop-chat.md) | Chat isn't truly separable from phone |
| 6 | [Experience: cards-on-phone](phase-6-cards-on-phone.md) | The foundation isn't genuinely vocabulary-agnostic |
| 7 | [Hardening & retire the reference](phase-7-hardening.md) | The rebuild lingers as a parallel half-thing |

## Dependency arc

```
P0 → P1 → { P2 → P3, P4 } → { P5 ∥ P6 } → P7
```

- **P1 gates everything** — it banks the design-for-two payoff.
- **P2 → P3** are sequential for chat; **P4** can overlap **P3**.
- **P5 and P6 parallelize** once foundation + systems are stable. They are the
  two seam-proofs: P5 by *subtraction* (chat without phone), P6 by
  *recombination* (phone without chat).

## Issues and decisions

- **Issues:** each issue's acceptance criteria are outcome-focused, testable
  conditions, and its tests are tagged with the multi-axis taxonomy in
  [`testing-strategy.md`](testing-strategy.md). We work **test-first** (TDD): a
  criterion is done when its tagged test is green (ADR-0006). See
  [`issues.md`](issues.md).
- **Decisions:** architectural calls (greenfield rebuild, risk-ordering,
  TypeScript + Solid, design-for-two, the two seam experiences) are recorded as
  short ADR-style files in `docs/roadmap/decisions/`.
