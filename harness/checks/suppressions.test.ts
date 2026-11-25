/**
 * Every suppression names its rule, a tool that checks the file, and its reason, and each is counted.
 *
 * Over every held `.ts`, `.tsx` and `.css` file's comments (a held module is TypeScript, `scope.ts`):
 *
 * - `oxlint-disable*` and `stylelint-disable*` name their rules and end with `-- <reason>`;
 *   a `biome-ignore` is refused, since Biome checks nothing here;
 * - `@ts-expect-error` ends with `-- <reason>`; `@ts-ignore` and `@ts-nocheck` are refused;
 * - `eslint-disable*` is refused: oxlint does not honour it here (`respectEslintDisableDirectives`
 *   is off), so it is dead text;
 * - a directive of a tool that does not check the file's type is refused;
 * - a coverage pragma (`v8`, `c8` or `istanbul` `ignore`) is a suppression of the coverage floor.
 *
 * Every suppression that passes is a site `(path, tool:rule)`, and `SUPPRESSIONS` holds each site's
 * count and reason: a new suppression, or one that went away, fails until its count is updated.
 * oxlint's `reportUnusedDisableDirectives` fails a disable that suppresses nothing. The reader the
 * census parses through closes its TypeScript session idempotently, so a later parse opens a fresh
 * session, and a process that exits with its session open exits cleanly.
 */

import { Accepted, CountedExemptions, Exemptions, StaleExemptionError, site } from '#lib/exemptions.ts';
import { census, suffix } from './suppressions.census.ts';
import { closeSession, parse } from '#lib/ts-source.ts';
import { describe, expect, test } from 'vitest';
import type { Census } from './suppressions.census.ts';
import { EXIT_SUCCESS } from '#lib/output.ts';
import { finished } from '#lib/tools.ts';
import { fromRoot } from '#lib/paths.ts';
import { heldFiles } from '#lib/scope.ts';
import { pathToFileURL } from 'node:url';
import { textsOf } from '#lib/source-files.ts';

const HARNESS_ID = 'suppressions';

/** The held suffixes whose comments the census reads. */
const SCANNED = new Accepted(['.ts', '.tsx', '.css']);

/** The suppressions the code holds, keyed by `site(path, tool:rule)`, with their counts and reasons. */
const SUPPRESSIONS = new CountedExemptions({
  [site('experiences/sandbox/src/sheet.ts', 'oxlint:node/no-sync')]: {
    count: 1,
    reason: 'replaceSync is CSSOM, not Node I/O: the async replace would let a shadow root paint unstyled first',
  },
  [site('packages/foundation/src/sim/system.ts', 'oxlint:typescript/no-unsafe-type-assertion')]: {
    count: 2,
    reason: 'stateOf and viewOf: the erasure owner reads a system value back after proving the owner id matches',
  },
  [site('packages/foundation/test/exhaustive.test.ts', 'typescript:expect-error')]: {
    count: 1,
    reason: 'the planted table missing a kind: the expected error is the proof',
  },
  [site('packages/characterisation/src/fixtures/adapter.tsx', 'oxlint:solid/reactivity')]: {
    count: 1,
    reason: 'the read forces the planted memo whose store write the fixture records',
  },
  [site('packages/characterisation/src/fixtures/ownership.tsx', 'oxlint:solid/reactivity')]: {
    count: 2,
    reason: 'the planted memos created where Solid refuses a primitive; the fixture records the refusal',
  },
  [site('packages/characterisation/src/fixtures/ownership.tsx', 'oxlint:unicorn/no-null')]: {
    count: 1,
    reason: "the planted runWithOwner(null, …): Solid's API takes null for no owner",
  },
  [site('packages/characterisation/src/fixtures/props.tsx', 'oxlint:solid/no-destructure')]: {
    count: 1,
    reason: 'the planted destructured part whose staleness the fixture records',
  },
  [site('packages/characterisation/src/fixtures/csp.tsx', 'oxlint:aricanga/style-prop')]: {
    count: 1,
    reason: 'the planted style prop whose CSP effect the fixture records',
  },
});

/** Refused comments the code still holds while the census is adopted, keyed by `site(path, problem)`. */
const ADOPTING = new Exemptions({});

/** The statements a parse of a one-statement module holds. */
const ONE_STATEMENT = 1;

/**
 * The census over every held file the suppressions can sit in.
 *
 * @returns {Promise<Census>} The census over every held file the suppressions can sit in.
 */
async function repoCensus(): Promise<Census> {
  const files = await heldFiles();
  const texts = await textsOf(files.filter((path) => SCANNED.has(suffix(path))));
  const all = texts.map(([path, text]: readonly [string, string]) => census(path, text));
  return { problems: all.flatMap((one) => one.problems), sites: all.flatMap((one) => one.sites) };
}

