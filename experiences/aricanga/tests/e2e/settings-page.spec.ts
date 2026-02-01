/**
 * Settings Page E2E Tests
 *
 * Tests navigation flow: hub → notification drawer → settings → back to hub
 * Tests language selector display
 */

import { test, expect } from '@narratives/test-utils/fixtures';
import { unlockLockScreen, waitForGameInitSettled } from '@narratives/test-utils/helpers';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('.');
    await unlockLockScreen(page);
    await waitForGameInitSettled(page);
  });

  test('opens settings from notification drawer', async ({ page }) => {
    // Open notification drawer by clicking on status bar badge area
    await page.locator('phone-status-bar').click();

    // Click settings tile
    await page.locator('[data-testid="settings-tile"]').click();

    // Settings page should be visible
    await expect(page.locator('settings-page')).toBeVisible();

    // Hub should be hidden
    await expect(page.locator('chat-hub')).toBeHidden();
  });

  test('back button returns to hub', async ({ page }) => {
    // Navigate to settings
    await page.locator('phone-status-bar').click();
    await page.locator('[data-testid="settings-tile"]').click();
    await expect(page.locator('settings-page')).toBeVisible();

    // Click back button
    await page.locator('[data-testid="settings-back"]').click();

    // Hub should be visible again
    await expect(page.locator('chat-hub')).toBeVisible();

    // Settings page should be hidden
    await expect(page.locator('settings-page')).toBeHidden();
  });

  test('displays available locales', async ({ page }) => {
    // Navigate to settings
    await page.locator('phone-status-bar').click();
    await page.locator('[data-testid="settings-tile"]').click();

    // Should show English and French options
    await expect(page.locator('[data-locale="en"]')).toBeVisible();
    await expect(page.locator('[data-locale="fr"]')).toBeVisible();
  });

  test('current locale is highlighted', async ({ page }) => {
    // Navigate to settings
    await page.locator('phone-status-bar').click();
    await page.locator('[data-testid="settings-tile"]').click();

    // English should be active (default locale)
    const enOption = page.locator('[data-locale="en"]');
    await expect(enOption).toHaveClass(/active/);

    // French should not be active
    const frOption = page.locator('[data-locale="fr"]');
    await expect(frOption).not.toHaveClass(/active/);
  });

  test('shows version number', async ({ page }) => {
    // Navigate to settings
    await page.locator('phone-status-bar').click();
    await page.locator('[data-testid="settings-tile"]').click();

    // Should display version from config
    await expect(page.locator('settings-page')).toContainText('0.1.0');
  });

  test('clicking locale option updates selection', async ({ page }) => {
    // Navigate to settings
    await page.locator('phone-status-bar').click();
    await page.locator('[data-testid="settings-tile"]').click();

    // English should be active initially
    await expect(page.locator('[data-locale="en"]')).toHaveClass(/active/);

    // Click French
    await page.locator('[data-locale="fr"]').click();

    // French should now be active
    await expect(page.locator('[data-locale="fr"]')).toHaveClass(/active/);
    // English should no longer be active
    await expect(page.locator('[data-locale="en"]')).not.toHaveClass(/active/);
  });

  test('clicking motion option updates selection', async ({ page }) => {
    // Navigate to settings
    await page.locator('phone-status-bar').click();
    await page.locator('[data-testid="settings-tile"]').click();

    // Full should be active initially (default)
    const fullOption = page.locator('[data-level="full"]');
    const reducedOption = page.locator('[data-level="reduced"]');
    await expect(fullOption).toHaveClass(/active/);

    // Click Reduced
    await reducedOption.click();

    // Reduced should now be active
    await expect(reducedOption).toHaveClass(/active/);
    // Full should no longer be active
    await expect(fullOption).not.toHaveClass(/active/);
  });
});
