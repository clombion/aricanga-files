# Coherence Guide

How to verify that your story is structurally sound and narratively consistent.

---

## Two Types of Coherence

### Structural Coherence

The code works correctly:
- Ink compiles without errors
- Tags follow the schema
- Config matches ink knots and variables
- Components render properly

**Verification:** Automated linters and tests

### Narrative Coherence

The story makes sense:
- All paths are reachable via intended progression
- Choices have appropriate consequences
- Time flows consistently
- Cross-chat triggers work as designed

**Verification:** QA tools + manual review

---

## Structural Coherence Checks

### CQO-1: Ink Compiles Clean

Every ink file must compile without errors:

```bash
mise run lint:ink
```

**What it catches:**
- Syntax errors
- Missing knots/stitches
- Invalid diverts
- Undeclared variables

### CQO-2: Tag Schema Compliance

Only approved tags are allowed:

```bash
mise run lint:tags
```

**Approved tags:** `speaker`, `type`, `time`, `date`, `delay`, `image`, `audio`, `duration`, `presence`, `connection`, `status:*`, `story_start`, `clear`, `view`, `class`

**What it catches:**
- Typos in tag names
- Unsupported tags
- Missing required values

### Contract Tests

Config must match ink:

```bash
pnpm exec playwright test tests/contract/contracts.spec.ts
```

**What it checks:**
- Every `knot_name` in config exists in ink
- No orphan configurations

### CQO-7: Component Encapsulation

Components use Shadow DOM properly:

```bash
mise run lint:dom
```

**What it catches:**
- DOM manipulation outside components
- Missing Shadow DOM boundaries

---

## Narrative Coherence Checks

### Path Reachability (Coverage Analysis)

Can players reach all content?

```bash
mise run test:coverage
```

**Output:**
```
Most visited:
  1714 - pat_chat.ask_angle
   552 - notes_chat.continue_research

Unreached (gray in heatmap):
  pat_chat.waiting (pat.ink)
  spectre_chat.silent (spectre.ink)
```

**Interpreting results:**

| Visit Count | Meaning |
|-------------|---------|
| High (1000+) | Early state, every playthrough |
| Medium (100-999) | Sometimes reached |
| Low (1-99) | Requires specific choices |
| Zero (0) | Gated OR broken |

**Zero visits isn't always bad.** Progression-gated states can't be reached by random clicking.

### Choice Consequence Analysis

Do choices actually matter?

```bash
mise run test:guided
```

**Output:**
```
CHOICE CONSEQUENCE ANALYSIS
Total choices: 17
  With consequences: 6 (affect story variables)
  Cosmetic only: 11 (dialogue flavor)
```

**What to check:**
- Important choices should have consequences
- Cosmetic choices are fine for player expression
- No "fake" choices that claim consequences but don't set flags

### Time Coherence (CQO-13)

Time never goes backward:

```bash
pnpm exec playwright test tests/e2e/time-coherence.spec.ts
```

**Rules:**
1. Phone clock = earliest message time on chat entry
2. First message after `# story_start` MUST have `# time:` tag
3. Time never decreases within a session

### Cross-Chat Triggers (CQO-3)

Cross-chat messages (`# targetChat:`) produce notifications and badges:

```bash
mise run test:e2e
```

**What it checks:**
- Cross-chat message sets unread badge
- Notification toast appears (via drawer → popup)
- Alert suppressed when viewing target chat

---

## Validation Commands Reference

| Command | Checks |
|---------|--------|
| `mise run lint:ink` | Ink compilation |
| `mise run lint:tags` | Tag schema |
| `mise run lint:css` | CSS variables |
| `mise run lint:dom` | Component encapsulation |
| `mise run lint` | All linters |
| `mise run test:coverage` | Random path coverage |
| `mise run test:guided` | Guided path verification |
| `mise run test:e2e` | Full E2E tests |
| `mise run test:a11y` | Accessibility |
| `mise run check` | Everything |

---

## Interpreting QA Output

### Reading the Heatmap

Run `mise run ink:heatmap:svg` to generate `docs/story-heatmap.svg`.

**Color guide:**

| Color | Meaning | Action |
|-------|---------|--------|
| **Red** | Hot (>50% of max) | Expected early state |
| **Yellow** | Warm (10-50%) | Sometimes reached |
| **Green** | Cold (<10%) | Rare but reachable |
| **Gray** | Unreached (0) | Verify intentional |

