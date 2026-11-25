/**
 * The owner rules over a population: each tier's roots under its tagged policy, in one list of
 * scoped and free roots; a kernel owner goes to the nearest kernel root holding it, a free root
 * carries its reason, and a rule that would hold one root twice is refused.
 */

import { describe, expect, test } from 'vitest';
import { listing, reader } from './scope.plants.ts';
import { ruleNamed, scopedOf } from './owner-registry.plants.ts';
import { plantedPopulation } from '#lib/planted-population.ts';
import { populationOf } from '#lib/scope.ts';
import { rulesOf } from '#lib/owners.ts';

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
    const parse = ruleNamed(rulesOf(held), 'json-parse');
    expect(scopedOf(parse).filter((scope) => scope.root.startsWith('packages/foundation/'))).toStrictEqual([
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
    expect(ruleNamed(rules, 'timers').roots.filter((entry) => entry.kind === 'free')).toStrictEqual([
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
  test('refuse a member at the harness root, which one rule would hold twice', async () => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['package.json', 'harness/package.json'],
      read: reader({ 'harness/package.json': JSON.stringify({ aricanga: { role: 'experience' } }), 'package.json': '{}' }),
      workspace: listing([''], ['harness/']),
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
    expect(['clock', 'json-parse'].map((name) => scopedOf(ruleNamed(rules, name)))).toStrictEqual([
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
