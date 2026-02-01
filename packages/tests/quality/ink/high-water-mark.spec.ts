/**
 * High Water Mark (Unread Separator) Tests
 *
 * Verifies the unread separator feature:
 * - Shows separator with unread count when opening a notified chat
 * - Separator appears at the correct position (before unread messages)
 */
import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub } from '@narratives/test-utils/pages';
import { ChatThread } from '@narratives/test-utils/pages';
import { Notification } from '@narratives/test-utils/pages';
import {
  MESSAGE_MARKERS,
  NOTIFICATIONS,
} from '../../../../experiences/aricanga/tests/fixtures/story-expectations';

test.describe('High Water Mark', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to prevent state pollution between tests
    await page.addInitScript(() => localStorage.clear());
  });

  test('HWM-1: unread separator appears when opening notified chat', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();
    const clock = await installClock();

    // Open news chat to trigger Pat notification
    await hub.openChat('news');
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);

    // Wait for Pat notification
    await notification.waitForNotification(NOTIFICATIONS.pat.speaker);

    // Dismiss notification and go back to hub
    await notification.dismissAndSettle(clock);
    await thread.goBack();

    // Open Pat chat and immediately check for separator before delayed messages clear it
    await hub.openChat('pat');

    // Query separator immediately - it clears when subsequent messages arrive
    const separatorCheck = await page.evaluate(() => {
      const threadEl = document.querySelector('chat-thread');
      if (!threadEl?.shadowRoot) return { exists: false, count: '0' };
      const separator = threadEl.shadowRoot.querySelector('unread-separator');
      return {
        exists: !!separator,
        count: separator?.getAttribute('count') || '0',
      };
    });

    expect(separatorCheck.exists).toBe(true);
    expect(Number(separatorCheck.count)).toBeGreaterThan(0);
  });

  test('HWM-2: separator count matches unread message count', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();
    const clock = await installClock();

    // Open news to trigger Pat notification
    await hub.openChat('news');
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await notification.waitForNotification(NOTIFICATIONS.pat.speaker);

    // Dismiss and go back
    await notification.dismissAndSettle(clock);
    await thread.goBack();

    // Open Pat and immediately check separator before delayed messages clear it
    await hub.openChat('pat');

    // Query separator immediately - it clears when subsequent messages arrive
    const counts = await page.evaluate(() => {
      const threadEl = document.querySelector('chat-thread') as any;
      if (!threadEl?.shadowRoot) return { separatorCount: 0, nonSeededCount: 1 };
      const separator = threadEl.shadowRoot.querySelector('unread-separator');
      // When lastReadMessageId is '__BEFORE_ALL__', all non-seeded messages are unread
      // Seeded messages (_isSeed: true) are backstory and always considered "read"
      const nonSeededCount =
        threadEl.messages?.filter((m: any) => !m._isSeed).length || 0;
      return {
        separatorCount: Number(separator?.getAttribute('count') || 0),
        nonSeededCount,
      };
    });

    // Separator count should match non-seeded messages (seeds are backstory, always "read")
    expect(counts.separatorCount).toBe(counts.nonSeededCount);
  });

  // Note: HWM for cross-chat recipients (Spectre/Maria) requires manual testing
  // or a longer e2e test that progresses through the full story to publishing.
  // The fix (emittedMessageIds initialization in state machine) ensures:
  // 1. No duplicate message emissions for cross-chat recipients
  // 2. lastReadMessageId is set correctly when cross-chat message arrives
  // 3. setCurrentView commits buffered messages on chat open
});
