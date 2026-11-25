# Project lint rules

An oxlint JS plugin, `aricanga`, for the rules no shipped oxlint or `eslint-plugin-solid` rule
holds. `oxlint.config.ts` loads `plugin.ts` directly: Node strips its types, so the rules are
TypeScript checked by the harness's own project. Every rule is on as an error, and
`harness/checks/project-lint-rules.test.ts` proves each one on its fixtures.

The modules import each other as `#lint-rules/…`. This folder's own `package.json` maps that
prefix, so the plugin also loads where a check copies the folder into a planted project, outside
the repository's root manifest. `ast.ts` holds the node and context helpers and `jsx.ts` the JSX
ones, and `closed.ts` the readers the closed-set rules share; `rules/jsx-rules.ts`,
`rules/module-rules.ts` and `rules/closed-rules.ts` collect the rules for `plugin.ts`.

| Rule | Holds |
|---|---|
| `aricanga/autofocus` | No autofocus or autoFocus attribute; move focus on navigation instead. |
| `aricanga/controlled` | A bound value/checked/selected only on an element that handles its change. |
| `aricanga/env` | No process.env read outside the settings owners (the `owners` globs). |
| `aricanga/flags` | No loading/error signal in a component; read the state from the view-model. |
| `aricanga/json` | Import JSON with { type: 'json' }. |
| `aricanga/labels` | A label has `for` or wraps its control; `htmlFor` is the React spelling. |
| `aricanga/legacy` | No replaceChildren or document.createElement in a component module. |
| `aricanga/mechanics` | No solid-js or @solidjs/* import in a mechanics module (the `files` globs: a foundation member, a system model). |
| `aricanga/mirrors` | No effect whose only work is calling a setter; derive the value. |
| `aricanga/own-keys` | A record keyed by story words is read through its own entries: Object.hasOwn, never in or a defaulted read. |
| `aricanga/statics` | No this inside a static method, static field or static block; name the class. |
| `aricanga/store-owner` | createStore and reconcile only in the snapshot adapter (the `owners` globs). |
| `aricanga/style-prop` | No style prop in JSX; set dynamic values with a class or a ref. |
| `aricanga/sync-parts` | No async, await, promise, .then or <Loading> in a component module. |
| `aricanga/total-reads` | A closed set is read through a total table or an exhaustive switch, not a chain or an inline list. |
| `aricanga/view-imports` | A view module imports no reduce, no effect type and no model module. |
| `aricanga/vm-prop` | A component takes a single undestructured props with exactly one prop, vm. |

## Fixtures

`fixtures/<rule>/fire[-<case>].fixture` must make its rule fire; `fixtures/<rule>/clean[-<case>].fixture`
must pass the whole configuration with no finding. The first line, `// path: <path>`, is where the
check plants the source; a rule scoped by path is proven at a path it holds. A fixture is text, so
the repository's own tools never lint or compile a must-fire case.

## Options

- `ignore`: globs of `.tsx` modules a component rule does not hold. The component rules ignore
  `packages/characterisation/**`, whose fixtures do on purpose what a part must not, to record how
  Solid answers.
- `owners`: globs of the modules allowed what the rule refuses. `env` names the harness's process
  and tool owners; `store-owner` names `**/snapshot-adapter.ts` and the characterisation suite.

## Where other rules hold the rest

- Module boundaries and reducer purity are `no-restricted-imports`, `no-restricted-globals` and
  `no-restricted-properties` overrides derived from the population's roles
  (`harness/lib/import-boundaries.ts`, `harness/lib/oxlint-config.ts`), proven by
  `harness/checks/boundaries.test.ts`.
- Destructured props, reactivity and the rest of Solid's own rules are `eslint-plugin-solid`'s
  v2-strict set.
- jsx-a11y's `label-has-associated-control` knows only `htmlFor` and has no option for Solid's
  `for`, and its `no-autofocus` sees only `autoFocus`; `labels` and `autofocus` take their place.
- kiz-radar's `thens` (no `.then` in components) is part of `sync-parts`.
- A two-argument `.then`, whose rejection handler misses errors thrown in the first, is
  `promise/prefer-catch`'s, proven by a `lint-settings` plant.
- Some must-fire cases are also refused by a shipped rule, and their fixtures show both:
  `node/no-process-env` (a `process.env` read),
  `promise/prefer-await-to-then` and `solid/reactivity` (promise work in a part),
  `solid/no-react-specific-props` (`htmlFor`) and `solid/no-destructure` (destructured props).
- closedworld's shape rules: `total-reads` and `own-keys` are here, and the `declared-sets` check
  holds one declaration per closed set across modules, which no per-file rule can see. Shipped
  rules hold the rest, each proven by a `lint-settings` plant: `typescript/switch-exhaustiveness-check`
  refuses a switch whose `default` hides a member of its union, `typescript/no-unnecessary-condition`
  a defaulted read of a total table, and `typescript/no-unsafe-type-assertion` a cast into a union
  outside a parser; the compiler refuses a `Record<Union, …>` table missing a member. A table of
  fixed keys typed `Record<string, …>` is not refused: the shape is as often the set's own
  declaration (a rule registry, a plant table) as a restatement, and only a type-aware check can
  tell them apart.
- kiz-radar's `markup`, `classes`, `buttons` and `clicks` are not ported: its task 4.10 may retire
  them in favour of rules Solid or oxlint already ship.
