/** What the `typecheck-settings` check plants: each typing hole a setting closes, and the shapes the exemptions owner refuses. */

interface Plant {
  readonly path: string;
  readonly text: string;
  readonly codes: readonly string[];
  readonly removal: Readonly<Record<string, Setting>>;
}

/** A setting's value in a planted config: on, off, or reset to tsc's own default. */
type Setting = boolean | typeof TSC_DEFAULT;

/** A setting reset to tsc's default, written into the planted config as JSON `null`. */
const TSC_DEFAULT = 'tsc-default';

const WITHOUT_NULL_CHECKS = { exactOptionalPropertyTypes: false };

const PLANTS: readonly Plant[] = [
  {
    codes: ['TS7006'],
    path: 'src/implicit-any.ts',
    removal: { noImplicitAny: false },
    text: 'function echo(value) {\n  return value;\n}\nexport const echoed: unknown = echo(1);\n',
  },
  {
    codes: ['TS2322'],
    path: 'src/null-check.ts',
    removal: { strictNullChecks: false, ...WITHOUT_NULL_CHECKS },
    text: 'export const name: string = null;\n',
  },
  {
    codes: ['TS18046'],
    path: 'src/catch-unknown.ts',
    removal: { useUnknownInCatchVariables: false },
    text: 'export function message(): string {\n  try {\n    return "ok";\n  } catch (error) {\n    return error.message;\n  }\n}\n',
  },
  {
    codes: ['TS2322'],
    path: 'src/indexed.ts',
    removal: { noUncheckedIndexedAccess: false },
    text: 'const names: string[] = [];\nexport const first: string = names[0];\n',
  },
  {
    codes: ['TS2375'],
    path: 'src/exact-optional.ts',
    removal: { exactOptionalPropertyTypes: false },
    text: 'interface Options {\n  readonly label?: string;\n}\nexport const options: Options = { label: undefined };\n',
  },
  {
    codes: ['TS7030'],
    path: 'src/implicit-returns.ts',
    removal: { noImplicitReturns: false },
    text: 'export function pick(flag: boolean): number | undefined {\n  if (flag) {\n    return 1;\n  }\n}\n',
  },
  {
    codes: ['TS7029'],
    path: 'src/fallthrough.ts',
    removal: { noFallthroughCasesInSwitch: false },
    text: 'export function score(n: number): number {\n  let result = 0;\n  switch (n) {\n    case 0:\n      result = 1;\n    case 1:\n      result = 2;\n      break;\n  }\n  return result;\n}\n',
  },
  {
    codes: ['TS4114'],
    path: 'src/override.ts',
    removal: { noImplicitOverride: false },
    text: 'class Base {\n  run(): void {}\n}\nexport class Child extends Base {\n  run(): void {}\n}\n',
  },
  {
    codes: ['TS1484'],
    path: 'src/verbatim.ts',
    removal: { verbatimModuleSyntax: false },
    text: 'import { Shape } from "./types";\nexport const shape: Shape = { kind: "a" };\n',
  },
  {
    codes: ['TS1205'],
    path: 'src/isolated.ts',
    removal: { isolatedModules: false, verbatimModuleSyntax: false },
    text: 'export { Shape } from "./types";\n',
  },
  {
    codes: ['TS4111'],
    path: 'src/index-signature.ts',
    removal: { noPropertyAccessFromIndexSignature: false },
    text: 'const bag: Record<string, number> = {};\nexport const count: number | undefined = bag.count;\n',
  },
  {
    codes: ['TS6133'],
    path: 'src/unused-local.ts',
    removal: { noUnusedLocals: false },
    text: 'const unused = 1;\nexport const used = 2;\n',
  },
  {
    codes: ['TS6133'],
    path: 'src/unused-parameter.ts',
    removal: { noUnusedParameters: false },
    text: 'export function keep(value: number, extra: number): number {\n  return value;\n}\n',
  },
  {
    codes: ['TS7027'],
    path: 'src/unreachable.ts',
    removal: { allowUnreachableCode: TSC_DEFAULT },
    text: 'export function one(): number {\n  return 1;\n  console.log("never");\n}\n',
  },
  {
    codes: ['TS7028'],
    path: 'src/unused-label.ts',
    removal: { allowUnusedLabels: TSC_DEFAULT },
    text: 'export function loop(): void {\n  outer: for (;;) {\n    break;\n  }\n}\n',
  },
  {
    codes: ['TS2882'],
    path: 'src/side-effect.ts',
    removal: { noUncheckedSideEffectImports: false },
    text: "import './missing-module';\nexport const loaded = true;\n",
  },
  {
    codes: ['TS2304'],
    path: 'src/broken.d.ts',
    removal: { skipLibCheck: true },
    text: 'export declare const value: Missing;\n',
  },
  {
    codes: ['TS9010'],
    path: 'src/declarations.ts',
    removal: { isolatedDeclarations: false },
    text: 'function make(): { readonly size: number } {\n  return { size: 1 };\n}\nexport const made = make();\n',
  },
  {
    codes: ['TS2552'],
    path: 'src/lib-replacement.ts',
    removal: { libReplacement: true },
    text: 'export const replaced: number = replacedLib;\n',
  },
  {
    codes: ['TS1294'],
    path: 'src/erasable.ts',
    removal: { erasableSyntaxOnly: false },
    text: 'export enum Colour {\n  Red,\n}\n',
  },
];

const SHAPES: readonly Plant[] = [
  {
    codes: ['TS2339'],
    path: 'src/prefixes-membership.ts',
    removal: {},
    text: 'import { Prefixes } from "./exemptions.ts";\nexport const found: boolean = new Prefixes(["a"]).has("a");\n',
  },
  {
    codes: ['TS2339'],
    path: 'src/accepted-prefix.ts',
    removal: {},
    text: 'import { Accepted } from "./exemptions.ts";\nexport const found: boolean = new Accepted(["a"]).starts("ab");\n',
  },
  ...[
    ['open', 'declare const facts: Readonly<Record<string, string>>;\nexport const words: unknown = new Vocabulary(facts);\n'],
    [
      'pattern',
      'declare const facts: Readonly<Record<Lowercase<string>, string>>;\nexport const words: unknown = new Vocabulary(facts);\n',
    ],
    ['optional', 'declare const facts: Readonly<{ word?: string }>;\nexport const words: unknown = new Vocabulary(facts);\n'],
    ['function', 'export const words: unknown = new Vocabulary({ word: () => 1 });\n'],
    ['map', 'export const words: unknown = new Vocabulary({ word: new Map<string, string>() });\n'],
    [
      'instance',
      'import { Accepted } from "./exemptions.ts";\nexport const words: unknown = new Vocabulary({ word: new Accepted(["a"]) });\n',
    ],
    ['symbol', 'const key = Symbol("k");\nexport const words: unknown = new Vocabulary({ word: { [key]: { note: "a" } } });\n'],
  ].map(([shape = '', text = '']: readonly string[]): Plant => ({
    codes: ['TS2345'],
    path: `src/vocabulary-${shape}.ts`,
    removal: {},
    text: `import { Vocabulary } from "./exemptions.ts";\n${text}`,
  })),
];

export { PLANTS, SHAPES, TSC_DEFAULT };
export type { Setting };
