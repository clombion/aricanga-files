/** The one matcher of tool globs against listed paths, so every check reads a glob the same way. */

import { matchesGlob } from 'node:path';

/** Whether a POSIX glob of a tool's configuration matches a repository-relative path. */
export function matches(glob: string, path: string): boolean {
  const pattern = glob.startsWith('./') ? glob.slice(2) : glob;
  return matchesGlob(path, pattern) || (pattern.endsWith('/**') && path.startsWith(pattern.slice(0, -2)));
}

/** The globs that match none of `paths`. */
export function dead(globs: readonly string[], paths: readonly string[]): string[] {
  return globs.filter((glob) => !paths.some((path) => matches(glob, path)));
}
