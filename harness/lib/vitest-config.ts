/**
 * The gate's Vitest config over a population (`vitest.gate.config.ts` builds it over the repository's):
 * the shipping members' tests and the harness's checks, the members read from the population
 * (`test-globs.ts`). Every test starts from a clean slate (mocks restored, globals and env unstubbed),
 * runs in a shuffled order, must assert, and is bounded. Coverage is written outside the checkout, so
 * the gate writes no file. A config over a checkout's population provides it to every worker
 * (`provided.ts`), so no worker computes the repository's. A planted run builds the config over its own
 * population, which has no checkout: it computes none of the repository's and provides nothing.
 */

import { HARNESS_LIB, HARNESS_SCRIPTS, HARNESS_TESTS, RUNNER_TESTS, coverageIncludes, testIncludes } from './test-globs.ts';
import { COVERAGE_DIR } from './coverage.ts';
import type { Population } from './scope.ts';
import type { ViteUserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';
import { provision } from './provided.ts';

/** The `rebuild` project's plugins. */
type RebuildPlugins = NonNullable<ViteUserConfig['plugins']>;

/**
 * The gate's config over a population: its include and coverage are the population's members'.
 *
 * @param {Population} held - The population.
 * @param {() => RebuildPlugins} plugins - Makes the `rebuild` project's plugins: the gate's compiles the sandbox's Solid JSX.
 * @returns {ViteUserConfig} The config.
 */
function configOf(held: Population, plugins: () => RebuildPlugins): ViteUserConfig {
  return defineConfig({
    test: {
      allowOnly: false,
      coverage: {
        exclude: [...RUNNER_TESTS],
        include: [...coverageIncludes(held), `${HARNESS_LIB}**`, 'harness/lint-rules/globs.ts', `${HARNESS_SCRIPTS}**`],
        provider: 'v8',
        reporter: ['text-summary', 'json'],
        reportsDirectory: COVERAGE_DIR,
      },
      expect: { requireAssertions: true },
      globals: false,
      hookTimeout: 30_000,
      passWithNoTests: false,
      projects: [
        {
          extends: true,
          plugins: plugins(),
          test: {
            environment: 'happy-dom',
            include: testIncludes(held),
            name: 'rebuild',
          },
        },
        {
          extends: true,
          test: {
            environment: 'node',
            include: [...HARNESS_TESTS],
            name: 'harness',
          },
        },
      ],
      provide: provision(held),
      restoreMocks: true,
      sequence: { shuffle: true },
      setupFiles: ['./harness/lib/guards.ts'],
      testTimeout: 30_000,
      unstubEnvs: true,
      unstubGlobals: true,
    },
  });
}

export { configOf };
