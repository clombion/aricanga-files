# Simulation Physics

This document explains the "physics" of the messaging simulation: how messages move through the system, when notifications fire, and how the High Water Mark (HWM) system tracks read state.

---

## Message Lifecycle

Messages progress through three states:

```
    seeded (pre-story_start)
        ↓ # story_start tag
    active (live messages)
        ↓ background chat
    deferred (awaiting chat open)
```

### Seeded Messages

Messages before `# story_start` are **seeds** - backstory that appears as pre-existing chat history. Seeds are **extracted at build time** by `mise run build:seeds` and loaded into message history on fresh game start.

```ink
=== news_chat ===
// Seed messages (extracted at build time)
{news_chat == 1:
    # speaker:Gov News Wire
    # type:received
    # time:Sep 7
    Infrastructure bill passes
}

# story_start  // ← Boundary marker

// Active messages start here (processed at runtime)
# speaker:Gov News Wire
# type:received
# time:9:15 AM
BREAKING: Ministry announces...
```

**Seed invariants:**
- `_isSeed = true` on message object (set by build-seeds.js)
- No time processing (display time only)
- No notifications
- Only shown on first visit (`{knot == 1:}` guard in ink)
- Available immediately on hub load (no chat open required)

**After modifying ink seeds**, run `mise run build:seeds` to regenerate `seeds.js`. The `lint:seeds` task warns if ink files are newer than seeds.js.

### Active Messages

After `# story_start`, messages are **active**:
- Time tags advance game clock
- Messages trigger typing indicators
- Background chats receive notifications

### Deferred Messages

When a message targets a chat the player isn't viewing:
1. Message goes to `deferredMessages[chatId]` queue
2. Notification fires (unless already notified)
3. When player opens chat, deferred messages replay with typing animation

---

## Emergent Notification Model

Notifications are **emergent** - they arise automatically from the state of the simulation, not from imperative commands.

### How Notifications Fire

When a message targets a chat the player isn't viewing (via `# targetChat:chatId` tag), the framework automatically fires `NOTIFICATION_SHOW`:

```ink
// In pat.ink - player is viewing pat chat
# speaker:Pat
Check your notes app when you can.

// This message goes to notes chat (background)
# targetChat:notes
# type:sent
# notificationPreview:New assignment: Aricanga story
Jotting down notes about the Aricanga assignment...
```

**What happens:**
1. Message routes to `notes` chat (deferred, since player is viewing `pat`)
2. Framework detects background chat message
3. `NOTIFICATION_SHOW` fires automatically
4. Drawer adds notification, popup shows banner

### Constraints

Notifications are tied to messages. You **cannot**:
- Fire a notification without a message
- Control notification UI from ink
- Show notifications for the current chat

### Pattern

```ink
// Cross-chat message with notification preview
# targetChat:pat
# speaker:Pat
# notificationPreview:How's the story coming?
How's that Aricanga piece coming?
```

---

## Notification Rules (Invariants)

The notification system follows strict invariants:

| Condition | Notification? | Why |
|-----------|---------------|-----|
| Player viewing target chat | No | They see the message directly |
| Background chat, first message | Yes | Alert player to new activity |
| Background chat, subsequent | No | Already notified (once per session) |
| Seed message | No | Historical, not new activity |
| Same chat, different message | No | One notification per chat open |

**Implementation:** `notifiedChatIds` Set tracks which chats have pending notifications. Cleared when chat is opened.

### Drawer as Single Source of Truth

The `notification-drawer` component is the single source of truth for notification state:

```
NOTIFICATION_SHOW fires (from game-controller)
  ↓
notification-drawer subscribes → add() → emits drawer-notification-added
  ↓                                    → emits drawer-count-changed
  ↓
notification-popup listens to drawer-notification-added
  → if lockscreen visible: return (drawer already has it)
  → else: show banner (purely visual, no state)
  ↓
lock-screen listens to drawer-notification-added
  → if visible: render notification card (purely visual)
  ↓
phone-status-bar listens to drawer-count-changed
  → counter = drawer count (no duplicate state)
```

**Dismiss/Click Behavior:**

| Action | Effect on drawer | Effect on visual |
|--------|-----------------|-----------------|
| Popup auto-hides | Nothing (already in drawer) | Banner disappears |
| Popup dismissed | Nothing (already in drawer) | Banner disappears |
| Popup clicked | `remove(chatId)` | Banner disappears, open chat |
| Lockscreen unlock | Nothing (stays in drawer) | Lockscreen hides |

