# Bug History

Record of significant bugs encountered during development, their root causes, and prevention measures added.

## Entry Template

Use the **BUG-NNN** format (see BUG-001 onwards) for new entries. It has structured
sections (Symptom, Root Cause, Fix, Pattern, Prevention) that make bugs searchable
and reusable for pattern detection. The earlier date-based entries are kept for
historical continuity but should not be used as a template.

Next ID: **BUG-014**

---

## 2026-01-27 - Cross-chat message duplication

**Severity**: Major | **Class**: Logic / Data Integrity | **Status**: Fixed (manual), Prevention Pending

**Summary**: Cross-chat messages from pat.ink and first messages in target chat ink files (spectre.ink, activist.ink) created duplicate near-identical messages, breaking simulation realism.

**Root Cause**: No enforcement that cross-chat messages should be the definitive first message. Authors duplicated content in both the source (`# targetChat:`) and target chat's ink.

**Fix Applied**:
- Restructured ink so cross-chat messages include all necessary tags (time, presence, type)
- Modified target chat stitches to continue from cross-chat message instead of duplicating
- Reordered pat.ink publishing stitch so times are chronologically correct

**Prevention Added**: Pending - task-72 created for linter rule and documentation

**Task**: task-72 (Prevent cross-chat message duplication in ink files)

---

## 2026-01-27 - Duplicate notifications for same chat

**Severity**: Major | **Class**: Logic | **Status**: Fixed

**Summary**: Multiple notifications fired for the same chat when multiple messages arrived in a single state update cycle.

**Root Cause**: `MARK_CHAT_NOTIFIED` was sent asynchronously, so `ctx.notifiedChatIds` wasn't updated before the next message in the same chat was processed. Both messages passed the `!notifiedChatIds.has(chatId)` check.

**Fix Applied**: Added `notifiedThisUpdate` local Set in `handleStateUpdate` to track notifications within a single update cycle, preventing duplicates before the async state update completes.

**Prevention Added**: The fix itself is the prevention - local tracking before async update.

**Task**: task-75 (Fix duplicate notifications Maria Santos regression)

---

## 2026-01-28 - Notification counter showing 2 instead of 1

**Severity**: Major | **Class**: Architecture / State Management | **Status**: Fixed

**Summary**: On fresh game start, the notification counter badge showed "2" instead of "1" even though only one notification (BREAKING news) fired.

**Root Cause**: Notification state was split across three independent components:
1. `main.js` set `statusBar.setPopupVisible(true)` on `NOTIFICATION_SHOW`
2. `notification-popup.js` showed popup OR dispatched `notification-auto-hidden`
3. `lock-screen.js` added to its own `_notifications` array

The counter formula `_drawerCount + (_popupVisible ? 1 : 0)` combined two uncoordinated states. When the popup detected lockscreen was visible, it dispatched `notification-auto-hidden` which added to the drawer, but `_popupVisible` was already `true` from the `NOTIFICATION_SHOW` handler in main.js. This was a **lack of single source of truth**, not a timing bug.

**Fix Applied**: Made `notification-drawer` the single source of truth:
- Drawer subscribes to `NOTIFICATION_SHOW` directly
- Drawer emits `drawer-notification-added` for view-only consumers
- Popup and lockscreen listen to `drawer-notification-added` (view-only)
- Status bar counter = `_drawerCount` only (removed `_popupVisible`)
- Removed all `notification-auto-hidden` events

**Prevention Added**:
- Documented "Drawer is SSOT for notification state" in architecture.md invariants
- Updated event-architecture skill with SSOT pattern
- Updated boundary-safety skill with local state drift example

**Task**: [task-88](../../backlog/tasks/task-88%20-%20Debug-Notification-counter-shows-2-instead-of-1-on-fresh-game-start.md)

---

## 2026-01-29 - Choice state lost on chat→hub round-trip

**Severity**: Major | **Class**: Logic / State Management | **Status**: Fixed

**Summary**: Navigating away from a chat with a pending ink choice (back to hub) then returning caused the choice to stop working — clicking it made it disappear but no response message appeared and the story stopped progressing.

**Root Cause**: `clearCurrentView` in chat-machine.js did not save `savedChoicesState` when transitioning chat→hub. It only saved on chat→chat transitions via `setCurrentView`. On returning, the saved state was empty, so `ChoosePathString(knotName)` reset the ink pointer, destroying the choice context.

**Fix Applied**: Modified `clearCurrentView` to save `savedChoicesState` for the departing chat when ink has active choices, matching the existing pattern in `setCurrentView`.

**Prevention Added**: Unit test for `clearCurrentView` choice state preservation.

**Task**: [task-105](../../backlog/tasks/task-105%20-%20Fix-parallax-view-transition-flash-on-notification-heavy-chats.md)

---

## 2026-01-29 - Parallax view transition flash on unread chats

**Severity**: Medium | **Class**: Animation / Rendering | **Status**: Fixed

**Summary**: Opening any chat with unread messages shows an instant jump instead of the 500ms parallax slide. Chats without unread messages animate correctly. Affects both hub→chat and notification→chat paths.

**Root Cause**: `scrollIntoView({ behavior: 'instant' })` in `scrollToUnreadOrBottom()` forces synchronous layout recalculation that paints `chat-thread` at its rest position **before** `transitionViews()` can animate from `translateX(100%)`. The call sequence was:

1. `controller.openChat()` → CHAT_OPENED → `thread.open()` → `render()` → `scrollToUnreadOrBottom()` (schedules rAF with `scrollIntoView`)
2. `transition()` → `transitionViews()` sets `transform: translateX(100%)`
3. Next rAF: `scrollIntoView({ behavior: 'instant' })` forces layout → browser paints element at rest → animation starts from wrong position

