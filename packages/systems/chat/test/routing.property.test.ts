import { erase } from '@narratives/foundation';
import { checkInvariant, storyStreamArb } from '@narratives/foundation/testing';
import { routingOwnership } from '@narratives/system-chat/testing';
import { expect, test } from 'vitest';
import { chatSystem } from '../src/system';

// task-018 #5 — the routing-ownership predicate is green over the stub now; it is
// the acceptance target task-020 consumes. Also proves @narratives/system-chat/testing
// is importable from a sibling test (the new subpath).
test('routing ownership holds over generated targetChat streams', async () => {
  const result = await checkInvariant(
    { systems: [erase(chatSystem)], foreground: 'chat' },
    storyStreamArb({ tagKeys: ['speaker', 'chat', 'targetChat'] }),
    routingOwnership,
  );
  expect(result.failed, result.message).toBe(false);
});
