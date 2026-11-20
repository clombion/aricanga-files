/** A path relative to a given root, in POSIX form: the one conversion every report reader uses. */

import { relative, sep } from 'node:path';

export function relativeTo(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}
