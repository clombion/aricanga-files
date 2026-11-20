/**
 * Every suppression names its rule, a tool that checks the file, and its reason, and each is counted.
 *
 * Over every held `.ts`, `.tsx`, `.js`, `.mjs` and `.css` file's comments:
 *
 * - `oxlint-disable*` and `stylelint-disable*` name their rules and end with `-- <reason>`;
 *   `biome-ignore` names its `lint/...` rule and ends with `: <reason>`;
 * - `@ts-expect-error` ends with `-- <reason>`; `@ts-ignore` and `@ts-nocheck` are refused;
 * - `eslint-disable*` is refused: oxlint does not honour it here (`respectEslintDisableDirectives`
 *   is off), so it is dead text;
 * - a directive of a tool that does not check the file's type is refused;
 * - a coverage pragma (`v8`, `c8` or `istanbul` `ignore`) is a suppression of the coverage floor.
 *
 * Every suppression that passes is a site `(path, tool:rule)`, and `SUPPRESSIONS` holds each site's
 * count and reason: a new suppression, or one that went away, fails until its count is updated.
 * oxlint's `reportUnusedDisableDirectives` fails a disable that suppresses nothing. The reader the
 * census parses through closes its TypeScript session idempotently, so the exit hook after an explicit
 * close is a no-op and a later parse opens a fresh session.
 */

import { Accepted, CountedExemptions, Exemptions, StaleExemptionError, site } from '#lib/exemptions.ts';
import { census, suffix } from './suppressions.census.ts';
import { closeSession, parse } from '#lib/ts-source.ts';
import { describe, expect, test } from 'vitest';
import type { Census } from './suppressions.census.ts';
import { heldFiles } from '#lib/scope.ts';
import { textOf } from '#lib/source-files.ts';

const HARNESS_ID = 'suppressions';

/** The held suffixes whose comments the census reads. */
const SCANNED = new Accepted(['.ts', '.tsx', '.js', '.mjs', '.css']);

/** The suppressions the code holds, keyed by `site(path, tool:rule)`, with their counts and reasons. */
const SUPPRESSIONS = new CountedExemptions(
  {
  [site('packages/foundation/src/sim/system.ts', 'oxlint:typescript/no-unsafe-type-assertion')]: { count: 2, reason: 'stateOf and viewOf: the erasure owner reads a system value back after proving the owner id matches' },
  [site('packages/foundation/test/exhaustive.test.ts', 'oxlint:typescript/switch-exhaustiveness-check')]: { count: 1, reason: 'the planted non-exhaustive switch the test proves the compiler refuses' },
  [site('packages/foundation/test/exhaustive.test.ts', 'typescript:expect-error')]: { count: 1, reason: 'the planted missing case: the expected error is the proof' },
  [site('packages/characterisation/src/fixtures/adapter.tsx', 'oxlint:solid/reactivity')]: { count: 1, reason: 'the read forces the planted memo whose store write the fixture records' },
  [site('packages/characterisation/src/fixtures/ownership.tsx', 'oxlint:solid/reactivity')]: { count: 2, reason: 'the planted memos created where Solid refuses a primitive; the fixture records the refusal' },
  [site('packages/characterisation/src/fixtures/ownership.tsx', 'oxlint:unicorn/no-null')]: { count: 1, reason: "the planted runWithOwner(null, …): Solid's API takes null for no owner" },
  [site('packages/characterisation/src/fixtures/props.tsx', 'oxlint:solid/no-destructure')]: { count: 1, reason: 'the planted destructured part whose staleness the fixture records' },
  [site('packages/characterisation/src/fixtures/csp.tsx', 'oxlint:aricanga/style-prop')]: { count: 1, reason: 'the planted style prop whose CSP effect the fixture records' },
  },
);

/** Refused comments the code still holds while the census is adopted, keyed by `site(path, problem)`. */
const ADOPTING = new Exemptions({});

/** The statements a parse of a one-statement module holds. */
const ONE_STATEMENT = 1;

/**
 * The census over every held file the suppressions can sit in.
 *
 * @returns {Census} The census over every held file the suppressions can sit in.
 */
function repoCensus(): Census {
  const all = heldFiles()
    .filter((path) => SCANNED.has(suffix(path)))
    .map((path) => census(path, textOf(path)));
  return { problems: all.flatMap((one) => one.problems), sites: all.flatMap((one) => one.sites) };
}

describe('the repository', () => {
  test('every suppression names its rule, a tool that checks the file, and its reason', () => {
    expect.hasAssertions();
    const { problems } = repoCensus();
    expect(ADOPTING.unexemptedBy(problems, (found) => site(found.path, found.problem))).toStrictEqual([]);
  });

  test('every suppression is counted with its reason', () => {
    expect.hasAssertions();
    const { sites } = repoCensus();
    expect(SUPPRESSIONS.mismatches(sites)).toStrictEqual([]);
  });
});

