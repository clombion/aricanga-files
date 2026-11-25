# Harness

The checks that hold this repository's rebuild, and how to add one. Read it before adding a check,
a test helper or an exemption. ADR-0006 states the rules every check follows; `HARNESS_STATUS.md`
records, for every check below, whether this project implements it.

## The gate

`pnpm run check` is the gate and writes no file; `pnpm run fix` applies the fixers and writes the
generated blocks of the docs. `pnpm run fix` writes this table from `package.json`.

<!-- generated: tasks -->
| Command | Runs |
| --- | --- |
| `pnpm run setup` | `pnpm install --frozen-lockfile && lefthook install && node harness/scripts/gen-docs.ts` |
| `pnpm run check` | `pnpm run check:fast && pnpm run test && pnpm run test:browser` |
| `pnpm run check:fast` | `pnpm run lock:check && pnpm run lint && pnpm run format:check && pnpm run typecheck && pnpm run dupes && pnpm run docs:check && pnpm run deadcode && pnpm run build:check` |
| `pnpm run lock:check` | `pnpm install --frozen-lockfile --lockfile-only` |
| `pnpm run lint` | `pnpm run lock:check && oxlint -c oxlint.config.ts && stylelint "**/*.css" --max-warnings 0` |
| `pnpm run format:check` | `pnpm run lock:check && oxfmt --check` |
| `pnpm run typecheck` | `pnpm run lock:check && node harness/scripts/typecheck.ts` |
| `pnpm run dupes` | `pnpm run lock:check && node harness/scripts/dupes.ts` |
| `pnpm run docs:check` | `pnpm run lock:check && node harness/scripts/gen-docs.ts --check` |
| `pnpm run deadcode` | `pnpm run lock:check && knip --config knip.config.ts --production --treat-config-hints-as-errors && knip --config knip.config.ts --treat-config-hints-as-errors` |
| `pnpm run build:check` | `pnpm run lock:check && node harness/scripts/build-check.ts` |
| `pnpm run test` | `pnpm run lock:check && vitest run --config vitest.gate.config.ts --coverage && node harness/scripts/coverage-floor.ts` |
| `pnpm run test:browser` | `pnpm run lock:check && playwright test -c packages/characterisation/playwright.characterisation.config.ts --grep-invert @performance && playwright test -c packages/characterisation/playwright.characterisation.config.ts --grep @performance --workers=1 && playwright test -c experiences/sandbox/playwright.sandbox.config.ts` |
| `pnpm run test:stress` | `pnpm run lock:check && node harness/scripts/stress.ts` |
| `pnpm run fix` | `oxlint -c oxlint.config.ts --fix && oxfmt && node harness/scripts/gen-docs.ts` |
<!-- end: tasks -->

## Shipped checks

Each check module under `harness/checks/` declares its `HARNESS_ID`; `pnpm run fix` writes this
list.

