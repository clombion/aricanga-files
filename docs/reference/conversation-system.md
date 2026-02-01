# Conversation System Reference

The conversation system provides phone-chat vocabulary for interactive fiction. It handles message processing, multi-chat state management, timing delays, and cross-chat notifications.

**Location:** `packages/framework/src/systems/conversation/`

---

## Quick Start

```javascript
// In your implementation's game-state.js
import { createConversationMachine } from '../../systems/conversation/index.js';
import { parseTags } from '../../systems/conversation/utils.js';
import { timeContext } from '../../foundation/services/time-context.js';
import { CHAT_IDS } from './config.js';

export const gameStateMachine = createConversationMachine({
  machineId: 'game',
  parseTags,
  processMessageTime: timeContext.processMessageTime.bind(timeContext),
  knownChatIds: CHAT_IDS,
});
```

---

## State Machine Factory

### createConversationMachine(options)

Creates an XState machine for conversation state management.

```javascript
import { createConversationMachine } from '../../systems/conversation/index.js';
```

#### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `parseTags` | `function` | Yes | Tag parser (use `parseTags` from utils.js) |
| `processMessageTime` | `function` | Yes | Time processor from TimeContext |
| `machineId` | `string` | No | Machine ID (default: `'conversation'`) |
| `knownChatIds` | `string[]` | No | Valid chat IDs for validation warnings |
| `onStall` | `function` | No | Callback when story stops unexpectedly |

#### Example with All Options

```javascript
export const gameStateMachine = createConversationMachine({
  machineId: 'game',
  parseTags,
  processMessageTime: timeContext.processMessageTime.bind(timeContext),
  knownChatIds: ['pat', 'news', 'notes'],
  onStall: ({ path, visits, turn, hint }) => {
    console.warn('Story stalled:', { path, visits, turn, hint });
  },
});
```

#### Machine Context

The created machine manages this context:

| Property | Type | Description |
|----------|------|-------------|
| `story` | `Story` | inkjs Story instance |
| `currentView` | `{type: 'hub'} \| {type: 'chat', chatId}` | Current UI view |
| `messageHistory` | `{[chatId]: Message[]}` | All messages by chat |
| `savedChoicesState` | `{[chatId]: string}` | Saved ink state for pending choices |
| `bufferedMessage` | `Message \| null` | Message waiting for delay |
| `pendingDelay` | `number` | Accumulated delay in ms |
| `pendingAlerts` | `Alert[]` | Queued notifications |
| `lastReadMessageId` | `{[chatId]: string \| null}` | Read cursor for unread separator |
| `notifiedChatIds` | `Set<string>` | Chats with pending notifications |
| `deferredMessages` | `{[chatId]: Array<{message, delay}>}` | Messages awaiting chat open |

#### Machine States

```
loading → processing ⟷ delaying
              ↓
        waitingForInput
              ↓
            idle
```

