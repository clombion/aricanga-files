/**
 * Each guarded API is used only by its owner module; the scan is proven on planted modules.
 *
 * The scan resolves every name through TypeScript's checker, so each call form is planted: a plain
 * call, an aliased import, a destructured binding, a `globalThis.`/`window.` chain and an element
 * access. Each rule is also planted once in every root it covers. The near misses: a type-only
 * import, a module's own `fetch` or `now`, a pure constructor call, the owner itself, a test file,
 * and a root the rule does not cover.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { isProduction, openScan, productionFiles, type Scan, sourceOf } from '../lib/checker.ts';
import { Exemptions, site } from '../lib/exemptions.ts';
import { keyOf, ownerUses, RULES, type Site, sites } from '../lib/owners.ts';
import { tracked } from '../lib/source-files.ts';

export const HARNESS_ID = 'owner-registry';

const EXEMPT = Exemptions.grouped({
  'adopting: the sandbox reports a failed boot through the console; it becomes a Present effect of the host shell (task #28)':
    [site('experiences/sandbox/src/main.ts', 'standard-streams')],
  'adopting: tools.isolatedEnv reads process.env; move the read into harness/lib/process.ts, the settings owner':
    [site('harness/lib/tools.ts', 'settings')],
});

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
const CANONICAL: Readonly<Record<string, string>> = {
  'process-start': "import { spawn } from 'node:child_process';\nspawn('x');\n",
  clock: 'Date.now();\n',
  random: 'Math.random();\n',
  'standard-streams': "console.log('x');\n",
  'json-parse': "JSON.parse('1');\n",
  network: "void fetch('x');\n",
  timers: 'setTimeout(() => undefined, 1);\n',
  storage: "localStorage.getItem('a');\n",
  settings: 'export const x = process.env.X;\n',
};

const NEAR_MISSES: readonly (readonly [string, string])[] = [
  ['packages/foundation/src/__miss_type.ts', "import type { ChildProcess } from 'node:child_process';\nexport let child: ChildProcess | undefined;\nexport let store: Storage | undefined;\n"],
  ['packages/foundation/src/__miss_own_now.ts', 'const clock = { now: () => 1 };\nclock.now();\n'],
  ['packages/foundation/src/__miss_own_fetch.ts', "export function load() {\n  const fetch = (x: string) => x;\n  return fetch('a');\n}\n"],
  ['packages/foundation/src/__miss_pure.ts', 'new Date(0).getTime();\nDate.UTC(2020, 1);\nJSON.stringify({});\n'],
  ['harness/lib/process.ts', "import { spawnSync } from 'node:child_process';\nexport const out = spawnSync('x');\nexport const env = process.env;\n"],
  ['packages/foundation/src/__miss.test.ts', 'Math.random();\nDate.now();\n'],
  ['utils/__miss_uncovered.ts', 'Math.random();\n'],
];

const plants: Record<string, string> = {};
const expected: Site[] = [];
FORMS.forEach(([rule, text], index) => {
  const path = `packages/foundation/src/__form_${index}.ts`;
  plants[path] = text;
  expected.push({ path, rule });
});
for (const rule of RULES) {
  for (const scope of rule.scopes) {
    const path = `${scope.root}__root_${rule.name}.ts`;
    plants[path] = CANONICAL[rule.name] ?? '';
    expected.push({ path, rule: rule.name });
  }
}
for (const [path, text] of NEAR_MISSES) {
  plants[path] = text;
}

let plantedScan: Scan;
let repoScan: Scan;

beforeAll(() => {
  plantedScan = openScan(Object.keys(plants), plants);
  repoScan = openScan(productionFiles(), {});
}, 120_000);

afterAll(() => {
  plantedScan.close();
  repoScan.close();
});

function sitesIn(scan: Scan, paths: readonly string[]): Site[] {
  return paths.filter(isProduction).flatMap((path) => sites(scan, sourceOf(scan, path)));
}

describe('the repository', () => {
  test('no guarded API is used outside its owner', () => {
    expect(EXEMPT.unexemptedBy(sitesIn(repoScan, productionFiles()), keyOf)).toEqual([]);
  });

  test.each(RULES.flatMap((rule) => rule.scopes.flatMap((scope) => (scope.owner === null ? [] : [[rule.name, scope.owner] as const]))))(
    'the %s owner %s exists and uses its API',
    (name, owner) => {
      const rule = RULES.find((candidate) => candidate.name === name);
      expect(tracked()).toContain(owner);
      expect(rule !== undefined && ownerUses(repoScan, sourceOf(repoScan, owner), rule)).toBe(true);
    },
  );
});

describe('the scan', () => {
  test('sees each planted call form and each planted root', () => {
    const planted = Object.keys(plants).filter((path) => path.includes('__form_') || path.includes('__root_'));
    const found = sitesIn(plantedScan, planted).map(keyOf).toSorted();
    expect(found).toEqual(expected.map(keyOf).toSorted());
  });

  test.each(NEAR_MISSES.map(([path]) => path))('lets the near miss %s through', (path) => {
    expect(sitesIn(plantedScan, [path])).toEqual([]);
  });
});
