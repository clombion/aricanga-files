/**
 * Every literal list a check consults is an exemption declaration, and every declaration is consulted.
 *
 * Over the harness's modules, as the population partitions them (`harnessModules`): its checks, its
 * library, its lint rules, its scripts and the root configuration modules; a list planted in a
 * module of each directory of them, chosen from git's listing, is refused there. A module-level array, object, or pre-filled
 * `Set` or `Map` literal (through `as const` and `satisfies`) that the module consults — with
 * `includes`, `has`, `indexOf`, `get`, `some`, `every`, `find`, `in`, `Object.hasOwn`, a computed lookup
 * `NAME[key]`, or by handing it to a module function that does one of these with its parameter —
 * must be declared through `harness/lint-rules/exemptions.ts`. Iterating a list is not consulting it.
 *
 * A declaration nothing consults is stale: an `Exemptions` or `CountedExemptions` is consulted by a
 * call that fails on a stale entry (`unexempted`, `unexemptedBy`, `mismatches`, `assertExact`) or
 * by being handed to a call, which is trusted to make one; an `Accepted`, `Prefixes` or `Vocabulary` by any read.
 * Reads in importing modules count, found by the checker's symbol through any import form: a named or
 * namespace import, a literal or destructured `import()`, a re-export then an import. The fence
 * cannot see a collection built at run time, nor tolerance applied inside a helper of another module.
 */

import { Exemptions, KINDS, StaleExemptionError, Vocabulary, site } from '#lint-rules/exemptions.ts';
import { UNCONSULTED, UNDECLARED, findings } from './exemption-lists.fence.ts';
import { describe, test } from 'vitest';
import { isTypeScript, textsOf, tracked } from '#lib/source-files.ts';
import type { Finding } from './exemption-lists.fence.ts';
import { ROOT_MODULES } from '#lib/config-modules.ts';
import { byCodeUnit } from '#lib/lists.ts';
import { harnessModules } from '#lib/holders.ts';
import { population } from '#lib/scope.ts';

const HARNESS_ID = 'exemption-lists';

/** Consulted literal lists the harness still holds while the fence is adopted, keyed by `site(path, name)`. */
const ADOPTING = new Exemptions({
  [site('harness/checks/gate.test.ts', 'GATE_TESTS')]: 'adopting: declare it as an Accepted of the commands check must run',
});

const PLANT = 'harness/checks/plant.test.ts';

/** A declaration of each kind that nothing consults: typed by the kinds, so a kind without one fails to compile. */
const UNCONSULTED_PLANTS: Vocabulary<Readonly<Record<(typeof KINDS.words)[number], string>>> = new Vocabulary<
  Readonly<Record<(typeof KINDS.words)[number], string>>
>({
  Accepted: "const NAME = new Accepted(['a']);",
  CountedExemptions: "const NAME = new CountedExemptions({ a: { count: 1, reason: 'why' } });",
  Exemptions: "const NAME = new Exemptions({ a: 'why' });",
  Prefixes: "const NAME = new Prefixes(['a']);",
  Vocabulary: 'const NAME = new Vocabulary({ a: { x: true } });',
});

/**
 * Whether an export of the exemption owner is a declaration class: a class, and not an error.
 *
 * @param {unknown} value - The export.
 * @returns {boolean} Whether it declares lists.
 */
function isDeclarationClass(value: unknown): boolean {
  return typeof value === 'function' && Function.prototype.toString.call(value).startsWith('class ') && !(value.prototype instanceof Error);
}

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
 * The harness's modules, the fence's population, by path.
 *
 * @returns {Promise<Readonly<Record<string, string>>>} Each of the harness's modules' source, by path.
 */
async function fenced(): Promise<Readonly<Record<string, string>>> {
  const texts = await textsOf(harnessModules(await population()));
  return Object.fromEntries(texts);
}

/** An undeclared list, consulted: what the fence refuses wherever it is planted in the harness's code. */
const PLANTED_LIST = "\nconst PLANTED = ['a', 'b'];\nexport const planted = (x: string): boolean => PLANTED.includes(x);\n";

/** A directory directly under `harness/`, as a listed path starts. */
const HARNESS_DIRECTORY = /^harness\/[^/]+\//u;

/**
 * A module of each directory of the harness's code, read from git's listing rather than the fence's
 * population: the first TypeScript module of each directory under `harness/`, and each root
 * configuration module. A population that leaves a directory out leaves its module out of the fence.
 *
 * @returns {Promise<readonly string[]>} The modules, by path.
 */
