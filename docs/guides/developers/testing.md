# E2E Testing Guide

> **Audience:** Implementation Developers | Framework Developers

How to write Playwright tests for the conversation interface.

---

## Page Objects

Page objects encapsulate component interactions and provide a stable API.

### ChatHub

**File:** `tests/shared/pages/chat-hub.ts`

```typescript
import { ChatHub } from '../pages/chat-hub';

const hub = new ChatHub(page);

await hub.goto();                    // Navigate + clear localStorage
await hub.openChat('pat');           // Click chat + wait for thread
await hub.hasUnreadIndicator('pat'); // Check badge state
await hub.isVisible();               // Check visibility
```

**Key methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `goto()` | `void` | Navigate to app, clears localStorage |
| `openChat(chatId)` | `void` | Click chat, wait for thread |
| `chatItem(chatId)` | `Locator` | Get chat list item |
| `hasUnreadIndicator(chatId)` | `boolean` | Check if badge visible |
| `isVisible()` | `boolean` | Check hub visibility |

### ChatThread

**File:** `tests/shared/pages/chat-thread.ts`

```typescript
import { ChatThread } from '../pages/chat-thread';

const thread = new ChatThread(page);

await thread.waitForMessage('Hello');     // Wait for text
await thread.selectChoice('I understand'); // Click choice
await thread.goBack();                     // Return to hub
await thread.isTypingIndicatorVisible();   // Check typing state
```

**Key methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `waitForMessage(text, timeout?)` | `void` | Wait for message containing text |
| `waitForMessageCount(count, timeout?)` | `void` | Wait for exact count |
| `selectChoice(text)` | `void` | Click choice button |
| `selectChoiceByIndex(index)` | `void` | Click choice by position |
| `goBack()` | `void` | Click back, wait for hub |
| `getMessageCount()` | `number` | Count visible messages |
| `hasChoices()` | `boolean` | Check if choices visible |
| `isTypingIndicatorVisible()` | `boolean` | Check typing indicator |
| `waitForTypingIndicator(timeout?)` | `void` | Wait for indicator |
| `waitForTypingIndicatorHidden(timeout?)` | `void` | Wait for indicator to hide |

---

## Clock Mocking

The game uses `delay_next()` for typing simulation (400ms-4000ms). Clock mocking lets tests skip delays.

### Setup

```typescript
import { test, expect, COMMON_DELAYS } from '../../shared/fixtures/clock';

test('messages appear after delays', async ({ page, installClock }) => {
  const clock = await installClock();
  // ... test code
});
```

### Clock Controller Methods

```typescript
// Advance time and wait for DOM to settle
await clock.advance(800);

// Advance without settling (precise control)
await clock.fastForward(800);

// Flush pending promises
await clock.runMicrotasks();

// Pause at specific timestamp
await clock.pauseAt(Date.now() + 5000);

// Resume real-time
await clock.resume();
```

### Common Delays

```typescript
import { COMMON_DELAYS } from '../../shared/fixtures/clock';

COMMON_DELAYS.SHORT      // 400ms  - Quick responses
COMMON_DELAYS.MEDIUM     // 800ms  - Normal typing
COMMON_DELAYS.LONG       // 1200ms - Thinking pause
COMMON_DELAYS.VERY_LONG  // 2500ms - Extended pause
COMMON_DELAYS.MAX        // 4000ms - Maximum delay
```

### Pattern: Fast-forward Through Delays

```typescript
test('all messages load', async ({ page, installClock }) => {
  const hub = new ChatHub(page);
  const thread = new ChatThread(page);
  const clock = await installClock();

  await hub.goto();
  await hub.openChat('news');

  // Fast-forward past all delays
  await clock.advance(COMMON_DELAYS.MAX);

  // Verify messages arrived
  const count = await thread.getMessageCount();
  expect(count).toBeGreaterThan(3);
});
```

### Pattern: Observe Mid-Delay State

```typescript
test('typing indicator visible during delay', async ({ page, installClock }) => {
  const thread = new ChatThread(page);
  const clock = await installClock();

  // Open chat
  await page.goto('/');
  await page.evaluate(() => controller.openChat('pat'));

  // Advance partially
  await clock.advance(COMMON_DELAYS.SHORT);

  // Check mid-delay state
  expect(await thread.isTypingIndicatorVisible()).toBe(true);

  // Complete
  await clock.advance(COMMON_DELAYS.MAX);
});
```

---

## localStorage Isolation

Tests run in parallel with 8 workers. Without isolation, tests corrupt each other's state.

### The Problem

```typescript
// BAD: Race condition
await page.goto('/');  // App loads stale localStorage
await page.evaluate(() => localStorage.clear());  // Too late!
```

### Solution 1: addInitScript (Most Tests)

Clear localStorage **before** any page scripts run:

```typescript
await page.addInitScript(() => localStorage.clear());
await page.goto('/');
await page.waitForSelector('chat-hub');
```

The `ChatHub.goto()` page object does this automatically:

