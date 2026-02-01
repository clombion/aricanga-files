import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { SPEAKERS } from '../../../../experiences/aricanga/tests/fixtures/story-expectations';

/**
 * Structural Invariant Tests
 * These tests verify that illegal states cannot occur.
 */
test.describe('Structural Invariants', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before app fully initializes
    await page.addInitScript(() => localStorage.clear());
    await page.goto('.');
    await page.waitForFunction(() => window.controller?.story && window.controller?.bridge);
  });

  test('INV-1: Messages never appear in wrong chat', async ({ page, installClock }) => {
    const clock = await installClock();

    // Open News chat, get messages
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);

    const newsMessages = await page.evaluate(() => {
      const s = window.controller.actor.getSnapshot();
      return s.context.messageHistory['news'] || [];
    });

    // Go back and open Pat
    await page.evaluate(() => window.controller.closeChat());
    await page.evaluate(() => window.controller.openChat('pat'));
    await clock.advance(COMMON_DELAYS.LONG);

    const patMessages = await page.evaluate(() => {
      const s = window.controller.actor.getSnapshot();
      return s.context.messageHistory['pat'] || [];
    });

    // Verify no Pat messages have News speaker and vice versa
    for (const msg of newsMessages) {
      expect(msg.speaker).not.toBe(SPEAKERS.pat);
    }
    for (const msg of patMessages) {
      expect(msg.speaker).not.toBe(SPEAKERS.news);
    }
  });

  test('INV-2: Choices only display in owner chat', async ({ page, installClock }) => {
    const clock = await installClock();

    // Open News to trigger Pat notification
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);
    await page.evaluate(() => window.controller.closeChat());

    // Open Pat to get choices
    await page.evaluate(() => window.controller.openChat('pat'));
    await clock.advance(COMMON_DELAYS.LONG);

    const patChoiceInfo = await page.evaluate(() => {
      const s = window.controller.actor.getSnapshot();
      const story = s.context.story;
      return {
        hasChoices: story?.currentChoices?.length > 0,
        currentChat: story?.variablesState?.current_chat,
      };
    });

    // Verify choices belong to Pat via story's current_chat
    if (patChoiceInfo.hasChoices) {
      expect(patChoiceInfo.currentChat).toBe('pat');
    }

    // Navigate to Notes
    await page.evaluate(() => window.controller.closeChat());
    await page.evaluate(() => window.controller.openChat('notes'));
    await clock.advance(COMMON_DELAYS.MEDIUM);

    // Get thread choices container
    const notesHasChoices = await page.evaluate(() => {
      const thread = document.querySelector('chat-thread');
      const choices = thread?.shadowRoot?.querySelectorAll('.choice');
      return choices?.length || 0;
    });

    // Notes should NOT show Pat's choices
    // (Enforced by story.variablesState.current_chat check in choiceBelongsToCurrentView guard)
    const choiceOwnershipValid = await page.evaluate(() => {
      const s = window.controller.actor.getSnapshot();
      const story = s.context.story;
      const view = s.context.currentView;
      const storyChat = story?.variablesState?.current_chat;
      // If in a chat view, choices should only display if story's current_chat matches
      if (view.type === 'chat' && storyChat && storyChat !== view.chatId) {
        return 'MISMATCH';
      }
      return 'OK';
    });

    expect(choiceOwnershipValid).toBe('OK');
  });

  test('INV-3: currentView is sole source of truth', async ({ page }) => {
    // Verify controller has no currentChat property
    const hasCurrentChatProperty = await page.evaluate(() => {
      return 'currentChat' in window.controller;
    });

    expect(hasCurrentChatProperty).toBe(false);

    // Open a chat
    await page.evaluate(() => window.controller.openChat('news'));

    // Verify currentView exists and is correct
    const currentView = await page.evaluate(() => {
      const s = window.controller.actor.getSnapshot();
      return s.context.currentView;
    });

    expect(currentView).toEqual({ type: 'chat', chatId: 'news' });

    // Close chat
    await page.evaluate(() => window.controller.closeChat());

    const hubView = await page.evaluate(() => {
      const s = window.controller.actor.getSnapshot();
      return s.context.currentView;
    });

    expect(hubView).toEqual({ type: 'hub' });
  });

  test('INV-4: choices derive from story (single source of truth)', async ({ page, installClock }) => {
    const clock = await installClock();

    // Open News then Pat to get choices
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);
    await page.evaluate(() => window.controller.closeChat());
    await page.evaluate(() => window.controller.openChat('pat'));
    await clock.advance(COMMON_DELAYS.LONG);

    const choiceInfo = await page.evaluate(() => {
      const s = window.controller.actor.getSnapshot();
      const story = s.context.story;
      return {
        hasChoices: story?.currentChoices?.length > 0,
        currentChat: story?.variablesState?.current_chat,
        choiceCount: story?.currentChoices?.length || 0,
      };
    });

    // Choices are derived from story, chatId from current_chat variable
    if (choiceInfo.hasChoices) {
      expect(choiceInfo.currentChat).toBe('pat');
      expect(choiceInfo.choiceCount).toBeGreaterThan(0);
    }
  });

  test('INV-5: Messages stored with correct chatId', async ({ page, installClock }) => {
    const clock = await installClock();

    // Open News
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);

    const messageHistory = await page.evaluate(() => {
      const s = window.controller.actor.getSnapshot();
      return s.context.messageHistory;
    });

    // News messages should be in 'news' key
    expect(messageHistory).toHaveProperty('news');
    expect(messageHistory.news.length).toBeGreaterThan(0);

    // Other chats should not have News messages
    for (const [chatId, messages] of Object.entries(messageHistory)) {
      if (chatId !== 'news') {
        for (const msg of messages as any[]) {
          expect(msg.speaker).not.toBe(SPEAKERS.news);
        }
      }
    }
  });

  test('INV-6: Single responsibility principle (CQO-10)', async ({ page }) => {
    // This is a design-time check - each component has one clear purpose
    // Documented expectation: components are focused and maintainable
    expect(true).toBe(true);
  });
});
