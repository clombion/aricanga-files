/**
 * Each guarded API is used only by its owner module; the scan is proven on planted modules.
 *
 * The scan resolves every name through TypeScript's checker, so each call form is planted: a plain
 * call, an aliased import, a destructured binding, a `globalThis.`/`window.` chain and an element
 * access. Each rule is also planted once in every root it covers, and once in a test: tests are held
 * as production code is. The near misses: a type-only import, a module's own `fetch` or `now`, a
 * pure constructor call, the owner itself, and a root a rule frees.
 */

import { CANONICAL, FORMS, IN_A_TEST, MEMBERS, NEAR_MISSES, ruleNamed, scopedOf, unguarded } from './owner-registry.plants.ts';
import type { Root, Rule, RuleName } from '#lib/owner-rules.ts';
import { SHAPES, keyOf, ownerUses, rulesOf, sites } from '#lib/owners.ts';
import { describe, expect, test } from 'vitest';
import { usePlanted, useScan } from '#lib/scan-hooks.ts';
import type { Scan } from '#lib/checker.ts';
import type { Site } from '#lib/owners.ts';
import { byKind } from '#lib/by-kind.ts';
import { ownersOf } from '#lib/owner-rules.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { population } from '#lib/scope.ts';
import { sourceOf } from '#lib/checker.ts';
import { tracked } from '#lib/source-files.ts';

const HARNESS_ID = 'owner-registry';

/** The rules over the planted members, which the planted roots are drawn from. */
const RULES = rulesOf(await plantedPopulation([], MEMBERS));

/** A planted module, and the rule the scan must report in it, if any. */
interface Plant {
  readonly path: string;
  readonly text: string;
  readonly rule?: RuleName;
}

/**
 * One module per call form, each in a root every rule covers.
 *
 * @returns {readonly Plant[]} The form plants, each with its rule.
 */
function formPlants(): readonly Plant[] {
  return FORMS.map(([rule, text]: readonly [RuleName, string], index) => ({
    path: `packages/foundation/src/__form_${index}.ts`,
    rule,
    text,
  }));
}

/**
 * One canonical use per root each rule covers.
 *
 * @returns {readonly Plant[]} The root plants, each with its rule.
 */
function rootPlants(): readonly Plant[] {
  return RULES.flatMap((rule) =>
    scopedOf(rule).map((scope) => ({ path: `${scope.root}__root_${rule.name}.ts`, rule: rule.name, text: CANONICAL[rule.name] })),
  );
}

const PLANTED: readonly Plant[] = [
  ...formPlants(),
  ...rootPlants(),
  { path: IN_A_TEST, rule: 'random', text: 'Math.random();\n' },
  ...NEAR_MISSES.map(([path, text]: readonly [string, string]) => ({ path, text })),
];
const plants: readonly (readonly [string, string])[] = PLANTED.map((plant) => [plant.path, plant.text] as const);
const expected: readonly Site[] = PLANTED.flatMap((plant) => (plant.rule === undefined ? [] : [{ path: plant.path, rule: plant.rule }]));
const plantedScan = usePlanted(plants, MEMBERS);
const repoScan = useScan();

/** A free root nested in a scoped one: its module uses the API the outer root forbids, and the nearest root, the free one, holds it. */
const NESTED_FREE = 'packages/foundation/probe/src/__free.ts';
const nestedFreeScan = usePlanted(
  [[NESTED_FREE, 'export const wait = (): void => {\n  setTimeout(() => undefined, 1);\n};\n']],
  [
    ['packages/foundation/', 'foundation'],
    ['packages/foundation/probe/', 'test-infrastructure'],
  ],
);

