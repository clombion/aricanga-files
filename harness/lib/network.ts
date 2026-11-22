/**
 * The network guard: a test that connects to, or looks up, a host other than this machine trips.
 *
 * While installed, it replaces `net.Socket.prototype.connect`, `dns.lookup`, `dns.promises.lookup` and
 * the global `fetch`. A loopback address, a Unix socket path and a lookup of a loopback name pass
 * through; anything else trips through `doubles.trip`, so the test fails even if the code under test
 * caught the error. A child process the test starts is not guarded.
 */

import { Accepted } from './exemptions.ts';
import dns from 'node:dns';
import net from 'node:net';
import { patch } from './patch.ts';
import { trip } from './tripwire.ts';

/** Host names that stay on this machine, besides the 127.0.0.0/8 addresses. */
const LOOPBACK_NAMES = new Accepted(['localhost', 'ip6-localhost', '::1', '[::1]', '']);

/** The prefix of every IPv4 loopback address. */
const LOOPBACK_V4 = '127.';

/** A port given as a string: `connect('8080')` names a port, not a path. */
const PORT = /^\d+$/u;

/** The base a relative `fetch` input resolves against: it stays on this machine. */
const LOCAL_BASE = 'http://localhost';

/** A call of a replaced function with its `this` and its arguments. */
type Call = (self: unknown, args: readonly unknown[]) => unknown;

/** The installed guard. */
interface Installed {
  readonly restore: () => void;
}

/**
 * Whether a host stays on this machine.
 *
 * @param {string | undefined} host - The host, or undefined for the default host.
 * @returns {boolean} Whether it is a loopback host.
 */
function isLocalHost(host: string | undefined): boolean {
  return host === undefined || LOOPBACK_NAMES.has(host) || host.startsWith(LOOPBACK_V4);
}

/**
 * The host a `Socket.connect` call reaches.
 *
 * @param {readonly unknown[]} args - The call's arguments.
 * @returns {string | undefined} The host, or undefined for a local path or the default host.
 */
function connectHost(args: readonly unknown[]): string | undefined {
  const [first, second] = args;
  if (typeof first === 'object' && first !== null) {
    if ('path' in first && typeof first.path === 'string') {
      return undefined;
    }
    return 'host' in first && typeof first.host === 'string' ? first.host : undefined;
  }
  if (typeof first === 'string' && !PORT.test(first)) {
    return undefined;
  }
  return typeof second === 'string' ? second : undefined;
}

/**
 * The host a `fetch` input names.
 *
 * @param {unknown} input - The input `fetch` was given.
 * @returns {string} The host it reaches.
 */
function fetchHost(input: unknown): string {
  const target = input instanceof Request ? input.url : String(input);
  return new URL(target, LOCAL_BASE).hostname;
}

/**
 * The host a `fetch` call reaches: its first argument's.
 *
 * @param {readonly unknown[]} args - The call's arguments.
 * @returns {string} The host it reaches.
 */
function fetchArgsHost(args: readonly unknown[]): string {
  const [input] = args;
  return fetchHost(input);
}

/**
 * The host a lookup asks for: its first argument.
 *
 * @param {readonly unknown[]} args - The lookup's arguments.
 * @returns {string} The host name.
 */
function lookupHost(args: readonly unknown[]): string {
  const [host] = args;
  return String(host);
}

/**
 * Trip on a non-local host.
 *
 * @param {string} call - The guarded call, for the message.
 * @param {string | undefined} host - The host it reaches.
 */
function refuse(call: string, host: string | undefined): void {
  if (!isLocalHost(host)) {
    trip(`a test opened a non-local connection (${call} to ${String(host)})`);
  }
}

/**
 * A replacement that refuses a non-local host before calling the real function.
 *
 * @param {string} call - The guarded call, for the message.
 * @param {(args: readonly unknown[]) => string | undefined} hostOf - Reads the host from the arguments.
 * @returns {(real: Call) => Call} Wraps the real function.
 */
function guarded(call: string, hostOf: (args: readonly unknown[]) => string | undefined): (real: Call) => Call {
  return (real) => (self, args) => {
    refuse(call, hostOf(args));
    return real(self, args);
  };
}

/**
 * Install the guard.
 *
 * @returns {Installed} The record whose `restore` puts the real network back.
 */
function install(): Installed {
  const restores = [
    patch(net.Socket.prototype, 'connect', guarded('connect', connectHost)),
    patch(dns, 'lookup', guarded('lookup', lookupHost)),
    patch(dns.promises, 'lookup', guarded('lookup', lookupHost)),
    patch(globalThis, 'fetch', guarded('fetch', fetchArgsHost)),
  ];
  return {
    restore: () => {
      for (const restore of restores.toReversed()) {
        restore();
      }
    },
  };
}

export { connectHost, fetchArgsHost, fetchHost, guarded, install, isLocalHost, lookupHost };
