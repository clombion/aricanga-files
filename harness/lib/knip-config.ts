/**
 * The gate's knip configuration over a population (`knip.config.ts` builds it over the
 * repository's): every issue type at error, each workspace's project and entries. knip loads
 * `knip.config.ts`; every check reads the value it loads (`knipConfig`, `config-modules.ts`).
 */

import { HARNESS_ROOT, pocNames } from './scope.ts';
import { HARNESS_TESTS, SCRIPT_ENTRIES, isRunnerConfig, liveGlobs } from './test-globs.ts';
import type { Member, Population } from './scope.ts';
import type { KnipConfiguration } from 'knip';
import type { NoOther } from './readonly.ts';
import { dependencyNames } from './dependencies.ts';
import { importerOf } from './package-dirs.ts';
import { isEmpty } from './lists.ts';
import { ships } from './roles.ts';

/** The dependencies no held module imports: the POC's (its own packages are the population's POC record) and the tools' own. */
const IGNORED_DEPENDENCIES: readonly string[] = [
  '@ai-sdk/anthropic',
  '@ai-sdk/google',
  '@ai-sdk/openai',
  '@viz-js/viz',
  'ai',
  'jscpd',
  'remark-parse',
  'unified',
  'unist-util-visit',
  'xstate',
  'zod',
  '@solidjs/compiler',
];

/** The configuration of one workspace, as knip's own type has it. */
type KnipWorkspaceConfiguration = NonNullable<KnipConfiguration['workspaces']>[string];

/** The Playwright plugin's settings as an object, as knip's own type has them. */
type KnipPlaywright = Exclude<NonNullable<KnipWorkspaceConfiguration['playwright']>, boolean | string | readonly unknown[]>;

/** A glob or ignore field of knip's own type, narrowed to a list of strings: the form the gate writes. */
type ListOf<Field> = Field extends readonly (infer Item)[] ? readonly Extract<Item, string>[] : never;

/**
 * A workspace of the gate's knip configuration, knip's own workspace type narrowed: its globs as
 * lists, its Playwright configs if any, and every other field of knip's refused.
 */
type KnipWorkspace = Readonly<{
  entry?: ListOf<KnipWorkspaceConfiguration['entry']>;
  project: ListOf<KnipWorkspaceConfiguration['project']>;
  playwright?: false | Readonly<{ config: ListOf<KnipPlaywright['config']> }>;
}> &
  NoOther<KnipWorkspaceConfiguration, 'entry' | 'playwright' | 'project'>;

/** Every issue type knip's own type names, at `error`: a type knip names and the rules leave out does not compile. */
type KnipRules = Readonly<Record<keyof NonNullable<KnipConfiguration['rules']>, 'error'>>;

/**
 * The gate's knip configuration, knip's own type (`KnipConfiguration`) narrowed: every issue type at
 * `error` (`KnipRules`); every glob and ignore a list of strings; and every other field of knip's
 * refused, written, held in a variable or spread: among them each field that excuses a file or a
 * name from an issue type (`ignore`, `ignoreFiles`, `ignoreIssues`, `ignoreBinaries`, `ignoreMembers`,
 * `ignoreUnresolved`, `ignoreExportsUsedInFile`) and those that leave an issue type out (`exclude`,
 * `include`). So each reader reads it as written and the strictness check need not look for an excuse.
 * A rule name knip lacks, spread in from a variable, is beyond the type (TypeScript checks no object
 * for keys it was not given literally); knip's own schema refuses it where the `deadcode` task loads
 * the configuration.
 */
type KnipConfig = Readonly<{
  rules: KnipRules;
  ignoreDependencies: ListOf<KnipConfiguration['ignoreDependencies']>;
  ignoreWorkspaces: ListOf<KnipConfiguration['ignoreWorkspaces']>;
  workspaces: Readonly<Record<string, KnipWorkspace>>;
}> &
  NoOther<KnipConfiguration, 'ignoreDependencies' | 'ignoreWorkspaces' | 'rules' | 'workspaces'>;

/**
 * A planted knip run's configuration: what the gate's sets (its rules, at `error`, as many as the plant
 * needs; its ignore lists; its workspaces) and the root workspace's own entries and project, which a
 * single-package plant writes at the top; every other field of knip's refused, so a plant excuses no
 * file, name or issue type the gate's configuration could not.
 */
