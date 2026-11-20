/**
 * A contract union is never widened to `string`, and its words are not respelled outside its owner.
 *
 * The contracts are derived from the kernel's exported unions (harness/lib/contracts.ts). A
 * contract-typed value whose contextual type is `string` (a declaration, an argument, a return, a
 * property) is widened; `as string` asserts it away. In a module that reaches the contract's package,
 * a contract's word written as a bare string, neither contextually typed by its union nor compared
 * with a value of it (by `===`, `case`, or an expectation on it), is respelled; the module owning a
 * contract may spell its words.
 */

import { describe, expect, test } from 'vitest';

import { type Scan, scannedFiles, sourceOf } from '../lib/checker.ts';
import { type Contract, contracts, type ContractSite, respellings, widenings } from '../lib/contracts.ts';
import { Accepted } from '../lib/exemptions.ts';
import { usePlanted, useScan } from '../lib/scan-hooks.ts';

export const HARNESS_ID = 'contract-widening';

/** The closed sets of ADR-0007 the derivation must see, or the check holds nothing. */
const ALGEBRA = new Accepted(["Input['source']", 'EffectFamily', "Resume['kind']", "Lifecycle['kind']", 'KernelStatus']);

const OWNER = 'packages/foundation/src/__contract_owner.ts';
const IMPORT = "import type { Mode, Msg } from '../foundation/src/__contract_owner';\n";
const PICK = "declare const m: Mode;\ndeclare const x: Msg;\n";

const PLANTS: readonly (readonly [string, ContractSite['form'], string])[] = [
  ['const s: string = m;\nexport { s };\n', 'widened', 'Mode'],
  ['function take(s: string): number {\n  return s.length;\n}\ntake(m);\n', 'widened', 'Mode'],
  ['export function f(): string {\n  return m;\n}\n', 'widened', 'Mode'],
  ['export const o: { label: string } = { label: m };\n', 'widened', 'Mode'],
  ['export const s = m as string;\n', 'asserted', 'Mode'],
  ["export const s: string = x.tag;\n", 'widened', "Msg['tag']"],
];

const RESPELLED: readonly (readonly [string, string])[] = [
  ['packages/systems/__respell_0.ts', `${IMPORT}export const w = 'on';\n`],
  ['packages/systems/__respell_1.ts', `${IMPORT}export function g(s: string): boolean {\n  return s === 'off';\n}\n`],
  ['packages/foundation/src/__respell_2.ts', "export function h(s: string): number {\n  switch (s) {\n    case 'ping':\n      return 1;\n  }\n  return 0;\n}\n"],
];

const NEAR_MISSES: readonly (readonly [string, string])[] = [
  ['packages/systems/__miss_contextual.ts', `${IMPORT}export const a: Mode = 'on';\nexport const b: Msg = { tag: 'ping' };\n`],
  ['packages/systems/__miss_compared.ts', `${IMPORT}${PICK}export const on = m === 'off';\nexport function s(): number {\n  switch (m) {\n    case 'on':\n      return 1;\n    default:\n      return 0;\n  }\n}\n`],
  ['packages/systems/__miss_template.ts', `${IMPORT}${PICK}export const label = \`mode \${m}\`;\n`],
  ['packages/systems/__miss_generic.ts', `${IMPORT}${PICK}function id<T extends string>(value: T): T {\n  return value;\n}\nexport const same = id(m);\n`],
  ['packages/systems/__miss_unreached.ts', "export const word = 'on';\n"],
  ['packages/systems/__miss_expectation.ts', `${IMPORT}${PICK}declare function expect(value: unknown): { toBe(expected: unknown): void; toEqual(expected: unknown): void };\nexpect(m).toBe('on');\nexpect({ x }).toEqual({ x: { tag: 'ping' } });\n`],
];

const plants = new Map<string, string>([
  [
    OWNER,
    "export type Mode = 'on' | 'off';\nexport type Msg = { readonly tag: 'ping' } | { readonly tag: 'pong'; readonly n: number };\nexport const DEFAULT = 'on';\n",
  ],
]);
PLANTS.forEach(([body], index) => {
  plants.set(`packages/systems/__widen_${index}.ts`, `${IMPORT}${PICK}${body}`);
});
for (const [path, text] of [...RESPELLED, ...NEAR_MISSES]) {
  plants.set(path, text);
}

const plantedScan = usePlanted(plants);
const repoScan = useScan();
const planted = (): readonly Contract[] => contracts(plantedScan(), [OWNER]);

function lost(scan: Scan, known: readonly Contract[], path: string): ContractSite[] {
  const file = sourceOf(scan, path);
  return [...widenings(scan, file, known), ...respellings(scan, file, known)];
}

describe('the repository', () => {
  test('the derivation sees the algebra', () => {
    const names = new Set(contracts(repoScan(), scannedFiles()).map((contract) => contract.name));
    expect([...ALGEBRA].filter((name) => !names.has(name))).toEqual([]);
  });

  test('no contract is widened or respelled', () => {
    const known = contracts(repoScan(), scannedFiles());
    const found = scannedFiles().flatMap((path) => lost(repoScan(), known, path));
    expect(found).toEqual([]);
  });
});

describe('the scan', () => {
  test('derives a literal union and a discriminant', () => {
    expect(planted().map((contract) => [contract.name, [...contract.words].toSorted()])).toEqual([
      ['Mode', ['off', 'on']],
      ["Msg['tag']", ['ping', 'pong']],
    ]);
  });

  test.each(PLANTS.map(([body, form, contract], index) => [index, form, contract, body] as const))(
    'sees planted widening %i (%s %s)',
    (index, form, contract) => {
      const found = lost(plantedScan(), planted(), `packages/systems/__widen_${index}.ts`);
      expect(found.map((entry) => [entry.form, entry.contract])).toEqual([[form, contract]]);
    },
  );

  test.each(RESPELLED.map(([path]) => path))('sees the planted respelling in %s', (path) => {
    expect(lost(plantedScan(), planted(), path).map((entry) => entry.form)).toEqual(['respelled']);
  });

  test.each([...NEAR_MISSES.map(([path]) => path), OWNER])('lets the near miss %s through', (path) => {
    expect(lost(plantedScan(), planted(), path)).toEqual([]);
  });
});
