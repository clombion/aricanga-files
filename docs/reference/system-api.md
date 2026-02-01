# System API Reference

Formal documentation of the System interface and related types.

---

## Overview

The system architecture uses JSDoc typedefs for IDE support and documentation. These types are defined in `packages/framework/src/foundation/types.js`.

---

## System Interface

The main interface that all systems must implement.

```javascript
/**
 * System interface.
 * Systems define vocabulary for specific types of interactive fiction.
 *
 * @typedef {Object} System
 * @property {string} id - Unique identifier for the system (e.g., 'conversation', 'adventure')
 * @property {TagHandler[]} tagHandlers - Array of tag handlers this system provides
 * @property {function(SystemContext): ExternalFunction[]} createExternalFunctions - Factory that creates external functions with access to context
 * @property {function(InkRuntime, EventBus, Object=): void} init - Initialize the system after foundation starts
 */
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Unique identifier for the system |
| `tagHandlers` | `TagHandler[]` | Static array of tag handlers |
| `createExternalFunctions` | `(context: SystemContext) => ExternalFunction[]` | Factory for external functions |
| `init` | `(runtime, eventBus, options?) => void` | Initialization hook |

### Example

```javascript
/**
 * @type {import('../../foundation/types.js').System}
 */
export const mySystem = {
  id: 'mysystem',

  tagHandlers: [
    { tag: 'location', handler: (value) => ({ location: value }) },
  ],

  createExternalFunctions(context) {
    return [
      {
        name: 'move_to',
        fn: (location) => {
          const eventBus = context.getEventBus();
          eventBus.emit('location:changed', { location });
        },
        lookAheadSafe: false,
      },
    ];
  },

  init(runtime, eventBus, options = {}) {
    console.log('[mySystem] Initialized');
  },
};
```

---

## SystemContext

Context object passed to `createExternalFunctions`. Provides access to runtime services.

```javascript
/**
 * Context object passed to system external functions.
 * Provides access to runtime services without tight coupling.
 *
 * @typedef {Object} SystemContext
 * @property {function(): InkRuntime} getRuntime - Returns the ink runtime instance
 * @property {function(): Object} getViewState - Returns current view state (e.g., { type: 'chat', chatId: 'pat' })
 * @property {function(): TimeContext} getTimeContext - Returns the time context service
 * @property {function(): Object|null} getI18n - Returns the i18n service or null if not configured
 * @property {function(): EventBus} getEventBus - Returns the event bus instance
 */
```

### Accessors

| Method | Returns | Description |
|--------|---------|-------------|
| `getRuntime()` | `InkRuntime` | The ink runtime instance |
| `getViewState()` | `Object` | Current UI view state |
| `getTimeContext()` | `TimeContext` | Time simulation service |
| `getI18n()` | `Object \| null` | Localization service |
| `getEventBus()` | `EventBus` | Event communication bus |

### Creating a Context

Use the `createSystemContext()` factory:

```javascript
import { createSystemContext } from '../../foundation/index.js';

const context = createSystemContext({
  foundation,
  eventBus,
  timeContext,
  getViewState: () => ({ type: 'chat', chatId: 'pat' }),
  getI18n: () => i18n,
});
```

---

## TagHandler

Defines how to process a specific ink tag.

```javascript
/**
 * Tag handler definition for processing ink tags.
 *
 * @typedef {Object} TagHandler
 * @property {string} tag - The tag name to handle (e.g., 'speaker', 'delay')
 * @property {function(string, Object): Object} handler - Handler function that receives the tag value and current context, returns object to merge into context
 */
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `tag` | `string` | Tag name without `#` prefix |
| `handler` | `(value: string, context: Object) => Object` | Processing function |

### Handler Function

```javascript
handler: (value, context) => result
```

- **value**: String after the colon (`# tag:value` → `"value"`)
- **context**: Accumulated context from previous tags in this chunk
- **result**: Object to merge into context (return `{}` for no-op)

### Example

```javascript
const tagHandlers = [
  // Simple value extraction
  {
    tag: 'speaker',
    handler: (value) => ({ speaker: value }),
  },

  // Context-aware handler
  {
    tag: 'expression',
    handler: (value, context) => ({
      character: {
        ...context.character,
        expression: value,
      },
    }),
  },

  // Boolean flag
  {
    tag: 'story_start',
    handler: () => ({ story_start: true }),
  },
];
```

---

## ExternalFunction

Defines a JavaScript function callable from ink.

