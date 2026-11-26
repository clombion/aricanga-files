/**
 * What the harness holds: the members (pnpm's workspace packages whose manifests git lists, less the
 * POC record), the harness, and the root files; a held module is TypeScript (`.ts`, `.tsx`), and a
 * population holding a module of another kind is refused. Every scan asks this module, never a list
 * of its own.
 */

import { Accepted, Prefixes } from './exemptions.ts';
import { PopulationError, workspacePackages } from './workspace.ts';
import type { Role, Tier } from './roles.ts';
import { TYPESCRIPT, isLintable, isTypeScript, perRoot, textOf, tracked } from './source-files.ts';
import { byCodeUnit, groupedBy, isEmpty, partitioned } from './lists.ts';
import { manifestOf, nearestOf } from './package-dirs.ts';
import { ships, tierOf } from './roles.ts';
import type { Fields } from './manifests.ts';
import type { MemberDir } from './package-dirs.ts';
import type { OtherSuffixes } from './source-files.ts';
import { REPO_ROOT } from './paths.ts';
import { ROOT_MODULES } from './config-modules.ts';
import type { WorkspacePackage } from './workspace.ts';
import { manifestsOf } from './manifests.ts';
import { providedFor } from './provided.ts';

/** The harness's own place: held, and not a workspace package. */
const HARNESS_ROOT: MemberDir = 'harness/';

/**
 * The POC reference (ADR-0006, "Scope"): read-only, outside the harness until it is deleted. Its one
 * declaration, by directory; which of them are packages, and their names, the population reads from
 * pnpm's listing (`Population.poc`).
 */
const POC_DIRS: readonly MemberDir[] = [
  'packages/framework/',
  'packages/tests/',
  'packages/test-utils/',
  'experiences/aricanga/',
  'utils/',
];

/** The POC's directories as the prefixes a path is tested against. */
const POC: Prefixes = new Prefixes(POC_DIRS);

/** Root files the harness holds besides the members and the harness: the configuration the gate reads. */
const ROOT_FILES = new Accepted<string>([
  ...ROOT_MODULES,
  'package.json',
  'tsconfig.json',
  'tsconfig.base.json',
  '.oxfmtrc.json',
  'lefthook.json',
  '.commitlintrc.json',
  'docs/terms.toml',
  'AGENTS.md',
  'CLAUDE.md',
  'harness.md',
  'HARNESS_STATUS.md',
  '.stylelintrc.json',
  '.node-version',
]);

/**
 * A held workspace package: its directory and name as pnpm lists them, its manifest as the
 * population read it, and the role that manifest declares (`role` is `manifest.aricanga.role`; all
 * are set by their one constructor, `declaredBy` in `manifests.ts`).
 */
interface Member {
  readonly dir: MemberDir;
  readonly name: string | undefined;
  readonly role: Role;
  readonly manifest: Fields;
}

/** A package pnpm lists below the root, a member's or the POC's: its directory, and its name (none: it is imported by no name). */
interface ListedPackage {
  readonly dir: MemberDir;
  readonly name: string | undefined;
}

/** The POC as the population reads it: its packages (pnpm lists them, each with its name), and its plain directories. */
interface Poc {
  readonly packages: readonly ListedPackage[];
  readonly directories: readonly MemberDir[];
}

/** The harness's population over one listing. */
interface Population {
  /** The checkout it was computed for; none for a planted population, which no checkout holds. */
  readonly root: string | undefined;
  /** The listing it was computed over. */
  readonly listing: readonly string[];
  /** The root's manifest, read with the members' at one moment. */
  readonly rootManifest: Fields;
  /** The members, sorted by directory. */
  readonly members: readonly Member[];
  /** The POC, by kind of entry. */
  readonly poc: Poc;
  /** The members whose role ships: their modules are production code. */
  readonly shipping: readonly Member[];
  /** The members whose role does not ship, the test infrastructure: all their modules are test support. With `shipping`, one partition of the members. */
  readonly testInfrastructure: readonly Member[];
  /** The members of each tier (`roles.ts`), selected once, for a reader whose answer is total over the tiers. */
  readonly tiers: Readonly<Record<Tier, readonly Member[]>>;
  /** The held directories: every member's and the harness's. */
  readonly roots: readonly MemberDir[];
  /** Whether a listed path is held: a root file, a harness file or a member's file. */
  readonly holds: (path: string) => boolean;
  /** The nearest member holding a path. */
  readonly memberOf: (path: string) => Member | undefined;
  /** A member's own listed files, not a nested member's, from one pass over the listing keyed by the member itself: the one answer every member-scoped glob reads; none for a member this population does not hold, whatever its directory. */
  readonly filesOf: (member: Member) => readonly string[];
}

/** What a population is computed from. */
interface PopulationInputs {
  /** The checkout the listing and the workspace were read from; none for a planted population. */
  readonly root?: string;
  /** The repository-relative listing. */
  readonly listing: readonly string[];
  /** The workspace packages pnpm lists, each with its directory and name. */
  readonly workspace: readonly WorkspacePackage[];
  /** Reads a listed file's text. */
  readonly read: (listed: string) => Promise<string>;
}

/** What a population is assembled from, whatever computed it: its checkout (none for a planted one), listing, root manifest, members and the POC's packages. */
type Parts = Pick<Population, 'listing' | 'members' | 'root' | 'rootManifest'> & {
  readonly pocPackages: readonly ListedPackage[];
};

/**
 * A population built from its parts, whatever computed them.
 *
 * @param {Parts} parts - Its checkout, listing, root manifest and members, sorted by directory.
 * @returns {Population} The population.
 */
