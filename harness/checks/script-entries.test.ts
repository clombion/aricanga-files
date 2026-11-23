/** The entry scripts' logic reports each problem and ends with the exit code its result calls for. */

import { EXIT_CLEAN, EXIT_FINDINGS } from '#lib/exit-status.ts';
import { EXIT_FAILURE, EXIT_SUCCESS } from '#lib/output.ts';
import { buildCheck, checkPushed, genDocs, stressHunt, typecheckAll } from '#lib/script-entries.ts';
import { describe, expect, test } from 'vitest';
import type { BuildResult } from '#lib/build.ts';
import type { Finished } from '#lib/process.ts';
import type { Hunt } from '#lib/stress.ts';
import { Scripted } from '#lib/doubles.ts';

/** A built app. */
const BUILT: BuildResult = { app: 'apps/a', output: '', status: EXIT_CLEAN, written: [] };

/** An app that failed to build. */
const BROKEN: BuildResult = { app: 'apps/b', output: 'boom', status: EXIT_FINDINGS, written: [] };

/** An app that built and wrote into the checkout. */
const WRITING: BuildResult = { app: 'apps/c', output: '', status: EXIT_CLEAN, written: ['apps/c/stray.js'] };

/** A hunt's options. */
const HUNT: Hunt = { config: 'vitest.gate.config.ts', copies: 2, filters: [], repeats: 1, root: '/planted', seed: 7 };

/** A pre-push hook's input: one updated ref with a known remote side. */
const PUSHED = 'refs/heads/x bbbb refs/heads/x aaaa\n';

/**
 * A report that keeps every text it is given.
 *
 * @returns {{ report: (text: string) => void; said: string[] }} The report and what it was given, in order.
 */
function keeping(): { readonly report: (text: string) => void; readonly said: string[] } {
  const said: string[] = [];
  return {
    report: (text: string): void => {
      said.push(text);
    },
    said,
  };
}

/**
 * A stand-in that answers through a scripted double, keyed by its arguments: an unscripted call trips.
 *
 * @param {Pick<Scripted<Answer>, 'answer'>} double - The scripted answers.
 * @param {(...args: Args) => string} key - The call a set of arguments names.
 * @returns {(...args: Args) => Promise<Answer>} The stand-in.
 */
function asking<Args extends readonly unknown[], Answer>(
  double: Readonly<Pick<Scripted<Answer>, 'answer'>>,
  key: (...args: Args) => string,
): (...args: Args) => Promise<Answer> {
  return async (...args: Args): Promise<Answer> => {
    const answer = await Promise.resolve(double.answer(key(...args)));
    return answer;
  };
}

/**
 * The call a single text argument names: the text itself.
 *
 * @param {string} text - The argument.
 * @returns {string} The call.
 */
function itself(text: string): string {
  return text;
}

/**
 * The call a docs run names: comparing only, or writing.
 *
 * @param {boolean} check - Whether the run only compares.
 * @returns {string} The call.
 */
function docsCall(check: boolean): string {
  return check ? 'check' : 'write';
}

/**
 * The call a project checked from a root names.
 *
 * @param {string} project - The project.
 * @param {string} root - Where it is checked from.
 * @returns {string} The call.
 */
function inRoot(project: string, root: string): string {
  return `${root}:${project}`;
}

/**
 * The call a revision range read in a repository names.
 *
 * @param {readonly string[]} range - The revision arguments.
 * @param {string} cwd - The repository.
 * @returns {string} The call.
 */
function rangeIn(range: readonly string[], cwd: string): string {
  return `${cwd}:${range.join(' ')}`;
}

/**
 * A finished `tsc` run.
 *
 * @param {number} status - Its exit status.
 * @param {string} stdout - What it wrote.
 * @returns {Finished} The finished run.
 */
function tscRun(status: number, stdout: string): Finished {
  return { argv: ['tsc'], kind: 'finished', status, stderr: '', stdout };
}

describe('the build check', () => {
  test('passes when every app builds and none writes into the checkout', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const status = await buildCheck({ apps: ['apps/a'], check: asking(new Scripted({ 'apps/a': BUILT }), itself), out: report });
    expect([status, said]).toStrictEqual([EXIT_SUCCESS, ['build:check: 1 apps, 0 failed, 0 writes\n']]);
  });

  test('reports a failed build and a write into the checkout, and fails', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const builds = new Scripted({ 'apps/b': BROKEN, 'apps/c': WRITING });
    const status = await buildCheck({ apps: ['apps/b', 'apps/c'], check: asking(builds, itself), out: report });
    expect([status, said]).toStrictEqual([
      EXIT_FAILURE,
      [
        'apps/b failed to build:\nboom\n',
        'a build wrote into the checkout: apps/c/stray.js\n',
        'build:check: 2 apps, 1 failed, 1 writes\n',
      ],
    ]);
  });
});

