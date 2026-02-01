# Creating a New System

> **Audience:** Framework Developers

How to create a new vocabulary system for different types of interactive fiction.

---

## What is a System?

Systems define the game's **vocabulary** and **UI**. They sit between the foundation (runtime, events, storage) and implementations (game-specific code).

The conversation system provides phone-chat vocabulary:
- Tags: `speaker`, `type`, `delay`, `presence`, `targetChat`
- External functions: `delay_next()`, `name()`, `advance_day()`
- Components: `chat-hub`, `chat-thread`, `notification-popup`, `notification-drawer`

You might create systems for:
- Adventure games (location, inventory, examine)
- Visual novels (character, expression, background)
- Tutorial sequences (step, hint, highlight)

---

## System Shape

Every system is a simple object with a known shape:

```javascript
/**
 * @type {import('../../foundation/types.js').System}
 */
export const mySystem = {
  id: 'mysystem',
  tagHandlers: [ /* array of { tag, handler } */ ],
  createExternalFunctions(context) {
    return [ /* array of { name, fn, lookAheadSafe } */ ];
  },
  init(runtime, eventBus, options) {
    /* setup code */
  },
};
```

See [System API Reference](../../reference/system-api.md) for detailed type definitions.

---

## Step 1: Create System Directory

```
packages/framework/src/systems/mysystem/
├── index.js              # System export
├── mysystem-system.js    # System definition
├── tags/
│   └── index.js          # Tag handlers
├── events/
│   ├── events.js         # Event constants
│   └── factories.js      # Event payload factories
├── components/           # Web components (optional)
└── services/             # System-specific services (optional)
```

---

## Step 2: Define Tag Handlers

In `tags/index.js`:

```javascript
export const tagHandlers = [
  // Location tag: # location:tavern
  {
    tag: 'location',
    handler: (value, context) => ({ location: value }),
  },

  // Character tag: # character:innkeeper
  {
    tag: 'character',
    handler: (value, context) => ({ character: value }),
  },

  // Expression tag: # expression:surprised
  {
    tag: 'expression',
    handler: (value, context) => {
      const character = context.character || {};
      character.expression = value;
      return { character };
    },
  },
];
```

### Handler Signature

```javascript
handler: (value, context) => result
```

- `value`: String after the colon (`# tag:value` → `"value"`)
- `context`: Accumulated context from previous tags in this chunk
- `result`: Object to merge into context

---

## Step 3: Define External Functions

In the system file:

```javascript
export function createExternalFunctions(context) {
  return [
    {
      name: 'move_to',
      fn: (locationId) => {
        // Side effect: emit location change event
        const eventBus = context.getEventBus();
        eventBus.emit(EVENTS.LOCATION_CHANGED, { locationId });
        return true;
      },
      lookAheadSafe: false, // Has side effects
    },
    {
      name: 'has_item',
      fn: (itemId) => {
        // Pure query, no side effects
        return context.inventory.has(itemId);
      },
      lookAheadSafe: true, // Safe during lookahead
    },
  ];
}
```

### lookAheadSafe

Ink's lookahead evaluates conditionals before actual execution. Functions with side effects must be `lookAheadSafe: false` to prevent premature execution.

---

## Step 4: Define Events

In `events/events.js`:

```javascript
export const EVENTS = {
  LOCATION_CHANGED: 'adventure:location-changed',
  ITEM_ACQUIRED: 'adventure:item-acquired',
  CHARACTER_SPOKE: 'adventure:character-spoke',
};
```

In `events/factories.js`:

```javascript
export function createLocationEvent(locationId, previousId) {
  return { locationId, previousId, timestamp: Date.now() };
}

export function createItemEvent(itemId, quantity = 1) {
  return { itemId, quantity, timestamp: Date.now() };
}
```

---

## Step 5: Export the System

In `index.js`:

```javascript
export { adventureSystem } from './adventure-system.js';
export { tagHandlers } from './tags/index.js';
export { EVENTS } from './events/events.js';
export * from './events/factories.js';
```

In `adventure-system.js`:

```javascript
import { tagHandlers } from './tags/index.js';
import { EVENTS } from './events/events.js';

/**
 * @type {import('../../foundation/types.js').System}
 */
export const adventureSystem = {
  id: 'adventure',
  tagHandlers,

  createExternalFunctions(context) {
    return [
      // ... external functions
    ];
  },

  init(runtime, eventBus, options = {}) {
    // Subscribe to events, set up services
    eventBus.on(EVENTS.LOCATION_CHANGED, (data) => {
      // Handle location changes
    });
  },
};
```

---

## Step 6: Create Components (Optional)

If your system needs custom UI:

```javascript
// components/location-display.js
export class LocationDisplay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: var(--ink-spacing-md);
        }
      </style>
      <div class="location">
        <h2>${this.getAttribute('name')}</h2>
        <slot></slot>
      </div>
    `;
  }
}

customElements.define('location-display', LocationDisplay);
```

---

## Choosing inkjs Features

Different systems benefit from different inkjs features. Key questions:

| Question | Answer | Feature |
|----------|--------|---------|
| How many save states? | One | StateSnapshot |
| How many save states? | Multiple | ToJson/LoadJson |
| Async effects needed? | No | Native callbacks |
| Async effects needed? | Yes | XState machine |
| Who controls logic? | Ink authors | Ink variables |
| Who controls logic? | JS code | VisitCount/TurnsSince |

See [inkjs Features Reference](../../reference/inkjs-features.md) for detailed guidance.

---

## Content vs Code Separation

**Systems contribute code, not content.** This is intentional.

| What | Where | Per-System? |
|------|-------|------------|
| Tag handlers | `packages/framework/src/systems/{name}/tags/` | Yes |
| External functions | `packages/framework/src/systems/{name}/` | Yes |
| Components | `packages/framework/src/systems/{name}/components/` | Yes |
| Ink narrative | `experiences/{impl}/ink/{locale}/` | **No** |
| UI strings | `experiences/{impl}/data/locales/` | **No** |
| Character config | `experiences/{impl}/data/base-config.toml` | **No** |

If your system needs new content:
- New characters → Add to implementation's `data/base-config.toml` and locale files
- New ink knots → Add to implementation's `ink/{locale}/` and INCLUDE in main
- New UI strings → Add to implementation's `data/locales/{locale}.toml`

---

## Related

- [Building a New Implementation](new-implementation.md) - Composing systems
- [System API Reference](../../reference/system-api.md) - Type definitions
- [inkjs Features Reference](../../reference/inkjs-features.md) - Feature catalog
- [Framework vs Content](../../concepts/framework-vs-content.md) - The four-layer separation