<!-- generated: checks -->
- `boundaries` (`harness/checks/boundaries.test.ts`): The module boundaries hold: oxlint refuses each import a role may not make, and no production module imports a non-production one.
- `build-check` (`harness/checks/build-check.test.ts`): The gate builds every held Vite app in check mode, and a build that fails or writes into the checkout fails.
- `clones` (`harness/checks/clones.test.ts`): `harness/scripts/dupes.ts` finds a planted clone at its floor and past it, and fails when jscpd scans less than git lists.
- `contract-widening` (`harness/checks/contract-widening.test.ts`): A contract union is never widened to `string`, and its words are not respelled outside its owner.
- `coverage-floor` (`harness/checks/coverage-floor.test.ts`): The coverage floor fails an untaken branch, an uncalled function and an unrun line, on all four metrics, and its debt fails both ways.
- `deadcode` (`harness/checks/deadcode.test.ts`): `knip`, at its strictest, finds no unused file, dependency or export in production mode or default mode, and every ignore entry carries its reason.
- `declared-sets` (`harness/checks/declared-sets.test.ts`): Every closed set of words has one owner: no two production type aliases declare the same union of
- `doc-references` (`harness/checks/doc-references.test.ts`): Every reference in current text resolves: links and anchors, backticked paths, tasks, ADRs and commands.
- `doubles` (`harness/checks/doubles.test.ts`): A scripted double fails its test on an unscripted call, even when the code under test catches it.
- `exemption-lists` (`harness/checks/exemption-lists.test.ts`): Every literal list a check consults is an exemption declaration, and every declaration is consulted.
- `flake-hunter` (`harness/checks/flake-hunter.test.ts`): The flake hunter fails a test that passes only in its usual order or only when nothing runs beside it.
- `gate` (`harness/checks/gate.test.ts`): The gate writes no file, runs only locked tools, and the git hooks run the gate's own tasks.
- `generated-docs` (`harness/checks/generated-docs.test.ts`): Every generated block of the docs equals a fresh render, names a known generator, and every generator has a block.
- `history-narration` (`harness/checks/history-narration.test.ts`): Current text describes the project as it is: no comment or doc narrates how it got there.
- `isolation` (`harness/checks/isolation.test.ts`): A test that leaves a timer pending when it ends fails, and the next test starts clean.
- `json-files` (`harness/checks/json-files.test.ts`): Every held JSON file is strict JSON a reader cannot misread, and no manifest lists a dependency twice.
- `knip-config` (`harness/checks/knip-config.test.ts`): Knip's configuration gives each member a workspace of its own files, and knip reports an orphan under it.
- `lint-settings` (`harness/checks/lint-settings.test.ts`): oxlint, under this project's settings, fails each planted violation of a rule the harness rests on.
- `manifest-reads` (`harness/checks/manifest-reads.test.ts`): No harness module reads a `package.json` itself but the population's reading of the manifests.
- `network-guard` (`harness/checks/network-guard.test.ts`): A test that connects to, looks up or fetches a host other than this machine trips the network guard.
- `node-floor` (`harness/checks/node-floor.test.ts`): The Node running the suite, and the pinned `.node-version`, meet the floor `engines.node` declares.
- `one-claims` (`harness/checks/one-claims.test.ts`): Every claim of a single owner in current text is registered, and its probe holds it.
- `owner-registry` (`harness/checks/owner-registry.test.ts`): Each guarded API is used only by its owner module; the scan is proven on planted modules.
- `oxlint-config` (`harness/checks/oxlint-config.test.ts`): Oxlint's configuration names each member by its role, and oxlint lints exactly the held lintable files.
- `population` (`harness/checks/scope.test.ts`): The population: pnpm's workspace packages whose manifests git lists, less the POC, each with its role; every held module is TypeScript.
- `project-lint-rules` (`harness/checks/project-lint-rules.test.ts`): Every project lint rule fires on its must-fire fixtures and passes its must-stay-clean ones under the repository's oxlint.
- `pushed-subjects` (`harness/checks/pushed.test.ts`): The pre-push hook refuses a `fixup!`, `squash!` or `amend!` commit in the pushed range.
- `repo-paths` (`harness/checks/repo-paths.test.ts`): No harness module but `harness/lib/paths.ts` computes the repository root or a path from its own location.
- `retired-packages` (`harness/checks/retired-packages.test.ts`): No file of the workspace imports a retired package, and no manifest depends on one.
- `scan-sets` (`harness/checks/scan-sets.test.ts`): The file listing is over its floor, and every held TypeScript file is reached by every tool's scan set.
- `skips` (`harness/checks/skips.test.ts`): Every skip in the tests is listed with its reason, so a test cannot stop running unnoticed.
- `structure` (`harness/checks/structure.test.ts`): No module is both `.ts` and `.tsx`, and no build output is committed under the held roots.
- `stylesheets` (`harness/checks/stylesheets.test.ts`): Every stylesheet passes stylelint, reads raw values only through design tokens, and every class and custom property it names is used.
- `suppressions` (`harness/checks/suppressions.test.ts`): Every suppression names its rule, a tool that checks the file, and its reason, and each is counted.
- `terms` (`harness/checks/terms.test.ts`): No current text uses a retired term or a refused pattern of `docs/terms.toml`.
- `test-globs` (`harness/checks/test-globs.test.ts`): The gate's Vitest globs: a shipping member's tests are collected and its sources covered.
- `tool-exemptions` (`harness/checks/tool-exemptions.test.ts`): Every tool exemption is live: each ignore, override, include and exclude glob matches a listed file.
- `tool-upgrades` (`harness/checks/tool-upgrades.test.ts`): Every pinned tool has its upstream repository named, and every named repository pins a tool.
- `type-exports` (`harness/checks/type-exports.test.ts`): An exported type is read by another production module (or a harness check) or carries `@public`.
- `typecheck-settings` (`harness/checks/typecheck-settings.test.ts`): `tsc`, under this project's settings, fails each planted typing hole a setting closes, and passes it once that setting is removed.
- `vitest-settings` (`harness/checks/vitest-settings.test.ts`): Vitest, under this project's settings, fails each planted test a bare configuration would pass.
<!-- end: checks -->

