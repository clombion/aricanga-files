/** The population: pnpm's workspace packages whose manifests git lists, less the POC, each with its role. */

import { LOCKFILE, lockOf } from '#lib/pins.ts';
import { POC, population, populationOf } from '#lib/scope.ts';
import { QUOTED_KEYS, inWorkspaceFolder, manifest, reader, refusalOf } from './scope.plants.ts';
import { describe, expect, test } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { perRoot, textOf } from '#lib/source-files.ts';
import type { Population } from '#lib/scope.ts';
import { PopulationError } from '#lib/workspace.ts';
import { dirOfImporter } from '#lib/package-dirs.ts';
import path from 'node:path';
import { plantedPopulation } from '#lib/scan-hooks.ts';

const HARNESS_ID = 'population';

/**
 * The lockfile's importers, as directories, that the population neither holds nor subtracts as POC.
 *
 * @param {Population} held - The population.
 * @param {string} lockText - The lockfile's text.
 * @returns {readonly string[]} The directories it misses.
 */
function missedImporters(held: Population, lockText: string): readonly string[] {
  const members = new Set<string>(held.members.map((member) => member.dir));
  return [...lockOf(lockText).keys()]
    .map((importer) => dirOfImporter(importer))
    .filter((dir) => dir !== '' && !POC.starts(dir) && !members.has(dir));
}

/** The fields a refusal's text leads with: its class, its source and its first words. */
const REFUSAL_HEAD = 3;

/**
 * The head of the refusal of a one-member population whose manifest is `text`.
 *
 * @param {string} text - The manifest's text.
 * @returns {Promise<string>} The refusal's class, source and first words.
 */
async function refusalHead(text: string): Promise<string> {
  const computing = populationOf({
    listing: ['packages/c/package.json'],
    read: reader({ 'packages/c/package.json': text }),
    workspace: ['packages/c/'],
  });
  const refusal = await refusalOf(computing);
  return refusal.split(':', REFUSAL_HEAD).join(':');
}

describe('a population', () => {
  test('holds a listed workspace package with a role, and leaves out the root, an unlisted one and the POC', async () => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['package.json', 'packages/view/package.json', 'packages/view/src/a.ts', 'packages/framework/package.json'],
      read: reader({ 'packages/view/package.json': manifest('view') }),
      workspace: ['', 'packages/view/', 'packages/ignored/', 'packages/framework/'],
    });
    expect(held.members).toStrictEqual([{ dir: 'packages/view/', role: 'view' }]);
    expect([held.holds('packages/view/src/a.ts'), held.holds('packages/framework/src/a.ts'), held.holds('harness/lib/a.ts')]).toStrictEqual(
      [true, false, true],
    );
    expect(held.roots).toStrictEqual(['packages/view/', 'harness/']);
  });

  test('refuses a member with no role or an unknown one, naming its manifest, the roles and their module', async () => {
    expect.hasAssertions();
    const refusals = await Promise.all(
      [JSON.stringify({ name: 'x' }), manifest('widget')].map(async (text) => {
        const refusal = await refusalOf(
          populationOf({
            listing: ['packages/a/package.json'],
            read: reader({ 'packages/a/package.json': text }),
            workspace: ['packages/a/'],
          }),
        );
        return refusal;
      }),
    );
    expect(refusals).toStrictEqual([
      'PopulationError: packages/a/package.json: aricanga.role is undefined; a workspace package declares one of the roles of harness/lib/roles.ts (experience, foundation, system, test-infrastructure, view)',
      'PopulationError: packages/a/package.json: aricanga.role is "widget"; a workspace package declares one of the roles of harness/lib/roles.ts (experience, foundation, system, test-infrastructure, view)',
    ]);
  });

  test('answers the nearest member of a nested path', async () => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['packages/a/package.json', 'packages/a/b/package.json'],
      read: reader({ 'packages/a/b/package.json': manifest('system'), 'packages/a/package.json': manifest('foundation') }),
      workspace: ['packages/a/', 'packages/a/b/'],
    });
    expect(held.memberOf('packages/a/b/src/x.ts')?.dir).toBe('packages/a/b/');
  });
});