Only chats with `lastReadMessageId` create an `unread-separator` element, triggering the `scrollIntoView` branch. Without it, the simpler `scrollTop = scrollHeight` doesn't cause the same layout thrash.

**Confirmed via**: Video frame analysis (638 frames at 60fps). Frame 130→133: hub→News (unread) instant jump. Frame 535→545: hub→My Notes (no unread) proper parallax.

**Ruled Out**: CSS reduced-motion, motionPrefs race, transition queue stuck, missing transform pre-positioning, heavy sync work, `commitStyles()` residue.

**Fix Applied**:
- Removed `scrollToUnreadOrBottom()` from `thread.open()` — it now only sets `container.scrollTop = scrollHeight` synchronously (safe, no layout paint)
- `open()` returns a **finalize function** (deferred scroll) that callers must invoke after the view transition completes. This makes the timing contract structural: forgetting to call finalize means the chat never scrolls to unread — an immediately visible bug, not a subtle animation glitch
- `_threadFinalize` variable in `main.js` captures the return value from `open()`, consumed by `navigation.push(thread, { onComplete: () => { _threadFinalize?.(); _threadFinalize = null; } })` in both `chat-selected` and `notification-clicked` handlers
- Defensive stale inline style clearing added at `transitionViews()` entry

**Prevention Added**:
- **Structural contract**: `open()` returns deferred scroll — impossible to accidentally scroll during transition without deliberately ignoring the return value
- **Regression test**: `transition-forensics.spec.ts` `"unread chat: scrollIntoView must not fire during parallax animation"` — monkey-patches `scrollIntoView` to record call timestamp, asserts it fires after the 500ms transition (not during). Fails without the fix (`scrollCalledDuringAnimation: true` at ~16ms), passes with it
- **3 rAF transform-sampling tests** for parallax quality (duration, frame drops, start position)

**Task**: [task-105](../../backlog/tasks/task-105%20-%20Fix-parallax-view-transition-flash-on-notification-heavy-chats.md)

---

## 2026-01-30 - WAAPI end-frame snap-back (jitter on animation finish)

**Severity**: Medium | **Class**: Animation / Rendering | **Status**: Fixed

**Summary**: Elements animated with Web Animations API (WAAPI) visibly "jump" or "snap" on their final frame. Clock, date/weather, notification cards, and SVG icons all exhibited a 1-frame flash at animation end.

**Root Cause**: WAAPI runs animations on a compositor layer. When the animation finishes, the layer is removed and the element reverts to its underlying CSS/inline style for one frame before JS can update it. If the element has `style.opacity = '0'` (set for pre-delay hiding), finishing the animation exposes that `0` for one frame. Similarly, `scale(1)` in the final keyframe differs from `transform: none` in CSS, causing a recomposite flash.

**Fix Applied**:
- Added `fill: 'forwards'` to all WAAPI animations so the final keyframe persists after completion
- In `.finished` callback: call `anim.commitStyles()` before `anim.cancel()` — this writes the animation's final computed values (including identity transforms like `scale(1)`, `translateY(0)`) as inline styles, so the compositor layer persists across the cancel boundary
- Clear only `el.style.opacity` after cancel (the pre-delay hide); leave identity transforms inline — they're visually inert but prevent the layer teardown that causes the snap
- Notification drawer tiles use opacity-only (no transforms to commit), but lock screen wake animations retain their transforms (scale, translateY) with this fix

**Prevention Added**: Pattern documented here. For WAAPI animations with transforms: use `fill: 'forwards'` + `commitStyles()` + `cancel()` + clear only opacity. Never `cancel()` without `commitStyles()` when keyframes include transforms — the compositor layer removal causes a visible recomposite snap.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Async close + navigation race (black screen / frozen clicks)

**Severity**: Critical | **Class**: Async / State Management | **Status**: Fixed

**Summary**: Clicking the lock icon in notification drawer caused: (1) black screen, (2) frozen click state where no buttons worked, (3) random chat opening on next interaction. Three different failure modes from one root cause.

**Root Cause**: `close()` in notification-drawer.js was async (returned Promise with animation). Meanwhile, `render()` was called (by open/close toggling `_isOpen`), which rebuilt the entire shadow DOM — destroying the animated DOM nodes. The `.finished` promise on detached nodes never resolved, so `_finalizeClose()` never ran, leaving `pointer-events: auto` and `visibility: visible` on a stale state. The `animateOut()` method on lock-screen also set `this.style.opacity = '0'` which `show()` never cleared.

**Fix Applied**:
- `close()` immediately sets `pointer-events: none` synchronously before starting async animation
- `_animateClose()` wrapped in try/catch around `await .finished` (catches cancelled animations)
- `_finalizeClose()` made idempotent — sets `visibility: hidden; pointer-events: none`
- `render()` cancels `_activeAnimations` array before rebuilding DOM, restores visibility state after
- All event handlers `await close()` before dispatching navigation events
- `show()` on lock-screen clears `this.style.opacity`

**Prevention Added**: Pattern: any component with async close must (1) block interaction synchronously first, (2) handle animation cancellation, (3) have idempotent cleanup.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Theme FOUC on page refresh (black flash outside phone)

**Severity**: Medium | **Class**: Rendering / FOUC | **Status**: Fixed

**Summary**: On light theme, refreshing the page caused the background around the smartphone to flash black before turning white. Dark theme was the CSS default; light theme was applied by a deferred ES module.

**Root Cause**: `data-theme="light"` was set by the experience's `main.js` (an ES module with deferred execution). CSS paints the page with dark theme defaults before the module executes.

**Fix Applied**: Added blocking inline `<script>` in `<head>` that reads `localStorage` and sets `data-theme` before any CSS paint.

