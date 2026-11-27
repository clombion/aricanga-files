/** The owner registry's plants: one per rule and call form, a canonical use per rule, a use in a test, and the near misses. */

import type { Rule, RuleName } from '#lib/owner-rules.ts';
import type { PlantedMember } from '#lib/planted-population.ts';
import type { Population } from '#lib/scope.ts';
import { byKind } from '#lib/by-kind.ts';
import { present } from '#lib/present.ts';
import { site } from '#lint-rules/exemptions.ts';

/** A member is held by exactly this many roots of each rule. */
const ONCE = 1;

/** The planted members the plants sit in: a member of each kernel role, a product member and a test-infrastructure member, so every tier's roots are planted. */
const MEMBERS: readonly PlantedMember[] = [
  ['experiences/sandbox/', 'experience'],
  ['packages/characterisation/', 'test-infrastructure'],
  ['packages/foundation/', 'foundation'],
  ['packages/systems/chat/', 'system'],
];

/** One plant per rule and call form: [rule, source]. */
const FORMS: readonly (readonly [RuleName, string])[] = [
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

/** One canonical use per rule, by its name, planted in every root the rule covers: a rule without one does not compile. */
const CANONICAL: Readonly<Record<RuleName, string>> = {
  clock: 'Date.now();\n',
  'json-parse': "JSON.parse('1');\n",
  network: "void fetch('x');\n",
  'process-start': "import { spawn } from 'node:child_process';\nspawn('x');\n",
  random: 'Math.random();\n',
  settings: 'export const x = process.env.X;\n',
  'standard-streams': "console.log('x');\n",
  storage: "localStorage.getItem('a');\n",
  timers: 'setTimeout(() => undefined, 1);\n',
};

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
  ['packages/characterisation/__miss_free.ts', 'setTimeout(() => undefined, 1);\n'],
];

/**
 * The members a rule does not hold at exactly one root of theirs, scoped or freed, each keyed
 * `site(member, rule)`.
 *
 * @param {readonly Rule[]} rules - The rules.
 * @param {Population} held - The population.
 * @returns {readonly string[]} Each rule and member it does not hold once.
 */
function unguarded(rules: readonly Rule[], held: Population): readonly string[] {
  return rules.flatMap((rule) => {
    const roots = rule.roots.map((entry) => entry.root);
    return held.members
      .filter((member) => roots.filter((root) => root === member.dir).length !== ONCE)
      .map((member) => site(member.dir, rule.name));
  });
}

/**
 * A rule's scoped roots, each with its owner (none: no module of the root may use the API).
 *
 * @param {Rule} rule - The rule.
 * @returns {readonly (readonly { root: string; owner: string | undefined })[]} Its scoped roots.
 */
function scopedOf(rule: Rule): readonly Readonly<{ root: string; owner: string | undefined }>[] {
  return rule.roots.flatMap((entry) => byKind(entry, { free: () => [], scoped: (scoped) => [{ owner: scoped.owner, root: scoped.root }] }));
}

/**
 * The rule of a name, which must exist.
 *
 * @param {readonly Rule[]} rules - The rules.
 * @param {RuleName} name - Its name.
 * @returns {Rule} The rule.
 */
function ruleNamed(rules: readonly Rule[], name: RuleName): Rule {
  return present(
    rules.find((rule) => rule.name === name),
    `the rule ${name}`,
  );
}

export { CANONICAL, FORMS, IN_A_TEST, MEMBERS, NEAR_MISSES, ruleNamed, scopedOf, unguarded };
