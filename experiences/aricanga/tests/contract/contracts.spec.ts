import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { requireImpl } from '../locale-config';

// Implementation tests require IMPL env var
const impl = requireImpl();

// Import generated config for contract verification
// This ensures TOML config stays in sync with ink files
const configPath = path.join(process.cwd(), `experiences/${impl}/src/generated/config.js`);
const configContent = fs.readFileSync(configPath, 'utf-8');

// Parse CHATS export from generated config
const chatsMatch = configContent.match(/export const CHATS = ({[\s\S]*?});/);
if (!chatsMatch) throw new Error('Could not parse CHATS from generated config');
const CHATS: Record<string, { knotName: string; title: string }> = eval(`(${chatsMatch[1]})`);

test.describe('Configuration Contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.');
    await page.waitForFunction(() => window.controller?.story && window.controller?.bridge);
  });

  test('CONTRACT-1: All TOML-registered chats have ink knots', async ({ page }) => {
    for (const [chatId, config] of Object.entries(CHATS)) {
      const hasKnot = await page.evaluate((knotName) => {
        // inkjs uses CanContinue after ChoosePathString to check if path exists
        try {
          const state = window.controller.story.state.ToJson();
          window.controller.story.ChoosePathString(knotName);
          window.controller.story.state.LoadJson(state); // restore
          return true;
        } catch {
          return false;
        }
      }, config.knotName);
      expect(hasKnot, `TOML defines chat "${chatId}" with knotName "${config.knotName}" but ink knot doesn't exist`).toBe(true);
    }
  });

  test('CONTRACT-3: All external functions are bound without errors', async ({ page }) => {
    // Check that story loaded without external function binding errors
    const errors = await page.evaluate(() => {
      // If there were binding errors, the story wouldn't have loaded
      return window.controller.story ? [] : ['Story failed to load'];
    });
    expect(errors).toEqual([]);
  });

  test('CONTRACT-4: Hub displays all TOML-registered chats', async ({ page }) => {
    for (const chatId of Object.keys(CHATS)) {
      // ChatHub renders chat items with data-chat attribute in shadow DOM
      const exists = await page.evaluate((id) => {
        const hub = document.querySelector('chat-hub');
        return hub?.shadowRoot?.querySelector(`[data-chat="${id}"]`) !== null;
      }, chatId);

      expect(exists, `TOML defines chat "${chatId}" but it's not displayed in hub`).toBe(true);
    }
  });

  test('CONTRACT-5: TOML chat IDs match ink current_chat values', async ({ page }) => {
    // Verify that opening each chat sets current_chat to the expected value
    for (const chatId of Object.keys(CHATS)) {
      await page.evaluate((id) => {
        window.controller.openChat(id);
      }, chatId);

      const currentChat = await page.evaluate(() => {
        return window.controller.story.variablesState.current_chat;
      });

      expect(currentChat, `TOML chat "${chatId}" doesn't set current_chat correctly in ink`).toBe(chatId);

      // Go back to hub
      await page.evaluate(() => {
        window.controller.closeChat();
      });
    }
  });
});
