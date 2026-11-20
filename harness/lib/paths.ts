/** The repository's root, computed here and nowhere else in the harness. */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT: string = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A path under the repository root. */
export function fromRoot(...parts: string[]): string {
  return join(REPO_ROOT, ...parts);
}
