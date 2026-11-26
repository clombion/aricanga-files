/**
 * Claims of a single owner in current text, each registered with the probe that holds it.
 *
 * A sentence of current text saying `the one owner`, `the only module`, `nowhere else` or `stated
 * once` makes a claim about the code. `CLAIMS` registers each claim by its path and clause with a
 * `Probe`: a pattern that must match in the claim's owner and in no other held TypeScript file
 * in the probe's scope: under its path prefixes, or among the harness's modules (`harnessModules`). A claim with no entry, an entry whose clause is gone, and a probe that
 * matches outside its owner or not in it all fail `harness/checks/one-claims.test.ts`.
 *
 * A phrase written inside a code span is a quotation, not a claim.
 */

import { HARNESS_CHECKS, HARNESS_LIB, HARNESS_SCRIPTS } from './test-globs.ts';

/** A claim of a single owner, up to the end of its clause. */
const CLAIM = /\b(?:the (?:one|only) (?:owner|module|place|reader|writer)|nowhere else|stated once)\b[^.;:]*/giu;

/** How a module finds where it is on disk: the one thing only `harness/lib/paths.ts` may do. */
const LOCATES_ITSELF = /\bimport\.meta\.(?:url|dirname|filename)\b/u;

/**
 * Where else a probe's pattern must not match: in the held TypeScript files under some path prefixes,
 * or in the harness's modules, its holder's code wherever it sits (`harnessModules`).
 */
type ProbeScope = Readonly<{ kind: 'prefixes'; roots: readonly string[] }> | Readonly<{ kind: 'harness' }>;

/**
 * The scope of the held TypeScript files under some path prefixes.
 *
 * @param {readonly string[]} roots - The prefixes.
 * @returns {ProbeScope} The scope.
 */
function under(...roots: readonly string[]): ProbeScope {
  return { kind: 'prefixes', roots };
}

/** The harness's library and scripts, by path prefix: the scope of the probes that hold claims made of them alone. */
const HARNESS_PROBE_ROOTS: ProbeScope = under(HARNESS_LIB, HARNESS_SCRIPTS);

/** The harness's modules: the scope of the probes that hold claims made of the harness's code. */
const HARNESS_MODULES: ProbeScope = { kind: 'harness' };

/** The scope of a claim held over every held TypeScript file: the empty prefix every path starts with. */
const EVERY_HELD_FILE: ProbeScope = under('');

/** A pattern that must match in `owner` and in no other held TypeScript file in its `scope`. */
interface Probe {
  readonly pattern: Readonly<RegExp>;
  readonly owner: string;
  readonly scope: ProbeScope;
}

/** A registered claim: where it is written, its clause, and the probe that holds it. */
interface Claim {
  readonly path: string;
  readonly clause: string;
  readonly probe: Probe;
}

/**
 * The claim clauses of one line of prose.
 *
 * @param {string} text - The line.
 * @returns {readonly string[]} Each claim clause, trimmed.
 */
function clauses(text: string): readonly string[] {
  const found: string[] = [];
  for (const [clause] of text.matchAll(CLAIM)) {
    found.push(clause.trim());
  }
  return found;
}

/**
 * A probe of `pattern` in `owner`.
 *
 * @param {Readonly<RegExp>} pattern - What must match in the owner and in no other module in `scope`.
 * @param {string} owner - The owning module.
 * @param {ProbeScope} scope - Where else the pattern must not match.
 * @returns {Probe} The probe.
 */
function probe(pattern: Readonly<RegExp>, owner: string, scope: ProbeScope = EVERY_HELD_FILE): Probe {
  return { owner, pattern, scope };
}