/** Uses of guarded globals that held modules redeclare, in a declaration file and in a module's global block: each redeclaration is not the platform's, and each use still is. */
const REDECLARED: readonly (readonly [string, RuleName])[] = [
  ['packages/foundation/src/__redeclared_dts.ts', 'storage'],
  ['packages/foundation/src/__redeclared_global.ts', 'storage'],
  ['packages/foundation/src/__redeclared_timer.ts', 'timers'],
];
const redeclaredScan = usePlanted(
  [
    ['packages/foundation/src/__redeclare.d.ts', 'declare var localStorage: Storage;\n'],
    [
      'packages/foundation/src/__redeclare_global.ts',
      'declare global {\n  var sessionStorage: Storage;\n  function setInterval(handler: () => void, timeout: number): number;\n}\n\nexport const kept = 1;\n',
    ],
    ['packages/foundation/src/__redeclared_dts.ts', "export const read = (): unknown => localStorage.getItem('key');\n"],
    ['packages/foundation/src/__redeclared_global.ts', "export const read = (): unknown => sessionStorage.getItem('key');\n"],
    ['packages/foundation/src/__redeclared_timer.ts', 'export const tick = (): unknown => setInterval(() => undefined, 1);\n'],
  ],
  [['packages/foundation/', 'foundation']],
);

/** How many entries an empty table holds. */
const NONE = 0;

/** The kernel owner of `json-parse` under a kernel root nested in another, which owns nothing. */
const NESTED_OWNER = 'packages/foundation/src/host/codec.ts';
const nestedScan = usePlanted(
  [[NESTED_OWNER, "JSON.parse('1');\n"]],
  [
    ['packages/foundation/', 'foundation'],
    ['packages/foundation/src/', 'system'],
  ],
);

/**
 * The guarded-API sites in some modules of a scan.
 *
 * @param {() => Scan} scanOf - The hook that hands out the open scan.
 * @param {readonly string[]} paths - The modules to read.
 * @returns {Site[]} Their sites.
 */
function sitesIn(scanOf: () => Scan, paths: readonly string[]): Site[] {
  const scan = scanOf();
  return [
    ...sites(
      scan,
      paths.map((path) => sourceOf(scan, path)),
    ),
  ];
}

/**
 * The modules under a root that use a rule's API.
 *
 * @param {Scan} scan - The open scan.
 * @param {string} root - The root.
 * @param {Rule} rule - The rule.
 * @returns {readonly string[]} The modules.
 */
function usersUnder(scan: Scan, root: string, rule: Rule): readonly string[] {
  return scan.paths.filter((path) => path.startsWith(root) && ownerUses(scan, sourceOf(scan, path), rule));
}

/**
 * A free root of a rule, as the rule's name, the root and its reason; none for a scoped root.
 *
 * @param {RuleName} name - The rule's name.
 * @param {Root} entry - One of its roots.
 * @returns {readonly (readonly [RuleName, string, string])[]} The free root, or none.
 */
function freed(name: RuleName, entry: Root): readonly (readonly [RuleName, string, string])[] {
  return byKind(entry, {
    free: (free) => [[name, free.root, free.why]],
    scoped: () => [],
  });
}

/** Each root the repository's rules free, as the rule's name and the root: a free root no module uses the API in is tightened to no owner. */
const FREED = rulesOf(await population()).flatMap((rule) => rule.roots.flatMap((entry) => freed(rule.name, entry)));

/** Each declared owner, kernel owners included, as the rule's name and its owner module. */
const DECLARED = SHAPES.words.flatMap((name) =>
  Object.values(SHAPES.of(name).policies).flatMap((policy) => ownersOf(policy).map((owner) => [name, owner] as const)),
);

/**
 * The owners a set of rules honours, each keyed as a site of its rule (`keyOf`).
 *
 * @param {readonly Rule[]} rules - The rules.
 * @returns {readonly string[]} Each owner, by rule, sorted.
 */
function honoured(rules: readonly Rule[]): readonly string[] {
  return rules
    .flatMap((rule) =>
      scopedOf(rule).flatMap((scope) => (scope.owner === undefined ? [] : [keyOf({ path: scope.owner, rule: rule.name })])),
    )
    .toSorted();
}

