/**
 * Every claim of a single owner in current text is registered, and its probe holds it.
 *
 * The claims and their probes are `CLAIMS` in `harness/lib/claims.ts`. A probe must match in the
 * claim's owner and in no other held TypeScript file under its roots: a second match means the
 * claim is false.
 */

import { CLAIMS, clauses } from '#lib/claims.ts';
import type { Claim, Probe } from '#lib/claims.ts';
import { Doc, currentText } from '#lib/docs.ts';
import { Exemptions, StaleExemptionError, site } from '#lib/exemptions.ts';
import { describe, expect, test } from 'vitest';
import type { DeepReadonly } from '#lib/readonly.ts';
import type { Prose } from '#lib/docs.ts';
import { textsOf } from '#lib/source-files.ts';
import { typescriptFiles } from '#lib/scope.ts';

const HARNESS_ID = 'one-claims';

/**
 * Every `site(path, clause)` claim of current text, sorted and once each.
 *
 * @param {readonly Prose[]} lines - The lines.
 * @returns {string[]} Every `site(path, clause)` claim of current text, sorted and once each.
 */
function foundClaims(lines: readonly Prose[]): string[] {
  return [...new Set(lines.flatMap((line) => clauses(line.text).map((clause) => site(line.path, clause))))].toSorted();
}

/**
 * A pattern as `String` writes a regular expression: its source between slashes, then its flags.
 *
 * @param {Readonly<RegExp>} pattern - The pattern.
 * @returns {string} The pattern's literal text.
 */
function patternText(pattern: Readonly<RegExp>): string {
  return `/${pattern.source}/${pattern.flags}`;
}

/**
 * The claims as an exemption list: an entry whose clause is gone from its file is stale.
 *
 * @param {readonly Claim[]} claims - The claims.
 * @returns {Exemptions} The claims as an exemption list: an entry whose clause is gone from its file is stale.
 */
function registry(claims: readonly DeepReadonly<Claim>[]): Exemptions {
  return new Exemptions(
    Object.fromEntries(
      claims.map((claim: DeepReadonly<Claim>) => [site(claim.path, claim.clause), `held by ${patternText(claim.probe.pattern)}`]),
    ),
  );
}

/**
 * What breaks a probe: no match in its owner, or a match outside it.
 *
 * @param {Probe} probe - The probe.
 * @param {ReadonlyMap<string, string>} texts - The texts.
 * @returns {string[]} What breaks a probe: no match in its owner, or a match outside it.
 */
function probeProblems(probe: DeepReadonly<Probe>, texts: ReadonlyMap<string, string>): string[] {
  const matched = [...texts]
    .filter(([path, text]: readonly [string, string]) => probe.roots.some((root) => path.startsWith(root)) && probe.pattern.test(text))
    .map(([path]: readonly [string, string]) => path)
    .toSorted();
  const problems = matched.includes(probe.owner) ? [] : [`${patternText(probe.pattern)} does not match in its owner ${probe.owner}`];
  return [
    ...problems,
    ...matched.filter((path) => path !== probe.owner).map((path) => `${patternText(probe.pattern)} matches outside its owner, in ${path}`),
  ];
}

/**
 * The held TypeScript sources, by path.
 *
 * @returns {Promise<ReadonlyMap<string, string>>} Each held module's text, by path.
 */
async function sources(): Promise<ReadonlyMap<string, string>> {
  const files = await typescriptFiles();
  const texts = await textsOf(files);
  return new Map(texts);
}

describe('the repository', () => {
  test('every claim is registered and every entry is live', async () => {
    expect.hasAssertions();
    const found = foundClaims(await currentText());
    expect(registry(CLAIMS).unexempted(found)).toStrictEqual([]);
  });

  test.each(CLAIMS.map((claim: DeepReadonly<Claim>) => [`${claim.path}: ${claim.clause}`, claim] as const))(
    'the claim %s holds',
    async (_label: string, claim: DeepReadonly<Claim>) => {
      expect.hasAssertions();
      expect(probeProblems(claim.probe, await sources())).toStrictEqual([]);
    },
  );
});

describe('the claims check', () => {
  test('sees an unregistered claim', () => {
    expect.hasAssertions();
    const planted = [{ line: 1, path: 'src/planted.ts', text: 'This module is the only reader of the cache.' }];
    expect(registry([]).unexempted(foundClaims(planted))).toStrictEqual([site('src/planted.ts', 'the only reader of the cache')]);
  });

  test('fails an entry whose claim is gone', () => {
    expect.hasAssertions();
    const gone: Claim[] = [
      {
        clause: 'the only reader of the cache',
        path: 'src/planted.ts',
        probe: { owner: 'src/planted.ts', pattern: /x/u, roots: ['src/'] },
      },
    ];
    expect(() => registry(gone).unexempted([])).toThrow(StaleExemptionError);
  });

  test('fails a probe that matches outside its owner or not in it', () => {
    expect.hasAssertions();
    const texts = new Map([
      ['src/owner.ts', 'export function read() {}\n'],
      ['src/other.ts', 'export function read() {}\n'],
      ['docs/x.ts', 'export function read() {}\n'],
    ]);
    expect(probeProblems({ owner: 'src/owner.ts', pattern: /^export function read\b/mu, roots: ['src/'] }, texts)).toStrictEqual([
      String.raw`/^export function read\b/mu matches outside its owner, in src/other.ts`,
    ]);
    expect(probeProblems({ owner: 'src/owner.ts', pattern: /^export function write\b/mu, roots: ['src/'] }, texts)).toStrictEqual([
      String.raw`/^export function write\b/mu does not match in its owner src/owner.ts`,
    ]);
  });

  test('takes a phrase in a code span as a quotation, not a claim', () => {
    expect.hasAssertions();
    expect(foundClaims(new Doc('docs/planted.md', 'The check looks for `the only reader`.\n').prose())).toStrictEqual([]);
    expect(clauses('It is stated once, here; the rest follows.')).toStrictEqual(['stated once, here']);
  });
});

export { HARNESS_ID, foundClaims, probeProblems, registry };
