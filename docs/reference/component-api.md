# Component API Reference

Public interfaces for web components in the conversation system.

---

## chat-hub

Conversation list showing all available chats.

**File:** `packages/framework/src/systems/conversation/components/chat-hub.js`

### Attributes

None. Configuration loaded from `CHATS` in config.js.

### Events Emitted

| Event | Detail | Description |
|-------|--------|-------------|
| `chat-selected` | `{ chatId: string }` | User selected a conversation |
| `player-profile-requested` | none | User clicked profile avatar |

### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `setUnread(chatId, unread)` | `string`, `boolean` | Update badge state |
| `setPreview(chatId, text, time, type)` | `string`, `string`, `string`, `string` | Update preview text, timestamp, and message type (`'sent'`/`'received'`/`'system'`) |

### EventBus Subscriptions

| Event | Action |
|-------|--------|
| `EVENTS.NOTIFICATION_SHOW` | Calls `setUnread(chatId, true)` (sets badge dot) |
| `EVENTS.CHAT_OPENED` | Calls `setUnread(chatId, false)` (clears badge dot) |
| `EVENTS.MESSAGE_RECEIVED` | Calls `setPreview()` |
| `I18N_EVENTS.LOCALE_READY` | Re-renders for locale |
| `I18N_EVENTS.LOCALE_CHANGED` | Re-renders for locale |

### Example

```javascript
const hub = document.querySelector('chat-hub');

hub.addEventListener('chat-selected', (e) => {
  controller.openChat(e.detail.chatId);
});
```

---

## chat-thread

Message view for a single conversation.

**File:** `packages/framework/src/systems/conversation/components/chat-thread/index.js`

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `hidden` | boolean | Visibility state |

### Events Emitted

| Event | Detail | Description |
|-------|--------|-------------|
| `thread-closed` | none | User clicked back button |
| `choice-selected` | `{ index: number }` | User selected a choice |

### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `open(chatId, title, messages, opts?)` | `string`, `string`, `Message[]`, `{lastReadMessageId?, hasUnread?}` | Open chat with history. If `hasUnread` and `lastReadMessageId`, inserts `<unread-separator>` after that message. |
| `close()` | none | Hide thread, emit `thread-closed` |
| `addMessage(message)` | `Message` | Append message and scroll |
| `setChoices(choices)` | `Choice[]` | Display response options |
| `clearChoices()` | none | Remove choice buttons |
| `setPresence(status)` | `string` | Update header status |
| `showTyping(speaker)` | `string?` | Show typing indicator |
| `hideTyping()` | none | Hide typing indicator |
| `scrollToBottom(smooth)` | `boolean` | Scroll to latest message |
| `openImagePreview(src, caption)` | `string`, `string` | Open image lightbox |
| `closeImagePreview()` | none | Close image lightbox |

### EventBus Subscriptions

| Event | Action |
|-------|--------|
| `EVENTS.MESSAGE_RECEIVED` | Calls `addMessage()` if current chat |
| `EVENTS.CHOICES_AVAILABLE` | Calls `setChoices()` |
| `EVENTS.TYPING_START` | Calls `showTyping()` |
| `EVENTS.TYPING_END` | Calls `hideTyping()` |
| `EVENTS.PRESENCE_CHANGED` | Calls `setPresence()` |

### Sub-components

| Component | Purpose |
|-----------|---------|
| `chat-header` | Title bar with back button and presence |
| `conversation-banner` | Chat start message |
| `date-separator` | Date dividers between messages |
| `unread-separator` | "New messages" divider (HWM system) |
| `choice-buttons` | Player response selection |
| `typing-indicator` | Animated typing bubble |

### Image Lightbox

`chat-thread` owns the image lightbox overlay (not `image-bubble`). This ensures the lightbox persists when messages re-render. Listens for `image-preview-open` events from `image-bubble` components.

- Lightbox has `role="dialog"` with `aria-label`
- Focus trap prevents tabbing outside lightbox
- `Escape` key closes lightbox
- Close button has `aria-label` from `ui.a11y.close_image`
- Focus restored to thumbnail when lightbox closes

### Example

```javascript
const thread = document.querySelector('chat-thread');

thread.addEventListener('thread-closed', () => {
  controller.closeChat();
});

thread.addEventListener('choice-selected', (e) => {
  controller.selectChoice(e.detail.index);
});
```

---

## notification-drawer

Notification shade (Android-style) with quick action tiles. **Single source of truth for notification state.**

**File:** `packages/framework/src/systems/conversation/components/notification-drawer.js`

### Attributes

None.

### Events Emitted

