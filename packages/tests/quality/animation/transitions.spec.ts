/**
 * Animation Invariant Tests
 *
 * Verifies animation cleanup and motion preference behavior.
 */
import { expect, test, COMMON_DELAYS } from '@narratives/test-utils/fixtures';

test.describe('Animation Invariants', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('.');
    await page.waitForFunction(
      () => window.controller?.story && window.controller?.bridge,
    );
  });

  test('ANI-1: No orphaned animations after view transitions', async ({
    page,
    installClock,
  }) => {
    const clock = await installClock();

    // Navigate to a chat (triggers view transition)
    await page.evaluate(() => window.controller.openChat('news'));
    await clock.advance(COMMON_DELAYS.LONG);

    // Get animation count on all view elements
    const orphanedAnimations = await page.evaluate(() => {
      const views = document.querySelectorAll(
        'chat-hub, chat-thread, settings-page',
      );
      return Array.from(views).reduce(
        (sum, el) => sum + el.getAnimations().length,
        0,
      );
    });

    expect(orphanedAnimations).toBe(0);
  });

  test('ANI-2: Settings UI reflects effective motion level with OS override', async ({
    page,
  }) => {
    // Emulate OS reduced motion preference BEFORE navigation
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Clear localStorage and reload with reduced motion preference active
    await page.addInitScript(() => localStorage.clear());
    await page.goto('.');
    await page.waitForFunction(
      () => window.controller?.story && window.controller?.bridge,
    );

    // Unlock lock screen if visible (same pattern as settings-page.spec.ts)
    const lockScreen = page.locator('lock-screen:not([hidden])');
    if (await lockScreen.isVisible({ timeout: 1000 }).catch(() => false)) {
      await lockScreen.locator('.fingerprint-btn').click();
    }

    // Wait for hub to be visible
    await expect(page.locator('chat-hub')).toBeVisible();

    // Navigate to settings via UI
    await page.locator('phone-status-bar').click();
    await page.locator('[data-testid="settings-tile"]').click();

    // Wait for settings page to be visible
    await expect(page.locator('settings-page')).toBeVisible();

    // Get the active (checkmarked) option and OS indicator location
    const uiState = await page.evaluate(() => {
      const settings = document.querySelector('settings-page');
      const active = settings?.shadowRoot?.querySelector('.motion-option.active');
      const indicatorBtn = settings?.shadowRoot?.querySelector('.motion-option:has(.os-indicator)');
      return {
        activeLevel: active?.getAttribute('data-level'),
        indicatorLevel: indicatorBtn?.getAttribute('data-level'),
      };
    });

    // Checkmark shows user's stored preference (default: 'full')
    // OS indicator appears on the effective level ('reduced') when OS overrides
    expect(uiState.activeLevel).toBe('full');
    expect(uiState.indicatorLevel).toBe('reduced');
  });

  test('ANI-3: Animation cleanup after multiple transitions', async ({
    page,
    installClock,
  }) => {
    const clock = await installClock();

    // Perform multiple navigation transitions
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.controller.openChat('news'));
      await clock.advance(COMMON_DELAYS.LONG);
      await page.evaluate(() => window.controller.closeChat());
      await clock.advance(COMMON_DELAYS.LONG);
    }

    // Verify no orphaned animations remain
    const orphanedAnimations = await page.evaluate(() => {
      const views = document.querySelectorAll(
        'chat-hub, chat-thread, settings-page',
      );
      return Array.from(views).reduce(
        (sum, el) => sum + el.getAnimations().length,
        0,
      );
    });

    expect(orphanedAnimations).toBe(0);
  });
});
