/** The repository's root, computed here and nowhere else in the harness. */

import path from 'node:path';

/** The repository's root directory. */
const REPO_ROOT: string = path.resolve(import.meta.dirname, '..', '..');

/**
 * A path under the repository root.
 *
 * @param {readonly string[]} parts - The path's segments under the root.
 * @returns {string} The joined path.
 */
function fromRoot(...parts: readonly string[]): string {
  return path.join(REPO_ROOT, ...parts);
}

/**
 * A path relative to the repository root, in POSIX form.
 *
 * @param {string} target - The path, absolute or relative to the working directory.
 * @returns {string} The path relative to the root.
 */
function relative(target: string): string {
  return path.relative(REPO_ROOT, path.resolve(target)).split(path.sep).join('/');
}

export { fromRoot, relative, REPO_ROOT };