| Event | Detail | Description |
|-------|--------|-------------|
| `drawer-count-changed` | `{ count: number }` | Notification count changed |
| `drawer-notification-added` | notification object | New notification added (for popup/lockscreen) |
| `notification-clicked` | `{ chatId: string }` | User clicked notification |
| `game-reset-requested` | none | User confirmed restart |
| `settings-requested` | none | User clicked settings tile |
| `about-requested` | none | User clicked about tile |
| `glossary-requested` | none | User clicked glossary tile |
| `lockscreen-requested` | `{ notifications }` | User clicked lock button |
| `theme-toggle-requested` | none | User clicked theme toggle |

### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `add(notification)` | object | Add notification (emits `drawer-notification-added`) |
| `remove(chatId)` | `string` | Remove notifications for chat |
| `clearOne(index)` | `number` | Remove notification by index |
| `clearAll()` | none | Remove all notifications |
| `open()` | none | Show drawer overlay |
| `close()` | none | Hide drawer overlay |
| `count` | (getter) | Current notification count |

### EventBus Subscriptions

| Event | Action |
|-------|--------|
| `EVENTS.NOTIFICATION_SHOW` | Calls `add()` (SSOT for notifications) |
| `EVENTS.THEME_CHANGED` | Updates theme icon |
| `I18N_EVENTS.LOCALE_READY` | Re-renders for locale |
| `I18N_EVENTS.LOCALE_CHANGED` | Re-renders for locale |

### Example

```javascript
const drawer = document.querySelector('notification-drawer');

// Drawer count updates status bar badge
document.addEventListener('drawer-count-changed', (e) => {
  statusBar.updateDrawerCount(e.detail.count);
});

// Remove from drawer when user opens chat
document.addEventListener('notification-clicked', (e) => {
  drawer.remove(e.detail.chatId);
  controller.openChat(e.detail.chatId);
});
```

---

## notification-popup

iOS-style stacking notifications (view-only layer).

**File:** `packages/framework/src/systems/conversation/components/notification-popup.js`

The `notification-drawer` is the single source of truth for notification state. This component only handles visual display of transient banners.

### Attributes

None.

### Events Emitted

| Event | Detail | Description |
|-------|--------|-------------|
| `notification-clicked` | `{ chatId: string }` | User tapped notification |
| `notification-dismissed` | none | User dismissed manually |

### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `show(...)` | notification fields | Display notification banner |
| `dismiss()` | none | Remove top notification |

### DOM Event Subscriptions

| Event | Action |
|-------|--------|
| `drawer-notification-added` | Shows popup (if lockscreen hidden) |

### Configuration

From `UI.timings`:

| Key | Default | Description |
|-----|---------|-------------|
| `notificationAutoHide` | 5000ms | Time before auto-dismiss |
| `notificationStagger` | 1500ms | Delay between stacked notifications |

### Stacking Behavior

- Maximum 3 visible notifications
- Oldest evicted when at capacity
- Auto-hides after timeout (notification stays in drawer)

### Example

```javascript
const popup = document.querySelector('notification-popup');

popup.addEventListener('notification-clicked', (e) => {
  // main.js removes from drawer and opens chat
  drawer.remove(e.detail.chatId);
  controller.openChat(e.detail.chatId);
});
```

---

## typing-indicator

Animated three-dot typing bubble.

**File:** `packages/framework/src/systems/conversation/components/typing-indicator.js`

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `hidden` | boolean | Visibility state |

### Events Emitted

None.

### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `show(speaker)` | `string?` | Show with optional speaker name |
| `hide()` | none | Hide indicator |

### Accessibility

- `aria-label` set to localized typing status
- Respects `prefers-reduced-motion`:
  - With motion: Animated bouncing dots
  - Without motion: Static dots with varying opacity

### Example

```javascript
const indicator = document.querySelector('typing-indicator');

indicator.show('Pat');  // Shows "Pat is typing"
indicator.hide();
```

---

## audio-bubble

Voice message player with waveform and transcript reveal.

**File:** `packages/framework/src/systems/conversation/components/audio-bubble.js`

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `duration` | string | Display duration (e.g., "0:08") |
| `type` | string | `sent` or `received` (affects bubble color) |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `transcript` | string | Set hidden transcript text |
| `isRevealed` | boolean (readonly) | Whether transcript has been shown |

### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `showTranscript()` | none | Animate generating, then reveal transcript |

### Events Emitted

| Event | Detail | Description |
|-------|--------|-------------|
| `transcript-revealed` | none | Transcript animation completed |
| `play-requested` | none | Play button clicked (for future audio support) |

### Accessibility

- Play button has `aria-label` from `ui.a11y.play_voice_message`
- Respects `prefers-reduced-motion` for animations

### Example

```javascript
const audio = document.createElement('audio-bubble');
audio.setAttribute('duration', '0:08');
audio.setAttribute('type', 'received');
audio.transcript = 'The voice message content here';

audio.addEventListener('transcript-revealed', () => {
  thread.scrollToBottom(true);
});
```

---

## image-bubble

Image message thumbnail. Emits event to open lightbox (managed by `chat-thread`).

