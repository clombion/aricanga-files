import { describe, test } from 'vitest';
import { hasField } from '@narratives/foundation';

describe('an effect payload field', () => {
  test('is present when the payload itself holds it', ({ expect }) => {
    expect.hasAssertions();
    expect(hasField({ chatId: 'pat' }, 'chatId')).toBe(true);
  });

  test('is absent when only Object.prototype holds a member of that name', ({ expect }) => {
    expect.hasAssertions();
    expect(hasField({ chatId: 'pat' }, 'toString')).toBe(false);
  });
});
