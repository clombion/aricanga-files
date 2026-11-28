/**
 * The module boundaries hold: oxlint refuses each import a role may not make, and no production module imports a non-production one.
 *
 * Under oxlint, one import that must fail and one that must pass per boundary, by the role matrix
 * (`MAY` in `harness/lib/import-boundaries.ts`): foundation imports no other
 * member; a system imports only foundation; a view only foundation; an experience foundation,
 * systems and views; no role its own role's other members; every module may import the test
 * infrastructure by name (the whole chain below refuses it to a production module); nothing in the
 * rebuild imports the POC, by name or any subpath, and no relative specifier holds a `..` segment,
 * wherever its climb lands. A
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
 * argument), and a use only test support's declarations answer is reported. Each finding is told
 * with its files, its reason and its remedy, and a specifier no file answers with the four ways none
 * does. A file the session declares by rule (a stylesheet) is an empty module, so what it names in
 * turn is not read. The planted chain holds every form, importer kind and case of the relation it
 * reads, each importer with what the chain finds there. It alone holds that relation.
 */

import { BOUNDED, FIXTURES, PLANTED } from './boundaries.plants.ts';
import { CHAIN, CHAIN_MEMBERS, CHAIN_MOUNTED } from './boundaries-cases.plants.ts';
import { at, boundaryDiagnostics, bounded, reasonMessages, repositoryReasonMessages } from './boundaries.run.ts';
import { byCodeUnit, isEmpty } from '#lib/lists.ts';
import { chainReport, wholeChain } from '#lib/production-imports.ts';
import { describe, test, vi } from 'vitest';
import { usePlanted, useScan } from '#lib/scan-hooks.ts';
import { ADMITTED_META } from '#lib/chain-forms.ts';
import type { Chain } from '#lib/production-imports.ts';
import type { Scan } from '#lib/checker.ts';
import { plantedPopulation } from '#lib/planted-population.ts';

const HARNESS_ID = 'boundaries';

/** The distinct messages of the reasons over every importer: the matrix rows of the four shipping roles, the POC, a climb. */
const REASON_COUNT = 6;

/** How the refusal of a specifier no file answers begins: the four ways none does (the user's decision F1b2-C3). */
const FOUR_WAYS =
  'a specifier no file answers (an absent package, a file its package does not export, a file offered only under a condition TypeScript does not apply, a route only the bundler knows)';

/** What the report tells of two planted production modules: one reaching test support, one writing a form the chain cannot read. */
const TOLD: readonly (readonly [string, string])[] = [
  [
    'packages/foundation/src/__chain_via.ts',
    'packages/foundation/src/__chain_via.ts reaches packages/foundation/src/testing/__chain_via.ts, a non-production module, by an import or a name only its declarations answer: a production module reaches no test support or test infrastructure, so move what it uses into a production module, or use it from a non-production one',
  ],
  [
    'oxlint.config.ts',
    'oxlint.config.ts is refused (import.meta.glob): the whole chain cannot read it in a production module, so respell it as a form the chain reads, or move it into a non-production module',
  ],
];

/** The planted chain's files, each at its path. */
const CHAIN_PLANTS: readonly (readonly [string, string])[] = CHAIN.map((plant) => [plant.path, plant.text] as const);

describe('the boundary lint', () => {
  test('fails each must-fail fixture and passes each must-pass fixture', async ({ expect }) => {
    expect.hasAssertions();
    const found = await boundaryDiagnostics(FIXTURES);
    expect(FIXTURES.map((fixture) => [fixture.path, !isEmpty(at(found, fixture))])).toStrictEqual(
      FIXTURES.map((fixture) => [fixture.path, fixture.fails]),
    );
  });

  test('names its reason in each refusal: the role matrix, the POC, a climb', async ({ expect }) => {
    expect.hasAssertions();
    const reasoned = FIXTURES.filter((fixture) => fixture.reason !== undefined);
    const found = await boundaryDiagnostics(reasoned);
    expect(reasoned.map((fixture) => [fixture.path, [...new Set(at(found, fixture).map((diagnostic) => diagnostic.help))]])).toStrictEqual(
      reasoned.map((fixture) => [fixture.path, [fixture.reason]]),
    );
  });
});

describe('the boundary overrides of a planted population', () => {
  test("refuses each member the shipping packages its role may not import, its own role's other members included, no importer the test infrastructure, and the harness nothing", async ({
    expect,
  }) => {
    expect.hasAssertions();
    const held = await plantedPopulation(['lib/sys/test/a.ts', 'apps/app/src/a.test.ts'], PLANTED);
    expect(bounded(held)).toStrictEqual(BOUNDED);
  });
});

describe('the reasons of the boundary overrides', () => {
  test("every reason's message is distinct over every importer, the repository's with the POC included", async ({ expect }) => {
    expect.hasAssertions();
    const [planted, repository] = await Promise.all([plantedPopulation(['lib/sys/test/a.ts'], PLANTED), repositoryReasonMessages()]);
    const overrides = [...reasonMessages(planted), ...repository];
    const reasons = new Set(overrides.flat());
    expect([reasons.size, overrides.filter((messages) => new Set(messages).size !== messages.length)]).toStrictEqual([REASON_COUNT, []]);
  });
});