async function plantSites(): Promise<readonly string[]> {
  const first = new Map<string, string>();
  const listed = await tracked();
  for (const file of listed.filter((path) => isTypeScript(path))) {
    const [directory] = HARNESS_DIRECTORY.exec(file) ?? [];
    if (directory !== undefined && !first.has(directory)) {
      first.set(directory, file);
    }
  }
  return [...first.values(), ...ROOT_MODULES].toSorted(byCodeUnit);
}

/**
 * The modules with the planted list appended to each of `sites`.
 *
 * @param {Readonly<Record<string, string>>} modules - Each module's source, by path.
 * @param {readonly string[]} sites - The modules to plant in.
 * @returns {Readonly<Record<string, string>>} The planted modules' sources, by path.
 */
function withPlants(modules: Readonly<Record<string, string>>, sites: readonly string[]): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(modules).map(([path, text]: readonly [string, string]) => [
      path,
      sites.includes(path) ? `${text}${PLANTED_LIST}` : text,
    ]),
  );
}

describe('the repository', () => {
  test('every consulted list is declared and every declaration is consulted', async ({ expect }) => {
    expect.hasAssertions();
    const found = await findings(await fenced());
    expect(ADOPTING.unexemptedBy(found, keyOf)).toStrictEqual([]);
  });

  test("an undeclared list planted in a module of each directory of the harness's code is refused there", async ({ expect }) => {
    expect.hasAssertions();
    const [modules, sites] = await Promise.all([fenced(), plantSites()]);
    expect(sites.filter((path) => !Object.hasOwn(modules, path))).toStrictEqual([]);
    const found = ADOPTING.unexemptedBy(await findings(withPlants(modules, sites)), keyOf);
    expect(found.toSorted((left, right) => byCodeUnit(left.path, right.path))).toStrictEqual(
      sites.map((path) => ({ name: 'PLANTED', path, problem: UNDECLARED })),
    );
  });
});

/** A record keyed by words, each with its facts, consulted each way a check can: undeclared, so refused. */
const RAW_WORDS = "type Word = 'a' | 'b';\nconst WORDS: Readonly<Record<Word, { x: boolean }>> = { a: { x: true }, b: { x: false } };\n";

describe('a vocabulary', () => {
  test('declared as a Vocabulary and read, passes', async ({ expect }) => {
    expect.hasAssertions();
    const source =
      'const WORDS = new Vocabulary({ a: { x: true }, b: { x: false } });\nexport const facts = (word: string) => (WORDS.has(word) ? WORDS.of(word) : undefined);';
    await expect(findings({ [PLANT]: source })).resolves.toStrictEqual([]);
  });

  test.for([
    ['in', 'export const has = (word: string) => word in WORDS;'],
    ['an index', "export const facts = (word: 'a' | 'b') => WORDS[word].x;"],
    ['Object.hasOwn', 'export const has = (word: string) => Object.hasOwn(WORDS, word);'],
  ] as const)('kept as a raw record and consulted by %s, is refused', async ([_name, consult], { expect }) => {
    expect.hasAssertions();
    await expect(findings({ [PLANT]: `${RAW_WORDS}${consult}` })).resolves.toStrictEqual([
      { name: 'WORDS', path: PLANT, problem: UNDECLARED },
    ]);
  });
});

