/**
 * The answer pnpm gives to "which packages are in this workspace", read as each package's directory
 * and name (the population names every package as pnpm lists it, from the manifest pnpm parses), and
 * `PopulationError`, the refusal of a population's own states: pnpm could not list it (a manifest
 * it cannot parse among them, the first one named alone), a role word names no role, a planted
 * population holds what production never holds. pnpm is the source of the population's members
 * (`scope.ts`).
 */

import { list, object, parsed, stringOf } from './config.ts';
import type { Dir } from './package-dirs.ts';
import { dirOf } from './package-dirs.ts';
import { listingOutput } from './source-files.ts';
import { realpath } from 'node:fs/promises';
import { relativeTo } from './relative.ts';

/** A refusal of a population: pnpm could not list the workspace, a member's role is refused, or a planted population holds what production never holds. */
class PopulationError extends Error {
  public override readonly name = 'PopulationError';
}

/** A workspace package as pnpm lists it: its directory, and the name its manifest declares (none when it declares no string). */
interface WorkspacePackage {
  readonly dir: Dir;
  readonly name: string | undefined;
}

/**
 * The packages of `pnpm ls --json`'s output, each with its directory relative to the workspace's
 * realpath and its name. An entry whose `path` is no string is refused, naming the entry by its place
 * and its name.
 *
 * @param {string} stdout - pnpm's output.
 * @param {string} base - The workspace root's realpath.
 * @returns {readonly WorkspacePackage[]} Each package.
 */
function packagesOf(stdout: string, base: string): readonly WorkspacePackage[] {
  return list(parsed(stdout, 'pnpm ls'), 'pnpm ls').map((entry, index) => {
    const fields = object(entry, `pnpm ls entry ${index}`);
    const name: unknown = fields['name'];
    const where = stringOf(fields['path'], `pnpm ls entry ${index} (${JSON.stringify(name)}) path`);
    return { dir: dirOf(relativeTo(base, where)), name: typeof name === 'string' ? name : undefined };
  });
}

/**
 * The workspace packages pnpm lists at a root, each with its directory relative to it and its name. pnpm answers realpaths,
 * so they are related to the root's realpath. The listing reads only this machine: pnpm's managed
 * package-manager versions are off for it, so a pnpm that differs from `packageManager` lists the
 * workspace itself instead of fetching the pinned pnpm first.
 *
 * @param {string} root - The workspace root.
 * @returns {Promise<readonly WorkspacePackage[]>} Each package.
 */
async function workspacePackages(root: string): Promise<readonly WorkspacePackage[]> {
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
export type { WorkspacePackage };
