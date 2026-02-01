import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub } from '@narratives/test-utils/pages';
import { ChatThread } from '@narratives/test-utils/pages';
import { Notification } from '@narratives/test-utils/pages';
import {
  MESSAGE_MARKERS,
  NOTIFICATIONS,
  TRIGGERS,
} from '../../../../experiences/aricanga/tests/fixtures/story-expectations';

// Atomicity Tests
// Validates that state changes emit events exactly once

test.describe('Atomicity', () => {
  test('badge clears exactly once when opening unread chat', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();
    const clock = await installClock();

    // Open news to trigger Pat becoming unread
    await hub.openChat('news');
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);

    // Wait for Pat notification
    await notification.waitForNotification(NOTIFICATIONS.pat.speaker);

    // Dismiss notification and go back to hub
    await page.evaluate(() => {
      const popup = document.querySelector('notification-popup');
      popup?.shadowRoot
        ?.querySelector('.dismiss-btn')
        ?.dispatchEvent(new Event('click', { bubbles: true }));
    });
    await clock.advance(COMMON_DELAYS.SHORT);
    await thread.goBack();

    // Verify Pat has unread indicator
    expect(await hub.hasUnreadIndicator(TRIGGERS.newsToPatNotification.target)).toBe(true);

    // Open Pat chat (should clear unread via CHAT_OPENED event)
    await hub.openChat('pat');
    await thread.waitForMessage(MESSAGE_MARKERS.pat.first, 15000);

    // Give events time to fire
    await clock.advance(COMMON_DELAYS.MEDIUM);

    // Verify badge is cleared
    await thread.goBack();
    expect(await hub.hasUnreadIndicator('pat')).toBe(false);
  });

  test('notification emits exactly once via cross-chat message', async ({
    page,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();

    // Track notification events
    await page.evaluate(() => {
      window._notificationEvents = [];
      window.controller.addEventListener('notification', (e) => {
        window._notificationEvents.push(e.detail);
      });
    });

    // Open news - this triggers Pat notification via # targetChat tag (CQO-20)
    await hub.openChat('news');
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);

    // Wait for notification
    await notification.waitForNotification(NOTIFICATIONS.pat.speaker);

    // Check that notification event fired exactly once for Pat
    const notificationEvents = await page.evaluate(
      () => window._notificationEvents,
    );

    const patNotifications = notificationEvents.filter(
      (e) => e.chatId === 'pat',
    );
    expect(patNotifications.length).toBe(1);
  });
});

// Type declarations for window extensions
declare global {
  interface Window {
    _notificationEvents: Array<{ chatId: string; preview: string }>;
    controller: {
      addEventListener: (
        event: string,
        callback: (e: CustomEvent) => void,
      ) => void;
    };
  }
}
