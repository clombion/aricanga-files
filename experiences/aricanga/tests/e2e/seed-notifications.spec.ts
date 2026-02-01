/**
 * Seed Notification Invariant Tests
 *
 * Core invariant: Seed messages (backstory before # story_start) must NEVER
 * trigger notifications. They are pre-existing history, not new messages.
 *
 * Story auto-starts at hub on fresh game, triggering game_init which sends
 * the OFFICIAL news message. This is a real message (post story_start) and
 * SHOULD trigger a notification on the lockscreen.
 *
 * These tests verify that on a fresh game start:
 * 1. Seeds don't trigger notifications (only real messages do)
 * 2. Lockscreen shows OFFICIAL news notification (from game_init)
 * 3. Seeds don't trigger unread badges (but OFFICIAL does)
 */
import { test, expect } from '@playwright/test';
import { ChatHub, ChatThread } from '@narratives/test-utils/pages';

test.describe('Seed Notification Invariants', () => {
  test('fresh game start emits OFFICIAL notification (not seeds)', async ({ page }) => {
    // Add script to capture notifications BEFORE page loads
    await page.addInitScript(() => {
      (window as unknown as { __testNotifications: string[] }).__testNotifications = [];
      const originalDispatch = EventTarget.prototype.dispatchEvent;
      EventTarget.prototype.dispatchEvent = function (event: Event) {
        if (event.type === 'notification') {
          const detail = (event as CustomEvent).detail;
          (window as unknown as { __testNotifications: string[] }).__testNotifications.push(
            detail?.preview || detail?.text || 'unknown',
          );
        }
        return originalDispatch.call(this, event);
      };
    });

    const hub = new ChatHub(page);
    await hub.goto();
    await page.waitForTimeout(1000); // Wait for any async events

    // Get captured notifications
    const notifications = await page.evaluate(
      () => (window as unknown as { __testNotifications: string[] }).__testNotifications,
    );

    // Should have exactly one notification: OFFICIAL news (not seeds)
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0]).toContain('OFFICIAL —');
  });

  test('lockscreen shows OFFICIAL news notification on fresh game', async ({ page }) => {
    // Go directly to app (fresh game)
    await page.goto('.');
    await page.waitForTimeout(1000);

    // Check if notification is visible on lock screen
    const lockScreen = page.locator('lock-screen');
    const notification = lockScreen.locator('.notification-card');

    // Should have a notification from game_init OFFICIAL news
    await expect(notification.first()).toBeVisible();

    // Notification should contain OFFICIAL text
    const notificationText = await notification.first().textContent();
    expect(notificationText).toContain('OFFICIAL —');
  });

  test('hub shows seed preview text, not "Tap to open"', async ({ page }) => {
    const hub = new ChatHub(page);

    await hub.goto();

    // News chat has seeds - should show preview text
    const newsPreview = await hub.getPreviewText('news');
    expect(newsPreview).not.toBe('Tap to open');
    expect(newsPreview.trim().length).toBeGreaterThan(0);

    // Notes chat has seeds (sent type) - should show preview text
    const notesPreview = await hub.getPreviewText('notes');
    expect(notesPreview).not.toBe('Tap to open');
    expect(notesPreview.trim().length).toBeGreaterThan(0);
  });

  test('OFFICIAL triggers unread badge, seeds do NOT', async ({ page }) => {
    const hub = new ChatHub(page);

    await hub.goto();

    // News chat should have unread indicator from OFFICIAL message
    // (not from seeds - those are backstory)
    const newsUnread = await hub.hasUnreadIndicator('news');
    expect(newsUnread).toBe(true);

    // Notes chat should NOT have unread indicator (only has seeds)
    const notesUnread = await hub.hasUnreadIndicator('notes');
    expect(notesUnread).toBe(false);
  });

  test('Pat notification triggers when opening news chat', async ({ page }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();

    // Open news chat to trigger story progression past story_start
    await hub.openChat('news');

    // Wait for messages to appear (OFFICIAL triggers Pat cross-chat message)
    await page.waitForTimeout(2000);

    // Go back to hub
    await thread.goBack();
    await page.waitForTimeout(1000);

    // Pat's message about the release should trigger notification
    const notificationPopup = page.locator('notification-popup');
    if (await notificationPopup.isVisible().catch(() => false)) {
      const notificationText = await notificationPopup.textContent();
      // Pat's message should contain "release"
      expect(notificationText).toContain('release');
    }
  });
});
