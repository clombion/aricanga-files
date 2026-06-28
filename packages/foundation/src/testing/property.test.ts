import { expect, test } from 'vitest';
import type { ReduceResult } from '../sim/context';
import type { Effect } from '../sim/effect';
import type { Command } from '../sim/input';
import { type System, erase } from '../sim/system';
import { fixtureSystemErased } from './fixture-system';
import { storyStreamArb } from './generators';
import { assertDeterministic } from './property';

test('determinism: same stream replays to an identical canonical trace (#2)', async () => {
  await assertDeterministic({ systems: [fixtureSystemErased] }, storyStreamArb({ tagKeys: ['note'] }));
});

test('the determinism property rejects a nondeterministic reducer (#2)', async () => {
  // A reducer whose output depends on hidden mutable state, not (state,input,ctx) —
  // run-twice diverges, so the property must fail (shrinking to a minimal stream).
  let hidden = 0;
  const flaky: System<{ n: number }, Command, Effect, { n: number }> = {
    id: 'flaky',
    tags: ['note'],
    init: () => ({ n: 0 }),
    reduce: (): ReduceResult<{ n: number }, Effect> => ({ state: { n: hidden++ }, effects: [] }),
    status: () => 'free',
    view: (state) => state,
  };
  await expect(
    assertDeterministic({ systems: [erase(flaky)] }, storyStreamArb({ tagKeys: ['note'] })),
  ).rejects.toThrow();
});
