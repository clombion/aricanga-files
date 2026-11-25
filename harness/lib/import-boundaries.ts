/**
 * The layering of the rebuild as oxlint's own `no-restricted-imports`, one override per member over
 * its directory and one for the harness's code: by package name (`paths`, compared by equality) and
 * every subpath (`name/**`, a case-sensitive pattern holding a slash, so it never matches another
 * package or a relative path), the members its role may not import (`MAY`, the role matrix), the
 * POC's packages, and every relative climb, so a module reaches another member only by name. Each
 * reason is its own refusal with its own message. A member's non-production modules (its runner tests, runner configs and test
 * directories, below its directory, as `isProduction` reads them) get a second override after it,
 * the same less the test infrastructure: of the lint's two overrides, only they may import it.
 */

import type { Member, Population } from './scope.ts';
import { RUNNER_CONFIGS, RUNNER_TESTS, TEST_DIRECTORIES, liveGlobs } from './test-globs.ts';
import { HARNESS_CODE } from './oxlint-files.ts';
import type { MemberDir } from './package-dirs.ts';
import type { OxlintOverride } from 'oxlint';
import type { Role } from './roles.ts';
import { Vocabulary } from './exemptions.ts';
import { isEmpty } from './lists.ts';
import { isTestInfrastructure } from './roles.ts';
import { pocNames } from './scope.ts';

/** Who imports: a member, by its role, or the harness. */
type Importer = Role | 'harness';

/**
 * The roles each importer's modules may import, a member's own package aside: foundation nothing; a
 * system foundation; a view foundation (a system reaches it by injection, never by import); an
 * experience foundation, systems and views; the harness and the test infrastructure any member. No
 * role imports its own role's other members. Every importer's row is read by one builder.
 */
const MAY: Vocabulary<Readonly<Record<Importer, readonly Role[]>>> = new Vocabulary<Readonly<Record<Importer, readonly Role[]>>>({
  experience: ['foundation', 'system', 'view'],
  foundation: [],
  harness: ['experience', 'foundation', 'system', 'test-infrastructure', 'view'],
  system: ['foundation'],
  'test-infrastructure': ['experience', 'foundation', 'system', 'test-infrastructure', 'view'],
  view: ['foundation'],
});

/** Every relative climb, wherever it sits in a specifier: the parent alone, a climb before a path, after one, and inside one. */
const CLIMBS: readonly string[] = ['..', '../**', '**/..', '**/../**'];

/** One reason's refusal in `no-restricted-imports`: the package names it refuses exactly, the patterns it refuses (their subpaths, the climbs), and why. */
interface Group {
  readonly names: readonly string[];
  readonly group: readonly string[];
  readonly message: string;
}

/** Whose modules a set of groups refuses: the importer, its own member (none for the harness), and whether the modules are production code. */
interface Importing {
  readonly importer: Importer;
  readonly own: MemberDir | undefined;
  readonly production: boolean;
}

/**
 * The refusal of some packages' specifiers, for one reason: each name exactly, and every subpath of
 * it at any depth.
 *
 * @param {readonly string[]} names - The packages' names.
 * @param {string} message - Why.
 * @returns {Group} The refusal.
 */
function specifiers(names: readonly string[], message: string): Group {
  return { group: names.map((name) => `${name}/**`), message, names };
}

/**
 * The names of some members' packages; a member with no name has none.
 *
 * @param {readonly Member[]} members - The members.
 * @returns {string[]} Their names.
 */
function namesOf(members: readonly Member[]): string[] {
  return members.flatMap((member) => (member.name === undefined ? [] : [member.name]));
}

/**
 * What an importer's row allows, as its message words it.
 *
 * @param {Importer} importer - The importer.
 * @returns {string} The allowed roles, or none.
 */
function allowed(importer: Importer): string {
  const roles = MAY.of(importer);
  return isEmpty(roles) ? 'no other member' : `only ${roles.join(', ')} members, by name`;
}

/**
 * The groups an importer's modules are refused, each with its reason: the members its row does not
 * allow (the test infrastructure apart, refused to production modules only), the POC, every climb.
 *
 * @param {Population} held - The population.
 * @param {Importing} importing - Whose modules: the importer, its own member (whose package it may import), whether they are production.
 * @returns {Group[]} The non-empty groups.
 */
function groupsOf(held: Population, importing: Readonly<Importing>): Group[] {
  const { importer, own, production } = importing;
  const forbidden = held.members.filter((other) => other.dir !== own && !MAY.of(importer).includes(other.role));
  const groups: readonly Group[] = [
    specifiers(
      namesOf(forbidden.filter((other) => !isTestInfrastructure(other.role))),
      `${importer} modules import ${allowed(importer)} (the role matrix: MAY in harness/lib/import-boundaries.ts)`,
    ),
    specifiers(
      production ? namesOf(forbidden.filter((other) => isTestInfrastructure(other.role))) : [],
      'only a non-production module (a runner test, a runner config, a test directory) imports the test infrastructure',
    ),
    specifiers(pocNames(held), 'nothing in the rebuild imports the POC (ADR-0006, "Scope")'),
    { group: [...CLIMBS], message: 'a module reaches another member only by its package name, never by a relative climb', names: [] },
  ];
  return groups.filter((entry) => !isEmpty(entry.group));
}

/**
 * The override refusing some groups in some files.
 *
 * @param {readonly string[]} files - The files.
 * @param {readonly Group[]} groups - The refused groups.
 * @returns {OxlintOverride} The override.
 */
function refusing(files: readonly string[], groups: readonly Group[]): OxlintOverride {
  return {
    files: [...files],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: groups.flatMap((entry) => entry.names.map((name) => ({ message: entry.message, name }))),
          patterns: groups.map((entry) => ({ caseSensitive: true, group: [...entry.group], message: entry.message })),
        },
      ],
    },
  };
}

/**
 * A member's overrides: its directory under its role's refusals, and, where it has any and they
 * differ, its non-production modules under the same less the test infrastructure.
 *
 * @param {Population} held - The population.
 * @param {Member} member - The member.
 * @returns {OxlintOverride[]} The overrides, the member's first.
 */
function memberBoundaries(held: Population, member: Member): OxlintOverride[] {
  const production = groupsOf(held, { importer: member.role, own: member.dir, production: true });
  const tests = groupsOf(held, { importer: member.role, own: member.dir, production: false });
  const tails = [...RUNNER_TESTS, ...RUNNER_CONFIGS, ...TEST_DIRECTORIES.map((dir) => `**/${dir}/**`)];
  const nonProduction = tails.flatMap((tail) => liveGlobs(held, [member], tail));
  return [
    refusing([`${member.dir}**`], production),
    ...(production.length === tests.length || isEmpty(nonProduction) ? [] : [refusing(nonProduction, tests)]),
  ];
}

/**
 * The import boundaries over a population: each member's overrides, then the harness code's.
 *
 * @param {Population} held - The population.
 * @returns {OxlintOverride[]} The overrides.
 */
function boundariesOf(held: Population): OxlintOverride[] {
  return [
    ...held.members.flatMap((member) => memberBoundaries(held, member)),
    refusing(HARNESS_CODE, groupsOf(held, { importer: 'harness', own: undefined, production: true })),
  ];
}

export { boundariesOf };
