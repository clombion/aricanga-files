import { erase } from '@narratives/foundation';
import { checkInvariant, storyStreamArb } from '@narratives/foundation/testing';
import { routingOwnership } from '@narratives/system-chat/testing';
import { expect, test } from 'vitest';
import { chatSystem } from '../src/system';

// The routing-ownership predicate holds over generated streams; it is the
// acceptance target of message routing. Also proves @narratives/system-chat/testing
// is importable from a sibling test (the new subpath).
test('routing ownership holds over generated targetChat streams', async () => {
  const result = await checkInvariant(
    { systems: [erase(chatSystem)], foreground: 'chat' },
    storyStreamArb({ tagKeys: ['speaker', 'chat', 'targetChat'] }),
    routingOwnership,
  );
  expect(result.failed, result.message).toBe(false);
});