**Prevention Added**: Any theme/appearance state that affects first paint must be restored by a blocking inline script, never by deferred modules.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Lock screen background flash on refresh (black flash inside phone)

**Severity**: Medium | **Class**: Rendering / FOUC | **Status**: Fixed

**Summary**: Lock screen gradient background only appeared after shadow DOM rendered (JS module execution). Before that, the lock screen area was transparent/black.

**Root Cause**: Gradient was set in shadow DOM CSS (`:host`). Shadow DOM doesn't exist until `connectedCallback` runs after module load.

**Fix Applied**: Added inline `style="background:linear-gradient(...)"` on `<lock-screen>` in HTML.

**Prevention Added**: Any visual element visible on first paint should have critical styles inline in HTML, not solely in shadow DOM CSS.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Hub visible during page refresh (FOUC inside phone)

**Severity**: Low | **Class**: Rendering / FOUC | **Status**: Fixed

**Summary**: Chat hub ("Messages" screen) briefly visible during refresh before lock screen covered it.

**Root Cause**: `hub.hidden = true` was set by deferred `main.js`. The `<chat-hub>` element had no `hidden` attribute in HTML.

**Fix Applied**: Added `hidden` attribute directly on `<chat-hub hidden>` in `index.html`.

**Prevention Added**: Elements hidden on first paint must have `hidden` in HTML markup.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - WAAPI pre-delay visibility (elements visible during stagger delay)

**Severity**: Low | **Class**: Animation / Rendering | **Status**: Fixed

**Summary**: Notification cards visible at full opacity during stagger delay, appearing before quick tiles (wrong visual order).

**Root Cause**: WAAPI `delay` doesn't hide elements — leaves them at natural CSS opacity during wait.

**Fix Applied**: Pre-set `el.style.opacity = '0'` before starting staggered animations.

**Prevention Added**: Always pre-hide elements with inline styles before staggered WAAPI animations.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Lock screen notifications arrive before wake animation

**Severity**: Medium | **Class**: Animation / Timing | **Status**: Fixed

**Summary**: On fresh game start, the first notification card appeared on the lock screen before the clock, date, and fingerprint had faded in — the narrative started before the setting was established.

**Root Cause**: `addNotification()` rendered cards immediately into the DOM. The game controller fired `NOTIFICATION_SHOW` during `CHECK_STORY` processing, which completed before the wake animation's staggered fade-ins finished (~1.5s total).

**Fix Applied**:
- `_playWakeAnimation()` now stores a `_wakeReady` promise (via `Promise.all` of all animation `.finished` promises)
- `addNotification()` records the notification immediately but defers DOM rendering via `this._wakeReady.then(...)`
- `seedNotifications()` (for restore/refresh) renders immediately — pre-existing state, not new arrivals

**Prevention Added**: Gate pattern: any content that should appear after an entrance animation must await the animation's completion promise rather than rendering eagerly.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Notification state lost on page refresh

**Severity**: Medium | **Class**: State Management / Persistence | **Status**: Fixed

**Summary**: Refreshing the page caused lock screen notifications, drawer notifications, and status bar counter to all reset to zero — even though unread state was persisted and restored correctly.

**Root Cause**: The notification drawer (`_notifications` array) is in-memory only — not persisted. On refresh, the drawer started empty. `NOTIFICATION_SHOW` events only fire from ink during initial story processing; on restore, ink doesn't re-run, so the events never re-fire. The lock screen mirrored the empty drawer correctly — the bug was that the drawer was never repopulated.

**Fix Applied**:
- Added `notifications` getter to notification-drawer (public read-only view of SSOT state)
- Added `seedNotifications()` to lock-screen (immediate render, no wake gate)
- In the READY handler (`main.js`): if drawer is empty and chats have persisted unread state, re-emit `NOTIFICATION_SHOW` for each unread chat using the last message as preview
- Lock screen seeds from drawer after re-emit

**Prevention Added**: Any in-memory SSOT that other components mirror must either persist its state or be repopulated from persisted sources on restore. The `notificationDrawer.count === 0` guard prevents double-emission on fresh start.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Double unread badge count on fresh start

**Severity**: Medium | **Class**: Logic / Event Duplication | **Status**: Fixed

**Summary**: Gov News Wire showed unread badge "2" on fresh game start, despite only one notification existing in the drawer and status bar.

**Root Cause**: `hub.setUnread(chatId, true)` increments a counter (`+1`). On fresh start, it was called twice for the same chat:
1. From the hub's own `NOTIFICATION_SHOW` subscription (fired by ink during `CHECK_STORY`)
2. Explicitly in the READY handler: `hub.setUnread(chatId, true)` for persisted unread state

The READY handler's explicit call was originally needed before the notification re-emit logic existed. After adding re-emit for restore, the hub receives `NOTIFICATION_SHOW` in both fresh and restore paths, making the explicit `setUnread` redundant.

**Fix Applied**: Removed `hub.setUnread(chatId, true)` from the READY handler. The hub now receives unread state solely from `NOTIFICATION_SHOW` events — fired by ink on fresh start, or re-emitted from persisted state on restore.

**Prevention Added**: When a component subscribes to an event that sets state, avoid also setting the same state explicitly in an init handler — one path or the other, not both.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Status bar desync during lock screen unlock transition

**Severity**: Low | **Class**: Animation / Layout | **Status**: Fixed

**Summary**: On unlock, the phone status bar appeared at its final position instantly while the hub slid up from below — visually disconnected. On relock, the status bar disappeared with the hub (consistent). The unlock direction was inconsistent.

**Root Cause**: `statusBar.hidden = false` ran synchronously before `transition(lockScreen, hub, ...)`. The status bar is a separate DOM element outside the transitioning views, so `transitionViews` doesn't animate it. It appeared instantly at its rest position while the hub was still sliding.

