/**
 * The planted files of the `lint-settings` check: each a violation of one rule the harness rests on,
 * written to break no other rule of the config, so that the codes oxlint reports for it are exactly its own.
 */

/** The code oxlint's JSON report gives an unused disable directive, which carries no rule code. */
const UNUSED_DIRECTIVE = 'unused-disable-directive';

const UNUSED_DIRECTIVE_TEXT = "// oxlint-disable-next-line no-console\nexport const value = 'a';\n";
const ESLINT_DIRECTIVE_TEXT = "export function say(): void {\n  // eslint-disable-next-line no-console\n  console.log('x');\n}\n";

/**
 * A test module whose one test is declared with `declare` (`test.skip`, `test.only`), clean but for that.
 *
 * @param {string} declare - The test function's form.
 * @returns {string} The module's text.
 */
function plantedTest(declare: string): string {
  return [
    "import { describe, expect, test } from 'vitest';",
    '',
    "describe('a', () => {",
    `  ${declare}('b', () => {`,
    '    expect.hasAssertions();',
    "    expect('c').toBe('c');",
    '  });',
    '});',
    '',
  ].join('\n');
}

/** Each plant's text and the rule codes oxlint must report for it, exactly. */
const PLANTS: Readonly<Record<string, readonly [string, readonly string[]]>> = {
  'src/clean.ts': ['export function double(value: number): number {\n  return value + value;\n}\n', []],
  'src/console.ts': ["export function say(): void {\n  console.log('x');\n}\n", ['eslint(no-console)']],
  'src/default-lookup.ts': [
    "const NAMES: Readonly<Record<'one' | 'two', string>> = { one: 'A', two: 'B' };\n\nexport function name(kind: 'one' | 'two'): string {\n  return NAMES[kind] ?? '';\n}\n",
    ['aricanga(own-keys)', 'typescript(no-unnecessary-condition)'],
  ],
  'src/destructure.tsx': [
    'export function Bubble({ vm }: { readonly vm: { readonly text: string } }): unknown {\n  return <p>{vm.text}</p>;\n}\n',
    ['aricanga(vm-prop)', 'solid(no-destructure)'],
  ],
  'src/disabled.test.ts': [plantedTest('test.skip'), ['vitest(no-disabled-tests)']],
  'src/eslint-directive.ts': [ESLINT_DIRECTIVE_TEXT, ['eslint(no-console)']],
  'src/expect-described.ts': ['// @ts-expect-error: the planted mismatch this check needs\nexport const value: string = true;\n', []],
  'src/explicit-any.ts': ["export const value: any = 'a';\n", ['typescript(no-explicit-any)']],
  'src/floating.ts': [
    'async function work(): Promise<void> {\n  await Promise.resolve();\n}\nexport function start(): void {\n  work();\n}\n',
    ['typescript(no-floating-promises)'],
  ],
  'src/focused.test.ts': [plantedTest('test.only'), ['vitest(no-focused-tests)']],
  'src/narrowed.ts': [
    "export function kind(raw: string): 'a' | 'b' {\n  return raw as 'a' | 'b';\n}\n",
    ['typescript(no-unsafe-type-assertion)'],
  ],
  'src/switch-default.ts': [
    "export function name(kind: 'a' | 'b'): string {\n  switch (kind) {\n    case 'a': {\n      return 'A';\n    }\n    default: {\n      return '';\n    }\n  }\n}\n",
    ['typescript(switch-exhaustiveness-check)'],
  ],
  'src/switch.ts': [
    "export function name(kind: 'a' | 'b'): string {\n  switch (kind) {\n    case 'a': {\n      return 'A';\n    }\n    // No default\n  }\n  return '';\n}\n",
    ['typescript(switch-exhaustiveness-check)'],
  ],
  'src/ts-expect-bare.ts': ['// @ts-expect-error\nexport const value: string = true;\n', ['typescript(ban-ts-comment)']],
  'src/ts-ignore.ts': ["// @ts-ignore\nexport const value = 'a';\n", ['typescript(ban-ts-comment)', 'typescript(prefer-ts-expect-error)']],
  'src/type-import.ts': [
    "import { Shape } from './types';\n\nexport const shape: Shape = { kind: 'a' };\n",
    ['typescript(consistent-type-imports)'],
  ],
  'src/types.ts': ['export interface Shape {\n  readonly kind: string;\n}\n', []],
  'src/unsafe-argument.ts': [
    "function twice(value: number): number {\n  return value + value;\n}\nexport const result = twice(JSON.parse('1'));\n",
    ['typescript(no-unsafe-argument)'],
  ],
  'src/unsafe-assignment.ts': ["export const value: number = JSON.parse('1');\n", ['typescript(no-unsafe-assignment)']],
  'src/unsafe-call.ts': ["export function call(): void {\n  JSON.parse('{}')();\n}\n", ['typescript(no-unsafe-call)']],
  'src/unsafe-member.ts': [
    "export function read(): string {\n  return String(JSON.parse('{}').field);\n}\n",
    ['typescript(no-unsafe-member-access)'],
  ],
  'src/unsafe-return.ts': ["export function read(): number {\n  return JSON.parse('1');\n}\n", ['typescript(no-unsafe-return)']],
  'src/unused-directive.ts': [UNUSED_DIRECTIVE_TEXT, [UNUSED_DIRECTIVE]],
};

const WARNING_PLANT = 'src/warning.ts';
const WARNING_TEXT = 'export function stop(): void {\n  debugger;\n}\n';

export { ESLINT_DIRECTIVE_TEXT, PLANTS, UNUSED_DIRECTIVE, UNUSED_DIRECTIVE_TEXT, WARNING_PLANT, WARNING_TEXT };
