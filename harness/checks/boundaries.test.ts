/**
 * The module boundaries hold under oxlint: one import that must fail and one that must pass per boundary.
 *
 * The layered direction (`docs/roadmap/phase-7-hardening.md`): foundation imports no
 * other member; a system imports only foundation; a view only foundation; an experience foundation,
 * systems and views, never another experience; only a member's non-production modules import the
 * test infrastructure; nothing in the rebuild imports the POC, and no specifier climbs out of its
 * directory. The reducer-purity rule (ADR-0007) refuses `Date` and `Math.random` in a system's
 * reducer surface. Each fixture is written at its real path in a planted project holding the
 * repository's oxlint configuration; the overrides are read from the population by role, one per
 * member and one for its non-production modules after it, wherever the member sits.
 */

import { OXLINT_CONFIG_FILES, PLANTED_OXLINT_CONFIG, writeOxlintConfig } from '#lib/lint-rules.ts';
import { describe, expect, test } from 'vitest';
import { list, object } from '#lib/config.ts';
import { EXIT_FINDINGS } from '#lib/exit-status.ts';
import type { PlantedMember } from '#lib/planted-population.ts';
import type { Population } from '#lib/scope.ts';
import { Project } from '#lib/tools.ts';
import { oxlintConfigOf } from '#lib/oxlint-config.ts';
import { plantedPopulation } from '#lib/planted-population.ts';

const HARNESS_ID = 'boundaries';

interface Fixture {
  readonly path: string;
  readonly text: string;
  readonly fails: boolean;
}

