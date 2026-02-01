# Building a New Implementation

> **Audience:** Implementation Developers

How to compose systems into a complete interactive fiction implementation.

---

## What is an Implementation?

An implementation is a game-specific composition of systems. A typical phone-game implementation composes:

- **Foundation**: EventBus, TimeContext, StorageAdapter, InkRuntime
- **Conversation system**: Phone chat vocabulary (tags, functions, components)
- **Implementation code**: Game controller, state machine, i18n, config
- **Content**: Ink narrative + TOML configuration

You might create implementations for:
- Phone-based chat games (current)
- Classic adventure games
- Visual novels
- Hybrid games mixing multiple system vocabularies

---

## Implementation File Structure

```
experiences/
├── {impl}/                    # Your implementation
│   ├── src/                   # Source files
│   │   ├── main.js           # Entry point
│   │   ├── {impl}-experience.js  # System composition
│   │   ├── game-controller.js    # Game orchestration
│   │   ├── game-state.js     # XState machine
│   │   ├── config.js         # Config re-exports
│   │   ├── components/       # Game-specific components
│   │   │   ├── about-page.js
│   │   │   ├── debug-panel.js
│   │   │   ├── glossary-page.js
│   │   │   └── settings-page.js
│   │   └── services/         # Game-specific services
│   │       ├── i18n.js
│   │       ├── data-service.js
│   │       ├── data-loader.js
│   │       └── glossary-service.js
│   ├── data/                  # Config files
│   ├── ink/                   # Narrative content
│   └── utils/                 # Tooling
└── another-game/              # Another implementation
```

---

## Basic Implementation Pattern

```javascript
// experiences/mygame/src/mygame-experience.js
import { Foundation, createSystemContext } from '@phone-game/framework/foundation';
import { conversationSystem } from '@phone-game/framework/systems/conversation';
import { eventBus } from '@phone-game/framework/foundation/services/event-bus.js';
import { timeContext } from '@phone-game/framework/foundation/services/time-context.js';

export async function initMyGame(storyUrl, options = {}) {
  const foundation = new Foundation();

  // Factory handles boilerplate
  const context = createSystemContext({
    foundation,
    eventBus,
    timeContext,
    getViewState: options.getViewState,
    getI18n: options.getI18n,
  });

  // Explicit system composition
  const systems = [conversationSystem];
  const tagHandlers = systems.flatMap(s => s.tagHandlers);
  const externalFunctions = systems.flatMap(s => s.createExternalFunctions(context));

  // Start foundation with merged handlers
  await foundation.start(storyUrl, {
    tagHandlers,
    externalFunctions,
    savedState: options.savedState,
    getViewState: context.getViewState,
  });

  // Initialize systems in explicit order
  for (const system of systems) {
    system.init(foundation.runtime, eventBus, options);
  }

  return { foundation, runtime: foundation.runtime };
}
```

---

## Composing Multiple Systems

When combining systems, merge handlers explicitly:

```javascript
import { conversationSystem } from '@phone-game/framework/systems/conversation';
import { adventureSystem } from '@phone-game/framework/systems/adventure';

export async function initHybridGame(storyUrl, options = {}) {
  const foundation = new Foundation();

  const context = createSystemContext({
    foundation,
    eventBus,
    timeContext,
    getViewState: options.getViewState,
    getI18n: options.getI18n,
  });

  // Compose multiple systems
  const systems = [conversationSystem, adventureSystem];
  const tagHandlers = systems.flatMap(s => s.tagHandlers);
  const externalFunctions = systems.flatMap(s => s.createExternalFunctions(context));

  await foundation.start(storyUrl, { tagHandlers, externalFunctions });

  // Init in dependency order (foundation services first)
  for (const system of systems) {
    system.init(foundation.runtime, eventBus, options);
  }

  return { foundation, runtime: foundation.runtime };
}
```

---

## System Initialization Order

When systems have dependencies, initialize in the right order:

```javascript
// BatteryContext depends on TimeContext (for drain calculation)
// Initialize TimeContext first via foundation, then conversation system

await foundation.start(storyUrl, { tagHandlers, externalFunctions });

// TimeContext is ready via foundation
conversationSystem.init(foundation.runtime, eventBus, {
  batteryConfig: options.batteryConfig,
});
```

---

## Registering Services for System Components

Systems like `conversation` use components that need access to config and i18n. Since systems must not import directly from implementations (layer isolation), implementations register services via `contextRegistry`.

### Register Before Component Mounting

In your main.js, register services **after imports but before any component mounts**:

```javascript
// main.js
import { contextRegistry } from '@phone-game/framework/foundation/services/context-registry.js';
import { APP, CHAT_IDS, CHAT_TYPES, CHATS, UI } from './config.js';
import { i18n, i18nReady } from './services/i18n.js';

// Register services for conversation system components
contextRegistry.register('i18n', i18n);
contextRegistry.register('config', {
  app: APP,
  chatIds: CHAT_IDS,
  chatTypes: CHAT_TYPES,
  chats: CHATS,
  ui: UI,
});

// Import components (they access registry in connectedCallback, not import-time)
import '@phone-game/framework/systems/conversation/components/chat-hub.js';
// ...
```

### Why This Works

ES6 imports are hoisted - all `import` statements execute before any body code runs. However, components only access config inside methods like `connectedCallback()` and `render()`, which run after:

