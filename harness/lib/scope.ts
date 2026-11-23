/**
 * What the harness holds: the members (pnpm's workspace packages whose manifests git lists, less the
 * POC record), the harness, and the root files. Every scan asks this module, never a list of its own.
 */

import { Accepted, Prefixes } from './exemptions.ts';
import type { Dir, MemberDir } from './package-dirs.ts';
import { PopulationError, workspacePackages } from './workspace.ts';
import { ROLE_WORDS, isRole, ships, tierOf } from './roles.ts';
import { manifestOf, nearest } from './package-dirs.ts';
import { object, parsed } from './config.ts';
import { perRoot, textOf, tracked } from './source-files.ts';
import { REPO_ROOT } from './paths.ts';
import type { Role } from './roles.ts';
import { isEmpty } from './lists.ts';
import { providedFor } from './provided.ts';

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

/** Where a member's declared word sits in its entry. */
const ROLE_AT = 1;

/** A held workspace package: its directory and the role its manifest declares. */
interface Member {
  readonly dir: MemberDir;
  readonly role: Role;
}

/** The harness's population over one listing. */
interface Population {
  /** The checkout it was computed for; none for a planted population, which no checkout holds. */
  readonly root: string | undefined;
  /** The listing it was computed over. */
  readonly listing: readonly string[];
  /** The members, sorted by directory. */
  readonly members: readonly Member[];
  /** The members whose role ships: their modules are production code. */
  readonly shipping: readonly Member[];
  /** The members of the Sans-IO kernel. */
  readonly kernel: readonly Member[];
  /** The held directories: every member's and the harness's. */
  readonly roots: readonly MemberDir[];
  /** Whether a listed path is held: a root file, a harness file or a member's file. */
  readonly holds: (path: string) => boolean;
  /** The nearest member holding a path. */
  readonly memberOf: (path: string) => Member | undefined;
}

/** What a population is computed from. */
interface PopulationInputs {
  /** The checkout the listing and the workspace were read from; none for a planted population. */
  readonly root?: string;
  /** The repository-relative listing. */
  readonly listing: readonly string[];
  /** The workspace packages pnpm lists, by directory. */
  readonly workspace: readonly Dir[];
  /** Reads a listed file's text. */
  readonly read: (listed: string) => Promise<string>;
}

/**
 * A member's role word as its manifest's text declares it, whatever it is; text that is not JSON, or
 * an `aricanga` that is no object, refuses with `ConfigError` naming the manifest.
 *
 * @param {string} manifest - The manifest's path.
 * @param {string} text - Its text.
 * @returns {unknown} Its `aricanga.role`.
 */
function declaredWord(manifest: string, text: string): unknown {
  const fields = object(parsed(text, manifest), manifest);
  const declared = fields['aricanga'] === undefined ? {} : object(fields['aricanga'], `${manifest} aricanga`);
  return declared['role'];
}

/**
 * A population built from its listing and its members, whatever computed them.
 *
 * @param {string | undefined} root - The checkout it was computed for; none for a planted population.
 * @param {readonly string[]} listing - The listing.
 * @param {readonly Member[]} members - The members, sorted by directory.
 * @returns {Population} The population.
 */
function assembled(root: string | undefined, listing: readonly string[], members: readonly Member[]): Population {
  const memberOf = (target: string): Member | undefined => nearest(members, (member) => member.dir, target);
  return {
    holds: (target: string) => ROOT_FILES.has(target) || target.startsWith(HARNESS_ROOT) || memberOf(target) !== undefined,
    kernel: members.filter((member) => tierOf(member.role) === 'kernel'),
    listing,
    memberOf,
    members,
    root,
    roots: [...members.map((member) => member.dir), HARNESS_ROOT],
    shipping: members.filter((member) => ships(member.role)),
  };
}

/**
 * The member directories of a listing: pnpm's packages whose manifests are listed, less the root and
 * the POC, sorted.
 *
 * @param {PopulationInputs} inputs - The listing and pnpm's workspace packages.
 * @returns {readonly MemberDir[]} The members' directories.
 */
function memberDirs(inputs: Readonly<PopulationInputs>): readonly MemberDir[] {
  const listed = new Set(inputs.listing);
  return inputs.workspace.filter((dir): dir is MemberDir => dir !== '' && listed.has(manifestOf(dir)) && !POC.starts(dir)).toSorted();
}

/**
 * The members of their declared role words, refusing every word that names no role at once.
 *
 * @param {readonly (readonly [MemberDir, unknown])[]} words - Each member directory with its declared word.
 * @returns {readonly Member[]} The members.
 */
function membersOf(words: readonly (readonly [MemberDir, unknown])[]): readonly Member[] {
  const roled = words.filter((entry: readonly [MemberDir, unknown]): entry is readonly [MemberDir, Role] => isRole(entry[ROLE_AT]));
  if (roled.length !== words.length) {
    const lines = words
      .filter((entry: readonly [MemberDir, unknown]) => !isRole(entry[ROLE_AT]))
      .map(([dir, word]: readonly [MemberDir, unknown]) => `${manifestOf(dir)}: aricanga.role is ${JSON.stringify(word)}`);
    throw new PopulationError(
      `${lines.join('; ')}; a workspace package declares one of the roles of harness/lib/roles.ts (${ROLE_WORDS.join(', ')})`,
    );
  }
  return roled.map(([dir, role]: readonly [MemberDir, Role]) => ({ dir, role }));
}

/**
 * The population of a listing.
 *
 * @param {PopulationInputs} inputs - The listing, pnpm's workspace packages and the reader.
 * @returns {Promise<Population>} The population.
 */
async function populationOf(inputs: Readonly<PopulationInputs>): Promise<Population> {
  const dirs = memberDirs(inputs);
  const words = await Promise.all(
    dirs.map(async (dir): Promise<readonly [MemberDir, unknown]> => {
      const text = await inputs.read(manifestOf(dir));
      return [dir, declaredWord(manifestOf(dir), text)];
    }),
  );
  return assembled(inputs.root, inputs.listing, membersOf(words));
}

/**
 * The population of a checkout: in a worker of the gate's run, the one its config computed and
 * provided (`provided.ts`); elsewhere computed from its listing and pnpm's workspace.
 *
 * @param {string} root - The checkout.
 * @returns {Promise<Population>} The population.
 */
async function computed(root: string): Promise<Population> {
  const given = await providedFor(root);
  if (given !== undefined) {
    return assembled(given.root, given.listing, given.members);
  }
  const [listing, workspace] = await Promise.all([tracked(root), workspacePackages(root)]);
  const found = await populationOf({
    listing,
    read: async (listed: string): Promise<string> => {
      const text = await textOf(listed, root);
      return text;
    },
    root,
    workspace,
  });
  return found;
}

/** The population of each checkout, computed once per root as spelled within this module's evaluation. */
const populations = perRoot(computed);

/**
 * The population of a checkout: one per root as spelled within this module's evaluation; a failure
 * leaves the cache, so the next call computes again.
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

export { DOC_ROOTS, POC, heldFiles, population, populationOf, typescriptFiles };
export type { Member, Population };
