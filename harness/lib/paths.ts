/** The repository's root, computed here and nowhere else in the harness. */

import { join, relative as relativePath, resolve, sep } from 'node:path';

export const REPO_ROOT: string = resolve(import.meta.dirname, '..', '..');

/** A path under the repository root. */
export function fromRoot(...parts: string[]): string {
  return join(REPO_ROOT, ...parts);
}

/** `path` relative to the repository root, in POSIX form. */
export function relative(path: string): string {
  return relativePath(REPO_ROOT, resolve(path)).split(sep).join('/');
}
