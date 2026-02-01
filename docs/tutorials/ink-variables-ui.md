# Integrating Ink Variables with UI

Connect story state to your web components.

**Prerequisites:** [Creating a Component](./creating-a-component.md)

---

## What You'll Learn

- Reading ink variables from components
- Reacting to variable changes
- The ink-bridge pattern
- Triggering UI updates from ink

---

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Ink      │────▶│  ink-bridge │────▶│  EventBus   │
│   Story     │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ GameController│    │ Components  │
                    └─────────────┘     └─────────────┘
```

The ink-bridge observes ink variables and emits events when they change.

---

## Reading Ink Variables

### From a Component

```javascript
import { getController } from '../services/conversation-context.js';

class MyComponent extends HTMLElement {
  connectedCallback() {
    this.updateFromInk();
  }

  updateFromInk() {
    const controller = getController();
    if (!controller) return;

    // Read multiple variables
    const vars = controller.getVariables();
    const currentChat = vars.current_chat;
    const gamePhase = vars.game_phase;

    this.render({ currentChat, gamePhase });
  }
}
```

### Variable Types

Ink variables map to JavaScript types:

| Ink Type | JavaScript | Example |
|----------|------------|---------|
| `VAR x = true` | boolean | `true` |
| `VAR x = 42` | number | `42` |
| `VAR x = "text"` | string | `"text"` |
| `VAR x = ""` | string | `""` |

---

## Reacting to Variable Changes

### EventBus Pattern

Subscribe to variable change events:

```javascript
import { eventBus } from '../services/event-bus.js';
import { EVENTS } from '../events/events.js';

class UnreadBadge extends HTMLElement {
  connectedCallback() {
    // Badge set when notification fires for a background chat
    this._unsubs = [
      eventBus.on(EVENTS.NOTIFICATION_SHOW, ({ chatId }) => {
        this.updateBadge(chatId, true);
      }),
      eventBus.on(EVENTS.CHAT_OPENED, ({ chatId }) => {
        this.updateBadge(chatId, false);
      }),
    ];

    this.render();
  }

  disconnectedCallback() {
    this._unsubs?.forEach(fn => fn?.());
  }

  updateBadge(chatId, isUnread) {
    const badge = this.shadowRoot.querySelector(`[data-chat="${chatId}"]`);
    if (badge) {
      badge.hidden = !isUnread;
    }
  }
}
```

### Common Events

| Event | Payload | When |
|-------|---------|------|
| `ink:variable-changed` | `{ name, value, oldValue }` | Any variable changes |
| `ink:story-continued` | `{ text, tags }` | New content output |
| `chat:opened` | `{ chatId }` | User opens a chat |
| `chat:closed` | `{ chatId }` | User leaves a chat |

---

## Setting Variables from JavaScript

### Via Controller

```javascript
const controller = getController();

// Set a single variable
controller.setVariable('seen_announcement', true);

// The change will trigger ink:variable-changed event
```

### When to Set Variables

- User interactions outside ink choices
- External data loaded
- Timer completions
- Save/restore operations

---

## The ink-bridge Module

The bridge connects inkjs to the rest of the system:

```javascript
// packages/framework/src/systems/conversation/ink-bridge.js

export function createInkBridge(story, eventBus) {
  // Watch for variable changes
  story.ObserveVariable('current_chat', (varName, newValue) => {
    eventBus.emit('ink:variable-changed', {
      name: varName,
      value: newValue
    });
  });

  // Bind external functions
  story.BindExternalFunction('delay_next', (ms) => {
    // Handled by message processing
  });
}
```

### External Functions

Ink can call JavaScript through external functions:

```ink
// In ink
~ delay_next(2000)  // 2 second pause before next message

// In ink-bridge.js
story.BindExternalFunction('delay_next', (ms) => {
  // Framework handles delay timing
});
```

Built-in external functions:
- `delay_next(ms)` - Pause before next message
- `name(id, variant)` - Get entity name
- `advance_day()` - Move to next day

### Cross-Chat Notifications

Notifications are **emergent** - they fire automatically when a message targets a background chat:

```ink
// Send message to spectre chat (notification fires automatically)
# targetChat:spectre
# speaker:TonyGov
# notificationPreview:I have information...
I have information you might find interesting.
```

See [Simulation Physics](../concepts/simulation-physics.md#emergent-notification-model) for details.

---

## Example: Live Unread Counter

A component that shows total unread count. Unread state derives from `NOTIFICATION_SHOW` (sets badge) and `CHAT_OPENED` (clears badge), persisted in `game-controller`'s `unreadState`.

```javascript
import { eventBus } from '../services/event-bus.js';
import { EVENTS } from '../events/events.js';

export class UnreadCounter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._unreadChats = new Set();
  }

  connectedCallback() {
    this._unsubs = [
      eventBus.on(EVENTS.NOTIFICATION_SHOW, ({ chatId }) => {
        this._unreadChats.add(chatId);
        this.render();
      }),
      eventBus.on(EVENTS.CHAT_OPENED, ({ chatId }) => {
        this._unreadChats.delete(chatId);
        this.render();
      }),
    ];

    this.render();
  }

  disconnectedCallback() {
    this._unsubs?.forEach(fn => fn?.());
  }

  render() {
    const count = this._unreadChats.size;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: ${count > 0 ? 'inline-flex' : 'none'};
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: var(--ink-color-primary, #007AFF);
          color: white;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
        }
      </style>
      ${count}
    `;
  }
}

customElements.define('unread-counter', UnreadCounter);
```

---

## Best Practices

### 1. Always Cleanup

```javascript
disconnectedCallback() {
  this._unsubscribe?.();
}
```

### 2. Debounce Rapid Updates

```javascript
_scheduleUpdate() {
  if (this._updatePending) return;
  this._updatePending = true;
  requestAnimationFrame(() => {
    this._updatePending = false;
    this.render();
  });
}
```

### 3. Null-Check the Controller

```javascript
const controller = getController();
if (!controller) {
  console.warn('Controller not ready');
  return;
}
```

### 4. Use Specific Event Filters

```javascript
// Good - only react to relevant changes
eventBus.on('ink:variable-changed', (data) => {
  if (data.name === 'game_phase') {
    this.updatePhase(data.value);
  }
});

// Avoid - reacting to all changes
eventBus.on('ink:variable-changed', () => {
  this.render();  // May cause excessive re-renders
});
```

---

## Checklist

- [ ] Component subscribes in `connectedCallback`
- [ ] Subscriptions cleaned up in `disconnectedCallback`
- [ ] Controller null-checked before use
- [ ] Event filters are specific
- [ ] Rapid updates debounced if needed

---

## What's Next?

- [Debugging Ink State](./debugging-ink.md) - Inspect and manipulate variables
- [Architecture](../concepts/architecture.md) - Full system overview