```typescript
const hub = new ChatHub(page);
await hub.goto();  // Handles localStorage isolation
```

### Solution 2: Serial Mode (Persistence Tests)

Tests that verify persistence must run one at a time:

```typescript
test.describe('Persistence Contract', () => {
  test.describe.configure({ mode: 'serial' });

  test('state survives reload', async ({ page }) => {
    // First visit: clear
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Do stuff, save
    await page.evaluate(() => controller.saveState());

    // Reload and verify
    await page.reload();
    // ... assertions
  });
});
```

### When to Use Which

| Scenario | Approach |
|----------|----------|
| Most tests | `addInitScript` or `ChatHub.goto()` |
| Testing persistence | Serial mode |
| Testing state restore | Serial mode |
| Cross-chat state | `addInitScript` (parallel OK) |

---

## Common Test Patterns

### Basic Navigation Test

```typescript
test('can open and close chat', async ({ page }) => {
  const hub = new ChatHub(page);
  const thread = new ChatThread(page);

  await hub.goto();
  expect(await hub.isVisible()).toBe(true);

  await hub.openChat('pat');
  expect(await thread.isVisible()).toBe(true);

  await thread.goBack();
  expect(await hub.isVisible()).toBe(true);
});
```

### Message Content Test

```typescript
test('first message appears', async ({ page, installClock }) => {
  const hub = new ChatHub(page);
  const thread = new ChatThread(page);
  const clock = await installClock();

  await hub.goto();
  await hub.openChat('news');

  await clock.advance(COMMON_DELAYS.MAX);
  await thread.waitForMessage('BREAKING');
});
```

### Cross-Chat State Test

```typescript
test('badge appears when message triggers alert', async ({ page, installClock }) => {
  const hub = new ChatHub(page);
  const clock = await installClock();

  await hub.goto();
  await hub.openChat('news');
  await clock.advance(COMMON_DELAYS.MAX);

  // Return to hub
  await page.evaluate(() => {
    const thread = document.querySelector('chat-thread');
    thread?.shadowRoot?.querySelector('.back-button')?.click();
  });
  await clock.advance(COMMON_DELAYS.SHORT);

  // Check badge on Pat
  expect(await hub.hasUnreadIndicator('pat')).toBe(true);
});
```

### Reduced Motion Test

```typescript
test('respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');

  const duration = await page.evaluate(() => {
    const el = document.querySelector('.animated');
    return getComputedStyle(el).animationDuration;
  });

  expect(duration).toBe('0s');
});
```

### Shadow DOM Access

Components use Shadow DOM. Access internal elements:

```typescript
// Via page.evaluate
await page.evaluate(() => {
  const hub = document.querySelector('chat-hub');
  const btn = hub?.shadowRoot?.querySelector('.chat-item-btn');
  btn?.click();
});

// Via locator (limited)
const thread = page.locator('chat-thread');
const messages = thread.locator('.message');  // Won't pierce shadow DOM
```

### Controller Access

Access game controller for programmatic control:

```typescript
await page.evaluate(() => {
  // Open chat programmatically
  window.controller.openChat('pat');

  // Check state
  const snapshot = window.controller.actor.getSnapshot();
  return snapshot.context.messageHistory;

  // Set variable
  window.controller.setVariable('player_agreed', true);
});
```

---

## Test Organization

Tests are organized by scope:

| Category | Path | Purpose |
|----------|------|---------|
| Engine | `tests/engine/` | Foundation + system tests (reusable across implementations) |
| Implementation | `tests/implementation/` | Aricanga-specific tests (e2e, contract, unit) |
| Quality | `packages/tests/quality/` | CQO enforcement (architecture, accessibility, ink) |
| Shared | `tests/shared/` | Fixtures, helpers, page objects, fakes |

### Running by Category

```bash
# Engine tests only (fast, no game data needed)
mise run test:engine

# Implementation tests (requires game data)
mise run test:impl

# Quality/CQO tests
mise run test:quality
```

---

## Running Tests

```bash
# All tests
mise run test:e2e

# Specific file
pnpm exec playwright test tests/implementation/e2e/navigation.spec.ts

# With UI (debugging)
mise run test:e2e:ui

# Headed (see browser)
pnpm exec playwright test --headed

# Specific browser
pnpm exec playwright test --project=chromium
```

---

## Debugging

### Playwright UI

```bash
mise run test:e2e:ui
```

Step through tests, see snapshots, inspect DOM.

### Console Logs

```typescript
page.on('console', msg => console.log(msg.text()));
```

### Screenshots

```typescript
await page.screenshot({ path: 'debug.png' });
```

### Pause Execution

```typescript
await page.pause();  // Opens inspector
```

---

## Related

- [Architecture - Time Mocking](../../concepts/architecture.md#time-mocking-in-e2e-tests) - Detailed clock docs
- [Architecture - localStorage Isolation](../../concepts/architecture.md#localstorage-isolation-in-parallel-tests) - Isolation patterns
- [Accessibility Guide](accessibility.md) - axe-core testing
