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
 * oxlint's `reportUnusedDisableDirectives` fails a disable that suppresses nothing.
 */

import { describe, expect, test } from 'vitest';

import { Accepted, CountedExemptions, Exemptions, StaleExemptionError, site } from '../lib/exemptions.ts';
import { heldFiles } from '../lib/scope.ts';
import { textOf } from '../lib/source-files.ts';
import { body, comments, parse } from '../lib/ts-source.ts';

export const HARNESS_ID = 'suppressions';

/** Which suppressing tool checks which file suffix, as `tool:suffix`. */
const CHECKS = new Accepted([
  'oxlint:.ts',
  'oxlint:.tsx',
  'oxlint:.js',
  'oxlint:.mjs',
  'typescript:.ts',
  'typescript:.tsx',
  'biome:.css',
  'biome:.json',
  'stylelint:.css',
  'coverage:.ts',
  'coverage:.tsx',
  'coverage:.js',
  'coverage:.mjs',
]);

/** The held suffixes whose comments the census reads. */
const SCANNED = new Accepted(['.ts', '.tsx', '.js', '.mjs', '.css']);

/** The suppressions the code holds, keyed by `site(path, tool:rule)`, with their counts and reasons. */
const SUPPRESSIONS = new CountedExemptions({
  [site('packages/foundation/src/sim/system.ts', 'oxlint:typescript/no-unsafe-type-assertion')]: [
    2,
    'stateOf and viewOf: the erasure owner reads a system value back after proving the owner id matches',
  ],
  [site('packages/foundation/src/testing/harness.ts', 'oxlint:eslint/no-await-in-loop')]: [
    3,
    'the fixture drain settles each pass and each input in order; the order is the trace',
  ],
  [site('packages/foundation/src/sim/exhaustive.test.ts', 'oxlint:typescript/switch-exhaustiveness-check')]: [
    1,
    'the planted non-exhaustive switch the test proves the compiler refuses',
  ],
  [site('packages/foundation/src/sim/exhaustive.test.ts', 'typescript:expect-error')]: [
    1,
    'the planted missing case: the expected error is the proof',
  ],
  [site('packages/characterisation/src/fixtures/adapter.tsx', 'oxlint:solid/reactivity')]: [
    1,
    'the read forces the planted memo whose store write the fixture records',
  ],
  [site('packages/characterisation/src/fixtures/ownership.tsx', 'oxlint:solid/reactivity')]: [
    2,
    'the planted memos created where Solid refuses a primitive; the fixture records the refusal',
  ],
  [site('packages/characterisation/src/fixtures/props.tsx', 'oxlint:solid/no-destructure')]: [
    1,
    'the planted destructured part whose staleness the fixture records',
  ],
  [site('packages/characterisation/src/fixtures/csp.tsx', 'oxlint:aricanga/style-prop')]: [
    1,
    'the planted style prop whose CSP effect the fixture records',
  ],
  [site('packages/foundation/src/host/runtime.test.ts', 'oxlint:typescript/unbound-method')]: [
    1,
    'isMockFunction inspects the function and never calls it',
  ],
});

/** Refused comments the code still holds while the census is adopted, keyed by `site(path, problem)`. */
const ADOPTING = new Exemptions({});

const RULES = String.raw`[@\w./-]+(?:\s*,\s*[@\w./-]+)*`;
const DISABLE = /^(oxlint|eslint|stylelint)-disable(-next-line|-line)?\b(.*)$/s;
const ENABLE = /^(oxlint|eslint|stylelint)-enable\b/;
const BIOME = /^biome-ignore(?:-all|-start|-end)?\b(.*)$/s;
const EXPECT_ERROR = /^@ts-expect-error\b(.*)$/s;
const REFUSED_TS = /^@ts-(ignore|nocheck)\b/;
const COVERAGE = /^(v8|c8|istanbul)\s+ignore\b/;

/** A suppression comment the census refuses. */
export interface Problem {
  readonly path: string;
  readonly line: number;
  readonly problem: string;
}

