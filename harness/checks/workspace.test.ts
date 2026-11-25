/**
 * The workspace packages pnpm lists: listed relative to the root's realpath, and refused with pnpm's own reason; a
 * checkout's manifests, as pnpm and then the population read them.
 */

import { BOM, causedRefusal, inWorkspaceFolder, manifest, refusalOf } from './scope.plants.ts';
import { describe, expect, test, vi } from 'vitest';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { packagesOf, workspacePackages } from '#lib/workspace.ts';
import { ConfigError } from '#lib/config.ts';
import { finished } from '#lib/tools.ts';
import path from 'node:path';
import { population } from '#lib/scope.ts';
import { tmpdir } from 'node:os';

/** A pnpm version to pin that the machine's pnpm is not, and the one to pin when it is. */
const OTHER_PNPM = '10.22.0';
const FALLBACK_PNPM = '10.21.0';

/**
 * The JSON answer pnpm gives, listing packages at the given paths.
 *
 * @param {readonly unknown[]} paths - Each package's path.
 * @returns {string} The answer's text.
 */
function answer(paths: readonly unknown[]): string {
  return JSON.stringify(paths.map((where) => ({ name: 'x', path: where })));
}

/**
 * A pnpm version the running pnpm is not, so a workspace pinning it differs from the pnpm that lists
 * it. A pnpm that fetched it would ask a registry that refuses at once, and retry nothing, so the
 * listing fails within a second instead of fetching. pnpm installs a fetched pnpm under its data
 * directory, run from there, so the test keeps that directory outside the planted workspace: inside
 * it, the install meets the workspace's own pin and does not end.
 *
 * @returns {Promise<string>} The version.
 */
async function anotherPnpm(): Promise<string> {
  const running = await finished(['pnpm', '--version'], { cwd: tmpdir() });
  return running.stdout.trim() === OTHER_PNPM ? FALLBACK_PNPM : OTHER_PNPM;
}

describe('pnpm', () => {
  test("refuses a workspace whose root manifest is broken, naming the root and pnpm's reason, which pnpm writes to stderr", async () => {
    expect.hasAssertions();
    await inWorkspaceFolder('unlistable-', '{', async (folder) => {
      const refusal = await workspacePackages(folder)
        .then(() => 'listed')
        .catch(String);
      expect([
        refusal.startsWith(`PopulationError: pnpm could not list the workspace at ${folder}: `),
        refusal.includes('"status":1'),
        refusal.includes("while parsing '{'"),
      ]).toStrictEqual([true, true, true]);
    });
  });

  test("refuses a workspace whose member manifest is broken with pnpm's reason, which pnpm writes to stdout", async () => {
    expect.hasAssertions();
    await inWorkspaceFolder('broken-member-', '{}', async (folder) => {
      await mkdir(path.join(folder, 'a', 'x'), { recursive: true });
      await writeFile(path.join(folder, 'a', 'x', 'package.json'), '{"name":"x",');
      const refusal = await workspacePackages(folder)
        .then(() => 'listed')
        .catch(String);
      expect([refusal.includes('"status":1'), refusal.includes('ERR_PNPM_JSON_PARSE'), refusal.includes('a/x/package.json')]).toStrictEqual(
        [true, true, true],
      );
    });
  });

  test('answers the same packages through a symlink to the root', async () => {
    expect.hasAssertions();
    await inWorkspaceFolder('linked-', '{}', async (folder) => {
      const link = `${folder}-link`;
      try {
        await mkdir(path.join(folder, 'a', 'x'), { recursive: true });
        await writeFile(path.join(folder, 'a', 'x', 'package.json'), '{"name":"x"}');
        await symlink(folder, link);
        await expect(workspacePackages(link)).resolves.toStrictEqual([
          { dir: '', name: undefined },
          { dir: 'a/x/', name: 'x' },
        ]);
      } finally {
        await rm(link, { force: true });
      }
    });
  });
});

describe("a checkout's manifests", () => {
  test('refuses a member manifest that is not JSON where pnpm lists the workspace, naming that file alone', async () => {
    expect.hasAssertions();
    await inWorkspaceFolder('unparsed-', '{}', async (folder) => {
      await mkdir(path.join(folder, 'a', 'x'), { recursive: true });
      await mkdir(path.join(folder, 'a', 'y'), { recursive: true });
      await writeFile(path.join(folder, 'a', 'x', 'package.json'), '{"name":');
      await writeFile(path.join(folder, 'a', 'y', 'package.json'), manifest('sytem'));
      const refusal = await refusalOf(population(folder));
      expect([
        refusal.startsWith('PopulationError: pnpm could not list the workspace'),
        ['ERR_PNPM_JSON_PARSE', 'a/x/package.json', 'a/y/'].map((part) => refusal.includes(part)),
      ]).toStrictEqual([true, [true, true, false]]);
    });
  });

  test('reaches the reading of the manifests with one pnpm reads and JSON.parse refuses, and names it', async () => {
    expect.hasAssertions();
    await inWorkspaceFolder('marked-', '{}', async (folder) => {
      await mkdir(path.join(folder, 'a', 'x'), { recursive: true });
      await writeFile(path.join(folder, 'a', 'x', 'package.json'), `${BOM}${manifest('view')}`);
      const [refusal, causes] = await causedRefusal(population(folder));
      expect([refusal, causes.map((cause) => cause.startsWith('ConfigError: a/x/package.json is not JSON: SyntaxError'))]).toStrictEqual([
        "ConfigError: the manifests a/x/package.json (ConfigError: a/x/package.json is not JSON: SyntaxError) cannot be read; each refusal is also this one's cause",
        [true],
      ]);
    });
  });
});

describe("pnpm's listing", () => {
  test('lists a workspace whose packageManager names another pnpm, fetching nothing', async () => {
    expect.hasAssertions();
    const pinning = JSON.stringify({ packageManager: `pnpm@${await anotherPnpm()}` });
    await inWorkspaceFolder('managed-', pinning, async (folder) => {
      const data = `${folder}-data`;
      try {
        vi.stubEnv('XDG_DATA_HOME', data);
        vi.stubEnv('npm_config_registry', 'http://127.0.0.1:9/');
        vi.stubEnv('npm_config_fetch_retries', '0');
        await expect(workspacePackages(folder)).resolves.toStrictEqual([{ dir: '', name: undefined }]);
      } finally {
        await rm(data, { force: true, recursive: true });
      }
    });
  });
});

describe("pnpm's answer", () => {
  test("reads each package's path relative to the workspace and its name, none where pnpm gives no string, and refuses a path that is no string", () => {
    expect.hasAssertions();
    expect(packagesOf(answer(['/w', '/w/a/x']), '/w')).toStrictEqual([
      { dir: '', name: 'x' },
      { dir: 'a/x/', name: 'x' },
    ]);
    expect(packagesOf(JSON.stringify([{ path: '/w/a' }, { name: 1, path: '/w/b' }]), '/w')).toStrictEqual([
      { dir: 'a/', name: undefined },
      { dir: 'b/', name: undefined },
    ]);
    expect(() => packagesOf(answer([undefined]), '/w')).toThrow(new ConfigError('pnpm ls entry 0 ("x") path is not a string: undefined'));
  });
});
