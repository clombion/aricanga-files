/**
 * Knip's configuration over a population: each member a workspace whose project is every top-level
 * directory and root module the listing gives it, its sources marked production where its role ships,
 * the POC ignored; and knip, run under the configuration of a planted population, reports an orphan
 * in a member's test support.
 */

import { EXIT_CLEAN, EXIT_FINDINGS } from '#lib/exit-status.ts';
import { deadcodeRuns, knip, writeKnipConfig } from '#lib/deadcode.ts';
import { describe, expect, test } from 'vitest';
import { Project } from '#lib/tools.ts';
import { inSequence } from '#lib/lists.ts';
import { knipConfigOf } from '#lib/knip-config.ts';
import { plantedPopulation } from '#lib/planted-population.ts';

const HARNESS_ID = 'knip-config';

/** The planted modules: a shipping member's sources, test support and root module; a test-infrastructure member's. */
const FILES = [
  'harness/checks/a.test.ts',
  'harness/scripts/run.ts',
  'packages/core/src/index.ts',
  'packages/core/test/support.ts',
  'packages/core/vite.config.ts',
  'packages/probe/playwright.probe.config.ts',
  'packages/probe/src/page.tsx',
  'packages/probe/tests/a.spec.ts',
];

/** A planted member's manifest: a package whose index is its sources' entry. */
const MANIFEST = { exports: { '.': './src/index.ts' }, name: '@planted/core', private: true, type: 'module', version: '0.0.0' };

/** The planted workspace's modules: the harness reads the member, whose test support holds an orphan. */
const PLANTED: Readonly<Record<string, string>> = {
  'harness/checks/a.test.ts': "import { a } from '@planted/core';\nconsole.assert(a === 1);\n",
  'harness/scripts/run.ts': 'export {};\n',
  'packages/core/src/index.ts': 'export const a = 1;\n',
  'packages/core/test/orphan.ts': 'export const b = 2;\n',
};

/**
 * Every knip invocation of the deadcode task over a planted workspace configured by its own
 * population: each run's status, and whether it names the orphan.
 *
 * @returns {Promise<readonly (readonly [number, boolean])[]>} Each run's status and whether it named the orphan.
 */
async function plantedRuns(): Promise<readonly (readonly [number, boolean])[]> {
  const held = await plantedPopulation(Object.keys(PLANTED), [['packages/core/', 'foundation', MANIFEST]]);
  const root = { devDependencies: { '@planted/core': 'workspace:*' }, name: 'plant', private: true, type: 'module', version: '0.0.0' };
  const project = await Project.create();
  try {
    await project.writeAll([
      ['package.json', JSON.stringify(root)],
      ['pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n"],
      ['packages/core/package.json', JSON.stringify(MANIFEST)],
      ...Object.entries(PLANTED),
    ]);
    await writeKnipConfig(project, { ...knipConfigOf(held), ignoreWorkspaces: [] });
    const runs = await deadcodeRuns();
    const done = await inSequence(runs, async (args) => {
      const run = await knip(project.root, args);
      return [run.status, (run.stdout + run.stderr).includes('packages/core/test/orphan.ts')] as const;
    });
    return done;
  } finally {
    await project.remove();
  }
}

describe('the knip configuration of a planted population', () => {
  test('gives each member a workspace of its own top-level directories, production where its role ships', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(FILES, [
      ['packages/core/', 'foundation'],
      ['packages/probe/', 'test-infrastructure'],
    ]);
    const config = knipConfigOf(held);
    expect(config.workspaces).toStrictEqual({
      '.': {
        entry: ['harness/scripts/*.ts', 'harness/checks/**/*.test.{ts,tsx}'],
        playwright: false,
        project: ['harness/**/*.{ts,tsx}'],
      },
      'packages/core': { project: ['*.{ts,tsx}', 'src/**/*.{ts,tsx}!', 'test/**/*.{ts,tsx}'] },
      'packages/probe': {
        playwright: { config: ['playwright.probe.config.ts'] },
        project: ['*.{ts,tsx}', 'src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
      },
    });
    expect(config.ignoreWorkspaces).toStrictEqual([
      'packages/framework',
      'packages/tests',
      'packages/test-utils',
      'experiences/aricanga',
      'utils',
    ]);
  });

  test('gives a member no glob the listing leaves empty', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(['packages/core/src/index.ts'], [['packages/core/', 'system']]);
    expect(knipConfigOf(held).workspaces?.['packages/core']).toStrictEqual({ project: ['src/**/*.{ts,tsx}!'] });
  });

  test("reports an orphan in a member's test support, in default mode", async () => {
    expect.hasAssertions();
    await expect(plantedRuns()).resolves.toStrictEqual([
      [EXIT_CLEAN, false],
      [EXIT_FINDINGS, true],
    ]);
  });
});

export { HARNESS_ID };
