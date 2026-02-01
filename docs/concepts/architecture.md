# Architecture Overview

This project uses a layered architecture that enforces structural invariants - making illegal states unrepresentable.

> **Note:** A plugin architecture is also available in `packages/framework/src/foundation/` and `packages/framework/src/systems/` for building different types of interactive fiction. See [Framework vs Content](framework-vs-content.md) and the [developer guides](../guides/developers/) for details.

---

## System Layers

```
┌─────────────────────────────────────────────────────────────┐
│  INK STORY (experiences/{impl}/ink/)                        │
│  Pure narrative. Calls externals for side effects.          │
│  - main.ink: Entry point, external declarations             │
│  - chats/*.ink: One file per conversation                   │
│  - chats/variables.ink: Centralized state                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  CONFIG (experiences/{impl}/data/*.toml)                    │
│  Single source of truth for:                                │
│  - Character registry (base-config.toml)                    │
│  - UI strings and translations (locales/*.toml)             │
│  - Adding a chat = config entry + ink file                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  FOUNDATION (packages/framework/src/foundation/)            │
│  - EventBus: Cross-component communication                  │
│  - TimeContext: Day/time simulation                         │
│  - StorageAdapter: Persistence abstraction                  │
│  - InkRuntime: Story execution wrapper                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  CONVERSATION SYSTEM (packages/framework/src/systems/...)   │
│  - State machine factory: createConversationMachine()       │
│  - XState v5.25.0 (vendored in packages/framework/...)      │
│  - Tag handlers: speaker, type, delay, presence, etc.       │
│  - External functions: delay_next, name, advance_day        │
│  - Services: BatteryContext (phone-specific)                │
│  - Events: message-received, typing-start, etc.             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GAME STATE (experiences/{impl}/src/game-state.js)          │
│  Thin wrapper using conversation system factory:            │
│  - currentView: { type: 'hub' } | { type: 'chat', chatId }  │
│  - messageHistory: { [chatId]: Message[] }                  │
│  - savedChoicesState: { [chatId]: inkStateJson }            │
│  Implementation configures: parseTags, processMessageTime   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GAME CONTROLLER (experiences/{impl}/src/game-controller.js)│
│  - Orchestrates Foundation ↔ StateMachine                   │
│  - Dispatches UI events (message, choices, notification)    │
│  - Save/load via storage-adapter.js                         │
│  - No duplicate state (uses XState context as truth)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  WEB COMPONENTS (packages/framework/src/systems/.../...)    │
│  - Shadow DOM, fully encapsulated                           │
│  - chat-hub: Conversation list with badges                  │
│  - chat-thread: Message view with grouping, receipts        │
│  - notification-drawer: SSOT for notification state         │
│  - notification-popup: Toast banners (view-only)            │
│  - lock-screen: Lock overlay with notifications (view-only) │
│  - phone-status-bar: iOS-style status (time/battery/signal) │
│  - typing-indicator: Animated "is typing..." bubble         │
│  - audio-bubble: Voice message with transcribe button       │
│  - image-bubble: Image message with lightbox                │
│  - connection-overlay: Network instability indicator        │
│  - home-indicator: iOS home bar at bottom                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Structural Invariants

These properties are enforced by the architecture:

| Invariant | Enforcement |
|-----------|-------------|
| Messages belong to exactly one chat | Tagged at creation in InkBridge |
| Choices tagged with owning chatId | Captured on waitingForInput state entry |
| Notification + badge are atomic | Cross-chat messages via `# targetChat:` |
| Alerts suppressed when viewing target | Check in InkBridge before emit |
| Single source of truth for view | XState `currentView` only |
| Drawer is SSOT for notification state | Popup/lockscreen are view-only layers |
| Config matches ink | Contract tests verify sync |

---

## Data Flow

```
ink story → InkRuntime → game-state.js → game-controller.js → Web Components
                ↑                    ↓
            XState context    CustomEvents (message-added, choices-available)
```

**State locations:**
- Story flags: `variables.ink` (persisted via ink state)
- Messages: `messageHistory` in XState context (persisted via localStorage)
- View: `currentView` in XState context (not persisted)
- Choices: `taggedChoices` in XState context (saved when navigating away)

**Key functions:**
- `processStoryChunk()` - Parses ink output into messages
- `delay_next()` - Timing between messages
- `captureTaggedChoices()` - Tags choices with owner chat

**Key tags:**
- `# targetChat:chatId` - Routes message to different chat (fires notification)

---

## State Persistence

The game saves state to localStorage on significant events.

### What's Saved

