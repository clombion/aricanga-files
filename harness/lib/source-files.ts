/**
 * The repository's file listing: every scan of the harness reads its files from here.
 *
 * The listing is git's: tracked files plus the untracked files git does not ignore, so a scan sees a
 * new file before it is committed. A listing below `FLOOR` files is an error, never an empty scan.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './paths.ts';
import { run } from './process.ts';

/** The fewest files a listing of this repository can hold; fewer means the listing failed. */
export const FLOOR = 50;

export class ListingError extends Error {
  override readonly name = 'ListingError';
}

/** Parse `git ls-files -z` output into the existing files' POSIX paths, refusing a short listing. */
export function listing(stdout: string, root: string, floor: number = FLOOR): readonly string[] {
  const paths = [...new Set(stdout.split('\0'))]
    .filter((path) => path !== '' && existsSync(join(root, path)) && statSync(join(root, path)).isFile())
    .toSorted();
  if (paths.length < floor) {
    throw new ListingError(`git listed ${paths.length} files under ${root}, below the floor of ${floor}`);
  }
  return paths;
}

const cache = new Map<string, readonly string[]>();

/** Every file git tracks or would track under `root`, as POSIX paths relative to it. */
export function tracked(root: string = REPO_ROOT): readonly string[] {
  const hit = cache.get(root);
  if (hit !== undefined) {
    return hit;
  }
  const outcome = run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    timeoutMs: 60_000,
    cwd: root,
  });
  if (outcome.kind !== 'finished' || outcome.status !== 0) {
    throw new ListingError(`git could not list ${root}: ${JSON.stringify(outcome)}`);
  }
  const found = listing(outcome.stdout, root);
  cache.set(root, found);
  return found;
}

/** The text of a listed file; bytes that are not UTF-8 read as replacement characters. */
export function textOf(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}
