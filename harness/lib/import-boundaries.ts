/**
 * The layering of the rebuild as oxlint's own `no-restricted-imports`, one override per member over
 * its directory and one for the harness's code: by package name (`paths`, compared by equality) and
 * every subpath (`name/**`, a case-sensitive pattern holding a slash, so it never matches another
 * package or a relative path), the members its role may not import (`MAY`, the role matrix), the
 * POC's packages, and every relative climb, so a module reaches another member only by name. Each
 * reason is its own refusal with its own message. The lint grants every module the test
 * infrastructure by name: the `boundaries` check's scan alone holds that a production module
 * imports no non-production module, the test infrastructure included, by any form and through any
 * chain (`production-imports.ts`).
 */

import type { Member, Population } from './scope.ts';
import type { Role, ShippingRole } from './roles.ts';
import type { GateOverride } from './oxlint-shape.ts';
import { HARNESS_CODE } from './oxlint-files.ts';
import { HARNESS_LIB } from './test-globs.ts';
import type { MemberDir } from './package-dirs.ts';
import { Vocabulary } from './exemptions.ts';
import { isEmpty } from './lists.ts';
import { pocNames } from './scope.ts';

/** Who imports: a member, by its role, or the harness. */
type Importer = Role | 'harness';

/**
 * The shipping roles each importer's modules may import, a member's own package aside: foundation
 * nothing; a system foundation; a view foundation (a system reaches it by injection, never by
 * import); an experience foundation, systems and views; the harness and the test infrastructure any
 * shipping member. No role imports its own role's other members. The test infrastructure is no
 * cell (a cell is a `ShippingRole`, so `tsc` refuses it there): every importer may import it by
 * name, and the scan refuses it to a production module. Every importer's row is read by one builder.
 */
const MAY: Vocabulary<Readonly<Record<Importer, readonly ShippingRole[]>>> = new Vocabulary<
  Readonly<Record<Importer, readonly ShippingRole[]>>
>({
  experience: ['foundation', 'system', 'view'],
  foundation: [],
  harness: ['experience', 'foundation', 'system', 'view'],
  system: ['foundation'],
  'test-infrastructure': ['experience', 'foundation', 'system', 'view'],
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

/** Whose modules a set of groups refuses: the importer, and its own member (none for the harness). */
interface Importing {
  readonly importer: Importer;
  readonly own: MemberDir | undefined;
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
  return isEmpty(roles) ? 'no member but the test infrastructure' : `only ${roles.join(', ')} members and the test infrastructure, by name`;
}

/**
 * The groups an importer's modules are refused, each with its reason: the shipping members its row
 * does not allow, the POC, every climb.
 *
 * @param {Population} held - The population.
 * @param {Importing} importing - Whose modules: the importer, and its own member (whose package it may import).
 * @returns {Group[]} The non-empty groups.
 */
function groupsOf(held: Population, importing: Readonly<Importing>): Group[] {
  const { importer, own } = importing;
  const forbidden = held.shipping.filter((other) => other.dir !== own && !MAY.of(importer).some((role) => role === other.role));
  const groups: readonly Group[] = [
    specifiers(
      namesOf(forbidden),
      `${importer} modules import ${allowed(importer)} (the role matrix: MAY in ${HARNESS_LIB}import-boundaries.ts)`,
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
 * @returns {GateOverride} The override.
 */
function refusing(files: readonly string[], groups: readonly Group[]): GateOverride {
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
 * The import boundaries over a population: each member's directory under its role's refusals, then
 * the harness code's.
 *
 * @param {Population} held - The population.
 * @returns {GateOverride[]} The overrides, one per member and one for the harness.
 */
function boundariesOf(held: Population): GateOverride[] {
  return [
    ...held.members.map((member) => refusing([`${member.dir}**`], groupsOf(held, { importer: member.role, own: member.dir }))),
    refusing(HARNESS_CODE, groupsOf(held, { importer: 'harness', own: undefined })),
  ];
}

export { boundariesOf };