**File:** `packages/framework/src/systems/conversation/components/image-bubble.js`

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `src` | string | Image URL |
| `type` | string | `sent` or `received` (affects bubble color) |
| `caption` | string | Optional caption below image |

### Events Emitted

| Event | Detail | Description |
|-------|--------|-------------|
| `image-preview-open` | `{ src: string, caption: string }` | User clicked/activated thumbnail |

### Keyboard Support

- `Enter`/`Space` on thumbnail emits `image-preview-open`

### Accessibility

- Thumbnail has `role="button"` and `tabindex="0"`
- Graceful fallback UI on image load error

### Lightbox

The lightbox overlay is managed by `chat-thread`, not by this component. This design ensures the lightbox persists across message re-renders. See `chat-thread` for lightbox accessibility details (focus trap, Escape key, etc.).

### Example

```javascript
const img = document.createElement('image-bubble');
img.setAttribute('src', 'assets/photo.jpg');
img.setAttribute('type', 'received');
img.setAttribute('caption', 'Check this out!');
```

---

## connection-overlay

Full-screen overlay showing "Reconnecting..." state.

**File:** `packages/framework/src/systems/conversation/components/connection-overlay.js`

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `hidden` | boolean | Visibility state |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `isVisible` | boolean (readonly) | Current visibility state |

### Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `show()` | none | Display the overlay |
| `hide()` | none | Hide the overlay |

### Accessibility

- Content has `role="alert"` and `aria-live="assertive"`
- Respects `prefers-reduced-motion` (static spinner)

### Example

```javascript
const overlay = document.querySelector('connection-overlay');

// Simulate network issue
overlay.show();

setTimeout(() => {
  overlay.hide();
}, 3000);
```

---

## home-indicator

iOS-style bottom bar for phone metaphor.

**File:** `packages/framework/src/systems/conversation/components/home-indicator.js`

### Attributes

None.

### CSS Custom Properties

| Property | Default | Description |
|----------|---------|-------------|
| `--ink-home-indicator-width` | `134px` | Bar width |
| `--ink-home-indicator-height` | `5px` | Bar height |

### Accessibility

- Bar element has `aria-hidden="true"` (decorative)

### Example

```html
<home-indicator></home-indicator>
```

---

## conversation-settings

Per-conversation settings page (contact profile).

**File:** `packages/framework/src/systems/conversation/components/conversation-settings.js`

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `chat-id` | string | Chat ID for config lookup |

### Events Emitted

| Event | Detail | Description |
|-------|--------|-------------|
| `settings-closed` | none | User clicked back button |

### Rendered Content

- Header with back button + "Contact" title
- Large contact avatar (72px)
- Contact name
- Status/bio text (if `config.status` is set)
- Search button (placeholder)
- Disappearing messages status
- Chat color & wallpaper (placeholder)

---

## player-profile

Player's own profile page. Opened by clicking the player avatar in the hub header.

**File:** `packages/framework/src/systems/conversation/components/player-profile.js`

### Attributes

None. Configuration loaded from `getApp()`.

### Events Emitted

| Event | Detail | Description |
|-------|--------|-------------|
| `navigate-back` | none | User clicked back button |

### Rendered Content

- Header with back button + "Profile" title
- Large player avatar (140px) — profile image or letter fallback
- Info rows: Name ("You"), About (player status), Contact (player email)
- All values config-driven via `getApp()`

### Example

```javascript
document.addEventListener('player-profile-requested', () => {
  transition(hub, playerProfile, TRANSITIONS.ENTER_DEEPER);
});
```

---

## Event Naming Convention

Events follow consistent patterns:

| Pattern | Examples | Used For |
|---------|----------|----------|
| `*-selected` | `chat-selected`, `choice-selected` | User selections |
| `*-clicked` | `notification-clicked`, `back-clicked` | Click actions |
| `*-closed` | `thread-closed` | Navigation away |
| `*-changed` | `presence-changed`, `drawer-count-changed` | State updates |
| `*-start/*-end` | `typing-start`, `typing-end` | Temporal states |

---

## Component Communication

Components communicate via EventBus, not direct method calls:

```
GameController → EventBus → Components
                    ↑
              ink-bridge
```

**Flow example (message received):**

1. `InkBridge` processes ink output
2. `GameController` emits `EVENTS.MESSAGE_RECEIVED`
3. `chat-hub` updates preview via subscription
4. `chat-thread` adds message via subscription

**Flow example (user selects chat):**

1. User clicks chat item
2. `chat-hub` emits `chat-selected`
3. `main.js` catches event, calls `controller.openChat()`
4. `GameController` emits `EVENTS.CHAT_OPENED`
5. `chat-thread` opens via `open()` method

---

## Related

- [Architecture](../concepts/architecture.md) - System layers
- [Event System](../concepts/architecture.md#data-flow) - EventBus details
- [Theming Guide](../guides/developers/theming.md) - CSS variables