/** What the census finds in one module: the refused comments and the counted sites. */
export interface Census {
  readonly problems: readonly Problem[];
  readonly sites: readonly string[];
}

function suffix(path: string): string {
  return /\.[a-z]+$/.exec(path)?.[0] ?? '';
}

/** The comments of a stylesheet: every `/* … *\/` outside a quoted string. */
export function cssComments(text: string): { readonly text: string; readonly line: number }[] {
  const found: { text: string; line: number }[] = [];
  let index = 0;
  let quote: string | undefined;
  while (index < text.length) {
    const char = text[index] ?? '';
    if (quote !== undefined) {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = undefined;
      }
      index += 1;
    } else if (char === '"' || char === "'") {
      quote = char;
      index += 1;
    } else if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      const stop = end === -1 ? text.length : end + 2;
      found.push({ text: text.slice(index, stop), line: text.slice(0, index).split('\n').length });
      index = stop;
    } else {
      index += 1;
    }
  }
  return found;
}

function commentsOf(path: string, text: string): { readonly text: string; readonly line: number }[] {
  return path.endsWith('.css') ? cssComments(text) : comments(parse(path, text));
}

/** The census of one module: each suppression is refused or counted under `(path, tool:rule)`. */
export function census(path: string, text: string): Census {
  const problems: Problem[] = [];
  const sites: string[] = [];
  const refuse = (line: number, problem: string): void => {
    problems.push({ path, line, problem });
  };
  const count = (tool: string, rules: readonly string[], line: number): void => {
    if (CHECKS.has(`${tool}:${suffix(path)}`)) {
      sites.push(...rules.map((rule) => site(path, `${tool}:${rule}`)));
    } else {
      refuse(line, `${tool} does not check ${suffix(path)} files`);
    }
  };
  for (const comment of commentsOf(path, text)) {
    const directive = body(comment.text);
    const disable = DISABLE.exec(directive);
    const biome = BIOME.exec(directive);
    const expectError = EXPECT_ERROR.exec(directive);
    if (disable !== null) {
      const [, tool = '', , rest = ''] = disable;
      const named = new RegExp(`^\\s+(${RULES})\\s+--\\s+\\S`).exec(rest);
      if (tool === 'eslint') {
        refuse(comment.line, 'eslint-disable is not honoured: use oxlint-disable');
      } else if (named === null) {
        refuse(comment.line, `a ${tool}-disable names its rules and ends with -- <reason>`);
      } else {
        count(tool, (named[1] ?? '').split(',').map((rule) => rule.trim()), comment.line);
      }
    } else if (ENABLE.test(directive)) {
      continue;
    } else if (biome !== null) {
      const named = /^\s+(lint\/[\w/]+)(?:\([^)]*\))?:\s*\S/.exec(biome[1] ?? '');
      if (named === null) {
        refuse(comment.line, 'a biome-ignore names its lint/... rule and ends with : <reason>');
      } else {
        count('biome', [named[1] ?? ''], comment.line);
      }
    } else if (expectError !== null) {
      if (/^\s+--\s+\S/.test(expectError[1] ?? '')) {
        count('typescript', ['expect-error'], comment.line);
      } else {
        refuse(comment.line, 'a @ts-expect-error ends with -- <reason>');
      }
    } else if (REFUSED_TS.test(directive)) {
      refuse(comment.line, `${directive.split(/\s/)[0] ?? ''} is refused: fix the type, or expect the error with its reason`);
    } else if (COVERAGE.test(directive)) {
      count('coverage', ['ignore'], comment.line);
    }
  }
  return { problems, sites };
}

/** The census over every held file the suppressions can sit in. */
function repoCensus(): Census {
  const all = heldFiles()
    .filter((path) => SCANNED.has(suffix(path)))
    .map((path) => census(path, textOf(path)));
  return { problems: all.flatMap((one) => one.problems), sites: all.flatMap((one) => one.sites) };
}

