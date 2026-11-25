/**
 * The layering of the rebuild as oxlint's own `no-restricted-imports` (`docs/roadmap/phase-7-hardening.md`:
 * foundation ← systems ← experiences), one override per member over its
 * directory: the packages of the members its role may not import (by name and every subpath), the
 * POC's packages, and every relative climb (`..`), so a module reaches another member only by name.
 * A member's non-production modules (`isProduction`'s runner tests, runner configs and test directories) get
 * a second override after it, the same less the test infrastructure: only they may import it. The
 * harness may import any member, never the POC.
 */

import { HARNESS_ROOT, packageName, pocPackages } from './scope.ts';
import type { Member, Population } from './scope.ts';
import { RUNNER_CONFIGS, RUNNER_TESTS, TEST_DIRECTORIES, liveGlobs } from './test-globs.ts';
import type { OxlintOverride } from 'oxlint';
import type { Role } from './roles.ts';
import { Vocabulary } from './exemptions.ts';
import { isEmpty } from './lists.ts';
import { isTestInfrastructure } from './roles.ts';

/**
 * The roles each role's modules may import, a member's own package aside: foundation nothing; a
 * system foundation; a view foundation (a system reaches it by injection, never by import); an
 * experience foundation, systems and views; the harness and the test infrastructure any member.
 */
const MAY: Vocabulary<Readonly<Record<Role | 'harness', readonly Role[]>>> = new Vocabulary<
  Readonly<Record<Role | 'harness', readonly Role[]>>
>({
  experience: ['foundation', 'system', 'view'],
  foundation: [],
  harness: ['experience', 'foundation', 'system', 'test-infrastructure', 'view'],
  system: ['foundation'],
  'test-infrastructure': ['experience', 'foundation', 'system', 'test-infrastructure', 'view'],
  view: ['foundation'],
});

/** Every relative climb, at any depth and in any place of the specifier. */
const CLIMB = '**/../**';

/**
 * A package's specifiers: its name and every subpath.
 *
 * @param {Member} member - The member.
 * @returns {string[]} The patterns, none for a member with no name.
 */
function specifiers(member: Member): string[] {
  const name = packageName(member);
  return name === undefined ? [] : [name, `${name}/*`];
}

/**
 * The override refusing a group of patterns in some files.
 *
 * @param {readonly string[]} files - The files.
 * @param {readonly string[]} group - The refused patterns.
 * @param {string} who - Who the files are, for the message.
 * @returns {OxlintOverride} The override.
 */
function refusing(files: readonly string[], group: readonly string[], who: string): OxlintOverride {
  const message = `${who} imports only the members its role may (phase-7-hardening), by name, and never the POC (ADR-0006, Scope)`;
  return { files: [...files], rules: { 'no-restricted-imports': ['error', { patterns: [{ group: [...group], message }] }] } };
}

/**
 * A member's overrides: its directory under its role's refusals, and, where it has any, its
 * non-production modules under the same less the test infrastructure.
 *
 * @param {Population} held - The population.
 * @param {Member} member - The member.
 * @returns {OxlintOverride[]} The overrides, the member's first.
 */
function memberBoundaries(held: Population, member: Member): OxlintOverride[] {
  const forbidden = held.members.filter((other) => other.dir !== member.dir && !MAY.of(member.role).includes(other.role));
  const shared = [...pocPackages(held), CLIMB];
  const production = [...forbidden.flatMap((other) => specifiers(other)), ...shared];
  const tests = [...forbidden.filter((other) => !isTestInfrastructure(other.role)).flatMap((other) => specifiers(other)), ...shared];
  const tails = [...RUNNER_TESTS, ...RUNNER_CONFIGS, ...TEST_DIRECTORIES.map((dir) => `**/${dir}/**`)];
  const nonProduction = tails.flatMap((tail) => liveGlobs(held, [member], tail));
  return [
    refusing([`${member.dir}**`], production, `a ${member.role}`),
    ...(production.length === tests.length || isEmpty(nonProduction)
      ? []
      : [refusing(nonProduction, tests, `a ${member.role}'s test module`)]),
  ];
}

/**
 * The import boundaries over a population: each member's overrides, then the harness's.
 *
 * @param {Population} held - The population.
 * @returns {OxlintOverride[]} The overrides.
 */
function boundariesOf(held: Population): OxlintOverride[] {
  return [
    ...held.members.flatMap((member) => memberBoundaries(held, member)),
    refusing([`${HARNESS_ROOT}**`], [...pocPackages(held), CLIMB], 'the harness'),
  ];
}

export { boundariesOf };
