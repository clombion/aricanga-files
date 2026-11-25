/**
 * Each guarded API is used only by its owner module; the scan is proven on planted modules.
 *
 * The scan resolves every name through TypeScript's checker, so each call form is planted: a plain
 * call, an aliased import, a destructured binding, a `globalThis.`/`window.` chain and an element
 * access. Each rule is also planted once in every root it covers, and once in a test: tests are held
 * as production code is. The near misses: a type-only import, a module's own `fetch` or `now`, a
 * pure constructor call, the owner itself, and a root a rule frees.
 */

import { CANONICAL, FORMS, IN_A_TEST, MEMBERS, NEAR_MISSES, unguarded } from './owner-registry.plants.ts';
import { SHAPES, keyOf, ownerUses, rulesOf, sites } from '#lib/owners.ts';
import { describe, expect, test } from 'vitest';
import { population, populationOf } from '#lib/scope.ts';
import { usePlanted, useScan } from '#lib/scan-hooks.ts';
import type { Rule } from '#lib/owner-rules.ts';
import type { Scan } from '#lib/checker.ts';
import type { Site } from '#lib/owners.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { present } from '#lib/present.ts';
import { sourceOf } from '#lib/checker.ts';
import { tracked } from '#lib/source-files.ts';

const HARNESS_ID = 'owner-registry';

/** The rules over the planted members, which the planted roots are drawn from. */
const RULES = rulesOf(await plantedPopulation([], MEMBERS));

/** A planted module, and the rule the scan must report in it, if any. */
interface Plant {
  readonly path: string;
  readonly text: string;
  readonly rule?: string;
}

/**
 * One module per call form, each in a root every rule covers.
 *
 * @returns {readonly Plant[]} The form plants, each with its rule.
 */