/** What the whole chain finds over each planted scan, run once for the tests that read it. */
const FOUND = new WeakMap<Scan, Chain>();

/**
 * The whole chain over a scan, run once.
 *
 * @param {() => Scan} open - The open scan's getter.
 * @returns {Chain} What it finds.
 */
function chainOf(open: () => Scan): Chain {
  const scan = open();
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
 * The edges a chain finds from the planted importers that declare `key`.
 *
 * @param {Chain} found - What the chain finds.
 * @param {'declares' | 'loads'} key - Which importers.
 * @returns {readonly Readonly<{ from: string; to: string }>[]} Their edges.
 */
function edgesFrom(found: Chain, key: 'declares' | 'loads'): readonly Readonly<{ from: string; to: string }>[] {
  const from = new Set(importers(key));
  return found.edges.filter((edge) => from.has(edge.from));
}

/**
 * The forms a chain refuses in one module.
 *
 * @param {Chain} found - What the chain finds.
 * @param {string} path - The module.
 * @returns {readonly string[]} Its refused forms.
 */
function formsOf(found: Chain, path: string): readonly string[] {
  return found.refused.filter((refusal) => refusal.from === path).map((refusal) => refusal.form);
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

  test('no production module of the repository imports a non-production module, or writes a form the scan cannot read', ({ expect }) => {
    expect.hasAssertions();
    const found = wholeChain(repoScan());
    expect(chainReport(found)).toStrictEqual([]);
  });
});

/*
 * The planted chain overlays the root configuration modules, paths the disk holds: the session serves
 * them inside the planted scan's own runs alone (`overlaying`), so a scan beside it never reads them.
 */
describe('the whole chain', () => {
  const chainScan = usePlanted(CHAIN_PLANTS, CHAIN_MEMBERS, CHAIN_MOUNTED);

  test('reports each held non-production file a production module loads, by every form TypeScript loads and every spelling, a stylesheet and a file with no extension included, from each production module reaching it', ({
    expect,
  }) => {
    expect.hasAssertions();
    expect(edgesFrom(chainOf(chainScan), 'loads')).toStrictEqual(plantedEdges('loads'));
  });

  test("reports a production use only test support's declarations answer: an ambient module, a global, an augmentation, under any diagnostic", ({
    expect,
  }) => {
    expect.hasAssertions();
    expect(edgesFrom(chainOf(chainScan), 'declares')).toStrictEqual(plantedEdges('declares'));
  });

  test('refuses each form it cannot read in a production module, and each specifier or use no file answers', ({ expect }) => {
    expect.hasAssertions();
    const refused = new Set(chainOf(chainScan).refused.map((refusal) => refusal.from));
    expect([...refused].toSorted(byCodeUnit)).toStrictEqual(importers('refused'));
  });

  test('names the argument of each import() whose specifier is not a literal', ({ expect }) => {
    expect.hasAssertions();
    const stated = CHAIN.filter((plant) => plant.refusedAs !== undefined);
    expect(stated.map((plant) => formsOf(chainOf(chainScan), plant.path))).toStrictEqual(stated.map((plant) => [plant.refusedAs]));
  });

  test('passes what ships and every form in a non-production module', ({ expect }) => {
    expect.hasAssertions();
    const found = named(chainOf(chainScan));
    expect(importers('passes').filter((path) => found.has(path))).toStrictEqual([]);
  });

  test('admits the import.meta members its declared list holds, asking the list', ({ expect }) => {
    expect.hasAssertions();
    const asked = vi.spyOn(ADMITTED_META, 'has');
    wholeChain(chainScan());
    const members = new Set(asked.mock.calls.map(([member]: readonly unknown[]) => String(member)));
    asked.mockRestore();
    expect([...members].toSorted(byCodeUnit)).toStrictEqual(['dirname', 'env', 'filename', 'glob', 'hot', 'resolve', 'url']);
  });
});

describe('the whole chain told', () => {
  const chainScan = usePlanted(CHAIN_PLANTS, CHAIN_MEMBERS, CHAIN_MOUNTED);

  test('names the four ways no file answers a specifier, for each way none does', ({ expect }) => {
    expect.hasAssertions();
    const unanswered = CHAIN.filter((plant) => plant.unanswered !== undefined);
    expect(unanswered.map((plant) => formsOf(chainOf(chainScan), plant.path).map((form) => form.startsWith(FOUR_WAYS)))).toStrictEqual(
      unanswered.map(() => [true]),
    );
  });

  test('tells its reader each finding with its files, its reason and its remedy', ({ expect }) => {
    expect.hasAssertions();
    const report = chainReport(chainOf(chainScan));
    expect(TOLD.map(([from]) => report.filter((line) => line.startsWith(`${from} `)))).toStrictEqual(TOLD.map(([, line]) => [line]));
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

  test('refuses its production import of its test support, the directory the scan mounts', ({ expect }) => {
    expect.hasAssertions();
    expect(wholeChain(absentScan()).edges).toStrictEqual([
      { from: 'packages/plant/src/plant.ts', to: 'packages/plant/src/testing/support.ts' },
    ]);
  });
});

export { HARNESS_ID };
