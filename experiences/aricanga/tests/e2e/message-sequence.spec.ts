import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub, ChatThread, Notification } from '@narratives/test-utils/pages';
import { waitForGameInitSettled } from '@narratives/test-utils/helpers';
import { MESSAGE_MARKERS, NOTIFICATIONS } from '../fixtures/story-expectations';

/**
 * Safety test: Tracks message-added events and verifies:
 * 1. No duplicate message IDs are emitted
 * 2. Messages arrive in order
 * 3. Messages route to correct chat
 */
test.describe('Message Emission Sequence', () => {
  test('no duplicate message emissions during navigation', async ({ page, installClock }) => {
    const chatHub = new ChatHub(page);
    const chatThread = new ChatThread(page);
    const notification = new Notification(page);
    const emissions: { chatId: string; msgId: string; text: string }[] = [];

    await page.exposeFunction('trackEmission', (chatId: string, msgId: string, text: string) => {
      emissions.push({ chatId, msgId, text });
    });

    await chatHub.goto();
    await waitForGameInitSettled(page);

    // Install clock for fast-forwarding delays
    const clock = await installClock();

    // Inject tracking before any chat opens
    await page.evaluate(() => {
      const controller = (window as any).controller;
      controller.addEventListener('message-added', (e: any) => {
        (window as any).trackEmission(
          e.detail.chatId,
          e.detail.message.id,
          e.detail.message.text?.substring(0, 30)
        );
      });
    });

    // Open News
    await chatHub.chatItemBtn('news').click();
    await clock.advance(COMMON_DELAYS.MAX);

    // Go back (goBack includes waitForSelector for hub)
    await chatThread.goBack();

    // Open Pat
    await chatHub.chatItemBtn('pat').click();
    await clock.advance(COMMON_DELAYS.MAX);

    // Go back
    await chatThread.goBack();

    // Open News again
    await chatHub.chatItemBtn('news').click();
    await clock.advance(COMMON_DELAYS.LONG);

    // Go back
    await chatThread.goBack();

    // Open Pat again
    await chatHub.chatItemBtn('pat').click();
    await clock.advance(COMMON_DELAYS.LONG);

    // Check for duplicates
    const messageIds = emissions.map(e => e.msgId);
    const uniqueIds = new Set(messageIds);

    expect(messageIds.length).toBe(uniqueIds.size);

    // Verify news messages routed to news
    const newsEmissions = emissions.filter(e => e.chatId === 'news');
    expect(newsEmissions.length).toBeGreaterThan(0);

    // Verify pat messages routed to pat
    const patEmissions = emissions.filter(e => e.chatId === 'pat');
    expect(patEmissions.length).toBeGreaterThan(0);
  });

  /**
   * INTENT: Verify that story continuation after opening a chat emits
   * message-added events for new (non-seed) content, starting with OFFICIAL.
   *
   * ASSUMPTION: Seeds are pre-computed at build time and pre-rendered on page
   * load. When a chat is opened, story content after `# story_start` generates
   * message-added events. The first message (OFFICIAL) emits synchronously -
   * requires addInitScript to capture it before page.evaluate() can run.
   *
   * BREAKS if:
   * - Story continuation stops emitting message-added events
   * - All news content becomes seeds (no post-story_start content)
   * - First message after story_start gains a delay (would change timing)
   */
  test('messages emit in correct order', async ({ page, installClock }) => {
    const chatHub = new ChatHub(page);
    const emissions: string[] = [];

    // Expose tracking function BEFORE page load
    await page.exposeFunction('trackText', (text: string) => {
      emissions.push(text);
    });

    // Install listener via addInitScript - runs before any page JS
    // This catches synchronously-emitted messages that page.evaluate() misses
    await page.addInitScript(() => {
      // Queue listener attachment - controller doesn't exist yet
      const observer = new MutationObserver(() => {
        const controller = (window as any).controller;
        if (controller && !(window as any)._messageListenerAttached) {
          (window as any)._messageListenerAttached = true;
          controller.addEventListener('message-added', (e: any) => {
            (window as any).trackText(e.detail.message.text?.substring(0, 50));
          });
          observer.disconnect();
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });

    // Navigate - this triggers seed pre-rendering (no events yet)
    await chatHub.goto();

    // Install clock for fast-forwarding delays
    const clock = await installClock();

    // Wait for controller and listener to be ready
    await page.waitForFunction(() => (window as any)._messageListenerAttached);

    // Open News - this triggers story continuation from # story_start
    await chatHub.chatItemBtn('news').click();
    await clock.advance(COMMON_DELAYS.MAX);

    // Verify we received message-added events from story continuation
    expect(emissions.length).toBeGreaterThan(0);

    // First emission should be the OFFICIAL message
    expect(emissions[0]).toContain(MESSAGE_MARKERS.news.first);

    // Should also have subsequent messages
    expect(emissions.length).toBeGreaterThanOrEqual(2);
  });
});
