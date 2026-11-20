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
| `pnpm run lint` | `pnpm run lock:check && oxlint && biome ci --error-on-warnings && stylelint "**/*.css" --max-warnings 0` |
| `pnpm run format:check` | `pnpm run lock:check && oxfmt --check` |
| `pnpm run typecheck` | `pnpm run lock:check && node harness/scripts/typecheck.ts` |
| `pnpm run dupes` | `pnpm run lock:check && node harness/scripts/dupes.ts` |
| `pnpm run docs:check` | `pnpm run lock:check && node harness/scripts/gen-docs.ts --check` |
| `pnpm run deadcode` | `pnpm run lock:check && knip --production --treat-config-hints-as-errors && knip --treat-config-hints-as-errors` |
| `pnpm run build:check` | `pnpm run lock:check && node harness/scripts/build-check.ts` |
| `pnpm run test` | `pnpm run lock:check && vitest run --config vitest.gate.config.ts --coverage && node harness/scripts/coverage-floor.ts` |
| `pnpm run test:browser` | `pnpm run lock:check && playwright test -c packages/characterisation/playwright.characterisation.config.ts` |
| `pnpm run test:stress` | `pnpm run lock:check && node harness/scripts/stress.ts` |
| `pnpm run fix` | `oxlint --fix && oxfmt && biome check --write && node harness/scripts/gen-docs.ts` |
<!-- end: tasks -->

## Shipped checks

Each check module under `harness/checks/` declares its `HARNESS_ID`; `pnpm run fix` writes this
list.

<!-- generated: checks -->
- `doc-references` (`harness/checks/doc-references.test.ts`): Every reference in current text resolves: links and anchors, backticked paths, tasks, ADRs and commands.
- `gate` (`harness/checks/gate.test.ts`): The gate writes no file, runs only locked tools, and the git hooks run the gate's own tasks.
- `generated-docs` (`harness/checks/generated-docs.test.ts`): Every generated block of the docs equals a fresh render, names a known generator, and every generator has a block.
- `history-narration` (`harness/checks/history-narration.test.ts`): Current text describes the project as it is: no comment or doc narrates how it got there.
- `one-claims` (`harness/checks/one-claims.test.ts`): Every claim of a single owner in current text is registered, and its probe holds it.
- `pushed-subjects` (`harness/checks/pushed.test.ts`): The pre-push hook refuses a `fixup!`, `squash!` or `amend!` commit in the pushed range.
- `terms` (`harness/checks/terms.test.ts`): No current text uses a retired term or a refused pattern of `docs/terms.toml`.
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
  generator has a block; the markers pair up.
- **Owner:** `GENERATORS` in `harness/lib/generated.ts`, run by `harness/scripts/gen-docs.ts`.
- **Write it:** a new generated table adds a generator and a pair of markers in the doc that shows
  it; `pnpm run fix` writes it.
- **Planted test:** a hand-edited block is stale and rendering restores it; an unknown block name
  is refused and left as it is; a generator with no block and an unpaired marker fail.
- **No-op when:** never.

## tool-upgrades: Choosing, reading and taking a tool upgrade

Every pinned tool has its upstream repository in `UPSTREAM` (`harness/lib/pins.ts`); `pnpm run fix`
writes this table from `package.json` and `pnpm-lock.yaml`.

