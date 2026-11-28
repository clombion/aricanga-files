/*
 * Imported via the workspace package specifier (not a relative path) to exercise
 * workspace resolution through the package's exports.
 */
import { describe, test } from 'vitest';
import { FOUNDATION_VERSION } from '@narratives/foundation';

describe('the package entry', () => {
  test('foundation exposes a version string', ({ expect }) => {
    expect.hasAssertions();
    expect(FOUNDATION_VERSION).toBe('0.0.0');
  });
});
