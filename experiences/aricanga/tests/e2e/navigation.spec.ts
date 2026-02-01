// tests/navigation.spec.ts
import { test, expect } from '@playwright/test';
import { ChatHub, ChatThread } from '@narratives/test-utils/pages';
import {
  MESSAGE_MARKERS,
  STORY_FLOW,
} from '../fixtures/story-expectations';

test.describe('Navigation', () => {
  test('can open chat from hub', async ({ page }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();
    expect(await hub.isVisible()).toBe(true);

    await hub.openChat(STORY_FLOW.entryChat);
    expect(await thread.isVisible()).toBe(true);
    expect(await hub.isVisible()).toBe(false);
  });

  test('can return to hub from chat', async ({ page }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();
    await hub.openChat(STORY_FLOW.entryChat);
    await thread.goBack();

    expect(await hub.isVisible()).toBe(true);
    expect(await thread.isVisible()).toBe(false);
  });

  test('news chat shows initial messages', async ({ page }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();
    await hub.openChat('news');
    await thread.waitForStorySettlement();

    await thread.waitForMessage(MESSAGE_MARKERS.news.first);
    await thread.waitForMessage(MESSAGE_MARKERS.news.hasAricanga);
  });
});
