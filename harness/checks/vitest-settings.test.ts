/**
 * Vitest, under this project's settings, fails each planted test a bare configuration would pass, in every project of the gate's config.
 *
 * Each plant runs in a planted project whose config is the gate's own (`configOf` of
 * `harness/lib/vitest-config.ts`) built over its population, a foundation member and a Vite app no
 * repository glob names, beside a copy of the harness lib its setup files load. Each of the config's
 * projects (the app's own, `rebuild` and `harness`) holds one copy of the plant, and every run reports
 * how each copy ended. A plant must fail in every project under the gate config and pass in every
 * project once only its setting is reverted (vitest's `mergeConfig` over the root's and each
 * project's settings, since an app's project inherits nothing from the root): `.only` under
 * `allowOnly: false`, a test with no assertion under `requireAssertions`, an unimported `test` under
 * `globals: false`, a test leaning on a spy, a global or an env variable a previous test left under
 * `restoreMocks`, `unstubGlobals` and `unstubEnvs` (run unshuffled, so the failure is the setting's),
 * and twenty order-dependent tests under `shuffle`. A file with no test fails in every project and an
 * unhandled rejection fails the run (Vitest's defaults hold them), and the timeout is bounded.
 */

import { EXIT_CLEAN, EXIT_FINDINGS } from '#lib/exit-status.ts';
import { describe, test } from 'vitest';
import { gateTest, projectsOf, testOf } from './gate-config.ts';
import { list, object, parsed, stringOf } from '#lib/config.ts';
import { PLANTED_VITEST_COPIES } from '#lib/planted-vitest.ts';
import { Project } from '#lib/tools.ts';
import { configOf } from '#lib/vitest-config.ts';
import { fromRoot } from '#lib/paths.ts';
import { pathToFileURL } from 'node:url';
import { plantedPopulation } from '#lib/planted-population.ts';

const HARNESS_ID = 'vitest-settings';

type Overrides = Readonly<Record<string, unknown>>;

interface Plant {
  readonly name: string;
  readonly text: string;
  readonly revert: Overrides;
  readonly ordered: boolean;
}

const IMPORTS = "import { expect, test, vi } from 'vitest';\n";

const PLANTS: readonly Plant[] = [
  {
    name: 'only',
    ordered: false,
    revert: { allowOnly: true },
    text: `${IMPORTS}test.only('a', () => {\n  expect(1).toBe(1);\n});\ntest('b', () => {\n  expect(2).toBe(2);\n});\n`,
  },
  {
    name: 'no-assertion',
    ordered: false,
    revert: { expect: { requireAssertions: false } },
    text: `${IMPORTS}test('a', () => {\n  void vi;\n});\n`,
  },
  {
    name: 'globals',
    ordered: false,
    revert: { globals: true },
    text: "test('a', () => {\n  expect(1).toBe(1);\n});\n",
  },
  {
    name: 'leaked-spy',
    ordered: true,
    revert: { restoreMocks: false },
    text: `${IMPORTS}const clock = { now: (): number => 1 };\ntest('a', () => {\n  vi.spyOn(clock, 'now').mockReturnValue(2);\n  expect(clock.now()).toBe(2);\n});\ntest('b', () => {\n  expect(clock.now()).toBe(2);\n});\n`,
  },
  {
    name: 'leaked-global',
    ordered: true,
    revert: { unstubGlobals: false },
    text: `${IMPORTS}test('a', () => {\n  vi.stubGlobal('plantedGlobal', 1);\n  expect(Reflect.get(globalThis, 'plantedGlobal')).toBe(1);\n});\ntest('b', () => {\n  expect(Reflect.get(globalThis, 'plantedGlobal')).toBe(1);\n});\n`,
  },
  {
    name: 'leaked-env',
    ordered: true,
    revert: { unstubEnvs: false },
    text: `${IMPORTS}test('a', () => {\n  vi.stubEnv('PLANTED_ENV', '1');\n  expect(process.env.PLANTED_ENV).toBe('1');\n});\ntest('b', () => {\n  expect(process.env.PLANTED_ENV).toBe('1');\n});\n`,
  },
  {
    name: 'order',
    ordered: false,
    revert: { sequence: { shuffle: false } },
    text: `${IMPORTS}const ran: number[] = [];\nfor (let index = 0; index < 20; index += 1) {\n  test(\`t\${index}\`, () => {\n    ran.push(index);\n    expect(ran).toStrictEqual(Array.from({ length: index + 1 }, (_, at) => at));\n  });\n}\n`,
  },
];