---

## Message Grouping

Consecutive messages from the same sender within a time threshold are visually grouped: reduced spacing, modified border radius, and only the last message shows its timestamp.

### Grouping Criteria

Messages group when all of these are true:
1. Same `type` (both `received` or both `sent`)
2. Same `speaker` (see inheritance below)
3. Timestamp difference < `message_group_threshold` (default 60s)

### Speaker Inheritance

Ink convention: `# speaker` is set once, follow-up messages from the same person omit it. The grouper inherits the speaker from the previous message when `speaker` is undefined and the message type matches. This means consecutive received messages without a speaker tag naturally group with the preceding message that set the speaker.

**Implementation:** `message-grouper.js`

### "Now" Timestamp Override

When a message arrives in an open chat, its timestamp displays "Now" instead of the canonical time. This is a **display-only** override — `msg.time` is never mutated.

**Dismiss triggers** (timestamp reverts to canonical):
- User selects a choice
- User navigates back (thread closed)
- Next message arrives (previous "Now" reverts, new message gets "Now")
- Re-opening a chat always shows canonical times

**Thread:** `ChatThread._freshMessageId` tracks which message currently shows "Now". Set in `addMessage()` for non-seed messages, cleared on `open()`, `close()`, and choice selection.

**Hub:** `ChatHub` shows "Now" for background-chat messages (`!isCurrentChat`). Stores `canonicalTime` on the preview and reverts via `_clearAllFreshPreviews()` on `CHAT_OPENED`, `CHAT_CLOSED`, `CHOICES_AVAILABLE`, and `drawer-open-requested`.

---

## Hub Preview Invariants

The conversation list (hub) always shows the latest message preview per chat:

| Message Type | Preview Format | Icon |
|--------------|----------------|------|
| Sent | "You: [truncated text]" | Read receipt (✓✓) |
| Received | "[truncated text]" | None |
| System | "[truncated text]" | None |

**Exceptions:**
- My Notes chat: No read receipt icon (personal notes, no delivery concept)

**Implementation:** `chat-hub.js` subscribes to `MESSAGE_RECEIVED` and updates preview with `message.type`.

---

## Read Receipts

Sent messages display a receipt icon indicating delivery status: `sent` (single outline), `delivered` (double outline), or `read` (double filled).

### Automatic Upgrade

When a **received** message arrives in a chat, the last sent message with `receipt: 'delivered'` is automatically upgraded to `'read'`. The other person replied, so they clearly read the message. This is emergent — no ink tag required.

### Explicit Control

The `# receipt` tag overrides automatic behavior:

```ink
// Set receipt on the current sent message
# receipt:delivered
Thanks for that!

// Deferred: update a previous message's receipt by label
# receipt:read:my_question
```

### Visual Design

Receipts sit **outside** the message bubble on the dark background. The circle outline is always light gray (`#9E9E9E`):

| Status | Circles | Fill | Outline | Checkmark |
|--------|---------|------|---------|-----------|
| `sent` | Single | Transparent | Light gray | Light gray |
| `delivered` | Double | Transparent; front bg-colored to occlude rear | Light gray | Light gray |
| `read` | Double | Filled light gray | Dark gray (both circles) | Dark gray |

**Implementation:** `upgradeReceipt()` in `chat-machine.js`, receipt SVGs in `message-bubble.js`.

---

## Text Cutoff Rule

**Containers define their own cutoff.** Text truncation is handled by CSS (`text-overflow: ellipsis`, `-webkit-line-clamp`) on the rendering container — never by config values or JavaScript string slicing.

- Each component's CSS determines how much text is visible
- No JS `truncateText()` or `.slice()` for display purposes
- Different screen sizes naturally show different amounts of text

**Why:** Config-based truncation couples content to a specific layout. CSS overflow adapts to the actual container size, font, and viewport.

**Translation constraints** still exist for two categories:
1. **Labels/titles** (character names, settings labels, section titles, notification speaker) — clipping loses key identity information
2. **Notification body** — `notificationPreview` overrides are authored hints that must fit the notification popup

Story text in reflowing containers (choice buttons, system messages, chat bubbles, hub previews) is **not constrained** — the container reflows or clips naturally.

---

## High Water Mark System

The HWM system tracks read state per chat for the unread separator.

### Context Fields