Attempted fix (`.then()` to show after transition) failed because `_unlock()` in lock-screen.js set `this.hidden = true` synchronously before the event listener could start the transition. The already-hidden outgoing element caused `transitionViews` to malfunction and the promise never resolved — status bar never appeared.

**Fix Applied**:
- Removed `this.hidden = true` from `_unlock()` — `transitionViews` already hides the outgoing element on completion
- Status bar shows before transition (required for hub layout) — this is acceptable since the lock screen covers it during the slide

**Prevention Added**: Components that dispatch events triggering transitions must not hide themselves — the transition system owns element visibility. Self-hiding creates a race where the outgoing element is already hidden before the animation starts.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-30 - Received message bubbles invisible in light mode

**Severity**: Medium | **Class**: Theming / Visual | **Status**: Fixed

**Summary**: In light mode, received message bubbles had no visible background — text appeared to float directly on the white chat thread background.

**Root Cause**: `--ink-bubble-received-bg` was set to `#F5F5F5` in `theme-light.css`, while the thread background (`--ink-color-surface`) was `#ffffff`. The contrast ratio was too low to distinguish the bubble from the background.

**Fix Applied**: Changed `--ink-bubble-received-bg` from `#F5F5F5` to `#e9e9eb` (matches iOS light-mode bubble gray), providing clear contrast against the white surface.

**Prevention Added**: Theme color values for adjacent surfaces should have a minimum contrast difference. Bubble backgrounds should be visually distinct from their container background in both themes.

**Task**: task-113 (Lockscreen animation improvements)

---

## 2026-01-31 - Stacked card edges disconnected from front card (clip-path approach)

**Severity**: Medium | **Class**: CSS / Layout | **Status**: Fixed

**Summary**: Behind cards in the notification stack appeared disconnected from the front card — visible gaps, wrong positioning, and clipped content bleeding through despite multiple attempts with `clip-path`, `position: absolute`, and `overflow: hidden`.

**Root Cause**: Three compounding issues with the absolute-positioning approach:
1. `bottom: 0` on behind cards anchored to the container bottom, which shifted when padding, margins, or overflow badges changed the container height
2. `clip-path: inset(calc(100% - Npx) ...)` clipped based on the behind card's own height, not relative to the front card's bottom edge — misaligned when cards had different text lengths
3. `border-radius` in clip-path created curved edges that didn't match the front card's curvature at the junction point

**Fix Applied**: Replaced the entire approach with the iOS-style **box-shadow technique**: behind cards are `display: none`, and the front card uses layered `box-shadow` to simulate peeking edges. Classes `.stack-2` and `.stack-3` on the cards container control how many shadow edges appear.

**Prevention Added**: For stacked-card UIs where behind cards only show a thin edge, prefer box-shadow simulation over absolute-positioned cards. Box-shadow is immune to height differences, container sizing, and border-radius mismatches because the "edges" are purely decorative effects on the front card.

**Task**: task-113.05 (Fix notification stack expand/collapse behavior)

---

## 2026-01-31 - overflow:hidden on card wrapper clips box-shadow peek edges

**Severity**: Low | **Class**: CSS / Layout | **Status**: Fixed

**Summary**: After expanding and collapsing the notification stack, the front card appeared slightly larger and overflowed its container — the box-shadow peek edges were clipped.

**Root Cause**: `.notification-card-wrapper` had `overflow: hidden` unconditionally. This was needed during the entrance animation (where `max-height` grows from 0 and content must be clipped), but after the animation completed, it continued clipping the front card's box-shadow that simulates the behind-card peek edges.

**Fix Applied**: Moved `overflow: hidden` from `.notification-card-wrapper` to `.notification-card-wrapper.entering` — only active during the entrance animation. The `entering` class is removed on `animationend`, restoring normal overflow and allowing box-shadow to extend beyond the wrapper.

**Prevention Added**: When using box-shadow for decorative effects that extend beyond an element's bounds, verify that no ancestor has `overflow: hidden`. Entrance animations that use `overflow: hidden` for clipping should scope it to the animation state (e.g., via a class), not the element permanently.

**Task**: task-113.05 (Fix notification stack expand/collapse behavior)

---

## 2026-01-31 - Notification entrance animation inconsistent with wake stagger

**Severity**: Low | **Class**: Animation / Timing | **Status**: Fixed

**Summary**: On fresh game start, notifications appeared much later than the unlock button and used a different, more abrupt animation (max-height grow + scale) compared to the smooth fade+translateY used by other lock screen elements.

**Root Cause**: Two issues:
1. `_wakeReady` was set to `Promise.all(anims)` — it resolved only after ALL wake animations finished (~1500ms), creating a long gap after the unlock button appeared
2. Each notification used the `notification-enter` CSS keyframe (max-height grow), which looked abrupt compared to the WAAPI translateY+opacity fade used by the clock, date, and fingerprint
3. Multiple notifications arriving during the gate each queued independent `.then()` callbacks, causing them to render one-by-one with overlapping entrance animations

**Fix Applied**:
- Changed `_wakeReady` to a 950ms timeout — notifications appear 200ms after the unlock button starts, maintaining the stagger cadence
- Added `_flushPendingNotifications()`: queues all notifications arriving during the wake gate, renders them as a complete stack, and animates the whole stack with a single wake-style `translateY(20px) + opacity` entrance
- Late-arriving notifications (after wake) still use per-card entrance animation via `_wakeFlushed` flag

**Prevention Added**: When gating content behind an animation sequence, gate on the right moment (when the content should appear), not on the entire sequence completing. Batch-render content that arrives during the gate to avoid per-item animation jank.

**Task**: task-113.05 (Fix notification stack expand/collapse behavior)

