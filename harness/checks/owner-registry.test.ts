/**
 * Each guarded API is used only by its owner module; the scan is proven on planted modules.
 *
 * The scan resolves every name through TypeScript's checker, so each call form is planted: a plain
 * call, an aliased import, a destructured binding, a `globalThis.`/`window.` chain and an element
 * access. Each rule is also planted once in every root it covers, and once in a test: tests are held
 * as production code is. The near misses: a type-only import, a module's own `fetch` or `now`, a
 * pure constructor call, the owner itself, and a root the rule does not cover.
 */

import { RULES, keyOf, ownerUses, sites } from '#lib/owners.ts';
import { describe, expect, test } from 'vitest';
import { scannedFiles, sourceOf } from '#lib/checker.ts';
import { usePlanted, useScan } from '#lib/scan-hooks.ts';
import type { Scan } from '#lib/checker.ts';
import type { Site } from '#lib/owners.ts';
import { tracked } from '#lib/source-files.ts';

const HARNESS_ID = 'owner-registry';

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
  ['packages/foundation/src/__miss_type.ts', "import type { ChildProcess } from 'node:child_process';\nexport let child: ChildProcess | undefined;\nexport let store: Storage | undefined;\n"],
  ['packages/foundation/src/__miss_own_now.ts', 'const clock = { now: () => 1 };\nclock.now();\n'],
  ['packages/foundation/src/__miss_own_fetch.ts', "export function load() {\n  const fetch = (x: string) => x;\n  return fetch('a');\n}\n"],
  ['packages/foundation/src/__miss_pure.ts', 'new Date(0).getTime();\nDate.UTC(2020, 1);\nJSON.stringify({});\n'],
  ['harness/lib/process.ts', "import { spawnSync } from 'node:child_process';\nexport const out = spawnSync('x');\nexport const env = process.env;\n"],
  ['utils/__miss_uncovered.ts', 'Math.random();\n'],
];

/** A planted module, and the rule the scan must report in it, if any. */
interface Plant {
  readonly path: string;
  readonly text: string;
  readonly rule?: string;
}

/**
 * One module per call form, each in a root every rule covers.
 *
 * @returns {readonly Plant[]} The form plants, each with its rule.
 */
function formPlants(): readonly Plant[] {
  return FORMS.map(([rule, text]: readonly [string, string], index) => ({ path: `packages/foundation/src/__form_${index}.ts`, rule, text }));
}

/**
 * One canonical use per root each rule covers.
 *
 * @returns {readonly Plant[]} The root plants, each with its rule.
 */
function rootPlants(): readonly Plant[] {
  const canonical = new Map(CANONICAL);
  return RULES.flatMap((rule) => {
    const text = canonical.get(rule.name);
    return text === undefined ? [] : rule.scopes.map((scope) => ({ path: `${scope.root}__root_${rule.name}.ts`, rule: rule.name, text }));
  });
}

const PLANTED: readonly Plant[] = [
  ...formPlants(),
  ...rootPlants(),
  { path: IN_A_TEST, rule: 'random', text: 'Math.random();\n' },
  ...NEAR_MISSES.map(([path, text]: readonly [string, string]) => ({ path, text })),
];
const plants = new Map(PLANTED.map((plant) => [plant.path, plant.text] as const));
const expected: readonly Site[] = PLANTED.flatMap((plant) => (plant.rule === undefined ? [] : [{ path: plant.path, rule: plant.rule }]));
const plantedScan = usePlanted(plants);
const repoScan = useScan();

/**
 * The guarded-API sites in some modules of a scan.
 *
 * @param {() => Scan} scanOf - The hook that hands out the open scan.
 * @param {readonly string[]} paths - The modules to read.
 * @returns {Site[]} Their sites.
 */
function sitesIn(scanOf: () => Scan, paths: readonly string[]): Site[] {
  const scan = scanOf();
  return paths.flatMap((path) => sites(scan, sourceOf(scan, path)));
}

/** Each owned scope, as the rule's name, its owner module and the rule. */
const OWNED = RULES.flatMap((rule) =>
  rule.scopes.flatMap((scope) => (scope.owner === undefined ? [] : [[rule.name, scope.owner, rule] as const])),
);

describe('the repository', () => {
  test('no guarded API is used outside its owner', async () => {
    expect.hasAssertions();
    expect(sitesIn(repoScan, await scannedFiles())).toStrictEqual([]);
  });

  test.each(OWNED)('the %s owner %s exists and uses its API', async (_name, owner, rule) => {
    expect.hasAssertions();
    const scan = repoScan();
    const file = sourceOf(scan, owner);
    await expect(tracked()).resolves.toContain(owner);
    expect(ownerUses(scan, file, rule)).toBe(true);
  });
});

describe('the scan', () => {
  test('sees each planted call form and each planted root', () => {
    expect.hasAssertions();
    expect(CANONICAL.map(([name]) => name).toSorted()).toStrictEqual(RULES.map((rule) => rule.name).toSorted());
    const planted = [...plants.keys()].filter((path) => /__(?:form|root|in_a_test)/u.test(path));
    const found = sitesIn(plantedScan, planted).map((site) => keyOf(site)).toSorted();
    expect(found).toStrictEqual(expected.map((site) => keyOf(site)).toSorted());
  });

  test('plants a canonical use in every root of every rule, and each call form', () => {
    expect.hasAssertions();
    const roots = RULES.flatMap((rule) => rule.scopes.map((scope) => `${scope.root}__root_${rule.name}.ts`));
    const forms = FORMS.map((_form, index) => `packages/foundation/src/__form_${index}.ts`);
    expect([...plants.keys()].filter((path) => /__(?:form|root)_/u.test(path)).toSorted()).toStrictEqual([...roots, ...forms].toSorted());
  });

  test.each(NEAR_MISSES.map(([path]) => path))('lets the near miss %s through', (path) => {
    expect.hasAssertions();
    expect(sitesIn(plantedScan, [path])).toStrictEqual([]);
  });
});

export { HARNESS_ID };