## doc-references: Every reference in current text resolves

- **Holds:** a relative link names a listed file or directory and its anchor a heading of that
  file; a backticked path names a listed file or directory (from the root, from the doc's folder,
  or as the tail of a listed path), an installed `node_modules/` path or package; `pnpm run <task>`
  names a root script; `ADR-NNNN` names a decision record; a shell fence runs a locked tool through
  `pnpm exec` or `pnpm run`.
- **Owner:** `harness/lib/docs.ts` reads current text; `harness/checks/doc-references.test.ts`
  resolves it.
- **Write it:** reference what exists. A reference written before its target exists is an entry
  of the check's exemption list with its reason; it fails as stale once the target lands.
- **Planted test:** a missing file, a missing anchor, a missing package, an unknown task, an ADR
  with no record and a bare or unlocked tool in a shell fence each fail; a placeholder span, a
  path from the doc's folder and a tail path pass.
- **No-op when:** never.

## terms: No current text uses a retired term or a refused pattern

- **Holds:** no retired term of `docs/terms.toml` appears as a whole word in prose outside code
  spans, and no refused pattern appears in current text (`[refused]`) or in the comments of code
  (`[refused-in-code]`).
- **Owner:** `docs/terms.toml` holds the vocabulary; `harness/checks/terms.test.ts` reads it.
- **Write it:** retire a term with its replacement; refuse a pattern with where it belongs. Quote
  a retired name in a code span where the text compares it.
- **Planted test:** a retired term, a refused pattern in prose and in a span, and a code-only
  pattern in code fail; a plural, a quotation and the code-only pattern in a doc pass.
- **No-op when:** `docs/terms.toml` is empty.

## history-narration: Current text narrates no history

- **Holds:** no comment or doc of current text says how the project got here: the refused
  phrases, and an ISO date in a comment of code.
- **Owner:** `harness/checks/history-narration.test.ts`; `harness/lib/docs.ts` names the history
  files the scan leaves out.
- **Write it:** describe the code as it is; history belongs in commits, issues and the closed task
  records.
- **Planted test:** each refused phrase and a date in a comment fail; near misses
  (`no longer than`, a date in a doc) pass.
- **No-op when:** never.

## one-claims: Every claim of a single owner is registered and holds

- **Holds:** every clause of current text claiming a single owner (`the one owner`, `nowhere else`,
  `stated once`) is registered in `CLAIMS` with a probe, and the probe matches in the owner and in
  no other held TypeScript file under its roots.
- **Owner:** `harness/lib/claims.ts`.
- **Write it:** a new claim adds a `Claim` whose probe is a pattern only the owner can match, such
  as the owner's defining line.
- **Planted test:** an unregistered claim, an entry whose claim is gone, and a probe matching
  outside its owner or not in it each fail; a phrase in a code span is a quotation.
- **No-op when:** current text makes no claim.

## generated-docs: Every generated block of the docs is current

- **Holds:** every generated block equals a fresh render, names a known generator, and every
  generator has a block; the markers pair up. A block renders the same under any process locale:
  the check renders under the gate's locale and under Lithuanian, whose collation orders letters
  otherwise, so every block is ordered by code unit.
- **Owner:** `GENERATORS` in `harness/lib/generated.ts`, run by `harness/scripts/gen-docs.ts`.
- **Write it:** a new generated table adds a generator and a pair of markers in the doc that shows
  it; `pnpm run fix` writes it.