---

## BUG-001: Silent Receipt Auto-Upgrade

**Date:** 2026-01-30
**Commit:** a91e313
**Category:** State-Effect Disconnect
**Severity:** Visual — receipts showed "delivered" instead of "read"

### Symptom

After Pat replied, the player's sent message still showed a delivered checkmark (double outline) instead of read (double filled). The receipt upgraded correctly in state machine history but the UI never updated.

### Root Cause

Two disconnected state copies: the XState state machine maintains `messageHistory` (the source of truth), while `ChatThread` maintains a local `this.messages` array populated via `addMessage()`. When the auto-upgrade logic upgraded a previous message's receipt in the state machine, the thread's local copy was never updated.

The existing `MESSAGE_RECEIPT_CHANGED` event path couldn't help either — it requires a message `label` for DOM lookup, but auto-upgraded messages may not have labels. And even if they did, the event was never emitted for auto-upgrades (only for explicit `# receipt` ink tags).

```
State machine:  history[i].receipt = 'read'  ✓ (correct)
ChatThread:     this.messages[i].receipt      ✗ (still 'delivered')
renderMessages: renders from local array      → shows 'delivered'
```

### Fix

**TASK-108 superseded the original two-layer fix.** Receipt mutations are now centralized in `upgradeReceipt()` (auto-upgrade and explicit), and `appendAndUpgrade()` (append + auto-upgrade). The component-side mirror was removed — `ChatThread` reacts purely to `MESSAGE_RECEIPT_CHANGED` events emitted by the state machine.

### Pattern

**State-Effect Disconnect:** A function transforms data correctly but the corresponding observer notification is missing. The state is right; the effect is absent.

**Detection heuristic:** Components that keep local copies of state machine data must handle mutations to *existing* records, not just new appends. `MESSAGE_RECEIVED` covers new messages via `emittedMessageIds`. Mutations to old messages require either: (a) the component mirrors the transform locally, or (b) an explicit event notifies the component to re-read.

### Prevention

Resolved by TASK-108: All receipt mutations flow through `upgradeReceipt()`, which returns `receiptChanged` by construction. The component-side mirror is eliminated.

---

## BUG-002: Raw i18n Keys Rendered in Early-Mount Components

**Date:** 2026-01-30
**Category:** Render-Before-Ready
**Severity:** Visual — UI shows raw keys like `"hub.you"` instead of translated text
**Affected:** `player-profile` (fixed), `conversation-settings` (at risk)

### Symptom

The player profile page displayed `hub.you` as the player name, showed a default letter avatar with "H" instead of the profile picture, and had no status text. All three symptoms shared a single root cause.

### Root Cause

Web components render in `connectedCallback`, which fires when the element is added to the DOM — typically at HTML parse time. But the i18n service and config registry aren't populated until `main.js` runs (after `await i18nReady`). Components that start `hidden` and are revealed later still execute their `connectedCallback` eagerly.

```
Parse HTML:    <player-profile hidden>  → connectedCallback() fires
                                          → t('hub.you') → 'hub.you' (i18n not ready)
                                          → getApp() → {} (config not registered)
                                          → renders stale HTML, never re-renders

Later:         main.js registers config + i18n
               User clicks avatar → hidden removed → stale HTML shown
```

The fallback avatar showed "H" because `avatarInitials('hub.you')` takes the first character of the first word → "h" → uppercase "H".

### Fix

**Approach A — Deferred render (player-profile):** Don't render in `connectedCallback` if hidden. Re-render in `attributeChangedCallback` when `hidden` is removed.

**Approach B — Event subscription (chat-hub, notification-drawer, settings-page, glossary-page):** Subscribe to `I18N_EVENTS.LOCALE_READY` and re-render.

### Pattern

**Render-Before-Ready:** A component renders before an async dependency (i18n, config) is available. The accessor returns a safe fallback (raw key, empty object) so no error is thrown — the bug is silent.

**Detection heuristic:** Any component that (a) uses `t()` or `getApp()`, (b) renders in `connectedCallback`, and (c) does NOT subscribe to `LOCALE_READY` or defer rendering — is vulnerable.

### Audit

| Component | Uses i18n | Protected | Method |
|-----------|-----------|-----------|--------|
| chat-hub | ✓ | ✓ | Event subscription |
| notification-drawer | ✓ | ✓ | Event subscription |
| settings-page | ✓ | ✓ | Event subscription |
| glossary-page | ✓ | ✓ | Event subscription |
| player-profile | ✓ | ✓ | Deferred render |
| conversation-settings | ✓ | ⚠️ | Re-renders on `chat-id` attr change (saves it in practice, but no i18n subscription) |
| chat-header | Partial | ⚠️ | Re-renders on attr change (low risk — aria labels only) |

### Permanent Fix (TASK-112)

**Approach C — Deferred component registration:** All `customElements.define()` calls are deferred until after `await i18nReady` in main.js via `registerConversationComponents()`. This eliminated the bug class architecturally.

---

## BUG-003: Flaky View Transition Timeouts Under Parallel Test Workers

**Date:** 2026-01-31
**Category:** Test Flakiness — Race Condition + Insufficient Timeout
**Severity:** CI — 5 tests intermittently failing (~70% failure rate under parallel workers)
**Task:** TASK-102

### Symptom

Tests hung waiting for `chat-hub` to become hidden or visible. Passed in isolation, failed under parallel Playwright workers.

### Root Causes (two)

**1. `ChatHub.goto()` lock screen race:** The `isVisible({ timeout: 1000 })` check was too short under CPU pressure. Silent `false` via `.catch(() => false)` skipped the unlock click.

**2. Web Animation API `.finished` hanging:** `Promise.all(animations.map(a => a.finished))` occasionally never resolves in headless browsers under load.

