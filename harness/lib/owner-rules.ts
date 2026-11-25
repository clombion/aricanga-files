/**
 * The owner registry's table: for each guarded API, which module of each root may use it. A rule
 * declares one tagged policy per tier of the population (`roles.ts`) and one for the harness; its
 * roots are that tier's members' directories, read from the population, and the harness's own, one
 * list of scoped and free roots.
 */

import { Accepted, Vocabulary } from './exemptions.ts';
import { HARNESS_ROOT } from './scope.ts';
import type { MemberDir } from './package-dirs.ts';
import type { Population } from './scope.ts';
import { PopulationError } from './workspace.ts';
import type { Tier } from './roles.ts';
import { nearestOf } from './package-dirs.ts';

/**
 * A root of a rule, a directory, and what the rule allows there: a scoped root, one module of which
 * may use the API (its `owner`; none: no module of the root may), or a free root, every module of
 * which may, for a reason. One list holds both kinds, so every reader finds a file's root by one
 * nearest lookup, whatever its kind.
 */
type Root =
  | Readonly<{ kind: 'scoped'; root: MemberDir; owner: string | undefined }>
  | Readonly<{ kind: 'free'; root: MemberDir; why: string }>;

/** A guarded API: the declarations that make it up, its roots, and why it has an owner. */
interface Rule {
  readonly name: string;
  readonly names: Readonly<Accepted<string>>;
  readonly roots: readonly Root[];
  readonly why: string;
}

/** What holds a root: a tier's members, or the harness. */
type Holder = Tier | 'harness';

/**
 * A holder's policy for an API, tagged: one module of its roots owns it, no module may, or every
 * module may, for a reason. `tsc` refuses a policy of two kinds.
 */
type Policy = Readonly<{ kind: 'owned'; owner: string }> | Readonly<{ kind: 'nobody' }> | Readonly<{ kind: 'free'; why: string }>;

/** A guarded API as declared: a policy for every holder, so a holder without one does not compile. */
interface RuleShape {
  readonly name: string;
  readonly names: Readonly<Accepted<string>>;
  readonly policies: Readonly<Record<Holder, Policy>>;
  readonly why: string;
}

/** No module of a holder's roots may use the API. */
const NOBODY: Policy = { kind: 'nobody' };

/**
 * A holder's roots under its policy: the root holding the owner scoped to it (the nearest of the
 * holder's roots: a member is never nested in another, #58 1c refuses it), the others scoped to no
 * module; every root free, with the policy's reason.
 *
 * @param {Policy} policy - The holder's policy.
 * @param {readonly MemberDir[]} roots - The holder's roots.
 * @returns {Root[]} A root per directory.
 */
function rootsUnder(policy: Policy, roots: readonly MemberDir[]): Root[] {
  if (policy.kind === 'free') {
    return roots.map((root) => ({ kind: 'free', root, why: policy.why }));
  }
  const owner = policy.kind === 'owned' ? policy.owner : undefined;
  const holding = owner === undefined ? undefined : nearestOf(roots, (root) => root)(owner);
  return roots.map((root) => ({ kind: 'scoped', owner: root === holding ? owner : undefined, root }));
}

/** Every guarded API as declared, with each holder's policy. */
const SHAPES: readonly RuleShape[] = [
  {
    name: 'process-start',
    names: new Accepted(
      ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'].map((call) => `child_process.${call}`),
    ),
    policies: {
      harness: { kind: 'owned', owner: 'harness/lib/process.ts' },
      kernel: NOBODY,
      product: NOBODY,
      'test-infrastructure': NOBODY,
    },
    why: 'every child process is bounded and its outcome is one of three',
  },
  {
    name: 'clock',
    names: new Accepted(['DateConstructor.now', 'new Date()', 'Date()', 'Performance.now', 'NodeJS.Process.hrtime']),
    policies: {
      harness: NOBODY,
      kernel: NOBODY,
      product: NOBODY,
      'test-infrastructure': {
        kind: 'free',
        why: 'a test-infrastructure fixture times renders with performance.now (src/fixtures/performance.tsx)',
      },
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
    policies: {
      harness: { kind: 'owned', owner: 'harness/lib/stress.ts' },
      kernel: NOBODY,
      product: NOBODY,
      'test-infrastructure': NOBODY,
    },
    why: 'ids and draws come from the seed, so a run replays; the flake hunter draws the seed it prints and replays from',
  },
  {
    name: 'standard-streams',
    names: new Accepted(['console', 'NodeJS.Process.stdout', 'NodeJS.Process.stderr']),
    policies: {
      harness: { kind: 'owned', owner: 'harness/lib/output.ts' },
      kernel: NOBODY,
      product: NOBODY,
      'test-infrastructure': { kind: 'owned', owner: 'packages/characterisation/src/harness.ts' },
    },
    why: 'the kernel reports through effects and the event bus; one module of a tool says what it says',
  },
  {
    name: 'json-parse',
    names: new Accepted(['JSON.parse']),
    policies: {
      harness: { kind: 'owned', owner: 'harness/lib/config.ts' },
      kernel: { kind: 'owned', owner: 'packages/foundation/src/host/codec.ts' },
      product: NOBODY,
      'test-infrastructure': {
        kind: 'free',
        why: "a test-infrastructure spec reads the browser's report with JSON.parse (tests/performance.spec.ts)",
      },
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
      product: { kind: 'owned', owner: 'experiences/sandbox/src/main.ts' },
      'test-infrastructure': {
        kind: 'free',
        why: 'a test-infrastructure spec answers routed requests with route.fetch (tests/_helpers.ts)',
      },
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
        kind: 'free',
        why: 'test-infrastructure fixtures and support wait on setTimeout (src/support.ts, src/fixtures/adapter.tsx)',
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
    policies: {
      harness: { kind: 'owned', owner: 'harness/lib/process.ts' },
      kernel: NOBODY,
      product: NOBODY,
      'test-infrastructure': NOBODY,
    },
    why: 'every setting is read once, in one module',
  },
];

/**
 * Each holder's roots in a population: the harness's own, and a tier's members' directories. A total
 * record, so a holder missing here does not compile; its words are the order a rule lists its roots in.
 *
 * @param {Population} population - The population.
 * @returns {Vocabulary<Readonly<Record<Holder, readonly MemberDir[]>>>} The roots, by holder.
 */
function rootsOf(population: Population): Vocabulary<Readonly<Record<Holder, readonly MemberDir[]>>> {
  const ofTier = (tier: Tier): readonly MemberDir[] => population.tiers[tier].map((member) => member.dir);
  return new Vocabulary<Readonly<Record<Holder, readonly MemberDir[]>>>({
    harness: [HARNESS_ROOT],
    kernel: ofTier('kernel'),
    product: ofTier('product'),
    'test-infrastructure': ofTier('test-infrastructure'),
  });
}

/**
 * Refuse a rule that holds one root twice: a lookup of the nearest root would read only the first.
 *
 * @param {Rule} rule - The rule.
 */
function refuseTwice(rule: Rule): void {
  const roots = rule.roots.map((entry) => entry.root);
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
      name: shape.name,
      names: shape.names,
      roots: roots.words.flatMap((holder) => rootsUnder(shape.policies[holder], roots.of(holder))),
      why: shape.why,
    };
    refuseTwice(rule);
    return rule;
  });
}

export { rulesOf, SHAPES };
export type { Root, Rule };
