/**
 * `tsc`, under this project's settings, fails each planted typing hole a setting closes, and passes it once that setting is removed.
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

import { PLANTS, SHAPES, TSC_DEFAULT } from './typecheck-settings.plants.ts';
import { describe, expect, test } from 'vitest';
import { isTypeScript, textsOf, tracked } from '#lib/source-files.ts';
import { HARNESS_LINT_RULES } from '#lib/test-globs.ts';
import { Project } from '#lib/tools.ts';
import type { Setting } from './typecheck-settings.plants.ts';

const HARNESS_ID = 'typecheck-settings';

/** The exemptions owner and the modules it re-exports, by their paths under the lint-rules package up to their kind. */
const EXEMPTIONS_MODULE = /^exemptions(?:\/[^/.]+)?\.[^/]+$/u;

const SUPPORT: Readonly<Record<string, string>> = {
  'src/clean.ts': 'export function double(value: number): number {\n  return value * 2;\n}\n',
  'src/types.ts': 'export type Shape = { readonly kind: string };\n',
};

const DIAGNOSTIC = /^(?<file>src\/[\w.-]+)\(\d+,\d+\): error (?<code>TS\d+):/u;

/**
 * The diagnostic codes of a tsc run, by planted file.
 *
 * @param {string} stdout - The stdout.
 * @returns {ReadonlyMap<string, readonly string[]>} The diagnostic codes of a tsc run, by planted file.
 */
function codesByFile(stdout: string): ReadonlyMap<string, readonly string[]> {
  const found = new Map<string, string[]>();
  for (const line of stdout.split('\n')) {
    const groups = DIAGNOSTIC.exec(line)?.groups;
    const file = groups?.['file'];
    const code = groups?.['code'];
    if (file !== undefined && code !== undefined) {
      found.set(file, [...new Set([...(found.get(file) ?? []), code])].toSorted());
    }
  }
  return found;
}

/**
 * The planted `tsconfig.json`: the base config with `overrides` applied, a reset setting written as JSON `null`.
 *
 * @param {Readonly<Record<string, Setting>>} overrides - The settings to override.
 * @returns {string} The config's text.
 */
function plantedConfig(overrides: Readonly<Record<string, Setting>>): string {
  const config = {
    compilerOptions: { allowImportingTsExtensions: true, types: [], ...overrides },
    extends: './tsconfig.base.json',
    include: ['src'],
  };
  return JSON.stringify(config).replaceAll(JSON.stringify(TSC_DEFAULT), 'null');
}

/**
 * Write every plant, its support and the planted config into a project.
 *
 * @param {Project} project - The planted project.
 * @param {Readonly<Record<string, Setting>>} overrides - The settings to override.
 * @returns {Promise<void>} Settles once every file is written.
 */
async function plantAll(project: Project, overrides: Readonly<Record<string, Setting>>): Promise<void> {
  const listed = await tracked();
  const libraries = await textsOf(
    listed.filter(
      (candidate) =>
        isTypeScript(candidate) &&
        candidate.startsWith(HARNESS_LINT_RULES) &&
        EXEMPTIONS_MODULE.test(candidate.slice(HARNESS_LINT_RULES.length)),
    ),
  );
  const files: readonly (readonly [string, string])[] = [
    [
      'node_modules/@typescript/lib-dom/package.json',
      JSON.stringify({ name: '@typescript/lib-dom', types: 'index.d.ts', version: '0.0.0' }),
    ],
    ['node_modules/@typescript/lib-dom/index.d.ts', 'declare const replacedLib: number;\n'],
    ...libraries.map(([path, text]: readonly [string, string]) => [`src/${path.slice(HARNESS_LINT_RULES.length)}`, text] as const),
    ...Object.entries(SUPPORT),
    ...[...PLANTS, ...SHAPES].map((plant) => [plant.path, plant.text] as const),
    ['tsconfig.json', plantedConfig(overrides)],
  ];
  await project.writeAll(files);
}

/**
 * Run the locked tsc over every plant under the base config with `overrides` applied.
 *
 * @param {Readonly<Record<string, Setting>>} overrides - The settings to override.
 * @returns {Promise<ReadonlyMap<string, readonly string[]>>} The diagnostic codes, by planted file.
 */
async function typecheck(overrides: Readonly<Record<string, Setting>>): Promise<ReadonlyMap<string, readonly string[]>> {
  const project = await Project.create({ copies: ['tsconfig.base.json'], linkModules: false });
  try {
    await plantAll(project, overrides);
    const done = await project.tool('tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false');
    const configErrors = done.stdout.split('\n').filter((line) => line.startsWith('tsconfig.json'));
    if (configErrors.some(Boolean)) {
      throw new Error(`the planted config is refused: ${configErrors.join('; ')}`);
    }
    return codesByFile(done.stdout);
  } finally {
    await project.remove();
  }
}

/**
 * The codes a run reports for one plant.
 *
 * @param {ReadonlyMap<string, readonly string[]>} found - A run's codes, by planted file.
 * @param {string} path - The plant.
 * @returns {readonly string[]} Its codes, none when the run reported nothing for it.
 */
function codesOf(found: ReadonlyMap<string, readonly string[]>, path: string): readonly string[] {
  return found.get(path) ?? [];
}

describe('the base config', () => {
  test('fails each planted hole with its own diagnostic and passes the clean plant', async () => {
    expect.hasAssertions();
    const found = await typecheck({});
    const plants = [...PLANTS, ...SHAPES];
    expect(Object.fromEntries(plants.map((plant) => [plant.path, codesOf(found, plant.path)]))).toStrictEqual(
      Object.fromEntries(plants.map((plant) => [plant.path, plant.codes])),
    );
    expect([found.get('src/clean.ts'), found.get('src/types.ts')]).toStrictEqual([undefined, undefined]);
  });
});

describe('each setting', () => {
  test.for(PLANTS)('is what fails $path: removing it lets the plant through', async (plant) => {
    expect.hasAssertions();
    const removed = await typecheck(plant.removal);
    expect(codesOf(removed, plant.path)).toStrictEqual([]);
  });

  test('isolatedModules is implied by verbatimModuleSyntax: removing it alone keeps its plant failing', async () => {
    expect.hasAssertions();
    const relaxed = await typecheck({ isolatedModules: false });
    expect(relaxed.get('src/isolated.ts')).toStrictEqual(['TS1205']);
  });
});

export { HARNESS_ID };
