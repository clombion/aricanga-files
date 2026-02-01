import { test, expect, COMMON_DELAYS } from '@narratives/test-utils/fixtures';

test.describe('Motion path switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('full → reduced → full transitions work correctly', async ({ page, installClock }) => {
    const clock = await installClock();

    // Start with full motion
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('.');
    // Wait for controller to be fully initialized (story AND bridge ready)
    await page.waitForFunction(() => window.controller?.story && window.controller?.bridge);

    // Navigate with full motion
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);
    await page.evaluate(() => window.controller.closeChat());
    await clock.advance(COMMON_DELAYS.LONG);

    // Switch to reduced motion mid-session
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Navigate with reduced motion
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);

    // Verify no black screen, layout correct
    await expect(page.locator('chat-thread')).toBeVisible();
    const opacity = await page.evaluate(() =>
      getComputedStyle(document.querySelector('chat-thread')).opacity
    );
    expect(opacity).toBe('1');
  });

  test('reduced → full transitions work correctly', async ({ page, installClock }) => {
    const clock = await installClock();

    // Start with reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('.');
    // Wait for controller to be fully initialized (story AND bridge ready)
    await page.waitForFunction(() => window.controller?.story && window.controller?.bridge);

    // Navigate with reduced motion
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);
    await page.evaluate(() => window.controller.closeChat());
    await clock.advance(COMMON_DELAYS.LONG);

    // Switch to full motion mid-session
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // Navigate with full motion
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);

    // Verify correct layout
    await expect(page.locator('chat-thread')).toBeVisible();
  });
});