| State | Description |
|-------|-------------|
| `loading` | Waiting for `STORY_LOADED` event |
| `processing` | Advancing story, creating messages |
| `delaying` | Waiting for typing delay to complete |
| `waitingForInput` | Story has choices, waiting for user |
| `idle` | Story paused (no choices, can't continue) |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `STORY_LOADED` | `{story, history?}` | Initialize with ink story |
| `CHOOSE` | `{index}` | Make a choice |
| `OPEN_CHAT` | `{chatId}` | Navigate to chat |
| `CLOSE_CHAT` | - | Return to hub |
| `CHECK_STORY` | - | Re-check if story can continue |
| `RESET_GAME` | - | Mark game as resetting |

---

## Helper Functions

Pure functions for message processing, exported for testing and reuse.

```javascript
import {
  isDuplicateMessage,
  extractStoryBoundary,
  parseMessage,
  validateTargetChat,
  getTargetChat,
} from '../../systems/conversation/index.js';
```

### isDuplicateMessage(history, message)

Check if message already exists in history (prevents duplicates on ink re-visits).

```javascript
const isDupe = isDuplicateMessage(chatHistory, newMessage);
// Checks last 10 messages for matching text + speaker + type
```

### extractStoryBoundary(tags, storyStartedThisRender)

Determine if we've passed the `# story_start` marker. Used at runtime to control time processing.

```javascript
const { storyStarted, isSeed, hasStoryStartTag } = extractStoryBoundary(tags, false);
// storyStarted: true after # story_start seen
// isSeed: true for messages before # story_start (no time processing)
```

**Note:** Seeds are extracted at build time by `build-seeds.js` and loaded into history at game start. The runtime `extractStoryBoundary` is still used to determine when time tags should affect the simulation clock.

### parseMessage(text, tags)

Create a typed message object from ink text and tags.

```javascript
import { parseMessage } from '../../systems/conversation/index.js';

const message = parseMessage('Hello!', { speaker: 'Pat', type: 'received', time: '9:23 AM' });
// Returns typed message with kind discriminant ('text', 'audio', 'image', 'attachment')
```

Message types are determined by tag presence:
- `# audio:path` → AudioMessage with `audioSrc`, `transcript`, `duration`
- `# image:path` → ImageMessage with `imageSrc`, `caption`
- `# attachment:path` → AttachmentMessage with `attachmentSrc`, `caption`
- default → TextMessage with `text`

### validateTargetChat(chatId, knownChatIds)

Validate chat ID, logging warnings for invalid values.

```javascript
const validChat = validateTargetChat(chatId, ['pat', 'news']);
// Returns 'unknown' and logs warning if chatId is null/undefined
// Logs warning if chatId not in knownChatIds
```

### getTargetChat(story, knownChatIds)

Extract `current_chat` variable from ink story with validation.

```javascript
const chatId = getTargetChat(story, ['pat', 'news']);
```

---

## Tag Handlers

The conversation system processes these ink tags:

### Message Tags

| Tag | Example | Description |
|-----|---------|-------------|
| `speaker` | `# speaker:Pat` | Message sender name |
| `type` | `# type:received` | Message type: `sent`, `received`, `system` |
| `time` | `# time:9:23 AM` | Display timestamp |
| `date` | `# date:-1` | Date separator (-1 = yesterday) |
| `notificationPreview` | `# notificationPreview:You have notes` | Override text for notification drawer/lock screen |

### Media Tags

| Tag | Example | Description |
|-----|---------|-------------|
| `image` | `# image:photo.jpg` | Inline image |
| `audio` | `# audio:memo.m4a` | Voice message |
| `duration` | `# duration:0:08` | Audio length |
| `attachment` | `# attachment:doc.pdf` | File attachment |

### Link Preview Tags

| Tag | Example | Description |
|-----|---------|-------------|
| `linkUrl` | `# linkUrl:glossary:eiti` | Target URL — `glossary:term-id` for internal, bare domain path for external (e.g., `example.com/page`). Do not use `https://` — ink treats `//` as a comment. Protocol is prepended automatically. |
| `linkDomain` | `# linkDomain:Glossary` | Display domain |
| `linkTitle` | `# linkTitle:EITI` | Preview title |
| `linkDesc` | `# linkDesc:Description text` | Preview description |
| `linkImage` | `# linkImage:/icon.svg` | Thumbnail image |
| `linkLayout` | `# linkLayout:card` | Layout: `card`, `inline`, `minimal` |
| `linkVideo` | `# linkVideo:true` | Show play button overlay |

### Control Tags

| Tag | Example | Description |
|-----|---------|-------------|
| `story_start` | `# story_start` | Boundary between seeds and active story |
| `delay` | `# delay:1500` | Pre-display pause (ms) |
| `view` | `# view:hub` | UI view switch |
| `clear` | `# clear` | Clear message history |
| `targetChat` | `# targetChat:pat` | Route message to specific chat (CQO-20) |
| `immediate` | `# immediate` | Skip HWM defer queue for background chats |

### Status Tags

| Tag | Example | Description |
|-----|---------|-------------|
| `presence` | `# presence:online` | Contact status |
| `status:battery` | `# status:battery:75` | Phone battery % |
| `status:signal` | `# status:signal:3` | Signal bars (0-4) |

---

## External Functions

JavaScript functions callable from ink:

### delay_next(ms)

Add typing delay before next message.

```ink
~ delay_next(800)
# type:received
Still thinking about it...
```

### name(id, variant)

Get localized character/entity name.

```ink
Morning. You see the {name("aricanga", "short")} release?
// → "Morning. You see the Aricanga release?"
```

### advance_day(morningTime?)

Skip to next day.

```ink
~ advance_day("8:00 AM")
```

### request_data(source, query, params)

Fetch external data (async).

```ink
~ request_data("eiti", "country_summary", "TZA")
```

---

## Events

Events emitted through the EventBus:

```javascript
import { EVENTS } from '../../systems/conversation/index.js';
```

### Message Events

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:message-received` | `EVENTS.MESSAGE_RECEIVED` | `{chatId, message, isCurrentChat}` | New message committed |
| `os:message-sent` | `EVENTS.MESSAGE_SENT` | `{chatId, choiceIndex, text}` | Player sent a message (choice selected) |

### Notification Events

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:notification-show` | `EVENTS.NOTIFICATION_SHOW` | `{chatId, preview}` | New notification (drawer subscribes - SSOT) |
| `os:notification-dismiss` | `EVENTS.NOTIFICATION_DISMISS` | `{chatId}` | Notification dismissed |


**Notification Flow (Drawer is SSOT):**
1. `NOTIFICATION_SHOW` fires from game-controller
2. `notification-drawer` subscribes → calls `add()` → emits `drawer-notification-added`
3. `notification-popup` listens to `drawer-notification-added` → shows banner (if lockscreen hidden)
4. `lock-screen` listens to `drawer-notification-added` → shows card (if visible)
5. `phone-status-bar` listens to `drawer-count-changed` → updates badge

### Typing Events

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:typing-start` | `EVENTS.TYPING_START` | `{chatId, speaker}` | Typing indicator should show |
| `os:typing-end` | `EVENTS.TYPING_END` | `{chatId}` | Typing indicator should hide |

### Presence Events

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:presence-changed` | `EVENTS.PRESENCE_CHANGED` | `{chatId, status}` | Contact presence changed |

### Chat Navigation Events

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:chat-opened` | `EVENTS.CHAT_OPENED` | `{chatId, messages}` | Chat opened |
| `os:chat-closed` | `EVENTS.CHAT_CLOSED` | `{}` | Returned to hub |
| `os:choices-available` | `EVENTS.CHOICES_AVAILABLE` | `{choices}` | Choices ready for display |

### Time Events

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:day-advanced` | `EVENTS.DAY_ADVANCED` | `{time, day}` | Day incremented |
| `os:time-updated` | `EVENTS.TIME_UPDATED` | `{time, day}` | Clock time changed |

### Battery Events

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:battery-changed` | `EVENTS.BATTERY_CHANGED` | `{battery, isLow}` | Battery level changed |

### Data Events (Async API)

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:data-requested` | `EVENTS.DATA_REQUESTED` | `{source, query, params}` | Ink requested external data |
| `os:data-received` | `EVENTS.DATA_RECEIVED` | `{source, data}` | External data received |
| `os:data-error` | `EVENTS.DATA_ERROR` | `{source, error}` | Data request failed |

### Lifecycle Events

| Event | Constant | Payload | Description |
|-------|----------|---------|-------------|
| `os:ready` | `EVENTS.READY` | `{}` | Game ready |

---

## Services

### BatteryContext

Phone battery simulation tied to TimeContext.

```javascript
import { batteryContext } from '../../systems/conversation/index.js';

batteryContext.getLevel();     // 0-100
batteryContext.drain(5);       // Reduce by 5%
batteryContext.charge(100);    // Set to 100%
```

---

## Components

Web components provided by the conversation system:

| Component | Description |
|-----------|-------------|
| `<lock-screen>` | Android-style lock screen with notifications (view-only) |
| `<chat-hub>` | Conversation list with badges |
| `<chat-thread>` | Message view with grouping |
| `<notification-drawer>` | Notification shade - **SSOT for notification state** |
| `<notification-popup>` | Toast notifications (view-only, listens to drawer) |
| `<typing-indicator>` | "is typing..." bubble |
| `<phone-status-bar>` | iOS-style status bar |
| `<audio-bubble>` | Voice message player |
| `<image-bubble>` | Image with lightbox |
| `<link-preview>` | Rich card preview for links |
| `<connection-overlay>` | "No internet" top banner (wifi0/mobile0) |

### Notification Drawer API

The `<notification-drawer>` is the single source of truth for notification state. It subscribes to `NOTIFICATION_SHOW` and emits `drawer-notification-added` for view-only consumers.

#### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `add(notification)` | object | Add notification (also emits `drawer-notification-added`) |
| `remove(chatId)` | `string` | Remove notifications for chat |
| `clearOne(index)` | `number` | Remove notification by index |
| `clearAll()` | none | Remove all notifications |

See [Component API Reference](component-api.md) for detailed documentation.

### Lock Screen API

The `<lock-screen>` component displays an Android-style lock screen with stacked notification cards. It is view-only - notification state is owned by `notification-drawer`.

#### Stacking Behavior

- **Max visible**: 3 notification cards
- **Stacking**: Behind cards have `scale(0.97)`, reduced opacity
- **Overflow**: "+N more" badge when 4+ notifications exist
- **Interaction**: Tapping any notification bounces the fingerprint icon

#### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `lock-screen-unlocked` | `{}` | Fired when user taps fingerprint to unlock |

See [Component API Reference](component-api.md) for detailed documentation.

### Avatar System

Avatars use a Signal-inspired deterministic color system. All avatar rendering is centralized in `utils/avatar.js`.

#### Color Assignment

Colors are derived from display names via a djb2 hash into a curated 14-color HSL palette. Each palette entry defines a hue + saturation; lightness is applied separately for background (75%) and foreground (25%), producing same-hue adaptive contrast — a lighter circle with darker initials.

```
ColorIndex = |djb2(name)| mod 14
bg = hsl(h, s%, 80%)   // lighter circle
fg = hsl(h, s%, 25%)   // darker same-hue initials
```

The palette is ordered for maximum hue distance between adjacent indices so nearby hash values produce visually distinct colors. The same logic runs at build time (`build-config.js`) and at runtime (`utils/avatar.js`).

#### Initials Extraction

First letter of first word + first letter of last word, uppercase. Words starting with non-letter characters (e.g., "(Editor)") are filtered out. Single-word names produce one letter.

#### Override Mechanism

In `base-config.toml`, characters can override colors and display:

| Field | Purpose | Example |
|-------|---------|---------|
| `avatar_color_name` | Named color enum (preferred) | `"purple"`, `"gray"` |
| `avatar_color` | Raw hex CSS color (legacy) | `"#a1a1aa"` |
| `avatar_letter` | Manual initials | `"GW"` |
| `avatar_image` | SVG/image asset (replaces initials) | `"avatars/notes-icon.svg"` |

**Available color names:** `blue`, `orange`, `green`, `pink`, `yellow`, `purple`, `vermilion`, `cyan`, `red`, `olive`, `violet`, `teal`, `indigo`, `gray`.

Named colors produce proper same-hue bg/fg pairs. Use `avatar_image` with an SVG using `currentColor` strokes to get an icon that inherits the foreground color.

**Color resolution order:** `avatar_color_name` > `avatar_color` > hash-derived.

#### Shared Renderer

`renderAvatar(chat, options?)` in `utils/avatar.js` is used by all components:
- `chat.avatarImage` → image avatar with colored background
- `chat.avatarColorName` → named color enum override
- `chat.avatarColor` → raw CSS color override (legacy)
- Otherwise derived from `chat.title`
- `options.cssClass` for component-specific styling (e.g., `'banner-avatar'`, `'notification-avatar'`)

---

## XState Vendoring

XState v5.25.0 is vendored in `packages/framework/src/vendor/xstate/` to eliminate CDN dependencies.

**Import path:**
```javascript
import { createActor } from '../../vendor/xstate/dist/xstate.esm.js';
```

See `packages/framework/src/vendor/README.md` for update instructions.

---

## Lint Rules

### CQO-18: Chat Knots Set current_chat

Every chat knot must set `current_chat` immediately:

```ink
=== pat_chat ===
~ current_chat = "pat"
```

**Validation:** `bash experiences/aricanga/utils/ink/lint-current-chat.sh`

See [CQO Reference](cqo.md#cqo-18-chat-knots-set-current_chat) for details.

### CQO-20: Cross-Chat Messages Use targetChat Tag

Cross-chat messages must use the `# targetChat` tag instead of temporary variable swapping:

```ink
// CORRECT - targetChat tag captures routing at Continue() time
# targetChat:pat
# speaker:Pat
Morning. You see the release?

// DEPRECATED - variable reset happens before getTargetChat() reads it
~ temp saved_chat = current_chat
~ current_chat = "pat"
# speaker:Pat
Morning. You see the release?
~ current_chat = saved_chat
```

**Runtime behavior:** `targetChat` is resolved in `getTargetChat()` at the moment `processStoryChunk` runs. The framework compares the resolved target against `currentView.chatId`. If they match, the message commits inline. If they differ, it enters the deferred queue and triggers a notification. This means routing is purely a runtime decision — the same ink content adapts to wherever the player happens to be.

**Validation:** `bash experiences/aricanga/utils/ink/lint-cross-chat.sh`

---

## File Structure

```
packages/framework/src/systems/conversation/
├── index.js                 # Public API exports
├── conversation-system.js   # System definition
├── utils.js                 # parseTags and utilities
├── state/
│   ├── chat-machine.js      # State machine factory
│   └── chunk-helpers.js     # Pure helper functions
├── tags/
│   └── index.js             # Tag handlers
├── events/
│   └── events.js            # Event constants
├── services/
│   ├── battery-context.js   # Battery simulation
│   └── conversation-context.js  # Registry accessors
└── components/
    ├── chat-hub.js
    ├── chat-thread.js
    └── ...
```

---

## Related

- [System API Reference](system-api.md) - Generic system interface
- [Component API Reference](component-api.md) - Web component documentation
- [Architecture](../concepts/architecture.md) - System layers overview
- [Framework vs Content](../concepts/framework-vs-content.md) - Layer separation
- [Building a New Implementation](../guides/developers/new-implementation.md) - Using the factory
- [CQO Reference](cqo.md) - Code quality objectives
