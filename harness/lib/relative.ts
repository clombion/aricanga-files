/** A path relative to a given root, in POSIX form: the one conversion every report reader uses. */

import path from 'node:path';

/**
 * The path of `target` relative to `root`, with forward slashes.
 *
 * @param {string} root - The directory the result is relative to.
 * @param {string} target - The path to express relative to `root`.
 * @returns {string} The relative path in POSIX form.
 */
function relativeTo(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join('/');
}

export { relativeTo };
