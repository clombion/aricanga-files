/** A planted population: built by production's rule, and refusing what production never holds. */

import { describe, expect, test } from 'vitest';
import { PopulationError } from '#lib/workspace.ts';
import { plantedPopulation } from '#lib/scan-hooks.ts';

describe('a planted population', () => {
  test("refuses at once what production never holds: a member or a plant given twice, a plant in no member or the harness, a plant at a member's manifest, a declared member that is no member", async () => {
    expect.hasAssertions();
    const planting = plantedPopulation(
      ['utils/x.ts', 'packages/a/x.ts', 'packages/a/x.ts', 'packages/a/package.json', 'harness/x.ts'],
      [
        ['packages/a/', 'view'],
        ['packages/a/', 'system'],
        ['packages/framework/', 'view'],
      ],
    );
    await expect(planting).rejects.toThrow(
      new PopulationError(
        'a planted population refused: packages/a/ is declared twice; packages/a/x.ts is planted twice; packages/a/package.json is a planted manifest; packages/framework/ is declared and is no member; utils/x.ts is held by no planted member or the harness',
      ),
    );
  });
});