1. All imports load class definitions
2. `main.js` body runs (registers services)
3. DOM ready
4. Components mount → `connectedCallback()` accesses registry (now populated)

### Service Structure

The `config` object should match the accessor functions in `conversation-context.js`:

| Accessor | Config Property |
|----------|----------------|
| `getApp()` | `config.app` |
| `getChatIds()` | `config.chatIds` |
| `getChat(id)` | `config.chats[id]` |
| `getChatType(id)` | `config.chatTypes[id]` |
| `getUITiming(key)` | `config.ui.timings[key]` |
| `getUIDimension(key)` | `config.ui.dimensions[key]` |
| `getUIStrings()` | `config.ui.strings` |

---

## Entry Point Integration

In your HTML entry point:

```javascript
// main.js
import { GameController } from './game-controller.js';
import { dataService } from './services/data-service.js';

const controller = new GameController();

// Initialize services
dataService.init();

// Start game
controller.init('./dist/en/story.json');

// Expose for debugging
window.controller = controller;
```

---

## Handling Conflicting Tags

If two systems define the same tag, the later one in the array wins:

```javascript
// Bad: conflicting tags
const systems = [systemA, systemB]; // If both have `speaker`, B wins
```

Solutions:

1. **Namespace tags**: Use `mysystem:speaker` instead of `speaker`
2. **Compose handlers**: Create a new handler that delegates
3. **Single responsibility**: Ensure systems handle distinct tags

---

## State Management Approaches

### Using the Conversation System Factory (Recommended)

The conversation system provides a `createConversationMachine()` factory that handles message processing, choice management, delays, and cross-chat routing.

```javascript
// experiences/{impl}/src/game-state.js
import { createConversationMachine } from '@phone-game/framework/systems/conversation';
import { parseTags } from '@phone-game/framework/systems/conversation/utils.js';
import { timeContext } from '@phone-game/framework/foundation/services/time-context.js';
import { CHAT_IDS } from './config.js';

export const gameStateMachine = createConversationMachine({
  machineId: 'game',
  parseTags,
  processMessageTime: timeContext.processMessageTime.bind(timeContext),
  knownChatIds: CHAT_IDS,
});
```

This creates a thin ~30-line wrapper instead of duplicating the full machine logic.

See [Conversation System Reference](../../reference/conversation-system.md) for all factory options, machine states, and events.

### Custom XState Machine

For games needing different state structure, import from the vendored package:

```javascript
import { createMachine, createActor } from '@phone-game/framework/vendor/xstate';

const gameMachine = createMachine({
  // ...states, transitions, actions
});
```

### Simple State Object

For simpler games:

```javascript
const gameState = {
  currentLocation: 'start',
  inventory: new Set(),
  flags: {},
};

eventBus.on('location-changed', ({ locationId }) => {
  gameState.currentLocation = locationId;
});
```

### Ink as State

Let ink manage all state via variables:

```javascript
// Read state from ink
const location = runtime.getVariable('current_location');
const hasKey = runtime.getVariable('has_key');

// No separate JS state needed
```

---

## Testing Your Implementation

Create implementation-specific tests:

```typescript
// tests/e2e/my-game.spec.ts
import { test, expect } from '@playwright/test';

test.describe('My Game Implementation', () => {
  test('initializes correctly', async ({ page }) => {
    await page.goto('/my-game.html');
    await expect(page.locator('my-game-component')).toBeVisible();
  });

  test('handles system events', async ({ page }) => {
    await page.goto('/my-game.html');
    // Trigger event, verify UI updates
  });
});
```

---

## Example: Adventure Game Implementation

```javascript
// experiences/adventure/src/adventure-experience.js
import { Foundation, createSystemContext } from '@phone-game/framework/foundation';
import { adventureSystem } from '@phone-game/framework/systems/adventure';
import { eventBus } from '@phone-game/framework/foundation/services/event-bus.js';
import { timeContext } from '@phone-game/framework/foundation/services/time-context.js';

export async function initAdventureGame(storyUrl, options = {}) {
  const foundation = new Foundation();

  // Adventure-specific state
  const inventory = new Set();
  const visitedLocations = new Set();

  const context = createSystemContext({
    foundation,
    eventBus,
    timeContext,
    getViewState: options.getViewState,
  });

  // Add adventure-specific context
  context.inventory = inventory;
  context.visitedLocations = visitedLocations;

  const systems = [adventureSystem];
  const tagHandlers = systems.flatMap(s => s.tagHandlers);
  const externalFunctions = systems.flatMap(s => s.createExternalFunctions(context));

  await foundation.start(storyUrl, { tagHandlers, externalFunctions });

  for (const system of systems) {
    system.init(foundation.runtime, eventBus, {
      inventory,
      visitedLocations,
      onLocationChange: options.onLocationChange,
    });
  }

  return {
    foundation,
    runtime: foundation.runtime,
    inventory,
    visitedLocations,
  };
}
```

---

## Related

- [Conversation System Reference](../../reference/conversation-system.md) - Factory API, events, components
- [Creating a New System](new-system.md) - System structure and patterns
- [System API Reference](../../reference/system-api.md) - Type definitions
- [Architecture](../../concepts/architecture.md) - System design overview
- [Framework vs Content](../../concepts/framework-vs-content.md) - The four-layer separation