const FIXTURES: readonly Fixture[] = [
  { fails: true, path: 'packages/foundation/src/plant.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  { fails: false, path: 'packages/foundation/src/near.ts', text: "export { Story } from 'inkjs';\n" },
  { fails: true, path: 'packages/systems/cards/src/plant.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  { fails: false, path: 'packages/systems/cards/src/near.ts', text: "export { erase } from '@narratives/foundation';\n" },
  { fails: true, path: 'packages/systems/chat/src/plant.ts', text: "export * from '../../cards/src/system';\n" },
  { fails: false, path: 'packages/systems/chat/src/near.ts', text: "export * from './state';\n" },
  { fails: true, path: 'experiences/sandbox/src/plant.ts', text: "export * from '../../aricanga/src/aricanga-experience.js';\n" },
  { fails: false, path: 'experiences/sandbox/src/near.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  { fails: true, path: 'harness/lib/plant.ts', text: "export * from '@narratives/framework';\n" },
  { fails: false, path: 'harness/lib/near.ts', text: "export * from 'node:fs';\n" },
  { fails: true, path: 'packages/systems/chat/src/model/plant.ts', text: 'export const at = (): number => Date.now();\n' },
  { fails: true, path: 'packages/systems/chat/src/model/random.ts', text: 'export const id = (): number => Math.random();\n' },
  { fails: false, path: 'packages/systems/chat/src/state-near.ts', text: 'export const at = (): number => Date.now();\n' },
  { fails: true, path: 'packages/systems/chat/src/climb.ts', text: "export * from './model/../../../cards/src/system';\n" },
  { fails: true, path: 'packages/foundation/src/type.ts', text: "export type { ChatViewModel } from '@narratives/system-chat';\n" },
  {
    fails: true,
    path: 'packages/foundation/src/later.ts',
    text: "export const later = async (): Promise<unknown> => import('@narratives/system-cards');\n",
  },
  { fails: true, path: 'experiences/sandbox/src/infrastructure.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  { fails: false, path: 'experiences/sandbox/test/infrastructure.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  { fails: false, path: 'packages/foundation/test/infrastructure.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  {
    fails: false,
    path: 'experiences/sandbox/playwright.planted.config.ts',
    text: "export * from '@narratives/characterisation/browsers';\n",
  },
];

/** A rule setting's options, after its severity. */
const OPTIONS = 1;

const BOUNDARY_RULES = ['no-restricted-imports', 'no-restricted-globals', 'no-restricted-properties'];

/** The planted members: one of each role, each a named package. */
const PLANTED: readonly PlantedMember[] = [
  ['apps/app/', 'experience', { name: '@p/app' }],
  ['lib/core/', 'foundation', { name: '@p/core' }],
  ['lib/sys/', 'system', { name: '@p/sys' }],
  ['tools/probe/', 'test-infrastructure', { name: '@p/probe' }],
  ['ui/view/', 'view', { name: '@p/view' }],
];

/**
 * The boundary findings oxlint reports for each fixture path, under a copy of the repository config.
 *
 * @param {readonly Fixture[]} fixtures - The fixtures.
 * @returns {Promise<ReadonlyMap<string, boolean>>} The boundary findings oxlint reports for each fixture path, under a copy of the repository config.
 */
async function verdicts(fixtures: readonly Fixture[]): Promise<ReadonlyMap<string, boolean>> {
  const project = await Project.create({ copies: OXLINT_CONFIG_FILES });
  try {
    await writeOxlintConfig(project);
    await project.writeAll(fixtures.map((fixture) => [fixture.path, fixture.text] as const));
    const outcome = await project.tool('oxlint', '-c', PLANTED_OXLINT_CONFIG, '-A', 'all', ...fixtures.map((fixture) => fixture.path));
    if (outcome.status > EXIT_FINDINGS || outcome.stderr.trim() !== '') {
      throw new Error(`oxlint did not lint the fixtures: ${outcome.status} ${outcome.stderr}`);
    }
    return new Map(
      fixtures.map((fixture) => [
        fixture.path,
        outcome.stdout
          .split('\n')
          .some((line) => line.startsWith(`${fixture.path}:`) && BOUNDARY_RULES.some((rule) => line.includes(`(${rule})`))),
      ]),
    );
  } finally {
    await project.remove();
  }
}

/**
 * Each import-boundary override of the configuration over a population: its files, and the member
 * packages its group refuses (the POC's and the climb aside).
 *
 * @param {Population} held - The population.
 * @returns {readonly unknown[]} Each override's files and refused members.
 */
function bounded(held: Population): readonly unknown[] {
  return list(oxlintConfigOf(held).overrides ?? [], 'overrides').flatMap((override: unknown) => {
    const { files, rules } = object(override, 'an override');
    const setting = object(rules, 'its rules')['no-restricted-imports'];
    if (setting === undefined) {
      return [];
    }
    const [pattern] = list(object(list(setting, 'the setting').at(OPTIONS), 'its options')['patterns'], 'its patterns');
    const group = list(object(pattern, 'its pattern')['group'], 'its group');
    return [[files, group.filter((entry) => typeof entry === 'string' && entry.startsWith('@p/') && !entry.endsWith('/*'))]];
  });
}

describe('the boundary lint', () => {
  test('fails each must-fail fixture and passes each must-pass fixture', async () => {
    expect.hasAssertions();
    const found = await verdicts(FIXTURES);
    expect(FIXTURES.map((fixture) => [fixture.path, found.get(fixture.path)])).toStrictEqual(
      FIXTURES.map((fixture) => [fixture.path, fixture.fails]),
    );
  });

  test('refuses each member the packages its role may not import, and its test modules the same less the test infrastructure', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(['lib/sys/test/a.ts'], PLANTED);
    expect(bounded(held)).toStrictEqual([
      [['apps/app/**'], ['@p/probe']],
      [['lib/core/**'], ['@p/app', '@p/sys', '@p/probe', '@p/view']],
      [['lib/sys/**'], ['@p/app', '@p/probe', '@p/view']],
      [['lib/sys/**/test/**'], ['@p/app', '@p/view']],
      [['tools/probe/**'], []],
      [['ui/view/**'], ['@p/app', '@p/sys', '@p/probe']],
      [['harness/**'], []],
    ]);
  });
});

export { HARNESS_ID };
