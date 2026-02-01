/**
 * App-level test utilities
 */
import type { Page } from '@playwright/test';

/**
 * Unlock the lock screen if it's visible.
 * The app shows a lock screen on startup that needs to be dismissed
 * before the chat hub becomes visible.
 *
 * Waits for the controller to be ready before dismissing, since clicking
 * the lock screen before initialization can leave the app in limbo.
 */
export async function unlockLockScreen(page: Page): Promise<void> {
  const lockScreen = page.locator('lock-screen:not([hidden])');
  const hub = page.locator('chat-hub:not([hidden])');

  const result = await Promise.race([
    lockScreen.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'lock' as const),
    hub.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'hub' as const),
  ]);

  if (result === 'lock') {
    // Wait for controller to exist before dismissing lock screen
    await page.waitForFunction(
      () => !!(window as any).controller?.actor,
      { timeout: 15000 },
    );
    await lockScreen.locator('.fingerprint-btn').click({ force: true });
    await hub.waitFor({ state: 'visible', timeout: 15000 });
  }
}

/**
 * Wait for game_init to fully settle (all delayed messages delivered).
 * game_init sends a cross-chat message with delay_next(3000). Since this
 * timeout fires before installClock can intercept it, tests must wait for
 * real time to pass before fake timers become reliable.
 */
export async function waitForGameInitSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const controller = (window as any).controller;
    const snapshot = controller?.actor?.getSnapshot?.();
    return snapshot?.context?.bufferedMessage === null && snapshot?.context?.pendingDelay === 0;
  }, { timeout: 10000 });
}