const EMPTY: Plant = { name: 'empty', ordered: false, revert: {}, text: 'export const nothing = 1;\n' };
const REJECTING = `${IMPORTS}test('a', () => {\n  void Promise.reject(new Error('planted'));\n  expect(1).toBe(1);\n});\n`;
const UNHANDLED: Plant = { name: 'unhandled', ordered: false, revert: {}, text: REJECTING };

const SHUFFLE_OFF: Overrides = { sequence: { shuffle: false } };
/** The order plant's seed: the gate's own shuffle, in a fixed order. */
const SEEDED: Overrides = { sequence: { seed: 1 } };
/** Each project of the planted config, by name in the config's order, and the directory its copy of a plant sits in. */
const PROJECTS: ReadonlyMap<string, string> = new Map([
  ['packages/app/', 'packages/app/test/'],
  ['rebuild', 'packages/plant/test/'],
  ['harness', 'harness/checks/'],
]);
/** The planted population's members: a foundation member and a Vite app. */
const MEMBERS = [
  ['packages/plant/', 'foundation'],
  ['packages/app/', 'experience'],
] as const;
/** The planted app's Vite config: the app states nothing its tests need. */
const APP_CONFIG = 'packages/app/vite.config.ts';
/** How Vitest ended a file it failed, and one it passed. */
const [FAILED, PASSED] = ['failed', 'passed'];

/** The longest test timeout the gate may set. */
const TIMEOUT_BOUND = 60_000;
/** A timeout of zero is none. */
const NO_TIMEOUT = 0;

function merge(...layers: readonly Overrides[]): Overrides {
  const merged: Record<string, unknown> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) {
      const prior = merged[key];
      merged[key] =
        typeof prior === 'object' && prior !== null && typeof value === 'object' && value !== null
          ? { ...object(prior, key), ...object(value, key) }
          : value;
    }
  }
  return merged;
}

/**
 * The planted config: the gate's own config over the planted population, `overrides` merged over the root's settings and each project's.
 *
 * @param {readonly string[]} plantPaths - The planted tests' paths.
 * @param {Overrides} overrides - The overrides.
 * @returns {string} The config module's text.
 */
function plantedConfig(plantPaths: readonly string[], overrides: Overrides): string {
  const gate = JSON.stringify(pathToFileURL(fromRoot('harness/lib/vitest-config.ts')).href);
  const scope = JSON.stringify(pathToFileURL(fromRoot('harness/lib/planted-population.ts')).href);
  const files = JSON.stringify([APP_CONFIG, ...plantPaths]);
  return [
    "import { mergeConfig } from 'vitest/config';",
    `import { configOf } from ${gate};`,
    `import { plantedPopulation } from ${scope};`,
    `const held = await plantedPopulation(${files}, ${JSON.stringify(MEMBERS)});`,
    `const layer = ${JSON.stringify({ test: overrides })};`,
    'const gate = configOf(held);',
    'const projects = (gate.test?.projects ?? []).map((project) => mergeConfig(project, layer));',
    'export default mergeConfig({ ...gate, test: { ...gate.test, projects } }, layer);',
    '',
  ].join('\n');
}

/** How one plant run ended: its exit status, and how each project's copy of the plant ended, by project. */
interface PlantRun {
  readonly status: number;
  readonly files: Readonly<Record<string, string>>;
}

/**
 * Each project's copy of a plant.
 *
 * @param {Plant} plant - The plant.
 * @returns {ReadonlyMap<string, string>} The copy's path, by project.
 */
function copiesOf(plant: Plant): ReadonlyMap<string, string> {
  return new Map([...PROJECTS].map(([name, directory]: readonly [string, string]) => [name, `${directory}${plant.name}.test.ts`]));
}

/**
 * How each collected file ended, by the project whose copy it is.
 *
 * @param {unknown} report - Vitest's JSON report.
 * @param {ReadonlyMap<string, string>} copies - Each project's copy, by project.
 * @returns {Readonly<Record<string, string>>} How each file ended, by project.
 */
function endings(report: unknown, copies: ReadonlyMap<string, string>): Readonly<Record<string, string>> {
  const results = list(object(report, 'the Vitest report')['testResults'], 'the test file results');
  const byProject: Record<string, string> = {};
  for (const result of results) {
    const file = object(result, 'a test file result');
    const name = stringOf(file['name'], 'a test file name');
    const [project = name] = [...copies].find(([, path]: readonly [string, string]) => name.endsWith(`/${path}`)) ?? [];
    byProject[project] = stringOf(file['status'], 'a test file status');
  }
  return byProject;
}