type PlantedKnipConfig = Readonly<{
  entry?: ListOf<KnipConfiguration['entry']>;
  project?: ListOf<KnipConfiguration['project']>;
  rules?: Readonly<Partial<KnipRules>>;
  ignoreDependencies?: ListOf<KnipConfiguration['ignoreDependencies']>;
  ignoreWorkspaces?: ListOf<KnipConfiguration['ignoreWorkspaces']>;
  workspaces?: Readonly<Record<string, KnipWorkspace>>;
}> &
  NoOther<KnipConfiguration, 'entry' | 'ignoreDependencies' | 'ignoreWorkspaces' | 'project' | 'rules' | 'workspaces'>;

/** The settings every population shares. */
const SETTINGS: Pick<KnipConfig, 'rules'> = {
  rules: {
    binaries: 'error',
    catalog: 'error',
    catalogReferences: 'error',
    cycles: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    duplicates: 'error',
    enumMembers: 'error',
    exports: 'error',
    files: 'error',
    namespaceMembers: 'error',
    nsExports: 'error',
    nsTypes: 'error',
    optionalPeerDependencies: 'error',
    types: 'error',
    unlisted: 'error',
    unresolved: 'error',
  },
};

/** The TypeScript modules a project glob reads under a directory. */
const MODULES = '**/*.{ts,tsx}';

/** A member's sources: production code where the member ships (`!`), test support where it does not. */
const SOURCES = 'src/';

/** A member-relative path's first segment, `''` for a file at the member's root. */
const FIRST_SEGMENT = /^(?<segment>[^/]+)\//u;

/**
 * A member's own listed files, relative to its directory: not a nested member's.
 *
 * @param {Population} held - The population.
 * @param {Member} member - The member.
 * @returns {readonly string[]} Its files, member-relative.
 */
function ownFiles(held: Population, member: Member): readonly string[] {
  return held.filesOf(member).map((file) => file.slice(member.dir.length));
}

/**
 * A member's project: its sources (production where it ships), each other top-level directory holding
 * a module, and its root modules; each glob only where the listing gives it a file.
 *
 * @param {Population} held - The population.
 * @param {Member} member - The member.
 * @returns {string[]} The member-relative project globs.
 */
function projectOf(held: Population, member: Member): string[] {
  const segments = new Set(ownFiles(held, member).map((file) => FIRST_SEGMENT.exec(file)?.groups?.['segment'] ?? ''));
  const tails = [...segments].toSorted().map((segment) => (segment === '' ? '*.{ts,tsx}' : `${segment}/${MODULES}`));
  return tails.flatMap((tail) => {
    const live = liveGlobs(held, [member], tail).map((glob) => glob.slice(member.dir.length));
    return tail === `${SOURCES}${MODULES}` && ships(member.role) ? live.map((glob) => `${glob}!`) : live;
  });
}

/**
 * A member's workspace: its project, and its Playwright configs when it has any.
 *
 * @param {Population} held - The population.
 * @param {Member} member - The member.
 * @returns {KnipWorkspace} Its settings.
 */
function workspaceOf(held: Population, member: Member): KnipWorkspace {
  const configs = ownFiles(held, member).filter((file) => isRunnerConfig(`${member.dir}${file}`));
  return isEmpty(configs) ? { project: projectOf(held, member) } : { playwright: { config: configs }, project: projectOf(held, member) };
}

/**
 * The POC's package names some held manifest (the root's or a member's) declares a dependency on, in
 * any group and by any spec.
 *
 * @param {Population} held - The population.
 * @returns {string[]} The names, sorted.
 */
function declaredPocNames(held: Population): string[] {
  const declared = new Set(
    [held.rootManifest, ...held.members.map((member) => member.manifest)].flatMap((manifest) => dependencyNames(manifest)),
  );
  return pocNames(held).filter((name) => declared.has(name));
}

/**
 * The knip configuration over a population: the harness as the root workspace, each member a
 * workspace of its own, every POC directory ignored as a workspace (knip reads a plain directory there
 * too: it leaves the root workspace) and the POC's packages, where a held manifest declares them, as
 * dependencies.
 *
 * @param {Population} held - The population.
 * @returns {KnipConfig} The configuration.
 */
function knipConfigOf(held: Population): KnipConfig {
  return {
    ...SETTINGS,
    ignoreDependencies: [...IGNORED_DEPENDENCIES, ...declaredPocNames(held)],
    ignoreWorkspaces: [...held.poc.packages.map((entry) => entry.dir), ...held.poc.directories].map((dir) => importerOf(dir)).toSorted(),
    workspaces: {
      '.': {
        entry: [...SCRIPT_ENTRIES, ...HARNESS_TESTS],
        playwright: false,
        project: [`${HARNESS_ROOT}${MODULES}`],
      },
      ...Object.fromEntries(held.members.map((member) => [importerOf(member.dir), workspaceOf(held, member)])),
    },
  };
}

export { knipConfigOf };
export type { KnipConfig, PlantedKnipConfig };
