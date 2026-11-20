/**
 * Claims of a single owner in current text, each registered with the probe that holds it.
 *
 * A sentence of current text saying `the one owner`, `the only module`, `nowhere else` or `stated
 * once` makes a claim about the code. `CLAIMS` registers each claim by its path and clause with a
 * `Probe`: a pattern that must match in the claim's owner and in no other held TypeScript file
 * under the probe's roots. A claim with no entry, an entry whose clause is gone, and a probe that
 * matches outside its owner or not in it all fail `harness/checks/one-claims.test.ts`.
 *
 * A phrase written inside a code span is a quotation, not a claim.
 */

import { ROOTS } from './scope.ts';

/** A claim of a single owner, up to the end of its clause. */
const CLAIM = /\b(?:the (?:one|only) (?:owner|module|place|reader|writer)|nowhere else|stated once)\b[^.;:]*/giu;

/** How a module finds where it is on disk: the one thing only `harness/lib/paths.ts` may do. */
const LOCATES_ITSELF = /\bimport\.meta\.(?:url|dirname|filename)\b/u;

/** The harness's library and scripts: the roots of the probes that hold the harness's own claims. */
const HARNESS_CODE: readonly string[] = ['harness/lib/', 'harness/scripts/'];

/** A pattern that must match in `owner` and in no other held TypeScript file under `roots`. */
interface Probe {
  readonly pattern: Readonly<RegExp>;
  readonly owner: string;
  readonly roots: readonly string[];
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
 * @param {Readonly<RegExp>} pattern - What must match in the owner and in no other module under `roots`.
 * @param {string} owner - The owning module.
 * @param {readonly string[]} roots - Where else the pattern must not match.
 * @returns {Probe} The probe.
 */
function probe(pattern: Readonly<RegExp>, owner: string, roots: readonly string[] = ROOTS): Probe {
  return { owner, pattern, roots };
}

/** Every registered claim. */
const CLAIMS: readonly Claim[] = [
  {
    clause: "The one reader of the repository's prose",
    path: 'harness/lib/docs.ts',
    probe: probe(/^const FENCE = /mu, 'harness/lib/markdown-text.ts'),
  },
  {
    clause: 'The one owner of exemption lists',
    path: 'harness/lib/exemptions.ts',
    probe: probe(/^export \{[^}]*\b(?:Accepted|Exemptions|Prefixes)\b[^}]*\} from '\.\/exemptions\//mu, 'harness/lib/exemptions.ts'),
  },
  {
    clause: 'nowhere else in the harness',
    path: 'harness/lib/paths.ts',
    probe: probe(LOCATES_ITSELF, 'harness/lib/paths.ts', HARNESS_CODE),
  },
  {
    clause: 'The one module allowed to compute where the repository is',
    path: 'harness/checks/repo-paths.test.ts',
    probe: probe(LOCATES_ITSELF, 'harness/lib/paths.ts', HARNESS_CODE),
  },
  {
    clause: 'the one place a',
    path: 'packages/foundation/src/sim/system.ts',
    probe: probe(/^function reclaim\(/mu, 'packages/foundation/src/sim/system.ts', ['packages/']),
  },
  {
    clause: "The one reader of chat's records keyed by chat id",
    path: 'packages/systems/chat/src/model/keyed.ts',
    probe: probe(/\bObject\.hasOwn\(record, key\)/u, 'packages/systems/chat/src/model/keyed.ts', ['packages/systems/chat/']),
  },
  {
    clause: "The one module of the harness's scripts that writes to the standard streams",
    path: 'harness/lib/output.ts',
    probe: probe(/\bprocess\.(?:stdout|stderr)\b/u, 'harness/lib/output.ts', HARNESS_CODE),
  },
  {
    clause: 'The one owner of building the product from the gate',
    path: 'harness/lib/build.ts',
    probe: probe(/\bbin\('vite'\)/u, 'harness/lib/build.ts', ['harness/']),
  },
  {
    clause: 'The one owner of the unused-code scan',
    path: 'harness/lib/deadcode.ts',
    probe: probe(/\bbin\('knip'\)/u, 'harness/lib/deadcode.ts', ['harness/']),
  },
  {
    clause: 'The one owner of the Node floor',
    path: 'harness/lib/node-floor.ts',
    probe: probe(/\['engines'\]/u, 'harness/lib/node-floor.ts', ['harness/']),
  },
  {
    clause: "The one owner of the harness's stylesheet scans",
    path: 'harness/lib/stylesheets.ts',
    probe: probe(/\bstylelint\.lint\(/u, 'harness/lib/stylesheets.ts', ['harness/']),
  },
  {
    clause: 'The one owner of starting a child process',
    path: 'harness/lib/process.ts',
    probe: probe(/^import .* from 'node:child_process';$/mu, 'harness/lib/process.ts'),
  },
  {
    clause: "the one writer of the repository's own files, for the fixers",
    path: 'harness/lib/source-files.ts',
    probe: probe(/\bwrite\w*\((?:path\.join\(REPO_ROOT|fromRoot\()/u, 'harness/lib/source-files.ts', ['harness/']),
  },
];

export { CLAIMS, clauses };
export type { Claim, Probe };
