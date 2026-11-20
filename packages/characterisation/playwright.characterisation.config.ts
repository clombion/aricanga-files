import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

// Step 1 of Phase 3 runs in all three engines, desktop and mobile emulation.
// Firefox has no Playwright device descriptor (no touch/mobile emulation), so
// mobile coverage is on the two engines that support it (Chromium, WebKit).
const PORT = 8100;

const config: PlaywrightTestConfig = defineConfig({
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
  reporter: [['list'], ['html', { open: 'never', outputFolder: '.output/report' }]],
  retries: 0,
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'off',
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    cwd: import.meta.dirname,
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

export default config;
