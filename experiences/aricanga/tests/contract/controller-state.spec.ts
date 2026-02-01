import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub, ChatThread, Notification } from '@narratives/test-utils/pages';
import { waitForGameInitSettled } from '@narratives/test-utils/helpers';

/**
 * Safety test: Validates XState context shape after operations.
 * This test documents the expected state structure and will catch
 * any breaking changes during refactoring.
 */
test.describe('Controller State Contract', () => {
  test('context has expected shape after init', async ({ page }) => {
    const chatHub = new ChatHub(page);
    await chatHub.goto();
    // Wait for controller to be fully initialized and all pending delays resolved
    // game_init sends a cross-chat message with delay_next(3000)
    await page.waitForFunction(() => {
      const controller = (window as any).controller;
      const snapshot = controller?.actor?.getSnapshot?.();
      return snapshot?.context?.story && snapshot.context.bufferedMessage === null;
    }, { timeout: 10000 });

    const snapshot = await page.evaluate(() => {
      const controller = (window as any).controller;
      const s = controller.actor.getSnapshot();
      return {
        hasStory: !!s.context.story,
        messageHistoryKeys: Object.keys(s.context.messageHistory),
        hasBufferedMessage: s.context.bufferedMessage !== null,
        pendingDelay: s.context.pendingDelay,
        machineState: s.value,
      };
    });

    expect(snapshot.hasStory).toBe(true);
    // After init, messageHistory has seed messages from preSeedChats()
    // Seeds provide backstory context - chats with seed data will have entries
    expect(snapshot.messageHistoryKeys.length).toBeGreaterThan(0);
    expect(snapshot.hasBufferedMessage).toBe(false);
    expect(snapshot.pendingDelay).toBe(0);
    // Machine should be in idle or waitingForInput after init
    expect(['idle', 'waitingForInput']).toContain(snapshot.machineState);
  });

  test('context has messages after opening chat', async ({ page, installClock }) => {
    const chatHub = new ChatHub(page);
    const chatThread = new ChatThread(page);
    await chatHub.goto();
    const clock = await installClock();

    // Open News chat
    await chatHub.chatItemBtn('news').click();
    await clock.advance(COMMON_DELAYS.MAX);
    // Wait for state machine to settle before checking snapshot
    await chatThread.waitForStorySettlement();

    const snapshot = await page.evaluate(() => {
      const controller = (window as any).controller;
      const s = controller.actor.getSnapshot();
      return {
        messageHistoryKeys: Object.keys(s.context.messageHistory),
        newsMessageCount: s.context.messageHistory['news']?.length || 0,
        machineState: s.value,
      };
    });

    expect(snapshot.messageHistoryKeys).toContain('news');
    expect(snapshot.newsMessageCount).toBeGreaterThan(0);
  });

  test('currentView matches context after open', async ({ page, installClock }) => {
    const chatHub = new ChatHub(page);
    const chatThread = new ChatThread(page);
    await chatHub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();

    // Open first chat (News)
    await chatHub.chatItemBtn('news').click();
    await clock.advance(COMMON_DELAYS.MAX);
    await chatThread.goBack();

    // Open second chat (Pat)
    await chatHub.chatItemBtn('pat').click();
    await clock.advance(COMMON_DELAYS.MAX);
    // Wait for state machine to settle before checking snapshot
    await chatThread.waitForStorySettlement();

    const state = await page.evaluate(() => {
      const controller = (window as any).controller;
      const s = controller.actor.getSnapshot();
      return {
        // currentView is now the single source of truth (no controller.currentChat)
        currentView: s.context.currentView,
        storyCurrentChat: controller.story.variablesState.current_chat,
        hasPatMessages: !!s.context.messageHistory['pat']?.length,
      };
    });

    // Verify currentView is the sole source of truth
    expect(state.currentView).toEqual({ type: 'chat', chatId: 'pat' });
    expect(state.storyCurrentChat).toBe('pat');
    expect(state.hasPatMessages).toBe(true);
  });
});
