import { expect, test } from 'vitest';
// Imported via the workspace package specifier (not a relative path) to exercise
// workspace resolution through the configured alias (task-004 AC #3).
import { FOUNDATION_VERSION } from '@narratives/foundation';

// Example headless unit test against a foundation module (task-004 AC #1).
test('foundation exposes a version string', () => {
  expect(FOUNDATION_VERSION).toBe('0.0.0');
});
