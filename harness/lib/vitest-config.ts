/**
 * The gate's Vitest config over a population (`vitest.gate.config.ts` builds it over the repository's):
 * the shipping members' tests and the harness's checks, the members read from the population
 * (`test-globs.ts`). Each shipping Vite app's tests run in a project of their own that extends the
 * app's own Vite config (`viteApps`), so they are compiled by the plugins, aliases and options the app
 * is built with, which the app states; the other shipping members' tests run in the `rebuild`
 * project, and the harness's checks in the `harness` project. Every test starts from a clean slate
 * (mocks restored, globals and env unstubbed), runs in a shuffled order, must assert, may not be
 * focused with `.only`, and is bounded: an app's project inherits nothing from the root, so it
 * carries those settings itself (`SHARED`).
 * Coverage is written outside the checkout, so the gate writes no file. A config over a checkout's
 * population provides it to every worker (`provided.ts`), so no worker computes the repository's. A
 * planted run builds the config over its own population, which has no checkout: it computes none of
 * the repository's and provides nothing.
 */

import {
  HARNESS_LIB,
  HARNESS_LINT_RULES,
  HARNESS_SCRIPTS,
  HARNESS_TESTS,
  RUNNER_TESTS,
  VITE_CONFIG,
  coverageIncludes,
  testIncludes,
  viteApps,
} from './test-globs.ts';
import type { Member, Population } from './scope.ts';
import { COVERAGE_DIR } from './coverage.ts';
import { ROOT_MODULES } from './config-modules.ts';
import type { ViteUserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';
import { provision } from './provided.ts';

/**
 * The lint-rules package's modules the harness runs in its own process, which coverage reads: the
 * glob matcher, the exemption owner and the Solid names the rules read. The package's rules run
 * inside oxlint.
 */
const IN_PROCESS_LINT_RULES: readonly string[] = ['globs.ts', 'exemptions.ts', 'exemptions/**', 'solid.ts'];

/** The test settings every project of the run holds: the root's, and each app's project's, which extends no root. */
const SHARED: NonNullable<ViteUserConfig['test']> = {
  allowOnly: false,
  expect: { requireAssertions: true },
  globals: false,
  hookTimeout: 30_000,
  restoreMocks: true,
  sequence: { shuffle: true },
  setupFiles: [`./${HARNESS_LIB}guards.ts`],
  testTimeout: 30_000,
  unstubEnvs: true,
  unstubGlobals: true,
};

/** A project of the run, as Vitest's config holds it. */
type TestProject = NonNullable<NonNullable<ViteUserConfig['test']>['projects']>[number];

/**
 * The Vite apps whose tests are Vitest's: the shipping ones.
 *
 * @param {Population} held - The population.
 * @returns {readonly Member[]} The apps.
 */
function shippingApps(held: Population): readonly Member[] {
  return viteApps(held).filter((app) => held.shipping.includes(app));
}

/**
 * Each Vite app's project: its tests, under the app's own Vite config and the shared settings.
 *
 * @param {Population} held - The population.
 * @returns {readonly TestProject[]} One project per app, named by its directory.
 */
function appProjects(held: Population): readonly TestProject[] {
  return shippingApps(held).map((app) => ({
    extends: `./${app.dir}${VITE_CONFIG}`,
    test: { ...SHARED, environment: 'happy-dom', include: testIncludes(held, [app]), name: app.dir, provide: provision(held) },
  }));
}

/**
 * The gate's config over a population: its include and coverage are the population's members'.
 *
 * @param {Population} held - The population.
 * @returns {ViteUserConfig} The config.
 */
function configOf(held: Population): ViteUserConfig {
  const apps = new Set(shippingApps(held));
  return defineConfig({
    test: {
      coverage: {
        exclude: [...RUNNER_TESTS],
        include: [
          ...coverageIncludes(held),
          `${HARNESS_LIB}**`,
          ...IN_PROCESS_LINT_RULES.map((owner) => `${HARNESS_LINT_RULES}${owner}`),
          `${HARNESS_SCRIPTS}**`,
          ...ROOT_MODULES,
        ],
        provider: 'v8',
        reporter: ['text-summary', 'json'],
        reportsDirectory: COVERAGE_DIR,
      },
      ...SHARED,
      passWithNoTests: false,
      projects: [
        ...appProjects(held),
        {
          extends: true,
          test: {
            environment: 'happy-dom',
            include: testIncludes(
              held,
              held.shipping.filter((member) => !apps.has(member)),
            ),
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
    },
  });
}

export { configOf };
