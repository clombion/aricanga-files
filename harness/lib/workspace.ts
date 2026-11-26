/**
 * The answer pnpm gives to "which packages are in this workspace", read as each package's directory
 * and name (the population names every package by the `name` pnpm lists from the manifest it
 * parses, read by `packageName`), and `PopulationError`, the refusal of a population's own states:
 * pnpm could not list it (a manifest it cannot parse among them, the first one named alone), a
 * package's name is present and no string, a role word names no role, a held module is not
 * TypeScript, a root of an owner rule is held twice (a member at the harness's root), and a planted
 * population holds what production never holds. pnpm is the source of the population's members
 * (`scope.ts`).
 */

import { dirOf, manifestOf } from './package-dirs.ts';
import { list, object, parsed, stringOf } from './config.ts';
import type { Dir } from './package-dirs.ts';
import { Vocabulary } from './exemptions.ts';
import { listingOutput } from './source-files.ts';
import { realpath } from 'node:fs/promises';
import { relativeTo } from './relative.ts';

/** A state a population is refused for, by its key in `POPULATION_CASES`. */
type PopulationCase = 'kind' | 'listing' | 'name' | 'planted' | 'role' | 'root';

/**
 * Each state a population is refused for, by the words `PopulationError`'s docstring documents it by:
 * a refusal names its state, so a state the docstring does not name has no case to be thrown for.
 */
const POPULATION_CASES: Vocabulary<Readonly<Record<PopulationCase, string>>> = new Vocabulary<Readonly<Record<PopulationCase, string>>>({
  kind: 'a held module is not TypeScript',
  listing: 'pnpm could not list the workspace',
  name: "a package's name is no string",
  planted: 'a planted population holds what production never holds',
  role: "a member's role is refused",
  root: "a member sits at the harness's root",
});

/**
 * A refusal of a population: pnpm could not list the workspace, a package's name is no string, a
 * member's role is refused, a held module is not TypeScript, a member sits at the harness's root, or a
 * planted population holds what production never holds.
 */
class PopulationError extends Error {
  public override readonly name = 'PopulationError';

  /** The state it is thrown for. */
  public readonly state: PopulationCase;

  /**
   * A refusal of a population's state.
   *
   * @param {PopulationCase} state - The state it is thrown for.
   * @param {string} message - What it says.
   * @param {Readonly<ErrorOptions>} options - Its cause, if any.
   */
  public constructor(state: PopulationCase, message: string, options?: Readonly<ErrorOptions>) {
    super(message, options);
    this.state = state;
  }
}

/** A workspace package as pnpm lists it: its directory, and the name its manifest declares (none when it declares none). */
interface WorkspacePackage {
  readonly dir: Dir;
  readonly name: string | undefined;
}

/**
 * The refusal of a manifest's `name` that is present and no string (`packageName`'s), or none.
 *
 * @param {unknown} name - The manifest's `name`.
 * @param {string} manifest - The manifest's path.
 * @returns {PopulationError | undefined} The refusal, or none.
 */
function nameRefusal(name: unknown, manifest: string): PopulationError | undefined {
  return name === undefined || typeof name === 'string'
    ? undefined
    : new PopulationError('name', `${manifest}: the name ${JSON.stringify(name)} is no string: a package's name is a string, or none`);
}

/**
 * A package's name, read by the one reader of a manifest's `name` every other asks: the string the
 * manifest declares, none when it declares none, and a `PopulationError` naming the manifest when the
 * `name` it declares is no string (pnpm lists any value it finds there).
 * The claim's probe (`claims.ts`) refuses a second statement of the rule in the harness's library and
 * scripts: the refusal's words, or a narrowing of a name to a string by `typeof`. A reader that
 * narrows by another means (`stringOf`, a schema) is beyond it, a known limit: the readers that exist
 * ask this one, held by the doc-references and planted-population tests.
 *
 * @param {unknown} name - The manifest's `name`, as pnpm lists it or as the manifest holds it.
 * @param {string} manifest - The manifest's path, for the refusal.
 * @returns {string | undefined} The name, or none.
 */
function packageName(name: unknown, manifest: string): string | undefined {
  const refusal = nameRefusal(name, manifest);
  if (refusal !== undefined) {
    throw refusal;
  }
  return typeof name === 'string' ? name : undefined;
}

/**
 * The packages of `pnpm ls --json`'s output, each with its directory relative to the workspace's
 * realpath and its name (`packageName`). An entry whose `path` is no string is refused, naming the
 * entry by its place and its name.
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
    const dir = dirOf(relativeTo(base, where));
    return { dir, name: packageName(name, manifestOf(dir)) };
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
      (outcome) => new PopulationError('listing', `pnpm could not list the workspace at ${root}: ${outcome}`),
    ),
    realpath(root),
  ]);
  return packagesOf(stdout, base);
}

export { nameRefusal, packageName, packagesOf, POPULATION_CASES, PopulationError, workspacePackages };
export type { WorkspacePackage };
