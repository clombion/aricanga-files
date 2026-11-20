/** The repository's root, computed here and nowhere else in the harness. */

import { dirname, join, relative as relativePath, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A path under the repository root. */
export function fromRoot(...parts: string[]): string {
  return join(REPO_ROOT, ...parts);
}

/** `path` relative to the repository root, in POSIX form. */
function relative(path: string): string {
  return relativePath(REPO_ROOT, resolve(path)).split(sep).join('/');
}
