/**
 * The gate's knip configuration over a population (`knip.config.ts` builds it over the
 * repository's): every issue type at error, each workspace's project and entries. knip loads
 * `knip.config.ts`; every check reads the value it loads (`knipConfig`, `config-modules.ts`).
 */

import { HARNESS_CHECKS, VITEST_TESTS, liveGlobs } from './test-globs.ts';
import { HARNESS_ROOT, POC_DIRS, pocPackages } from './scope.ts';
import type { Member, Population } from './scope.ts';
import type { KnipConfiguration } from 'knip';
import { importerOf } from './package-dirs.ts';
import { isEmpty } from './lists.ts';
import { ships } from './roles.ts';

/** The dependencies no held module imports: the POC's (its workspace packages are read from the manifests) and the tools' own. */
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

/** The settings every population shares. */
const SETTINGS: KnipConfiguration = {
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

/** A workspace's settings, as knip reads them. */
type Workspace = NonNullable<KnipConfiguration['workspaces']>[string];

/** The TypeScript modules a project glob reads under a directory. */
const MODULES = '**/*.{ts,tsx}';

/** A member's sources: production code where the member ships (`!`), test support where it does not. */
const SOURCES = 'src/';

/** A member's Playwright configs, by their name. */
const PLAYWRIGHT_CONFIG = /^playwright\.[^/]+\.config\.ts$/u;

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
  return held.listing.filter((file) => held.memberOf(file)?.dir === member.dir).map((file) => file.slice(member.dir.length));
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
 * @returns {Workspace} Its settings.
 */
function workspaceOf(held: Population, member: Member): Workspace {
  const configs = ownFiles(held, member).filter((file) => PLAYWRIGHT_CONFIG.test(file));
  return isEmpty(configs) ? { project: projectOf(held, member) } : { playwright: { config: configs }, project: projectOf(held, member) };
}

/**
 * The knip configuration over a population: the harness as the root workspace, each member a
 * workspace of its own, the POC ignored.
 *
 * @param {Population} held - The population.
 * @returns {KnipConfiguration} The configuration.
 */
function knipConfigOf(held: Population): KnipConfiguration {
  return {
    ...SETTINGS,
    ignoreDependencies: [...IGNORED_DEPENDENCIES, ...pocPackages(held)],
    ignoreWorkspaces: POC_DIRS.map((dir) => importerOf(dir)),
    workspaces: {
      '.': {
        entry: [`${HARNESS_ROOT}scripts/*.ts`, `${HARNESS_CHECKS}${VITEST_TESTS}`],
        playwright: false,
        project: [`${HARNESS_ROOT}${MODULES}`],
      },
      ...Object.fromEntries(held.members.map((member) => [importerOf(member.dir), workspaceOf(held, member)])),
    },
  };
}

export { knipConfigOf };
