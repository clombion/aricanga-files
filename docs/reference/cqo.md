# Code Quality Objectives (CQO) Reference

Full details for each CQO.

## Quick Reference

| # | Rule | Tier | Command |
|---|------|------|---------|
| 1 | Ink compiles clean | **Blocking** | `lint:ink` |
| 2 | Approved tags only | **Blocking** | `lint:tags` |
| 3 | Cross-chat triggers notifications | Test | `test:e2e` |
| 4 | Delays within 500ms | Test | Playwright |
| 5 | Complex ink has `// Why:` | **Blocking** | `lint:ink-comments` |
| 6 | ES modules, no var | Pre-commit | `lint:js` |
| 7 | Shadow DOM / CSS vars | **Blocking** | `lint:dom` |
| 8 | Accessibility (WCAG AA) | Test | `test:a11y` |
| 9 | No hardcoded colors | Warning | `lint:css` |
| 10 | Single responsibility (500 lines) | Warning | Stop hook |
| 11 | One chat per file | Warning | Stop hook |
| 12 | Explicit imports/globals | **Blocking** | `lint:globals` |
| 13 | Time forward-only | Test | `time-coherence.spec.ts` |
| 14 | Event factories required | **Blocking** | `lint:events` |
| 15 | Typed InkBridge accessors | **Blocking** | `lint:ink-access` |
| 16 | XState action guards | Advisory | `lint:action-guards` |
| 17 | Component param validation | Advisory | `lint:component-params` |
| 18 | Chat knots set current_chat | **Blocking** | `lint:current-chat` |
| 19 | Default value consistency | Advisory | Heuristic |
| 20 | No naive test skips | **Blocking** | `lint:test-skips` |
| 21 | Refactor safety net | Planning | `/refactoring` skill |
| 22 | Documentation quality | Warning | `lint:doc-links` |
| 23 | Test documentation | **Blocking** | `lint:test-assumptions` |
| 24 | Weak assertion detection | Warning | `lint:test-assumptions --warnings` |
| 25 | Test parametrization | Advisory | test-auditor review |
| 26 | Doc-code consistency | **Blocking** | `lint:doc-code-refs` |

---

## CQO-1: Ink Compiles Clean

- **Tier**: Blocking
- **Rule**: All ink compiles with zero errors/warnings
- **Validation**: `mise run lint:ink` / Stop hook
- **Why**: Broken ink = broken game

## CQO-2: Tag Schema Compliance

- **Tier**: Blocking
- **Rule**: Only approved tags allowed
- **Validation**: `mise run lint:tags` / Stop hook

### Approved Tags

| Tag | Type | Purpose | Example |
|-----|------|---------|---------|
| `speaker` | string | Message sender | `# speaker:Pat` |
| `type` | enum | Message type | `# type:received` |
| `time` | string | Timestamp | `# time:9:23 AM` |
| `date` | int | Date separator | `# date:-1` (yesterday) |
| `notificationPreview` | string | Notification text override | `# notificationPreview:You have notes` |
| `story_start` | flag | Seed/active boundary | `# story_start` |
| `delay` | int | Pre-display pause (ms) | `# delay:1500` |
| `attachment` | string | File reference | `# attachment:doc.pdf` |
| `image` | path | Inline image | `# image:photo.jpg` |
| `audio` | path | Voice message | `# audio:memo.m4a` |
| `duration` | string | Audio length | `# duration:0:08` |
| `sfx` | string | Sound effect | `# sfx:notification` |
| `class` | string | CSS class | `# class:emphasis` |
| `view` | string | UI view switch | `# view:hub` |
| `clear` | flag | Clear history | `# clear` |
| `status:battery` | int | Battery % | `# status:battery:75` |
| `status:signal` | int | Signal bars | `# status:signal:3` |
| `presence` | enum | Contact status | `# presence:online` |
| `targetChat` | string | Cross-chat routing (CQO-20) | `# targetChat:pat` |
| `notificationPreview` | string | Notification text override | `# notificationPreview:New message` |
| `immediate` | flag | Skip HWM defer queue | `# immediate` |
| `label` | string | Mark message for quoting | `# label:tip1` |
| `quoteRef` | string | Quote labeled message | `# quoteRef:tip1` |

**Removed tags**: `# chat:`, `# title:` — use `current_chat` variable, display names from TOML

**Message types**: `sent`, `received`, `system`, `attachment`

**Presence values**: `online`, `offline`, `lastseen:TIME`

## CQO-3: Cross-Chat State Coherence

