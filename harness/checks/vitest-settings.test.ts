/**
 * Vitest, under this project's settings, fails each planted test a bare configuration would pass.
 *
 * Each plant runs in a planted project holding a copy of `vitest.gate.config.ts`, as a spec of the
 * `rebuild` project. A plant must fail under the gate config and pass once only its setting is
 * reverted (vitest's own `mergeConfig` over the copy): `.only` under `allowOnly: false`, a test with
 * no assertion under `requireAssertions`, an unimported `test` under `globals: false`, a test
 * leaning on a spy, a global or an env variable a previous test left under `restoreMocks`,
 * `unstubGlobals` and `unstubEnvs`, and twenty order-dependent tests under `shuffle`. Plants that
 * lean on order run with shuffling off, so the failure is the setting's. A file with no test and an
 * unhandled rejection fail under the gate config (Vitest's defaults hold them), and the timeout is
 * bounded.
 */

import { describe, expect, test } from 'vitest';

import { object } from '../lib/config.ts';
import { Project } from '../lib/tools.ts';
import gate from '../../vitest.gate.config.ts';

export const HARNESS_ID = 'vitest-settings';

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
    text: `${IMPORTS}test.only('a', () => {\n  expect(1).toBe(1);\n});\ntest('b', () => {\n  expect(2).toBe(2);\n});\n`,
    revert: { allowOnly: true },
    ordered: false,
  },
  {
    name: 'no-assertion',
    text: `${IMPORTS}test('a', () => {\n  void vi;\n});\n`,
    revert: { expect: { requireAssertions: false } },
    ordered: false,
  },
  {
    name: 'globals',
    text: "test('a', () => {\n  expect(1).toBe(1);\n});\n",
    revert: { globals: true },
    ordered: false,
  },
  {
    name: 'leaked-spy',
    text: `${IMPORTS}const clock = { now: (): number => 1 };\ntest('a', () => {\n  vi.spyOn(clock, 'now').mockReturnValue(2);\n  expect(clock.now()).toBe(2);\n});\ntest('b', () => {\n  expect(clock.now()).toBe(2);\n});\n`,
    revert: { restoreMocks: false },
    ordered: true,
  },
  {
    name: 'leaked-global',
    text: `${IMPORTS}test('a', () => {\n  vi.stubGlobal('plantedGlobal', 1);\n  expect(Reflect.get(globalThis, 'plantedGlobal')).toBe(1);\n});\ntest('b', () => {\n  expect(Reflect.get(globalThis, 'plantedGlobal')).toBe(1);\n});\n`,
    revert: { unstubGlobals: false },
    ordered: true,
  },
  {
    name: 'leaked-env',
    text: `${IMPORTS}test('a', () => {\n  vi.stubEnv('PLANTED_ENV', '1');\n  expect(process.env.PLANTED_ENV).toBe('1');\n});\ntest('b', () => {\n  expect(process.env.PLANTED_ENV).toBe('1');\n});\n`,
    revert: { unstubEnvs: false },
    ordered: true,
  },
  {
    name: 'order',
    text: `${IMPORTS}const ran: number[] = [];\nfor (let index = 0; index < 20; index += 1) {\n  test(\`t\${index}\`, () => {\n    ran.push(index);\n    expect(ran).toEqual(Array.from({ length: index + 1 }, (_, at) => at));\n  });\n}\n`,
    revert: { sequence: { shuffle: false } },
    ordered: false,
  },
];

const DEFAULTS: readonly Plant[] = [
  { name: 'empty', text: 'export const nothing = 1;\n', revert: {}, ordered: false },
  {
    name: 'unhandled',
    text: `${IMPORTS}test('a', () => {\n  void Promise.reject(new Error('planted'));\n  expect(1).toBe(1);\n});\n`,
    revert: {},
    ordered: false,
  },
];

const SHUFFLE_OFF: Overrides = { sequence: { shuffle: false } };
const SEEDED: Overrides = { sequence: { shuffle: true, seed: 1 } };

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

/** The exit status of one plant run under the gate config with `overrides` merged over its `test`. */
function status(plant: Plant, overrides: Overrides): number {
  const project = new Project({ copies: ['vitest.gate.config.ts'] });
  try {
    project.write(
      'vitest.planted.config.ts',
      `import { mergeConfig } from 'vitest/config';\nimport gate from './vitest.gate.config.ts';\nexport default mergeConfig(gate, ${JSON.stringify({ test: overrides })});\n`,
    );
    const path = `packages/foundation/plant/${plant.name}.test.ts`;
    project.write(path, plant.text);
    return project.tool('vitest', 'run', '--config', 'vitest.planted.config.ts', '--project', 'rebuild', path).status;
  } finally {
    project.remove();
  }
}

function order(plant: Plant): Overrides {
  return plant.name === 'order' ? SEEDED : plant.ordered ? SHUFFLE_OFF : {};
}

describe('each setting', () => {
  test.for(PLANTS)('fails the $name plant, and passes it once reverted', (plant) => {
    expect([status(plant, order(plant)), status(plant, merge(order(plant), plant.revert))]).toEqual([1, 0]);
  });
});

describe('the defaults the gate keeps', () => {
  test.for(DEFAULTS)('fail the $name plant', (plant) => {
    expect(status(plant, {})).toBe(1);
  });

  test('the test timeout is set and bounded', () => {
    const settings = object(object(gate, 'vitest.gate.config.ts').test ?? {}, 'test');
    const timeout = settings.testTimeout;
    expect(typeof timeout === 'number' && timeout > 0 && timeout <= 60_000).toBe(true);
  });
});

describe('the plants', () => {
  test('a clean spec passes under the gate config', () => {
    expect(status({ name: 'clean', text: `${IMPORTS}test('a', () => {\n  expect(1).toBe(1);\n});\n`, revert: {}, ordered: false }, {})).toBe(0);
  });
});
