/**
 * Page object for notification-popup and notification-drawer components
 *
 * Provides methods for interacting with popup notifications and the
 * notification drawer, including waiting, dismissing, and clicking.
 */
import { Page, Locator, expect } from '@playwright/test';
import { ClockController, COMMON_DELAYS } from '../fixtures/clock';

export class Notification {
  readonly page: Page;
  readonly popup: Locator;
  readonly drawer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.popup = page.locator('notification-popup .popup.show');
    this.drawer = page.locator('notification-drawer');
  }

  async waitForNotification(senderText: string, timeout = 10000) {
    await expect(
      this.popup.filter({ hasText: senderText })
    ).toBeVisible({ timeout });
  }

  async waitForNoNotification(timeout = 2000) {
    await expect(this.popup).not.toBeVisible({ timeout });
  }

  async clickNotification() {
    await this.popup.click();
  }

  async getSender(): Promise<string> {
    return (await this.popup.locator('.sender').textContent()) || '';
  }

  async getPreview(): Promise<string> {
    return (await this.popup.locator('.preview').textContent()) || '';
  }

  /**
   * Wait for notification to auto-dismiss.
   * WARNING: Does not work with fake clocks - use dismissAndSettle() instead.
   */
  async dismissByWaiting(ms = 5500) {
    await expect(this.popup).not.toBeVisible({ timeout: ms + 1000 });
  }

  /**
   * Dismiss notification by clicking dismiss button.
   * Waits for popup to actually disappear before returning.
   */
  async dismiss() {
    const isVisible = await this.popup.isVisible();
    if (isVisible) {
      await this.page.evaluate(() => {
        const popup = document.querySelector('notification-popup');
        popup?.shadowRoot?.querySelector('.dismiss-btn')?.dispatchEvent(new Event('click', { bubbles: true }));
      });
      // Wait for actual state change instead of arbitrary timeout
      await expect(this.popup).not.toBeVisible({ timeout: 1000 });
    }
  }

  async dismissIfVisible() {
    try {
      await this.dismiss();
    } catch {
      // No notification to dismiss
    }
  }

  async isVisible(): Promise<boolean> {
    return this.popup.isVisible();
  }

  // Drawer methods
  async openDrawer() {
    await this.page.evaluate(() => {
      const drawer = document.querySelector('notification-drawer') as any;
      drawer?.open();
    });
    // Wait for drawer to actually open
    await this.page.waitForFunction(() => {
      const drawer = document.querySelector('notification-drawer') as any;
      return drawer?._isOpen === true;
    }, { timeout: 1000 });
  }

  async getDrawerCount(): Promise<number> {
    return this.page.evaluate(() => {
      const drawer = document.querySelector('notification-drawer') as any;
      return drawer?.count || 0;
    });
  }

  async clickDrawerNotification(index = 0) {
    await this.page.evaluate((idx) => {
      const drawer = document.querySelector('notification-drawer');
      const btn = drawer?.shadowRoot?.querySelectorAll('.notification-card-btn')[idx];
      (btn as HTMLElement)?.click();
    }, index);
  }

  async isDrawerOpen(): Promise<boolean> {
    return this.page.evaluate(() => {
      const drawer = document.querySelector('notification-drawer') as any;
      return drawer?._isOpen || false;
    });
  }

  /**
   * Clear all notifications from the drawer.
   * Useful in test setup to ensure a clean state.
   */
  async clearDrawer(): Promise<void> {
    await this.page.evaluate(() => {
      const drawer = document.querySelector('notification-drawer') as any;
      drawer?.clearAll();
    });
  }

  /**
   * Dismiss the current notification and advance the clock to settle.
   * This replaces the common 7-line pattern of evaluate + clock.advance.
   * Assumes notification is already visible (call waitForNotification first if needed).
   * @param clock The clock controller from installClock fixture
   */
  async dismissAndSettle(clock: ClockController): Promise<void> {
    await this.page.evaluate(() => {
      const popup = document.querySelector('notification-popup');
      const dismissBtn = popup?.shadowRoot?.querySelector('.dismiss-btn');
      if (dismissBtn) {
        dismissBtn.dispatchEvent(new Event('click', { bubbles: true }));
      }
    });
    await clock.advance(COMMON_DELAYS.SHORT);
  }
}
