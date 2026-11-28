import { checkInvariant, storyStreamArb } from '@narratives/foundation/testing';
import { describe, test } from 'vitest';
import { chatSystem } from '#src/system';
import { erase } from '@narratives/foundation';
import { routingOwnership } from '@narratives/system-chat/testing';

// The routing-ownership predicate holds over generated streams; it is the
// acceptance target of message routing. Also proves @narratives/system-chat/testing
// is importable from a sibling test (the new subpath).
describe('routing ownership', () => {
  test('holds over generated targetChat streams', async ({ expect }) => {
    expect.hasAssertions();
    const result = await checkInvariant(
      { foreground: 'chat', systems: [erase(chatSystem)] },
      storyStreamArb({ tagKeys: ['speaker', 'chat', 'targetChat'] }),
      routingOwnership,
    );
    expect(result).toStrictEqual({ failed: false, message: 'the property held' });
  });
});