function formPlants(): readonly Plant[] {
  return FORMS.map(([rule, text]: readonly [string, string], index) => ({
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
  const canonical = new Map(CANONICAL);
  return RULES.flatMap((rule) => {
    const text = canonical.get(rule.name);
    return text === undefined ? [] : rule.scopes.map((scope) => ({ path: `${scope.root}__root_${rule.name}.ts`, rule: rule.name, text }));
  });
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
 * Reads a manifest of a population with a member at the harness's root: the root's is empty, the member's declares a role.
 *
 * @param {string} listed - The manifest.
 * @returns {Promise<string>} Its text.
 */
async function readAtHarness(listed: string): Promise<string> {
  const text = await Promise.resolve(listed === 'package.json' ? '{}' : JSON.stringify({ aricanga: { role: 'experience' } }));
  return text;
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

/** Each root the repository's rules free, as the rule's name and the root: a free root no module uses the API in is tightened to no owner. */
const FREED = rulesOf(await population()).flatMap((rule) => rule.free.map((freed) => [rule.name, freed.root] as const));

/** Each declared owner, kernel owners included, as the rule's name and its owner module. */
const DECLARED = SHAPES.flatMap((shape) =>
  Object.values(shape.policies).flatMap((policy) =>
    'owner' in policy && policy.owner !== undefined ? [[shape.name, policy.owner] as const] : [],
  ),
);

/**
 * The owners a set of rules honours, each keyed as a site of its rule (`keyOf`).
 *
 * @param {readonly Rule[]} rules - The rules.
 * @returns {readonly string[]} Each owner, by rule, sorted.
 */
function honoured(rules: readonly Rule[]): readonly string[] {
  return rules
    .flatMap((rule) => rule.scopes.flatMap((scope) => (scope.owner === undefined ? [] : [keyOf({ path: scope.owner, rule: rule.name })])))
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

  test.each(FREED)('the %s rule frees %s, where a module uses its API', (name, root) => {
    expect.hasAssertions();
    const scan = repoScan();
    const rule = present(
      rulesOf(scan.population).find((candidate) => candidate.name === name),
      `the rule ${name}`,
    );
    expect(usersUnder(scan, root, rule)).not.toStrictEqual([]);
  });

  test.each(DECLARED)('the %s owner %s exists and uses its API', async (name, owner) => {
    expect.hasAssertions();
    const scan = repoScan();
    const rule = present(
      rulesOf(scan.population).find((candidate) => candidate.name === name),
      `the rule ${name}`,
    );
    await expect(tracked()).resolves.toContain(owner);
    expect(ownerUses(scan, sourceOf(scan, owner), rule)).toBe(true);
  });
});

describe('the scan', () => {
  test('sees each planted call form and each planted root', () => {
    expect.hasAssertions();
    expect(CANONICAL.map(([name]) => name).toSorted()).toStrictEqual(RULES.map((rule) => rule.name).toSorted());
    const planted = plants.map(([path]) => path).filter((path) => /__(?:form|root|in_a_test)/u.test(path));
    const found = sitesIn(plantedScan, planted)
      .map((site) => keyOf(site))
      .toSorted();
    expect(found).toStrictEqual(expected.map((site) => keyOf(site)).toSorted());
  });

  test('plants a canonical use in every root of every rule, and each call form', () => {
    expect.hasAssertions();
    const roots = RULES.flatMap((rule) => rule.scopes.map((scope) => `${scope.root}__root_${rule.name}.ts`));
    const forms = FORMS.map((_form, index) => `packages/foundation/src/__form_${index}.ts`);
    expect(
      plants
        .map(([path]) => path)
        .filter((path) => /__(?:form|root)_/u.test(path))
        .toSorted(),
    ).toStrictEqual([...roots, ...forms].toSorted());
  });

  test('lets the owner of the nearest kernel root use its API, when kernel roots nest', () => {
    expect.hasAssertions();
    expect(sitesIn(nestedScan, [NESTED_OWNER])).toStrictEqual([]);
  });

  test.each(NEAR_MISSES.map(([path]) => path))('lets the near miss %s through', (path) => {
    expect.hasAssertions();
    expect(sitesIn(plantedScan, [path])).toStrictEqual([]);
  });
});

describe('the rules', () => {
  test('give a kernel owner to the nearest kernel root holding it, when kernel roots nest', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      [],
      [
        ['packages/foundation/', 'foundation'],
        ['packages/foundation/src/', 'system'],
      ],
    );
    const parse = rulesOf(held).find((rule) => rule.name === 'json-parse');
    expect(parse?.scopes.filter((scope) => scope.root.startsWith('packages/foundation/'))).toStrictEqual([
      { owner: undefined, root: 'packages/foundation/' },
      { owner: 'packages/foundation/src/host/codec.ts', root: 'packages/foundation/src/' },
    ]);
  });
});

describe('the rules over each tier', () => {
  test('free a test-infrastructure member where its tier uses the API, with the reason', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation([], [['packages/probe/', 'test-infrastructure']]);
    const rules = rulesOf(held);
    expect(rules.find((rule) => rule.name === 'timers')?.free.map((freed) => freed.root)).toStrictEqual(['packages/probe/']);
    expect(rules.find((rule) => rule.name === 'random')?.scopes.map((scope) => scope.root)).toStrictEqual(['packages/probe/', 'harness/']);
  });

  test('refuse a member at the harness root, which one rule would hold twice', async () => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['package.json', 'harness/package.json'],
      read: readAtHarness,
      workspace: ['', 'harness/'],
    });
    expect(() => rulesOf(held)).toThrow(
      /^the owner rule process-start holds the root harness\/ twice: a member sits at the harness's root$/u,
    );
  });

  test('cover each kernel member, and give a kernel owner the member that holds it', async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      [],
      [
        ['packages/foundation/', 'foundation'],
        ['packages/systems/x/', 'system'],
        ['packages/view/', 'view'],
      ],
    );
    const rules = rulesOf(held);
    expect(['clock', 'json-parse'].map((name) => rules.find((rule) => rule.name === name)?.scopes)).toStrictEqual([
      [
        { owner: undefined, root: 'packages/foundation/' },
        { owner: undefined, root: 'packages/systems/x/' },
        { owner: undefined, root: 'packages/view/' },
        { owner: undefined, root: 'harness/' },
      ],
      [
        { owner: 'packages/foundation/src/host/codec.ts', root: 'packages/foundation/' },
        { owner: undefined, root: 'packages/systems/x/' },
        { owner: undefined, root: 'packages/view/' },
        { owner: 'harness/lib/config.ts', root: 'harness/' },
      ],
    ]);
  });
});

export { HARNESS_ID };
