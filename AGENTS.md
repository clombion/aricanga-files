# Agent brief

How an agent works in this repository. The checks themselves, and how to add one, are in
[harness.md](harness.md); which of them this project implements is in
[HARNESS_STATUS.md](HARNESS_STATUS.md). Read both before adding a check, a test helper or an
exemption, and extend an existing owner rather than defining a rule a second time. The decisions
are the ADRs in [docs/roadmap/decisions](docs/roadmap/decisions/); open work is tracked in GitHub
Issues as [docs/roadmap/issues.md](docs/roadmap/issues.md) describes.

## Scope

The harness holds the rebuild: every workspace package pnpm lists whose manifest git lists, less the
POC reference, and `harness` itself, tests, scripts and configuration included, all under the same
rules as production code (`harness/lib/scope.ts`). A held module is `.ts` or `.tsx`: the population refuses
any other module oxlint would lint (`.js`, `.mjs`, `.cjs`, `.jsx`, `.mts`, `.cts`), which no scan reads. A workspace package declares its role in its
manifest, `"aricanga": { "role": … }`, one of the roles of `harness/lib/roles.ts`. A new member is held,
type-checked, tested, covered, linted under its role's rules and scanned by knip with no list to edit;
one list still names members by hand and needs the new one added: `test:browser`'s config list in
`package.json`. The POC reference
(`packages/framework`, `packages/tests`, `packages/test-utils`, `experiences/aricanga`, `utils`)
is a read-only behavioural oracle outside the harness until it is deleted (ADR-0006).

## The gate

- `pnpm run check` is the gate and writes no file: every check, the tests with the coverage
  floor, and the real-browser suite. It must pass before a commit is handed back.
- `pnpm run check:fast` is the gate without the tests.
- `pnpm run fix` applies the fixers and regenerates the generated blocks of the docs. Run it,
  read its diff, then run the gate.
- The pre-commit hook runs `pnpm run check:fast`; the pre-push hook runs `pnpm run check` and
  refuses a pushed `fixup!`, `squash!` or `amend!` commit; the commit-msg hook holds conventional
  commit subjects. Fold fixups before pushing.
- Never weaken a check to pass it: no suppression or exemption entry without the reason the
  census requires, no lowered threshold, no deleted plant, no rule turned off that does not
  contradict another enabled rule.

## seen-failing

Every test a commit adds is seen failing before it is kept. Where the commit changes behaviour, the
test fails on the commit's parent, at least one of them inside its body rather than at import. Where
the commit keeps behaviour (an owner rewritten, working code covered, a rule's plant), the test
fails on a named mutant of the owner it holds. Keep the failing output for the hand-back.

## hand-back

A unit of work hands back, besides the commits:

- for each owner it changed, a mutant of the owner and the test that fails on it;
- a sweep of the code for siblings of the defect's shape, with what it found;
- a table of the states it touched, with the test that holds each state;
- each rule it defined (name, module, one line), and any rule it saw defined twice;
- the failing run of each added test: on the parent, or on its named mutant.

A fix that changes how a run ends (its exit code, its signals, its teardown) is a design change:
plan it and have the plan verified before building it.

## agent-environment

- Use a temporary folder of your own, never one another agent may write.
- Run tools only from this checkout's own installation (`pnpm exec`, `pnpm run`); never through
  an unlocked runner such as `npx` or `pnpm dlx`.
- A bounded command logs to a file, never through a pipe, and its bound covers every wait before
  it.

## tests-that-cannot-fail

A test must be able to fail. Refuse a fake that ignores its argument, an assertion that reads back
what the double supplied, an expected value built with the expression under test, a guard rebuilt
in the test, and an intersection where the claim is a subset. A fixture builds a production record
by production's own rule.

## Solid

The view layer is Solid 2.0 (ADR-0002), and its runtime model is ADR-0008. Solid's own guidance
for agents ships with the installed package, under solid-js's `skills` folder in `node_modules`:
`solid-2.0` (the 1.x to 2.0 corrections), `solid-2.0-cheatsheet` and `reactivity-diagnostics`
(one section per diagnostic code). Read them before writing a part; a claim about Solid's runtime
that this repository relies on is a characterisation test, not a sentence.
