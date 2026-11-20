/*
 * Imported via the workspace package specifier (not a relative path) to exercise
 * workspace resolution through the package's exports.
 */
import { describe, expect, test } from 'vitest';
import { FOUNDATION_VERSION } from '@narratives/foundation';

describe('the package entry', () => {
  test('foundation exposes a version string', () => {
    expect.hasAssertions();
    expect(FOUNDATION_VERSION).toBe('0.0.0');
  });
});
