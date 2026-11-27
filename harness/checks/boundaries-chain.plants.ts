/** The whole chain's planted forms (F1b2-R1): the plants of every form, spelling and importer kind, each importer with what the chain finds there; its cases are in `boundaries-cases.plants.ts`. */

import path from 'node:path';

/**
 * A planted file of the whole chain: where it sits, its text, and, for an importer, what the chain finds
 * there: the held non-production files it reports as loaded (`loads`) or as answered only by test
 * support's declarations (`declares`), that it refuses the module (`refused`), or that it passes it (`passes`).
 */
interface ChainPlant {
  readonly path: string;
  readonly text: string;
  readonly loads?: readonly string[];
  readonly declares?: readonly string[];
  readonly refused?: true;
  /** The one refusal the importer gets, where the plant states it. */
  readonly refusedAs?: string;
  readonly passes?: true;
}

const SANDBOX = 'experiences/sandbox/';
const FOUNDATION = 'packages/foundation/';
const INFRASTRUCTURE = 'packages/characterisation/';

/** A module's text exporting a value and a type. */
const MODULE = 'export const v = 1;\nexport type X = number;\n';

/** A script's text: no import, no export. */
const SCRIPT = "(globalThis as Record<string, unknown>)['planted'] = 1;\n";

/** A stylesheet's text. */
const SHEET = '.a { color: red; }\n';

/** Where a loaded form's text names its target. */
const SPECIFIER = 'SPECIFIER';

/**
 * Each form TypeScript loads, written by a member's production module naming its own target in
 * foundation's test support: the form's name, the module's text (its target named at `SPECIFIER`), and
 * the target's text and file name.
 */
const LOADED_FORMS: readonly (readonly [string, string, string, string])[] = [
  ['static', "import { v } from 'SPECIFIER';\nexport const a = v;\n", MODULE, '__chain_static.ts'],
  ['export_from', "export * from 'SPECIFIER';\n", MODULE, '__chain_export_from.ts'],
  ['type_only', "import type { X } from 'SPECIFIER';\nexport type A = X;\n", MODULE, '__chain_type_only.ts'],
  ['dynamic_literal', "export const a = import('SPECIFIER');\n", MODULE, '__chain_dynamic_literal.ts'],
  ['dynamic_plain_template', 'export const a = import(`SPECIFIER`);\n', MODULE, '__chain_dynamic_plain_template.ts'],
  ['type_position_import', "export type A = import('SPECIFIER').X;\n", MODULE, '__chain_type_position_import.ts'],
  ['typeof_import', "export type A = typeof import('SPECIFIER');\n", MODULE, '__chain_typeof_import.ts'],
  ['import_equals', "import t = require('SPECIFIER');\nexport const a = t;\n", MODULE, '__chain_import_equals.ts'],
  ['json', "import d from 'SPECIFIER' with { type: 'json' };\nexport const a = d;\n", '{ "a": 1 }\n', '__chain_json.json'],
  ['script_target', "import 'SPECIFIER';\nexport const a = 1;\n", SCRIPT, '__chain_script_target.ts'],
  ['reference_path', '/// <reference path="SPECIFIER" />\nexport const a = 1;\n', MODULE, '__chain_reference_path.ts'],
  ['asset_relative', "import 'SPECIFIER';\nexport const a = 1;\n", SHEET, '__chain_asset_relative.css'],
  ['extensionless', "import 'SPECIFIER';\nexport const a = 1;\n", SCRIPT, '__chain_extensionless'],
];

/**
 * The arguments of an `import()` whose specifier is not a literal, by name (card D-P5-1): those Vite
 * bundles (wrapped, asserted, folded, conditional literals), a substituted template, and the computed
 * ones; each planted in a module of its own, refused by the argument's text.
 */
