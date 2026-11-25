/** The owner registry's plants: one per rule and call form, a canonical use per rule, a use in a test, and the near misses. */

import { Exemptions } from '#lib/exemptions.ts';
import type { PlantedMember } from '#lib/scan-hooks.ts';
import type { Population } from '#lib/scope.ts';
import type { Rule } from '#lib/owner-rules.ts';
import { nearest } from '#lib/package-dirs.ts';

/**
 * The members a rule does not reach, each pair with what keeps it out: the use a rule's non-kernel
 * roots leave out until they derive from the roles (#58 step 1b), or a scope the rule does not claim.
 */
const UNGUARDED: Exemptions = new Exemptions({
  'clock: packages/characterisation/': 'its performance fixture times renders with performance.now (src/fixtures/performance.tsx)',
  'json-parse: packages/characterisation/': 'its performance spec reads the browser report with JSON.parse (tests/performance.spec.ts)',
  'network: packages/characterisation/': 'its specs answer routed requests with route.fetch (tests/_helpers.ts)',
  'process-start: packages/characterisation/': "no use; its root is #58 step 1b's to add, with the roots derived from the roles",
  'random: packages/characterisation/': "no use; its root is #58 step 1b's to add, with the roots derived from the roles",
  'timers: packages/characterisation/': 'its fixtures and support wait on setTimeout (src/support.ts, src/fixtures/adapter.tsx)',
});

/** The planted members the plants sit in: a kernel member of each kernel role, and the literal roots' members. */
const MEMBERS: readonly PlantedMember[] = [
  ['packages/foundation/', 'foundation'],
  ['packages/systems/chat/', 'system'],
  ['experiences/sandbox/', 'experience'],
  ['packages/characterisation/', 'test-infrastructure'],
];

/** One plant per rule and call form: [rule, source]. */
const FORMS: readonly (readonly [string, string])[] = [
  ['process-start', "import { spawn } from 'node:child_process';\nspawn('x');\n"],
  ['process-start', "import { spawn as go } from 'node:child_process';\ngo('x');\n"],
  ['process-start', "import * as cp from 'child_process';\ncp.execSync('x');\n"],
  ['process-start', "import * as cp from 'node:child_process';\nconst { fork } = cp;\nfork('x');\n"],
  ['clock', 'Date.now();\n'],
  ['clock', 'const D = Date;\nD.now();\n'],
  ['clock', 'const { now } = performance;\nnow();\n'],
  ['clock', 'globalThis.Date.now();\n'],
  ['clock', "Date['now']();\n"],
  ['clock', 'new Date();\n'],
  ['clock', 'new Date;\n'],
  ['clock', 'Date();\n'],
  ['clock', 'process.hrtime();\n'],
  ['random', 'Math.random();\n'],
  ['random', 'const { random } = Math;\nrandom();\n'],
  ['random', 'globalThis.crypto.randomUUID();\n'],
  ['random', "import { randomBytes } from 'node:crypto';\nrandomBytes(4);\n"],
  ['standard-streams', "console.log('x');\n"],
  ['standard-streams', "const say = console;\nsay.info('x');\n"],
  ['standard-streams', "globalThis.console.error('x');\n"],
  ['standard-streams', "process.stdout.write('x');\n"],
  ['standard-streams', 'const { stderr } = process;\nstderr.end();\n'],
  ['json-parse', "JSON.parse('1');\n"],
  ['json-parse', "const { parse } = JSON;\nparse('1');\n"],
  ['json-parse', "globalThis.JSON.parse('1');\n"],
  ['network', "void fetch('x');\n"],
  ['network', "void window.fetch('x');\n"],
  ['network', "void globalThis.fetch('x');\n"],
  ['network', "new WebSocket('ws://x');\n"],
  ['network', "import { request } from 'node:https';\nrequest('x');\n"],
  ['timers', 'setTimeout(() => undefined, 1);\n'],
  ['timers', 'globalThis.setInterval(() => undefined, 1);\n'],
  ['timers', 'const { setTimeout: later } = globalThis;\nlater(() => undefined, 1);\n'],
  ['timers', 'requestAnimationFrame(() => undefined);\n'],
  ['storage', "localStorage.getItem('a');\n"],
  ['storage', 'window.sessionStorage.clear();\n'],
  ['storage', "globalThis.indexedDB.open('x');\n"],
  ['storage', "document.cookie = 'a=b';\n"],
  ['settings', 'export const x = process.env.X;\n'],
  ['settings', 'const { env } = process;\nexport const x = env;\n'],
  ['settings', "export const x = process['env'];\n"],
];

/** One canonical use per rule, planted in every root the rule covers. */
const CANONICAL: readonly (readonly [string, string])[] = [
  ['process-start', "import { spawn } from 'node:child_process';\nspawn('x');\n"],
  ['clock', 'Date.now();\n'],
  ['random', 'Math.random();\n'],
  ['standard-streams', "console.log('x');\n"],
  ['json-parse', "JSON.parse('1');\n"],
  ['network', "void fetch('x');\n"],
  ['timers', 'setTimeout(() => undefined, 1);\n'],
  ['storage', "localStorage.getItem('a');\n"],
  ['settings', 'export const x = process.env.X;\n'],
];

const IN_A_TEST = 'packages/systems/chat/test/__in_a_test.test.ts';

const NEAR_MISSES: readonly (readonly [string, string])[] = [
  [
    'packages/foundation/src/__miss_type.ts',
    "import type { ChildProcess } from 'node:child_process';\nexport let child: ChildProcess | undefined;\nexport let store: Storage | undefined;\n",
  ],
  ['packages/foundation/src/__miss_own_now.ts', 'const clock = { now: () => 1 };\nclock.now();\n'],
  ['packages/foundation/src/__miss_own_fetch.ts', "export function load() {\n  const fetch = (x: string) => x;\n  return fetch('a');\n}\n"],
  ['packages/foundation/src/__miss_pure.ts', 'new Date(0).getTime();\nDate.UTC(2020, 1);\nJSON.stringify({});\n'],
  [
    'harness/lib/process.ts',
    "import { spawnSync } from 'node:child_process';\nexport const out = spawnSync('x');\nexport const env = process.env;\n",
  ],
  ['packages/characterisation/__miss_uncovered.ts', 'Math.random();\n'],
];

/**
 * The members no scope of a rule holds, as `rule: member`.
 *
 * @param {readonly Rule[]} rules - The rules.
 * @param {Population} held - The population.
 * @returns {readonly string[]} Each rule and member it misses.
 */
function unguarded(rules: readonly Rule[], held: Population): readonly string[] {
  return rules.flatMap((rule) =>
    held.members
      .filter((member) => nearest(rule.scopes, (scope) => scope.root, member.dir) === undefined)
      .map((member) => `${rule.name}: ${member.dir}`),
  );
}

export { CANONICAL, FORMS, IN_A_TEST, MEMBERS, NEAR_MISSES, UNGUARDED, unguarded };
