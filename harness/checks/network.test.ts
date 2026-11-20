/** The network guard, installed for every test: a local lookup passes, a fetch to another host trips, and a socket's options name its host. */

import { TripwireError, drain } from '#lib/doubles.ts';
import { describe, expect, test } from 'vitest';
import { connectHost } from '#lib/network.ts';
import dns from 'node:dns';

/**
 * Fetch from a host other than this machine.
 *
 * @returns {Promise<Response>} The response, which the guard never lets come.
 */
async function sendAway(): Promise<Response> {
  const response = await fetch('https://planted.invalid/');
  return response;
}

describe('the installed network guard', () => {
  test('lets a lookup of this machine through', async () => {
    expect.hasAssertions();
    const found = await dns.promises.lookup('localhost');
    expect(found.address).toBeTypeOf('string');
  });

  test('trips a fetch to another host before it is sent, naming the host', async () => {
    expect.hasAssertions();
    await expect(sendAway()).rejects.toThrow(TripwireError);
    expect(drain()).toStrictEqual(['a test opened a non-local connection (fetch to planted.invalid)']);
  });

  test('reads no host from socket options that name none', () => {
    expect.hasAssertions();
    expect(connectHost([{ port: 80 }])).toBeUndefined();
  });
});
