/**
 * The directly declared packages the lockfile locks at two or more versions, read from the lockfile the pins read
 * (`pins.ts`'s `lockOf`), over every importer pnpm wrote: the tool-upgrades check refuses any.
 *
 * A package two or more manifests name is written once, in `pnpm-workspace.yaml`'s catalog, and each of those
 * manifests writes `catalog:`; nothing refuses a literal version beside it, which pnpm 10.28 installs as a second
 * version, so this reads what was locked. A `link:` version is a workspace package, not a published one, and is
 * skipped. That a package two manifests name is in the catalog is not checked: one stated literally in two manifests
 * at one version passes, and a split of it is refused here all the same.
 */

import { LOCKFILE, lockOf } from './pins.ts';
import { byCodeUnit } from './lists.ts';
import { textOf } from './source-files.ts';

/** The version pnpm writes for a workspace package an importer links. */
const LINK = 'link:';

/** The number of versions a package locked at one version has. */
const ONE_VERSION = 1;

/**
 * Each directly declared package of a lockfile, by name, with the importers that lock it, by version; `link:` versions left out.
 *
 * @param {string} lockText - The lockfile's text.
 * @returns {ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>} The importers, by version, by package.
 */
function lockedBy(lockText: string): ReadonlyMap<string, ReadonlyMap<string, readonly string[]>> {
  const byName = new Map<string, Map<string, readonly string[]>>();
  for (const [importer, versions] of lockOf(lockText)) {
    for (const [name, version] of versions) {
      if (!version.startsWith(LINK)) {
        const importers = byName.get(name) ?? new Map<string, readonly string[]>();
        importers.set(version, [...(importers.get(version) ?? []), importer]);
        byName.set(name, importers);
      }
    }
  }
  return byName;
}

/**
 * The packages a lockfile locks at two or more versions, each as `<name>: <version> (<importers>), <version> (<importers>)`,
 * by name, its versions and importers by code unit.
 *
 * @param {string} lockText - The lockfile's text.
 * @returns {readonly string[]} One line per split package; none when every package is locked at one version.
 */
function lockSplits(lockText: string): readonly string[] {
  return [...lockedBy(lockText).entries()]
    .filter(([, versions]: readonly [string, ReadonlyMap<string, readonly string[]>]) => versions.size > ONE_VERSION)
    .toSorted(([left]: readonly [string, unknown], [right]: readonly [string, unknown]) => byCodeUnit(left, right))
    .map(([name, versions]: readonly [string, ReadonlyMap<string, readonly string[]>]) => {
      const locked = [...versions.entries()]
        .toSorted(([left]: readonly [string, unknown], [right]: readonly [string, unknown]) => byCodeUnit(left, right))
        .map(([version, importers]: readonly [string, readonly string[]]) => `${version} (${importers.toSorted(byCodeUnit).join(', ')})`);
      return `${name}: ${locked.join(', ')}`;
    });
}

/**
 * The packages this repository's lockfile locks at two or more versions.
 *
 * @returns {Promise<readonly string[]>} One line per split package.
 */
async function repositoryLockSplits(): Promise<readonly string[]> {
  const lockText = await textOf(LOCKFILE);
  return lockSplits(lockText);
}

export { lockSplits, repositoryLockSplits };
