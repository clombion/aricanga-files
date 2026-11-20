/** The one matcher of tool globs against listed paths, so every check reads a glob the same way. */

import path from 'node:path';

/** The prefix a tool may write before a repository-relative glob. */
const DOT_SLASH = './';

/** The suffix of a glob that matches a directory's whole subtree. */
const SUBTREE = '/**';

/** The stars of a subtree glob, dropped to read it as a prefix: the directory and its slash. */
const SUBTREE_STARS = /\*\*$/u;

/**
 * Whether a POSIX glob of a tool's configuration matches a repository-relative path.
 *
 * @param {string} glob - The tool's glob.
 * @param {string} target - The repository-relative path.
 * @returns {boolean} Whether the glob matches the path.
 */
function matches(glob: string, target: string): boolean {
  const pattern = glob.startsWith(DOT_SLASH) ? glob.slice(DOT_SLASH.length) : glob;
  if (path.matchesGlob(target, pattern)) {
    return true;
  }
  return pattern.endsWith(SUBTREE) && target.startsWith(pattern.replace(SUBTREE_STARS, ''));
}

/**
 * The globs that match none of `paths`.
 *
 * @param {readonly string[]} globs - The tool's globs.
 * @param {readonly string[]} paths - The repository-relative paths.
 * @returns {string[]} The globs no path matches.
 */
function dead(globs: readonly string[], paths: readonly string[]): string[] {
  return globs.filter((glob) => !paths.some((target) => matches(glob, target)));
}

export { dead, matches };