- **Planted test:** a hand-edited block is stale and rendering restores it; an unknown block name
  is refused and left as it is; a generator with no block and an unpaired marker fail.
- **No-op when:** never.

## tool-upgrades: Choosing, reading and taking a tool upgrade

Every pinned tool has its upstream repository in `UPSTREAM` (`harness/lib/upstream.ts`); `pnpm run fix`
writes this table from `package.json` and `pnpm-lock.yaml`. **Pinned in** names every input that pins
the tool at that version: a `package.json` field, or `pnpm-lock.yaml` with the importers that lock it,
`.` being the root's (`pnpm-lock.yaml (., experiences/sandbox)`).

<!-- generated: pins -->
| Tool | Upstream | Pinned in | Pin |
| --- | --- | --- | --- |
| `@ai-sdk/anthropic` | [vercel/ai](https://github.com/vercel/ai) | `pnpm-lock.yaml (.)` | 4.0.106 |
| `@ai-sdk/google` | [vercel/ai](https://github.com/vercel/ai) | `pnpm-lock.yaml (.)` | 4.0.122 |
| `@ai-sdk/openai` | [vercel/ai](https://github.com/vercel/ai) | `pnpm-lock.yaml (.)` | 4.0.121 |
| `@axe-core/playwright` | [dequelabs/axe-core-npm](https://github.com/dequelabs/axe-core-npm) | `pnpm-lock.yaml (.)` | 4.14.0 |
| `@commitlint/cli` | [conventional-changelog/commitlint](https://github.com/conventional-changelog/commitlint) | `pnpm-lock.yaml (.)` | 21.2.4 |
| `@commitlint/config-conventional` | [conventional-changelog/commitlint](https://github.com/conventional-changelog/commitlint) | `pnpm-lock.yaml (.)` | 21.2.4 |
| `@double-great/stylelint-a11y` | [double-great/stylelint-a11y](https://github.com/double-great/stylelint-a11y) | `pnpm-lock.yaml (.)` | 3.8.3 |
| `@iarna/toml` | [iarna/iarna-toml](https://github.com/iarna/iarna-toml) | `pnpm-lock.yaml (.)` | 2.2.5 |
| `@playwright/test` | [microsoft/playwright](https://github.com/microsoft/playwright) | `pnpm-lock.yaml (.)` | 1.65.1 |
| `@solidjs/compiler` | [solidjs/solid](https://github.com/solidjs/solid) | `pnpm-lock.yaml (experiences/sandbox, packages/characterisation)` | 2.0.2 |
| `@solidjs/vite-plugin` | [solidjs/vite-plugin-solid](https://github.com/solidjs/vite-plugin-solid) | `pnpm-lock.yaml (., experiences/sandbox, packages/characterisation)` | 3.0.1 |
| `@types/iarna__toml` | [DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | `pnpm-lock.yaml (.)` | 2.0.5 |
| `@types/node` | [DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | `pnpm-lock.yaml (.)` | 26.6.6 |
| `@vitest/coverage-v8` | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | `pnpm-lock.yaml (.)` | 5.1.1 |
| `@viz-js/viz` | [mdaines/viz-js](https://github.com/mdaines/viz-js) | `pnpm-lock.yaml (.)` | 3.31.0 |
| `ai` | [vercel/ai](https://github.com/vercel/ai) | `pnpm-lock.yaml (.)` | 7.0.177 |
| `eslint` | [eslint/eslint](https://github.com/eslint/eslint) | `pnpm-lock.yaml (.)` | 10.15.0 |
| `eslint-plugin-solid` | [solidjs-community/eslint-plugin-solid](https://github.com/solidjs-community/eslint-plugin-solid) | `pnpm-lock.yaml (.)` | 0.20.0 |
| `fast-check` | [dubzzz/fast-check](https://github.com/dubzzz/fast-check) | `pnpm-lock.yaml (.)` | 4.10.3 |
| `happy-dom` | [capricorn86/happy-dom](https://github.com/capricorn86/happy-dom) | `pnpm-lock.yaml (.)` | 21.0.4 |
| `inkjs` | [y-lohse/inkjs](https://github.com/y-lohse/inkjs) | `pnpm-lock.yaml (., experiences/sandbox)` | 2.4.0 |
| `jscpd` | [kucherenko/jscpd](https://github.com/kucherenko/jscpd) | `pnpm-lock.yaml (.)` | 5.4.2 |
| `knip` | [webpro-nl/knip](https://github.com/webpro-nl/knip) | `pnpm-lock.yaml (.)` | 6.44.1 |
| `lefthook` | [evilmartians/lefthook](https://github.com/evilmartians/lefthook) | `pnpm-lock.yaml (.)` | 2.2.2 |
| `node` | [nodejs/node](https://github.com/nodejs/node) | `package.json engines` | >=22.18.0 |
| `oxfmt` | [oxc-project/oxc](https://github.com/oxc-project/oxc) | `pnpm-lock.yaml (.)` | 0.79.0 |
| `oxlint` | [oxc-project/oxc](https://github.com/oxc-project/oxc) | `pnpm-lock.yaml (.)` | 1.94.0 |
| `oxlint-tsgolint` | [oxc-project/tsgolint](https://github.com/oxc-project/tsgolint) | `pnpm-lock.yaml (.)` | 7.0.2007 |
| `pnpm` | [pnpm/pnpm](https://github.com/pnpm/pnpm) | `package.json packageManager` | 10.28.0 |
| `remark-parse` | [remarkjs/remark](https://github.com/remarkjs/remark) | `pnpm-lock.yaml (.)` | 11.0.0 |
| `sharp` | [lovell/sharp](https://github.com/lovell/sharp) | `pnpm-lock.yaml (.)` | 0.35.5 |
| `stylelint` | [stylelint/stylelint](https://github.com/stylelint/stylelint) | `pnpm-lock.yaml (.)` | 17.16.0 |
| `stylelint-config-standard` | [stylelint/stylelint-config-standard](https://github.com/stylelint/stylelint-config-standard) | `pnpm-lock.yaml (.)` | 40.0.0 |
| `stylelint-declaration-strict-value` | [AndyOGo/stylelint-declaration-strict-value](https://github.com/AndyOGo/stylelint-declaration-strict-value) | `pnpm-lock.yaml (.)` | 1.12.1 |
| `stylelint-no-unsupported-browser-features` | [RJWadley/stylelint-no-unsupported-browser-features](https://github.com/RJWadley/stylelint-no-unsupported-browser-features) | `pnpm-lock.yaml (.)` | 8.1.2 |
| `stylelint-order` | [hudochenkov/stylelint-order](https://github.com/hudochenkov/stylelint-order) | `pnpm-lock.yaml (.)` | 8.1.3 |
| `stylelint-plugin-logical-css` | [yuschick/stylelint-plugin-logical-css](https://github.com/yuschick/stylelint-plugin-logical-css) | `pnpm-lock.yaml (.)` | 2.1.0 |
| `typescript` | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | `pnpm-lock.yaml (.)` | 7.0.2 |
| `unified` | [unifiedjs/unified](https://github.com/unifiedjs/unified) | `pnpm-lock.yaml (.)` | 11.0.5 |
| `unist-util-visit` | [syntax-tree/unist-util-visit](https://github.com/syntax-tree/unist-util-visit) | `pnpm-lock.yaml (.)` | 5.2.0 |
| `vite` | [vitejs/vite](https://github.com/vitejs/vite) | `pnpm-lock.yaml (.)` | 8.3.8 |
| `vitest` | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | `pnpm-lock.yaml (.)` | 5.1.1 |
| `xstate` | [statelyai/xstate](https://github.com/statelyai/xstate) | `pnpm-lock.yaml (.)` | 5.33.4 |
| `yaml` | [eemeli/yaml](https://github.com/eemeli/yaml) | `pnpm-lock.yaml (.)` | 2.9.1 |
| `zod` | [colinhacks/zod](https://github.com/colinhacks/zod) | `pnpm-lock.yaml (.)` | 4.6.7 |
<!-- end: pins -->
