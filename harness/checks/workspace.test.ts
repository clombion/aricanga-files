/** The workspace packages pnpm lists: listed relative to the root's realpath, and refused with pnpm's own reason. */

import { describe, expect, test } from 'vitest';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { packagesOf, workspacePackages } from '#lib/workspace.ts';
import { ConfigError } from '#lib/config.ts';
import path from 'node:path';
import { workspaceFolder } from './scope.plants.ts';

/**
 * The JSON answer pnpm gives, listing packages at the given paths.
 *
 * @param {readonly unknown[]} paths - Each package's path.
 * @returns {string} The answer's text.
 */
function answer(paths: readonly unknown[]): string {
  return JSON.stringify(paths.map((where) => ({ name: 'x', path: where })));
}

describe('pnpm', () => {
  test("refuses a workspace whose root manifest is broken, naming the root and pnpm's reason, which pnpm writes to stderr", async () => {
    expect.hasAssertions();
    const folder = await workspaceFolder('unlistable-', '{');
    try {
      const refusal = await workspacePackages(folder)
        .then(() => 'listed')
        .catch(String);
      expect([
        refusal.startsWith(`PopulationError: pnpm could not list the workspace at ${folder}: `),
        refusal.includes('"status":1'),
        refusal.includes("while parsing '{'"),
      ]).toStrictEqual([true, true, true]);
    } finally {
      await rm(folder, { force: true, recursive: true });
    }
  });

  test("refuses a workspace whose member manifest is broken with pnpm's reason, which pnpm writes to stdout", async () => {
    expect.hasAssertions();
    const folder = await workspaceFolder('broken-member-', '{}');
    try {
      await mkdir(path.join(folder, 'a', 'x'), { recursive: true });
      await writeFile(path.join(folder, 'a', 'x', 'package.json'), '{"name":"x",');
      const refusal = await workspacePackages(folder)
        .then(() => 'listed')
        .catch(String);
      expect([refusal.includes('"status":1'), refusal.includes('ERR_PNPM_JSON_PARSE'), refusal.includes('a/x/package.json')]).toStrictEqual(
        [true, true, true],
      );
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

describe("pnpm's answer", () => {
  test("reads each package's path relative to the workspace, and refuses a path that is no string", () => {
    expect.hasAssertions();
    expect(packagesOf(answer(['/w', '/w/a/x']), '/w')).toStrictEqual(['', 'a/x/']);
    expect(() => packagesOf(answer([undefined]), '/w')).toThrow(new ConfigError('a pnpm package path is not a string: undefined'));
  });
});
