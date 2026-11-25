/**
 * The module boundaries hold: oxlint refuses each import a role may not make, and no production module imports a non-production one.
 *
 * Under oxlint, one import that must fail and one that must pass per boundary, by the role matrix
 * (`MAY` in `harness/lib/import-boundaries.ts`): foundation imports no other
 * member; a system imports only foundation; a view only foundation; an experience foundation,
 * systems and views; no role its own role's other members; every module may import the test
 * infrastructure by name (the whole chain below refuses it to a production module); nothing in the
 * rebuild imports the POC, by name or any subpath, and no specifier climbs out of its directory. A
 * package's name is refused exactly, so a relative path, another package's segment or another case
 * that spells it passes. Each refusal names its reason. The reducer-purity rule (ADR-0007) refuses
 * `Date` and `Math.random` in a system's reducer surface. Each fixture is written at its real path in
 * a planted project holding the repository's oxlint configuration; the overrides are read from the
 * population by role, one per member, and the planted population holds two members of each role, so
 * every cell has a witness.
 *
 * The whole chain (`harness/lib/production-imports.ts`, the user's decision on card C of audit
 * js261125): a scan of the TS program refuses every import of a non-production module by a
 * production one, by any form (every string the checker resolves to a module), within a member or
 * across members, the harness's included; so a production module reaches test support or test
 * infrastructure through no chain of imports. It alone holds that relation.
 */

import { BOUNDED, CHAIN, FIXTURES, PLANTED } from './boundaries.plants.ts';
import { at, boundaryDiagnostics, bounded } from './boundaries.run.ts';
import { describe, expect, test } from 'vitest';
import { usePlanted, useScan } from '#lib/scan-hooks.ts';
import { isEmpty } from '#lib/lists.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { productionImports } from '#lib/production-imports.ts';

const HARNESS_ID = 'boundaries';

describe('the boundary lint', () => {
  test('fails each must-fail fixture and passes each must-pass fixture', async () => {
    expect.hasAssertions();
    const found = await boundaryDiagnostics(FIXTURES);
    expect(FIXTURES.map((fixture) => [fixture.path, !isEmpty(at(found, fixture))])).toStrictEqual(
      FIXTURES.map((fixture) => [fixture.path, fixture.fails]),
    );
  });

  test('names its reason in each refusal: the role matrix, the POC, a climb', async () => {
    expect.hasAssertions();
    const reasoned = FIXTURES.filter((fixture) => fixture.reason !== undefined);
    const found = await boundaryDiagnostics(reasoned);
    expect(reasoned.map((fixture) => [fixture.path, [...new Set(at(found, fixture).map((diagnostic) => diagnostic.help))]])).toStrictEqual(
      reasoned.map((fixture) => [fixture.path, [fixture.reason]]),
    );
  });
});

describe('the boundary overrides of a planted population', () => {
  test("refuses each member the shipping packages its role may not import, its own role's other members included, no importer the test infrastructure, and the harness nothing", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(['lib/sys/test/a.ts', 'apps/app/src/a.test.ts'], PLANTED);
    expect(bounded(held)).toStrictEqual(BOUNDED);
  });
});

const repoScan = useScan();

const chainScan = usePlanted(CHAIN, [
  ['experiences/sandbox/', 'experience'],
  ['packages/characterisation/', 'test-infrastructure'],
  ['packages/foundation/', 'foundation'],
  ['packages/systems/chat/', 'system'],
]);

describe('the whole chain', () => {
  test('no production module of the repository imports a non-production module', () => {
    expect.hasAssertions();
    expect(productionImports(repoScan())).toStrictEqual([]);
  });

  test('refuses a production import of a non-production module by every form, an ambient module test support declares and the harness included, and lets test support import one and a string name a property', () => {
    expect.hasAssertions();
    expect(productionImports(chainScan()).filter((edge) => edge.from.includes('__chain_'))).toStrictEqual([
      { from: 'experiences/sandbox/src/__chain_infrastructure.ts', to: 'packages/characterisation/browsers.ts' },
      { from: 'experiences/sandbox/src/__chain_member.ts', to: 'packages/foundation/src/testing/index.ts' },
      { from: 'harness/lib/__chain_harness.ts', to: 'packages/characterisation/browsers.ts' },
      { from: 'packages/foundation/src/__chain_ambient.ts', to: 'packages/foundation/test/__chain_declarations.ts' },
      { from: 'packages/foundation/src/__chain_dynamic.ts', to: 'packages/foundation/src/testing/index.ts' },
      { from: 'packages/foundation/src/__chain_import_type.ts', to: 'packages/foundation/src/testing/index.ts' },
      { from: 'packages/foundation/src/__chain_own.ts', to: 'packages/foundation/src/testing/index.ts' },
      { from: 'packages/foundation/src/__chain_require.ts', to: 'packages/foundation/src/testing/index.ts' },
      { from: 'packages/foundation/src/__chain_template.ts', to: 'packages/foundation/src/testing/index.ts' },
      { from: 'packages/foundation/src/__chain_typeof.ts', to: 'packages/foundation/src/testing/index.ts' },
      { from: 'packages/systems/chat/src/__chain_alias.ts', to: 'packages/systems/chat/src/testing/predicates.ts' },
      { from: 'packages/systems/chat/src/__chain_type.ts', to: 'packages/foundation/src/testing/index.ts' },
    ]);
  });
});

export { HARNESS_ID };
