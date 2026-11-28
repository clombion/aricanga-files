/**
 * The owner rules over a population: each tier's roots under its tagged policy, in one list of
 * scoped and free roots; a kernel owner goes to the root of its holder (the nearest kernel member
 * holding it), and a free root carries its reason.
 */

import type { Root, RuleName } from '#lib/owner-rules.ts';
import { describe, test } from 'vitest';
import { ruleNamed, scopedOf } from './owner-registry.plants.ts';
import { byKind } from '#lib/by-kind.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { rootOf } from '#lib/owner-rules.ts';
import { rulesOf } from '#lib/owners.ts';

/**
 * Whether a root is free.
 *
 * @param {Root} entry - The root.
 * @returns {boolean} Whether every module of it may use the API.
 */
function isFree(entry: Root): boolean {
  return byKind(entry, { free: () => true, scoped: () => false });
}

describe('the rules', () => {
  test('give a kernel owner to the nearest kernel root holding it, when kernel roots nest', async ({ expect }) => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      [],
      [
        ['packages/foundation/', 'foundation'],
        ['packages/foundation/src/', 'system'],
      ],
    );
    const parse = ruleNamed(rulesOf(held), 'json-parse');
    expect(scopedOf(parse).filter((scope) => scope.root.startsWith('packages/foundation/'))).toStrictEqual([
      { owner: undefined, root: 'packages/foundation/' },
      { owner: 'packages/foundation/src/host/codec.ts', root: 'packages/foundation/src/' },
    ]);
  });
});

describe("the rules' lookup of a path's root", () => {
  test("gives a path its holder's root: a root configuration module the harness's, a path no holder holds none", async ({ expect }) => {
    expect.hasAssertions();
    const held = await plantedPopulation([], [['packages/view/', 'view']]);
    const lookup = rootOf(ruleNamed(rulesOf(held), 'clock'), held);
    const paths = ['packages/view/src/a.ts', 'oxlint.config.ts', 'packages/framework/src/a.ts'];
    expect(paths.map((path) => lookup(path)?.root)).toStrictEqual(['packages/view/', 'harness/', undefined]);
  });
});

describe('the rules over each tier', () => {
  test('free a test-infrastructure member where its tier uses the API, with the reason', async ({ expect }) => {
    expect.hasAssertions();
    const held = await plantedPopulation([], [['packages/probe/', 'test-infrastructure']]);
    const rules = rulesOf(held);
    expect(ruleNamed(rules, 'timers').roots.filter((entry) => isFree(entry))).toStrictEqual([
      {
        kind: 'free',
        root: 'packages/probe/',
        why: 'test-infrastructure fixtures and support wait on setTimeout (src/support.ts, src/fixtures/adapter.tsx)',
      },
    ]);
    expect(scopedOf(ruleNamed(rules, 'random')).map((scope) => scope.root)).toStrictEqual(['harness/', 'packages/probe/']);
  });
});

describe('the rules over a population the harness or the kernel shapes', () => {
  test('cover each kernel member, and give a kernel owner the member that holds it', async ({ expect }) => {
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
    const names: readonly RuleName[] = ['clock', 'json-parse'];
    expect(names.map((name) => scopedOf(ruleNamed(rules, name)))).toStrictEqual([
      [
        { owner: undefined, root: 'harness/' },
        { owner: undefined, root: 'packages/foundation/' },
        { owner: undefined, root: 'packages/systems/x/' },
        { owner: undefined, root: 'packages/view/' },
      ],
      [
        { owner: 'harness/lib/config.ts', root: 'harness/' },
        { owner: 'packages/foundation/src/host/codec.ts', root: 'packages/foundation/' },
        { owner: undefined, root: 'packages/systems/x/' },
        { owner: undefined, root: 'packages/view/' },
      ],
    ]);
  });
});
