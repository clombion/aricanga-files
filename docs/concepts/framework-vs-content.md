# Framework vs Content

Understanding the separation between reusable framework code and game-specific content.

---

## The Three Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  IMPLEMENTATION LAYER                                            │
│  Game-specific code, content, and wiring                         │
│  Specific to your game                                           │
│                                                                  │
│  experiences/{impl}/                                             │
│  - src/main.js (entry point)                                     │
│  - src/game-controller.js, game-state.js                         │
│  - src/services/ (i18n, data-service, data-loader)               │
│  - src/components/ (debug-panel, settings-page, about-page)      │
│  - data/ (base-config.toml + locales/)                           │
│  - ink/ (narrative files per locale)                             │
│  - assets/ (images, audio, fonts)                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SYSTEMS LAYER                                                   │
│  Reusable vocabulary and UI                                      │
│  Reusable across phone-style stories                             │
│                                                                  │
│  packages/framework/src/systems/conversation/                    │
│  - Tag handlers (speaker, type, delay, presence, targetChat)     │
│  - External functions (delay_next, name, advance_day)            │
│  - Components (chat-hub, chat-thread, notification-drawer/popup) │
│  - Services (BatteryContext)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FOUNDATION LAYER                                                │
│  Core runtime services                                           │
│  Reusable for ANY interactive fiction                            │
│                                                                  │
│  packages/framework/src/foundation/                              │
│  - EventBus (cross-component communication)                      │
│  - TimeContext (day/time simulation)                             │
│  - StorageAdapter (persistence abstraction)                      │
│  - InkRuntime (story execution)                                  │
│  - EventLogger (analytics)                                       │
│  - createSystemContext() (context factory)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Foundation Layer: The Engine

The foundation provides vocabulary-agnostic services that any interactive fiction game needs.

### EventBus

Cross-component communication without tight coupling:

```javascript
// Publish
eventBus.emit('custom:event', { data });

// Subscribe
eventBus.on('custom:event', (payload) => { ... });
```

### TimeContext

Game time simulation:

```javascript
timeContext.getTime();      // Current game time
timeContext.getDay();       // Current day number
timeContext.advanceTime();  // Move time forward
```

### StorageAdapter

Persistence abstraction (localStorage, IndexedDB, or custom):

```javascript
await storage.save('key', data);
const data = await storage.load('key');
```

### InkRuntime

Story execution wrapper:

```javascript
runtime.continue();         // Advance story
runtime.getChoices();       // Get current choices
runtime.choose(index);      // Make choice
runtime.getVariable(name);  // Read ink variable
```

### createSystemContext()

Factory for creating context objects passed to system external functions:

```javascript
const context = createSystemContext({
  foundation,
  eventBus,
  timeContext,
  getViewState: () => currentView,
  getI18n: () => i18n,
});
```

---

## Systems Layer: The Vocabulary

Systems define game-type specific concepts. The conversation system provides phone-chat vocabulary:

- **State machine factory** - `createConversationMachine()` handles message buffering, delays, cross-chat state
- **Tag handlers** - Transform `# speaker:Pat` into structured message data, `# targetChat:` for cross-chat messages
- **External functions** - `delay_next()`, `name()`, `advance_day()`, etc.
- **Components** - `chat-hub`, `chat-thread`, `notification-drawer`, `notification-popup`, etc.
- **Services** - `BatteryContext` for phone simulation

See [Conversation System Reference](../reference/conversation-system.md) for complete API documentation.

---

## Implementation Layer: Your Game Code

Implementations contain game-specific wiring that ties systems to content.

### Entry Point (`main.js`)

Imports components, initializes services, wires events to UI.

### Game Controller

Orchestrates state machine and component interactions.

### Game State

Thin wrapper (~30 lines) around the conversation system's `createConversationMachine()` factory. See [Building a New Implementation](../guides/developers/new-implementation.md) for examples.

### Game-Specific Services

- `i18n.js` - Localization for this game
- `data-service.js` - External data handling
- `config.js` - Re-exports from generated config

### Game-Specific Components

- `about-page.js` - About/credits page
- `debug-panel.js` - Development tools
- `glossary-page.js` - Educational glossary with term definitions
- `settings-page.js` - Game settings UI

---

## Content: Your Story

Content is specific to this game and not reusable.

### Ink Narrative (`{impl}/ink/`)

The actual story text and logic:

```ink
=== pat_chat ===
# speaker:Pat
# type:received
# time:9:23 AM
Morning. You see the Aricanga release?
```

### TOML Configuration (`{impl}/data/`)

