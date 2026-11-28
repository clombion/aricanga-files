/** A value the harness relies on is refused when absent, naming what was missing. */

import { AbsentError, present } from '#lib/present.ts';
import { describe, test } from 'vitest';

/** A falsy value that is present. */
const NONE = 0;

/** A list with no first item. */
const NOTHING: readonly string[] = [];

describe('a value the harness relies on', () => {
  test('passes through when present, falsy values included', ({ expect }) => {
    expect.hasAssertions();
    expect(present(NONE, 'the count')).toBe(NONE);
    expect(present('', 'the text')).toBe('');
  });

  test('is refused when absent, naming what was missing', ({ expect }) => {
    expect.hasAssertions();
    expect(() => {
      present(NOTHING.at(NONE), 'the scan project');
    }).toThrow(new AbsentError('the scan project is absent'));
  });
});
