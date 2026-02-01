// tests/clock-demo.spec.ts
// Demonstrates clock mocking for faster tests
// Run with: npx playwright test tests/clock-demo.spec.ts

import { test, expect, withMockedClock, COMMON_DELAYS } from '../shared/fixtures/clock';
import { ChatHub } from '../shared/pages/chat-hub';
import { ChatThread } from '../shared/pages/chat-thread';

test.describe('Clock Mocking Demo', () => {
  test('messages appear after fast-forwarded delays', async ({ page, installClock }) => {
    // Navigate to app
    await page.goto('.');
    await page.waitForSelector('chat-hub');

    // Install clock before navigating to chat
    const clock = await installClock();

    // Open news chat
    const hub = new ChatHub(page);
    await hub.openChat('news');

    const thread = new ChatThread(page);

    // The first message should appear immediately (no delay)
    await expect(thread.messages.first()).toBeVisible({ timeout: 2000 });

    // Fast-forward through any pending delays
    await clock.advance(COMMON_DELAYS.MAX);

    // Verify message content
    const messageCount = await thread.messages.count();
    expect(messageCount).toBeGreaterThanOrEqual(1);
  });

  test('clock mocking with function helper', async ({ page }) => {
    await page.goto('.');
    await page.waitForSelector('chat-hub');

    await withMockedClock(page, async (clock) => {
      const hub = new ChatHub(page);
      await hub.openChat('news');

      const thread = new ChatThread(page);

      // Advance through delays
      await clock.advance(2000);

      // Check messages loaded
      const count = await thread.messages.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test('compare timing: real vs mocked (informational)', async ({ page }) => {
    // This test demonstrates the time savings from clock mocking
    // It's informational - actual savings depend on the test content

    await page.goto('.');
    await page.waitForSelector('chat-hub');

    const hub = new ChatHub(page);

    // Measure with real time
    const realStart = Date.now();
    await hub.openChat('news');
    const thread = new ChatThread(page);
    // Just wait for first message, don't wait for full delay chain
    await thread.messages.first().waitFor({ timeout: 5000 });
    const realTime = Date.now() - realStart;

    console.log(`Real time navigation: ${realTime}ms`);

    // Note: Full delay chains in pat_chat can take 5-10 seconds of real time
    // With clock mocking, these complete in milliseconds
    expect(realTime).toBeLessThan(10000); // Sanity check
  });
});

test.describe('Clock Mocking with Delays', () => {
  test.skip('demonstrate delay_next handling', async ({ page, installClock }) => {
    // This test is skipped by default as it's for demonstration
    // It shows how to handle chats with heavy delays like pat_chat

    await page.goto('.');
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    // Install clock BEFORE triggering delayed content
    const clock = await installClock();

    // Pat chat has multiple delay_next() calls
    await hub.openChat('pat');

    // First message appears followed by delay_next(800) + delay_next(1200)

    // Advance through the delay sequence
    await clock.advance(COMMON_DELAYS.MEDIUM);  // 800ms
    await clock.advance(COMMON_DELAYS.LONG);    // 1200ms

    // Now more messages should be visible
    const count = await thread.messages.count();
    console.log(`Messages after clock advance: ${count}`);
  });
});
