import { expect, test } from 'vitest';
import type { ReduceResult } from '../sim/context';
import type { Effect } from '../sim/effect';
import type { Command } from '../sim/input';
import { erase } from '../sim/system';
import type { System } from '../sim/system';
import { fixtureSystemErased } from './fixture-system';
import { storyStreamArb } from './generators';
import { checkDeterministic } from './property';

test('determinism: same stream replays to an identical canonical trace (#2)', async () => {
  const result = await checkDeterministic({ systems: [fixtureSystemErased] }, storyStreamArb({ tagKeys: ['note'] }));
  expect(result.failed, result.message).toBe(false);
});

test('the determinism property rejects a nondeterministic reducer (#2)', async () => {
  // A reducer whose output depends on hidden mutable state, not (state,input,ctx) —
  // run-twice diverges, so the property must fail (shrinking to a minimal stream).
  let hidden = 0;
  const flaky: System<{ n: number }, Command, Effect, { n: number }> = {
    id: 'flaky',
    init: () => ({ n: 0 }),
    reduce: (): ReduceResult<{ n: number }> => ({ state: { n: hidden++ }, effects: [] }),
    status: () => 'free',
    tags: ['note'],
    view: (state) => state,
  };
  const result = await checkDeterministic({ systems: [erase(flaky)] }, storyStreamArb({ tagKeys: ['note'] }));
  expect(result.failed, 'a reducer reading hidden state must fail the determinism property').toBe(true);
});
