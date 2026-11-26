/** The packages a `doc-references` reference may name: the listed manifests that carry a name, each with its folder. */

import { object, parsed } from '#lib/config.ts';
import { textsOf, tracked } from '#lib/source-files.ts';
import { dirname } from 'node:path/posix';
import { packageName } from '#lib/workspace.ts';

/**
 * Each manifest that carries a name, the name with its folder; each name read by the rule pnpm's
 * listing is read by (`packageName`), so a name that is no string is refused here as the population
 * refuses it.
 *
 * @param {readonly (readonly [string, string])[]} manifests - Each manifest's path and text.
 * @returns {readonly (readonly [string, string])[]} Each package's name and folder.
 */
function packagesNamed(manifests: readonly (readonly [string, string])[]): readonly (readonly [string, string])[] {
  return manifests.flatMap(([path, text]: readonly [string, string]) => {
    const name = packageName(object(parsed(text, path), path)['name'], path);
    return name === undefined ? [] : [[name, dirname(path)] as const];
  });
}

/**
 * The listed manifests that carry a name, each name with its folder: the packages a reference may
 * name, the POC's included. Membership of the workspace is `harness/lib/scope.ts`'s question.
 *
 * @returns {Promise<readonly (readonly [string, string])[]>} Each package's name and folder.
 */
async function namedPackages(): Promise<readonly (readonly [string, string])[]> {
  const listed = await tracked();
  const texts = await textsOf(listed.filter((path) => path.endsWith('package.json') && !path.includes('node_modules/')));
  return packagesNamed(texts);
}

export { namedPackages, packagesNamed };
