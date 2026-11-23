/**
 * The repository's file listing: every scan of the harness reads its files from here.
 *
 * The listing is git's: tracked files plus the untracked files git does not ignore, so a scan sees a
 * new file before it is committed. A listing below `FLOOR` files is an error, never an empty scan.
 */

import { readFile, stat, writeFile } from 'node:fs/promises';
import { REPO_ROOT } from './paths.ts';
import { isolatedEnv } from './tools.ts';
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
 * @returns {Promise<boolean>} Whether it is a file that exists.
 */
async function isFile(root: string, listed: string): Promise<boolean> {
  if (listed === '') {
    return false;
  }
  try {
    const found = await stat(path.join(root, listed));
    return found.isFile();
  } catch {
    return false;
  }
}

/**
 * Parse `git ls-files -z` output into the existing files' POSIX paths, refusing a short listing.
 *
 * @param {string} stdout - The output of `git ls-files -z`.
 * @param {string} root - The listed directory.
 * @param {number} floor - The fewest files the listing may hold.
 * @returns {Promise<readonly string[]>} The existing files, sorted.
 */
async function listing(stdout: string, root: string, floor: number = FLOOR): Promise<readonly string[]> {
  const candidates = [...new Set(stdout.split('\0'))];
  const exists = await Promise.all(
    candidates.map(async (listed) => {
      const found = await isFile(root, listed);
      return found;
    }),
  );
  const paths = candidates.filter((_listed, index) => exists[index] === true).toSorted();
  if (paths.length < floor) {
    throw new ListingError(`git listed ${paths.length} files under ${root}, below the floor of ${floor}`);
  }
  return paths;
}

/**
 * One computation per root as spelled, started once and shared by every caller of this instance,
 * concurrent first callers included. `compute` starts only after its pending result is cached, so a
 * failure, a throw included, rejects every caller of that computation and leaves the cache: the
 * next call computes again.
 *
 * @param {(root: string) => Promise<Value>} compute - The computation over a root.
 * @returns {(root: string) => Promise<Value>} The computation, remembered per root.
 */
function perRoot<Value>(compute: (root: string) => Promise<Value>): (root: string) => Promise<Value> {
  const cache = new Map<string, Promise<Value>>();
  const computing = async (root: string): Promise<Value> => {
    await Promise.resolve();
    try {
      const found = await compute(root);
      return found;
    } catch (error: unknown) {
      cache.delete(root);
      throw error;
    }
  };
  const remembered = async (root: string): Promise<Value> => {
    const pending = computing(root);
    cache.set(root, pending);
    const found = await pending;
    return found;
  };
  return async (root: string): Promise<Value> => {
    const found = await (cache.get(root) ?? remembered(root));
    return found;
  };
}

/**
 * The output of a bounded listing command, git's listing or pnpm's workspace: one runner, one bound
 * and one environment for both. A command that does not finish within the bound, or exits non-zero,
 * refuses through `refuse`, handed the whole outcome: the status and both streams.
 *
 * @param {readonly string[]} argv - The command and its arguments.
 * @param {string} root - Where it runs.
 * @param {(outcome: string) => Error} refuse - The refusal, given the outcome as JSON.
 * @returns {Promise<string>} Its standard output.
 */
async function listingOutput(argv: readonly string[], root: string, refuse: (outcome: string) => Error): Promise<string> {
  const outcome = await run(argv, { cwd: root, env: isolatedEnv(), timeoutMs: LISTING_TIMEOUT_MS });
  if (outcome.kind !== 'finished' || !succeeded(outcome)) {
    throw refuse(JSON.stringify(outcome));
  }
  return outcome.stdout;
}

/**
 * List `root` through git, refusing a listing git could not give or gave short.
 *
 * @param {string} root - The directory to list.
 * @returns {Promise<readonly string[]>} The files, as POSIX paths relative to `root`.
 */
async function list(root: string): Promise<readonly string[]> {
  const stdout = await listingOutput(
    ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    root,
    (outcome) => new ListingError(`git could not list ${root}: ${outcome}`),
  );
  const found = await listing(stdout, root);
  return found;
}

/** The listing of each root, listed once per root. */
const listings = perRoot(list);

/**
 * Every file git tracks or would track under `root`.
 *
 * @param {string} root - The directory to list.
 * @returns {Promise<readonly string[]>} The files, as POSIX paths relative to `root`.
 */
async function tracked(root: string = REPO_ROOT): Promise<readonly string[]> {
  const found = await listings(root);
  return found;
}

/**
 * The text of a listed file; bytes that are not UTF-8 read as replacement characters.
 *
 * @param {string} file - The file's path relative to `root`.
 * @param {string} root - The listed directory; the repository by default.
 * @returns {Promise<string>} Its text.
 */
async function textOf(file: string, root: string = REPO_ROOT): Promise<string> {
  const text = await readFile(path.join(root, file), 'utf8');
  return text;
}

/**
 * Each listed file with its text, read concurrently, in the order given.
 *
 * @param {readonly string[]} listed - The files' repository-relative paths.
 * @returns {Promise<readonly (readonly [string, string])[]>} Each path with its text.
 */
async function textsOf(listed: readonly string[]): Promise<readonly (readonly [string, string])[]> {
  const texts = await Promise.all(
    listed.map(async (file) => {
      const text = await textOf(file);
      return [file, text] as const;
    }),
  );
  return texts;
}

/**
 * The text of a file outside the listing, such as a tool's report under the system's temporary directory.
 *
 * @param {string} absolute - The file's absolute path.
 * @returns {Promise<string>} Its text.
 */
async function textAt(absolute: string): Promise<string> {
  const text = await readFile(absolute, 'utf8');
  return text;
}

/**
 * Write a file of the repository as UTF-8: the one writer of the repository's own files, for the fixers.
 *
 * @param {string} listed - The file's repository-relative path.
 * @param {string} text - Its new text.
 * @returns {Promise<void>} Settles once the file is written.
 */
async function writeText(listed: string, text: string): Promise<void> {
  await writeFile(path.join(REPO_ROOT, listed), text, 'utf8');
}

export { FLOOR, isFile, ListingError, listing, listingOutput, perRoot, textAt, textOf, textsOf, tracked, writeText };
