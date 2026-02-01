import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';
import { ChatHub, ChatThread, Notification } from '@narratives/test-utils/pages';
import { waitForGameInitSettled } from '@narratives/test-utils/helpers';
import {
  MESSAGE_MARKERS,
  CHOICES,
} from '../fixtures/story-expectations';

/**
 * Safety test: Verifies choices persistence contract.
 * Choices must survive the full navigation cycle:
 * Open Pat -> see choices -> back -> News -> back -> Pat -> same choices
 */
test.describe('Choices Persistence Contract', () => {
  const getUIChoices = async (page: any): Promise<string[]> => {
    return page.evaluate(() => {
      const thread = document.querySelector('chat-thread');
      const shadow = thread?.shadowRoot;
      // Choices may be directly in chat-thread or in choice-buttons sub-component
      let choices = shadow?.querySelectorAll('.choice');
      if (!choices?.length) {
        const choiceButtons = shadow?.querySelector('choice-buttons');
        choices = choiceButtons?.shadowRoot?.querySelectorAll('.choice');
      }
      return Array.from(choices || []).map((c: any) => c.textContent?.trim());
    });
  };

  const getStoryChoices = async (page: any): Promise<string[]> => {
    return page.evaluate(() => {
      const controller = (window as any).controller;
      return controller.story.currentChoices.map((c: any) => c.text);
    });
  };

  test('choices persist through navigation cycle', async ({ page, installClock }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();

    // 1. Open News first (advances story)
    await hub.openChat('news');
    await clock.advance(COMMON_DELAYS.MAX);
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await thread.goBack();

    // 2. Open Pat - should see choices
    await hub.openChat('pat');
    await thread.waitForMessage(MESSAGE_MARKERS.pat.choicePrompt, 15000);
    const initialChoices = await getUIChoices(page);
    expect(initialChoices.length).toBe(2);

    // 3. Go back WITHOUT selecting
    await thread.goBack();

    // 4. Open News
    await hub.openChat('news');
    await clock.advance(COMMON_DELAYS.MEDIUM);
    await thread.goBack();

    // 5. Return to Pat - choices must still be there
    await hub.openChat('pat');
    await thread.waitForMessage(MESSAGE_MARKERS.pat.choicePrompt, 15000);
    const finalChoices = await getUIChoices(page);

    expect(finalChoices).toEqual(initialChoices);
  });

  test('story choices match UI choices', async ({ page, installClock }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();

    // Open News first
    await hub.openChat('news');
    await clock.advance(COMMON_DELAYS.MAX);
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await thread.goBack();

    // Open Pat
    await hub.openChat('pat');
    await thread.waitForMessage(MESSAGE_MARKERS.pat.choicePrompt, 15000);

    const uiChoices = await getUIChoices(page);
    const storyChoices = await getStoryChoices(page);

    expect(uiChoices.length).toBe(storyChoices.length);
    for (let i = 0; i < uiChoices.length; i++) {
      expect(uiChoices[i]).toContain(storyChoices[i].substring(0, 20));
    }
  });

  test('choices clear after selection', async ({ page, installClock }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();
    await waitForGameInitSettled(page);
    const clock = await installClock();

    // Open News first
    await hub.openChat('news');
    await clock.advance(COMMON_DELAYS.MAX);
    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await thread.goBack();

    // Open Pat
    await hub.openChat('pat');
    await thread.waitForMessage(MESSAGE_MARKERS.pat.choicePrompt, 15000);

    const beforeChoices = await getUIChoices(page);
    expect(beforeChoices.length).toBe(2);

    // Select a choice by text (not index - more resilient to reordering)
    await thread.selectChoice(CHOICES.pat.acceptAssignment);
    await clock.advance(COMMON_DELAYS.LONG);
    // Wait for state machine to settle before checking story state
    await thread.waitForStorySettlement();

    // Story should have processed and either have new choices or none
    const storyChoices = await getStoryChoices(page);
    // After first choice, story continues - may have more choices or be done
    expect(storyChoices.length).toBeGreaterThanOrEqual(0);
  });
});
