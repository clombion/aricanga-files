import { defineConfig, devices } from '@playwright/test';
import { readdirSync } from 'fs';

const impls = readdirSync('experiences', { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

const impl = process.env.IMPL;
if (!impl) {
  throw new Error(`IMPL env var required. Available: ${impls.join(', ')}\nUsage: IMPL=<name> npx playwright test`);
}

export default defineConfig({
  testDir: './packages/tests',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/examples/**', '**/shared/**'],
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  workers: 8,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  outputDir: './packages/tests/.output/results',
  reporter: [['html', { outputFolder: './packages/tests/.output/report' }]],
  use: {
    baseURL: 'http://localhost:8000/',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [
    // Test category filters (run with --project=engine, etc.)
    {
      name: 'engine',
      testDir: './packages/tests',
      testMatch: '**/foundation/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'implementation',
      testDir: `./experiences/${impl}/tests`,
      testMatch: '**/*.spec.ts',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'quality',
      testDir: './packages/tests/quality',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    // Device-specific projects (default - runs all tests)
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx vite experiences/${impl} -c vite.config.js`,
    port: 8000,
    reuseExistingServer: !process.env.CI,
  },
});