describe('the census', () => {
  test.each([
    ['const x = 1; // oxlint-disable-line', 'a oxlint-disable names its rules and ends with -- <reason>'],
    ['// oxlint-disable-next-line no-console\nconsole.log(1);', 'a oxlint-disable names its rules and ends with -- <reason>'],
    ['/* oxlint-disable no-console because */', 'a oxlint-disable names its rules and ends with -- <reason>'],
    ['// eslint-disable-next-line no-console -- why\nconsole.log(1);', 'eslint-disable is not honoured: use oxlint-disable'],
    ['// @ts-expect-error\nconst x: number = "a";', 'a @ts-expect-error ends with -- <reason>'],
    ['// @ts-expect-error - why\nconst x: number = "a";', 'a @ts-expect-error ends with -- <reason>'],
    ['// @ts-ignore\nconst x: number = "a";', '@ts-ignore is refused: fix the type, or expect the error with its reason'],
    ['// @ts-nocheck\nexport {};', '@ts-nocheck is refused: fix the type, or expect the error with its reason'],
    ['// biome-ignore lint/style/noX: why\nexport {};', 'biome does not check .ts files'],
    ['/* stylelint-disable-next-line color-named -- why */\nexport {};', 'stylelint does not check .ts files'],
  ])('refuses %j in a module', (text, problem) => {
    expect.hasAssertions();
    expect(census('packages/plant/src/a.ts', text).problems.map((found) => found.problem)).toStrictEqual([problem]);
  });

  test.each([
    ['/* stylelint-disable-next-line color-named */\na { color: red; }', 'a stylelint-disable names its rules and ends with -- <reason>'],
    ['/* biome-ignore lint/style/noX */\na { color: red; }', 'a biome-ignore names its lint/... rule and ends with : <reason>'],
    ['/* oxlint-disable no-console -- why */\na { color: red; }', 'oxlint does not check .css files'],
  ])('refuses %j in a stylesheet', (text, problem) => {
    expect.hasAssertions();
    expect(census('packages/plant/src/a.css', text).problems.map((found) => found.problem)).toStrictEqual([problem]);
  });

});

describe('the census of counted suppressions', () => {
  test('counts a suppression written as a JSX comment', () => {
    expect.hasAssertions();
    const text = [
      'export const view = (',
      '  <p>',
      '    {/* oxlint-disable-next-line aricanga/style-prop -- the planted JSX comment */}',
      '    <span style={{ color: "red" }} />',
      '  </p>',
      ');',
    ].join('\n');
    expect(census('packages/plant/src/a.tsx', text)).toStrictEqual({
      problems: [],
      sites: [site('packages/plant/src/a.tsx', 'oxlint:aricanga/style-prop')],
    });
  });

  test('counts each reasoned suppression under its tool and rule', () => {
    expect.hasAssertions();
    const text = [
      '// oxlint-disable-next-line no-console, no-alert -- the planted pair',
      'console.log(1);',
      '/* oxlint-disable typescript/no-explicit-any -- a block */',
      '// oxlint-enable typescript/no-explicit-any',
      '// @ts-expect-error -- the planted mismatch',
      'const x: number = "a";',
      '/* v8 ignore next -- an unreachable arm */',
    ].join('\n');
    expect(census('packages/plant/src/a.ts', text)).toStrictEqual({
      problems: [],
      sites: [
        site('packages/plant/src/a.ts', 'oxlint:no-console'),
        site('packages/plant/src/a.ts', 'oxlint:no-alert'),
        site('packages/plant/src/a.ts', 'oxlint:typescript/no-explicit-any'),
        site('packages/plant/src/a.ts', 'typescript:expect-error'),
        site('packages/plant/src/a.ts', 'coverage:ignore'),
      ],
    });
    expect(census('packages/plant/src/a.css', '/* stylelint-disable-next-line color-named -- the token is the name */\na{}').sites).toStrictEqual([
      site('packages/plant/src/a.css', 'stylelint:color-named'),
    ]);
  });

});

describe('the census of near misses', () => {
  test.each([
    'const TEXT = "// oxlint-disable-line and // @ts-ignore inside a string";',
    ['const T = `/* @ts-nocheck */ $', '{1}`;'].join(''),
    '// a note about the oxlint-disable convention, not a directive: nothing to see',
    '/** Explains that @ts-ignore is refused here. */\nexport {};',
  ])('lets a near miss through: %j', (text) => {
    expect.hasAssertions();
    expect(census('packages/plant/src/a.ts', text)).toStrictEqual({ problems: [], sites: [] });
  });

  test('lets a comment-like string in a stylesheet through', () => {
    expect.hasAssertions();
    expect(census('packages/plant/src/a.css', 'a::before { content: "/* stylelint-disable */"; }')).toStrictEqual({
      problems: [],
      sites: [],
    });
  });

  test('a counted suppression that went away, or a new one, fails', () => {
    expect.hasAssertions();
    const once = new CountedExemptions({ [site('a.ts', 'oxlint:no-console')]: { count: 1, reason: 'planted' } });
    const twice = [site('a.ts', 'oxlint:no-console'), site('a.ts', 'oxlint:no-console')];
    expect(() => {
      once.assertExact([]);
    }).toThrow(StaleExemptionError);
    expect(() => {
      once.assertExact(twice);
    }).toThrow(StaleExemptionError);
  });
});

describe('the source reader', () => {
  test('closes its session once, and parses on a fresh session after', () => {
    expect.hasAssertions();
    parse('packages/plant/src/a.ts', 'export const a = 1;\n');
    closeSession();
    expect(() => {
      closeSession();
    }).not.toThrow();
    expect(parse('packages/plant/src/b.ts', 'export const b = 2;\n').statements).toHaveLength(ONE_STATEMENT);
  });
});

export { HARNESS_ID };
