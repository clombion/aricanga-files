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
 * The whole chain (`harness/lib/production-imports.ts`, the user's decisions on card C of audit
 * js261125 and card A of audit js261126): the file list of a TypeScript project rooted at the
 * production modules holds no held non-production module, so a production module reaches test
 * support or test infrastructure by no form and through no chain of imports, within a member or
 * across members, the harness's and the root configuration modules included; a form the scan cannot
 * read is refused in a production module (an `import()` whose specifier is not a literal named by its
 * argument), and a use only test support's declarations answer is reported. A file the session
 * declares by rule (a stylesheet) is an empty module, so what it names in turn is not read. The planted
 * chain holds every form, importer kind and case of the relation it reads, each importer with what the
 * chain finds there. It alone holds that relation.
 */

import { BOUNDED, FIXTURES, PLANTED } from './boundaries.plants.ts';
import { CHAIN, CHAIN_MEMBERS, CHAIN_MOUNTED } from './boundaries-cases.plants.ts';
import { at, boundaryDiagnostics, bounded } from './boundaries.run.ts';
import { byCodeUnit, isEmpty } from '#lib/lists.ts';
import { describe, expect, test, vi } from 'vitest';
import { usePlanted, useScan } from '#lib/scan-hooks.ts';
import { ADMITTED_META } from '#lib/chain-forms.ts';
import type { Chain } from '#lib/production-imports.ts';
import type { Scan } from '#lib/checker.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { wholeChain } from '#lib/production-imports.ts';

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

/** What the whole chain finds over each planted scan, run once for the tests that read it. */
const FOUND = new WeakMap<Scan, Chain>();

/**
 * The whole chain over a scan, run once.
 *
 * @param {Scan} scan - The open scan.
 * @returns {Chain} What it finds.
 */
function chainOf(scan: Scan): Chain {
  const found = FOUND.get(scan) ?? wholeChain(scan);
  FOUND.set(scan, found);
  return found;
}

/**
 * The edges the planted importers declare as loaded or as answered only by test support's declarations.
 *
 * @param {'declares' | 'loads'} key - Which.
 * @returns {readonly Readonly<{ from: string; to: string }>[]} The edges, by importer then imported file.
 */
function plantedEdges(key: 'declares' | 'loads'): readonly Readonly<{ from: string; to: string }>[] {
  const edges: readonly Readonly<{ from: string; to: string }>[] = CHAIN.flatMap(
    (plant) => (key === 'loads' ? plant.loads : plant.declares)?.map((to) => ({ from: plant.path, to })) ?? [],
  );
  return edges.toSorted((left, right) => byCodeUnit(left.from, right.from) || byCodeUnit(left.to, right.to));
}

/**
 * The planted importers that declare `key`.
 *
 * @param {keyof (typeof CHAIN)[number]} key - What the chain finds there.
 * @returns {readonly string[]} Their paths, sorted.
 */
function importers(key: keyof (typeof CHAIN)[number]): readonly string[] {
  return CHAIN.filter((plant) => plant[key] !== undefined)
    .map((plant) => plant.path)
    .toSorted(byCodeUnit);
}

/**
 * The importers a chain names, by an edge or a refusal.
 *
 * @param {Chain} found - What the chain finds.
 * @returns {ReadonlySet<string>} Their paths.
 */
function named(found: Chain): ReadonlySet<string> {
  return new Set([...found.edges.map((edge) => edge.from), ...found.refused.map((refusal) => refusal.from)]);
}

describe('the whole chain of the repository', () => {
  const repoScan = useScan();

  test('no production module of the repository imports a non-production module, or writes a form the scan cannot read', () => {
    expect.hasAssertions();
    expect(wholeChain(repoScan())).toStrictEqual({ edges: [], refused: [] });
  });
});

/*
 * The planted chain overlays the root configuration modules, paths the disk holds: the session serves
 * them inside the planted scan's own runs alone (`overlaying`), so a scan beside it never reads them.
 */
describe('the whole chain', () => {
  const chainScan = usePlanted(
    CHAIN.map((plant) => [plant.path, plant.text] as const),
    CHAIN_MEMBERS,
    CHAIN_MOUNTED,
  );

  test('reports each held non-production file a production module loads, by every form TypeScript loads and every spelling, a stylesheet and a file with no extension included, from each production module reaching it', () => {
    expect.hasAssertions();
    const loading = new Set(importers('loads'));
    expect(chainOf(chainScan()).edges.filter((edge) => loading.has(edge.from))).toStrictEqual(plantedEdges('loads'));
  });

  test("reports a production use only test support's declarations answer: an ambient module, a global, an augmentation, under any diagnostic", () => {
    expect.hasAssertions();
    const declaring = new Set(importers('declares'));
    expect(chainOf(chainScan()).edges.filter((edge) => declaring.has(edge.from))).toStrictEqual(plantedEdges('declares'));
  });

  test('refuses each form it cannot read in a production module, and each specifier or use no file answers', () => {
    expect.hasAssertions();
    const refused = new Set(chainOf(chainScan()).refused.map((refusal) => refusal.from));
    expect([...refused].toSorted(byCodeUnit)).toStrictEqual(importers('refused'));
  });

  test('names the argument of each import() whose specifier is not a literal', () => {
    expect.hasAssertions();
    const { refused } = chainOf(chainScan());
    const stated = CHAIN.filter((plant) => plant.refusedAs !== undefined);
    expect(stated.map((plant) => refused.filter((refusal) => refusal.from === plant.path).map((refusal) => refusal.form))).toStrictEqual(
      stated.map((plant) => [plant.refusedAs]),
    );
  });

  test('passes what ships and every form in a non-production module', () => {
    expect.hasAssertions();
    const found = named(chainOf(chainScan()));
    expect(importers('passes').filter((path) => found.has(path))).toStrictEqual([]);
  });

  test('admits the import.meta members its declared list holds, asking the list', () => {
    expect.hasAssertions();
    const asked = vi.spyOn(ADMITTED_META, 'has');
    wholeChain(chainScan());
    const members = new Set(asked.mock.calls.map(([member]: readonly unknown[]) => String(member)));
    asked.mockRestore();
    expect([...members].toSorted(byCodeUnit)).toStrictEqual(['dirname', 'env', 'filename', 'glob', 'hot', 'resolve', 'url']);
  });
});

describe('the whole chain of a member absent on disk', () => {
  const absentScan = usePlanted(
    [
      ['packages/plant/src/plant.ts', "export * from './testing/support.ts';\n"],
      ['packages/plant/src/testing/support.ts', 'export const support = 1;\n'],
    ],
    [['packages/plant/', 'foundation']],
  );

  test('refuses its production import of its test support, the directory the scan mounts', () => {
    expect.hasAssertions();
    expect(wholeChain(absentScan()).edges).toStrictEqual([
      { from: 'packages/plant/src/plant.ts', to: 'packages/plant/src/testing/support.ts' },
    ]);
  });
});

export { HARNESS_ID };
