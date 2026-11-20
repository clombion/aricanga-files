/**
 * The Node running the suite, and the pinned `.node-version`, meet the floor `engines.node` declares.
 *
 * The floor is a single `>=x.y.z`; any other range shape is refused, so the floor cannot be widened
 * into something that compares as nothing.
 */

import { describe, expect, test } from 'vitest';

import { floor, FloorError, meets, pinned, repoFloor, version } from '../lib/node-floor.ts';

export const HARNESS_ID = 'node-floor';

describe('the repository', () => {
  test('the running Node meets the declared floor', () => {
    expect(meets(version(process.versions.node), repoFloor())).toBe(true);
  });

  test('the pinned Node meets the declared floor', () => {
    expect(meets(pinned(), repoFloor())).toBe(true);
  });
});

describe('the floor check', () => {
  test('fails a Node below the floor, at each part of the version', () => {
    expect(meets([22, 17, 9], floor('>=22.18.0'))).toBe(false);
    expect(meets([21, 99, 99], floor('>=22.18.0'))).toBe(false);
    expect(meets([22, 18, 0], floor('>=22.18.1'))).toBe(false);
  });

  test('passes a Node at or above the floor', () => {
    expect(meets([22, 18, 0], floor('>=22.18.0'))).toBe(true);
    expect(meets([23, 0, 0], floor('>= 22.18.0'))).toBe(true);
  });

  test.each(['^22.18.0', '22.x', '>=22', '>=22.18.0 <23', ''])('refuses the range %j', (range) => {
    expect(() => floor(range)).toThrow(FloorError);
  });

  test('refuses a pin that is not an exact version', () => {
    expect(() => version('lts/*')).toThrow(FloorError);
    expect(version('v22.23.5')).toEqual([22, 23, 5]);
  });
});
