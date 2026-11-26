/** The population: pnpm's workspace packages whose manifests git lists, less the POC, each with its role; every held module is TypeScript. */

import {
  BOM,
  UNHELD_SCRIPT,
  causedRefusal,
  headOf,
  inWorkspaceFolder,
  listing,
  manifest,
  missedImporters,
  reader,
  refusalOf,
  withoutFile,
} from './scope.plants.ts';
import { LOCKFILE, lockOf } from '#lib/pins.ts';
import { POC, population, populationOf } from '#lib/scope.ts';
import { describe, expect, test } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { perRoot, textOf } from '#lib/source-files.ts';
import { PopulationError } from '#lib/workspace.ts';
import path from 'node:path';
import { plantedPopulation } from '#lib/planted-population.ts';

const HARNESS_ID = 'population';

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
    workspace: listing(['packages/c/']),
  });
  const [refusal, causes] = await causedRefusal(computing);
  return [refusal, ...causes.map((cause) => headOf(cause))];
}

describe('a population', () => {
  test('holds a listed workspace package with a role, and leaves out the root, an unlisted one and the POC', async () => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['package.json', 'packages/view/package.json', 'packages/view/src/a.ts', 'packages/framework/package.json'],
      read: reader({ 'package.json': '{}', 'packages/view/package.json': manifest('view') }),
      workspace: listing([''], ['packages/view/', 'x'], ['packages/ignored/'], ['packages/framework/']),
    });
    expect(held.members).toStrictEqual([
      { dir: 'packages/view/', manifest: { aricanga: { role: 'view' }, name: 'x' }, name: 'x', role: 'view' },
    ]);
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
            workspace: listing(['packages/a/', 'x']),
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
});

describe('a nested population', () => {
  test('answers the nearest member of a nested path', async () => {
    expect.hasAssertions();
    const held = await populationOf({
      listing: ['packages/a/package.json', 'packages/a/b/package.json'],
      read: reader({
        'package.json': '{}',
        'packages/a/b/package.json': manifest('system'),
        'packages/a/package.json': manifest('foundation'),
      }),
      workspace: listing(['packages/a/', 'x'], ['packages/a/b/', 'x']),
    });
    expect(held.memberOf('packages/a/b/src/x.ts')?.dir).toBe('packages/a/b/');
  });
});

describe("a population's root manifest", () => {
  test("reads the root's manifest for its fields and not its aricanga, which declares no role", async () => {
    expect.hasAssertions();
    const roots = await Promise.all(
      ['{"aricanga":null}', '{"aricanga":"system"}'].map(async (text) => {
        const held = await populationOf({
          listing: ['package.json'],
          read: reader({ 'package.json': text }),
          workspace: listing(['']),
        });
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
      workspace: listing(['packages/a/', 'x'], ['packages/b/', 'b']),
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
          "ConfigError: the manifests packages/c/package.json (ConfigError: packages/c/package.json is not JSON: SyntaxError) cannot be read; each refusal is also this one's cause",
          'ConfigError: packages/c/package.json is not JSON: SyntaxError',
        ],
        [
          'ConfigError: the manifests packages/c/package.json (ConfigError: packages/c/package.json aricanga is not an object: "system") hold an aricanga that is no object; each refusal is also this one\'s cause',
          'ConfigError: packages/c/package.json aricanga is not an object: "system"',
        ],
        [
          "ConfigError: the manifests packages/c/package.json (ConfigError: packages/c/package.json aricanga is not an object: null) hold an aricanga that is no object; each refusal is also this one's cause",
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
      workspace: listing(['packages/a/', 'x'], ['packages/b/'], ['packages/c/', 'x'], ['packages/d/']),
    });
    const [refusal, causes] = await causedRefusal(computing);
    expect([refusal, causes.map((cause) => headOf(cause))]).toStrictEqual([
      'ConfigError: the manifests package.json (ConfigError: package.json is not JSON: SyntaxError), packages/a/package.json (ConfigError: packages/a/package.json is not JSON: SyntaxError), packages/b/package.json (Error: ENOENT: no such file or directory, open \'packages/b/package.json\') cannot be read; the manifests packages/d/package.json (ConfigError: packages/d/package.json aricanga is not an object: "system") hold an aricanga that is no object; each refusal is also this one\'s cause; packages/c/package.json: aricanga.role is "sytem"; a workspace package declares one of the roles of harness/lib/roles.ts (experience, foundation, system, test-infrastructure, view)',
      [
        'ConfigError: package.json is not JSON: SyntaxError',
        'ConfigError: packages/a/package.json is not JSON: SyntaxError',
        "Error: ENOENT: no such file or directory, open 'packages/b/package.json'",
        'ConfigError: packages/d/package.json aricanga is not an object: "system"',
      ],
    ]);
  });
});

describe("a population's modules", () => {
  test('refuses every held module that is not TypeScript, by each kind, and holds a declaration file, data and an unheld script', async () => {
    expect.hasAssertions();
    const others = ['a.cjs', 'a.cts', 'a.js', 'a.jsx', 'a.mjs', 'a.mts'].map((file) => `packages/a/src/${file}`);
    const refusal = await refusalOf(plantedPopulation([...others, 'packages/a/src/b.ts'], [['packages/a/', 'foundation']]));
    const near = await plantedPopulation(
      ['packages/a/src/b.d.ts', 'packages/a/src/c.tsx', 'packages/a/d.json', 'harness/lib/e.ts'],
      [['packages/a/', 'foundation']],
    );
    const unheld = await populationOf(UNHELD_SCRIPT);
    expect([refusal, near.members.map((member) => member.dir), unheld.holds('stray.js')]).toStrictEqual([
      `PopulationError: a held module is TypeScript (.ts, .tsx), the kind every scan, the type check and coverage read: ${others.join(', ')}`,
      ['packages/a/'],
      false,
    ]);
  });
});

describe('a population by tier', () => {
  test("selects each tier's members, and parts the members into those that ship and the test infrastructure", async () => {
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
    const { kernel, product, 'test-infrastructure': testTier } = held.tiers;
    expect(
      [kernel, product, testTier, held.shipping, held.testInfrastructure].map((members) => members.map((member) => member.dir)),
    ).toStrictEqual([
      ['packages/f/', 'packages/s/'],
      ['packages/e/', 'packages/v/'],
      ['packages/t/'],
      ['packages/e/', 'packages/f/', 'packages/s/', 'packages/v/'],
      ['packages/t/'],
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
  test("computes a checkout's population from pnpm's workspace, each member named as pnpm lists it, git's listing and each member's manifest", async () => {
    expect.hasAssertions();
    await inWorkspaceFolder('computed-', '{}', async (folder) => {
      await mkdir(path.join(folder, 'a', 'x'), { recursive: true });
      await writeFile(path.join(folder, 'a', 'x', 'package.json'), manifest('view'));
      const held = await population(folder);
      expect(held.members).toStrictEqual([{ dir: 'a/x/', manifest: { aricanga: { role: 'view' }, name: 'x' }, name: 'x', role: 'view' }]);
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
});

export { HARNESS_ID };
