/**
 * A workspace package's spelling: its directory (`''` for the root, `<path>/` for a member), the
 * manifest and the lockfile importer derived from it, and the nearest root holding a path. Every
 * module that names a package by directory, manifest or importer converts here, never by hand.
 */

/** A member's directory: relative to the root, ending in `/`. */
type MemberDir = `${string}/`;

/** A workspace package's directory: the root is `''`, a member's is a `MemberDir`. */
type Dir = '' | MemberDir;

/** A package's manifest file. */
const MANIFEST = 'package.json';

/** The root's importer, as pnpm names it. */
const ROOT_IMPORTER = '.';

/** A directory's closing `/`. */
const CLOSING_SLASH = /\/$/u;

/**
 * The directory of a path relative to the root.
 *
 * @param {string} relative - The path, `''` for the root.
 * @returns {Dir} Its directory.
 */
function dirOf(relative: string): Dir {
  return relative === '' ? '' : `${relative}/`;
}

/**
 * A package's manifest.
 *
 * @param {Dir} dir - The package's directory.
 * @returns {string} Its `package.json`, relative to the root.
 */
function manifestOf(dir: Dir): string {
  return `${dir}${MANIFEST}`;
}

/**
 * A package's lockfile importer: pnpm's `.` for the root, its directory without the `/` otherwise.
 * `dirOfImporter` is its inverse: `dirOfImporter(importerOf(dir)) === dir` for every directory.
 *
 * @param {Dir} dir - The package's directory.
 * @returns {string} Its importer.
 */
function importerOf(dir: Dir): string {
  return dir === '' ? ROOT_IMPORTER : dir.replace(CLOSING_SLASH, '');
}

/**
 * The directory of a lockfile importer; the inverse of `importerOf`.
 *
 * @param {string} importer - The importer.
 * @returns {Dir} Its directory.
 */
function dirOfImporter(importer: string): Dir {
  return importer === ROOT_IMPORTER ? '' : dirOf(importer);
}

/**
 * The item whose root holds a path, the nearest when roots nest.
 *
 * @param {readonly Item[]} items - The items.
 * @param {(item: Item) => string} rootOf - Each item's root, ending in `/`.
 * @param {string} target - A repository-relative path.
 * @returns {Item | undefined} The item with the longest root that starts the path.
 */
function nearest<Item>(items: readonly Item[], rootOf: (item: Item) => string, target: string): Item | undefined {
  return items.toSorted((left, right) => rootOf(right).length - rootOf(left).length).find((item) => target.startsWith(rootOf(item)));
}

export { dirOf, dirOfImporter, importerOf, manifestOf, nearest };
export type { Dir, MemberDir };
