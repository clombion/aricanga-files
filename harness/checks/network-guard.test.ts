/**
 * A test that connects to, looks up or fetches a host other than this machine trips the network guard.
 *
 * Planted through a Vitest run under the gate's guards: a socket connection, a DNS lookup and a fetch
 * of a host that is not this machine each fail their test though the planted code catches the trip;
 * a connection to a server on this machine passes. The address is TEST-NET-1 (RFC 5737): never
 * routed, so a guard that let it through would hang, not leak.
 */

import { describe, expect, test } from 'vitest';

import { connectHost, fetchHost, isLocalHost } from '../lib/network.ts';
import { runPlanted } from '../lib/planted-vitest.ts';

export const HARNESS_ID = 'network-guard';

const PLANTED = `import dns from 'node:dns';
import net from 'node:net';
import { expect, test } from 'vitest';

test('a connection to another host trips', () => {
  const socket = new net.Socket();
  try {
    socket.connect(9, '192.0.2.1');
  } catch {
    // the planted code swallows the trip
  }
  socket.destroy();
  expect(socket.destroyed).toBe(true);
});

test('a lookup of another host trips', () => {
  try {
    dns.lookup('example.com', () => undefined);
  } catch {
    // the planted code swallows the trip
  }
  expect(1).toBe(1);
});

test('a fetch of another host trips', async () => {
  try {
    await fetch('http://192.0.2.1/');
  } catch {
    // the planted code swallows the trip
  }
  expect(1).toBe(1);
});

test('a connection to this machine passes', async () => {
  const server = net.createServer((connection) => connection.end());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  await new Promise<void>((resolve, reject) => {
    const client = net.connect(port, 'localhost', () => {
      client.end();
      resolve();
    });
    client.on('error', reject);
  });
  await new Promise((resolve) => server.close(resolve));
  expect(port).toBeGreaterThan(0);
});
`;

describe('the guard', () => {
  test.each([
    ['localhost', true],
    ['127.0.0.1', true],
    ['::1', true],
    [undefined, true],
    ['192.0.2.1', false],
    ['example.com', false],
  ] as const)('tells %s apart (local: %s)', (host, local) => {
    expect(isLocalHost(host)).toBe(local);
  });

  test('reads the host of each connect and fetch form', () => {
    expect(connectHost([9, '192.0.2.1'])).toBe('192.0.2.1');
    expect(connectHost([{ host: 'example.com', port: 443 }])).toBe('example.com');
    expect(connectHost([{ path: '/tmp/planted.sock' }])).toBeUndefined();
    expect(connectHost(['/tmp/planted.sock'])).toBeUndefined();
    expect(connectHost([80])).toBeUndefined();
    expect(fetchHost('https://example.com/x')).toBe('example.com');
    expect(fetchHost(new Request('http://192.0.2.1/'))).toBe('192.0.2.1');
    expect(fetchHost('/relative')).toBe('localhost');
  });
});

describe('the guards, through a planted Vitest run', () => {
  test('fail a connection, a lookup and a fetch of another host, and pass this machine', () => {
    const outcomes = runPlanted({ 'network.test.ts': PLANTED });
    expect([...outcomes].map(([name, outcome]) => [name, outcome.status])).toEqual([
      ['a connection to another host trips', 'failed'],
      ['a lookup of another host trips', 'failed'],
      ['a fetch of another host trips', 'failed'],
      ['a connection to this machine passes', 'passed'],
    ]);
    for (const call of ['connect to 192.0.2.1', 'lookup to example.com', 'fetch to 192.0.2.1']) {
      expect([...outcomes.values()].some((outcome) => outcome.failure.includes(call))).toBe(true);
    }
  });
});