### Fix

**`chat-hub.ts`:** Replaced fragile 1s `isVisible` with `Promise.race` between lock screen and hub visibility (10s timeout).

**`view-transitions.js`:** Added `withTimeout(promise, duration + 500)` wrapper around animation `.finished` awaits.

### Pattern

**Insufficient Wait Threshold:** A test helper uses a short timeout with silent fallback, creating an undetectable failure when the system is slower than expected.

---

## BUG-004: Ink `//` Comment Truncates URLs in Tags

**Date:** 2026-01-31
**Category:** Parser Mismatch — Ink Comment Syntax
**Severity:** Data — link preview URLs silently truncated to `"https:"`

### Symptom

Seed messages with `# linkUrl:https://globalwitness.org/en/` produced `url: "https:"`.

### Root Cause

Ink treats `//` as a line comment. The `//` in `https://` causes everything after it to be discarded.

### Fix

Removed `https://` from all ink tag URLs. Parsers auto-prepend `https://` when the value doesn't contain `:`.

### Pattern

**Parser Mismatch:** Content authored in one language (ink) is consumed by another system (JS tag parser) that doesn't share the same escaping rules.

### Prevention

Documented in `docs/reference/conversation-system.md` under the `linkUrl` tag entry.

---

## BUG-005: Stale Saved State Missing New Seed Properties

**Date:** 2026-01-31
**Category:** Schema Migration — Missing Forward Compatibility
**Severity:** Visual — link preview cards missing from seed messages; duplicate messages rendered

### Symptom

Activist chat showed Global Witness seed message as plain text (no link preview card), plus a duplicate message with a broken link preview. Clearing `localStorage` fixed it.

### Root Cause

`build-seeds.js` was updated to extract `linkPreview` sub-objects. Saved state from before this change had no `linkPreview` property. The dedup guard (`isDuplicateMessage`) failed on shape mismatch.

### Fix

No code fix needed — fresh games work correctly. Inherent to any schema change that adds properties to seed messages without a migration system.

### Pattern

**Schema Migration Gap:** Adding new properties to build-time artifacts doesn't retroactively update previously serialized runtime state.

### Prevention

For production: schema version + migration, or merge fresh seed properties onto saved seeds at load time.

---

## BUG-006: Duplicated Utility Functions Across Shadow DOM Components

**Date:** 2026-01-31
**Category:** Code Duplication — Missing Shared Module
**Severity:** Maintenance — 17 components each defined their own `escapeHtml()`

### Symptom

Adding glossary markup support to contact profile required copying `processText`, `LEARNING_HIGHLIGHT_CSS`, and `wireGlossaryClicks` from `message-bubble.js` — the 4th component to need this code.

### Root Cause

First implementation was inline in `message-bubble.js`. Each subsequent component copy-pasted rather than extracting to shared module.

### Fix

Created `packages/framework/src/systems/conversation/utils/text.js` as shared module. Updated all 17 components to import from it.

### Pattern

**Utility Creep:** A utility function is first written inline, then copy-pasted. By the fourth copy, it's a maintenance burden.

### Prevention

**Rule of thumb:** If a function is copied to a second Shadow DOM component, extract it to `utils/` immediately.

---

## BUG-007: commitStyles on Detached DOM Elements

**Date:** 2026-01-31
**Commit:** e7d6c69
**Category:** Animation / DOM Lifecycle
**Severity:** Console error — repeated `DOMException` (non-blocking)

### Symptom

`Uncaught (in promise) DOMException: Animation.commitStyles: Target is not rendered` fired repeatedly during view transitions, especially when chats opened/closed rapidly or notifications triggered navigation.

### Root Cause

`transitionViews()` in `view-transitions.js` awaits all WAAPI animations, then calls `commitStyles()` on each to persist the final keyframe as inline styles. When the animated element (outgoing view, incoming view, or overlay) is removed from the DOM during the animation — by another transition, navigation, or component teardown — `commitStyles()` throws because the element has no rendered box.

### Fix

Added `a.effect?.target?.isConnected` guard before `commitStyles()`. If the element is detached, skip committing — the inline styles are irrelevant since the element is gone.

### Pattern

**DOM Lifecycle Race:** Async animation code assumes elements remain in the DOM for the animation's full duration. When external code removes elements mid-animation, post-animation cleanup throws.

### Prevention

Always check `isConnected` before `commitStyles()` or any other DOM API that requires a rendered element.

---

## BUG-008: Typing Events Emitted Without chatId

**Date:** 2026-01-31
**Commit:** e7d6c69
**Category:** Event Factory Validation
**Severity:** Console error — repeated `missing required field "chatId"` warnings

### Symptom

`[ConversationPlugin] Event factory: missing required field "chatId"` logged repeatedly throughout gameplay, including at startup and on every state update.

### Root Cause

`handleStateUpdate()` in `game-controller.js` derives `currentChat` as `view.chatId` when `view.type === 'chat'`, otherwise `null`. The typing indicator section unconditionally emitted `createTypingStartEvent(currentChat)` and `createTypingEndEvent(currentChat)` on every state update — even when the view wasn't a chat (e.g., hub, lock screen), passing `null` as chatId.

### Fix

Wrapped both typing event emissions in `if (currentChat)` guards. Typing events only fire when the user is viewing a chat.

### Pattern

**Unconditional Event Emission:** An event is emitted on every state update regardless of whether the current context provides the required payload fields.

### Prevention

When deriving event payloads from view state, guard emission on the view type that provides the required fields.

---

## BUG-009: Janky Lock Screen Notification Stacking Animation

**Date:** 2026-01-31
**Category:** State-Animation Disconnect
**Severity:** Visual — blank frame + ~750ms delayed stack peek on 2nd notification arrival