describe('a population refused', () => {
  test('refuses every member with a bad role at once, and a manifest that is not JSON or whose aricanga is no object by its path', async () => {
    expect.hasAssertions();
    const roles = reader({ 'packages/a/package.json': manifest('sytem'), 'packages/b/package.json': JSON.stringify({ name: 'b' }) });
    const computing = populationOf({
      listing: ['packages/a/package.json', 'packages/b/package.json'],
      read: roles,
      workspace: ['packages/a/', 'packages/b/'],
    });
    const bad = await refusalOf(computing);
    const texts = ['{"name":', JSON.stringify({ aricanga: 'system' })];
    const broken = await Promise.all(
      texts.map(async (text) => {
        const head = await refusalHead(text);
        return head;
      }),
    );
    expect([bad, broken]).toStrictEqual([
      'PopulationError: packages/a/package.json: aricanga.role is "sytem"; packages/b/package.json: aricanga.role is undefined; a workspace package declares one of the roles of harness/lib/roles.ts (experience, foundation, system, test-infrastructure, view)',
      [
        'ConfigError: packages/c/package.json is not JSON: SyntaxError',
        'ConfigError: packages/c/package.json aricanga is not an object: "system"',
      ],
    ]);
  });
});

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

describe('a population by tier', () => {
  test("selects each tier's members once: the kernel, and every member that ships", async () => {
    expect.hasAssertions();
    const held = await plantedPopulation(
      [],
      [
        ['packages/e/', 'experience'],
        ['packages/f/', 'foundation'],
        ['packages/s/', 'system'],
        ['packages/t/', 'test-infrastructure'],
        ['packages/v/', 'view'],
      ],
    );
    expect([held.kernel.map((member) => member.dir), held.shipping.map((member) => member.dir)]).toStrictEqual([
      ['packages/f/', 'packages/s/'],
      ['packages/e/', 'packages/f/', 'packages/s/', 'packages/v/'],
    ]);
  });
});

describe('the records', () => {
  test('subtracts each POC entry as a directory, not as a prefix of a name', () => {
    expect.hasAssertions();
    expect([POC.starts('utils/x.js'), POC.starts('utils2/x.js'), POC.starts('packages/tests/a.ts')]).toStrictEqual([true, false, true]);
  });
});

describe('a checkout', () => {
  test("computes a checkout's population from pnpm's workspace, git's listing and each member's manifest", async () => {
    expect.hasAssertions();
    await inWorkspaceFolder('computed-', '{}', async (folder) => {
      await mkdir(path.join(folder, 'a', 'x'), { recursive: true });
      await writeFile(path.join(folder, 'a', 'x', 'package.json'), manifest('view'));
      const held = await population(folder);
      expect(held.members).toStrictEqual([{ dir: 'a/x/', role: 'view' }]);
    });
  });
});

describe('the memo', () => {
  test('answers one population to two calls', async () => {
    expect.hasAssertions();
    const first = await population();
    await expect(population()).resolves.toBe(first);
  });

  test('shares one computation between concurrent first calls', async () => {
    expect.hasAssertions();
    const calls: string[] = [];
    const remembered = perRoot(async (root: string): Promise<{ root: string }> => {
      calls.push(root);
      await Promise.resolve();
      return { root };
    });
    const [first, second] = await Promise.all([remembered('r'), remembered('r')]);
    expect([first === second, calls]).toStrictEqual([true, ['r']]);
  });

  test('computes again after a computation that throws before it returns', async () => {
    expect.hasAssertions();
    const calls: string[] = [];
    const thrown = (root: string): never => {
      calls.push(root);
      throw new Error('thrown before a promise');
    };
    const remembered = perRoot(thrown);
    await expect(remembered('r')).rejects.toThrow('thrown before a promise');
    await expect(remembered('r')).rejects.toThrow('thrown before a promise');
    expect(calls).toStrictEqual(['r', 'r']);
  });

  test('computes again after a failure', async () => {
    expect.hasAssertions();
    await inWorkspaceFolder('recovering-', '{', async (folder) => {
      await expect(population(folder)).rejects.toThrow(PopulationError);
      await writeFile(path.join(folder, 'package.json'), '{}');
      await expect(population(folder)).resolves.toHaveProperty('members', []);
    });
  });
});

describe('the repository', () => {
  test('holds every package the lockfile records, but the root and the POC', async () => {
    expect.hasAssertions();
    const [held, lockText] = await Promise.all([population(), textOf(LOCKFILE)]);
    expect([lockOf(lockText).has('.'), missedImporters(held, lockText)]).toStrictEqual([true, []]);
  });

  test('reads every importer of a lockfile as pnpm writes it: quoted, holding a colon, or with no dependencies', () => {
    expect.hasAssertions();
    expect([...lockOf(QUOTED_KEYS).keys()]).toStrictEqual(['.', '@s/p', 'a/#hash', "a/q'uote", 'a/sp ace', 'a/x:y']);
  });
});

export { HARNESS_ID };
