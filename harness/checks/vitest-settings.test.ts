/**
 * Vitest, under this project's settings, fails each planted test a bare configuration would pass.
 *
 * Each plant runs in a planted project holding a copy of `vitest.gate.config.ts` and the harness lib
 * its setup file loads, as a spec of the `rebuild` project. A plant must fail under the gate config and pass once only its setting is
 * reverted (vitest's own `mergeConfig` over the copy): `.only` under `allowOnly: false`, a test with
 * no assertion under `requireAssertions`, an unimported `test` under `globals: false`, a test
 * leaning on a spy, a global or an env variable a previous test left under `restoreMocks`,
 * `unstubGlobals` and `unstubEnvs`, and twenty order-dependent tests under `shuffle`. Plants that
 * lean on order run with shuffling off, so the failure is the setting's. A file with no test and an
 * unhandled rejection fail under the gate config (Vitest's defaults hold them), and the timeout is
 * bounded.
 */

import { EXIT_CLEAN, EXIT_FINDINGS } from './exit-status.ts';
import { describe, expect, test } from 'vitest';
import { Project } from '#lib/tools.ts';
import { gateTest } from './gate-config.ts';
import { object } from '#lib/config.ts';

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

const DEFAULTS: readonly Plant[] = [
  { name: 'empty', ordered: false, revert: {}, text: 'export const nothing = 1;\n' },
  {
    name: 'unhandled',
    ordered: false,
    revert: {},
    text: `${IMPORTS}test('a', () => {\n  void Promise.reject(new Error('planted'));\n  expect(1).toBe(1);\n});\n`,
  },
];

const SHUFFLE_OFF: Overrides = { sequence: { shuffle: false } };
const SEEDED: Overrides = { sequence: { seed: 1, shuffle: true } };
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
 * The exit status of one plant run under the gate config with `overrides` merged over its `test`.
 *
 * @param {Plant} plant - The planted project.
 * @param {Overrides} overrides - The overrides.
 * @returns {Promise<number>} The exit status of one plant run under the gate config with `overrides` merged over its `test`.
 */
async function status(plant: Plant, overrides: Overrides): Promise<number> {
  const project = await Project.create({ copies: ['vitest.gate.config.ts', 'harness/lib'] });
  try {
    await project.write(
      'vitest.planted.config.ts',
      `import { mergeConfig } from 'vitest/config';\nimport gate from './vitest.gate.config.ts';\nexport default mergeConfig(gate, ${JSON.stringify({ test: overrides })});\n`,
    );
    const path = `packages/foundation/plant/${plant.name}.test.ts`;
    await project.write(path, plant.text);
    const done = await project.tool('vitest', 'run', '--config', 'vitest.planted.config.ts', '--project', 'rebuild', path);
    return done.status;
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
 * A plant's exit statuses under the gate config, then with its setting reverted.
 *
 * @param {Plant} plant - The plant.
 * @returns {Promise<readonly [number, number]>} The two exit statuses.
 */
async function underGateAndReverted(plant: Plant): Promise<readonly [number, number]> {
  const sequence = order(plant);
  const gated = await status(plant, sequence);
  const reverted = await status(plant, merge(sequence, plant.revert));
  return [gated, reverted];
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
  test.for(PLANTS)('fails the $name plant, and passes it once reverted', async (plant) => {
    expect.hasAssertions();
    await expect(underGateAndReverted(plant)).resolves.toStrictEqual([EXIT_FINDINGS, EXIT_CLEAN]);
  });
});

describe('the defaults the gate keeps', () => {
  test.for(DEFAULTS)('fail the $name plant', async (plant) => {
    expect.hasAssertions();
    await expect(status(plant, {})).resolves.toBe(EXIT_FINDINGS);
  });

  test('the test timeout is set and bounded', async () => {
    expect.hasAssertions();
    await expect(timeoutBounded()).resolves.toBe(true);
  });
});

describe('the plants', () => {
  test('a clean spec passes under the gate config', async () => {
    expect.hasAssertions();
    const clean = { name: 'clean', ordered: false, revert: {}, text: `${IMPORTS}test('a', () => {\n  expect(1).toBe(1);\n});\n` };
    await expect(status(clean, {})).resolves.toBe(EXIT_CLEAN);
  });
});

export { HARNESS_ID };