### Symptom

When a 2nd notification arrives on the lock screen: (1) one blank frame where no notification is visible, (2) stack peek shadow delayed ~750ms (400ms entrance + 350ms box-shadow transition).

### Root Causes

**1. Blank frame:** `_reindexCards()` bumps old card `data-stacked` 0→1, CSS `[data-stacked="1"] { display: none }` hides it instantly. New card prepends with `entering` class at `opacity: 0, max-height: 0, scale(0.92)`. One frame where old card hidden + new card invisible = blank.

**2. Delayed stack peek (~750ms):** `.entering` wrapper has `overflow: hidden` which clips box-shadow. Stack peek shadow invisible during entire 400ms entrance. On `animationend`, `entering` removed → overflow unclipped → 350ms `box-shadow` transition starts.

**3. Latent DOM mismatch:** `_renderNotifications()` (static render) output bare `<button>` cards without `.notification-card-wrapper` divs, while `_createCardElement()` (dynamic) wrapped in wrappers. After `show()`, `_reindexCards()` queried `.notification-card-wrapper` → found nothing → cards never re-indexed.

**4. Return path skipped animation:** `show()` set `_wakeFlushed = false`, so new notifications went through the `skipAnimation` flush path instead of the animated `_showNotification()`.

### Fix

1. **Unified DOM:** `_renderNotifications()` now wraps cards in `.notification-card-wrapper`, matching `_createCardElement()`
2. **`show()` sets `_wakeFlushed = true`:** Stack already rendered, no wake gate needed — new notifications go directly to animated path
3. **Slide-up entrance:** Replaced `max-height` clip reveal (hard horizontal line, dark bars from `overflow: hidden`) with `translateY(40px) scale(0.96)` → `translateY(0) scale(1)` card animation. No wrapper clipping needed — peek shadow appears when `.entering` is removed
4. **Wake flush race fix:** `_flushPendingNotifications` now `await`s `_animationLock` before animating the stack — previously, microtask-deferred rendering meant `querySelector('.notification-stack')` returned null and the wake entrance animation was silently skipped
5. **Softer wake entrance:** Stack fades in with `scale(0.92)` over 900ms (matching clock animation feel), gate delayed to 1200ms so notifications arrive after fingerprint is visible
6. **Animation queue:** `_animationLock` promise chain serializes concurrent arrivals with 150ms stagger
7. **`transition: none`** on entering card's box-shadow so stack-peek shadow appears immediately instead of delayed 350ms

### Pattern

**State-Animation Disconnect:** CSS `display: none` fires synchronously on data-attribute change, but the replacement element enters via async animation — creating a gap where neither is visible. Separately, `overflow: hidden` on animation wrappers clips decorative effects (box-shadow) that render outside element bounds.

### Prevention

Avoid `max-height` + `overflow: hidden` for entrance animations — the hard clip line looks mechanical, and `overflow: hidden` clips box-shadows needed for visual effects. Prefer `translateY` slide-in which has no clipping. For wake-style batch entrances, `await` any microtask-deferred rendering before querying the DOM for the animation target.

---

## BUG-010: Black Screen After Deploy — Missing story.json in Build Output

**Date:** 2026-02-01
**Commit:** 49ca435
**Category:** Build Pipeline — Missing Asset Copy
**Severity:** Critical — deployed site shows black screen, game completely non-functional

### Symptom

After deploying to GitHub Pages, the site loaded but showed only the lock screen gradient background with no interactive content. No console errors. All network requests returned 200/304. The lock screen component rendered but the ink runtime silently failed to initialize.

### Root Cause

`build:prod` in `mise.toml` copied `packages/framework/src/vendor/ink.js` and `experiences/aricanga/src/dist/locales/*.json` (i18n) to the dist output, but **never copied `experiences/aricanga/src/dist/<locale>/story.json`** (the compiled ink stories). The `controller.init()` call in `main.js` fetched `./src/dist/en/story.json` which 404'd silently — the ink runtime caught the error internally without surfacing it to the console.

The `en/` and `fr/` directories under `experiences/aricanga/src/dist/` were created by `build:ink` but the `build:prod` post-vite copy step only knew about `locales/`.

### Fix

Added a loop in `build:prod` to copy `story.json` for each locale directory:

```bash
for locale_dir in experiences/$IMPL/src/dist/*/; do
  locale=$(basename "$locale_dir")
  if [ -f "$locale_dir/story.json" ]; then
    mkdir -p "$dist_dir/src/dist/$locale"
    cp "$locale_dir/story.json" "$dist_dir/src/dist/$locale/"
  fi
done
```

### Pattern

**Incomplete Asset Pipeline:** Build step copies some runtime assets but misses others added later. No validation that the dist output contains everything the app needs at runtime.

### Prevention

The `build:prod` task should copy all contents of the experience's `dist/` directory rather than cherry-picking specific subdirectories. Consider adding a post-build validation step that checks for required files (story.json per locale, ink.js, locale JSON).

---

## BUG-011: Black Screen After Deploy — Circular Dependency Deadlock in Production Bundle

**Date:** 2026-02-01
**Commit:** 3be82b4
**Category:** Build / Module System — Top-Level Await Deadlock
**Severity:** Critical — deployed site shows black screen, no components register, no errors

### Symptom

After deploying to GitHub Pages (and in any production build served statically), the page showed only a black phone frame. Console logged only two i18n messages then stopped — no errors, no "Game ready". Dev server (`mise run dev`) worked perfectly. The `dist/` JS files all loaded with 200 status.

### Root Cause

Vite bundled `contextRegistry` (from `packages/framework/src/foundation/`) into the entry chunk (`index-C1vLf0B0.js`). The entry chunk uses top-level `await` (for `i18nReady` and `registerConversationComponents()`). The component chunk (`index-Wu3YyXw2.js`) statically imports `contextRegistry` from the entry chunk.

