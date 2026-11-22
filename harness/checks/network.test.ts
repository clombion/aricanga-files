/** The network guard's wrappers, over a stand-in real function: a local host passes through, another host trips before the call. */

import { TripwireError, drain } from '#lib/doubles.ts';
import { connectHost, fetchHost, guarded, lookupHost } from '#lib/network.ts';
import { describe, expect, test } from 'vitest';

/**
 * A stand-in real function that reports it was reached.
 *
 * @returns {string} What it returns.
 */
function reached(): string {
  return 'reached';
}

/** The first argument of a call. */
const FIRST = 0;

/** A fetch wrapper over the stand-in. */
const wrappedFetch = guarded('fetch', (args) => fetchHost(args.at(FIRST)))(reached);

describe('the network guard', () => {
  test('lets a call to this machine through to the real function', () => {
    expect.hasAssertions();
    expect(wrappedFetch(undefined, ['http://localhost/'])).toBe('reached');
  });

  test('trips a call to another host before the real function, naming the host', () => {
    expect.hasAssertions();
    expect(() => wrappedFetch(undefined, ['https://planted.invalid/'])).toThrow(TripwireError);
    expect(drain()).toStrictEqual(['a test opened a non-local connection (fetch to planted.invalid)']);
  });

  test('reads the host a lookup asks for, and none from socket options that name none', () => {
    expect.hasAssertions();
    expect(lookupHost(['planted.invalid'])).toBe('planted.invalid');
    expect(connectHost([{ port: 80 }])).toBeUndefined();
  });
});
