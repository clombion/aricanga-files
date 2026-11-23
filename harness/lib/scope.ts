/**
 * What the harness holds: the members (pnpm's workspace packages whose manifests git lists, less the
 * POC record), the harness, and the root files. Every scan asks this module, never a list of its own.
 */

import { Accepted, Prefixes } from './exemptions.ts';
import { ROLE_WORDS, isRole } from './roles.ts';
import { json, list, object, report } from './config.ts';
import { perRoot, textOf, tracked } from './source-files.ts';
import { REPO_ROOT } from './paths.ts';
import type { Role } from './roles.ts';
import { finished } from './tools.ts';
import { isEmpty } from './lists.ts';
import { realpath } from 'node:fs/promises';
import { relativeTo } from './relative.ts';
import { succeeded } from './output.ts';

/** The harness's own place: held, and not a workspace package. */
const HARNESS_ROOT: MemberDir = 'harness/';

/** The POC reference (ADR-0006, "Scope"): read-only, outside the harness until it is deleted. Each entry is a directory. */
const POC: Prefixes = new Prefixes(
  ['packages/framework', 'packages/tests', 'packages/test-utils', 'experiences/aricanga', 'utils'].map((dir) => `${dir}/`),
);

/** Root files the harness holds besides the members and the harness: the configuration the gate reads. */
const ROOT_FILES = new Accepted<string>([
  'package.json',
  'tsconfig.json',
  'tsconfig.base.json',
  '.oxlintrc.json',
  '.oxfmtrc.json',
  'knip.json',
  'lefthook.json',
  '.commitlintrc.json',
  'docs/terms.toml',
  'vitest.gate.config.ts',
  'AGENTS.md',
  'CLAUDE.md',
  'harness.md',
  'HARNESS_STATUS.md',
  '.stylelintrc.json',
  '.node-version',
]);

/** The current text the docs checks read: the agent brief, the harness docs and the roadmap. */
const DOC_ROOTS: readonly string[] = ['docs/roadmap/', 'harness/', 'packages/characterisation/'];

const MANIFEST = 'package.json';

/** A refusal of a population that cannot be read: pnpm failed, or a member's role is missing or names no role. */
class PopulationError extends Error {
  public override readonly name = 'PopulationError';
}

/** A member's directory: relative to the root, ending in `/`. */
type MemberDir = `${string}/`;

/** A workspace package's directory: the root is `''`, a member's is a `MemberDir`. */
type Dir = '' | MemberDir;

/** The root's importer, as pnpm names it. */
const ROOT_IMPORTER = '.';

/** A directory's closing `/`. */
const CLOSING_SLASH = /\/$/u;

/** A held workspace package: its directory and the role its manifest declares. */
interface Member {
  readonly dir: MemberDir;
  readonly role: Role;
}

/** The harness's population over one listing. */
interface Population {
  /** The listing it was computed over. */
  readonly listing: readonly string[];
  /** The members, sorted by directory. */
  readonly members: readonly Member[];
  /** The held directories: every member's and the harness's. */
  readonly roots: readonly MemberDir[];
  /** Whether a listed path is held: a root file, a harness file or a member's file. */
  readonly holds: (path: string) => boolean;
  /** The nearest member holding a path. */
  readonly memberOf: (path: string) => Member | undefined;
}

/** What a population is computed from. */
interface PopulationInputs {
  /** The repository-relative listing. */
  readonly listing: readonly string[];
  /** The workspace packages pnpm lists, by directory. */
  readonly workspace: readonly Dir[];
  /** Reads a listed file's text. */
  readonly read: (listed: string) => Promise<string>;
}

/**
 * The directory of a path relative to the root.
 *
 * @param {string} relative - The path, `''` for the root.
 * @returns {Dir} Its directory.
 */
function dirOf(relative: string): Dir {
  return relative === '' ? '' : `${relative}/`;
}

/**
 * A package's manifest.
 *
 * @param {Dir} dir - The package's directory.
 * @returns {string} Its `package.json`, relative to the root.
 */
function manifestOf(dir: Dir): string {
  return `${dir}${MANIFEST}`;
}

/**
 * A package's lockfile importer: pnpm's `.` for the root, its directory without the `/` otherwise.
 * `dirOfImporter` is its inverse: `dirOfImporter(importerOf(dir)) === dir` for every directory.
 *
 * @param {Dir} dir - The package's directory.
 * @returns {string} Its importer.
 */
function importerOf(dir: Dir): string {
  return dir === '' ? ROOT_IMPORTER : dir.replace(CLOSING_SLASH, '');
}

/**
 * The directory of a lockfile importer; the inverse of `importerOf`.
 *
 * @param {string} importer - The importer.
 * @returns {Dir} Its directory.
 */
function dirOfImporter(importer: string): Dir {
  return importer === ROOT_IMPORTER ? '' : dirOf(importer);
}

/**
 * The item whose root holds a path, the nearest when roots nest.
 *
 * @param {readonly Item[]} items - The items.
 * @param {(item: Item) => string} rootOf - Each item's root, ending in `/`.
 * @param {string} target - A repository-relative path.
 * @returns {Item | undefined} The item with the longest root that starts the path.
 */
