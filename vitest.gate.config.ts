import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig, type ViteUserConfig } from 'vitest/config';

// The gate's test run: the rebuild's tests and the harness's checks. Every test starts from a clean
// slate (mocks restored, globals and env unstubbed), runs in a shuffled order, must assert, and is
// bounded. Coverage is written outside the checkout, so the gate writes no file.
const config: ViteUserConfig = defineConfig({
  test: {
    globals: false,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    allowOnly: false,
    passWithNoTests: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { shuffle: true },
    expect: { requireAssertions: true },
    setupFiles: ['./harness/lib/vitest-setup/guards.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: join(tmpdir(), 'aricanga-coverage'),
      reporter: ['text-summary', 'json'],
      include: [
        'packages/foundation/src/**',
        'packages/systems/*/src/**',
        'experiences/sandbox/src/**',
        'harness/lib/**',
        'harness/scripts/**',
      ],
      exclude: ['**/*.test.ts'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'rebuild',
          environment: 'happy-dom',
          include: [
            'packages/foundation/**/*.test.ts',
            'packages/systems/**/*.test.ts',
            'experiences/sandbox/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'harness',
          environment: 'node',
          include: ['harness/checks/**/*.test.ts'],
        },
      },
    ],
  },
});

export default config;
