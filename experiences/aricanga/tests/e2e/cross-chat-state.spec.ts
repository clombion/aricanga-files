// tests/cross-chat-state.spec.ts
import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub, ChatThread, Notification } from '@narratives/test-utils/pages';
import { waitForGameInitSettled } from '@narratives/test-utils/helpers';
import {
  MESSAGE_MARKERS,
  NOTIFICATIONS,
  CHOICES,
} from '../fixtures/story-expectations';

test.describe('Cross-Chat State Synchronization', () => {
  test('game init triggers Pat notification on lockscreen', async ({ page }) => {
    const hub = new ChatHub(page);
    const notification = new Notification(page);

    await hub.goto();
    // game_init sends Pat message via delay_next(3000) — wait for real timer
    await waitForGameInitSettled(page);

    // Pat notification should be in drawer (popup auto-dismissed by now)
    expect(await notification.getDrawerCount()).toBeGreaterThanOrEqual(1);
  });

  test('clicking notification navigates to correct chat', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();
    await waitForGameInitSettled(page);

    // Pat notification should be in drawer
    await notification.openDrawer();
    await notification.clickDrawerNotification(0);

    // Should now be in Pat's chat
    await thread.waitForMessage(MESSAGE_MARKERS.pat.first);
  });

  test('completing Pat task triggers Notes notification', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();

    // Open news first to advance story
    await hub.openChat('news');
    await clock.advance(COMMON_DELAYS.MAX);
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await thread.goBack();

    // Open Pat and make a choice
    await hub.openChat('pat');
    await thread.waitForMessage(MESSAGE_MARKERS.pat.choicePrompt, 15000);

    // Select the first choice (straightforward write-up)
    await thread.selectChoice(CHOICES.pat.acceptAssignment);

    // Should get Notes notification
    await notification.waitForNotification(NOTIFICATIONS.notes.speaker, 15000);
  });

  test('clicking drawer notification removes it from drawer', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const notification = new Notification(page);

    await hub.goto();
    await waitForGameInitSettled(page);

    // Pat notification should be in drawer from game_init
    expect(await notification.getDrawerCount()).toBeGreaterThanOrEqual(1);

    // Open drawer and click the notification
    await notification.openDrawer();
    await notification.clickDrawerNotification(0);

    // Wait for navigation to complete, then verify Pat notification was removed
    // (opening Pat chat may trigger new notifications for other chats like news)
    await page.waitForTimeout(500);
    const remaining = await page.evaluate(() => {
      const drawer = document.querySelector('notification-drawer') as any;
      return drawer?._notifications?.map((n: any) => n.chatId) ?? [];
    });
    expect(remaining).not.toContain('pat');
  });

  test('popup notification click prevents drawer entry', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();
    await notification.clearDrawer();

    // Open news to advance story, go back, open Pat to trigger choice flow
    await hub.openChat('news');
    await clock.advance(COMMON_DELAYS.MAX);
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await thread.goBack();

    await hub.openChat('pat');
    await thread.waitForMessage(MESSAGE_MARKERS.pat.choicePrompt, 15000);
    await thread.selectChoice(CHOICES.pat.acceptAssignment);

    // Notes notification popup should appear
    await notification.waitForNotification(NOTIFICATIONS.notes.speaker, 15000);

    // Click the popup (should NOT go to drawer)
    await notification.clickNotification();

    // Verify drawer is empty
    expect(await notification.getDrawerCount()).toBe(0);
  });

  test('completing Notes research triggers Pat notification', async ({
    page,
    installClock,
  }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    const notification = new Notification(page);

    await hub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();

    // Open news first
    await hub.openChat('news');
    await clock.advance(COMMON_DELAYS.MAX);
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await thread.goBack();

    // Make a choice in Pat to enable Notes research
    await hub.openChat('pat');
    await thread.waitForMessage(MESSAGE_MARKERS.pat.choicePrompt, 15000);
    await thread.selectChoice(CHOICES.pat.acceptAssignment);

    // Dismiss Notes notification
    await notification.waitForNotification(NOTIFICATIONS.notes.speaker, 15000);
    await notification.dismiss();
    await clock.advance(COMMON_DELAYS.SHORT);
    await thread.goBack();

    // Visit Notes to trigger research phase
    await hub.openChat('notes');

    // Wait for brainstorm choice to appear and select it
    await expect(thread.choices.first()).toBeVisible({ timeout: 15000 });
    await thread.selectChoice(CHOICES.notes.ministryOnly);

    // Wait for story to finish processing research content
    await thread.waitForStorySettlement();

    // Should get Pat notification after research completes
    await notification.waitForNotification(NOTIFICATIONS.pat.speaker, 30000);
  });
});