describe('the fence', () => {
  test.for(CONSULTED_LITERALS)('sees %s', async ([_name, source], { expect }) => {
    expect.hasAssertions();
    await expect(findings({ [PLANT]: source })).resolves.toStrictEqual([{ name: 'NAMES', path: PLANT, problem: UNDECLARED }]);
  });

  test.for([
    "const NAMES = ['a', 'b'];\nexport function check() { for (const name of NAMES) { void name; } }",
    "const NAMES = ['a'];\nexport const upper = NAMES.map((name) => name.toUpperCase());",
    "const NAMES = new Accepted(['a']);\nexport const has = NAMES.has('a');",
    'const EXEMPT = Exemptions.grouped({});\nexport function check() { EXEMPT.unexempted([]); }',
    'const COUNTED = new CountedExemptions({});\nexport function check() { COUNTED.assertExact([]); }',
    "const EXEMPT = new Exemptions({ a: 'why' });\nexport function check() { scan(EXEMPT); }",
    "const STARTS = new Prefixes(['a']);\nexport const starts = STARTS.starts('ab');",
    "const NAMES = ['a'];\nfunction helper(values: readonly string[]) { return values.length; }\nexport const n = helper(NAMES);",
    "const cache = new Map<string, number>();\nexport const hit = cache.get('a');",
    "const FIRST = ['a', 'b'];\nexport const first = FIRST[0];",
  ])('lets a declared, iterated or run-time list through: %j', async (source, { expect }) => {
    expect.hasAssertions();
    await expect(findings({ [PLANT]: source })).resolves.toStrictEqual([]);
  });

  test.for([
    ...KINDS.words.map((kind) => UNCONSULTED_PLANTS.of(kind)),
    "const NAME = Exemptions.grouped({ why: ['a'] });\nexport const size = NAME.entries.size;",
  ])('sees a declaration nothing consults: %j', async (source, { expect }) => {
    expect.hasAssertions();
    await expect(findings({ [PLANT]: source })).resolves.toStrictEqual([{ name: 'NAME', path: PLANT, problem: UNCONSULTED }]);
  });

  test.for([
    ['a relative specifier', '../lib/planted.ts', 'harness/lib/planted.ts'],
    ['a subpath pattern', '#lib/planted.ts', 'harness/lib/planted.ts'],
    ['an exact subpath key', '#root/knip.config.ts', 'knip.config.ts'],
  ] as const)('a declaration consulted by a module importing it through %s is live', async ([_name, specifier, path], { expect }) => {
    expect.hasAssertions();
    const owner = "export const EXEMPT = new Exemptions({ a: 'why' });\nexport const NAMES = new Accepted(['a']);\n";
    const user = `import { EXEMPT, NAMES } from '${specifier}';\nexport function check() { EXEMPT.unexempted(['a']); return NAMES.has('a'); }\n`;
    await expect(findings({ [PLANT]: user, [path]: owner })).resolves.toStrictEqual([]);
  });

  test('a stale adopting entry fails', ({ expect }) => {
    expect.hasAssertions();
    const adopting = new Exemptions({ [site(PLANT, 'GONE')]: 'planted' });
    expect(() => adopting.unexemptedBy([], keyOf)).toThrow(StaleExemptionError);
  });
});

describe('the fence across modules', () => {
  test.for([
    [
      'a namespace import',
      "import * as owner from '#lib/planted.ts';\nexport function check() { owner.EXEMPT.unexempted(['a']); return owner.NAMES.has('a'); }\n",
    ],
    [
      'a literal import()',
      "export async function check() { const owner = await import('#lib/planted.ts'); owner.EXEMPT.unexempted(['a']); return owner.NAMES.has('a'); }\n",
    ],
    [
      'a destructured import()',
      "export async function check() { const { EXEMPT, NAMES } = await import('#lib/planted.ts'); EXEMPT.unexempted(['a']); return NAMES.has('a'); }\n",
    ],
    [
      'a re-export then an import',
      "import { EXEMPT, NAMES } from '#lib/relay.ts';\nexport function check() { EXEMPT.unexempted(['a']); return NAMES.has('a'); }\n",
    ],
  ] as const)('a declaration consulted through %s is live', async ([_name, user], { expect }) => {
    expect.hasAssertions();
    const owner = "export const EXEMPT = new Exemptions({ a: 'why' });\nexport const NAMES = new Accepted(['a']);\n";
    const relay = "export { EXEMPT, NAMES } from './planted.ts';\n";
    await expect(findings({ [PLANT]: user, 'harness/lib/planted.ts': owner, 'harness/lib/relay.ts': relay })).resolves.toStrictEqual([]);
  });

  test('a declaration only imported, re-exported or destructured, and never consulted, is stale', async ({ expect }) => {
    expect.hasAssertions();
    const owner = "export const EXEMPT = new Exemptions({ a: 'why' });\n";
    const user =
      "import * as owner from '#lib/planted.ts';\nexport { EXEMPT } from '#lib/planted.ts';\nexport async function check() { const { EXEMPT: local } = await import('#lib/planted.ts'); return [owner.EXEMPT.entries, local.entries]; }\n";
    await expect(findings({ [PLANT]: user, 'harness/lib/planted.ts': owner })).resolves.toStrictEqual([
      { name: 'EXEMPT', path: 'harness/lib/planted.ts', problem: UNCONSULTED },
    ]);
  });
});

describe('the declaration kinds', () => {
  test('knows every declaration kind the exemption owner exports, and no other class it exports', async ({ expect }) => {
    expect.hasAssertions();
    const exemptions: Readonly<Record<string, unknown>> = await import('#lint-rules/exemptions.ts');
    const classes = Object.entries(exemptions)
      .filter(([, value]: readonly [string, unknown]) => isDeclarationClass(value))
      .map(([name]: readonly [string, unknown]) => name)
      .toSorted();
    expect(classes).toStrictEqual([...KINDS.words].toSorted());
  });
});

export { HARNESS_ID };