- **Tier**: Test
- **Rule**: Cross-chat actions trigger notifications + badges
- **Validation**: `mise run test:e2e`
- **Reference**: [Simulation Physics - Notification Rules](../concepts/simulation-physics.md#notification-rules-invariants)

## CQO-4: Timed Message Accuracy

- **Tier**: Test
- **Rule**: delay_next() delays within 500ms tolerance
- **Validation**: Playwright timing tests

## CQO-5: Ink Comments on Complex Logic

- **Tier**: Blocking
- **Rule**: LIST ops, tunnels, 3+ nested conditionals need `// Why:` comment
- **Validation**: `mise run lint:ink-comments` / Stop hook
- **Why**: AI and humans need to understand non-obvious logic

```ink
// Why: Track conversation mood for response selection
LIST mood = neutral, happy, frustrated

// Why: Return from time skip to resume normal flow
-> time_skip ->
```

## CQO-6: Modern JavaScript

- **Tier**: Pre-commit
- **Rule**: ES modules only, no CommonJS, no var
- **Validation**: `mise run lint:js` (Biome)

## CQO-7: Web Component Encapsulation

- **Tier**: Blocking
- **Rules**:
  - Styling inside Shadow DOM or via CSS variables
  - No DOM manipulation outside component classes
- **Validation**: `mise run lint:dom` / Stop hook

## CQO-8: Accessibility

- **Tier**: Test
- **Rules**:
  - Chat log: `role="log"` + `aria-live="polite"`
  - Choices: focusable, keyboard-navigable `<button>` elements
  - Respect `prefers-reduced-motion`
  - Color contrast ≥ 4.5:1 (WCAG AA)
  - Back button has `aria-label`
- **Validation**: `mise run test:a11y` (axe-core)

## CQO-9: CSS Variables for Theming

- **Tier**: Warning
- **Rule**: No hardcoded colors; use `var(--ink-*)`
- **Validation**: `mise run lint:css` / Stop hook

## CQO-10: Single Responsibility

- **Tier**: Warning
- **Rule**: No file exceeds 500 lines; each component has one purpose
- **Validation**: Stop hook file scan

## CQO-11: Ink Modularity

- **Tier**: Warning
- **Rules**:
  - One conversation per file in `{impl}/ink/{locale}/chats/`
  - All ink INCLUDEd from locale's main.ink
  - Variables in `{impl}/ink/variables.ink` (shared)
- **Validation**: Orphan file check in Stop hook

## CQO-12: Explicit Dependencies

- **Tier**: Blocking
- **Rules**:
  - No implicit globals (except `window.controller` for debug)
  - Components import dependencies explicitly
  - External functions declared at top of ink
- **Validation**: `mise run lint:globals` / Stop hook

Allowed globals: `controller`, `inkjs`, `gameHub`, `gameThread`

## CQO-13: Time Coherence

- **Tier**: Test
- **Rules**:
  - Phone clock = earliest message time on chat entry
  - First message after `# story_start` MUST have `# time:` tag
  - Time never goes backward within a session
- **Validation**: `tests/e2e/time-coherence.spec.ts`
- **Reference**: [Simulation Physics - Time Simulation](../concepts/simulation-physics.md#time-simulation)

---

## Boundary CQOs (14-17)

These CQOs address **system boundaries** where implicit assumptions cause hard-to-debug errors.

## CQO-14: Event Factory Required

- **Tier**: Blocking
- **Rule**: All `eventBus.emit()` calls must use factory functions from `event-factories.js`
- **Validation**: `mise run lint:events` / Stop hook
- **Why**: Schema drift between emitter and subscriber causes bugs where stack traces break across the event loop

```javascript
// ❌ FORBIDDEN - inline object
eventBus.emit(OS_EVENTS.MESSAGE_RECEIVED, { chatId, message });

// ✅ REQUIRED - factory function  
import { createMessageEvent } from './event-factories.js';
eventBus.emit(OS_EVENTS.MESSAGE_RECEIVED, createMessageEvent(chatId, message));
```

**Adding new events:**
1. Add factory to `packages/framework/src/foundation/services/event-factories.js`
2. Add event name to `packages/framework/src/systems/conversation/events/events.js`
3. Update `lint-events.js` EVENT_TO_FACTORY map

## CQO-15: Typed InkBridge Accessors

- **Tier**: Blocking
- **Rule**: All ink variable reads must go through typed accessor methods on InkBridge
- **Validation**: `mise run lint:ink-access` / Stop hook
- **Why**: Ink variables are untyped. `"10" + 5 = "105"` bugs.

```javascript
// ❌ FORBIDDEN - direct access
const money = this.story.variablesState.current_money;

// ✅ REQUIRED - typed accessors
const money = this.inkBridge.getVariableNumber('current_money');
const chat = this.inkBridge.getVariableString('current_chat');
const flag = this.inkBridge.getVariableBoolean('has_seen_intro');
```

**Available accessors:**

| Method | Returns | Default |
|--------|---------|---------|
| `getVariableString(name, default)` | string | `''` |
| `getVariableNumber(name, default)` | number | `0` |
| `getVariableBoolean(name, default)` | boolean | `false` |
| `getCurrentChat()` | string | `''` |

**Allowed files:** `ink-bridge.js`, `game-state.js` (with care)

**Exception:** Add `// CQO-15 exception` comment if intentional

## CQO-16: XState Action Guards

- **Tier**: Advisory
- **Rule**: XState actions that read from context should validate required fields
- **Validation**: `mise run lint:action-guards`
- **Why**: Actions can receive null/undefined context during race conditions

```javascript
// ❌ RISKY - assumes context.story exists
processStoryChunk: assign(({ context }) => {
  const text = context.story.Continue();  // Crashes if story is null
  ...
})

// ✅ SAFE - guard clause first
processStoryChunk: assign(({ context }) => {
  if (!context.story?.canContinue) return context;
  
  const text = context.story.Continue();
  ...
})
```

**Acceptable patterns:**
- `if (!context.property)` guard clauses
- Optional chaining: `context.story?.variablesState`
- Nullish coalescing: `context.value ?? default`

## CQO-17: Component Parameter Validation

- **Tier**: Advisory
- **Rule**: Public component methods should validate parameters and fail fast
- **Validation**: `mise run lint:component-params`
- **Why**: Undefined params cause `TypeError` deep in call stack instead of at entry point

```javascript
// ❌ RISKY - no validation
open(chatId, title, messages) {
  this.currentChat = chatId;  // Silent failure if undefined
  ...
}

// ✅ SAFE - fail fast
open(chatId, title, messages) {
  if (!chatId) throw new Error('ChatThread.open: missing chatId');
  
  this.currentChat = chatId;
  this.messages = Array.isArray(messages) ? messages : [];
  ...
}
```

## CQO-18: Chat Knots Set current_chat

- **Tier**: Blocking
- **Rule**: Every chat knot (`=== *_chat ===`) must set `current_chat` variable immediately
- **Validation**: `mise run lint:current-chat` / Stop hook
- **Why**: Messages route based on `current_chat`. Missing it causes messages to appear in wrong threads.

```ink
// ✅ CORRECT - current_chat set immediately after knot
=== pat_chat ===
~ current_chat = "pat"

// Chat content...
```

```ink
// ❌ WRONG - missing current_chat
=== pat_chat ===
// Messages will route to wrong chat!
```

```ink
// ❌ WRONG - mismatched value
=== pat_chat ===
~ current_chat = "news"  // Should be "pat"
```

**What the linter checks:**
- Every `=== *_chat ===` knot has `~ current_chat = "*"` within first 5 lines
- The value matches the knot prefix (`pat_chat` → `"pat"`)

## CQO-19: Default Value Consistency

- **Tier**: Advisory
- **Rule**: Defaults defined in single location (factory), not duplicated in consumers
- **Validation**: Heuristic grep + manual review
- **Why**: Duplicated defaults cause silent bugs when sources disagree

### Pattern to Avoid
```javascript
// BAD: Factory and renderer both define default
// types.js
export function createMessage(opts) {
  return { receipt: opts.receipt || 'sent', ... };
}
// message-bubble.js
const status = message.receipt || 'delivered'; // disagrees!
```

### Correct Pattern
```javascript
// GOOD: Factory is single source of truth
// types.js
export function createMessage(opts) {
  return { receipt: opts.receipt ?? 'sent', ... };
}
// message-bubble.js
const status = message.receipt; // trust the factory
```

---

## CQO-20: No Naive Test Skips

- **Tier**: Blocking
- **Rule**: Test skips must have documented rationale
- **Validation**: `mise run lint:test-skips` / Stop hook
- **Why**: Skipping tests as a lazy workaround hides problems and creates technical debt

```typescript
// ✅ CORRECT - documented skip with task reference
// Skip: task-73 - Waiting for ink compiler fix for nested conditionals
test.skip('handles deeply nested choices', () => { ... });

// ✅ CORRECT - documented skip with rationale
// Skip: Requires WebSocket API not available in jsdom test environment
describe.skip('real-time sync', () => { ... });

// ❌ WRONG - no documentation
test.skip('handles edge case', () => { ... });

// ❌ WRONG - no rationale
// Skip
test.skip('handles edge case', () => { ... });

// ❌ WRONG - TODO is not a Skip comment
// TODO: fix this later
test.skip('handles edge case', () => { ... });
```

**Skip comment format:**
```
// Skip: [task-XXX] - [rationale explaining why skip is necessary]
```

**When skips are acceptable:**
- External dependency has known bug (reference task tracking fix)
- Test requires environment not available in CI (document what's needed)
- Flaky test being investigated (reference task for investigation)

**When skips are NOT acceptable:**
- Test is failing and you don't want to fix it
- Test is slow (optimize it instead)
- Test is "in the way" of your current work
- You'll "fix it later" (create a task and reference it)

---

## CQO-21: Refactor Safety Net

- **Tier**: Planning
- **Rule**: Before refactoring, verify tooling catches common mistakes
- **Validation**: Planning skill Stop hook
- **Why**: Refactors without safety nets leave orphaned files, broken imports, and stale references

**Before any refactor, verify coverage for:**

| Risk | Detection Method |
|------|------------------|
| Broken imports | `lint:imports` |
| Unused exports | `lint:imports` |
| Orphaned files | `lint:file-structure` |
| Stale doc links | `lint:doc-links` |
| Stale test paths | `lint:test-paths` |
| Empty directories | Manual or new linter |
| Related files left behind | Manual verification |
| Asset path references | grep for moved paths |

**Planning checklist:**

1. Identify which risks apply to your refactor
2. Verify relevant linters pass BEFORE starting
3. For gaps, either:
   - Create linter first, OR
   - Document manual verification steps

**Example analysis:**

> "Moving components to `packages/framework/src/systems/conversation/`"

```markdown
| Risk | Covered? | Mitigation |
|------|----------|------------|
| Broken imports | ✅ | lint:imports |
| Orphaned files | ✅ | lint:file-structure |
| CSS url() paths | ❌ | grep "url(" after move |
| Test imports | ✅ | lint:test-paths |
```

**Post-refactor verification:**
```bash
# Run all structural linters
mise run lint:imports
mise run lint:file-structure
mise run lint:doc-links
mise run lint:test-paths

# Manual check for gaps identified in planning
rg "old/path" src/ tests/ docs/
```

## CQO-22: Documentation Quality

- **Tier**: Warning
- **Rule**: Documentation follows Diataxis framework, maintains separation of concerns, and stays current
- **Validation**: `lint:doc-links` + docs-auditor review
- **Why**: Good documentation is critical for both human contributors and AI agents

## CQO-23: Test Documentation

- **Tier**: Blocking
- **Rule**: Tests with structural dependencies must document INTENT and ASSUMPTION
- **Validation**: `mise run lint:test-assumptions` / Stop hook
- **Why**: Implicit assumptions cause silent test failures during refactoring

### Required Documentation

Tests must document INTENT and ASSUMPTION when they have:
- Test helpers that read source files (`readFileSync`, `fs.read`)
- Test helpers that use regex to parse code structure
- Ordering assertions (`[0]`, `[1]`, `.first()`, `.at(N)`)

### Pattern

```typescript
// ❌ Missing documentation
export function extractBoundFunctions() {
  // Regex parses source code structure
  const regex = /BindExternalFunction\s*\(\s*['"]\w+['"]/g;
  ...
}

// ✅ Full documentation
/**
 * INTENT: Verify documented external functions match code bindings
 *
 * ASSUMPTION: External functions are bound via direct calls to
 * story.BindExternalFunction('name', ...) in ink-bridge.js
 *
 * BREAKS if:
 * - Functions are bound via wrapper helpers
 * - Binding moves to a different file
 * - Dynamic binding from configuration is used
 */
export function extractBoundFunctions() {
  ...
}

// For tests:
/**
 * INTENT: Verify BREAKING news is first because it's the story entry point
 * ASSUMPTION: Seeds emit during init before tracking, so emissions[0] is post-story
 * BREAKS if: Emission order changes, seed timing changes
 */
test('messages emit in correct order', ...)
```

## CQO-24: Weak Assertion Detection

- **Tier**: Warning
- **Rule**: Tests with weak assertions should be reviewed for false-positive risk
- **Validation**: `mise run lint:test-assumptions --warnings`
- **Why**: `.some()`, `.includes()`, `.find()` without strict assertions may mask failures

### Advisory

The linter flags tests using:
- `.some()` without corresponding length/strict checks
- `.includes()` for structural validation
- `.find()` where order matters

Human review decides if the assertion is sufficient.

## CQO-25: Test Parametrization

- **Tier**: Advisory
- **Rule**: Similar tests should use parametrization where applicable
- **Validation**: test-auditor heuristic review
- **Why**: Reduces duplication, improves maintainability

### Pattern to Consider

```typescript
// Consider consolidating if you have:
test('handles case A', () => { ... });
test('handles case B', () => { ... });
test('handles case C', () => { ... });

// Into:
test.each([
  ['case A', inputA, expectedA],
  ['case B', inputB, expectedB],
  ['case C', inputC, expectedC],
])('handles %s', (name, input, expected) => { ... });
```

## CQO-26: Doc-Code Consistency

- **Tier**: Blocking
- **Rule**: Documentation references must match actual code
- **Validation**: `mise run lint:doc-code-refs` / Stop hook
- **Why**: Stale doc references cause confusion and incorrect usage

### What's Checked

1. **Function calls** - `functionName()` patterns in docs must exist in code
2. **Method calls** - `.methodName(` patterns must exist on documented classes
3. **Event names** - `EVENTS.NAME` or `'event-name'` must be defined

### Example

```markdown
❌ Doc references removed function:
Call `trigger_alert()` to show the notification.

❌ Doc references renamed method:
Use `.setPopupVisible(true)` to show the popup.

❌ Doc references removed event:
Listen for `notification-auto-hidden` event.
```

### Diataxis Framework

Documentation must be organized into four distinct types:

| Type | Purpose | Location |
|------|---------|----------|
| **Tutorials** | Learning-oriented, hands-on | `docs/tutorials/` |
| **How-to Guides** | Task-oriented, practical | `docs/guides/` |
| **Reference** | Information-oriented, accurate | `docs/reference/` |
| **Explanation** | Understanding-oriented, context | `docs/concepts/` |

Don't mix types. A tutorial shouldn't include exhaustive API reference; a reference page shouldn't include lengthy explanations.

### Separation of Concerns

| Content | Location | Audience |
|---------|----------|----------|
| Framework (engine) | `docs/reference/`, `docs/concepts/` | Developers |
| Implementation-specific | `docs/experiences/{impl}/` | Developers |
| Agent harness | `docs/agents/` | AI agents |
| Writer guidance | `docs/guides/writers/` | Narrative writers |
| Developer guidance | `docs/guides/developers/` | Developers |

### Freshness Requirements

- Documentation must reflect current project structure
- Code paths in docs must exist (`lint:doc-links`)
- No hardcoded implementation names in generic docs (use `{impl}`)
- Workflow docs must match actual commands

### Validation
```bash
# Run doc link linter
node utils/linting/repo/lint-doc-links.js

# Check structure
ls -la docs/tutorials/ docs/guides/ docs/reference/ docs/concepts/
```

---

## CQO-27: External Function Centralization

- **Tier**: Blocking
- **Rule**: All ink external functions must be defined in the shared module
- **File**: `packages/framework/src/systems/conversation/ink/external-functions.js`
- **Validation**: `mise run lint:external-functions`
- **Why**: Prevents function signature drift between build-time and runtime

### What's Enforced

External functions like `name()`, `data()`, `delay_next()`, etc. must be:
1. Defined in `external-functions.js` using `createExternalFunctions()` or `createBuildExternalFunctions()`
2. Bound via `bindExternalFunctions(story, functions)`

### Anti-Pattern

```javascript
// ❌ Inline binding duplicates function definitions
story.BindExternalFunction('name', (id, variant) => { ... });
story.BindExternalFunction('delay_next', (ms) => { ... });

// ✅ Use shared module
import { createBuildExternalFunctions, bindExternalFunctions } from
  'packages/framework/src/systems/conversation/ink/external-functions.js';

const functions = createBuildExternalFunctions({ getName, story });
bindExternalFunctions(story, functions);
```

---

## Running All Checks

```bash
# Full lint suite (blocking + warning)
mise run lint

# Boundary checks only
mise run lint:boundaries

# All tests including accessibility
mise run test

# Accessibility only
mise run test:a11y
```

---

## Automated Enforcement

The Stop hook runs selective checking based on changed files:

- `.ink` changes → CQO-1, 2, 5, 11
- `.js` changes → CQO-7, 12, 14, 15, 16, 17
- `.css` or component changes → CQO-9

Exit code 2 indicates a blocking failure that must be resolved before continuing.

For agent-specific enforcement details, see [docs/agents/CQO-ENFORCEMENT.md](../agents/CQO-ENFORCEMENT.md).
