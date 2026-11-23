// The gate's test run: the rebuild's tests and the harness's checks. Every test starts from a clean
// slate (mocks restored, globals and env unstubbed), runs in a shuffled order, must assert, and is
// bounded. Coverage is written outside the checkout, so the gate writes no file.

import type { ViteUserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import solid from '@solidjs/vite-plugin';
import { tmpdir } from 'node:os';

const config: ViteUserConfig = defineConfig({
  test: {
    allowOnly: false,
    coverage: {
      exclude: ['**/*.test.ts'],
      include: [
        'packages/foundation/src/**',
        'packages/systems/*/src/**',
        'experiences/sandbox/src/**',
        'harness/lib/**',
        'harness/scripts/**',
      ],
      provider: 'v8',
      reporter: ['text-summary', 'json'],
      reportsDirectory: path.join(tmpdir(), 'aricanga-coverage'),
    },
    expect: { requireAssertions: true },
    globals: false,
    hookTimeout: 30_000,
    passWithNoTests: false,
    projects: [
      {
        extends: true,
        // The sandbox's parts are Solid JSX, compiled by Solid's own plugin.
        plugins: [solid()],
        test: {
          environment: 'happy-dom',
          include: ['packages/foundation/**/*.test.ts', 'packages/systems/**/*.test.ts', 'experiences/sandbox/**/*.test.ts'],
          name: 'rebuild',
        },
      },
      {
        extends: true,
        test: {
          environment: 'node',
          include: ['harness/checks/**/*.test.ts'],
          name: 'harness',
        },
      },
    ],
    restoreMocks: true,
    sequence: { shuffle: true },
    setupFiles: ['./harness/lib/guards.ts'],
    testTimeout: 30_000,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});

// Vitest loads a config module's default export.
export default config;
