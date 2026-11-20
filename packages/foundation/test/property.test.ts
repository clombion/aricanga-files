import { describe, expect, test } from 'vitest';
import type { Command } from '#src/sim/input';
import type { Effect } from '#src/sim/effect';
import type { ReduceResult } from '#src/sim/context';
import type { System } from '#src/sim/system';
import { checkDeterministic } from '#src/testing/property';
import { erase } from '#src/sim/system';
import { fixtureSystemErased } from '#src/testing/fixture-system';
import { storyStreamArb } from '#src/testing/generators';

/** The state of a reducer that counts its calls. */
interface Count {
  readonly calls: number;
}

/** The count before any call. */
const NO_CALLS = 0;

/** Each call adds one. */
const ONE_CALL = 1;

/**
 * A system whose reducer reads hidden mutable state, not (state, input, ctx): run twice, it diverges.
 *
 * @returns {System} The system.
 */
function flakySystem(): System<Count, Command, Effect, Count> {
  const hidden = { calls: NO_CALLS };
  return {
    id: 'flaky',
    init: () => ({ calls: NO_CALLS }),
    reduce: (): ReduceResult<Count> => {
      hidden.calls += ONE_CALL;
      return { effects: [], state: { calls: hidden.calls } };
    },
    status: () => 'free',
    tags: ['note'],
    view: (state) => state,
  };
}

describe('the determinism property', () => {
  test('determinism: same stream replays to an identical canonical trace (#2)', async () => {
    expect.hasAssertions();
    const result = await checkDeterministic({ systems: [fixtureSystemErased] }, storyStreamArb({ tagKeys: ['note'] }));
    expect({ failed: result.failed }, result.message).toStrictEqual({ failed: false });
  });

  test('the determinism property rejects a nondeterministic reducer (#2)', async () => {
    expect.hasAssertions();
    const result = await checkDeterministic({ systems: [erase(flakySystem())] }, storyStreamArb({ tagKeys: ['note'] }));
    expect({ failed: result.failed }, 'a reducer reading hidden state must fail the determinism property').toStrictEqual({
      failed: true,
    });
  });
});
