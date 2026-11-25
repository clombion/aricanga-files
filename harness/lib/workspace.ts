/**
 * The answer pnpm gives to "which packages are in this workspace", read as directories, and the refusal of a
 * population that cannot be read. pnpm is the source of the population's members (`scope.ts`).
 */

import { list, object, parsed, stringOf } from './config.ts';
import type { Dir } from './package-dirs.ts';
import { dirOf } from './package-dirs.ts';
import { listingOutput } from './source-files.ts';
import { realpath } from 'node:fs/promises';
import { relativeTo } from './relative.ts';

/** A refusal of a population that cannot be read: pnpm failed, or a member's role is refused. */
class PopulationError extends Error {
  public override readonly name = 'PopulationError';
}

/**
 * The packages of `pnpm ls --json`'s output, as directories relative to the workspace's realpath.
 * An entry whose `path` is no string is refused.
 *
 * @param {string} stdout - pnpm's output.
 * @param {string} base - The workspace root's realpath.
 * @returns {readonly Dir[]} Each package's directory.
 */
function packagesOf(stdout: string, base: string): readonly Dir[] {
  return list(parsed(stdout, 'pnpm ls'), 'pnpm ls').map((entry) => {
    const where = stringOf(object(entry, 'a pnpm package')['path'], 'a pnpm package path');
    return dirOf(relativeTo(base, where));
  });
}

/**
 * The workspace packages pnpm lists at a root, as directories relative to it. pnpm answers realpaths,
 * so they are related to the root's realpath. The listing reads only this machine: pnpm's managed
 * package-manager versions are off for it, so a pnpm that differs from `packageManager` lists the
 * workspace itself instead of fetching the pinned pnpm first.
 *
 * @param {string} root - The workspace root.
 * @returns {Promise<readonly Dir[]>} Each package's directory.
 */
async function workspacePackages(root: string): Promise<readonly Dir[]> {
  const [stdout, base] = await Promise.all([
    listingOutput(
      ['pnpm', 'ls', '-r', '--depth', '-1', '--json', '--config.manage-package-manager-versions=false'],
      root,
      (outcome) => new PopulationError(`pnpm could not list the workspace at ${root}: ${outcome}`),
    ),
    realpath(root),
  ]);
  return packagesOf(stdout, base);
}

export { packagesOf, PopulationError, workspacePackages };
