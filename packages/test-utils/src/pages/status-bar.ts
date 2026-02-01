/**
 * Page object for phone-status-bar component
 *
 * Provides methods for reading status bar values like time and battery.
 */
import { Page, Locator } from '@playwright/test';

export class StatusBar {
  readonly page: Page;
  readonly container: Locator;
  readonly time: Locator;
  readonly batteryPercent: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('phone-status-bar');
    this.time = this.container.locator('.time');
    this.batteryPercent = this.container.locator('.battery-percent');
  }

  async getTime(): Promise<string> {
    return (await this.time.textContent()) || '';
  }

  async getBattery(): Promise<number> {
    const text = await this.batteryPercent.textContent();
    return Number.parseInt(text?.replace('%', '') || '0', 10);
  }

  async isVisible(): Promise<boolean> {
    return this.container.isVisible();
  }
}