describe('the repository', () => {
  test('no guarded API is used outside its owner', () => {
    expect.hasAssertions();
    expect(sitesIn(repoScan, repoScan().paths)).toStrictEqual([]);
  });

  test('honours every declared owner, so a member demoted from the kernel fails here', async () => {
    expect.hasAssertions();
    const rules = rulesOf(await population());
    expect(honoured(rules)).toStrictEqual(DECLARED.map(([name, owner]) => keyOf({ path: owner, rule: name })).toSorted());
  });

  test('guards every member under some scope of every rule', async () => {
    expect.hasAssertions();
    const held = await population();
    const missed = unguarded(rulesOf(held), held);
    expect(missed, 'a member no root of a rule holds once: give its tier a policy in harness/lib/owner-rules.ts').toStrictEqual([]);
  });

  test('frees some root and declares some owner, so the tests over each are not empty', () => {
    expect.hasAssertions();
    expect([FREED.length > NONE, DECLARED.length > NONE]).toStrictEqual([true, true]);
  });

  test.each(FREED)('the %s rule frees %s, where a module uses its API', (name, root, why) => {
    expect.hasAssertions();
    const scan = repoScan();
    const rule = ruleNamed(rulesOf(scan.population), name);
    expect(
      usersUnder(scan, root, rule),
      `${root} is freed from ${name} because ${why}, but no module there uses it: give its tier NOBODY in harness/lib/owner-rules.ts`,
    ).not.toStrictEqual([]);
  });

  test.each(DECLARED)('the %s owner %s exists and uses its API', async (name, owner) => {
    expect.hasAssertions();
    const scan = repoScan();
    const rule = ruleNamed(rulesOf(scan.population), name);
    await expect(tracked()).resolves.toContain(owner);
    expect(ownerUses(scan, sourceOf(scan, owner), rule)).toBe(true);
  });
});

describe('the scan', () => {
  test('sees each planted call form and each planted root', () => {
    expect.hasAssertions();
    const planted = plants.map(([path]) => path).filter((path) => /__(?:form|root|in_a_test)/u.test(path));
    const found = sitesIn(plantedScan, planted)
      .map((site) => keyOf(site))
      .toSorted();
    expect(found).toStrictEqual(expected.map((site) => keyOf(site)).toSorted());
  });

  test('plants a canonical use in every root of every rule, and each call form', () => {
    expect.hasAssertions();
    const roots = RULES.flatMap((rule) => scopedOf(rule).map((scope) => `${scope.root}__root_${rule.name}.ts`));
    const forms = FORMS.map((_form, index) => `packages/foundation/src/__form_${index}.ts`);
    expect(
      plants
        .map(([path]) => path)
        .filter((path) => /__(?:form|root)_/u.test(path))
        .toSorted(),
    ).toStrictEqual([...roots, ...forms].toSorted());
  });

  test('reads a file in a free root nested in a scoped one by the nearest, the free root', () => {
    expect.hasAssertions();
    expect(sitesIn(nestedFreeScan, [NESTED_FREE])).toStrictEqual([]);
  });

  test('lets the owner of the nearest kernel root use its API, when kernel roots nest', () => {
    expect.hasAssertions();
    expect(sitesIn(nestedScan, [NESTED_OWNER])).toStrictEqual([]);
  });

  test.each(REDECLARED)('sees the use in %s of a guarded global that a held module redeclares', (path, rule) => {
    expect.hasAssertions();
    expect(sitesIn(redeclaredScan, [path])).toStrictEqual([{ path, rule }]);
  });

  test.each(NEAR_MISSES.map(([path]) => path))('lets the near miss %s through', (path) => {
    expect.hasAssertions();
    expect(sitesIn(plantedScan, [path])).toStrictEqual([]);
  });
});

export { HARNESS_ID };
