import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub, ChatThread, Notification, StatusBar } from '@narratives/test-utils/pages';
import {
  EXPECTED_TIMES,
  MESSAGE_MARKERS,
  NOTIFICATIONS,
  CHOICES,
} from '../fixtures/story-expectations';

// CQO-13: Time Coherence Tests
// Validates that phone clock follows message timestamps
//
// These tests install the clock BEFORE page load so that game_init's
// delay_next(3000) runs under fake timers, giving deterministic timing.

/**
 * Setup helper for time-coherence tests.
 * Installs fake clock before page load, navigates, handles lock screen
 * with clock advancement, and ensures hub is visible.
 */
async function setupWithFakeClock(page: any) {
  await page.clock.install();
  await page.addInitScript(() => localStorage.clear());
  await page.goto('.');

  // Advance fake clock to allow app init timers (rAF, setTimeout) to fire
  await page.clock.fastForward(500);
  await page.waitForTimeout(100);

  // Handle lock screen (may or may not be visible depending on app state)
  const lockScreen = page.locator('lock-screen:not([hidden])');
  if (await lockScreen.isVisible({ timeout: 2000 }).catch(() => false)) {
    await lockScreen.locator('.fingerprint-btn').click({ force: true });
    await page.clock.fastForward(1000);
    await page.waitForTimeout(100);
  }

  // Advance past game_init delay_next(3000) so all init messages are delivered
  await page.clock.fastForward(COMMON_DELAYS.MAX);
  await page.waitForTimeout(100);

  // Ensure hub is visible
  await page.locator('chat-hub:not([hidden])').waitFor({ state: 'visible', timeout: 5000 });
}

test.describe('Time Coherence (CQO-13)', () => {
  let hub: ChatHub;
  let thread: ChatThread;
  let statusBar: StatusBar;
  let notification: Notification;

  test('phone clock shows time after News messages load', async ({ page }) => {
    await setupWithFakeClock(page);
    hub = new ChatHub(page);
    thread = new ChatThread(page);
    statusBar = new StatusBar(page);

    // News chat: messages drift clock
    await hub.openChat('news');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.news.last);

    const phoneTime = await statusBar.getTime();
    expect(phoneTime).toBe(EXPECTED_TIMES.news);
  });

  test('phone clock shows time after Pat messages load', async ({ page }) => {
    await setupWithFakeClock(page);
    hub = new ChatHub(page);
    thread = new ChatThread(page);
    statusBar = new StatusBar(page);

    // Open news first
    await hub.openChat('news');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.news.last);
    await thread.goBack();

    // Pat chat
    await hub.openChat('pat');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.pat.assignment, 15000);

    const phoneTime = await statusBar.getTime();
    expect(phoneTime).toBe(EXPECTED_TIMES.pat);
  });

  test('phone clock advances forward when switching chats', async ({ page }) => {
    await setupWithFakeClock(page);
    hub = new ChatHub(page);
    thread = new ChatThread(page);
    statusBar = new StatusBar(page);

    // Open News
    await hub.openChat('news');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.news.last);
    const newsTime = await statusBar.getTime();
    expect(newsTime).toBe(EXPECTED_TIMES.news);
    await thread.goBack();

    // Switch to Pat - time advances
    await hub.openChat('pat');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.pat.assignment, 15000);
    const patTime = await statusBar.getTime();
    expect(patTime).toBe(EXPECTED_TIMES.pat);
  });

  test('first message in each chat has visible time', async ({ page }) => {
    await setupWithFakeClock(page);
    hub = new ChatHub(page);
    thread = new ChatThread(page);
    statusBar = new StatusBar(page);

    // Open News
    await hub.openChat('news');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);

    let timeElements = await page.locator('chat-thread .meta').count();
    expect(timeElements, 'News chat should have messages with time stamps').toBeGreaterThan(0);
    await thread.goBack();

    // Check Pat has time
    await hub.openChat('pat');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.pat.first, 15000);
    timeElements = await page.locator('chat-thread .meta').count();
    expect(timeElements, 'Pat chat should have messages with time stamps').toBeGreaterThan(0);
  });

  test('Notes chat clock shows drifted time after research messages', async ({ page }) => {
    await setupWithFakeClock(page);
    hub = new ChatHub(page);
    thread = new ChatThread(page);
    statusBar = new StatusBar(page);
    notification = new Notification(page);

    // Open news
    await hub.openChat('news');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.news.last);
    await thread.goBack();

    // Open Pat and make choice
    await hub.openChat('pat');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.pat.assignment, 15000);

    await thread.selectChoice(CHOICES.pat.acceptAssignment);
    await page.clock.fastForward(COMMON_DELAYS.VERY_LONG);
    await page.waitForTimeout(50);

    // Wait for Notes notification and dismiss
    await notification.waitForNotification(NOTIFICATIONS.notes.speaker, 15000);
    await notification.dismiss();
    await page.clock.fastForward(COMMON_DELAYS.SHORT);
    await page.waitForTimeout(50);
    await thread.goBack();

    // Open Notes
    await hub.openChat('notes');
    await page.clock.fastForward(COMMON_DELAYS.MAX);
    await page.waitForTimeout(50);
    await thread.waitForMessage(MESSAGE_MARKERS.notes.brainstorm, 15000);

    const phoneTime = await statusBar.getTime();
    expect(phoneTime).toBe(EXPECTED_TIMES.notes);
  });
});
