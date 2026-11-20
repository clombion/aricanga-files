/** The readers of `knip`'s configuration refuse an ignore that is not a list of strings, and a config with no rules sets none at error. */

import { describe, expect, test } from 'vitest';
import { ignoreEntries, strictnessProblems } from '#lib/deadcode.ts';

describe("knip's configuration", () => {
  test('refuses an ignore entry that is not a list of strings, naming it', () => {
    expect.hasAssertions();
    expect(() => ignoreEntries({ ignoreFiles: 'planted/**' })).toThrow('ignoreFiles is not a list of strings');
  });

  test('with no rules sets no issue type at error', () => {
    expect.hasAssertions();
    expect(strictnessProblems({}, ['files'])).toStrictEqual(['rule files is not error']);
  });
});
