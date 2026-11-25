/** The population: pnpm's workspace packages whose manifests git lists, less the POC, each with its role. */

import { BOM, QUOTED_KEYS, causedRefusal, inWorkspaceFolder, manifest, reader, refusalOf } from './scope.plants.ts';
import { LOCKFILE, lockOf } from '#lib/pins.ts';
import { POC, population, populationOf } from '#lib/scope.ts';
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
 * A reader of planted texts for which one listed file is gone from disk, as a git index can list a
 * deleted file.
 *
 * @param {string} gone - The file that cannot be read.
 * @param {Readonly<Record<string, string>>} texts - The other files' texts.
 * @returns {(listed: string) => Promise<string>} The reader.
 */
function withoutFile(gone: string, texts: Readonly<Record<string, string>>): (listed: string) => Promise<string> {
  const read = reader(texts);
  return async (listed: string): Promise<string> => {
    if (listed === gone) {
      throw new Error(`ENOENT: no such file or directory, open '${gone}'`);
    }
    const text = await read(listed);
    return text;
  };
}

/**
 * The refusal of a one-member population whose manifest is `text`, with its first cause's head.
 *
 * @param {string} text - The manifest's text.
 * @returns {Promise<readonly string[]>} The refusal, and its cause's class, source and first words.
 */
async function refusalHead(text: string): Promise<readonly string[]> {
  const computing = populationOf({
    listing: ['packages/c/package.json'],
    read: reader({ 'package.json': '{}', 'packages/c/package.json': text }),
    workspace: ['packages/c/'],
  });
  const [refusal, causes] = await causedRefusal(computing);
  return [refusal, ...causes.map((cause) => cause.split(':', REFUSAL_HEAD).join(':'))];
}

describe('a population', () => {
  test('holds a listed workspace package with a role, and leaves out the root, an unlisted one and the POC', async () => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['package.json', 'packages/view/package.json', 'packages/view/src/a.ts', 'packages/framework/package.json'],
      read: reader({ 'package.json': '{}', 'packages/view/package.json': manifest('view') }),
      workspace: ['', 'packages/view/', 'packages/ignored/', 'packages/framework/'],
    });
    expect(held.members).toStrictEqual([{ dir: 'packages/view/', manifest: { aricanga: { role: 'view' }, name: 'x' }, role: 'view' }]);
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
            read: reader({ 'package.json': '{}', 'packages/a/package.json': text }),
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
      read: reader({
        'package.json': '{}',
        'packages/a/b/package.json': manifest('system'),
        'packages/a/package.json': manifest('foundation'),
      }),
      workspace: ['packages/a/', 'packages/a/b/'],
    });
    expect(held.memberOf('packages/a/b/src/x.ts')?.dir).toBe('packages/a/b/');
  });
});

describe("a population's root manifest", () => {
  test("reads the root's manifest for its fields and not its aricanga, which declares no role", async () => {
    expect.hasAssertions();
    const roots = await Promise.all(
      ['{"aricanga":null}', '{"aricanga":"system"}'].map(async (text) => {
        const held = await populationOf({ listing: ['package.json'], read: reader({ 'package.json': text }), workspace: [''] });
        return JSON.stringify(held.rootManifest);
      }),
    );
    expect(roots).toStrictEqual(['{"aricanga":null}', '{"aricanga":"system"}']);
  });
});

describe('a population refused', () => {
  test('refuses every member with a bad role at once, and a manifest pnpm reads that starts with a byte-order mark or whose aricanga is no object, null included, by its path', async () => {
    expect.hasAssertions();
    const roles = reader({
      'package.json': '{}',
      'packages/a/package.json': manifest('sytem'),
      'packages/b/package.json': JSON.stringify({ name: 'b' }),
    });
    const computing = populationOf({
      listing: ['packages/a/package.json', 'packages/b/package.json'],
      read: roles,
      workspace: ['packages/a/', 'packages/b/'],
    });
    const bad = await refusalOf(computing);
    const texts = [`${BOM}${manifest('view')}`, JSON.stringify({ aricanga: 'system' }), '{"aricanga":null}'];
    const broken = await Promise.all(
      texts.map(async (text) => {
        const head = await refusalHead(text);
        return head;
      }),
    );
    expect([bad, broken]).toStrictEqual([
      'PopulationError: packages/a/package.json: aricanga.role is "sytem"; packages/b/package.json: aricanga.role is undefined; a workspace package declares one of the roles of harness/lib/roles.ts (experience, foundation, system, test-infrastructure, view)',
      [
        [
          "ConfigError: the manifests packages/c/package.json cannot be read; each refusal is this one's cause",
          'ConfigError: packages/c/package.json is not JSON: SyntaxError',
        ],
        [
          "ConfigError: the manifests packages/c/package.json hold an aricanga that is no object; each refusal is this one's cause",
          'ConfigError: packages/c/package.json aricanga is not an object: "system"',
        ],
        [
          "ConfigError: the manifests packages/c/package.json hold an aricanga that is no object; each refusal is this one's cause",
          'ConfigError: packages/c/package.json aricanga is not an object: null',
        ],
      ],
    ]);
  });
});

describe('a population whose manifests cannot be read', () => {
  test("names every manifest it cannot read, the root's and one gone since pnpm listed it, apart from one whose aricanga is no object, and every role refused in one refusal, each kept as its cause", async () => {
    expect.hasAssertions();
    const computing = populationOf({
      listing: ['packages/a/package.json', 'packages/b/package.json', 'packages/c/package.json', 'packages/d/package.json'],
      read: withoutFile('packages/b/package.json', {
        'package.json': `${BOM}{}`,
        'packages/a/package.json': `${BOM}${manifest('view')}`,
        'packages/c/package.json': manifest('sytem'),
        'packages/d/package.json': JSON.stringify({ aricanga: 'system' }),
      }),
      workspace: ['packages/a/', 'packages/b/', 'packages/c/', 'packages/d/'],
    });
    const [refusal, causes] = await causedRefusal(computing);
    expect([refusal, causes.map((cause) => cause.split(':', REFUSAL_HEAD).join(':'))]).toStrictEqual([
      'ConfigError: the manifests package.json, packages/a/package.json, packages/b/package.json cannot be read; the manifests packages/d/package.json hold an aricanga that is no object; each refusal is this one\'s cause; packages/c/package.json: aricanga.role is "sytem"; a workspace package declares one of the roles of harness/lib/roles.ts (experience, foundation, system, test-infrastructure, view)',
      [
        'ConfigError: package.json is not JSON: SyntaxError',
        'ConfigError: packages/a/package.json is not JSON: SyntaxError',
        "Error: ENOENT: no such file or directory, open 'packages/b/package.json'",
        'ConfigError: packages/d/package.json aricanga is not an object: "system"',
      ],
    ]);
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
      expect(held.members).toStrictEqual([{ dir: 'a/x/', manifest: { aricanga: { role: 'view' }, name: 'x' }, role: 'view' }]);
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
