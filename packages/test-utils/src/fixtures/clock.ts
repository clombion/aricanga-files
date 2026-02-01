// tests/fixtures/clock.ts
// Playwright clock mocking fixtures for faster test execution
// Use these helpers to fast-forward through delay_next() timeouts

import { test as base, Page } from '@playwright/test';

/**
 * Extended test fixture with clock control helpers
 */
export const test = base.extend<{
  /**
   * Install fake timers and return control functions
   * Call at start of test to mock setTimeout/setInterval
   */
  installClock: () => Promise<ClockController>;
}>({
  installClock: async ({ page }, use) => {
    let installed = false;

    const install = async (): Promise<ClockController> => {
      if (installed) {
        throw new Error('Clock already installed');
      }
      await page.clock.install();
      installed = true;

      return {
        /**
         * Advance time and wait for DOM to settle
         * @param ms Milliseconds to advance
         * @param settleMs Optional settle time (default 50ms)
         */
        async advance(ms: number, settleMs = 50): Promise<void> {
          await page.clock.fastForward(ms);
          // Give the DOM time to update after timers fire
          await page.waitForTimeout(settleMs);
        },

        /**
         * Advance time without waiting for settle
         * Use when you need precise control
         */
        async fastForward(ms: number): Promise<void> {
          await page.clock.fastForward(ms);
        },

        /**
         * Run pending timers without advancing clock
         */
        async runMicrotasks(): Promise<void> {
          await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
        },

        /**
         * Pause at a specific timestamp
         */
        async pauseAt(timestamp: number): Promise<void> {
          await page.clock.pauseAt(timestamp);
        },

        /**
         * Resume real-time clock
         */
        async resume(): Promise<void> {
          await page.clock.resume();
        },
      };
    };

    await use(install);

    // Cleanup: Playwright automatically handles clock restoration
  },
});

/**
 * Clock controller interface returned by installClock()
 */
export interface ClockController {
  advance(ms: number, settleMs?: number): Promise<void>;
  fastForward(ms: number): Promise<void>;
  runMicrotasks(): Promise<void>;
  pauseAt(timestamp: number): Promise<void>;
  resume(): Promise<void>;
}

/**
 * Helper to run a test with mocked clock
 * Automatically installs and provides clock controller
 */
export async function withMockedClock(
  page: Page,
  fn: (clock: ClockController) => Promise<void>
): Promise<void> {
  await page.clock.install();

  const clock: ClockController = {
    async advance(ms: number, settleMs = 50): Promise<void> {
      await page.clock.fastForward(ms);
      await page.waitForTimeout(settleMs);
    },
    async fastForward(ms: number): Promise<void> {
      await page.clock.fastForward(ms);
    },
    async runMicrotasks(): Promise<void> {
      await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    },
    async pauseAt(timestamp: number): Promise<void> {
      await page.clock.pauseAt(timestamp);
    },
    async resume(): Promise<void> {
      await page.clock.resume();
    },
  };

  try {
    await fn(clock);
  } finally {
    // Clock is automatically restored by Playwright
  }
}

/**
 * Common delay values used in the game (from delay_next() calls)
 */
export const COMMON_DELAYS = {
  SHORT: 400,      // Quick responses
  MEDIUM: 800,     // Normal typing delay
  LONG: 1200,      // Thinking pause
  VERY_LONG: 2500, // Extended pause (e.g., reviewing draft)
  MAX: 4000,       // Maximum delay used
} as const;

/**
 * Calculate total delay for a sequence of messages
 * Useful for knowing how much to advance
 */
export function sumDelays(...delays: number[]): number {
  return delays.reduce((sum, d) => sum + d, 0);
}

// Re-export expect for convenience
export { expect } from '@playwright/test';
