/** A planted population: built by production's rule, its members sorted, and refusing what production never holds. */

import { describe, expect, test } from 'vitest';
import type { PlantedMember } from '#lib/planted-population.ts';
import { PopulationError } from '#lib/workspace.ts';
import { plantedPopulation } from '#lib/planted-population.ts';

/** Members planted out of directory order, the order they must be sorted from. */
const OUT_OF_ORDER: readonly PlantedMember[] = [
  ['packages/b/', 'view'],
  ['packages/a/', 'view'],
  ['packages/a-b/', 'view', { devDependencies: { vite: '8.3.8' } }],
];

/** A word that names no role, and where a planted member holds its role. */
const NO_ROLE = 'nobody';
const ROLE_AT = 1;

/** A widened member list, as `Object.entries` or a spread hands it on: each directory given twice. */
const WIDENED: readonly PlantedMember[] = [...OUT_OF_ORDER, ...OUT_OF_ORDER.map(([dir]): PlantedMember => [dir, 'system'])];

describe('a planted population', () => {
  test('lists its members by directory whatever order they are planted in, each with its manifest', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation([], OUT_OF_ORDER);
    expect(held.members.map((member) => [member.dir, member.manifest['devDependencies']])).toStrictEqual([
      ['packages/a-b/', { vite: '8.3.8' }],
      ['packages/a/', undefined],
      ['packages/b/', undefined],
    ]);
  });

  test('refuses at once what production never holds: a member or a plant given twice, fields holding aricanga, a plant in no member or the harness, a plant at a manifest, a declared member that is no member', async () => {
    expect.hasAssertions();
    const fields: Readonly<Record<string, unknown>> = { aricanga: { role: 'system' } };
    const planting = plantedPopulation(
      ['utils/x.ts', 'packages/a/x.ts', 'packages/a/x.ts', 'packages/a/package.json', 'harness/x.ts'],
      [
        ['packages/a/', 'view'],
        ['packages/a/', 'system'],
        ['packages/c/', 'view', fields],
        ['packages/framework/', 'view'],
      ],
    );
    await expect(planting).rejects.toThrow(
      new PopulationError(
        'planted',
        "a planted population refused: packages/a/ is declared twice; packages/a/x.ts is planted twice; packages/c/'s fields hold aricanga; packages/a/package.json is a planted manifest; packages/framework/ is declared and is no member; utils/x.ts is held by no planted member or the harness",
      ),
    );
  });

  test('refuses a member list widened with each directory twice', async () => {
    expect.hasAssertions();
    await expect(plantedPopulation([], WIDENED)).rejects.toThrow(
      new PopulationError(
        'planted',
        'a planted population refused: packages/b/ is declared twice; packages/a/ is declared twice; packages/a-b/ is declared twice',
      ),
    );
  });
});

describe("a planted population's one refusal", () => {
  test("is the population's own, its class and text unchanged, when no planted list is refused", async () => {
    expect.hasAssertions();
    const widened: PlantedMember = ['packages/b/', 'view'];
    Reflect.set(widened, ROLE_AT, NO_ROLE);
    const refusal = await plantedPopulation([], [widened])
      .then(() => 'planted')
      .catch((error: unknown) => [error instanceof PopulationError, String(error)]);
    expect(refusal).toStrictEqual([
      true,
      'PopulationError: packages/b/package.json: aricanga.role is "nobody"; a workspace package declares one of the roles of harness/lib/roles.ts (experience, foundation, system, test-infrastructure, view)',
    ]);
  });

  test('names a member and a plant given twice beside a role that is no role', async () => {
    expect.hasAssertions();
    const widened: PlantedMember = ['packages/b/', 'view'];
    Reflect.set(widened, ROLE_AT, NO_ROLE);
    const planting = plantedPopulation(['packages/a/x.ts', 'packages/a/x.ts'], [['packages/a/', 'view'], ['packages/a/', 'view'], widened]);
    await expect(planting).rejects.toThrow(
      new PopulationError(
        'planted',
        'a planted population refused: packages/a/ is declared twice; packages/a/x.ts is planted twice; PopulationError: packages/b/package.json: aricanga.role is "nobody"; a workspace package declares one of the roles of harness/lib/roles.ts (experience, foundation, system, test-infrastructure, view)',
      ),
    );
  });
});

describe("a planted member's name", () => {
  test("that is no string is named beside the lists' refused states, in one refusal", async () => {
    expect.hasAssertions();
    await expect(
      plantedPopulation(
        [],
        [
          ['packages/a/', 'view', { name: 7 }],
          ['packages/a/', 'view'],
        ],
      ),
    ).rejects.toThrow(
      new PopulationError(
        'planted',
        "a planted population refused: packages/a/ is declared twice; PopulationError: packages/a/package.json: the name 7 is no string: a package's name is a string, or none",
      ),
    );
  });

  test("is refused by pnpm's listing's rule when it is no string, the refusal naming its manifest", async () => {
    expect.hasAssertions();
    await expect(plantedPopulation([], [['packages/a/', 'view', { name: 7 }]])).rejects.toThrow(
      new PopulationError('name', "packages/a/package.json: the name 7 is no string: a package's name is a string, or none"),
    );
  });
});
