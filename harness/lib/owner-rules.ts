/** The owner registry's table: for each guarded API, which module of each root may use it. */

import { Accepted } from './exemptions.ts';

/** A root a rule covers, and its owner there (undefined: no module of the root may use the API). */
interface Scope {
  readonly root: string;
  readonly owner: string | undefined;
}

/** A guarded API: the declarations that make it up, the roots it covers, and why it has an owner. */
interface Rule {
  readonly name: string;
  readonly names: Readonly<Accepted<string>>;
  readonly scopes: readonly Scope[];
  readonly why: string;
}

const KERNEL: readonly string[] = ['packages/foundation/', 'packages/systems/'];

/**
 * The scopes of roots no module of which may use an API.
 *
 * @param {readonly string[]} roots - The roots.
 * @returns {Scope[]} A scope per root, with no owner.
 */
function nobody(...roots: readonly string[]): Scope[] {
  return roots.map((root) => ({ owner: undefined, root }));
}

const RULES: readonly Rule[] = [
  {
    name: 'process-start',
    names: new Accepted(
      ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'].map((call) => `child_process.${call}`),
    ),
    scopes: [...nobody(...KERNEL, 'experiences/sandbox/'), { owner: 'harness/lib/process.ts', root: 'harness/' }],
    why: 'every child process is bounded and its outcome is one of three',
  },
  {
    name: 'clock',
    names: new Accepted(['DateConstructor.now', 'new Date()', 'Date()', 'Performance.now', 'NodeJS.Process.hrtime']),
    scopes: nobody(...KERNEL, 'experiences/sandbox/', 'harness/'),
    why: 'time is simulation-derived: the kernel reads it from its input, a host from its injected clock',
  },
  {
    name: 'random',
    names: new Accepted([
      'Math.random',
      'Crypto.randomUUID',
      'Crypto.getRandomValues',
      'crypto.randomUUID',
      'crypto.randomBytes',
      'crypto.randomInt',
      'crypto.getRandomValues',
    ]),
    scopes: [...nobody(...KERNEL, 'experiences/sandbox/'), { owner: 'harness/lib/stress.ts', root: 'harness/' }],
    why: 'ids and draws come from the seed, so a run replays; the flake hunter draws the seed it prints and replays from',
  },
  {
    name: 'standard-streams',
    names: new Accepted(['console', 'NodeJS.Process.stdout', 'NodeJS.Process.stderr']),
    scopes: [
      ...nobody(...KERNEL, 'experiences/sandbox/'),
      { owner: 'harness/lib/output.ts', root: 'harness/' },
      { owner: 'packages/characterisation/src/harness.ts', root: 'packages/characterisation/' },
    ],
    why: 'the kernel reports through effects and the event bus; one module of a tool says what it says',
  },
  {
    name: 'json-parse',
    names: new Accepted(['JSON.parse']),
    scopes: [
      { owner: 'packages/foundation/src/host/codec.ts', root: 'packages/foundation/' },
      ...nobody('packages/systems/', 'experiences/sandbox/'),
      { owner: 'harness/lib/config.ts', root: 'harness/' },
    ],
    why: "one typed boundary narrows JSON's untyped values: the snapshot codec, the harness's config reader",
  },
  {
    name: 'network',
    names: new Accepted([
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
      'Navigator.sendBeacon',
      'http.request',
      'http.get',
      'https.request',
      'https.get',
      'net.connect',
      'net.createConnection',
    ]),
    scopes: [...nobody(...KERNEL, 'harness/'), { owner: 'experiences/sandbox/src/main.ts', root: 'experiences/sandbox/' }],
    why: 'data reaches the kernel through the Fetch effect; one module of a host makes the request',
  },
  {
    name: 'timers',
    names: new Accepted(['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 'requestIdleCallback']),
    scopes: nobody(...KERNEL, 'experiences/sandbox/', 'harness/'),
    why: 'time passes through the injected Scheduler, so a test drives it',
  },
  {
    name: 'storage',
    names: new Accepted(['localStorage', 'sessionStorage', 'indexedDB', 'Document.cookie', 'caches']),
    scopes: nobody(...KERNEL, 'experiences/sandbox/', 'harness/', 'packages/characterisation/'),
    why: 'saves go through the Persist effect and the injected Store',
  },
  {
    name: 'settings',
    names: new Accepted(['NodeJS.Process.env', 'process.env']),
    scopes: [
      ...nobody(...KERNEL, 'experiences/sandbox/', 'packages/characterisation/'),
      { owner: 'harness/lib/process.ts', root: 'harness/' },
    ],
    why: 'every setting is read once, in one module',
  },
];

export { RULES };
export type { Rule };
