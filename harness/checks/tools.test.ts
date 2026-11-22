/** A tool run that does not finish is refused, naming the command and how it ended. */

import { ToolError, finished } from '#lib/tools.ts';
import { describe, expect, test } from 'vitest';
import { REPO_ROOT } from '#lib/paths.ts';

describe('a tool run', () => {
  test('that does not start is refused, naming the command', async () => {
    expect.hasAssertions();
    await expect(finished(['planted-tool-that-does-not-exist'], { cwd: REPO_ROOT })).rejects.toThrow(ToolError);
  });
});