describe('the docs run', () => {
  test('passes the check flag through and passes with nothing left stale', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const runs = new Scripted({ check: [] });
    const status = await genDocs({ check: true, complain: report, run: asking(runs, docsCall) });
    expect([status, said, runs.calls]).toStrictEqual([EXIT_SUCCESS, [], ['check']]);
  });

  test('complains of each stale block and fails', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const problem = { line: 3, message: 'block "tasks" is stale', path: 'harness.md', writingFixesIt: true };
    const status = await genDocs({ check: false, complain: report, run: asking(new Scripted({ write: [problem] }), docsCall) });
    expect([status, said]).toStrictEqual([EXIT_FAILURE, ['harness.md:3: block "tasks" is stale']]);
  });
});

describe('the flake hunt', () => {
  test('reports the seed and passes when every copy passed, with no replay line', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const hunts = new Scripted({ hunt: [{ output: '', seed: 7, status: EXIT_CLEAN }] });
    const status = await stressHunt({ hunt: asking(hunts, () => 'hunt'), options: HUNT, out: report });
    expect([status, said]).toStrictEqual([
      EXIT_SUCCESS,
      ['test:stress: base seed 7, 2 copies, 1 repeats\n', 'test:stress: 1 of 1 copies passed\n'],
    ]);
  });

  test('reports each failing copy and the command that replays the hunt, and fails', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const hunts = new Scripted({
      hunt: [
        { output: '', seed: 7, status: EXIT_CLEAN },
        { output: 'flaked', seed: 8, status: EXIT_FINDINGS },
      ],
    });
    const status = await stressHunt({ hunt: asking(hunts, () => 'hunt'), options: HUNT, out: report });
    expect([status, said]).toStrictEqual([
      EXIT_FAILURE,
      [
        'test:stress: base seed 7, 2 copies, 1 repeats\n',
        'seed 8 failed:\nflaked\n',
        'test:stress: 1 of 2 copies passed\n',
        'replay: pnpm run test:stress -- --seed 7 --copies 2 --repeats 1\n',
      ],
    ]);
  });
});

describe('the type check', () => {
  test('checks every project from the root and passes when each does', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const runs = new Scripted({ '/planted:a/tsconfig.json': tscRun(EXIT_CLEAN, '') });
    const status = await typecheckAll({ check: asking(runs, inRoot), projects: ['a/tsconfig.json'], root: '/planted', say: report });
    expect([status, said, runs.calls]).toStrictEqual([EXIT_SUCCESS, ['typecheck: 1 projects, 0 failed'], ['/planted:a/tsconfig.json']]);
  });

  test('says each failing project with its output, in project order, and fails', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const runs = new Scripted({
      '/planted:a/tsconfig.json': tscRun(EXIT_FINDINGS, 'a.ts(1,1): error TS1\n'),
      '/planted:b/tsconfig.json': tscRun(EXIT_CLEAN, ''),
    });
    const status = await typecheckAll({
      check: asking(runs, inRoot),
      projects: ['a/tsconfig.json', 'b/tsconfig.json'],
      root: '/planted',
      say: report,
    });
    expect([status, said]).toStrictEqual([EXIT_FAILURE, ['a/tsconfig.json\na.ts(1,1): error TS1\n', 'typecheck: 2 projects, 1 failed']]);
  });
});

describe('the pre-push check', () => {
  test('reads the pushed range in the repository and passes when nothing asks to be folded', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const logs = new Scripted({ '/planted:aaaa..bbbb': ['feat: a change'] });
    const status = await checkPushed({ complain: report, cwd: '/planted', stdin: PUSHED, subjects: asking(logs, rangeIn) });
    expect([status, said, logs.calls]).toStrictEqual([EXIT_SUCCESS, [], ['/planted:aaaa..bbbb']]);
  });

  test('complains of each commit that asks to be folded, and fails', async () => {
    expect.hasAssertions();
    const { report, said } = keeping();
    const logs = new Scripted({ '/planted:aaaa..bbbb': ['feat: a change', 'fixup! feat: a change'] });
    const status = await checkPushed({ complain: report, cwd: '/planted', stdin: PUSHED, subjects: asking(logs, rangeIn) });
    expect([status, said]).toStrictEqual([EXIT_FAILURE, ['fold these commits before pushing:\nfixup! feat: a change']]);
  });
});
