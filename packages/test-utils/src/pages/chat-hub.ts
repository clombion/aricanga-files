/**
 * Page object for chat-hub component
 *
 * Provides methods for navigating to the app, selecting chats,
 * and checking unread indicators.
 */
import { Page, Locator } from '@playwright/test';

export class ChatHub {
  readonly page: Page;
  readonly container: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('chat-hub');
  }

  async goto() {
    // Clear localStorage before app fully initializes to avoid race conditions
    await this.page.addInitScript(() => localStorage.clear());
    await this.page.goto('.');
    // App shows lock screen first - unlock it by clicking fingerprint button.
    // Wait for either lock screen or hub to appear (hub shows if lock screen is disabled).
    const lockScreen = this.page.locator('lock-screen:not([hidden])');
    const hub = this.page.locator('chat-hub:not([hidden])');
    const first = await Promise.race([
      lockScreen.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'lock' as const),
      hub.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'hub' as const),
    ]);
    if (first === 'lock') {
      await lockScreen.locator('.fingerprint-btn').click();
      await hub.waitFor({ state: 'visible' });
    }
  }

  chatItem(chatId: string): Locator {
    return this.container.locator(`[data-chat="${chatId}"]`);
  }

  chatItemBtn(chatId: string): Locator {
    return this.chatItem(chatId).locator('.chat-item-btn');
  }

  async openChat(chatId: string) {
    await this.chatItemBtn(chatId).click();
    await this.page.waitForSelector('chat-thread:not([hidden])');
    // Wait for hub to be hidden (view transition complete)
    await this.container.waitFor({ state: 'hidden' });
  }

  async getUnreadCount(chatId: string): Promise<number> {
    const badge = this.chatItem(chatId).locator('.unread-badge:not([hidden])');
    if (await badge.isVisible()) {
      const text = await badge.textContent();
      return text ? parseInt(text, 10) || 1 : 1;
    }
    return 0;
  }

  async hasUnreadIndicator(chatId: string): Promise<boolean> {
    const badge = this.chatItem(chatId).locator('.unread-badge:not([hidden])');
    return badge.isVisible();
  }

  async isVisible(): Promise<boolean> {
    return this.container.isVisible();
  }

  /**
   * Get the preview text for a chat
   */
  async getPreviewText(chatId: string): Promise<string> {
    const preview = this.chatItem(chatId).locator('.preview');
    return preview.textContent() ?? '';
  }

  /**
   * Check if the read receipt icon is visible in the preview
   */
  async hasPreviewReceipt(chatId: string): Promise<boolean> {
    const receipt = this.chatItem(chatId).locator('.preview-receipt:not([hidden])');
    return receipt.isVisible();
  }
}
