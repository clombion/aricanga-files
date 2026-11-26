/** The population tests' oracles: what the population must hold, computed from a source other than the population. */

import { POC } from '#lib/scope.ts';
import type { Population } from '#lib/scope.ts';
import { dirOfImporter } from '#lib/package-dirs.ts';
import { lockOf } from '#lib/pins.ts';

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

export { missedImporters };