| Data | Storage Key | Format |
|------|-------------|--------|
| Ink story state | `gameState.inkState` | JSON (ink's `state.ToJson()`) |
| Message history | `gameState.messageHistory` | `{ [chatId]: Message[] }` |
| Unread state | `gameState.unreadState` | `{ [chatId]: boolean }` |
| Save timestamp | `gameState.timestamp` | Unix milliseconds |

### What's NOT Saved

| Data | Reason |
|------|--------|
| Current view | Ephemeral (always starts at hub) |
| Typing indicator state | Ephemeral UI state |
| Notification queue | Transient |
| TimeContext | Restored from ink variables |

### When Saves Occur

1. **Chat close** - `controller.closeChat()` triggers save
2. **Choice selection** - After XState processes the choice
3. **Auto-save interval** - Every 30 seconds (configurable via `UI.timings.autoSaveInterval`)

### Storage Adapter

**File:** `packages/framework/src/foundation/services/storage-adapter.js`

```javascript
import { storage } from '../foundation/services/storage-adapter.js';

// Save
storage.save({
  inkState: story.state.ToJson(),
  messageHistory: snapshot.context.messageHistory,
  timestamp: Date.now(),
});

// Load
const state = storage.load();  // Returns null if empty

// Clear
storage.clear();
```

### localStorage Key

Default key: `gameState`

For multiple save slots, create additional adapters:

```javascript
import { createStorageAdapter } from '../foundation/services/storage-adapter.js';
const slot2 = createStorageAdapter('gameState_slot2');
```

---

## Error Handling

### Ink Runtime Errors

Errors during story execution are caught but not fatal:

| Error Type | Handling |
|------------|----------|
| Missing knot | `console.warn`, continues |
| Undeclared variable | `console.warn`, continues |
| Invalid external function | Exception logged |
| JSON parse failure | Full error, load fails gracefully |

**Example (missing knot):**
```javascript
try {
  this.story.ChoosePathString(config.knotName);
} catch (_e) {
  console.warn(`Knot ${config.knotName} not found`);
}
```

### Invalid Tags

Tags are validated at runtime by InkBridge:

| Invalid Tag | Handling |
|-------------|----------|
| Unknown tag name | Ignored (pass-through) |
| Malformed value | Uses default or ignores |
| Missing required tag | Uses fallback behavior |

### State Machine Errors

XState guards prevent invalid transitions:

```javascript
// Guard example: Can't choose if no choices available
guards: {
  hasChoices: ({ context }) => context.story.currentChoices.length > 0
}
```

### Network/Fetch Errors

External data loading (`data-loader.js`):

```javascript
try {
  const data = await dataService.fetch(source, query, params);
} catch (error) {
  console.warn(`Failed to load external data for ${varName}:`, error);
  // Continues without the data - variable stays undefined
}
```

---

## Time Coherence

The game maintains coherent time across multiple chat threads.

### TimeContext

**File:** `packages/framework/src/foundation/services/time-context.js`

Singleton managing story time:

```javascript
import { timeContext } from '../foundation/services/time-context.js';

timeContext.format();        // "10:41 AM"
timeContext.getDay();        // 1
timeContext.getState();      // { day: 1, time: "10:41 AM" }
```

### Time Operations

| Operation | Method | Trigger |
|-----------|--------|---------|
| Auto-drift | `tick(minutes?)` | Each message (default +1 min) |
| Explicit jump | `advance(minutes)` | `# duration:N` tag |
| Hard snap | `setTime(timeStr)` | `# time:HH:MM` tag |
| Day advance | `advanceDay(morningTime?)` | `advance_day()` external |

### Forward-Only Time

**Critical rule:** Time never goes backward.

```javascript
setTime(timeStr) {
  const newTime = parseTime(timeStr);
  if (!this._initialized || newTime > this.currentTime) {
    this.currentTime = newTime;
    return true;
  }
  console.warn(`Backward time rejected: "${timeStr}" < current`);
  return false;
}
```

This prevents cross-chat time paradoxes when players switch between conversations.

### Time Priority

When processing a message:

1. **Pre-story mode** (before `# story_start`): Display time only, no TimeContext update
2. **Explicit `# time:` tag**: Hard snap to that time
3. **`# duration:N` tag**: Advance by N minutes
4. **No time tag**: Auto-drift (+1 minute default)

### Events

| Event | Payload | When |
|-------|---------|------|
| `os:time-updated` | `{ time, day }` | Any time change |
| `os:day-advanced` | `{ time, day }` | Day increment |

### Plugin Extension

Other systems can react to time changes:

```javascript
timeContext.onTimeAdvance((minutes) => {
  // E.g., drain battery based on time elapsed
  batteryContext.drain(minutes * DRAIN_RATE);
});
```

---

## Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Unit tests | `tests/unit/` | State machine logic (Vitest + happy-dom) |
| Contract tests | `tests/contract/` | Verify config matches ink |
| Invariant tests | `packages/tests/quality/invariants.spec.ts` | Structural properties |
| Accessibility tests | `packages/tests/quality/accessibility.spec.ts` | WCAG via axe-core |
| E2E tests | `tests/e2e/` | User-facing behavior |

See [Testing Reference](../reference/testing.md) for clock mocking, localStorage isolation, and page object patterns.

---

## File Structure

```
packages/
└── framework/
    └── src/
        ├── foundation/              # Core engine (vocabulary-agnostic)
        │   ├── services/            # EventBus, TimeContext, StorageAdapter
        │   ├── core/                # InkRuntime, Foundation
        │   └── state/               # StateFactory
        ├── systems/
        │   └── conversation/        # Phone chat vocabulary
        │       ├── state/           # XState machine factory
        │       ├── events/          # Event constants
        │       ├── services/        # BatteryContext, conversation-context
        │       ├── tags/            # Tag handlers
        │       └── components/      # Web components (chat-hub, chat-thread, etc.)
        └── vendor/
            ├── xstate/              # Vendored XState v5.25.0
            └── ink.js               # Vendored inkjs runtime

experiences/
└── {impl}/                          # Your specific game
    ├── src/                         # Implementation source
    │   ├── main.js                  # Entry point
    │   ├── game-state.js            # Uses createConversationMachine()
    │   ├── game-controller.js       # Orchestrator
    │   └── config.js                # Config loader
    ├── data/                        # Config files
    │   ├── base-config.toml         # Characters, behavior
    │   └── locales/                 # Translations
    ├── ink/                         # Narrative content
    │   ├── variables.ink            # Shared state
    │   └── {locale}/                # Localized content
    ├── assets/                      # Images, audio, fonts
    └── utils/                       # Implementation-specific tooling
        ├── ink/                     # Ink linters
        ├── implementation/          # JS linters
        ├── qa/                       # QA tools (random-agent, guided-agent)
        └── translation/             # Translation CLI

utils/
├── build/                           # Build tooling
└── linting/                         # Repo-wide validation scripts
```

---

## The CQO Framework

Every quality objective is defined across six dimensions:

| Dimension | Definition |
|-----------|------------|
| **Objective** | The specific technical goal |
| **Nature** | Measurability: Deterministic, Qualitative, or Structural |
| **Incentive** | How we prime intent: CLAUDE.md, skills, skill-rules.json |
| **Validation** | The feedback loop: tests, linters, manual review |
| **Timing** | When enforced: Planning, Generation, Review, Commit |
| **Enforcement** | Authority level: Instructional (soft) or Structural (hard) |

See [CQO Reference](../reference/cqo.md) for the full list of quality objectives.

---

## Harness Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  PLANNING PHASE                                                 │
│  skill-rules.json triggers contextual skills based on paths    │
│  CLAUDE.md provides global incentives and CQO reference        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  GENERATION PHASE                                               │
│  Skills provide domain-specific guidance                        │
│  planning_prompt in skill-rules asks critical questions         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST-EDIT (PostToolUse Hook)                                   │
│  Immediate feedback on file saves:                              │
│    *.ink → inklecate compile check                              │
│    *.js  → biome lint (if available)                            │
│  Fast, runs after every edit                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  END-OF-TURN (Stop Hook)                                        │
│  Comprehensive validation at end of turn:                       │
│    - CQO-1: Ink compile                                         │
│    - CQO-2: Tag schema                                          │
│    - CQO-9: CSS variables                                       │
│    - CQO-10: File size limits                                   │
│    - CQO-11: Ink modularity                                     │
│  Exit code 2 blocks continuation on errors                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PRE-COMMIT (mise run check)                                    │
│  Full validation before committing:                             │
│    - Build (compile ink)                                        │
│    - All linters                                                │
│    - Playwright E2E tests                                       │
│  Blocks commit on any failure                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Development Workflow

### Before You Start

1. Read `CLAUDE.md` for project conventions
2. Run `mise run check` to verify your environment

### Making Changes

```bash
# 1. Make changes

# 2. Build and lint
mise run check

# 3. Run tests (if touching JS or cross-chat logic)
pnpm install  # first time only
mise run test:e2e

# 4. Commit
git add .
git commit -m "feat: your changes"
```

---

## Troubleshooting

### Hook Not Firing

```bash
# Debug hooks
claude --print-hooks
```

### Lint Failing

```bash
# Run individual linters
bash experiences/{impl}/utils/ink/lint-tags.sh
bash experiences/{impl}/utils/implementation/lint-css.sh
node experiences/{impl}/utils/ink/lint-toml.js
IMPL={impl} pnpm exec inklecate -c experiences/{impl}/ink/en/main.en.ink
```

### Tests Failing

```bash
# Run with UI to debug
mise run test:e2e:ui
```

---

## Related Documentation

- [Simulation Physics](simulation-physics.md) - Message lifecycle, notifications, HWM system
- [Framework vs Content](framework-vs-content.md) - The four-layer separation
- [Conversation System Reference](../reference/conversation-system.md) - State machine factory, events, components
- [CQO Reference](../reference/cqo.md) - Code Quality Objectives
- [TOML Schema](../reference/toml-schema.md) - Configuration parameters
- [Developer Guides](../guides/developers/) - How to extend the system
