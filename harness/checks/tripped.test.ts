/** `tripped` lets through an error that is no trip, and fails a block that trips nothing. */

import { describe, expect, test } from 'vitest';
import { tripped } from '#lib/doubles.ts';

describe('expecting a trip', () => {
  test('lets an error that is no trip through unchanged', () => {
    expect.hasAssertions();
    const thrown = new RangeError('planted');
    expect(() => {
      tripped('planted', () => {
        throw thrown;
      });
    }).toThrow(thrown);
  });

  test('fails a block that trips nothing, naming what it expected', () => {
    expect.hasAssertions();
    expect(() => {
      tripped('planted', () => {
        // The block calls no double.
      });
    }).toThrow('expected a trip naming "planted", got []');
  });
});
