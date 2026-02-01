/**
 * Page object for chat-thread component
 *
 * Provides methods for interacting with the conversation view,
 * including waiting for messages, selecting choices, and navigation.
 */
import { Page, Locator, expect } from '@playwright/test';

export class ChatThread {
  readonly page: Page;
  readonly container: Locator;
  readonly messages: Locator;
  readonly choices: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('chat-thread');
    // Access shadow DOM elements (may be nested in sub-components)
    this.messages = this.container.locator('.message');
    // Choices may be in chat-thread directly or in choice-buttons sub-component
    this.choices = this.container.locator('choice-buttons .choice, .choices .choice');
    // Back button may be in chat-header sub-component
    this.backButton = this.container.locator('chat-header .back-button, .back-button');
  }

  async waitForMessage(text: string, timeout = 10000) {
    await expect(
      this.container.locator('.message', { hasText: text })
    ).toBeVisible({ timeout });
  }

  async waitForMessageCount(count: number, timeout = 10000) {
    await expect(this.messages).toHaveCount(count, { timeout });
  }

  async selectChoice(text: string) {
    const choice = this.choices.filter({ hasText: text });
    await choice.click();
  }

  async selectChoiceByIndex(index: number) {
    await this.choices.nth(index).click();
  }

  async getLastMessage(): Promise<{ text: string; type: string }> {
    const last = this.messages.last();
    return {
      text: (await last.textContent()) || '',
      type: (await last.getAttribute('data-type')) || 'unknown',
    };
  }

  /**
   * Navigate back to the chat hub.
   * Note: If a notification popup is blocking, dismiss it first using
   * notification.dismiss() before calling this method.
   */
  async goBack() {
    await this.backButton.click();
    await this.page.waitForSelector('chat-hub:not([hidden])');
  }

  async getMessageTypes(): Promise<string[]> {
    const types: string[] = [];
    const count = await this.messages.count();
    for (let i = 0; i < count; i++) {
      const type = await this.messages.nth(i).getAttribute('data-type');
      types.push(type || 'unknown');
    }
    return types;
  }

  async getMessageCount(): Promise<number> {
    return this.messages.count();
  }

  async hasChoices(): Promise<boolean> {
    return (await this.choices.count()) > 0;
  }

  async isVisible(): Promise<boolean> {
    return this.container.isVisible();
  }

  /**
   * Check if typing indicator is visible
   * @returns Promise resolving to true if typing indicator is visible
   */
  async isTypingIndicatorVisible(): Promise<boolean> {
    return this.page.evaluate(() => {
      const thread = document.querySelector('chat-thread');
      const indicator = thread?.shadowRoot?.querySelector('typing-indicator');
      return indicator ? !indicator.hidden : false;
    });
  }

  /**
   * Wait for typing indicator to appear
   * @param timeout Max time to wait in ms
   */
  async waitForTypingIndicator(timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const thread = document.querySelector('chat-thread');
        const indicator = thread?.shadowRoot?.querySelector('typing-indicator');
        return indicator && !indicator.hidden;
      },
      { timeout }
    );
  }

  /**
   * Wait for typing indicator to disappear
   * @param timeout Max time to wait in ms
   */
  async waitForTypingIndicatorHidden(timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const thread = document.querySelector('chat-thread');
        const indicator = thread?.shadowRoot?.querySelector('typing-indicator');
        return !indicator || indicator.hidden;
      },
      { timeout }
    );
  }

  /**
   * Wait for the story state machine to reach a stable state.
   * This ensures all messages are rendered and pending alerts are emitted.
   * Use this instead of brittle DOM element counting or arbitrary timeouts.
   * @param timeout Max time to wait in ms (default 25000 to accommodate long delay chains)
   */
  async waitForStorySettlement(timeout = 25000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const controller = (window as any).controller;
        const snapshot = controller?.actor?.getSnapshot?.();
        return snapshot?.matches?.('idle') || snapshot?.matches?.('waitingForInput');
      },
      { timeout }
    );
  }
}
