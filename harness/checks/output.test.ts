/** The scripts' writes go to the stream each names, as given or as a line, and a run's exit code follows its result. */

import { EXIT_FAILURE, EXIT_SUCCESS, complain, err, exitCode, out, say } from '#lib/output.ts';
import { describe, expect, test, vi } from 'vitest';

describe("the scripts' output", () => {
  test('writes results to standard output and failures to standard error', () => {
    expect.hasAssertions();
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    out('a');
    say('b');
    err('c');
    complain('d');
    expect(stdout.mock.calls).toStrictEqual([['a'], ['b\n']]);
    expect(stderr.mock.calls).toStrictEqual([['c'], ['d\n']]);
  });

  test('ends a run that passed with success and one that did not with failure', () => {
    expect.hasAssertions();
    expect(exitCode(true)).toBe(EXIT_SUCCESS);
    expect(exitCode(false)).toBe(EXIT_FAILURE);
  });
});
