/**
 * The one matcher of tool globs against repository-relative paths, so every check and every project
 * lint rule reads a glob the same way. It lives beside the rules because oxlint's plugin host
 * resolves only `#lint-rules/*`; the harness imports it from here.
 *
 * A harness glob is read from the repository's root (`matches`), and a trailing `/**` also matches
 * the directory's own path prefix. The reading is minimatch's under fixed options (`READING`), the
 * same on every platform and Node version, and each glob is compiled once however often it is read.
 * oxlint reads each of its two glob fields its own way, and a glob written into one is read as that
 * field reads it (`fieldMatches`): an override's `files` anchors `./x` at the root and matches files
 * only; `ignorePatterns` is gitignore's, anchoring `/x` and covering a matched directory's files;
 * each field reads the other's anchor as matching nothing, and a slashless glob at any depth. So a
 * root name is anchored by its field's own spelling, and a glob with the other field's spelling is
 * read as the dead glob oxlint reads.
 */

import { Minimatch } from 'minimatch';
import { Vocabulary } from '#lint-rules/exemptions.ts';
import path from 'node:path';

/** An oxlint configuration field that holds globs: an override's `files`, or `ignorePatterns`. */
type OxlintField = 'files' | 'ignorePatterns';

/** How an oxlint override's `files` anchors a glob at the root (`/x` matches nothing there). */
const FILES_ANCHOR = './';

/** How oxlint's `ignorePatterns` anchors a pattern at the root (`./x` matches nothing there). */
const IGNORE_ANCHOR = '/';

/** Each oxlint field's anchor. */
const ANCHORS: Vocabulary<Readonly<Record<OxlintField, string>>> = new Vocabulary<Readonly<Record<OxlintField, string>>>({
  files: FILES_ANCHOR,
  ignorePatterns: IGNORE_ANCHOR,
});

/** The suffix of a glob that matches a directory's whole subtree. */
const SUBTREE = '/**';

/** The stars of a subtree glob, dropped to read it as a prefix: the directory and its slash. */
const SUBTREE_STARS = /\*\*$/u;

/** A trailing slash, which marks a gitignore pattern as a directory's and does not anchor it. */
const TRAILING_SLASH = /\/$/u;

/**
 * How a harness glob is read: POSIX paths, a backslash read as a slash, case kept, a leading `!` or
 * `#` read as a literal, on every platform. These are Node's `path.matchesGlob` options with its
 * platform dependence removed.
 */
const READING = {
  nocomment: true,
  nonegate: true,
  optimizationLevel: 2,
  platform: 'linux',
  windowsPathsNoEscape: true,
} as const;

/** Each glob read so far, as its compiled test of a path: one entry per distinct glob, kept for the process. */
const COMPILED = new Map<string, (target: string) => boolean>();

/**
 * A glob's test of a path, compiled under `READING` the first time the glob is read and taken from
 * `COMPILED` after.
 *
 * @param {string} glob - The glob.
 * @returns {(target: string) => boolean} Whether the glob matches a repository-relative path.
 */
function compiled(glob: string): (target: string) => boolean {
  const known = COMPILED.get(glob);
  if (known !== undefined) {
    return known;
  }
  const reading = new Minimatch(glob, READING);
  const test = (target: string): boolean => reading.match(target);
  COMPILED.set(glob, test);
  return test;
}

/**
 * Whether a POSIX glob of the harness matches a repository-relative path, read from the root.
 *
 * @param {string} glob - The glob.
 * @param {string} target - The repository-relative path.
 * @returns {boolean} Whether the glob matches the path.
 */
function matches(glob: string, target: string): boolean {
  if (compiled(glob)(target)) {
    return true;
  }
  return glob.endsWith(SUBTREE) && target.startsWith(glob.replace(SUBTREE_STARS, ''));
}

/**
 * A path and every directory above it, the path first.
 *
 * @param {string} target - The repository-relative path.
 * @returns {readonly string[]} The path and its ancestors.
 */
function selfAndAncestors(target: string): readonly string[] {
  const parent = path.posix.dirname(target);
  return parent === '.' ? [target] : [target, ...selfAndAncestors(parent)];
}

/**
 * Whether a glob written into an oxlint field matches a repository-relative path, as oxlint reads
 * that field: the field's own anchor anchors it at the root, the other field's matches nothing, a
 * glob holding a slash (a trailing one aside) is read from the root, and a slashless one at any
 * depth; an ignore pattern matching a directory covers the files below it.
 *
 * @param {OxlintField} field - The field the glob is written in.
 * @param {string} glob - The glob.
 * @param {string} target - The repository-relative path of a file.
 * @returns {boolean} Whether oxlint's field matches the file.
 */
function fieldMatches(field: OxlintField, glob: string, target: string): boolean {
  const own = ANCHORS.of(field);
  const anchored = glob.startsWith(own);
  if (!anchored && ANCHORS.words.some((other) => glob.startsWith(ANCHORS.of(other)))) {
    return false;
  }
  const body = (anchored ? glob.slice(own.length) : glob).replace(TRAILING_SLASH, '');
  const pattern = anchored || body.includes('/') ? body : `**/${body}`;
  const candidates = field === 'ignorePatterns' ? selfAndAncestors(target) : [target];
  return candidates.some((candidate) => matches(pattern, candidate));
}

export { FILES_ANCHOR, fieldMatches, IGNORE_ANCHOR, matches };
export type { OxlintField };
