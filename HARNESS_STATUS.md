# Harness status

Whether this project implements each check of [harness.md](harness.md). A status is `implemented`,
`not implemented` or `planned`.

- A `not implemented` row gives one of two reasons, `more harmful than helpful` or
  `no-op/not relevant`, with one line of evidence. A `no-op/not relevant` row names the surface probe
  that finds no site for it; the row turns `planned` when the probe finds one.
- A `planned` row names the work that brings it in.

| id | check | status | where | reason | evidence |
|---|---|---|---|---|---|
| agent-environment | An agent works in its own folder and runs only locked tools | implemented | `AGENTS.md` | | |
| boundaries | The module boundaries hold under oxlint | implemented | `harness/checks/boundaries.test.ts` | | |
| browser-leaks | No page is left open and no pointer is left down between browser tests | not implemented | | no-op/not relevant | surface probe `browser-tests`: the characterisation suite is the only browser suite, and each fixture runs in a page Playwright opens and closes per test |
| build-check | The gate builds every held Vite app in check mode | implemented | `harness/checks/build-check.test.ts` | | |
| clones | No copied code, and jscpd scans every listed file | implemented | `harness/checks/clones.test.ts` | | |
| closed-domains | Every closed set is read totally and named through its owner (closedworld shape rules) | planned | | | the closedworld shape rules for TypeScript, as project lint rules |
| console-guard | An undeclared console warning or error fails the browser test | planned | | | Phase 3 Step 3: the first Part brings the Vitest browser suite it guards |
| contract-widening | A contract union is never widened to `string` | implemented | `harness/checks/contract-widening.test.ts` | | |
| coverage-floor | The coverage floor fails an untaken branch, an uncalled function and an unrun line | implemented | `harness/checks/coverage-floor.test.ts` | | |
| csp-bundle | The built scripts write no inline style, handler or `javascript:` URL | planned | | | Phase 3 Step 3: the first experience build that renders Parts |
| csp-frame | The built experience loads in a frame with no CSP refusal, console error or failed request | planned | | | Phase 3 Step 3, beside `csp-bundle`; the characterisation suite already serves its fixtures under the policy |
| deadcode | knip finds no unused file, dependency or export in either mode | implemented | `harness/checks/deadcode.test.ts` | | |
| doc-references | Every reference in current text resolves | implemented | `harness/checks/doc-references.test.ts` | | |
| doubles | A scripted double refuses an unscripted call | implemented | `harness/checks/doubles.test.ts` | | |
| elements | A page writes no `null`, `undefined` or `NaN`, names every control and shows markup in data as text | planned | | | Phase 3 Step 3, with the composed axe sweep |
| exemption-lists | Every consulted list is declared and every declaration is consulted | implemented | `harness/checks/exemption-lists.test.ts` | | |
| fail-before-fix | Every added test fails on its parent | implemented | `AGENTS.md` | | |
| fixture-provenance | A fixture builds a production record by production's own rule | implemented | `AGENTS.md` | | |
| flake-hunter | A test that passes only in its usual order or alone fails | implemented | `harness/checks/flake-hunter.test.ts` | | |
| gate | The gate writes nothing, runs only locked tools, and the hooks run its tasks | implemented | `harness/checks/gate.test.ts` | | |
| generated-docs | Every generated block of the docs is current | implemented | `harness/checks/generated-docs.test.ts` | | |
| github-actions | Workflows pass actionlint and zizmor, and each action is pinned to a release | planned | | | needs actionlint, zizmor and pinact, which are not dependencies yet |
| hand-back | A unit of work hands back its evidence | implemented | `AGENTS.md` | | |
| harness-status | This file is true | planned | | | the check that holds every row against `harness.md` and the check modules |
| history-narration | Current text narrates no history | implemented | `harness/checks/history-narration.test.ts` | | |
| isolation | A test that leaves a timer pending fails, and the next test starts clean | implemented | `harness/checks/isolation.test.ts` | | |
| layout | Layout holds at phone and desktop widths, with no shift when a control toggles and reflow at 320 px | planned | | | Phase 3 Step 3: the phone chrome is the first layout |
| lint-settings | oxlint fails each planted violation of a rule the harness rests on | implemented | `harness/checks/lint-settings.test.ts` | | |
| meta-readers | Every contract field is read, through a named function | planned | | | the census layer of closedworld |
| mutation-testing | A mutant of each owner is killed by a test | planned | | | Stryker over the kernel, once the view layer lands |
| network-guard | A test cannot reach another host | implemented | `harness/checks/network-guard.test.ts` | | |
| node-floor | The Node running the suite meets the declared floor | implemented | `harness/checks/node-floor.test.ts` | | |
| one-claims | Every claim of a single owner is registered and holds | implemented | `harness/checks/one-claims.test.ts` | | |
| owner-registry | Each guarded API is used only by its owner | implemented | `harness/checks/owner-registry.test.ts` | | |
| owners-flat | Solid's owners and roots stay flat over three redraws | planned | | | Phase 3 Step 3: the first mounted experience |
| part-failure | A throwing Part is reported once and the rest of the page stays | planned | | | Phase 3 Step 3; ADR-0008's failure model is characterised, the per-Part tests come with the Parts |
| project-lint-rules | Every project lint rule fires on its must-fire fixtures and passes its clean ones | implemented | `harness/checks/project-lint-rules.test.ts` | | |
| pushed-subjects | No fixup, squash or amend commit is pushed | implemented | `harness/checks/pushed.test.ts` | | |
| refusals | Every refusal is defined with its remedy, in one module | planned | | | the kernel's refusals are spread over its modules; one owner comes with the census layer |
| repo-paths | One module computes the repository root | implemented | `harness/checks/repo-paths.test.ts` | | |
| scan-sets | Every held file is reached by every tool's scan set | implemented | `harness/checks/scan-sets.test.ts` | | |
| skips | Every skip is listed with its reason | implemented | `harness/checks/skips.test.ts` | | |
| staged-checks | The commit and push hooks check exactly what is committed, in a worktree of their own | planned | | | the hooks run on the working tree today |
| structure | No module is both `.ts` and `.tsx`, and no build output is committed | implemented | `harness/checks/structure.test.ts` | | |
| stylesheets | Every stylesheet passes stylelint, reads raw values through tokens, and every class and property is used | implemented | `harness/checks/stylesheets.test.ts` | | |
| suppressions | Every suppression names its rule, a tool that checks the file, and its reason | implemented | `harness/checks/suppressions.test.ts` | | |
| terms | No retired term or refused pattern in current text | implemented | `harness/checks/terms.test.ts` | | |
| tests-that-cannot-fail | Tests can fail | implemented | `AGENTS.md` | | |
| tool-exemptions | Every tool exemption matches something | implemented | `harness/checks/tool-exemptions.test.ts` | | |
| tool-upgrades | Every pinned tool has its upstream named | implemented | `harness/checks/tool-upgrades.test.ts` | | |
| type-exports | An exported type is read by another production module or marked `@public` | implemented | `harness/checks/type-exports.test.ts` | | |
| typecheck-settings | tsc fails each planted typing hole a setting closes | implemented | `harness/checks/typecheck-settings.test.ts` | | |
| typed-classes | A class the stylesheet does not define fails the type check | planned | | | Phase 3 Step 3: the Parts' JSX `class` typed to the generated class list |
| vitest-settings | Vitest fails each planted test a bare configuration would pass | implemented | `harness/checks/vitest-settings.test.ts` | | |
| witness-per-state | Every state a producer declares is reached by a test | planned | | | the census layer of closedworld |
