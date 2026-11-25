/**
 * The module boundaries hold under oxlint: one import that must fail and one that must pass per boundary.
 *
 * The role matrix (`MAY` in `harness/lib/import-boundaries.ts`): foundation imports no other
 * member; a system imports only foundation; a view only foundation; an experience foundation,
 * systems and views; no role its own role's other members; only a member's non-production modules
 * import the test infrastructure; nothing in the rebuild imports the POC, by name or any subpath, and
 * no specifier climbs out of its directory. A package's name is refused exactly, so a relative path,
 * another package's segment or another case that spells it passes. Each refusal names its reason. The reducer-purity rule
 * (ADR-0007) refuses `Date` and `Math.random` in a system's reducer surface. Each fixture is written
 * at its real path in a planted project holding the repository's oxlint configuration; the overrides
 * are read from the population by role, one per member and one for its non-production modules after
 * it, and the planted population holds two members of each role, so every cell has a witness.
 */

import { OXLINT_CONFIG_FILES, PLANTED_OXLINT_CONFIG, oxlintDiagnostics, writeOxlintConfig } from '#lib/lint-rules.ts';
import { describe, expect, test } from 'vitest';
import { list, object, parsed } from '#lib/config.ts';
import type { Diagnostic } from '#lib/lint-rules.ts';
import type { PlantedMember } from '#lib/planted-population.ts';
import type { Population } from '#lib/scope.ts';
import { Project } from '#lib/tools.ts';
import { isEmpty } from '#lib/lists.ts';
import { oxlintConfigOf } from '#lib/oxlint-config.ts';
import { plantedPopulation } from '#lib/planted-population.ts';

const HARNESS_ID = 'boundaries';

/** A planted module: where it sits, its text, whether a boundary refuses it, and, for one fixture per reason, the message that names it. */
interface Fixture {
  readonly path: string;
  readonly text: string;
  readonly fails: boolean;
  readonly reason?: string;
}

/** The message of a role-matrix refusal, after the importer's allowed roles. */
const MATRIX = '(the role matrix: MAY in harness/lib/import-boundaries.ts)';