/**
 * How one plant ran under the gate config with `overrides` merged over its `test`.
 *
 * @param {Plant} plant - The planted project.
 * @param {Overrides} overrides - The overrides.
 * @returns {Promise<PlantRun>} Its exit status and the test files Vitest collected.
 */
async function run(plant: Plant, overrides: Overrides): Promise<PlantRun> {
  const project = await Project.create({ copies: PLANTED_VITEST_COPIES });
  try {
    const copies = copiesOf(plant);
    await project.write('vitest.planted.config.mts', plantedConfig([...copies.values()], overrides));
    await project.writeAll([[APP_CONFIG, 'export default {};\n'], ...[...copies.values()].map((path) => [path, plant.text] as const)]);
    const done = await project.tool(
      'vitest',
      'run',
      '--config',
      'vitest.planted.config.mts',
      '--reporter=json',
      '--outputFile=report.json',
    );
    return { files: endings(parsed(await project.read('report.json'), 'the Vitest report'), copies), status: done.status };
  } finally {
    await project.remove();
  }
}

/**
 * The sequence a plant runs in: seeded for the order plant, unshuffled for one leaning on order.
 *
 * @param {Plant} plant - The plant.
 * @returns {Overrides} The sequence overrides.
 */
function order(plant: Plant): Overrides {
  if (plant.name === 'order') {
    return SEEDED;
  }
  return plant.ordered ? SHUFFLE_OFF : {};
}

/**
 * Every project's copy ending as `ending`.
 *
 * @param {string} ending - How each copy ends.
 * @returns {Readonly<Record<string, string>>} The ending, by project.
 */
const everyProject = (ending: string): Readonly<Record<string, string>> =>
  Object.fromEntries([...PROJECTS.keys()].map((name) => [name, ending]));

/**
 * The names of the projects of the gate's config over the planted population, in order.
 *
 * @returns {Promise<readonly string[]>} The names.
 */
async function plantedProjects(): Promise<readonly string[]> {
  const held = await plantedPopulation([APP_CONFIG, ...copiesOf(EMPTY).values()], MEMBERS);
  const settings = testOf(object(configOf(held), 'the gate config'));
  return projectsOf(settings).map((project) => stringOf(project['name'], 'a project name'));
}

/**
 * Whether the gate's test timeout is a number above zero and within the bound.
 *
 * @returns {Promise<boolean>} Whether the timeout is set and bounded.
 */
async function timeoutBounded(): Promise<boolean> {
  const settings = await gateTest();
  const timeout = settings['testTimeout'];
  return typeof timeout === 'number' && timeout > NO_TIMEOUT && timeout <= TIMEOUT_BOUND;
}

describe('each setting', () => {
  test.for(PLANTS)('fails the $name plant in every project, and passes it in every project once reverted', async (plant, { expect }) => {
    expect.hasAssertions();
    const sequence = order(plant);
    const runs = await Promise.all([run(plant, sequence), run(plant, merge(sequence, plant.revert))]);
    expect(runs.map((ran) => ran.files)).toStrictEqual([everyProject(FAILED), everyProject(PASSED)]);
  });
});

describe('the defaults the gate keeps', () => {
  test('fail the empty plant in every project', async ({ expect }) => {
    expect.hasAssertions();
    await expect(run(EMPTY, {})).resolves.toStrictEqual({ files: everyProject(FAILED), status: EXIT_FINDINGS });
  });

  test('fail the run of an unhandled rejection, every project collected', async ({ expect }) => {
    expect.hasAssertions();
    await expect(run(UNHANDLED, {})).resolves.toStrictEqual({ files: everyProject(PASSED), status: EXIT_FINDINGS });
  });

  test('the test timeout is set and bounded', async ({ expect }) => {
    expect.hasAssertions();
    await expect(timeoutBounded()).resolves.toBe(true);
  });
});

describe('the plants', () => {
  test('a clean spec passes in every project under the gate config', async ({ expect }) => {
    expect.hasAssertions();
    const clean = { name: 'clean', ordered: false, revert: {}, text: `${IMPORTS}test('a', () => {\n  expect(1).toBe(1);\n});\n` };
    await expect(run(clean, {})).resolves.toStrictEqual({ files: everyProject(PASSED), status: EXIT_CLEAN });
  });

  test("are planted in every project of the gate's config over the planted population", async ({ expect }) => {
    expect.hasAssertions();
    await expect(plantedProjects()).resolves.toStrictEqual([...PROJECTS.keys()]);
  });
});

export { HARNESS_ID };
