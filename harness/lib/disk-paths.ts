/**
 * What the disk holds beneath the session's virtual file system (`virtual-files.ts`), and which served
 * paths could change what a project over the disk's own files reads: a path the disk holds; a new path
 * in a directory the disk holds (a nearer index, an extension TypeScript tries first, a `package.json`);
 * a new path in a `node_modules` directory the disk holds, or one that adds such a directory to a
 * directory the disk holds (a nearer package). A new path anywhere else is below a directory no real
 * module resolves into.
 */

import { realpathSync, statSync } from 'node:fs';
import nodePath from 'node:path';

/** The directory a package manager installs into, which a module's resolution walks up through. */
const INSTALLED = 'node_modules';

/**
 * What the disk holds at a path: a file, a directory with its real path, or nothing.
 *
 * @param {string} name - An absolute path.
 * @returns {Readonly<{ file: boolean; real: string }> | undefined} The entry, or none.
 */
function onDisk(name: string): Readonly<{ file: boolean; real: string }> | undefined {
  // oxlint-disable-next-line node/no-sync -- TypeScript's file system callbacks are synchronous: its server waits on each answer
  const entry = statSync(name, { throwIfNoEntry: false });
  // oxlint-disable-next-line node/no-sync -- TypeScript's file system callbacks are synchronous: its server waits on each answer
  return entry === undefined ? undefined : { file: entry.isFile(), real: entry.isFile() ? name : realpathSync(name) };
}

/**
 * The directories above a path, nearest first, the root excluded.
 *
 * @param {string} name - An absolute path.
 * @returns {readonly string[]} Its ancestor directories.
 */
function ancestors(name: string): readonly string[] {
  const found: string[] = [];
  for (let dir = nodePath.dirname(name); dir !== nodePath.dirname(dir); dir = nodePath.dirname(dir)) {
    found.push(dir);
  }
  return found;
}

/**
 * Whether serving `name` could change what a project over the disk's own files reads (the module's
 * doc comment): the disk holds it, its directory is one the disk holds, or it sits in or adds a
 * `node_modules` directory below the nearest directory the disk holds.
 *
 * @param {string} name - An absolute path.
 * @returns {boolean} Whether it could.
 */
function reachesDisk(name: string): boolean {
  if (onDisk(name) !== undefined) {
    return true;
  }
  const nearest = ancestors(name).find((dir) => onDisk(dir) !== undefined) ?? nodePath.parse(name).root;
  const [added = name] = nodePath.relative(nearest, name).split(nodePath.sep);
  return nodePath.dirname(name) === nearest || added === INSTALLED || nearest.split(nodePath.sep).includes(INSTALLED);
}

export { ancestors, onDisk, reachesDisk };