```javascript
/**
 * External function definition for ink.
 *
 * @typedef {Object} ExternalFunction
 * @property {string} name - Function name as called from ink (e.g., 'delay_next')
 * @property {function(...any): any} fn - The JavaScript function implementation
 * @property {boolean} lookAheadSafe - If true, safe to call during ink's lookahead evaluation (no side effects)
 */
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Function name in ink |
| `fn` | `(...args) => any` | JavaScript implementation |
| `lookAheadSafe` | `boolean` | Safe during lookahead? |

### lookAheadSafe

Ink evaluates conditionals before actual execution (lookahead). Functions with side effects must be `lookAheadSafe: false` to prevent premature execution.

| Type | lookAheadSafe | Example |
|------|---------------|---------|
| Pure query | `true` | `has_item("key")` |
| State read | `true` | `get_location()` |
| State mutation | `false` | `advance_day()` |

Note: Notifications are emergent (via `# targetChat:` tag), not triggered by external function.

### Example

```javascript
const externalFunctions = [
  // Pure query (safe for lookahead)
  {
    name: 'has_item',
    fn: (itemId) => inventory.has(itemId),
    lookAheadSafe: true,
  },

  // Returning a value to ink
  {
    name: 'name',
    fn: (id, variant = 'short') => {
      const i18n = context.getI18n();
      return i18n?.getName(id, variant) ?? id;
    },
    lookAheadSafe: true,
  },

  // State mutation (not safe for lookahead)
  {
    name: 'advance_day',
    fn: () => {
      timeContext.advanceDay();
    },
    lookAheadSafe: false,
  },
];
```

---

## contextRegistry

Service locator for decoupling systems from implementations. Allows implementations to register services that system components access through accessor functions.

```javascript
import { contextRegistry } from '../../foundation/services/context-registry.js';
```

### Methods

| Method | Description |
|--------|-------------|
| `register(name, service)` | Register a service by name |
| `get(name)` | Retrieve a registered service (or undefined) |
| `clear()` | Clear all registrations (for testing) |

### Usage

Implementations register services at startup:

```javascript
// In implementation main.js
import { contextRegistry } from '../../foundation/services/context-registry.js';
import { i18n } from './services/i18n.js';
import { APP, CHATS, UI } from './config.js';

contextRegistry.register('i18n', i18n);
contextRegistry.register('config', { app: APP, chats: CHATS, ui: UI });
```

System components access via accessor functions:

```javascript
// In system component
import { t, getChat } from '../services/conversation-context.js';

// These accessors safely retrieve from registry with fallbacks
const label = t('hub.pinned');      // Returns key if i18n not registered
const chat = getChat('pat');         // Returns undefined if not found
```

### Why Not Direct Import?

Systems must not import from implementations (system isolation). The registry allows:

1. **Decoupling**: Systems define accessors, implementations provide values
2. **Testability**: Tests can register mock services via `contextRegistry.clear()` + `register()`
3. **Multiple implementations**: Different games register different configs

---

## createSystemContext Factory

Factory function to create SystemContext objects.

```javascript
/**
 * Create a SystemContext object for use with system external functions.
 * Reduces boilerplate when setting up system composition.
 *
 * @param {Object} options
 * @param {Foundation} options.foundation - The foundation instance
 * @param {EventBus} options.eventBus - Event bus for cross-component communication
 * @param {TimeContext} options.timeContext - Time context service
 * @param {function(): Object} [options.getViewState] - Returns current view state
 * @param {function(): Object|null} [options.getI18n] - Returns i18n service
 * @returns {SystemContext}
 */
export function createSystemContext(options);
```

### Usage

```javascript
import { Foundation, createSystemContext } from '../../foundation/index.js';
import { eventBus } from '../../foundation/services/event-bus.js';
import { timeContext } from '../../foundation/services/time-context.js';

const foundation = new Foundation();

const context = createSystemContext({
  foundation,
  eventBus,
  timeContext,
  getViewState: () => gameController.getCurrentView(),
  getI18n: () => i18n,
});
```

---

## Lifecycle

### System Composition

```javascript
// 1. Create foundation
const foundation = new Foundation();

// 2. Create context
const context = createSystemContext({ foundation, eventBus, timeContext });

// 3. Collect handlers from systems
const systems = [conversationSystem, adventureSystem];
const tagHandlers = systems.flatMap(s => s.tagHandlers);
const externalFunctions = systems.flatMap(s => s.createExternalFunctions(context));

// 4. Start foundation with merged handlers
await foundation.start(storyUrl, { tagHandlers, externalFunctions });

// 5. Initialize systems
for (const system of systems) {
  system.init(foundation.runtime, eventBus, options);
}
```

### Initialization Order

1. Foundation created
2. Context created with foundation reference
3. External functions created (may access context)
4. Foundation started (binds external functions)
5. System init() called (may subscribe to events)

---

## Related

- [Creating a New System](../guides/developers/new-system.md) - System development guide
- [Building a New Implementation](../guides/developers/new-implementation.md) - Composing systems
- [Framework vs Content](../concepts/framework-vs-content.md) - The four-layer separation