function nearest<Item>(items: readonly Item[], rootOf: (item: Item) => string, target: string): Item | undefined {
  return items.toSorted((left, right) => rootOf(right).length - rootOf(left).length).find((item) => target.startsWith(rootOf(item)));
}

/**
 * A member's role, read from its manifest's text.
 *
 * @param {string} manifest - The manifest's path.
 * @param {string} text - Its text.
 * @returns {Role} Its role.
 */
function declaredRole(manifest: string, text: string): Role {
  const fields = object(json(text), manifest);
  const declared = fields['aricanga'] === undefined ? {} : object(fields['aricanga'], `${manifest} aricanga`);
  const word = declared['role'];
  if (!isRole(word)) {
    throw new PopulationError(
      `${manifest}: aricanga.role is ${JSON.stringify(word)}; a workspace package declares one of the roles of harness/lib/roles.ts (${ROLE_WORDS.join(', ')})`,
    );
  }
  return word;
}

/**
 * The population of a listing.
 *
 * @param {PopulationInputs} inputs - The listing, pnpm's workspace packages and the reader.
 * @returns {Promise<Population>} The population.
 */
async function populationOf(inputs: Readonly<PopulationInputs>): Promise<Population> {
  const listed = new Set(inputs.listing);
  const dirs = inputs.workspace.filter((dir): dir is MemberDir => dir !== '' && listed.has(manifestOf(dir)) && !POC.starts(dir)).toSorted();
  const members: readonly Member[] = await Promise.all(
    dirs.map(async (dir): Promise<Member> => {
      const text = await inputs.read(manifestOf(dir));
      return { dir, role: declaredRole(manifestOf(dir), text) };
    }),
  );
  const memberOf = (target: string): Member | undefined => nearest(members, (member) => member.dir, target);
  return {
    holds: (target: string) => ROOT_FILES.has(target) || target.startsWith(HARNESS_ROOT) || memberOf(target) !== undefined,
    listing: inputs.listing,
    memberOf,
    members,
    roots: [...members.map((member) => member.dir), HARNESS_ROOT],
  };
}

/**
 * The workspace packages pnpm lists at a root, as directories relative to it. pnpm answers realpaths,
 * so they are related to the root's realpath.
 *
 * @param {string} root - The workspace root.
 * @returns {Promise<readonly Dir[]>} Each package's directory.
 */
async function workspacePackages(root: string): Promise<readonly Dir[]> {
  const [done, base] = await Promise.all([finished(['pnpm', 'ls', '-r', '--depth', '-1', '--json'], { cwd: root }), realpath(root)]);
  if (!succeeded(done)) {
    throw new PopulationError(`pnpm could not list the workspace at ${root}: ${done.stderr}`);
  }
  return list(report(done.stdout, 'pnpm ls'), 'pnpm ls').map((entry) => {
    const where = String(object(entry, 'a pnpm package')['path']);
    return dirOf(relativeTo(base, where));
  });
}

/**
 * The population of a checkout, computed from its listing and pnpm's workspace.
 *
 * @param {string} root - The checkout.
 * @returns {Promise<Population>} The population.
 */
async function computed(root: string): Promise<Population> {
  const [listing, workspace] = await Promise.all([tracked(root), workspacePackages(root)]);
  const found = await populationOf({
    listing,
    read: async (listed: string): Promise<string> => {
      const text = await textOf(listed, root);
      return text;
    },
    workspace,
  });
  return found;
}

/** The population of each checkout, computed once per root as spelled within this module's evaluation. */
const populations = perRoot(computed);

/**
 * The population of a checkout: one per root as spelled within this module's evaluation; a failure leaves the
 * cache, so the next call computes again.
 *
 * @param {string} root - The checkout; the repository by default.
 * @returns {Promise<Population>} The population.
 */
async function population(root: string = REPO_ROOT): Promise<Population> {
  const found = await populations(root);
  return found;
}

/**
 * The listed files the harness holds, optionally filtered by suffix.
 *
 * @param {readonly string[]} suffixes - The suffixes to keep; none keeps every file.
 * @returns {Promise<readonly string[]>} The held files.
 */
async function heldFiles(...suffixes: readonly string[]): Promise<readonly string[]> {
  const held = await population();
  return held.listing.filter((file) => held.holds(file) && (isEmpty(suffixes) || suffixes.some((suffix) => file.endsWith(suffix))));
}

/**
 * The held TypeScript sources.
 *
 * @returns {Promise<readonly string[]>} The held `.ts` and `.tsx` files.
 */
async function typescriptFiles(): Promise<readonly string[]> {
  const files = await heldFiles('.ts', '.tsx');
  return files;
}

export {
  DOC_ROOTS,
  POC,
  PopulationError,
  dirOfImporter,
  heldFiles,
  importerOf,
  manifestOf,
  nearest,
  population,
  populationOf,
  typescriptFiles,
  workspacePackages,
};
export type { Dir, Member, Population };
