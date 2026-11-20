/**
 * Every claim of a single owner in current text is registered, and its probe holds it.
 *
 * The claims and their probes are `CLAIMS` in `harness/lib/claims.ts`. A probe must match in the
 * claim's owner and in no other held TypeScript file under its roots: a second match means the
 * claim is false.
 */

import { describe, expect, test } from 'vitest';

import { CLAIMS, clauses } from '../lib/claims.ts';
import type { Claim, Probe } from '../lib/claims.ts';
import { currentText, Doc } from '../lib/docs.ts';
import type { Prose } from '../lib/docs.ts';
import { Exemptions, StaleExemptionError, site } from '../lib/exemptions.ts';
import { typescriptFiles } from '../lib/scope.ts';
import { textOf } from '../lib/source-files.ts';

export const HARNESS_ID = 'one-claims';

/** Every `site(path, clause)` claim of current text, sorted and once each. */
export function foundClaims(lines: readonly Prose[]): string[] {
  return [...new Set(lines.flatMap((line) => clauses(line.text).map((clause) => site(line.path, clause))))].toSorted();
}

/** The claims as an exemption list: an entry whose clause is gone from its file is stale. */
export function registry(claims: readonly Claim[]): Exemptions {
  return new Exemptions(
    Object.fromEntries(claims.map((claim) => [site(claim.path, claim.clause), `held by ${String(claim.probe.pattern)}`])),
  );
}

/** What breaks a probe: no match in its owner, or a match outside it. */
export function probeProblems(probe: Probe, texts: ReadonlyMap<string, string>): string[] {
  const matched = [...texts]
    .filter(([path, text]) => probe.roots.some((root) => path.startsWith(root)) && probe.pattern.test(text))
    .map(([path]) => path)
    .toSorted();
  const problems = matched.includes(probe.owner)
    ? []
    : [`${String(probe.pattern)} does not match in its owner ${probe.owner}`];
  return [
    ...problems,
    ...matched.filter((path) => path !== probe.owner).map((path) => `${String(probe.pattern)} matches outside its owner, in ${path}`),
  ];
}

function sources(): ReadonlyMap<string, string> {
  return new Map(typescriptFiles().map((path) => [path, textOf(path)] as const));
}

describe('the repository', () => {
  test('every claim is registered and every entry is live', () => {
    expect(registry(CLAIMS).unexempted(foundClaims(currentText()))).toEqual([]);
  });

  test.each(CLAIMS.map((claim) => [`${claim.path}: ${claim.clause}`, claim] as const))('the claim %s holds', (_label, claim) => {
    expect(probeProblems(claim.probe, sources())).toEqual([]);
  });
});

describe('the claims check', () => {
  test('sees an unregistered claim', () => {
    const planted = [{ line: 1, path: 'src/planted.ts', text: 'This module is the only reader of the cache.' }];
    expect(registry([]).unexempted(foundClaims(planted))).toEqual([site('src/planted.ts', 'the only reader of the cache')]);
  });

  test('fails an entry whose claim is gone', () => {
    const gone: Claim[] = [
      { clause: 'the only reader of the cache', path: 'src/planted.ts', probe: { owner: 'src/planted.ts', pattern: /x/, roots: ['src/'] } },
    ];
    expect(() => registry(gone).unexempted([])).toThrow(StaleExemptionError);
  });

  test('fails a probe that matches outside its owner or not in it', () => {
    const texts = new Map([
      ['src/owner.ts', 'export function read() {}\n'],
      ['src/other.ts', 'export function read() {}\n'],
      ['docs/x.ts', 'export function read() {}\n'],
    ]);
    expect(probeProblems({ owner: 'src/owner.ts', pattern: /^export function read\b/m, roots: ['src/'] }, texts)).toEqual([
      String.raw`/^export function read\b/m matches outside its owner, in src/other.ts`,
    ]);
    expect(probeProblems({ owner: 'src/owner.ts', pattern: /^export function write\b/m, roots: ['src/'] }, texts)).toEqual([
      String.raw`/^export function write\b/m does not match in its owner src/owner.ts`,
    ]);
  });

  test('takes a phrase in a code span as a quotation, not a claim', () => {
    expect(foundClaims(new Doc('docs/planted.md', 'The check looks for `the only reader`.\n').prose())).toEqual([]);
    expect(clauses('It is stated once, here; the rest follows.')).toEqual(['stated once, here']);
  });
});
