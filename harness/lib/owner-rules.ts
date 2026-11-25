/**
 * The owner registry's table: for each guarded API, which module of each root may use it. A rule
 * declares one policy per tier of the population (`roles.ts`) and one for the harness; its roots are
 * that tier's members' directories, read from the population, and the harness's own.
 */

import { Accepted } from './exemptions.ts';
import { HARNESS_ROOT } from './scope.ts';
import type { MemberDir } from './package-dirs.ts';
import type { Population } from './scope.ts';
import { PopulationError } from './workspace.ts';
import type { Tier } from './roles.ts';
import { nearestOf } from './package-dirs.ts';
import { tierOf } from './roles.ts';

/** A root a rule covers, a directory, and its owner there (undefined: no module of the root may use the API). */
interface Scope {
  readonly root: MemberDir;
  readonly owner: string | undefined;
}

/** A root a rule leaves unguarded, with the reason its modules use the API freely. */
interface Free {
  readonly root: MemberDir;
  readonly why: string;
}

/** A guarded API: the declarations that make it up, the roots it covers, the roots it frees, and why it has an owner. */
interface Rule {
  readonly name: string;
  readonly names: Readonly<Accepted<string>>;
  readonly scopes: readonly Scope[];
  readonly free: readonly Free[];
  readonly why: string;
}

/** What holds a root: a tier's members, or the harness. */
type Holder = Tier | 'harness';

/** A holder's policy for an API: one module of its roots owns it (none: no module may), or every module may, for a reason. */
type Policy = Readonly<{ owner: string | undefined }> | Readonly<{ free: string }>;

/** A guarded API as declared: a policy for every holder, so a holder without one does not compile. */
interface RuleShape {
  readonly name: string;
  readonly names: Readonly<Accepted<string>>;
  readonly policies: Readonly<Record<Holder, Policy>>;
  readonly why: string;
}

/** No module of a holder's roots may use the API. */
const NOBODY: Policy = { owner: undefined };

/**
 * The scopes of roots one module of which may use an API: the root holding `owner` (the nearest, when
 * roots nest, as every reader of a scope finds it); no module of the others.
 *
 * @param {string | undefined} owner - The owning module; undefined: no module of any root may use it.
 * @param {readonly MemberDir[]} roots - The roots.
 * @returns {Scope[]} A scope per root.
 */
function ownedBy(owner: string | undefined, roots: readonly MemberDir[]): Scope[] {
  const holding = owner === undefined ? undefined : nearestOf(roots, (root) => root)(owner);
  return roots.map((root) => ({ owner: root === holding ? owner : undefined, root }));
}

