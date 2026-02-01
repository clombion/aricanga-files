// tests/system-messages.spec.ts
// E2E tests for system messages and chat types

import { test, expect } from '@playwright/test';
import { ChatHub, ChatThread } from '@narratives/test-utils/pages';
import { SYSTEM_MESSAGES, SPEAKERS } from '../fixtures/story-expectations';

// Test cases for system messages by chat type
const SYSTEM_MESSAGE_CASES = [
  { chatId: 'news', type: 'channel', expectedContains: [`official channel of ${SPEAKERS.news}`] },
  { chatId: 'pat', type: 'normal', expectedContains: ['Some messages may not be visible'] },
  { chatId: 'spectre', type: 'disappearing', expectedContains: ['Disappearing messages are on', '24 hours'] },
] as const;

// Test cases for input visibility by chat type
const INPUT_VISIBILITY_CASES = [
  { chatId: 'news', type: 'channel', hasInput: false, disabledContains: `Only ${SPEAKERS.news} can send messages` },
  { chatId: 'pat', type: 'normal', hasInput: true, disabledContains: null },
] as const;

test.describe('System Messages', () => {
  test('system messages appear with correct content for each chat type', async ({ page }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    await hub.goto();

    for (const { chatId, expectedContains } of SYSTEM_MESSAGE_CASES) {
      await hub.openChat(chatId);
      await thread.waitForStorySettlement();

      const systemMsg = await page.evaluate(() => {
        const thread = document.querySelector('chat-thread');
        const shadow = thread?.shadowRoot;
        // System message may be directly in chat-thread or in conversation-banner sub-component
        let sysMsg = shadow?.querySelector('.message.system');
        if (!sysMsg) {
          const banner = shadow?.querySelector('conversation-banner');
          sysMsg = banner?.shadowRoot?.querySelector('.message.system');
        }
        return {
          exists: !!sysMsg,
          text: sysMsg?.textContent?.trim() || '',
        };
      });

      expect(systemMsg.exists, `${chatId} should have system message`).toBe(true);
      for (const expected of expectedContains) {
        expect(systemMsg.text, `${chatId} system message`).toContain(expected);
      }

      // Go back to hub for next chat
      await thread.goBack();
    }
  });

  test('input visibility matches chat type', async ({ page }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);
    await hub.goto();

    for (const { chatId, hasInput, disabledContains } of INPUT_VISIBILITY_CASES) {
      await hub.openChat(chatId);
      await thread.waitForStorySettlement();

      const inputState = await page.evaluate(() => {
        const thread = document.querySelector('chat-thread');
        return {
          hasInputBar: !!thread?.shadowRoot?.querySelector('.input-bar'),
          hasDisabledMsg: !!thread?.shadowRoot?.querySelector('.input-disabled'),
          disabledText: thread?.shadowRoot?.querySelector('.input-disabled')?.textContent?.trim() || '',
        };
      });

      expect(inputState.hasInputBar, `${chatId} input bar`).toBe(hasInput);
      expect(inputState.hasDisabledMsg, `${chatId} disabled message`).toBe(!hasInput);

      if (disabledContains) {
        expect(inputState.disabledText, `${chatId} disabled text`).toContain(disabledContains);
      }

      // Go back to hub for next chat
      await thread.goBack();
    }
  });
});
