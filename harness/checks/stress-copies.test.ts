/** A flake-hunt copy's result: its status and output when it finished, and how it ended when it did not. */

import { NOT_FINISHED, copyResult } from '#lib/stress.ts';
import { describe, test } from 'vitest';
import { EXIT_FINDINGS } from '#lib/exit-status.ts';

/** A planted copy's seed. */
const SEED = 7;

/** A planted copy's bound, in milliseconds. */
const BOUND_MS = 10;

describe("a hunt copy's result", () => {
  test("keeps a finished copy's status and both its streams", ({ expect }) => {
    expect.hasAssertions();
    const outcome = { argv: ['vitest'], kind: 'finished', status: EXIT_FINDINGS, stderr: 'b', stdout: 'a' } as const;
    expect(copyResult(outcome, SEED)).toStrictEqual({ output: 'ab', seed: SEED, status: EXIT_FINDINGS });
  });

  test('reports a copy that did not finish by how it ended', ({ expect }) => {
    expect.hasAssertions();
    const outcome = { argv: ['vitest'], kind: 'timed-out', timeoutMs: BOUND_MS } as const;
    expect(copyResult(outcome, SEED)).toStrictEqual({ output: JSON.stringify(outcome), seed: SEED, status: NOT_FINISHED });
  });
});