Character definitions, UI strings, theme:

```toml
[characters.pat]
knot_name = "pat_chat"
display_name = "Pat"
# avatar color + initials auto-derived from display_name
```

### Assets (`{impl}/assets/`)

Images, audio, fonts specific to this game.

---

## What Goes Where?

| I want to... | Layer | Files to modify |
|--------------|-------|-----------------|
| Change dialogue | Implementation | `experiences/{impl}/ink/{locale}/chats/*.ink` |
| Add a character | Implementation | `experiences/{impl}/data/base-config.toml` + locale TOML + ink files |
| Translate the game | Implementation | `experiences/{impl}/data/locales/` + `experiences/{impl}/ink/{locale}/` |
| Change colors/theme | Content | `experiences/{impl}/data/base-config.toml` [ui.colors] |
| Add game-specific service | Implementation | `experiences/{impl}/src/services/` |
| Add game-specific component | Implementation | `experiences/{impl}/src/components/` |
| Add a message type | Systems | `packages/framework/src/systems/conversation/tags/` + components |
| Add external function | Systems | `packages/framework/src/systems/conversation/conversation-system.js` |
| Change typing indicator | Systems | `packages/framework/src/systems/conversation/components/` |
| Create adventure game | Systems + Implementation | New system + new implementation |
| Add persistence backend | Foundation | `packages/framework/src/foundation/services/storage-adapter.js` |
| Change event bus | Foundation | `packages/framework/src/foundation/services/event-bus.js` |

---

## Adding vs Extending

### Adding Content

Use existing vocabulary to add story:

1. Add character to TOML
2. Create ink file
3. Write narrative

No code changes needed.

### Extending the Implementation

Add game-specific features:

1. Add service in `experiences/{impl}/src/services/`
2. Add component in `experiences/{impl}/src/components/`
3. Wire in `main.js`

### Extending the Vocabulary

Add new tags, functions, or components:

1. Add tag handler in `packages/framework/src/systems/conversation/tags/`
2. Add event in `packages/framework/src/systems/conversation/events/`
3. Add component in `packages/framework/src/systems/conversation/components/`
4. Update system export

### Creating a New System

Build entirely different game type:

1. Create `packages/framework/src/systems/{name}/`
2. Define tag handlers
3. Define external functions
4. Create components
5. Create implementation that composes systems

---

## Why This Separation?

### For Writers

You can focus on narrative without knowing JavaScript:
- Change dialogue: edit ink files
- Add characters: edit TOML files
- The framework handles everything else

### For Developers

Clear boundaries for modification:
- Content changes don't require code changes
- System changes don't break other systems
- Foundation changes are rare and impactful

### For Translation

Unified content locations:
- All translatable strings in `{impl}/data/locales/`
- All narrative in `{impl}/ink/{locale}/`
- Single glossary in `{impl}/data/glossary.toml` (if present)

---

## Content vs Code Separation Rules

**Systems contribute code, not content.** This is intentional.

| What | Where | Per-System? | Why |
|------|-------|------------|-----|
| Tag handlers | `packages/framework/src/systems/{name}/tags/` | Yes | Different vocabularies |
| External functions | `packages/framework/src/systems/{name}/` | Yes | Different capabilities |
| Components | `packages/framework/src/systems/{name}/components/` | Yes | Different UI |
| Services | `packages/framework/src/systems/{name}/services/` | Yes | Different state |
| Ink narrative | `{impl}/ink/{locale}/` | **No** | Single story |
| UI strings | `{impl}/data/locales/` | **No** | Unified translation |
| Characters | `{impl}/data/base-config.toml` | **No** | Single registry |

**If your system needs new content:**
- Add to the content layer (TOML, ink, assets)
- The system only defines how content is processed and displayed

---

## Data Flow

```
Content (ink + TOML)
        │
        ▼
Foundation (InkRuntime)
        │
        ▼
System (tag handlers → structured data)
        │
        ▼
System (external functions ← ink calls)
        │
        ▼
Implementation (controller → state machine)
        │
        ▼
System (components → UI)
        │
        ▼
Foundation (EventBus → other systems)
```

---

## Related

- [Architecture](architecture.md) - System design overview
- [Conversation System Reference](../reference/conversation-system.md) - State machine factory, events, components
- [Creating a New System](../guides/developers/new-system.md) - System development guide
- [Building a New Implementation](../guides/developers/new-implementation.md) - Composing systems
- [System API Reference](../reference/system-api.md) - Type definitions
- [TOML Schema](../reference/toml-schema.md) - Configuration reference