function assembled(parts: Readonly<Parts>): Population {
  const { listing, members, pocPackages, root, rootManifest } = parts;
  const packageDirs = new Set<string>(pocPackages.map((entry) => entry.dir));
  const memberOf = nearestOf(members, (member) => member.dir);
  const owned = groupedBy(listing, memberOf);
  const tiered = (tier: Tier): readonly Member[] => members.filter((member) => tierOf(member.role) === tier);
  const [shipping, testInfrastructure] = partitioned(members, (member) => ships(member.role));
  const tiers: Readonly<Record<Tier, readonly Member[]>> = {
    kernel: tiered('kernel'),
    product: tiered('product'),
    'test-infrastructure': tiered('test-infrastructure'),
  };
  return {
    filesOf: (member: Member) => owned.get(member) ?? [],
    holds: (target: string) => ROOT_FILES.has(target) || target.startsWith(HARNESS_ROOT) || memberOf(target) !== undefined,
    listing,
    memberOf,
    members,
    poc: { directories: POC_DIRS.filter((dir) => !packageDirs.has(dir)), packages: pocPackages },
    root,
    rootManifest,
    roots: [...members.map((member) => member.dir), HARNESS_ROOT],
    shipping,
    testInfrastructure,
    tiers,
  };
}

/**
 * The packages of a listing on one side of the POC: pnpm's packages whose manifests are listed, less
 * the root, outside the POC (the members) or inside it (the POC's packages), sorted by directory.
 *
 * @param {PopulationInputs} inputs - The listing and pnpm's workspace packages.
 * @param {boolean} inPoc - Which side: the POC's packages, or the members.
 * @returns {readonly ListedPackage[]} The packages, each with its directory and name.
 */
function packagesOn(inputs: Readonly<PopulationInputs>, inPoc: boolean): readonly ListedPackage[] {
  const listed = new Set(inputs.listing);
  return inputs.workspace
    .filter((entry): entry is ListedPackage => entry.dir !== '' && listed.has(manifestOf(entry.dir)) && POC.starts(entry.dir) === inPoc)
    .toSorted((one, other) => byCodeUnit(one.dir, other.dir));
}

/**
 * The population of a listing, refused when it holds a module no scan reads: a file oxlint lints
 * that is not TypeScript.
 *
 * @param {PopulationInputs} inputs - The listing, pnpm's workspace packages and the reader.
 * @returns {Promise<Population>} The population.
 */
async function populationOf(inputs: Readonly<PopulationInputs>): Promise<Population> {
  const { members, rootManifest } = await manifestsOf(packagesOn(inputs, false), inputs.read);
  const held = assembled({ listing: inputs.listing, members, pocPackages: packagesOn(inputs, true), root: inputs.root, rootManifest });
  const others = held.listing.filter((file) => held.holds(file) && isLintable(file) && !isTypeScript(file));
  if (!isEmpty(others)) {
    const why = `a held module is TypeScript (${[...TYPESCRIPT].join(', ')}), the kind every scan, the type check and coverage read`;
    throw new PopulationError(`${why}: ${others.join(', ')}`);
  }
  return held;
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
    return assembled(given);
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
 * leaves the cache, so the next call computes again (a root config module awaiting it at its top
 * level is another matter: the module cache keeps its failure).
 *
 * @param {string} root - The checkout; the repository by default.
 * @returns {Promise<Population>} The population.
 */
async function population(root: string = REPO_ROOT): Promise<Population> {
  const found = await populations(root);
  return found;
}

/**
 * The POC's package names, as pnpm lists them.
 *
 * @param {Population} held - The population.
 * @returns {string[]} The names, sorted.
 */
function pocNames(held: Population): string[] {
  return held.poc.packages.flatMap((entry) => (entry.name === undefined ? [] : [entry.name])).toSorted();
}

/**
 * The listed files a population holds, optionally filtered by suffix.
 *
 * @param {Population} held - The population.
 * @param {readonly string[]} suffixes - The suffixes to keep; none keeps every file.
 * @returns {readonly string[]} The held files.
 */
function heldOf(held: Population, ...suffixes: readonly string[]): readonly string[] {
  return held.listing.filter((file) => held.holds(file) && (isEmpty(suffixes) || suffixes.some((suffix) => file.endsWith(suffix))));
}

/**
 * The listed files the harness holds, optionally filtered by suffix. A held kind is no suffix this
 * takes (`OtherSuffixes`): the held modules are `typescriptFiles`', selected by `TYPESCRIPT`.
 *
 * @param {OtherSuffixes<Suffixes>} suffixes - The suffixes to keep; none keeps every file.
 * @returns {Promise<readonly string[]>} The held files.
 */
async function heldFiles<const Suffixes extends readonly string[]>(...suffixes: OtherSuffixes<Suffixes>): Promise<readonly string[]> {
  const held = await population();
  return heldOf(held, ...suffixes);
}

/**
 * The TypeScript sources a population holds.
 *
 * @param {Population} held - The population.
 * @returns {readonly string[]} Its held `.ts` and `.tsx` files.
 */
function typescriptOf(held: Population): readonly string[] {
  return heldOf(held, ...TYPESCRIPT);
}

/**
 * The held TypeScript sources.
 *
 * @returns {Promise<readonly string[]>} The held `.ts` and `.tsx` files.
 */
async function typescriptFiles(): Promise<readonly string[]> {
  const held = await population();
  return typescriptOf(held);
}

export { HARNESS_ROOT, POC, heldFiles, pocNames, population, populationOf, typescriptFiles, typescriptOf };
export type { Member, Parts, ListedPackage, Population, PopulationInputs };
