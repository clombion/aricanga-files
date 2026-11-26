/** The provided population: a worker of the gate's run reads it, and computes no population of the repository. */

import { describe, expect, test, vi } from 'vitest';
import { REPO_ROOT } from '#lib/paths.ts';
import { configOf } from '#lib/vitest-config.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { population } from '#lib/scope.ts';
import { providedFor } from '#lib/provided.ts';
import { runPlanted } from '#lib/planted-vitest.ts';

/** A planted spec, run by a config that provides nothing: its worker asks for a provided population. */
const UNPROVIDED = [
  "import { expect, test } from 'vitest';",
  "import { providedFor } from '../harness/lib/provided.ts';",
  "test('reads none', async () => {",
  '  expect.hasAssertions();',
  "  await expect(providedFor('/checkout')).resolves.toBeUndefined();",
  '});',
  '',
].join('\n');

describe('a worker of the gate run', () => {
  test("answers the repository's population and listing with pnpm and git off the PATH: it computes neither", async () => {
    expect.hasAssertions();
    vi.stubEnv('PATH', '');
    vi.resetModules();
    const [scope, sources] = await Promise.all([import('#lib/scope.ts'), import('#lib/source-files.ts')]);
    const [held, listed] = await Promise.all([scope.population(REPO_ROOT), sources.tracked(REPO_ROOT)]);
    expect([
      held.root,
      held.members.some((member) => member.dir === 'packages/foundation/'),
      listed.includes('package.json'),
    ]).toStrictEqual([REPO_ROOT, true, true]);
  });

  test('is provided the population of the repository only', async () => {
    expect.hasAssertions();
    await expect(Promise.all([providedFor(REPO_ROOT), providedFor('/elsewhere')])).resolves.toMatchObject([{ root: REPO_ROOT }, undefined]);
  });
});

describe('a worker of a run whose config provides no population', () => {
  test('reads none, so its caller computes', async () => {
    expect.hasAssertions();
    const outcomes = await runPlanted({ 'unprovided.test.ts': UNPROVIDED });
    expect(outcomes.get('reads none')).toStrictEqual({ failure: '', status: 'passed' });
  });
});

describe("a run's config", () => {
  test("provides a checkout's population, and nothing for a population of no checkout", async () => {
    expect.hasAssertions();
    const [repository, planted] = await Promise.all([population(), plantedPopulation([], [['packages/a/', 'view']])]);
    const [fromRepository, fromPlanted] = [repository, planted].map((held) => configOf(held).test?.provide);
    expect([fromRepository?.population?.root, fromPlanted]).toStrictEqual([REPO_ROOT, {}]);
  });
});

describe('a process that is no Vitest worker', () => {
  test('reads no provided population', async () => {
    expect.hasAssertions();
    await expect(providedFor(REPO_ROOT, {})).resolves.toBeUndefined();
  });
});
