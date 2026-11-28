/**
 * The Node running the suite, and the pinned `.node-version`, meet the floor `engines.node` declares.
 *
 * The floor is a single `>=x.y.z`; any other range shape is refused, so the floor cannot be widened
 * into something that compares as nothing.
 */

import { FloorError, floor, meets, pinned, repoFloor, version } from '#lib/node-floor.ts';
import { describe, test } from 'vitest';

const HARNESS_ID = 'node-floor';

describe('the repository', () => {
  test('the running Node meets the declared floor', async ({ expect }) => {
    expect.hasAssertions();
    const declared = await repoFloor();
    expect(meets(version(process.versions.node), declared)).toBe(true);
  });

  test('the pinned Node meets the declared floor', async ({ expect }) => {
    expect.hasAssertions();
    const [pin, declared] = await Promise.all([pinned(), repoFloor()]);
    expect(meets(pin, declared)).toBe(true);
  });
});

describe('the floor check', () => {
  test('fails a Node below the floor, at each part of the version', ({ expect }) => {
    expect.hasAssertions();
    expect(meets(version('22.17.9'), floor('>=22.18.0'))).toBe(false);
    expect(meets(version('21.99.99'), floor('>=22.18.0'))).toBe(false);
    expect(meets(version('22.18.0'), floor('>=22.18.1'))).toBe(false);
  });

  test('passes a Node at or above the floor', ({ expect }) => {
    expect.hasAssertions();
    expect(meets(version('22.18.0'), floor('>=22.18.0'))).toBe(true);
    expect(meets(version('23.0.0'), floor('>= 22.18.0'))).toBe(true);
  });

  test.for(['^22.18.0', '22.x', '>=22', '>=22.18.0 <23', ''])('refuses the range %j', (range, { expect }) => {
    expect.hasAssertions();
    expect(() => floor(range)).toThrow(FloorError);
  });

  test('refuses a pin that is not an exact version', ({ expect }) => {
    expect.hasAssertions();
    expect(() => version('lts/*')).toThrow(FloorError);
    expect(version('v22.23.5')).toStrictEqual(version('22.23.5'));
    expect(version('v22.23.5').join('.')).toBe('22.23.5');
  });
});

export { HARNESS_ID };
