/** The population: pnpm's workspace packages whose manifests git lists, less the POC, each with its role. */

import type { Dir, Population } from '#lib/scope.ts';
import { LOCKFILE, importers } from '#lib/pins.ts';
import {
  POC,
  PopulationError,
  dirOfImporter,
  importerOf,
  manifestOf,
  nearest,
  population,
  populationOf,
  workspacePackages,
} from '#lib/scope.ts';
import { describe, expect, test } from 'vitest';
import { manifest, reader, refusalOf, workspaceFolder } from './scope.plants.ts';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { perRoot, textOf } from '#lib/source-files.ts';
import path from 'node:path';

/**
 * The lockfile's importers, as directories, that the population neither holds nor subtracts as POC.
 *
 * @param {Population} held - The population.
 * @param {string} lockText - The lockfile's text.
 * @returns {readonly string[]} The directories it misses.
 */
function missedImporters(held: Population, lockText: string): readonly string[] {
  const members = new Set<string>(held.members.map((member) => member.dir));
  return importers(lockText)
    .map((importer) => dirOfImporter(importer))
    .filter((dir) => dir !== '' && !POC.starts(dir) && !members.has(dir));
}

/**
 * A root's path, for `nearest`.
 *
 * @param {Readonly<{ root: string }>} item - An item with a root.
 * @returns {string} Its root.
 */
function rootOf(item: Readonly<{ root: string }>): string {
  return item.root;
}

/** The importers block pnpm 10.28.0 wrote for workspaces whose directories need YAML quoting (`verif-58-1a-r3/phase-5-work/quoting*`). */
const QUOTED_KEYS = [
  "lockfileVersion: '9.0'",
  '',
  'importers:',
  '',
  '  .: {}',
  '',
  "  '@s/p':",
  '    devDependencies:',
  '      dep:',
  '        specifier: workspace:*',
  '        version: link:../../a/dep',
  '',
  '  a/#hash: {}',
  '',
  "  a/q'uote: {}",
  '',
  '  a/sp ace: {}',
  '',
  '  a/x:y:',
  '    devDependencies:',
  '      p5:',
  '        specifier: workspace:*',
  '        version: link:../plain',
  '',
  'packages:',
  '',
].join('\n');

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

describe('a package', () => {
  test('is one directory: its manifest and its importer derive from it, and an importer leads back to it', () => {
    expect.hasAssertions();
    const dirs: readonly Dir[] = ['', 'packages/a/', "a/q'uote/", 'a/x:y/', '1.0/'];
    const derived = dirs.map((dir) => {
      const importer = importerOf(dir);
      return [manifestOf(dir), importer, dirOfImporter(importer)];
    });
    expect(derived).toStrictEqual([
      ['package.json', '.', ''],
      ['packages/a/package.json', 'packages/a', 'packages/a/'],
      ["a/q'uote/package.json", "a/q'uote", "a/q'uote/"],
      ['a/x:y/package.json', 'a/x:y', 'a/x:y/'],
      ['1.0/package.json', '1.0', '1.0/'],
    ]);
    const keys = importers(QUOTED_KEYS);
    expect(keys.map((importer) => importerOf(dirOfImporter(importer)))).toStrictEqual(keys);
  });

  test('is held by the nearest root whatever order the roots come in', () => {
    expect.hasAssertions();
    const outer = { root: 'packages/a/' };
    const inner = { root: 'packages/a/b/' };
    expect([
      nearest([outer, inner], rootOf, 'packages/a/b/x.ts'),
      nearest([inner, outer], rootOf, 'packages/a/b/x.ts'),
      nearest([inner, outer], rootOf, 'packages/a/x.ts'),
      nearest([inner, outer], rootOf, 'harness/x.ts'),
    ]).toStrictEqual([inner, inner, outer, undefined]);
  });
});

describe('the records', () => {
  test('subtracts each POC entry as a directory, not as a prefix of a name', () => {
    expect.hasAssertions();
    expect([POC.starts('utils/x.js'), POC.starts('utils2/x.js'), POC.starts('packages/tests/a.ts')]).toStrictEqual([true, false, true]);
  });
});

describe('pnpm', () => {
  test('refuses a workspace it cannot list, naming the root', async () => {
    expect.hasAssertions();
    const folder = await workspaceFolder('unlistable-', '{');
    try {
      await expect(workspacePackages(folder)).rejects.toThrow(`pnpm could not list the workspace at ${folder}: `);
    } finally {
      await rm(folder, { force: true, recursive: true });
    }
  });

  test('answers the same packages through a symlink to the root', async () => {
    expect.hasAssertions();
    const folder = await workspaceFolder('linked-', '{}');
    const link = `${folder}-link`;
    try {
      await mkdir(path.join(folder, 'a', 'x'), { recursive: true });
      await writeFile(path.join(folder, 'a', 'x', 'package.json'), '{"name":"x"}');
      await symlink(folder, link);
      await expect(workspacePackages(link)).resolves.toStrictEqual(['', 'a/x/']);
    } finally {
      await rm(link, { force: true });
      await rm(folder, { force: true, recursive: true });
    }
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
    const folder = await workspaceFolder('recovering-', '{');
    try {
      await expect(population(folder)).rejects.toThrow(PopulationError);
      await writeFile(path.join(folder, 'package.json'), '{}');
      await expect(population(folder)).resolves.toHaveProperty('members', []);
    } finally {
      await rm(folder, { force: true, recursive: true });
    }
  });
});

describe('the repository', () => {
  test('holds every package the lockfile records, but the root and the POC', async () => {
    expect.hasAssertions();
    const [held, lockText] = await Promise.all([population(), textOf(LOCKFILE)]);
    expect([importers(lockText).includes('.'), missedImporters(held, lockText)]).toStrictEqual([true, []]);
  });

  test('reads every importer of a lockfile as pnpm writes it: quoted, holding a colon, or with no dependencies', () => {
    expect.hasAssertions();
    expect(importers(QUOTED_KEYS)).toStrictEqual(['.', '@s/p', 'a/#hash', "a/q'uote", 'a/sp ace', 'a/x:y']);
  });
});