const FIXTURES: readonly Fixture[] = [
  {
    fails: true,
    path: 'packages/foundation/src/plant.ts',
    reason: `foundation modules import no other member ${MATRIX}`,
    text: "export { chatSystem } from '@narratives/system-chat';\n",
  },
  { fails: false, path: 'packages/foundation/src/near.ts', text: "export { Story } from 'inkjs';\n" },
  { fails: true, path: 'packages/systems/cards/src/plant.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  { fails: false, path: 'packages/systems/cards/src/near.ts', text: "export { erase } from '@narratives/foundation';\n" },
  { fails: true, path: 'packages/systems/chat/src/plant.ts', text: "export * from '../../cards/src/system';\n" },
  { fails: false, path: 'packages/systems/chat/src/near.ts', text: "export * from './state';\n" },
  { fails: true, path: 'experiences/sandbox/src/plant.ts', text: "export * from '../../aricanga/src/aricanga-experience.js';\n" },
  { fails: false, path: 'experiences/sandbox/src/near.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  {
    fails: true,
    path: 'harness/lib/plant.ts',
    reason: 'nothing in the rebuild imports the POC (ADR-0006, "Scope")',
    text: "export * from '@narratives/framework';\n",
  },
  { fails: false, path: 'harness/lib/near.ts', text: "export * from 'node:fs';\n" },
  { fails: true, path: 'packages/systems/chat/src/model/plant.ts', text: 'export const at = (): number => Date.now();\n' },
  { fails: true, path: 'packages/systems/chat/src/model/random.ts', text: 'export const id = (): number => Math.random();\n' },
  { fails: false, path: 'packages/systems/chat/src/state-near.ts', text: 'export const at = (): number => Date.now();\n' },
  {
    fails: true,
    path: 'packages/systems/chat/src/climb.ts',
    reason: 'a module reaches another member only by its package name, never by a relative climb',
    text: "export * from './model/../../../cards/src/system';\n",
  },
  { fails: true, path: 'packages/foundation/src/type.ts', text: "export type { ChatViewModel } from '@narratives/system-chat';\n" },
  {
    fails: true,
    path: 'packages/foundation/src/later.ts',
    text: "export const later = async (): Promise<unknown> => import('@narratives/system-cards');\n",
  },
  {
    fails: true,
    path: 'experiences/sandbox/src/infrastructure.ts',
    reason: 'only a non-production module (a runner test, a runner config, a test directory) imports the test infrastructure',
    text: "export * from '@narratives/characterisation/browsers';\n",
  },
  { fails: false, path: 'experiences/sandbox/test/infrastructure.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  { fails: false, path: 'packages/foundation/test/infrastructure.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  {
    fails: false,
    path: 'experiences/sandbox/playwright.planted.config.ts',
    text: "export * from '@narratives/characterisation/browsers';\n",
  },
  { fails: false, path: 'experiences/sandbox/src/colocated.test.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  {
    fails: true,
    path: 'packages/systems/cards/src/peer.ts',
    reason: `system modules import only foundation members, by name ${MATRIX}`,
    text: "export { chatSystem } from '@narratives/system-chat';\n",
  },
  { fails: true, path: 'packages/foundation/src/deep.ts', text: "export * from '@narratives/system-chat/testing/predicates';\n" },
  { fails: true, path: 'experiences/sandbox/src/poc-subpath.ts', text: "export * from '@narratives/framework/foundation';\n" },
  { fails: true, path: 'harness/lib/poc-subpath.ts', text: "export * from '@narratives/test-utils/fakes';\n" },
  { fails: true, path: 'experiences/sandbox/src/poc-package.ts', text: "export * from 'aricanga';\n" },
  { fails: true, path: 'oxlint.config.ts', text: "export * from '@narratives/framework';\n" },
  { fails: true, path: 'harness/lib/climb.ts', text: "export * from '../../packages/foundation/src/index';\n" },
  { fails: true, path: 'packages/foundation/src/up.ts', text: "export * from '..';\n" },
  { fails: true, path: 'packages/foundation/src/dot-up.ts', text: "export * from './..';\n" },
  { fails: true, path: 'packages/systems/cards/src/bare.ts', text: "export * from 'sandbox';\n" },
  { fails: false, path: 'packages/systems/cards/src/bare-relative.ts', text: "export * from './sandbox';\n" },
  { fails: false, path: 'packages/systems/cards/src/bare-segment.ts', text: "export * from '@narratives/foundation/sandbox';\n" },
  { fails: false, path: 'packages/systems/cards/src/bare-case.ts', text: "export * from 'Sandbox';\n" },
  { fails: false, path: 'packages/systems/cards/src/bare-case-subpath.ts', text: "export * from 'Sandbox/src/a';\n" },
  { fails: false, path: 'harness/lib/bare-scope.ts', text: "export * from '@x/aricanga';\n" },
];

/** A rule setting's options, after its severity. */
const OPTIONS = 1;

const BOUNDARY_RULES = ['no-restricted-imports', 'no-restricted-globals', 'no-restricted-properties'];

/** The planted members: two of each role, each a named package, so every cell of the matrix, a role with itself included, has a member on both sides. */
const PLANTED: readonly PlantedMember[] = [
  ['apps/app/', 'experience', { name: '@p/app' }],
  ['apps/app2/', 'experience', { name: '@p/app2' }],
  ['lib/core/', 'foundation', { name: '@p/core' }],
  ['lib/core2/', 'foundation', { name: '@p/core2' }],
  ['lib/sys/', 'system', { name: '@p/sys' }],
  ['lib/sys2/', 'system', { name: '@p/sys2' }],
  ['tools/probe/', 'test-infrastructure', { name: '@p/probe' }],
  ['tools/probe2/', 'test-infrastructure', { name: '@p/probe2' }],
  ['ui/view/', 'view', { name: '@p/view' }],
  ['ui/view2/', 'view', { name: '@p/view2' }],
];

/**
 * The boundary diagnostics oxlint reports for the fixtures, under a copy of the repository config.
 *
 * @param {readonly Fixture[]} fixtures - The fixtures.
 * @returns {Promise<readonly Diagnostic[]>} The diagnostics of the boundary rules.
 */
async function boundaryDiagnostics(fixtures: readonly Fixture[]): Promise<readonly Diagnostic[]> {
  const project = await Project.create({ copies: OXLINT_CONFIG_FILES });
  try {
    await writeOxlintConfig(project);
    await project.writeAll(fixtures.map((fixture) => [fixture.path, fixture.text] as const));
    const outcome = await project.tool(
      'oxlint',
      '-c',
      PLANTED_OXLINT_CONFIG,
      '-A',
      'all',
      '--format',
      'json',
      ...fixtures.map((fixture) => fixture.path),
    );
    return oxlintDiagnostics(parsed(outcome.stdout, `oxlint's report (it wrote to stderr: ${outcome.stderr})`)).filter((diagnostic) =>
      BOUNDARY_RULES.some((rule) => diagnostic.code === `eslint(${rule})`),
    );
  } finally {
    await project.remove();
  }
}

/**
 * The diagnostics of one fixture.
 *
 * @param {readonly Diagnostic[]} found - The run's diagnostics.
 * @param {Fixture} fixture - The fixture.
 * @returns {readonly Diagnostic[]} Its diagnostics.
 */
function at(found: readonly Diagnostic[], fixture: Readonly<Fixture>): readonly Diagnostic[] {
  return found.filter((diagnostic) => diagnostic.file === fixture.path);
}

/** The boundary overrides of the planted members: each override's files, and each group's refused members, by hand. */
const BOUNDED: readonly unknown[] = [
  [['apps/app/**'], [['@p/app2'], ['@p/probe', '@p/probe2']]],
  [['apps/app/**/*.test.{ts,tsx}'], [['@p/app2']]],
  [['apps/app2/**'], [['@p/app'], ['@p/probe', '@p/probe2']]],
  [
    ['lib/core/**'],
    [
      ['@p/app', '@p/app2', '@p/core2', '@p/sys', '@p/sys2', '@p/view', '@p/view2'],
      ['@p/probe', '@p/probe2'],
    ],
  ],
  [
    ['lib/core2/**'],
    [
      ['@p/app', '@p/app2', '@p/core', '@p/sys', '@p/sys2', '@p/view', '@p/view2'],
      ['@p/probe', '@p/probe2'],
    ],
  ],
  [
    ['lib/sys/**'],
    [
      ['@p/app', '@p/app2', '@p/sys2', '@p/view', '@p/view2'],
      ['@p/probe', '@p/probe2'],
    ],
  ],
  [['lib/sys/**/test/**'], [['@p/app', '@p/app2', '@p/sys2', '@p/view', '@p/view2']]],
  [
    ['lib/sys2/**'],
    [
      ['@p/app', '@p/app2', '@p/sys', '@p/view', '@p/view2'],
      ['@p/probe', '@p/probe2'],
    ],
  ],
  [['tools/probe/**'], []],
  [['tools/probe2/**'], []],
  [
    ['ui/view/**'],
    [
      ['@p/app', '@p/app2', '@p/sys', '@p/sys2', '@p/view2'],
      ['@p/probe', '@p/probe2'],
    ],
  ],
  [
    ['ui/view2/**'],
    [
      ['@p/app', '@p/app2', '@p/sys', '@p/sys2', '@p/view'],
      ['@p/probe', '@p/probe2'],
    ],
  ],
  [['harness/**', './knip.config.ts', './oxlint.config.ts', './vitest.gate.config.ts'], []],
];

/**
 * Each import-boundary override of the configuration over a population: its files, and the member
 * packages each of its reasons refuses by name (the POC's and the climbs aside), reason by reason.
 *
 * @param {Population} held - The population.
 * @returns {readonly unknown[]} Each override's files and each group's refused members.
 */
function bounded(held: Population): readonly unknown[] {
  return list(oxlintConfigOf(held).overrides ?? [], 'overrides').flatMap((override: unknown) => {
    const { files, rules } = object(override, 'an override');
    const setting = object(rules, 'its rules')['no-restricted-imports'];
    if (setting === undefined) {
      return [];
    }
    const options = object(list(setting, 'the setting').at(OPTIONS), 'its options');
    const paths = list(options['paths'], 'its paths').map((entry: unknown) => object(entry, 'its path'));
    const members = list(options['patterns'], 'its patterns')
      .map((pattern: unknown) => {
        const { message } = object(pattern, 'its pattern');
        return paths
          .filter((entry) => entry['message'] === message)
          .map((entry) => entry['name'])
          .filter((name) => typeof name === 'string' && name.startsWith('@p/'));
      })
      .filter((group: readonly unknown[]) => !isEmpty(group));
    return [[files, members]];
  });
}

describe('the boundary lint', () => {
  test('fails each must-fail fixture and passes each must-pass fixture', async () => {
    expect.hasAssertions();
    const found = await boundaryDiagnostics(FIXTURES);
    expect(FIXTURES.map((fixture) => [fixture.path, !isEmpty(at(found, fixture))])).toStrictEqual(
      FIXTURES.map((fixture) => [fixture.path, fixture.fails]),
    );
  });

  test('names its reason in each refusal: the role matrix, the test infrastructure, the POC, a climb', async () => {
    expect.hasAssertions();
    const reasoned = FIXTURES.filter((fixture) => fixture.reason !== undefined);
    const found = await boundaryDiagnostics(reasoned);
    expect(reasoned.map((fixture) => [fixture.path, [...new Set(at(found, fixture).map((diagnostic) => diagnostic.help))]])).toStrictEqual(
      reasoned.map((fixture) => [fixture.path, [fixture.reason]]),
    );
  });
});

describe('the boundary overrides of a planted population', () => {
  test("refuses each member the packages its role may not import, its own role's other members included, the test infrastructure to its production modules only, and the harness nothing", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(['lib/sys/test/a.ts', 'apps/app/src/a.test.ts'], PLANTED);
    expect(bounded(held)).toStrictEqual(BOUNDED);
  });
});

export { HARNESS_ID };