const COMPUTED_IMPORTS: readonly (readonly [string, string])[] = [
  ['substituted_template_import', `\`./testing/\${name}.ts\``],
  ['parenthesised_import', "('./testing/x.ts')"],
  ['asserted_import', "'./testing/x.ts' as string"],
  ['angle_asserted_import', "<string>'./testing/x.ts'"],
  ['non_null_import', "'./testing/x.ts'!"],
  ['satisfies_import', "'./testing/x.ts' satisfies string"],
  ['folded_import', "'./testing/' + 'x.ts'"],
  ['conditional_import', "name === 'x' ? './testing/x.ts' : './testing/y.ts'"],
  ['concatenated_import', "'./testing/' + name + '.ts'"],
  ['concat_call_import', "'./testing/'.concat(name, '.ts')"],
  ['identifier_import', 'where'],
];

/** The texts of the forms the scan cannot read in a production module, by name (V3, js261126-A). */
const UNREAD_FORMS: readonly (readonly [string, string])[] = [
  ...['raw', 'url', 'worker', 'inline', 'no-inline', 'sharedworker', 'init', 'worker&url'].map(
    (query) => [`query_${query.replaceAll(/\W/gu, '_')}`, `import r from './__chain_query.ts?${query}';\nexport const a = r;\n`] as const,
  ),
  ['query_on_package', "import r from '@narratives/foundation/testing?raw';\nexport const a = r;\n"],
  ['meta_glob', "export const a = import.meta.glob('./testing/x');\n"],
  ['new_url', "export const a = new URL('./testing/x.css', import.meta.url);\n"],
  ['new_worker_url', "export const a = new Worker(new URL('./testing/x.ts', import.meta.url));\n"],
  ['meta_url', 'export const a = import.meta.url;\n'],
  ['meta_whole', 'export const a = import.meta;\n'],
  ['meta_hot', 'export const a = import.meta.hot;\n'],
  ['meta_resolve', "export const a = import.meta.resolve('./testing/x.ts');\n"],
  ['asset_bare', "import 'some-package/sheet.css';\nexport const a = 1;\n"],
];

/**
 * The relative specifier from one planted file to another.
 *
 * @param {string} from - The importing file.
 * @param {string} to - The imported file.
 * @returns {string} The specifier.
 */
function relativeSpecifier(from: string, to: string): string {
  const specifier = path.posix.relative(path.posix.dirname(from), to);
  return specifier.startsWith('.') ? specifier : `./${specifier}`;
}

/**
 * A form TypeScript loads, written by a member's production module: the importer and its target.
 *
 * @param {readonly [string, string, string, string]} form - The form's name, text, target's text and target's file name.
 * @returns {readonly ChainPlant[]} The importer and its target.
 */
function loadedForm([name, text, target, file]: readonly [string, string, string, string]): readonly ChainPlant[] {
  const from = `${SANDBOX}src/__chain_${name}.ts`;
  const to = `${FOUNDATION}src/testing/${file}`;
  return [
    { loads: [to], path: from, text: text.replace(SPECIFIER, relativeSpecifier(from, to)) },
    { path: to, text: target },
  ];
}

