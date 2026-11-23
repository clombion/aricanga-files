/**
 * The owner registry's table: for each guarded API, which module of each root may use it. The kernel's
 * roots are the population's kernel members; the other roots are written here.
 */

import { Accepted } from './exemptions.ts';
import type { Population } from './scope.ts';

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

/** A guarded API as declared: the kernel module that may use it, and the scopes of the roots beside the kernel. */
interface RuleShape extends Omit<Rule, 'scopes'> {
  /** The kernel module that may use the API; undefined: no kernel module may. */
  readonly kernelOwner: string | undefined;
  /** The scopes of the roots beside the kernel. */
  readonly scopes: readonly Scope[];
}

/**
 * The scopes of roots no module of which may use an API.
 *
 * @param {readonly string[]} roots - The roots.
 * @returns {Scope[]} A scope per root, with no owner.
 */
function nobody(...roots: readonly string[]): Scope[] {
  return roots.map((root) => ({ owner: undefined, root }));
}

/**
 * The scopes of roots one module of which may use an API: the root holding `owner`; no module of the others.
 *
 * @param {string | undefined} owner - The owning module; undefined: no module of any root may use it.
 * @param {readonly string[]} roots - The roots.
 * @returns {Scope[]} A scope per root.
 */
function ownedBy(owner: string | undefined, roots: readonly string[]): Scope[] {
  return roots.map((root) => ({ owner: owner?.startsWith(root) === true ? owner : undefined, root }));
}

/** Every guarded API as declared, with its owners: the kernel owner and the owner of each other root. */
const SHAPES: readonly RuleShape[] = [
  {
    kernelOwner: undefined,
    name: 'process-start',
    names: new Accepted(
      ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'].map((call) => `child_process.${call}`),
    ),
    scopes: [...nobody('experiences/sandbox/'), { owner: 'harness/lib/process.ts', root: 'harness/' }],
    why: 'every child process is bounded and its outcome is one of three',
  },
  {
    kernelOwner: undefined,
    name: 'clock',
    names: new Accepted(['DateConstructor.now', 'new Date()', 'Date()', 'Performance.now', 'NodeJS.Process.hrtime']),
    scopes: nobody('experiences/sandbox/', 'harness/'),
    why: 'time is simulation-derived: the kernel reads it from its input, a host from its injected clock',
  },
  {
    kernelOwner: undefined,
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
    scopes: [...nobody('experiences/sandbox/'), { owner: 'harness/lib/stress.ts', root: 'harness/' }],
    why: 'ids and draws come from the seed, so a run replays; the flake hunter draws the seed it prints and replays from',
  },
  {
    kernelOwner: undefined,
    name: 'standard-streams',
    names: new Accepted(['console', 'NodeJS.Process.stdout', 'NodeJS.Process.stderr']),
    scopes: [
      ...nobody('experiences/sandbox/'),
      { owner: 'harness/lib/output.ts', root: 'harness/' },
      { owner: 'packages/characterisation/src/harness.ts', root: 'packages/characterisation/' },
    ],
    why: 'the kernel reports through effects and the event bus; one module of a tool says what it says',
  },
  {
    kernelOwner: 'packages/foundation/src/host/codec.ts',
    name: 'json-parse',
    names: new Accepted(['JSON.parse']),
    scopes: [...nobody('experiences/sandbox/'), { owner: 'harness/lib/config.ts', root: 'harness/' }],
    why: "one typed boundary narrows JSON's untyped values: the snapshot codec, the harness's config reader",
  },
  {
    kernelOwner: undefined,
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
    scopes: [...nobody('harness/'), { owner: 'experiences/sandbox/src/main.ts', root: 'experiences/sandbox/' }],
    why: 'data reaches the kernel through the Fetch effect; one module of a host makes the request',
  },
  {
    kernelOwner: undefined,
    name: 'timers',
    names: new Accepted(['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 'requestIdleCallback']),
    scopes: nobody('experiences/sandbox/', 'harness/'),
    why: 'time passes through the injected Scheduler, so a test drives it',
  },
  {
    kernelOwner: undefined,
    name: 'storage',
    names: new Accepted(['localStorage', 'sessionStorage', 'indexedDB', 'Document.cookie', 'caches']),
    scopes: nobody('experiences/sandbox/', 'harness/', 'packages/characterisation/'),
    why: 'saves go through the Persist effect and the injected Store',
  },
  {
    kernelOwner: undefined,
    name: 'settings',
    names: new Accepted(['NodeJS.Process.env', 'process.env']),
    scopes: [...nobody('experiences/sandbox/', 'packages/characterisation/'), { owner: 'harness/lib/process.ts', root: 'harness/' }],
    why: 'every setting is read once, in one module',
  },
];

/**
 * The owner registry's rules over a population: each rule's kernel scopes are the kernel members'
 * directories, and the root holding its kernel owner is that owner's.
 *
 * @param {Population} population - The population.
 * @returns {readonly Rule[]} The rules.
 */
function rulesOf(population: Population): readonly Rule[] {
  const kernel = population.kernel.map((member) => member.dir);
  return SHAPES.map((shape) => ({
    name: shape.name,
    names: shape.names,
    scopes: [...ownedBy(shape.kernelOwner, kernel), ...shape.scopes],
    why: shape.why,
  }));
}

export { rulesOf, SHAPES };
export type { Rule };
