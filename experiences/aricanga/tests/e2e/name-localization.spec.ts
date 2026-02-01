/**
 * Name Localization E2E Tests
 *
 * Validates that the name() external ink function correctly resolves
 * entity and character names at runtime in the rendered messages.
 */
import { test, expect } from '@playwright/test';
import { ChatHub, ChatThread } from '@narratives/test-utils/pages';
import {
  MESSAGE_MARKERS,
  ENTITY_NAMES,
  CHARACTER_NAMES,
} from '../fixtures/story-expectations';

test.describe('Name Localization', () => {
  test('name() resolves entity names in news messages', async ({ page }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();
    await hub.openChat('news');

    // Wait for message containing resolved entity name
    // Ink source uses {name("aricanga", "short")} which should resolve to "Aricanga"
    await thread.waitForMessage(MESSAGE_MARKERS.news.hasAricanga);

    // Verify raw function call is not visible in rendered content
    const messageText = await page.evaluate(() => {
      const threadEl = document.querySelector('chat-thread');
      return threadEl?.shadowRoot?.querySelector('.messages')?.textContent || '';
    });

    expect(messageText).not.toContain('name(');
    expect(messageText).not.toContain('{name');
    // Verify resolved name appears (from generated expectations)
    expect(messageText).toContain(ENTITY_NAMES.aricanga.short);
  });

  test('name() resolves character names in activist chat', async ({ page }) => {
    const hub = new ChatHub(page);
    const thread = new ChatThread(page);

    await hub.goto();
    await hub.openChat('activist');

    // Activist chat uses {name("activist", "first_name")} -> resolved name
    // Wait for the intro message which contains the activist's name
    await thread.waitForMessage(MESSAGE_MARKERS.activist.intro, 15000);

    // Verify the chat header shows the resolved character name as the speaker
    const speakerName = await page.evaluate(() => {
      const threadEl = document.querySelector('chat-thread');
      const header = threadEl?.shadowRoot?.querySelector('chat-header');
      return header?.shadowRoot?.querySelector('.title')?.textContent?.trim() || '';
    });

    // Speaker name should be the resolved first_name from generated expectations
    expect(speakerName).toContain(CHARACTER_NAMES.activist.first_name);

    // Verify raw function syntax not visible in messages
    const messageText = await page.evaluate(() => {
      const threadEl = document.querySelector('chat-thread');
      return threadEl?.shadowRoot?.querySelector('.messages')?.textContent || '';
    });
    expect(messageText).not.toContain('"activist"');
    expect(messageText).not.toContain('name(');
  });

  test('locale JSON contains baseNames structure matching config', async ({
    page,
  }) => {
    // Navigate to app first, then fetch locale JSON
    await page.goto('.');

    const enJson = await page.evaluate(async () => {
      const response = await fetch('./src/dist/locales/en.json');
      return response.json();
    });

    // Verify baseNames structure exists with expected entities
    // Values should match our generated expectations (derived from same TOML)
    expect(enJson.baseNames).toBeDefined();
    expect(enJson.baseNames.aricanga).toBeDefined();
    expect(enJson.baseNames.aricanga.short).toBe(ENTITY_NAMES.aricanga.short);
    expect(enJson.baseNames.aricanga.name).toBe(ENTITY_NAMES.aricanga.name);

    // Verify character names match generated expectations
    expect(enJson.baseNames.activist).toBeDefined();
    expect(enJson.baseNames.activist.first_name).toBe(
      CHARACTER_NAMES.activist.first_name
    );
    expect(enJson.baseNames.activist.formal).toBe(
      CHARACTER_NAMES.activist.formal
    );

    // Verify Ministry (skip_localization entity)
    expect(enJson.baseNames.ministry).toBeDefined();
    expect(enJson.baseNames.ministry.short).toBe(ENTITY_NAMES.ministry.short);
  });
});