/** The whole chain's planted forms (F1b2-R1): every form, every spelling, every importer kind. */
const FORM_PLANTS: readonly ChainPlant[] = [
  ...LOADED_FORMS.flatMap((form) => loadedForm(form)),
  ...UNREAD_FORMS.map(([name, text]) => ({ path: `${SANDBOX}src/__chain_${name}.ts`, refused: true, text }) as const),
  ...COMPUTED_IMPORTS.map(
    ([name, argument]) =>
      ({
        path: `${SANDBOX}src/__chain_${name}.ts`,
        refused: true,
        refusedAs: `an import() of a specifier that is not a literal: ${argument}`,
        text: `const where = './testing/x.ts';\nexport const a = async (name: string): Promise<unknown> => import(${argument});\nexport const b = where;\n`,
      }) as const,
  ),
  { path: `${SANDBOX}src/__chain_query.ts`, text: MODULE },
  ...['env', 'dirname', 'filename'].map(
    (member) =>
      ({ passes: true, path: `${SANDBOX}src/__chain_meta_${member}.ts`, text: `export const a = import.meta.${member};\n` }) as const,
  ),
  // A spelling: a `#` alias, an exported subpath and an asset through it, an exact ambient shadow (the harness's `#` alias reaches an asset below).
  {
    loads: [`${SANDBOX}src/testing/__chain_alias.ts`],
    path: `${SANDBOX}src/__chain_alias.ts`,
    text: "export * from '#src/testing/__chain_alias';\n",
  },
  { path: `${SANDBOX}src/testing/__chain_alias.ts`, text: MODULE },
  {
    loads: [`${FOUNDATION}src/testing/__chain_subpath.ts`],
    path: `${SANDBOX}src/__chain_subpath.ts`,
    text: "export * from '@narratives/foundation/testing/__chain_subpath';\n",
  },
  { path: `${FOUNDATION}src/testing/__chain_subpath.ts`, text: MODULE },
  {
    loads: [`${FOUNDATION}src/testing/__chain_subpath_asset.css`],
    path: `${SANDBOX}src/__chain_subpath_asset.ts`,
    text: "import '@narratives/foundation/testing/__chain_subpath_asset.css';\nexport const a = 1;\n",
  },
  { path: `${FOUNDATION}src/testing/__chain_subpath_asset.css`, text: SHEET },
  {
    loads: [`${FOUNDATION}src/testing/__chain_shadowed.ts`],
    path: `${SANDBOX}src/__chain_shadowed.ts`,
    text: "export * from '@narratives/foundation/testing/__chain_shadowed';\n",
  },
  { path: `${FOUNDATION}src/testing/__chain_shadowed.ts`, text: MODULE },
  {
    path: `${SANDBOX}src/__chain_shadow.d.ts`,
    text: "declare module '@narratives/foundation/testing/__chain_shadowed' {\n  export const v: number;\n}\n",
  },
  // The harness's production modules: a module of the test infrastructure, a runner test and an asset through `#checks/*`.
  {
    loads: [`${INFRASTRUCTURE}src/__chain_target.ts`],
    path: 'harness/lib/__chain_infrastructure.ts',
    text: "export * from '../../packages/characterisation/src/__chain_target.ts';\n",
  },
  { path: `${INFRASTRUCTURE}src/__chain_target.ts`, text: MODULE },
  {
    loads: ['harness/checks/__chain_runner.test.ts'],
    path: 'harness/lib/__chain_runner.ts',
    text: "export * from '#checks/__chain_runner.test.ts';\n",
  },
  { path: 'harness/checks/__chain_runner.test.ts', text: MODULE },
  {
    loads: ['harness/checks/testing/__chain_sheet.css'],
    path: 'harness/lib/__chain_sheet.ts',
    text: "import '#checks/testing/__chain_sheet.css';\nexport const a = 1;\n",
  },
  { path: 'harness/checks/testing/__chain_sheet.css', text: SHEET },
  { path: 'harness/lib/__chain_meta.ts', refused: true, text: 'export const a = import.meta.hot;\n' },
  // Every non-production importer kind, each importing test support and writing an unread form: passed.
  ...[
    `${SANDBOX}src/testing/__chain_support.ts`,
    `${SANDBOX}src/__chain_runner.test.ts`,
    `${SANDBOX}playwright.chain.config.ts`,
    `${INFRASTRUCTURE}src/__chain_infrastructure.ts`,
  ].map(
    (file) =>
      ({
        passes: true,
        path: file,
        text: `export * from '${relativeSpecifier(file, `${FOUNDATION}src/testing/index.ts`)}';\nexport const hot = import.meta.hot;\nexport const r = import('./__chain_query.ts?raw');\n`,
      }) as const,
  ),
];

export { FORM_PLANTS, FOUNDATION, MODULE, SANDBOX, SCRIPT };
export type { ChainPlant };
