/**
 * tsc, under this project's settings, fails each planted typing hole a setting closes, and passes it once that setting is removed.
 *
 * Each run is the locked tsc over a planted project holding a copy of `tsconfig.base.json`. Every
 * plant is a file that must fail with its own diagnostic under the base config, and pass when only
 * the setting it rests on is turned off or, for `allowUnreachableCode` and `allowUnusedLabels`,
 * reset to tsc's default (`null`), which reports without failing (`exactOptionalPropertyTypes` goes
 * with `strictNullChecks`, which tsc refuses it without). `skipLibCheck: false` is held by a broken
 * declaration file, `isolatedDeclarations` by an exported constant whose type tsc must infer, and
 * `libReplacement: false` by a planted @typescript/lib-dom package the plant can only see when it is on. `isolatedModules` is implied by `verbatimModuleSyntax`: its plant
 * passes only when both are off, and the check holds that redundancy. Two plants hold the
 * exemption declarations' shapes: a membership test on `Prefixes` and a prefix match on `Accepted`
 * are type errors. The clean plant must pass.
 */

import { describe, expect, test } from 'vitest';
import { Project } from '#lib/tools.ts';
import { textOf } from '#lib/source-files.ts';

const HARNESS_ID = 'typecheck-settings';

interface Plant {
  readonly path: string;
  readonly text: string;
  readonly codes: readonly string[];
  readonly removal: Readonly<Record<string, boolean | null>>;
}

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
    removal: { allowUnreachableCode: null },
    text: 'export function one(): number {\n  return 1;\n  console.log("never");\n}\n',
  },
  {
    codes: ['TS7028'],
    path: 'src/unused-label.ts',
    removal: { allowUnusedLabels: null },
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
];

const SUPPORT: Readonly<Record<string, string>> = {
  'src/clean.ts': 'export function double(value: number): number {\n  return value * 2;\n}\n',
  'src/types.ts': 'export type Shape = { readonly kind: string };\n',
};

const DIAGNOSTIC = /^(src\/[\w.-]+)\(\d+,\d+\): error (TS\d+):/u;

/** The diagnostic codes of a tsc run, by planted file. */
function codesByFile(stdout: string): ReadonlyMap<string, readonly string[]> {
  const found = new Map<string, string[]>();
  for (const line of stdout.split('\n')) {
    const match = DIAGNOSTIC.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      found.set(match[1], [...new Set([...(found.get(match[1]) ?? []), match[2]])].toSorted());
    }
  }
  return found;
}

/** Run the locked tsc over every plant under the base config with `overrides` applied. */
function typecheck(overrides: Readonly<Record<string, boolean | null>>): ReadonlyMap<string, readonly string[]> {
  const project = new Project({ copies: ['tsconfig.base.json'], linkModules: false });
    project.write('node_modules/@typescript/lib-dom/package.json', JSON.stringify({ name: '@typescript/lib-dom', types: 'index.d.ts', version: '0.0.0' }));
    project.write('node_modules/@typescript/lib-dom/index.d.ts', 'declare const replacedLib: number;\n');
  try {
    project.write('src/exemptions.ts', textOf('harness/lib/exemptions.ts'));
    for (const [path, text] of Object.entries(SUPPORT)) {
      project.write(path, text);
    }
    for (const plant of [...PLANTS, ...SHAPES]) {
      project.write(plant.path, plant.text);
    }
    project.write(
      'tsconfig.json',
      JSON.stringify({
        compilerOptions: { allowImportingTsExtensions: true, types: [], ...overrides },
        extends: './tsconfig.base.json',
        include: ['src'],
      }),
    );
    const done = project.tool('tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false');
    const configErrors = done.stdout.split('\n').filter((line) => line.startsWith('tsconfig.json'));
    if (configErrors.length > 0) {
      throw new Error(`the planted config is refused: ${configErrors.join('; ')}`);
    }
    return codesByFile(done.stdout);
  } finally {
    project.remove();
  }
}

describe('the base config', () => {
  test('fails each planted hole with its own diagnostic and passes the clean plant', () => {
    expect.hasAssertions();
    const found = typecheck({});
    const plants = [...PLANTS, ...SHAPES];
    expect(Object.fromEntries(plants.map((plant) => [plant.path, found.get(plant.path) ?? []]))).toStrictEqual(
      Object.fromEntries(plants.map((plant) => [plant.path, plant.codes])),
    );
    expect([found.get('src/clean.ts'), found.get('src/types.ts')]).toStrictEqual([undefined, undefined]);
  });
});

describe('each setting', () => {
  test.for(PLANTS)('is what fails $path: removing it lets the plant through', (plant) => {
    expect(typecheck(plant.removal).get(plant.path) ?? []).toStrictEqual([]);
  });

  test('isolatedModules is implied by verbatimModuleSyntax: removing it alone keeps its plant failing', () => {
    expect.hasAssertions();
    expect(typecheck({ isolatedModules: false }).get('src/isolated.ts')).toStrictEqual(['TS1205']);
  });
});

export { HARNESS_ID, codesByFile };
