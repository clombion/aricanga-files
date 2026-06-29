# Testing strategy

> Adopts the multi-axis test taxonomy and a test-first (TDD) workflow for the
> rebuild. See [ADR-0006](decisions/0006-tdd-and-test-taxonomy.md).

## Why it fits

The architecture is test-friendly by construction: a pure `reduce` kernel,
effects-as-data, a pure `deriveViewModel`, instance-scoped services (injectable
fakes), boundary lint, and contract-first design. Acceptance criteria are already
outcome-focused. The POC's failure modes — vacuous `expect(true)` tests and
Playwright poking shadow DOM — are designed out by pushing behaviour down to
unit/property tests on the pure kernel.

## The five axes

- **Scope** — how much is wired: unit → integration → e2e.
- **Property** — functional vs non-functional (performance, security, a11y, compat).
- **Constraint** — a structural rule rather than behaviour (architecture, contract).
- **Purpose** — what it guards: regression, smoke, sanity, acceptance, tripwire.
- **Technique** — how cases are produced: example, property, snapshot, mutation, fuzz.

Scope and Technique are independent — a test is one point on *each* axis. Every
test collapses to one of four **intent classes**: behaviour, non-functional
property, structural constraint, or guard/meta.

## Test-first workflow

Per task: **Red** (turn each behaviour/constraint AC into a failing test) →
**Green** (implement) → **Refactor** → **Done** (every AC has a passing, tagged
test). The phase's integrating-proof task is the phase's acceptance test.

**Carve-outs** — where strict red-green is the wrong tool:
- *Contract / type tasks* (Phase 1): the test is `tsc --build` + stub conformance
  + boundary lint (compile-first), not example assertions.
- *Spikes / discovery* (walking skeleton; the `StoryChunk`-shape open question):
  *spike then harden* — explore to learn the shape, then lock it with tests.

## Default mapping by layer

| Layer / phase | Intent classes | Scope | Techniques | Notes |
|---|---|---|---|---|
| Foundation contracts (P1) | constraint (+ light behaviour) | static / unit | compile, example | type-checker + two stubs are the test |
| Kernel physics (P2) | behaviour | unit | property, example, golden | invariants from `simulation-physics`; BUG-HISTORY → regression |
| View (P3) | behaviour, non-functional | component, e2e | example, snapshot, a11y | happy-dom + axe-core |
| Build / config (P4) | constraint | boundary | contract, smoke | the Zod schema is the contract |
| Experiences (P5–P6) | behaviour | e2e | acceptance, example | + "zero foundation edits" architecture test |
| Cross-cutting (P0+) | guard, non-functional, meta | varies | smoke, tripwire, mutation, fuzz | mutation on kernel; fuzz on tag/ink parsing |

## Enforcement ladder (shift-left)

Placement = f(cost, determinism), **not** the label — a 20-example property test
is fine locally; the same at 10,000 is an on-demand run.

Solo dev, low churn → **no nightly cadence.** The pull request is the merge gate;
the most expensive meta checks run on demand (before a release, or when reworking
the kernel), not on a schedule.

- **local** (pre-commit / pre-push; see task-005): unit/example, architecture/boundary, snapshot, tripwire, capped property, compile.
- **PR** (CI on every pull request — the merge gate; see task-006): integration, contract, a11y, e2e, full property, acceptance, golden replay.
- **on-demand** (pre-release / manual `workflow_dispatch`): mutation, fuzz, performance, deep property / deep e2e.

## How tasks tag tests

Each task's `## Tests` section lists, under an intent-**Classes** summary, one
bullet per test in the form:

```
scope/technique (gate): #ACs — what it checks
```

Gates: `pre-commit`/local, `CI` (the PR merge gate), `on-demand` (pre-release).
See [`TASK-TEMPLATE.md`](TASK-TEMPLATE.md).

## Algebra guards (ADR-0007)

A system's correctness rests on four properties the toolchain enforces directly, so completeness and purity are checked rather than reviewed:

- **Boundary exhaustiveness (compile):** handling of `Input` and `Effect` is total — a `never` check makes a new boundary crossing fail to compile until it is a constructor. Closure of the boundary is a type property.
- **Reducer purity (lint, pre-commit):** a `no-Date.now/Math.random/locale` rule over every system's reducer (`model`) package; the kernel reads time/ids only from `ReduceContext`/the input, locale only in `view` via `RenderContext`.
- **Determinism (property, CI):** a run-twice deep-equality invariant over `reduce` for generated input streams.
- **Golden (golden, CI):** the recorded `Input→Effect`+`state` stream (kernel-observable, never opaque ink JSON), serialized canonically (sorted keys). A regression lock, not the correctness oracle — each behaviour is independently asserted by the invariant/regression/example suites.
