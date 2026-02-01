# Testing Reference

Patterns and fixtures for testing phone-game implementations.

---

## Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Unit tests | `tests/unit/` | State machine logic (Vitest + happy-dom) |
| Contract tests | `tests/contract/` | Verify config.js matches ink knots/variables |
| Invariant tests | `packages/tests/quality/invariants.spec.ts` | Verify structural properties hold |
| Accessibility tests | `packages/tests/quality/accessibility.spec.ts` | WCAG compliance via axe-core |
| E2E tests | `tests/e2e/` | Verify user-facing behavior |

---

## Time Mocking in E2E Tests

The game uses `delay_next()` to create realistic typing delays (400ms-4000ms). Without mocking, tests must wait for real time to pass. Time mocking lets tests skip these delays instantly.

### When to Use Time Mocking

| Scenario | Use Mocking? | Why |
|----------|--------------|-----|
| Testing message sequence appears | **Yes** | Skip delays, verify content |
| Testing delay *feels* right | No | Need real timing for UX |
| Testing cross-chat triggers | **Yes** | Multiple delays compound |
| Testing animations | No | Animations need real frames |

### Using the Clock Fixture

Import from `tests/fixtures/clock.ts`:

```typescript
import { test, expect, COMMON_DELAYS } from './fixtures/clock';
import { ChatHub } from './pages/chat-hub';
import { ChatThread } from './pages/chat-thread';

test('messages appear after delays', async ({ page, installClock }) => {
  const clock = await installClock();
  const hub = new ChatHub(page);
  const thread = new ChatThread(page);

  await page.goto('/');
  await hub.openChat('pat');

  // First message appears immediately
  await expect(thread.messages.first()).toBeVisible();

  // Advance past the delay to see next message
  await clock.advance(COMMON_DELAYS.MEDIUM);
  await expect(thread.messages).toHaveCount(2);
});
```

### Clock Controller Methods

| Method | Purpose |
|--------|---------|
| `clock.advance(ms, settleMs?)` | Skip time and wait for DOM to update |
| `clock.fastForward(ms)` | Skip time without settling (precise control) |
| `clock.runMicrotasks()` | Flush pending promises |
| `clock.pauseAt(timestamp)` | Pause at specific time |
| `clock.resume()` | Resume real-time clock |

### Common Delay Values

```typescript
import { COMMON_DELAYS } from './fixtures/clock';

COMMON_DELAYS.SHORT      // 400ms  - Quick responses
COMMON_DELAYS.MEDIUM     // 800ms  - Normal typing
COMMON_DELAYS.LONG       // 1200ms - Thinking pause
COMMON_DELAYS.VERY_LONG  // 2500ms - Extended pause
COMMON_DELAYS.MAX        // 4000ms - Maximum delay
```

### Limitations

- **Don't mix real and mocked time** in one test
- **Animations may break** - they depend on `requestAnimationFrame`
- **Network requests** are not affected by clock mocking
- **Install early** - must call `installClock()` before navigating

---

## localStorage Isolation in Parallel Tests

Tests run in parallel with 8 workers across 3 browser projects. This creates race conditions when tests share localStorage.

### The Problem

```typescript
// BAD: Race condition in parallel tests
await page.goto('/');                    // App loads stale localStorage from another test
await page.evaluate(() => localStorage.clear());  // Too late - app already initialized
await page.reload();
```

### The Solution

**For most tests**: Use `addInitScript` to clear localStorage before any page scripts run:

```typescript
// GOOD: Clear before app initializes
await page.addInitScript(() => localStorage.clear());
await page.goto('/');
await page.waitForSelector('chat-hub');
```

**For persistence tests**: These specifically test that state survives page reloads, so they must run serially:

```typescript
test.describe('Persistence Contract', () => {
  test.describe.configure({ mode: 'serial' });

  test('state survives reload', async ({ page }) => {
    // Original pattern OK here - tests run one at a time
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // ... test persistence
  });
});
```

---

## Page Objects

The `ChatHub` page object handles localStorage isolation automatically:

```typescript
const hub = new ChatHub(page);
await hub.goto();  // Clears localStorage before loading
```

### Available Page Objects

| Page Object | File | Purpose |
|-------------|------|---------|
| `ChatHub` | `tests/pages/chat-hub.ts` | Hub navigation, chat selection |
| `ChatThread` | `tests/pages/chat-thread.ts` | Message viewing, choice selection |
| `NotificationPopup` | `tests/pages/notification-popup.ts` | Notification interactions |

---

## Running Tests

```bash
# All E2E tests
mise run test:e2e

# With UI for debugging
mise run test:e2e:ui

# Specific test file
pnpm exec playwright test tests/e2e/messaging.spec.ts

# Specific test by name
pnpm exec playwright test -g "messages appear after delays"
```

---

## Related

- [Architecture](../concepts/architecture.md) - System overview
- [CQO Reference](cqo.md) - Quality objectives
- [Conversation System](conversation-system.md) - State machine and events
