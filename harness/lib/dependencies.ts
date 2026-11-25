/** The dependencies a manifest declares: every group pnpm reads one from, by any spec. */

import type { Fields } from './manifests.ts';

/** Every manifest group pnpm reads a dependency from. */
const DEPENDENCY_GROUPS: readonly string[] = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

/**
 * The packages a manifest declares a dependency on, in any group, by any spec (`workspace:`, `link:`, a range).
 *
 * @param {Fields} manifest - The manifest's fields.
 * @returns {readonly string[]} The names, in the order the groups declare them.
 */
function dependencyNames(manifest: Fields): readonly string[] {
  return DEPENDENCY_GROUPS.flatMap((group) => {
    const deps: unknown = manifest[group];
    return typeof deps === 'object' && deps !== null ? Object.keys(deps) : [];
  });
}

export { dependencyNames };
