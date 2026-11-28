/** The whole chain's planted cases (F1b2-R1), after its forms (`boundaries-chain.plants.ts`): each importer with what the chain finds there, the files its scan serves besides, and the members they sit in. */

import { FORM_PLANTS, FOUNDATION, MODULE, SANDBOX, SCRIPT } from './boundaries-chain.plants.ts';
import type { ChainPlant } from './boundaries-chain.plants.ts';
import type { PlantedMember } from '#lib/planted-population.ts';

/** The whole chain's planted states: every form, every importer kind, every case of the relation. */
const CHAIN: readonly ChainPlant[] = [
  ...FORM_PLANTS,
  // A production module reaching test support through another production module: both are named.
  {
    loads: [`${FOUNDATION}src/testing/__chain_via.ts`],
    path: `${SANDBOX}src/__chain_via.ts`,
    text: "export { v } from '../../../packages/foundation/src/__chain_via.ts';\n",
  },
  {
    loads: [`${FOUNDATION}src/testing/__chain_via.ts`],
    path: `${FOUNDATION}src/__chain_via.ts`,
    text: "export { v } from './testing/__chain_via.ts';\n",
  },
  { path: `${FOUNDATION}src/testing/__chain_via.ts`, text: MODULE },
  // The root configuration modules: a module of test support, a script, a bundler form.
  {
    loads: ['harness/checks/__chain_root.test.ts'],
    path: 'knip.config.ts',
    text: "import { v } from './harness/checks/__chain_root.test.ts';\nexport default { v };\n",
  },
  { path: 'harness/checks/__chain_root.test.ts', text: MODULE },
  {
    loads: ['harness/checks/__chain_root_script.test.ts'],
    path: 'vitest.gate.config.ts',
    text: "import './harness/checks/__chain_root_script.test.ts';\nexport default {};\n",
  },
  { path: 'harness/checks/__chain_root_script.test.ts', text: SCRIPT },
  { path: 'oxlint.config.ts', refused: true, text: "export default { g: import.meta.glob('./harness/checks') };\n" },
  // A production declaration file: an import type, a reference path.
  {
    loads: [`${FOUNDATION}src/testing/__chain_declared.ts`],
    path: `${FOUNDATION}src/__chain_declared.d.ts`,
    text: "export type T = import('./testing/__chain_declared.ts').X;\n",
  },
  { path: `${FOUNDATION}src/testing/__chain_declared.ts`, text: MODULE },
  {
    loads: [`${FOUNDATION}src/testing/__chain_referenced.ts`],
    path: `${FOUNDATION}src/__chain_referenced.d.ts`,
    text: '/// <reference path="./testing/__chain_referenced.ts" />\nexport {};\n',
  },
  { path: `${FOUNDATION}src/testing/__chain_referenced.ts`, text: MODULE },
  // A use only test support declares: an ambient module, a global, a near-named global, augmentations.
  {
    declares: [`${FOUNDATION}test/__chain_ambient.d.ts`],
    path: `${FOUNDATION}src/__chain_ambient.ts`,
    text: "import { v } from 'chain-ambient';\nexport const a = v;\n",
  },
  { path: `${FOUNDATION}test/__chain_ambient.d.ts`, text: "declare module 'chain-ambient' {\n  export const v: number;\n}\n" },
  {
    declares: [`${FOUNDATION}test/__chain_global.d.ts`],
    path: `${FOUNDATION}src/__chain_global.ts`,
    text: 'export const a = chainGlobal;\n',
  },
  {
    declares: [`${FOUNDATION}test/__chain_global.d.ts`],
    path: `${FOUNDATION}src/__chain_near.ts`,
    text: 'const chainNearGlobals = 2;\nexport const a = chainNearGlobal + chainNearGlobals;\n',
  },
  {
    path: `${FOUNDATION}test/__chain_global.d.ts`,
    text: 'declare global {\n  const chainGlobal: number;\n  const chainNearGlobal: number;\n}\nexport {};\n',
  },
  {
    declares: [`${FOUNDATION}test/__chain_augment.d.ts`],
    path: `${FOUNDATION}src/__chain_augmented.ts`,
    text: "import { fake } from './__chain_real.ts';\nexport const a = fake;\n",
  },
  {
    declares: [`${FOUNDATION}test/__chain_augment.d.ts`],
    path: `${FOUNDATION}src/__chain_near_member.ts`,
    text: "import { fakeValue } from './__chain_real.ts';\nexport const a = fakeValue;\n",
  },
  {
    declares: [`${FOUNDATION}test/__chain_augment.d.ts`],
    path: `${FOUNDATION}src/__chain_default.ts`,
    text: "import { fakeDefault } from './__chain_default_real.ts';\nexport const a = fakeDefault;\n",
  },
  {
    declares: [`${FOUNDATION}test/__chain_augment.d.ts`],
    path: `${FOUNDATION}src/__chain_installed.ts`,
    text: "import { chainFake } from 'solid-js';\nexport const a = chainFake;\n",
  },
  { path: `${FOUNDATION}src/__chain_real.ts`, text: 'export const real = 1;\nexport const fakeValues = 1;\n' },
  { path: `${FOUNDATION}src/__chain_default_real.ts`, text: 'const real = 1;\nexport default real;\n' },
  {
    path: `${FOUNDATION}test/__chain_augment.d.ts`,
    text: "declare module '../src/__chain_real.ts' {\n  export const fake: number;\n  export const fakeValue: number;\n}\ndeclare module '../src/__chain_default_real.ts' {\n  export const fakeDefault: number;\n}\ndeclare module 'solid-js' {\n  export const chainFake: number;\n}\nexport {};\n",
  },
  // What ships: a production module, an installed package (typed, untyped, its stylesheet), an exact production declaration, a name production and test support both declare.
  {
    passes: true,
    path: `${SANDBOX}src/__chain_production.ts`,
    text: "export { v } from '../../../packages/foundation/src/__chain_production.ts';\n",
  },
  { path: `${FOUNDATION}src/__chain_production.ts`, text: MODULE },
  {
    passes: true,
    path: `${SANDBOX}src/__chain_typed.ts`,
    text: "import { createSignal } from 'solid-js';\nexport const a = createSignal;\n",
  },
  {
    passes: true,
    path: `${SANDBOX}src/__chain_untyped.ts`,
    text: "import u from 'chain-untyped';\nimport 'chain-untyped';\nimport 'chain-untyped/lib/deep.js';\nexport const a = u;\n",
  },
  {
    passes: true,
    path: `${SANDBOX}src/__chain_styled.ts`,
    text: "import 'chain-styled/style.css';\nimport 'chain-styled/theme.css';\nimport 'chain-sheet';\nimport s from 'chain-styled/style.css';\nexport const a = s;\n",
  },
  {
    passes: true,
    path: `${SANDBOX}src/__chain_declared.ts`,
    text: "import u from 'chain-undeclared';\nimport '~testing/declared.css';\nexport const a = u;\n",
  },
  {
    path: `${SANDBOX}src/__chain_declarations.d.ts`,
    text: "declare module 'chain-undeclared';\ndeclare module '~testing/declared.css';\n",
  },
  { passes: true, path: `${FOUNDATION}src/__chain_clash.ts`, text: "import { v } from 'chain-clash';\nexport const a = v;\n" },
  { path: `${FOUNDATION}src/__chain_clash.d.ts`, text: "declare module 'chain-clash' {\n  export const v: number;\n}\n" },
  { path: `${FOUNDATION}test/__chain_clash.d.ts`, text: "declare module 'chain-clash' {\n  export const v: number;\n}\n" },
  // What no file answers, and what only a bundler reads (F1b2-C3).
  ...[
    "import 'chain-styled/gone.css';\n",
    "import 'chain-styled/conditional.css';\n",
    "import 'chain-absent';\n",
    "import 'chain-absent/x.css';\n",
    "import '~testing/x.css';\n",
    "import '~testing/setup';\n",
    "import './__chain_nothing_here';\n",
    "import '#src/__chain_nothing_here.css';\n",
  ].map(
    (text, index) =>
      ({
        path: `${SANDBOX}src/__chain_leftover_${index}.ts`,
        refused: true,
        text: `${text}export const b = 1;\n`,
        unanswered: true,
      }) as const,
  ),
  // A member an untyped package lacks: no file is missing.
  {
    path: `${SANDBOX}src/__chain_leftover_8.ts`,
    refused: true,
    text: "import * as u from 'chain-untyped';\nexport const a = u.zzz;\nexport const b = 1;\n",
  },
  // A query only an exact production declaration answers is refused by its query; `new.target` is no `import.meta`.
  {
    path: `${SANDBOX}src/__chain_query_declared.ts`,
    refused: true,
    text: "import t from '~testing/__chain_qx.txt?raw';\nexport const a = t;\n",
  },
  {
    path: `${SANDBOX}src/__chain_query_declared.d.ts`,
    text: "declare module '~testing/__chain_qx.txt?raw' {\n  const text: string;\n  export default text;\n}\n",
  },
  {
    passes: true,
    path: `${SANDBOX}src/__chain_new_target.ts`,
    text: 'export class K {\n  public readonly n: unknown = new.target.name;\n}\n',
  },
  // Test support imports test support freely; a string naming a module is no import.
  { path: `${FOUNDATION}test/__chain_support.ts`, text: "export * from '../src/testing/index.ts';\n" },
  {
    passes: true,
    path: `${FOUNDATION}src/__chain_strings.ts`,
    text: "const path = './testing/index.ts';\nconst keyed = { './testing/index.ts': 1 };\n\nexport const read = (): number => keyed['./testing/index.ts'] + path.length;\n",
  },
];

