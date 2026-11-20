/**
 * The repository's file listing: every scan of the harness reads its files from here.
 *
 * The listing is git's: tracked files plus the untracked files git does not ignore, so a scan sees a
 * new file before it is committed. A listing below `FLOOR` files is an error, never an empty scan.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { REPO_ROOT } from './paths.ts';
import path from 'node:path';
import { run } from './process.ts';
import { succeeded } from './output.ts';

/** The fewest files a listing of this repository can hold; fewer means the listing failed. */
const FLOOR = 50;

/** How long git may take to list the repository, in milliseconds. */
const LISTING_TIMEOUT_MS = 60_000;

/** A refusal of a listing git could not give, or gave short. */
class ListingError extends Error {
  public override readonly name = 'ListingError';
}

/**
 * Whether a listed path is an existing file under `root`.
 *
 * @param {string} root - The listed directory.
 * @param {string} listed - The path git listed, relative to `root`.
 * @returns {boolean} Whether it is a file that exists.
 */
function isFile(root: string, listed: string): boolean {
  const full = path.join(root, listed);
  return listed !== '' && existsSync(full) && statSync(full).isFile();
}

/**
 * Parse `git ls-files -z` output into the existing files' POSIX paths, refusing a short listing.
 *
 * @param {string} stdout - The output of `git ls-files -z`.
 * @param {string} root - The listed directory.
 * @param {number} floor - The fewest files the listing may hold.
 * @returns {readonly string[]} The existing files, sorted.
 */
function listing(stdout: string, root: string, floor: number = FLOOR): readonly string[] {
  const paths = [...new Set(stdout.split('\0'))].filter((listed) => isFile(root, listed)).toSorted();
  if (paths.length < floor) {
    throw new ListingError(`git listed ${paths.length} files under ${root}, below the floor of ${floor}`);
  }
  return paths;
}

const cache = new Map<string, readonly string[]>();

/**
 * Every file git tracks or would track under `root`.
 *
 * @param {string} root - The directory to list.
 * @returns {readonly string[]} The files, as POSIX paths relative to `root`.
 */
function tracked(root: string = REPO_ROOT): readonly string[] {
  const hit = cache.get(root);
  if (hit !== undefined) {
    return hit;
  }
  const outcome = run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    timeoutMs: LISTING_TIMEOUT_MS,
  });
  if (outcome.kind !== 'finished' || !succeeded(outcome)) {
    throw new ListingError(`git could not list ${root}: ${JSON.stringify(outcome)}`);
  }
  const found = listing(outcome.stdout, root);
  cache.set(root, found);
  return found;
}

/**
 * The text of a listed file; bytes that are not UTF-8 read as replacement characters.
 *
 * @param {string} listed - The file's repository-relative path.
 * @returns {string} Its text.
 */
function textOf(listed: string): string {
  return readFileSync(path.join(REPO_ROOT, listed), 'utf8');
}

/**
 * Write a file of the repository as UTF-8: the one writer of the repository's own files, for the fixers.
 *
 * @param {string} listed - The file's repository-relative path.
 * @param {string} text - Its new text.
 */
function writeText(listed: string, text: string): void {
  writeFileSync(path.join(REPO_ROOT, listed), text, 'utf8');
}

export { FLOOR, ListingError, listing, textOf, tracked, writeText };
