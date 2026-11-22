# ADR-0006: Test-first workflow, test taxonomy and the correctness harness

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

The rebuild's architecture is unusually test-friendly: a pure `reduce` kernel,
effects as data, a pure `view`, instance-scoped (injectable) services, a
boundary lint and contract-first design. Acceptance criteria are written as
outcome-focused, testable conditions. The POC's testing failure modes were
**vacuous tests** (`expect(true).toBe(true)`), **e2e DOM-poking** (Playwright
reaching into shadow roots for logic that belongs in a unit test) and **checks
that silently held nothing**: linters whose scan sets missed files, exemption
lists whose entries matched nothing, suppressions with no reason.

Most code here is written by agents. A check an agent can pass by weakening it,
or a test that passes whatever the code does, is worse than no check.

## Decision

### Test-first

- **TDD.** Each behaviour or constraint acceptance criterion becomes a failing
  test before implementation. A task is Done only when every criterion has a
  passing, tagged test; nothing is "manually verified". A phase's integrating
  proof is that phase's acceptance test.
- **Seen failing.** Every test a commit adds is seen failing before it is kept.
  Where the commit changes behaviour, the test fails on the commit's parent, at
  least one of them inside its body rather than at import. Where the commit
  keeps behaviour (an owner rewritten, working code covered, a rule's plant),
  the test fails on a named mutant of the owner it holds. The failing output is
  kept for the hand-back.
- **Carve-outs** where strict red-green is the wrong tool:
  - contract and type work is driven by `tsc -b`, stub conformance and the
    boundary lint (compile-first);
  - spike and discovery work is spike-then-harden; test-first applies to the
    hardened deliverable;
  - a claim about how a third-party runtime behaves (Solid, inkjs) is a
    characterisation test against the pinned version, and a contradiction
    changes the design, not the test.

### The taxonomy

Tests are tagged on five axes (Scope · Property · Constraint · Purpose ·
Technique) with four intent classes (behaviour, non-functional, constraint,
guard). Each task's `## Tests` section lists them; see
[`../testing-strategy.md`](../testing-strategy.md).

### The correctness harness

The rules every check in this repository follows. `harness.md` holds each check's
mechanism and `HARNESS_STATUS.md` records which checks are implemented; a test
keeps that file true.

- **Planted proof.** A check is live only when a planted violation fails it. Each
  check keeps its plants as tests, run through the gate's own invocation and
  configuration: one per rule and per root the rule covers, plus a near miss that
  must pass, so the check is not simply refusing everything.
- **One owner per rule.** A rule is a function, type or constant defined in the
  module that owns its concept and imported by every caller. Before defining a
  rule, search for its owner and extend it.
- **Live exemptions.** Every list a check consults is declared through one
  exemption owner; each entry carries a reason, and an entry that matches nothing
  fails. Every suppression comment carries its reason, and a suppression that
  silences the gate itself is refused.
- **Complete scan sets.** Checks read files from one listing (git's), and every
  tool is proven to reach every listed file it should scan.
- **Tests that can fail.** Refused shapes: a fake that ignores its argument; an
  assertion that reads back what the double supplied; an expected value built
  with the expression under test; a guard rebuilt in the test; an intersection
  where the claim is a subset.
- **The gate.** One command runs every check and the tests and writes no file;
  a separate command applies fixes. The gate runs only locked tools. The
  pre-commit hook runs the fast gate, the pre-push hook runs the full gate and
  refuses `fixup!`/`squash!`/`amend!` commits, and the commit-msg hook enforces
  conventional commits.
- **Hand-back.** A unit of work hands back, besides its commits: a mutant per
  owner it changed with the test that fails on it; a sweep for siblings of the
  defect's shape; the states it touched with the test holding each; the rules it
  defined; the failing run of each added test, on its parent or its named mutant.
- **Never weaken a check to pass it.** No new suppression or exemption without
  its reason, no lowered threshold, no deleted plant.

### Scope

The harness holds the rebuild: `packages/foundation`, `packages/systems/*`,
`packages/characterisation`, `experiences/sandbox`, and the harness's own tests
and scripts. The POC (`packages/framework`, `packages/tests`,
`packages/test-utils`, `experiences/aricanga`, `utils`) is a read-only behavioural
oracle deleted in Phase 7; it stays outside the harness and keeps its own
linters until then.

### Where each check runs

A test's gate is a function of its cost and determinism, not its label. Cheap,
deterministic checks run in the gate and its hooks; slow or environment-hungry
ones (real-browser suites, performance) run on the PR; the most expensive meta
checks (mutation, fuzz, deep property) run on demand before a release.

## Consequences

- Designs out the POC's vacuous-test and DOM-poking modes by pushing behaviour to
  unit and property tests on the pure kernel.
- A check that holds nothing fails its own plant instead of passing silently.
- Adding a rule costs a plant pair and an owner; adding an exemption costs a
  reason, and the entry fails once the code it covered is gone.
- `docs/agents/BUG-HISTORY.md` is a regression and tripwire suite.
