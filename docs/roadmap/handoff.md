# Handoff: the rebuild at Phase 3, Step 2

The state of the rebuild for the agent that takes it over. Read [AGENTS.md](../../AGENTS.md) first:
its rules (the gate, seen-failing, the hand-back, tests that can fail) hold every change. The
checks are in [harness.md](../../harness.md) and which ones exist in
[HARNESS_STATUS.md](../../HARNESS_STATUS.md). Work is tracked in GitHub Issues as
[issues.md](issues.md) describes; ask the owner before filing or editing one.

## Where the work is

**feat/rebuild-phase-3-view** holds every change below and passes the whole gate, `pnpm run check`:
lint, format, typecheck, dupes, docs, dead code, the build check, every unit and harness test with
the coverage floor's debt list empty, and the browser suite in all five projects. Work continues on
a branch off it, merged back when the gate passes; the pre-push hook runs the gate. Every commit
ends with the session's `Claude-Session:` line and carries no `Co-Authored-By`.

## What the branch holds

- **Kernel** (`packages/foundation`, `packages/systems/*`): a pure reducer and view per system
  behind the `System` contract of ADR-0007. A system parses its own inbound commands and restored
  state (`parseCommand`, `parseState`, refusing with `InputRefusedError`); the registry's erased
  `AnySystem` is built from closures, and `stateOf`/`reclaim` holds its only cast, proved by the owner's id.
  `decodeSnapshot` parses a save's envelope. Effects are values the host executes through handler
  tables (`host/effects.ts`); `Host.fetchData(request, deliver)` delivers through a callback.
  Absence is `undefined`, never `null`.
- **View decision**: Solid 2.0 (ADR-0002), with its runtime characterised in three engines and
  five projects (`packages/characterisation`, ADR-0008). No Part exists yet; the sandbox still
  renders through the Phase 0 custom element in `experiences/sandbox/src/sk-message.ts`.
- **Harness**: about 35 checks under `harness/checks`, each with planted violations; the project
  oxlint plugin under `harness/lint-rules` (its README lists every rule); TypeScript 7 at its
  strictest, each setting proven by a plant.

## The lint configuration and what it forces

Every oxlint category is on at error (`.oxlintrc.json`). A rule is off only where it contradicts
an enabled rule or a tool's loader, and `harness/checks/lint-settings.test.ts` declares each one
with its reason (`TURNED_OFF`); add any new one there. Shapes the configuration forces, which every
change meets:

- One `export { … }` and one `export type { … }` at the end of a module; `func-style` declaration.
- `expect.hasAssertions()` opens every test (an exact `expect.assertions(n)` trips
  `no-magic-numbers`); booleans are asserted with `toBe(true)`/`toBe(false)`.
- A JSDoc tag carries its `{Type}`; a function with a JSDoc block documents every parameter and
  its return.
- Readonly parameter types; library node types (TypeScript, PostCSS) are on the rule's allow
  list.
- An async function forwarding a promise is written `const value = await …; return value;`.
- A record read by a key the story supplies goes through `Object.hasOwn` (`aricanga/own-keys`):
  a chat or a stat may be named `toString`.
- Imports use package subpath maps (`#src/…`, `#test/…`, `#lib/…`), never a parent path; inside
  `harness/lib` and `harness/lint-rules` imports are relative, because the planted projects copy
  those folders without the root `package.json`.
- Tests live under each package's `test/` with its own `tsconfig.json`: the type-aware linter
  types a file by its nearest config.
- oxfmt formats every held TypeScript, CSS and JSON file at a print width of 140. stylelint
  lints CSS, with every recommended Biome CSS rule held by its stylelint counterpart, and the
  `json-files` check holds JSON: duplicate and empty keys, unsafe numbers, and a dependency listed
  twice. [harness/lint-settings.md](../../harness/lint-settings.md) maps each Biome rule to its
  owner and gives each stylelint rule's setting with its reason.

## Decisions the owner has made

- No backward compatibility anywhere: a replaced rule, export or API is deleted, never aliased.
- Nothing in the codebase is less strict than production code, tests and scripts included; no
  scope management: a finding is fixed by refactoring when it must be.
- The POC (`packages/framework`, `packages/tests`, `packages/test-utils`, `experiences/aricanga`,
  `utils`) stays outside the harness until it is deleted (#50).
- `aricanga/promises` is retired; `promise/prefer-catch` holds its case.
- Biome is removed in favour of a stricter stylelint and a JSON check.

## Open questions for the owner

- Issue #20 (characterise Solid 2.0) and #12 (port the harness) are done; closing them is the
  owner's call.
- The labels `content`, `phone`, `a11y`, `i18n`, `in progress` and the `exp:` experience labels
  do not exist yet; #56 carries `qa` alone for that reason.

## Next

1. Phase 3 Step 3, the view layer on Solid: the keyed snapshot adapter (#28), the sandbox's
   baseline Part replacing its Phase 0 element (#24), the real-browser Part harness (#30), then the Parts of #31
   to #41. The `planned` rows of `HARNESS_STATUS.md` for the view layer (console guard, CSP bundle
   and frame, owners flat, part failure, typed classes, elements, layout) land with the first
   Parts.
2. The closedworld census layer, #51 to #56, in their blocked-by order.