describe('the repository', () => {
  test('every suppression names its rule, a tool that checks the file, and its reason', async () => {
    expect.hasAssertions();
    const { problems } = await repoCensus();
    expect(ADOPTING.unexemptedBy(problems, (found) => site(found.path, found.problem))).toStrictEqual([]);
  });

  test('every suppression is counted with its reason', async () => {
    expect.hasAssertions();
    const { sites } = await repoCensus();
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
    [
      '// biome-ignore lint/style/noX: why\nexport {};',
      'a biome-ignore suppresses nothing: Biome is not one of the tools that check this repository',
    ],
    ['/* stylelint-disable-next-line color-named -- why */\nexport {};', 'stylelint does not check .ts files'],
  ])('refuses %j in a module', (text, problem) => {
    expect.hasAssertions();
    expect(census('packages/plant/src/a.ts', text).problems.map((found) => found.problem)).toStrictEqual([problem]);
  });

  test.each([
    ['/* stylelint-disable-next-line color-named */\na { color: red; }', 'a stylelint-disable names its rules and ends with -- <reason>'],
    [
      '/* biome-ignore lint/style/noX: why */\na { color: red; }',
      'a biome-ignore suppresses nothing: Biome is not one of the tools that check this repository',
    ],
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
    expect(
      census('packages/plant/src/a.css', '/* stylelint-disable-next-line color-named -- the token is the name */\na{}').sites,
    ).toStrictEqual([site('packages/plant/src/a.css', 'stylelint:color-named')]);
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

/**
 * A shell run that starts a Node process (`$1`, running `$2`), which opens a session, prints its tsgo
 * child's pid and exits; then waits, bounded, until every one of them is gone. It prints
 * `gone <count>` and exits 0 once none is left, or `alive <pids>` and exits 1 at its bound (20 s, below
 * the test's). The pids go through a file and the process's errors are dropped, so a child that
 * outlives the process holds none of the shell's output open. Only the end state is asserted: the
 * bound is a ceiling on the wait, not a window. A child that has exited is gone, whether or not it
 * has been reaped: once its parent exits, an orphan is reaped by an ancestor (PID 1 or a
 * subreaper), which this run does not control and which may never do it, so a zombie (`ps` state
 * `Z`, which `kill -0` still finds) counts as gone, and only a child that still runs is alive.
 */
const TSGO_GONE = [
  'out=$(mktemp)',
  '"$1" --input-type=module -e "$2" > "$out" 2> /dev/null',
  'pids=$(cat "$out")',
  'rm -f "$out"',
  'set -- $pids',
  'for i in $(seq 1 200); do',
  '  alive=""',
  '  for pid in $pids; do',
  '    state=$(echo $(ps -o stat= -p "$pid" 2>/dev/null))',
  '    case "$state" in "" | Z*) ;; *) alive="$alive $pid" ;; esac',
  '  done',
  '  [ -z "$alive" ] && { echo "gone $#"; exit 0; }',
  '  sleep 0.1',
  'done',
  'echo "alive$alive"',
  'exit 1',
].join('\n');

/**
 * The Node script of the characterisation: it parses a module (one session, one live snapshot),
 * prints the pid of its tsgo child (a `tsc` process whose parent it is, read from `ps -A`, whose
 * columns Linux's and the BSDs' `ps` share), and exits.
 *
 * @returns {string} The script.
 */
function childScript(): string {
  const reader = JSON.stringify(pathToFileURL(fromRoot('harness/lib/ts-source.ts')).href);
  return [
    "import { execFileSync } from 'node:child_process';",
    "import { basename } from 'node:path';",
    `const { parse } = await import(${reader});`,
    String.raw`parse('packages/plant/src/a.ts', 'export const a = 1;\n');`,
    String.raw`const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,comm=']).toString().trim().split('\n');`,
    String.raw`const fields = rows.map((row) => row.trim().split(/\s+/u));`,
    "const ours = fields.filter(([, ppid, comm]) => Number(ppid) === process.pid && basename(comm) === 'tsc');",
    "process.stdout.write(ours.map(([pid]) => pid).join(' '));",
  ].join('\n');
}

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

  test('lets a process that exits with its session open exit cleanly', async () => {
    expect.hasAssertions();
    const reader = JSON.stringify(pathToFileURL(fromRoot('harness/lib/ts-source.ts')).href);
    const script = `const { parse } = await import(${reader}); parse('packages/plant/src/a.ts', 'export const a = 1;\\n');`;
    const done = await finished([process.execPath, '--input-type=module', '-e', script], { cwd: fromRoot() });
    expect(done.status).toBe(EXIT_SUCCESS);
  });

  test("ends a process's tsgo child once the process exits, on its closed standard input", async () => {
    expect.hasAssertions();
    const done = await finished(['sh', '-c', TSGO_GONE, 'tsgo-gone', process.execPath, childScript()], { cwd: fromRoot() });
    expect([done.status, done.stdout.trim()]).toStrictEqual([EXIT_SUCCESS, 'gone 1']);
  });
});

export { HARNESS_ID };
