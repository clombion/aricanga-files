/**
 * The network guard: a test that connects to, or looks up, a host other than this machine trips.
 *
 * While installed, it replaces `net.Socket.prototype.connect`, `dns.lookup`, `dns.promises.lookup` and
 * the global `fetch`. A loopback address, a Unix socket path and a lookup of a loopback name pass
 * through; anything else trips through `doubles.trip`, so the test fails even if the code under test
 * caught the error. A child process the test starts is not guarded.
 */

import dns from 'node:dns';
import net from 'node:net';

import { trip } from './doubles.ts';
import { Accepted } from './exemptions.ts';
import { patch } from './patch.ts';

/** Host names that stay on this machine, besides the 127.0.0.0/8 addresses. */
const LOOPBACK_NAMES = new Accepted(['localhost', 'ip6-localhost', '::1', '[::1]', '']);

/** Whether a host stays on this machine. */
export function isLocalHost(host: string | undefined): boolean {
  return host === undefined || LOOPBACK_NAMES.has(host) || host.startsWith('127.');
}

/** The host a `Socket.connect` call reaches, or undefined for a local path or the default host. */
export function connectHost(args: readonly unknown[]): string | undefined {
  const [first, second] = args;
  if (typeof first === 'object' && first !== null) {
    if ('path' in first && typeof first.path === 'string') {
      return undefined;
    }
    return 'host' in first && typeof first.host === 'string' ? first.host : undefined;
  }
  if (typeof first === 'string' && !/^\d+$/.test(first)) {
    return undefined;
  }
  return typeof second === 'string' ? second : undefined;
}

/** The host a `fetch` input names. */
export function fetchHost(input: unknown): string {
  const target = input instanceof Request ? input.url : String(input);
  return new URL(target, 'http://localhost').hostname;
}

function refuse(call: string, host: string | undefined): void {
  if (!isLocalHost(host)) {
    trip(`a test opened a non-local connection (${call} to ${host ?? ''})`);
  }
}

interface Installed {
  readonly restore: () => void;
}

/** Install the guard; the returned record restores the real network. */
export function install(): Installed {
  const restores = [
    patch(net.Socket.prototype, 'connect', (real) => (self, args) => {
      refuse('connect', connectHost(args));
      return real(self, args);
    }),
    patch(dns, 'lookup', (real) => (self, args) => {
      refuse('lookup', String(args[0]));
      return real(self, args);
    }),
    patch(dns.promises, 'lookup', (real) => (self, args) => {
      refuse('lookup', String(args[0]));
      return real(self, args);
    }),
    patch(globalThis, 'fetch', (real) => (self, args) => {
      refuse('fetch', fetchHost(args[0]));
      return real(self, args);
    }),
  ];
  return {
    restore: () => {
      for (const restore of restores.toReversed()) {
        restore();
      }
    },
  };
}
