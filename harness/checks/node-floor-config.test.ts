/** The floor a manifest declares: refused when absent or not a string, and met part by part. */

import { FloorError, declaredFloor, engineRange, meets, version } from '#lib/node-floor.ts';
import { describe, expect, test } from 'vitest';

/** The planted floor. */
const FLOOR = version('22.1.1');

/**
 * Whether each version meets the planted floor.
 *
 * @param {readonly string[]} versions - The versions, as written.
 * @returns {readonly boolean[]} Whether each meets it, in order.
 */
function meetEach(...versions: readonly string[]): readonly boolean[] {
  return versions.map((written) => meets(version(written), FLOOR));
}

describe('a declared floor', () => {
  test('is refused when the manifest declares none', () => {
    expect.hasAssertions();
    expect(() => declaredFloor({})).toThrow(new FloorError('package.json declares no engines.node'));
  });

  test('is refused when engines.node is not a string', () => {
    expect.hasAssertions();
    expect(() => engineRange({ engines: { node: 22 } })).toThrow(new FloorError('engines.node is not a string'));
  });

  test('is compared by major, then minor, then patch', () => {
    expect.hasAssertions();
    expect(meetEach('23.0.0', '21.9.9')).toStrictEqual([true, false]);
    expect(meetEach('22.2.0', '22.0.9')).toStrictEqual([true, false]);
    expect(meetEach('22.1.1', '22.1.0')).toStrictEqual([true, false]);
  });
});