| Field | Type | Purpose |
|-------|------|---------|
| `lastReadMessageId` | `{[chatId]: string \| null}` | Read cursor per chat |
| `notifiedChatIds` | `Set<string>` | Chats with pending notifications |
| `deferredMessages` | `{[chatId]: Array<{message, delay}>}` | Queued messages |

### Read Cursor Updates

The `lastReadMessageId` cursor updates on:

1. **Chat close** - Set to last message ID in that chat
2. **Chat-to-chat navigation** - Previous chat cursor updated before switching
3. **Hub navigation** - Current chat cursor updated

**Not updated on:**
- Initial chat open (preserves unread state)
- Receiving new messages while viewing

### Unread Separator

When opening a chat with `notifiedChatIds.has(chatId) === true`:

1. Find `lastReadMessageId[chatId]`
2. Insert `<unread-separator>` after that message
3. Clear `notifiedChatIds.delete(chatId)`

**Edge cases:**
- `lastReadMessageId === null` → No separator (first visit)
- All messages are new → Separator at top
- `# immediate` tag → Skip deferred queue, no separator

---

## Message Routing

### current_chat Variable

Ink's `current_chat` variable determines message routing:

```ink
=== pat_chat ===
~ current_chat = "pat"  // ← CQO-18 requirement
```

### targetChat Tag Override

The `# targetChat` tag overrides routing (CQO-20):

```ink
# targetChat:spectre
# speaker:TonyGov
# type:received
Message routes to spectre's chat
```

**Tag is captured before variable reset** - `getTargetChat()` reads the tag first, falls back to `current_chat`.

### Routing Decision Tree

```
Message created
      ↓
Has # targetChat tag?
  Yes → route to tag value
  No  → route to current_chat
      ↓
Is target == currentView.chatId?
  Yes → emit immediately
  No  → add to deferredMessages
        → fire notification (if not already notified)
```

---

## Special Cases

### My Notes Chat

My Notes is a local-only chat:
- No speaker (player's own notes)
- No notifications (self-initiated)
- No typing indicators

### Cross-Chat Messages

Cross-chat messages via `# targetChat`:
- ARE the first message in target chat
- Target chat ink should CONTINUE from there, not duplicate
- Use `# notificationPreview` for custom notification text

### Immediate Messages

The `# immediate` tag bypasses deferred queue:
- Message appears immediately even in background chat
- No separator insertion
- Use for time-critical updates (e.g., breaking news)

---

## Time Simulation

Time advances as messages are processed. The `TimeContext` service maintains coherent story time across all chats.

### Time Operations

| Operation | Trigger | Effect |
|-----------|---------|--------|
| Auto-drift | Each message (no time tag) | +1 minute |
| Hard snap | `# time:9:15 AM` tag | Set exact time |
| Explicit jump | `# duration:N` tag | +N minutes |
| Day advance | `advance_day()` external | Next day |

### Forward-Only Rule

**Time never goes backward.** When a player switches between chats, the clock keeps the latest time. This prevents paradoxes like:

1. Pat sends message at 10:30 AM
2. Player switches to News
3. News message tagged 10:15 AM → **rejected**, clock stays 10:30 AM

### Seed Messages and Time

Messages before `# story_start` are **seeds** - they display timestamps but don't affect `TimeContext`. This allows historical messages (e.g., "Sep 7") without corrupting the simulation clock.

### Validation

- **CQO-13**: `time-coherence.spec.ts` validates clock follows message times
- **Static**: `lint:time-tags` checks time tag progression in ink

See [Architecture - Time Coherence](architecture.md#time-coherence) for implementation details.

---

## Code Paths Reference

| Concern | Location |
|---------|----------|
| Seed extraction | `utils/build/build-seeds.js` |
| Seed loading | `game-controller.js:buildInitialHistory()` |
| Message routing | `chunk-helpers.js:getTargetChat()` |
| Deferred queue | `chat-machine.js:DEFER_MESSAGE` action |
| Notification decision | `chat-machine.js:processStoryChunk` |
| Read cursor update | `chat-machine.js:CLOSE_CHAT`, `SET_VIEW` |
| Separator insertion | `chat-thread.js:open()` |

---

## Related

- [Conversation System Reference](../reference/conversation-system.md)
- [CQO Reference](../reference/cqo.md#cqo-20-no-naive-test-skips) - CQO-20 (targetChat)
- [Writing Guide](../guides/writers/writing-guide.md) - Tag usage
