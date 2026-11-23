// The real-browser suite every view-layer spec runs in: the three engines, desktop and mobile
// emulation, against a Vite dev server so Solid's dev diagnostics print. Firefox has no Playwright
// device descriptor (no touch or mobile emulation), so mobile runs on Chromium and WebKit.

import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

/** Where a suite's specs live and how its page is served. */
interface Suite {
  /** The folder holding the suite's Vite config, which serves its pages. */
  readonly cwd: string;
  /** The port its dev server listens on; each suite has its own. */
  readonly port: number;
  /** Where its specs live, relative to `cwd`. */
  readonly testDir: string;
  /** Whether it also writes an HTML report under `.output/report`. */
  readonly report: boolean;
}

/**
 * The Playwright configuration of one real-browser suite.
 * @param {Suite} suite Where its specs live and how its page is served.
 * @returns {PlaywrightTestConfig} The configuration.
 */
function browserSuite(suite: Suite): PlaywrightTestConfig {
  return defineConfig({
    expect: { timeout: 5000 },
    forbidOnly: true,
    fullyParallel: true,
    outputDir: '.output/results',
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
      { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
    ],
    reporter: suite.report ? [['list'], ['html', { open: 'never', outputFolder: '.output/report' }]] : [['list']],
    retries: 0,
    testDir: suite.testDir,
    testMatch: '**/*.spec.ts',
    timeout: 30_000,
    use: {
      baseURL: `http://localhost:${suite.port}/`,
      trace: 'off',
    },
    webServer: {
      command: `pnpm exec vite --port ${suite.port} --strictPort`,
      cwd: suite.cwd,
      port: suite.port,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  });
}

export { browserSuite };