/** Every guarded API as declared, with each holder's policy. */
const SHAPES: readonly RuleShape[] = [
  {
    name: 'process-start',
    names: new Accepted(
      ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'].map((call) => `child_process.${call}`),
    ),
    policies: { harness: { owner: 'harness/lib/process.ts' }, kernel: NOBODY, product: NOBODY, 'test-infrastructure': NOBODY },
    why: 'every child process is bounded and its outcome is one of three',
  },
  {
    name: 'clock',
    names: new Accepted(['DateConstructor.now', 'new Date()', 'Date()', 'Performance.now', 'NodeJS.Process.hrtime']),
    policies: {
      harness: NOBODY,
      kernel: NOBODY,
      product: NOBODY,
      'test-infrastructure': { free: 'a test-infrastructure fixture times renders with performance.now (src/fixtures/performance.tsx)' },
    },
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
    policies: { harness: { owner: 'harness/lib/stress.ts' }, kernel: NOBODY, product: NOBODY, 'test-infrastructure': NOBODY },
    why: 'ids and draws come from the seed, so a run replays; the flake hunter draws the seed it prints and replays from',
  },
  {
    name: 'standard-streams',
    names: new Accepted(['console', 'NodeJS.Process.stdout', 'NodeJS.Process.stderr']),
    policies: {
      harness: { owner: 'harness/lib/output.ts' },
      kernel: NOBODY,
      product: NOBODY,
      'test-infrastructure': { owner: 'packages/characterisation/src/harness.ts' },
    },
    why: 'the kernel reports through effects and the event bus; one module of a tool says what it says',
  },
  {
    name: 'json-parse',
    names: new Accepted(['JSON.parse']),
    policies: {
      harness: { owner: 'harness/lib/config.ts' },
      kernel: { owner: 'packages/foundation/src/host/codec.ts' },
      product: NOBODY,
      'test-infrastructure': { free: "a test-infrastructure spec reads the browser's report with JSON.parse (tests/performance.spec.ts)" },
    },
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
    policies: {
      harness: NOBODY,
      kernel: NOBODY,
      product: { owner: 'experiences/sandbox/src/main.ts' },
      'test-infrastructure': { free: 'a test-infrastructure spec answers routed requests with route.fetch (tests/_helpers.ts)' },
    },
    why: 'data reaches the kernel through the Fetch effect; one module of a host makes the request',
  },
  {
    name: 'timers',
    names: new Accepted(['setTimeout', 'setInterval', 'setImmediate', 'requestAnimationFrame', 'requestIdleCallback']),
    policies: {
      harness: NOBODY,
      kernel: NOBODY,
      product: NOBODY,
      'test-infrastructure': {
        free: 'test-infrastructure fixtures and support wait on setTimeout (src/support.ts, src/fixtures/adapter.tsx)',
      },
    },
    why: 'time passes through the injected Scheduler, so a test drives it',
  },
  {
    name: 'storage',
    names: new Accepted(['localStorage', 'sessionStorage', 'indexedDB', 'Document.cookie', 'caches']),
    policies: { harness: NOBODY, kernel: NOBODY, product: NOBODY, 'test-infrastructure': NOBODY },
    why: 'saves go through the Persist effect and the injected Store',
  },
  {
    name: 'settings',
    names: new Accepted(['NodeJS.Process.env', 'process.env']),
    policies: { harness: { owner: 'harness/lib/process.ts' }, kernel: NOBODY, product: NOBODY, 'test-infrastructure': NOBODY },
    why: 'every setting is read once, in one module',
  },
];

/** The holders in the order their scopes are listed. */
const HOLDERS: readonly Holder[] = ['kernel', 'product', 'test-infrastructure', 'harness'];

/**
 * Each holder's roots in a population: a tier's members' directories, and the harness's own.
 *
 * @param {Population} population - The population.
 * @returns {Readonly<Record<Holder, readonly MemberDir[]>>} The roots, by holder.
 */
function rootsOf(population: Population): Readonly<Record<Holder, readonly MemberDir[]>> {
  const ofTier = (tier: Tier): readonly MemberDir[] =>
    population.members.filter((member) => tierOf(member.role) === tier).map((member) => member.dir);
  return {
    harness: [HARNESS_ROOT],
    kernel: ofTier('kernel'),
    product: ofTier('product'),
    'test-infrastructure': ofTier('test-infrastructure'),
  };
}

/**
 * Refuse a rule that holds one root twice: a lookup of the nearest root would read only the first.
 *
 * @param {Rule} rule - The rule.
 */
function refuseTwice(rule: Rule): void {
  const roots = [...rule.scopes.map((scope) => scope.root), ...rule.free.map((freed) => freed.root)];
  const twice = roots.find((root, index) => roots.indexOf(root) !== index);
  if (twice !== undefined) {
    throw new PopulationError(`the owner rule ${rule.name} holds the root ${twice} twice: a member sits at the harness's root`);
  }
}

/**
 * The owner registry's rules over a population: each holder's roots under its policy, the root
 * holding an owner that owner's; a rule holding one root twice is refused.
 *
 * @param {Population} population - The population.
 * @returns {readonly Rule[]} The rules.
 */
function rulesOf(population: Population): readonly Rule[] {
  const roots = rootsOf(population);
  return SHAPES.map((shape) => {
    const rule: Rule = {
      free: HOLDERS.flatMap((holder) => {
        const policy = shape.policies[holder];
        return 'free' in policy ? roots[holder].map((root) => ({ root, why: policy.free })) : [];
      }),
      name: shape.name,
      names: shape.names,
      scopes: HOLDERS.flatMap((holder) => {
        const policy = shape.policies[holder];
        return 'free' in policy ? [] : ownedBy(policy.owner, roots[holder]);
      }),
      why: shape.why,
    };
    refuseTwice(rule);
    return rule;
  });
}

export { rulesOf, SHAPES };
export type { Rule };
