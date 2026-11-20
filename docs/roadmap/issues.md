# Issues

Work is tracked in [GitHub Issues](https://github.com/clombion/aricanga-files/issues).
The repository holds every task, bug and decision; there is no project board.

## Two axes on every issue

**Type** says what kind of work it is:

| Type | For |
|---|---|
| Feature | a capability (the default) |
| Bug | something that works wrongly |
| Devx | tooling, tests, CI and developer workflow |
| Devops | deploy, serving, pipeline automation and monitoring |
| Docs | documentation, ADRs, definitions |
| Decision | a question needing a recommendation and a sign-off, or a check needing a method and a pass criterion (phase proofs, characterisation) |
| Task | non-code admin and tidying only |
| Epic | a container |
| Sprint | a pointer issue whose `- [ ] #n` checklist tracks the work in a sprint |

**Domain labels** say what it touches. Every issue carries at least one, and the
label decides what the body is grounded in:

| Label | Covers | The body is grounded in |
|---|---|---|
| `kernel` | foundation algebra, reducers, snapshots, save state | one real story path traced through input → state → effect |
| `chat`, `phone`, `cards` | a system vocabulary | the same, within that vocabulary |
| `ui` | Solid parts, adapter, tokens, effect executor | the current flow and the new one |
| `a11y` | accessibility | the user task and the assistive-tech behaviour checked |
| `build` | the content pipeline | one content entity traced from source to the emitted world |
| `content` | ink, TOML, assets | the story files and knots involved |
| `i18n` | locales and translation | the locales and keys involved |
| `qa` | tests, harness checks, proofs | the claim being checked and the method |
| `poc` | the legacy reference code | what the POC holds and what replaces it |

**Experience labels** (`exp:aricanga`, `exp:sandbox`, `exp:desktop-chat`,
`exp:cards-on-phone`) mark an issue whose acceptance criteria name that
experience. Framework-generic work carries none.

## Structure

- Every issue is a sub-issue of an epic. Epics are rare thematic slices:
  the kernel ([#6](https://github.com/clombion/aricanga-files/issues/6)), the
  view layer ([#7](https://github.com/clombion/aricanga-files/issues/7)), the
  harness and tooling ([#8](https://github.com/clombion/aricanga-files/issues/8)),
  the build pipeline ([#9](https://github.com/clombion/aricanga-files/issues/9)),
  the seam-proof experiences ([#10](https://github.com/clombion/aricanga-files/issues/10))
  and retiring the POC ([#11](https://github.com/clombion/aricanga-files/issues/11)).
  List them before filing and put the issue under the theme it serves; a new
  epic is only for a genuinely new theme, and its body maps its children, its
  outcome, and what is in and out of it.
- One outcome is one issue. Parts with no value alone are acceptance-checklist
  items; the PRs are the delivery split.
- Milestones are priority slices (Foundation, Parity, Seam proofs), never order.
- Order is a blocked-by relation, and the body's `## Blocked by` section gives
  each blocker's reason: file overlap, a semantic dependency, or sequencing.
- Status is open or closed, plus the `in progress` label while work is active.
- An issue touched without a type or a parent epic gets both.

## The body

- **Title:** imperative and verb-first, no prefix, no codes, no trailing period.
- **Opening:** what the issue delivers or asks, grounded as its labels require.
- **`## Acceptance criteria`:** an unticked checklist; the PR that closes the
  issue mirrors it one for one in its test plan, with each criterion's test
  tagged by the [taxonomy](testing-strategy.md).
- **`## Details`:** symbols, files, test tags.
- **`## Blocked by`:** each blocker with its reason.
- Describe the work as it stands; specify rather than persuade; cite symbols,
  not line numbers. The mechanism belongs in docs and code, not in the issue.

## Process

Ask before filing or editing an issue: report the finding with its numbers,
propose the issue (type, labels, epic, title), and wait for a yes. Closed work
from before the issues existed is in [`tasks/`](tasks/README.md).