/** The files the whole chain's scan serves that its population does not hold: installed packages, and foundation's manifest exporting the planted subpaths. */
const CHAIN_MOUNTED: readonly (readonly [string, string])[] = [
  [
    `${FOUNDATION}package.json`,
    JSON.stringify({
      exports: {
        '.': './src/index.ts',
        './testing': './src/testing/index.ts',
        './testing/__chain_shadowed': './src/testing/__chain_shadowed.ts',
        './testing/__chain_subpath': './src/testing/__chain_subpath.ts',
        './testing/__chain_subpath_asset.css': './src/testing/__chain_subpath_asset.css',
      },
      name: '@narratives/foundation',
    }),
  ],
  [`${SANDBOX}node_modules/chain-untyped/package.json`, JSON.stringify({ main: './index.js', name: 'chain-untyped' })],
  [`${SANDBOX}node_modules/chain-untyped/index.js`, 'module.exports = 1;\n'],
  [`${SANDBOX}node_modules/chain-untyped/lib/deep.js`, "require('../index.js');\n"],
  [`${SANDBOX}node_modules/chain-undeclared/package.json`, JSON.stringify({ main: './index.js', name: 'chain-undeclared' })],
  [`${SANDBOX}node_modules/chain-undeclared/index.js`, 'module.exports = 1;\n'],
  [
    `${SANDBOX}node_modules/chain-styled/package.json`,
    JSON.stringify({
      exports: { './conditional.css': { style: './dist/theme.css' }, './style.css': './style.css', './theme.css': './dist/theme.css' },
      name: 'chain-styled',
    }),
  ],
  [`${SANDBOX}node_modules/chain-styled/style.css`, 'a {}\n'],
  [`${SANDBOX}node_modules/chain-styled/dist/theme.css`, 'a {}\n'],
  [`${SANDBOX}node_modules/chain-sheet/package.json`, JSON.stringify({ main: './index.css', name: 'chain-sheet' })],
  [`${SANDBOX}node_modules/chain-sheet/index.css`, 'a {}\n'],
];

/** The members the whole chain's plants sit in. */
const CHAIN_MEMBERS: readonly PlantedMember[] = [
  ['experiences/sandbox/', 'experience'],
  ['packages/characterisation/', 'test-infrastructure'],
  ['packages/foundation/', 'foundation'],
];

export { CHAIN, CHAIN_MEMBERS, CHAIN_MOUNTED };
