import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

// The gate's test run: the rebuild's tests and the harness's checks. Every test starts from a clean
// slate (mocks restored, globals and env unstubbed), runs in a shuffled order, must assert, and is
// bounded. Coverage is written outside the checkout, so the gate writes no file.
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
      reportsDirectory: join(tmpdir(), 'aricanga-coverage'),
    },
    expect: { requireAssertions: true },
    globals: false,
    hookTimeout: 30_000,
    passWithNoTests: false,
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
    restoreMocks: true,
    sequence: { shuffle: true },
    setupFiles: ['./harness/lib/vitest-setup/guards.ts'],
    testTimeout: 30_000,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});

export default config;