**Numbers show visit count:**
```
ask_angle (1714)  ← visited 1714 times
waiting (0)       ← never reached
```

### Reading the Story Graph

Run `mise run ink:graph:svg` to generate `docs/story-graph.svg`.

**Legend:**

| Shape | Meaning |
|-------|---------|
| **Rectangle (bold)** | Knot entry point |
| **Oval** | Stitch within knot |
| **Arrow** | Divert (transition) |
| **Colored box** | Groups states from one file |
| **Red dashed line** | Cross-chat dependency |

**Cross-chat dependencies** show when one chat sets a variable that another chat reads.

### Understanding Transcript Diffs

Run `mise run test:guided --split` for individual path transcripts.

Compare paths to find differences:
```bash
diff docs/transcripts/golden.md docs/transcripts/no_maria.md
```

**What to look for:**
- Dialogue that assumes previous context
- Character reactions that don't match player actions
- Missing content in alternate paths

---

## Debugging Workflow

### When Something Doesn't Work

1. **Run heatmap** - identify gray (unreached) states
2. **Check graph** - verify arrows point to the gray state
3. **Run dead-code lint** - check for unused variables
4. **Use debug panel** - manually set flags and test

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| State shows 0 visits | Broken routing or gated | Check conditionals |
| "Assigned but never read" | Forgot to use a flag | Add check or remove flag |
| State was reachable, now gray | Recent change broke path | Review recent edits |
| All states in chat are gray | Entry condition wrong | Check knot entry conditional |

### Using the Debug Panel

Access at `http://localhost:8000/experiences/aricanga/?debug`

**Variable Viewer:**
- Shows all ink variables
- Click booleans to toggle
- Changes take effect immediately

**Quick Actions:**
- Skip to Draft - Sets flags to draft phase
- Skip to Publish - Sets flags to publication
- Reset All - Clear progress
- Trigger All Unread - Light up all chat notification badges

---

## Story Health Metrics

### Healthy Linear Story

```
Random agent coverage: ~20%
├── Early states (before choices): high visits
├── Choice-dependent states: some visits
└── Late-game states: 0 visits (expected)
```

### Healthy Branching Story

```
Random agent coverage: ~40-60%
├── Common paths: high visits
├── Branch-specific states: lower visits
└── Rare endings: very low visits
```

### Warning Signs

| Pattern | Problem |
|---------|---------|
| Early state = 0 visits | Broken routing |
| Variable never read | Dead code |
| Suddenly gray state | Recent regression |
| All chat states gray | Entry condition broken |

---

## Pre-Release Checklist

Before shipping:

- [ ] `mise run check` passes
- [ ] Heatmap shows expected coverage pattern
- [ ] All key paths verified via guided agent
- [ ] Transcripts reviewed for narrative coherence
- [ ] Debug panel tested all skip scenarios
- [ ] Cross-chat triggers work (notification + badge)
- [ ] Time flows forward consistently

---

## Test Harness Coverage

| What's Tested | Test File | Coverage |
|---------------|-----------|----------|
| Messages appear in correct chat | invariants.spec.ts | INV-1 |
| Choices only in owner chat | invariants.spec.ts | INV-2 |
| No duplicate messages | message-sequence.spec.ts | Full |
| Message order preserved | message-sequence.spec.ts | Full |
| Cross-chat notifications | cross-chat-state.spec.ts | Full |
| Notification → navigation | cross-chat-state.spec.ts | Full |
| Notification drawer click removal | cross-chat-state.spec.ts | Full |
| Clicked popup skips drawer | cross-chat-state.spec.ts | Full |
| Config matches ink knots | contracts.spec.ts | Full |
| Accessibility (a11y) | accessibility.spec.ts | WCAG AA |

**Test Gaps:**
- No automated test for timing accuracy (manual: delays within 500ms)
- No test for choice text content (only structure)
- Color contrast needs theme fix (tracked, not blocking)

---

## Related

- [CQO Reference](../../reference/cqo.md) - Quality objectives details
- [QA Tools Reference](../../reference/qa-tools.md) - Command documentation
- [Writing Guide](../writers/writing-guide.md) - Authoring reference
