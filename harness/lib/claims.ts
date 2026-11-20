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
export const CLAIM: RegExp =
  /\b(?:the (?:one|only) (?:owner|module|place|reader|writer)|nowhere else|stated once)\b[^.;:]*/gi;

/** A pattern that must match in `owner` and in no other held TypeScript file under `roots`. */
export interface Probe {
  readonly pattern: RegExp;
  readonly owner: string;
  readonly roots: readonly string[];
}

/** A registered claim: where it is written, its clause, and the probe that holds it. */
export interface Claim {
  readonly path: string;
  readonly clause: string;
  readonly probe: Probe;
}

/** The claim clauses of one line of prose. */
export function clauses(text: string): readonly string[] {
  return [...text.matchAll(CLAIM)].map((match) => match[0].trim());
}

function probe(pattern: RegExp, owner: string, roots: readonly string[] = ROOTS): Probe {
  return { pattern, owner, roots };
}

export const CLAIMS: readonly Claim[] = [
  {
    path: 'harness/lib/docs.ts',
    clause: "The one reader of the repository's prose",
    probe: probe(/^const FENCE = /m, 'harness/lib/docs.ts'),
  },
  {
    path: 'harness/lib/exemptions.ts',
    clause: 'The one owner of exemption lists',
    probe: probe(/^export class (?:\w*Exemptions|Accepted|Prefixes)\b/m, 'harness/lib/exemptions.ts'),
  },
  {
    path: 'harness/lib/paths.ts',
    clause: 'nowhere else in the harness',
    probe: probe(/\bimport\.meta\.url\b/, 'harness/lib/paths.ts', ['harness/lib/', 'harness/scripts/']),
  },
  {
    path: 'harness/checks/repo-paths.test.ts',
    clause: 'The one module allowed to compute where the repository is',
    probe: probe(/\bimport\.meta\.url\b/, 'harness/lib/paths.ts', ['harness/lib/', 'harness/scripts/']),
  },
  {
    path: 'packages/foundation/src/sim/system.ts',
    clause: 'the one place a',
    probe: probe(/typescript\/no-unsafe-type-assertion/, 'packages/foundation/src/sim/system.ts', [
      'packages/foundation/',
      'packages/systems/',
      'experiences/sandbox/',
    ]),
  },
  {
    path: 'harness/lib/output.ts',
    clause: "The one module of the harness's scripts that writes to the standard streams",
    probe: probe(/\bprocess\.(?:stdout|stderr)\b/, 'harness/lib/output.ts', ['harness/lib/', 'harness/scripts/']),
  },
  {
    path: 'harness/lib/process.ts',
    clause: 'The one owner of starting a child process',
    probe: probe(/^import .* from 'node:child_process';$/m, 'harness/lib/process.ts'),
  },
];
