import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub, ChatThread } from '@narratives/test-utils/pages';
import { unlockLockScreen, waitForGameInitSettled } from '@narratives/test-utils/helpers';

/**
 * Safety test: Verifies save/load roundtrip preserves state.
 * This ensures refactoring doesn't break persistence.
 *
 * NOTE: These tests must run serially because they test localStorage
 * persistence which is inherently non-parallel-safe across browser contexts.
 */
test.describe('Persistence Contract', () => {
  test.describe.configure({ mode: 'serial' });
  test('state survives save and reload', async ({ page, installClock }) => {
    const chatHub = new ChatHub(page);
    // Clear and start fresh
    // For persistence tests: clear once at start, then let subsequent loads restore
    await page.goto('.');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await unlockLockScreen(page);
    await page.waitForSelector('chat-hub:not([hidden])');
    const clock = await installClock();

    // Open News chat
    await chatHub.chatItemBtn('news').click();
    await clock.advance(COMMON_DELAYS.MAX);

    // Get message count before save
    const beforeSave = await page.evaluate(() => {
      const controller = (window as any).controller;
      const snapshot = controller.actor.getSnapshot();
      return {
        newsMessageCount: snapshot.context.messageHistory['news']?.length || 0,
      };
    });

    // Explicitly save
    await page.evaluate(() => {
      (window as any).controller.saveState();
    });

    // Verify localStorage has data
    const hasState = await page.evaluate(() => {
      return localStorage.getItem('gameState') !== null;
    });
    expect(hasState).toBe(true);

    // Reload page (don't reinstall clock - just wait for controller ready)
    await page.reload();
    await unlockLockScreen(page);
    await page.waitForFunction(() => (window as any).controller?.story);

    // Verify state restored
    const afterLoad = await page.evaluate(() => {
      const controller = (window as any).controller;
      const snapshot = controller.actor.getSnapshot();
      return {
        newsMessageCount: snapshot.context.messageHistory['news']?.length || 0,
      };
    });

    expect(afterLoad.newsMessageCount).toBe(beforeSave.newsMessageCount);
  });

  test('ink state position restored after reload', async ({ page, installClock }) => {
    const chatHub = new ChatHub(page);
    const chatThread = new ChatThread(page);
    // For persistence tests: clear once at start, then let subsequent loads restore
    await page.goto('.');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await unlockLockScreen(page);
    await page.waitForSelector('chat-hub:not([hidden])');
    const clock = await installClock();

    // Open News then Pat to get to choices
    await chatHub.chatItemBtn('news').click();
    await clock.advance(COMMON_DELAYS.MAX);

    // goBack() includes waitForSelector for hub visibility
    await chatThread.goBack();

    await chatHub.chatItemBtn('pat').click();
    await clock.advance(COMMON_DELAYS.MAX);

    // Save and get choices before reload
    await page.evaluate(() => (window as any).controller.saveState());

    const beforeReload = await page.evaluate(() => {
      const controller = (window as any).controller;
      return {
        choiceCount: controller.story.currentChoices.length,
        currentChat: controller.story.variablesState.current_chat,
      };
    });

    // Reload
    await page.reload();
    await unlockLockScreen(page);
    await page.waitForSelector('chat-hub:not([hidden])');
    await page.waitForFunction(() => (window as any).controller?.story);

    // Verify ink state restored (current_chat should be preserved)
    const afterReload = await page.evaluate(() => {
      const controller = (window as any).controller;
      return {
        currentChat: controller.story.variablesState.current_chat,
      };
    });

    expect(afterReload.currentChat).toBe(beforeReload.currentChat);
  });

  test('localStorage format is backwards compatible', async ({ page, installClock }) => {
    const chatHub = new ChatHub(page);
    // For persistence tests: clear once at start, then let subsequent loads restore
    await page.goto('.');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await unlockLockScreen(page);
    await page.waitForSelector('chat-hub:not([hidden])');
    const clock = await installClock();

    // Open a chat to generate some state
    await chatHub.chatItemBtn('news').click();
    await clock.advance(COMMON_DELAYS.MAX);

    await page.evaluate(() => (window as any).controller.saveState());

    // Check saved state structure
    const savedState = await page.evaluate(() => {
      const raw = localStorage.getItem('gameState');
      return raw ? JSON.parse(raw) : null;
    });

    expect(savedState).not.toBeNull();
    expect(savedState).toHaveProperty('inkState');
    expect(savedState).toHaveProperty('messageHistory');
    expect(savedState).toHaveProperty('timestamp');
    expect(typeof savedState.inkState).toBe('string');
    expect(typeof savedState.messageHistory).toBe('object');
    expect(typeof savedState.timestamp).toBe('number');
  });
});