<!-- generated: pins -->
| Tool | Upstream | Pinned in | Pin |
| --- | --- | --- | --- |
| `@ai-sdk/anthropic` | [vercel/ai](https://github.com/vercel/ai) | `pnpm-lock.yaml` | 4.0.106 |
| `@ai-sdk/openai` | [vercel/ai](https://github.com/vercel/ai) | `pnpm-lock.yaml` | 4.0.121 |
| `@axe-core/playwright` | [dequelabs/axe-core-npm](https://github.com/dequelabs/axe-core-npm) | `pnpm-lock.yaml` | 4.14.0 |
| `@biomejs/biome` | [biomejs/biome](https://github.com/biomejs/biome) | `pnpm-lock.yaml` | 2.6.8 |
| `@commitlint/cli` | [conventional-changelog/commitlint](https://github.com/conventional-changelog/commitlint) | `pnpm-lock.yaml` | 21.2.4 |
| `@commitlint/config-conventional` | [conventional-changelog/commitlint](https://github.com/conventional-changelog/commitlint) | `pnpm-lock.yaml` | 21.2.4 |
| `@eslint/js` | [eslint/eslint](https://github.com/eslint/eslint) | `pnpm-lock.yaml` | 10.0.1 |
| `@iarna/toml` | [iarna/iarna-toml](https://github.com/iarna/iarna-toml) | `pnpm-lock.yaml` | 2.2.5 |
| `@narratives/framework` | no upstream named | `pnpm-lock.yaml` | link:packages/framework |
| `@narratives/test-utils` | no upstream named | `pnpm-lock.yaml` | link:packages/test-utils |
| `@playwright/test` | [microsoft/playwright](https://github.com/microsoft/playwright) | `pnpm-lock.yaml` | 1.65.1 |
| `@types/iarna__toml` | [DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | `pnpm-lock.yaml` | 2.0.5 |
| `@types/node` | [DefinitelyTyped/DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) | `pnpm-lock.yaml` | 26.6.6 |
| `@vitest/coverage-v8` | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | `pnpm-lock.yaml` | 5.1.1 |
| `ai` | [vercel/ai](https://github.com/vercel/ai) | `pnpm-lock.yaml` | 7.0.177 |
| `eslint` | [eslint/eslint](https://github.com/eslint/eslint) | `pnpm-lock.yaml` | 10.15.0 |
| `eslint-import-resolver-typescript` | [import-js/eslint-import-resolver-typescript](https://github.com/import-js/eslint-import-resolver-typescript) | `pnpm-lock.yaml` | 4.4.5 |
| `eslint-plugin-boundaries` | [javierbrea/eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries) | `pnpm-lock.yaml` | 7.4.4 |
| `eslint-plugin-solid` | [solidjs-community/eslint-plugin-solid](https://github.com/solidjs-community/eslint-plugin-solid) | `pnpm-lock.yaml` | 0.20.0 |
| `fast-check` | [dubzzz/fast-check](https://github.com/dubzzz/fast-check) | `pnpm-lock.yaml` | 4.10.3 |
| `happy-dom` | [capricorn86/happy-dom](https://github.com/capricorn86/happy-dom) | `pnpm-lock.yaml` | 21.0.4 |
| `inkjs` | [y-lohse/inkjs](https://github.com/y-lohse/inkjs) | `pnpm-lock.yaml` | 2.4.0 |
| `jscpd` | [kucherenko/jscpd](https://github.com/kucherenko/jscpd) | `pnpm-lock.yaml` | 5.4.2 |
| `knip` | [webpro-nl/knip](https://github.com/webpro-nl/knip) | `pnpm-lock.yaml` | 6.44.1 |
| `lefthook` | [evilmartians/lefthook](https://github.com/evilmartians/lefthook) | `pnpm-lock.yaml` | 2.2.2 |
| `node` | [nodejs/node](https://github.com/nodejs/node) | `package.json` | >=22.18.0 |
| `oxfmt` | [oxc-project/oxc](https://github.com/oxc-project/oxc) | `pnpm-lock.yaml` | 0.79.0 |
| `oxlint` | [oxc-project/oxc](https://github.com/oxc-project/oxc) | `pnpm-lock.yaml` | 1.94.0 |
| `oxlint-tsgolint` | [oxc-project/tsgolint](https://github.com/oxc-project/tsgolint) | `pnpm-lock.yaml` | 7.0.2007 |
| `remark-parse` | [remarkjs/remark](https://github.com/remarkjs/remark) | `pnpm-lock.yaml` | 11.0.0 |
| `sharp` | [lovell/sharp](https://github.com/lovell/sharp) | `pnpm-lock.yaml` | 0.35.5 |
| `stylelint` | [stylelint/stylelint](https://github.com/stylelint/stylelint) | `pnpm-lock.yaml` | 17.16.0 |
| `stylelint-config-standard` | [stylelint/stylelint-config-standard](https://github.com/stylelint/stylelint-config-standard) | `pnpm-lock.yaml` | 40.0.0 |
| `stylelint-no-unsupported-browser-features` | [RJWadley/stylelint-no-unsupported-browser-features](https://github.com/RJWadley/stylelint-no-unsupported-browser-features) | `pnpm-lock.yaml` | 8.1.2 |
| `stylelint-plugin-logical-css` | [yuschick/stylelint-plugin-logical-css](https://github.com/yuschick/stylelint-plugin-logical-css) | `pnpm-lock.yaml` | 2.1.0 |
| `typescript` | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) | `pnpm-lock.yaml` | 6.0.3 |
| `typescript-eslint` | [typescript-eslint/typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) | `pnpm-lock.yaml` | 8.73.0 |
| `unified` | [unifiedjs/unified](https://github.com/unifiedjs/unified) | `pnpm-lock.yaml` | 11.0.5 |
| `unist-util-visit` | [syntax-tree/unist-util-visit](https://github.com/syntax-tree/unist-util-visit) | `pnpm-lock.yaml` | 5.2.0 |
| `vite` | [vitejs/vite](https://github.com/vitejs/vite) | `pnpm-lock.yaml` | 8.3.8 |
| `vitest` | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | `pnpm-lock.yaml` | 5.1.1 |
<!-- end: pins -->