Per ES module spec, a module with top-level await doesn't expose its exports until execution completes. The deadlock:

1. Entry chunk starts executing, hits `await registerConversationComponents()` which dynamically imports the component chunk
2. Component chunk has `import {c} from "./index-C1vLf0B0.js"` — waits for the entry to finish executing
3. Entry is waiting for the component chunk to load → **deadlock**, both modules wait forever

This never happens in dev because Vite serves each source file as a separate module — `contextRegistry` lives in its own file with no top-level await, so no cycle forms.

### Fix

Added `manualChunks` to `vite.config.js` to force all `packages/framework/src/foundation/` modules into a separate `foundation` chunk. The component chunk now imports from `foundation-*.js` (no TLA), breaking the cycle.

```js
manualChunks(id) {
  if (id.includes('packages/framework/src/foundation/')) {
    return 'foundation';
  }
}
```

### Pattern

**TLA Circular Deadlock:** When Vite bundles shared code into an entry chunk that has top-level await, any dynamically-imported chunk that statically imports back into the entry creates a deadlock. The deadlock is silent — no errors, no timeouts, just a frozen module graph.

**Detection heuristic:** If a production build hangs silently where dev works fine, check whether the entry chunk's exports are imported by chunks that the entry dynamically imports. Look for `import{...}from"./index-*.js"` in non-entry chunks.

### Prevention

- Entry modules with top-level `await` must not export symbols that other chunks need. Use `manualChunks` to isolate shared code (registries, utilities, event buses) into dedicated chunks.
- After `build:prod`, verify the import graph has no cycles involving TLA chunks. A post-build check could parse the first line of each chunk for circular `import` references back to the entry.

---

## BUG-012: Glossary Page Jitter During View Transition

**Date:** 2026-02-02
**Category:** Animation / Layout Thrash
**Severity:** Medium — visible jittering when opening glossary from chat
**Task:** TASK-115

### Symptom

Clicking a glossary term in a chat message caused the glossary page to visibly jitter and thrash during its slide-in transition, instead of a smooth parallax animation.

### Root Cause

Same bug class as "2026-01-29 - Parallax view transition flash on unread chats". `glossaryPage.show(termId)` raced `transitionViews()`:

1. `show()` set `this.hidden = false` independently of the transition
2. `show()` called `render()` (full `innerHTML` replace) during the slide animation
3. `show()` called `scrollIntoView()` inside a `requestAnimationFrame` — layout-forcing during animation
4. `transitionViews()` also set `hidden = false` and applied `transform: translateX(100%)` — the two fought

### Fix

**Structural:** Added `onReady` and `onComplete` callbacks to `transitionViews()`:
- `onReady`: fires after incoming is positioned offscreen but before animation starts. For content preparation (render, innerHTML).
- `onComplete`: fires after animation finishes and cleanup is done. For scrollIntoView, focus.

**Glossary page:** Split `show()` into content preparation (no visibility, no scroll) and `scrollToTerm()` (called via `onComplete`).

**Chat thread:** Migrated existing `_threadFinalize` `.then()` pattern to `onComplete` for consistency.

### Pattern

**Transition-Content Race:** A component's `show()` method sets visibility and forces layout while `transitionViews()` is animating the same element. The browser paints the element at its rest position before the animation can position it offscreen.

### Prevention

- `transitionViews()` now provides `onReady`/`onComplete` hooks — the correct pattern is the default path
- `lint-transition-safety.js`: flags `this.hidden = false` and `scrollIntoView` inside component `show()` methods
- Components that toggle visibility directly (not via transitions) opt out with `// lint-ignore: direct visibility`

## BUG-013: Duplicate Glossary Transitions from Stacked shadowRoot Listeners

**Date:** 2026-02-02
**Category:** Event / Duplicate Handlers
**Severity:** Medium — glossary opens, blanks, then opens again (double transition)
**Task:** TASK-115

### Symptom

Clicking a glossary term link in a chat message caused the glossary page to open, flash to a blank screen, then open again. Two full transitions ran back-to-back instead of one.

### Root Cause

`wireGlossaryClicks(this.shadowRoot, this)` was called from `render()` in `chat-thread/index.js`. Each render added a new delegated click listener to `shadowRoot`. Unlike child elements (destroyed by `innerHTML`), **`shadowRoot` persists across renders** — listeners stacked.

After N renders, one click on a `.learning-highlight` dispatched N `glossary-term-clicked` events. The transition queue serialized them: first transition opened glossary, second transition treated glossary as outgoing then incoming again.

Same bug existed in 3 other call sites (`link-preview.js`, `conversation-settings.js`, `player-profile.js`). The `read-more-toggle` handler in chat-thread had the same class of bug but was masked by a `_readMoreWired` instance-property guard.

### Fix

Made `wireGlossaryClicks` **idempotent** — marks `shadowRoot._glossaryClicksWired` and returns early on subsequent calls. Fix applies to all 4 call sites without touching them.

Extracted `wireReadMoreToggles` helper with same idempotent pattern, replacing the inline guard in chat-thread.

### Pattern

**Stacked shadowRoot Listeners:** Delegated listeners added to `shadowRoot` (not child elements) inside `render()` or `wireEvents()` accumulate across re-renders. Child element listeners are safe because `innerHTML` destroys them, but shadowRoot listeners persist.

### Prevention

- `wireGlossaryClicks` and `wireReadMoreToggles` are now idempotent — safe to call from `render()` without stacking
- Pattern documented in `docs/tutorials/creating-a-component.md`
- Any new `shadowRoot.addEventListener` in render paths should use the same mark-and-skip pattern