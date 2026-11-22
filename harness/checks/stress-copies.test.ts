/** A flake-hunt copy's result: its status and output when it finished, and how it ended when it did not. */

import { describe, expect, test } from 'vitest';
import { copyResult } from '#lib/stress.ts';

/** A planted copy's seed. */
const SEED = 7;

/** The status of a copy that did not finish. */
const NOT_FINISHED = -1;

/** A planted copy's bound, in milliseconds. */
const BOUND_MS = 10;

describe("a hunt copy's result", () => {
  test("keeps a finished copy's status and both its streams", () => {
    expect.hasAssertions();
    const outcome = { argv: ['vitest'], kind: 'finished', status: 1, stderr: 'b', stdout: 'a' } as const;
    expect(copyResult(outcome, SEED)).toStrictEqual({ output: 'ab', seed: SEED, status: 1 });
  });

  test('reports a copy that did not finish by how it ended', () => {
    expect.hasAssertions();
    const outcome = { argv: ['vitest'], kind: 'timed-out', timeoutMs: BOUND_MS } as const;
    expect(copyResult(outcome, SEED)).toStrictEqual({ output: JSON.stringify(outcome), seed: SEED, status: NOT_FINISHED });
  });
});
