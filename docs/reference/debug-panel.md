# Debug Panel Reference

Development tool for inspecting and manipulating ink state during testing.

---

## Accessing the Debug Panel

Add `?debug` to your URL:

```
http://localhost:8000/experiences/aricanga/?debug
```

Or programmatically:

```javascript
window.DEBUG_MODE = true;
```

A green "Debug" button appears in the bottom-right corner when enabled.

---

## Features

### Variable Viewer

Displays key story variables with live updates (refreshes every 500ms):

| Category | Variables |
|----------|-----------|
| **Current state** | `current_chat`, `game_phase` |
| **Story progress** | `seen_announcement`, `player_agreed`, `draft_sent`, `article_published` |
| **Research** | `research_started`, `research_complete` |
| **TonyGov arc** | `spectre_contacted`, `agreed_to_meet` |
| **Unread badges** | Derived from `NOTIFICATION_SHOW` / `CHAT_OPENED` events (persisted in `unreadState`) |

**Boolean toggle:** Click the ON/OFF button next to any boolean variable to flip its value instantly.

### Quick Actions

Pre-configured state jumps for rapid testing:

| Button | Effect |
|--------|--------|
| **Skip to Draft** | Sets `seen_announcement`, `player_agreed`, `research_complete` = true |
| **Skip to Publish** | Sets `seen_announcement`, `player_agreed`, `draft_sent`, `article_published` = true |
| **Reset All** | Resets all story flags to false |
| **Trigger All Unread** | Fires `NOTIFICATION_SHOW` for all chats (tests badge display) |

---

## API

The debug panel interfaces with `GameController` methods:

```javascript
// Get a single variable
controller.getVariable('player_agreed')  // → true or false

// Get all variables
controller.getVariables()  // → { current_chat: "pat", ... }

// Set a variable (type-safe via InkBridge)
controller.setVariable('player_agreed', true)
```

---

## Implementation Details

**File:** `experiences/{impl}/components/debug-panel.js`

**Custom element:** `<debug-panel>`

**Initialization:**
```javascript
// In main.js
const debugPanel = document.querySelector('debug-panel');
debugPanel.setController(controller);
```

**Conditional display:**
- Checks `URLSearchParams` for `debug` parameter
- Falls back to `window.DEBUG_MODE` global
- Panel is completely hidden when neither is set

---

## Use Cases

### Testing Story Progression

Skip to late-game content without replaying:

1. Open debug panel
2. Click "Skip to Publish"
3. Navigate to TonyGov chat
4. Test post-publication dialogue

### Testing Unread Badges

Verify badge behavior across all chats:

1. Click "Trigger All Unread"
2. Check hub shows badges on all chats
3. Open each chat, verify badge clears

### Debugging Variable States

When a condition isn't triggering:

1. Expand debug panel
2. Locate the relevant variable
3. Verify actual vs expected value
4. Toggle to test conditional branches

---

## Limitations

- Variable list is hardcoded (not all ink variables shown)
- Cannot inspect XState machine state
- Cannot view message history
- Cannot trigger external functions directly

For comprehensive debugging, use browser DevTools:

```javascript
// Access XState snapshot
controller.actor.getSnapshot()

// Access message history
controller.actor.getSnapshot().context.messageHistory

// Access ink story directly
controller.story.variablesState.current_chat
```

---

## Related

- [QA Tools](qa-tools.md) - Testing commands
- [Architecture](../concepts/architecture.md) - System overview
- [Writing Guide](../guides/writers/writing-guide.md) - Variable naming conventions