/** Every registered claim. */
const CLAIMS: readonly Claim[] = [
  {
    clause: "the one reader of a manifest's  every other asks",
    path: `${HARNESS_LIB}workspace.ts`,
    probe: probe(/is no string: a package[']s name is a string, or none/u, `${HARNESS_LIB}workspace.ts`, HARNESS_PROBE_ROOTS),
  },
  {
    clause: 'stated once, in',
    path: `${HARNESS_CHECKS}source-files.test.ts`,
    probe: probe(/new Accepted<HeldKind>\(/u, `${HARNESS_LIB}source-files.ts`, HARNESS_PROBE_ROOTS),
  },
  {
    clause: "The one reader of the repository's prose",
    path: `${HARNESS_LIB}docs.ts`,
    probe: probe(/^const FENCE = /mu, `${HARNESS_LIB}markdown-text.ts`),
  },
  {
    clause: 'The one owner of exemption lists',
    path: `${HARNESS_LIB}exemptions.ts`,
    probe: probe(/^export \{[^}]*\b(?:Accepted|Exemptions|Prefixes)\b[^}]*\} from '\.\/exemptions\//mu, `${HARNESS_LIB}exemptions.ts`),
  },
  {
    clause: 'nowhere else in the harness',
    path: `${HARNESS_LIB}paths.ts`,
    probe: probe(LOCATES_ITSELF, `${HARNESS_LIB}paths.ts`, HARNESS_PROBE_ROOTS),
  },
  {
    clause: 'The one module allowed to compute where the repository is',
    path: `${HARNESS_CHECKS}repo-paths.test.ts`,
    probe: probe(LOCATES_ITSELF, `${HARNESS_LIB}paths.ts`, HARNESS_PROBE_ROOTS),
  },
  {
    clause: 'the one place a',
    path: 'packages/foundation/src/sim/system.ts',
    probe: probe(/^function reclaim\(/mu, 'packages/foundation/src/sim/system.ts', under('packages/')),
  },
  {
    clause: "The one reader of chat's records keyed by chat id",
    path: 'packages/systems/chat/src/model/keyed.ts',
    probe: probe(/\bObject\.hasOwn\(record, key\)/u, 'packages/systems/chat/src/model/keyed.ts', under('packages/systems/chat/')),
  },
  {
    clause: "The one module of the harness's scripts that writes to the standard streams",
    path: `${HARNESS_LIB}output.ts`,
    probe: probe(/\bprocess\.(?:stdout|stderr)\b/u, `${HARNESS_LIB}output.ts`, HARNESS_PROBE_ROOTS),
  },
  {
    clause: 'The one owner of building the product from the gate',
    path: `${HARNESS_LIB}build.ts`,
    probe: probe(/\bbin\('vite'\)/u, `${HARNESS_LIB}build.ts`, HARNESS_MODULES),
  },
  {
    clause: 'The one owner of the unused-code scan',
    path: `${HARNESS_LIB}deadcode.ts`,
    probe: probe(/\bbin\('knip'\)/u, `${HARNESS_LIB}deadcode.ts`, HARNESS_MODULES),
  },
  {
    clause: 'The one owner of the Node floor',
    path: `${HARNESS_LIB}node-floor.ts`,
    probe: probe(/\['engines'\]/u, `${HARNESS_LIB}node-floor.ts`, HARNESS_MODULES),
  },
  {
    clause: "The one owner of the harness's stylesheet scans",
    path: `${HARNESS_LIB}stylesheets.ts`,
    probe: probe(/\bstylelint\.lint\(/u, `${HARNESS_LIB}stylesheets.ts`, HARNESS_MODULES),
  },
  {
    clause: 'The one owner of starting a child process',
    path: `${HARNESS_LIB}process.ts`,
    probe: probe(/^import .* from 'node:child_process';$/mu, `${HARNESS_LIB}process.ts`),
  },
  {
    clause: "the one writer of the repository's own files, for the fixers",
    path: `${HARNESS_LIB}source-files.ts`,
    probe: probe(/\bwrite\w*\((?:path\.join\(REPO_ROOT|fromRoot\()/u, `${HARNESS_LIB}source-files.ts`, HARNESS_MODULES),
  },
];

export { CLAIMS, clauses };
export type { Claim, Probe, ProbeScope };
