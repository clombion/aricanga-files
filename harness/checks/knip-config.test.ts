/**
 * Knip's configuration over a population: each member a workspace whose project is every top-level
 * directory and root module the listing gives it, its sources marked production where its role ships,
 * the POC ignored; and knip, run under the configuration of a planted population, reports an orphan
 * in a member's test support.
 */

import { describe, expect, test } from 'vitest';
import { listing, reader } from './scope.plants.ts';
import { pocNames, populationOf } from '#lib/scope.ts';
import { knipConfigOf } from '#lib/knip-config.ts';
import { plantedKnipRuns } from '#lib/deadcode.ts';
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

/** The orphan in the planted member's test support. */
const ORPHAN = 'packages/core/test/orphan.ts';

/** The orphan's text: an export nothing reads. */
const ORPHAN_TEXT = 'export const b = 2;\n';

/** The planted workspace's modules: the harness reads the member, whose test support holds an orphan. */
const PLANTED: Readonly<Record<string, string>> = {
  [ORPHAN]: ORPHAN_TEXT,
  'harness/checks/a.test.ts': "import { a } from '@planted/core';\nconsole.assert(a === 1);\n",
  'harness/scripts/run.ts': 'export {};\n',
  'packages/core/src/index.ts': 'export const a = 1;\n',
};

/**
 * Every knip invocation of the deadcode task over a planted workspace, under the configuration its own
 * population computes, unchanged: whether each run names the orphan, with the orphan planted and
 * without it, so the claim is the difference the orphan makes (the runs' statuses carry the hints the
 * repository's own ignore lists raise in a workspace that does not hold the POC).
 *
 * @returns {Promise<readonly (readonly boolean[])[]>} Whether each run names the orphan, with it and without it.
 */
async function orphanNamed(): Promise<readonly (readonly boolean[])[]> {
  const held = await plantedPopulation(Object.keys(PLANTED), [['packages/core/', 'foundation', MANIFEST]]);
  const root = { devDependencies: { '@planted/core': 'workspace:*' }, name: 'plant', private: true, type: 'module', version: '0.0.0' };
  const base: readonly (readonly [string, string])[] = [
    ['package.json', JSON.stringify(root)],
    ['pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n"],
    ['packages/core/package.json', JSON.stringify(MANIFEST)],
    ...Object.entries(PLANTED).filter(([path]: readonly [string, string]) => path !== ORPHAN),
  ];
  const config = knipConfigOf(held);
  const [withOrphan, without] = await Promise.all([
    plantedKnipRuns([...base, [ORPHAN, ORPHAN_TEXT]], config),
    plantedKnipRuns(base, config),
  ]);
  return [withOrphan.map((run) => run.output.includes(ORPHAN)), without.map((run) => run.output.includes(ORPHAN))];
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
      'experiences/aricanga',
      'packages/framework',
      'packages/test-utils',
      'packages/tests',
      'utils',
    ]);
  });

  test('gives a member no glob the listing leaves empty', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(['packages/core/src/index.ts'], [['packages/core/', 'system']]);
    expect(knipConfigOf(held).workspaces['packages/core']).toStrictEqual({ project: ['src/**/*.{ts,tsx}!'] });
  });

  test("reports an orphan in a member's test support, in default mode", async () => {
    expect.hasAssertions();
    await expect(orphanNamed()).resolves.toStrictEqual([
      [false, true],
      [false, false],
    ]);
  });
});

describe('a nested member', () => {
  test("leaves a nested member's files out of the member that holds it", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      ['packages/core/src/a.ts', 'packages/core/kit/lib/b.ts'],
      [
        ['packages/core/', 'foundation'],
        ['packages/core/kit/', 'test-infrastructure'],
      ],
    );
    expect(knipConfigOf(held).workspaces['packages/core']).toStrictEqual({ project: ['src/**/*.{ts,tsx}!'] });
  });
});

describe("a member's Playwright configs", () => {
  test('names each Playwright config of a member to knip, a nested one included', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      ['packages/probe/e2e/playwright.deep.config.ts', 'packages/probe/playwright.top.config.ts'],
      [['packages/probe/', 'test-infrastructure']],
    );
    expect(knipConfigOf(held).workspaces['packages/probe']?.playwright).toStrictEqual({
      config: ['e2e/playwright.deep.config.ts', 'playwright.top.config.ts'],
    });
  });

  test("leaves a nested member's Playwright config to the nested member, never the outer one", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      ['packages/a/src/x.ts', 'packages/a/b/playwright.e2e.config.ts', 'packages/a/b/src/y.ts'],
      [
        ['packages/a/', 'foundation'],
        ['packages/a/b/', 'test-infrastructure'],
      ],
    );
    expect(knipConfigOf(held).workspaces['packages/a']).toStrictEqual({ project: ['src/**/*.{ts,tsx}!'] });
  });
});

describe("a population's POC, and knip's configuration of it", () => {
  test('reads the POC by kind, ignores every POC directory as a workspace, and a POC package as a dependency where a held manifest declares it, by any spec', async () => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['package.json', 'experiences/aricanga/package.json', 'packages/framework/package.json', 'utils/a.js'],
      read: reader({ 'package.json': JSON.stringify({ optionalDependencies: { '@narratives/framework': 'link:packages/framework' } }) }),
      workspace: listing([''], ['experiences/aricanga/', 'aricanga'], ['packages/framework/', '@narratives/framework']),
    });
    const config = knipConfigOf(held);
    expect([held.poc, config.ignoreWorkspaces]).toStrictEqual([
      {
        directories: ['packages/tests/', 'packages/test-utils/', 'utils/'],
        packages: [
          { dir: 'experiences/aricanga/', name: 'aricanga' },
          { dir: 'packages/framework/', name: '@narratives/framework' },
        ],
      },
      ['experiences/aricanga', 'packages/framework', 'packages/test-utils', 'packages/tests', 'utils'],
    ]);
    expect(config.ignoreDependencies).toContain('@narratives/framework');
    expect(config.ignoreDependencies).not.toContain('aricanga');
  });

  test('keeps a POC package pnpm lists with no name, which no name refuses, and reads no POC manifest', async () => {
    expect.hasAssertions();
    const nameless = await populationOf({
      listing: ['package.json', 'packages/framework/package.json'],
      read: reader({ 'package.json': '{}' }),
      workspace: listing([''], ['packages/framework/']),
    });
    expect([nameless.poc.packages, pocNames(nameless)]).toStrictEqual([[{ dir: 'packages/framework/', name: undefined }], []]);
  });
});

export { HARNESS_ID };