describe('the repository', () => {
  test('every suppression names its rule, a tool that checks the file, and its reason', () => {
    expect(ADOPTING.unexemptedBy(repoCensus().problems, (found) => site(found.path, found.problem))).toEqual([]);
  });

  test('every suppression is counted with its reason', () => {
    expect(SUPPRESSIONS.mismatches(repoCensus().sites)).toEqual([]);
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
    expect(census('packages/plant/src/a.ts', text).problems.map((found) => found.problem)).toEqual([problem]);
  });

  test.each([
    ['/* stylelint-disable-next-line color-named */\na { color: red; }', 'a stylelint-disable names its rules and ends with -- <reason>'],
    ['/* biome-ignore lint/style/noX */\na { color: red; }', 'a biome-ignore names its lint/... rule and ends with : <reason>'],
    ['/* oxlint-disable no-console -- why */\na { color: red; }', 'oxlint does not check .css files'],
  ])('refuses %j in a stylesheet', (text, problem) => {
    expect(census('packages/plant/src/a.css', text).problems.map((found) => found.problem)).toEqual([problem]);
  });

  test('counts a suppression written as a JSX comment', () => {
    const text = [
      'export const view = (',
      '  <p>',
      '    {/* oxlint-disable-next-line aricanga/style-prop -- the planted JSX comment */}',
      '    <span style={{ color: "red" }} />',
      '  </p>',
      ');',
    ].join('\n');
    expect(census('packages/plant/src/a.tsx', text)).toEqual({
      problems: [],
      sites: [site('packages/plant/src/a.tsx', 'oxlint:aricanga/style-prop')],
    });
  });

  test('counts each reasoned suppression under its tool and rule', () => {
    const text = [
      '// oxlint-disable-next-line no-console, no-alert -- the planted pair',
      'console.log(1);',
      '/* oxlint-disable typescript/no-explicit-any -- a block */',
      '// oxlint-enable typescript/no-explicit-any',
      '// @ts-expect-error -- the planted mismatch',
      'const x: number = "a";',
      '/* v8 ignore next -- an unreachable arm */',
    ].join('\n');
    expect(census('packages/plant/src/a.ts', text)).toEqual({
      problems: [],
      sites: [
        site('packages/plant/src/a.ts', 'oxlint:no-console'),
        site('packages/plant/src/a.ts', 'oxlint:no-alert'),
        site('packages/plant/src/a.ts', 'oxlint:typescript/no-explicit-any'),
        site('packages/plant/src/a.ts', 'typescript:expect-error'),
        site('packages/plant/src/a.ts', 'coverage:ignore'),
      ],
    });
    expect(census('packages/plant/src/a.css', '/* stylelint-disable-next-line color-named -- the token is the name */\na{}').sites).toEqual([
      site('packages/plant/src/a.css', 'stylelint:color-named'),
    ]);
  });

  test.each([
    'const TEXT = "// oxlint-disable-line and // @ts-ignore inside a string";',
    'const T = `/* @ts-nocheck */ ${1}`;',
    '// a note about the oxlint-disable convention, not a directive: nothing to see',
    '/** Explains that @ts-ignore is refused here. */\nexport {};',
  ])('lets a near miss through: %j', (text) => {
    expect(census('packages/plant/src/a.ts', text)).toEqual({ problems: [], sites: [] });
  });

  test('lets a comment-like string in a stylesheet through', () => {
    expect(census('packages/plant/src/a.css', 'a::before { content: "/* stylelint-disable */"; }')).toEqual({
      problems: [],
      sites: [],
    });
  });

  test('a counted suppression that went away, or a new one, fails', () => {
    const counted = new CountedExemptions({ [site('a.ts', 'oxlint:no-console')]: [1, 'planted'] });
    expect(() => counted.assertExact([])).toThrow(StaleExemptionError);
    expect(() => counted.assertExact([site('a.ts', 'oxlint:no-console'), site('a.ts', 'oxlint:no-console')])).toThrow(
      StaleExemptionError,
    );
  });
});
