/** How a bounded run ends: an empty command, a missing binary, a child a signal ends, a bound, and input the child leaves unread. */

import { describe, expect, test } from 'vitest';
import { environment, run } from '#lib/process.ts';
import { EXIT_CLEAN } from '#lib/exit-status.ts';
import type { Outcome } from '#lib/process.ts';
import { REPO_ROOT } from '#lib/paths.ts';

/** A bound no planted child here comes near. */
const GENEROUS_MS = 10_000;

/** A bound a sleeping child outlives. */
const SHORT_MS = 100;

/** Input larger than a pipe holds, so a child that never reads it leaves the pipe failing. */
const UNREAD_BYTES = 1_048_576;
const UNREAD = 'x'.repeat(UNREAD_BYTES);

const OPTIONS = { cwd: REPO_ROOT, timeoutMs: GENEROUS_MS };

/**
 * Why a run did not start, or the empty string when it did.
 *
 * @param {Outcome} outcome - How the run ended.
 * @returns {string} The reason it did not start.
 */
function notStartedBecause(outcome: Outcome): string {
  return outcome.kind === 'not-started' ? outcome.reason : '';
}

describe('a bounded run', () => {
  test('of no command does not start', async () => {
    expect.hasAssertions();
    await expect(run([], OPTIONS)).resolves.toStrictEqual({ argv: [], kind: 'not-started', reason: 'empty argv' });
  });

  test('of a binary that does not exist does not start, naming the failure', async () => {
    expect.hasAssertions();
    const outcome = await run(['planted-binary-that-does-not-exist'], OPTIONS);
    expect(notStartedBecause(outcome)).toContain('ENOENT');
  });

  test('of a child a signal ends counts as outliving its bound', async () => {
    expect.hasAssertions();
    const outcome = await run(['node', '-e', "process.kill(process.pid, 'SIGKILL')"], OPTIONS);
    expect(outcome).toStrictEqual({
      argv: ['node', '-e', "process.kill(process.pid, 'SIGKILL')"],
      kind: 'timed-out',
      timeoutMs: GENEROUS_MS,
    });
  });

  test('past its bound is killed and reported as timed out', async () => {
    expect.hasAssertions();
    const outcome = await run(['sleep', '5'], { cwd: REPO_ROOT, timeoutMs: SHORT_MS });
    expect(outcome).toStrictEqual({ argv: ['sleep', '5'], kind: 'timed-out', timeoutMs: SHORT_MS });
  });

  test('whose child leaves its input unread does not start', async () => {
    expect.hasAssertions();
    const outcome = await run(['node', '-e', ''], { ...OPTIONS, input: UNREAD });
    expect(notStartedBecause(outcome)).toContain('EPIPE');
  });

  test('whose child reads its input finishes with what it wrote', async () => {
    expect.hasAssertions();
    const outcome = await run(['node', '-e', 'process.stdin.pipe(process.stdout)'], { ...OPTIONS, input: 'planted' });
    expect(outcome).toMatchObject({ kind: 'finished', status: EXIT_CLEAN, stdout: 'planted' });
  });
});

describe("this process's environment", () => {
  test('holds only set variables, each a string', () => {
    expect.hasAssertions();
    expect(Object.values(environment()).every((value) => typeof value === 'string')).toBe(true);
  });
});
