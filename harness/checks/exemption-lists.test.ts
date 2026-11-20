/**
 * Every literal list a check consults is an exemption declaration, and every declaration is consulted.
 *
 * Over the modules of `harness/checks` and `harness/lib`: a module-level array, object, or pre-filled
 * `Set` or `Map` literal (through `as const` and `satisfies`) that the module consults — with
 * `includes`, `has`, `indexOf`, `get`, `some`, `every`, `find`, `in`, a computed lookup
 * `NAME[key]`, or by handing it to a module function that does one of these with its parameter —
 * must be declared through `harness/lib/exemptions.ts`. Iterating a list is not consulting it.
 *
 * A declaration nothing consults is stale: an `Exemptions` or `CountedExemptions` is consulted by a
 * call that fails on a stale entry (`unexempted`, `unexemptedBy`, `mismatches`, `assertExact`) or
 * by being handed to a call, which is trusted to make one; an `Accepted` or `Prefixes` by any read.
 * Reads in importing modules count, through a relative or a `#…` subpath specifier. The fence
 * cannot see a collection built at run time, nor tolerance applied inside a helper of another module.
 */

import { Exemptions, StaleExemptionError, site } from '#lib/exemptions.ts';
import { UNCONSULTED, UNDECLARED, findings } from './exemption-lists.fence.ts';
import { describe, expect, test } from 'vitest';
import type { Finding } from './exemption-lists.fence.ts';
import { heldFiles } from '#lib/scope.ts';
import { textsOf } from '#lib/source-files.ts';

const HARNESS_ID = 'exemption-lists';

/** Consulted literal lists the harness still holds while the fence is adopted, keyed by `site(path, name)`. */
const ADOPTING = new Exemptions({
  [site('harness/checks/boundaries.test.ts', 'BOUNDARY_RULES')]: 'adopting: declare it as an Accepted and ask .has',
  [site('harness/checks/gate.test.ts', 'GATE_TESTS')]: 'adopting: declare it as an Accepted of the commands check must run',
  [site('harness/lib/scope.ts', 'ROOTS')]: 'adopting: declare it as Prefixes and ask .starts',
});

const PLANT = 'harness/checks/plant.test.ts';

/** The ways a module consults a list, each as the body of `check(x)`. */
const CONSULTS = [
  'NAMES.includes(x)',
  'NAMES.has(x)',
  'NAMES.indexOf(x)',
  'NAMES.get(x)',
  'NAMES.some((name) => name === x)',
  'NAMES.every((name) => name !== x)',
  'NAMES.find((name) => name === x)',
  'x in NAMES',
  'NAMES[x]',
  'helper(NAMES)',
];

/** The literal collections a module may consult. */
const LITERALS = ["['a', 'b']", '{ a: 1 }', "new Set(['a'])", "new Map([['a', 1]])", "['a'] as const"];

/** Each planted consult of each literal. */
const CONSULTED_LITERALS = CONSULTS.flatMap((consult) =>
  LITERALS.map(
    (literal) =>
      [
        `${literal} consulted by ${consult}`,
        `const NAMES = ${literal};\nfunction helper(values: readonly string[]) { return values.includes('a'); }\nexport function check(x: string) { return ${consult}; }\n`,
      ] as const,
  ),
);

/**
 * The finding keyed by its site.
 *
 * @param {Finding} finding - A finding of the fence.
 * @returns {string} Its `site(path, name)` key.
 */
function keyOf(finding: Finding): string {
  return site(finding.path, finding.name);
}

/**
 * The harness modules the fence holds, by path.
 *
 * @returns {Promise<Readonly<Record<string, string>>>} Each held module's source, by path.
 */
async function harnessModules(): Promise<Readonly<Record<string, string>>> {
  const files = await heldFiles('.ts');
  const texts = await textsOf(files.filter((path) => path.startsWith('harness/checks/') || path.startsWith('harness/lib/')));
  return Object.fromEntries(texts);
}

describe('the repository', () => {
  test('every consulted list is declared and every declaration is consulted', async () => {
    expect.hasAssertions();
    const found = await findings(await harnessModules());
    expect(ADOPTING.unexemptedBy(found, keyOf)).toStrictEqual([]);
  });
});

describe('the fence', () => {
  test.each(CONSULTED_LITERALS)('sees %s', async (_name, source) => {
    expect.hasAssertions();
    await expect(findings({ [PLANT]: source })).resolves.toStrictEqual([{ name: 'NAMES', path: PLANT, problem: UNDECLARED }]);
  });

  test.each([
    "const NAMES = ['a', 'b'];\nexport function check() { for (const name of NAMES) { void name; } }",
    "const NAMES = ['a'];\nexport const upper = NAMES.map((name) => name.toUpperCase());",
    "const NAMES = new Accepted(['a']);\nexport const has = NAMES.has('a');",
    "const EXEMPT = Exemptions.grouped({});\nexport function check() { EXEMPT.unexempted([]); }",
    "const COUNTED = new CountedExemptions({});\nexport function check() { COUNTED.assertExact([]); }",
    "const EXEMPT = new Exemptions({ a: 'why' });\nexport function check() { scan(EXEMPT); }",
    "const STARTS = new Prefixes(['a']);\nexport const starts = STARTS.starts('ab');",
    "const NAMES = ['a'];\nfunction helper(values: readonly string[]) { return values.length; }\nexport const n = helper(NAMES);",
    "const cache = new Map<string, number>();\nexport const hit = cache.get('a');",
    "const FIRST = ['a', 'b'];\nexport const first = FIRST[0];",
  ])('lets a declared, iterated or run-time list through: %j', async (source) => {
    expect.hasAssertions();
    await expect(findings({ [PLANT]: source })).resolves.toStrictEqual([]);
  });

  test.each([
    "const NAME = new Exemptions({ a: 'why' });",
    "const NAME = Exemptions.grouped({ why: ['a'] });\nexport const size = NAME.entries.size;",
    "const NAME = new CountedExemptions({ a: { count: 1, reason: 'why' } });",
    "const NAME = new Accepted(['a']);",
    "const NAME = new Prefixes(['a']);",
  ])('sees a declaration nothing consults: %j', async (source) => {
    expect.hasAssertions();
    await expect(findings({ [PLANT]: source })).resolves.toStrictEqual([{ name: 'NAME', path: PLANT, problem: UNCONSULTED }]);
  });

  test.each([
    ['a relative specifier', '../lib/planted.ts'],
    ['a subpath specifier', '#lib/planted.ts'],
  ])('a declaration consulted by a module importing it through %s is live', async (_name, specifier) => {
    expect.hasAssertions();
    const owner = "export const EXEMPT = new Exemptions({ a: 'why' });\nexport const NAMES = new Accepted(['a']);\n";
    const user = `import { EXEMPT, NAMES } from '${specifier}';\nexport function check() { EXEMPT.unexempted(['a']); return NAMES.has('a'); }\n`;
    await expect(findings({ [PLANT]: user, 'harness/lib/planted.ts': owner })).resolves.toStrictEqual([]);
  });

  test('a stale adopting entry fails', () => {
    expect.hasAssertions();
    const adopting = new Exemptions({ [site(PLANT, 'GONE')]: 'planted' });
    expect(() => adopting.unexemptedBy([], keyOf)).toThrow(StaleExemptionError);
  });
});

export { HARNESS_ID };
