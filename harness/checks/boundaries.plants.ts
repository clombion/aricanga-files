/** The planted modules and members of the `boundaries` check: the lint's fixtures, the planted population and its expected overrides, and the whole chain's planted states. */

import type { PlantedMember } from '#lib/planted-population.ts';

/** A planted module: where it sits, its text, whether a boundary refuses it, and, for one fixture per reason, the message that names it. */
interface Fixture {
  readonly path: string;
  readonly text: string;
  readonly fails: boolean;
  readonly reason?: string;
}

/** The message of a role-matrix refusal, after the importer's allowed roles. */
const MATRIX = '(the role matrix: MAY in harness/lib/import-boundaries.ts)';

/** The lint's fixtures, each at its real path. */
const FIXTURES: readonly Fixture[] = [
  {
    fails: true,
    path: 'packages/foundation/src/plant.ts',
    reason: `foundation modules import no member but the test infrastructure ${MATRIX}`,
    text: "export { chatSystem } from '@narratives/system-chat';\n",
  },
  { fails: false, path: 'packages/foundation/src/near.ts', text: "export { Story } from 'inkjs';\n" },
  { fails: true, path: 'packages/systems/cards/src/plant.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  { fails: false, path: 'packages/systems/cards/src/near.ts', text: "export { erase } from '@narratives/foundation';\n" },
  { fails: true, path: 'packages/systems/chat/src/plant.ts', text: "export * from '../../cards/src/system';\n" },
  { fails: false, path: 'packages/systems/chat/src/near.ts', text: "export * from './state';\n" },
  { fails: true, path: 'experiences/sandbox/src/plant.ts', text: "export * from '../../aricanga/src/aricanga-experience.js';\n" },
  { fails: false, path: 'experiences/sandbox/src/near.ts', text: "export { chatSystem } from '@narratives/system-chat';\n" },
  {
    fails: true,
    path: 'harness/lib/plant.ts',
    reason: 'nothing in the rebuild imports the POC (ADR-0006, "Scope")',
    text: "export * from '@narratives/framework';\n",
  },
  { fails: false, path: 'harness/lib/near.ts', text: "export * from 'node:fs';\n" },
  { fails: true, path: 'packages/systems/chat/src/model/plant.ts', text: 'export const at = (): number => Date.now();\n' },
  { fails: true, path: 'packages/systems/chat/src/model/random.ts', text: 'export const id = (): number => Math.random();\n' },
  { fails: false, path: 'packages/systems/chat/src/state-near.ts', text: 'export const at = (): number => Date.now();\n' },
  {
    fails: true,
    path: 'packages/systems/chat/src/climb.ts',
    reason: 'a module reaches another member only by its package name, never by a relative climb',
    text: "export * from './model/../../../cards/src/system';\n",
  },
  { fails: true, path: 'packages/foundation/src/type.ts', text: "export type { ChatViewModel } from '@narratives/system-chat';\n" },
  {
    fails: true,
    path: 'packages/foundation/src/later.ts',
    text: "export const later = async (): Promise<unknown> => import('@narratives/system-cards');\n",
  },
  { fails: false, path: 'experiences/sandbox/src/infrastructure.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  { fails: false, path: 'experiences/sandbox/test/infrastructure.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  { fails: false, path: 'packages/foundation/test/infrastructure.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  {
    fails: false,
    path: 'experiences/sandbox/playwright.planted.config.ts',
    text: "export * from '@narratives/characterisation/browsers';\n",
  },
  { fails: false, path: 'experiences/sandbox/src/colocated.test.ts', text: "export * from '@narratives/characterisation/browsers';\n" },
  {
    fails: true,
    path: 'packages/systems/cards/src/peer.ts',
    reason: `system modules import only foundation members and the test infrastructure, by name ${MATRIX}`,
    text: "export { chatSystem } from '@narratives/system-chat';\n",
  },
  { fails: true, path: 'packages/foundation/src/deep.ts', text: "export * from '@narratives/system-chat/testing/predicates';\n" },
  { fails: true, path: 'experiences/sandbox/src/poc-subpath.ts', text: "export * from '@narratives/framework/foundation';\n" },
  { fails: true, path: 'harness/lib/poc-subpath.ts', text: "export * from '@narratives/test-utils/fakes';\n" },
  { fails: true, path: 'experiences/sandbox/src/poc-package.ts', text: "export * from 'aricanga';\n" },
  { fails: true, path: 'oxlint.config.ts', text: "export * from '@narratives/framework';\n" },
  { fails: true, path: 'harness/lib/climb.ts', text: "export * from '../../packages/foundation/src/index';\n" },
  { fails: true, path: 'packages/foundation/src/up.ts', text: "export * from '..';\n" },
  { fails: true, path: 'packages/foundation/src/dot-up.ts', text: "export * from './..';\n" },
  { fails: true, path: 'packages/systems/cards/src/bare.ts', text: "export * from 'sandbox';\n" },
  { fails: false, path: 'packages/systems/cards/src/bare-relative.ts', text: "export * from './sandbox';\n" },
  { fails: false, path: 'packages/systems/cards/src/bare-segment.ts', text: "export * from '@narratives/foundation/sandbox';\n" },
  { fails: false, path: 'packages/systems/cards/src/bare-case.ts', text: "export * from 'Sandbox';\n" },
  { fails: false, path: 'packages/systems/cards/src/bare-case-subpath.ts', text: "export * from 'Sandbox/src/a';\n" },
  { fails: false, path: 'harness/lib/bare-scope.ts', text: "export * from '@x/aricanga';\n" },
];

/** The planted members: two of each role, each a named package, so every cell of the matrix, a role with itself included, has a member on both sides. */
const PLANTED: readonly PlantedMember[] = [
  ['apps/app/', 'experience', { name: '@p/app' }],
  ['apps/app2/', 'experience', { name: '@p/app2' }],
  ['lib/core/', 'foundation', { name: '@p/core' }],
  ['lib/core2/', 'foundation', { name: '@p/core2' }],
  ['lib/sys/', 'system', { name: '@p/sys' }],
  ['lib/sys2/', 'system', { name: '@p/sys2' }],
  ['tools/probe/', 'test-infrastructure', { name: '@p/probe' }],
  ['tools/probe2/', 'test-infrastructure', { name: '@p/probe2' }],
  ['ui/view/', 'view', { name: '@p/view' }],
  ['ui/view2/', 'view', { name: '@p/view2' }],
];

/** The boundary overrides of the planted members: each override's files, and the shipping members its role matrix refuses by name, by hand; the test infrastructure is refused to no importer. */
const BOUNDED: readonly unknown[] = [
  [['apps/app/**'], [['@p/app2']]],
  [['apps/app2/**'], [['@p/app']]],
  [['lib/core/**'], [['@p/app', '@p/app2', '@p/core2', '@p/sys', '@p/sys2', '@p/view', '@p/view2']]],
  [['lib/core2/**'], [['@p/app', '@p/app2', '@p/core', '@p/sys', '@p/sys2', '@p/view', '@p/view2']]],
  [['lib/sys/**'], [['@p/app', '@p/app2', '@p/sys2', '@p/view', '@p/view2']]],
  [['lib/sys2/**'], [['@p/app', '@p/app2', '@p/sys', '@p/view', '@p/view2']]],
  [['tools/probe/**'], []],
  [['tools/probe2/**'], []],
  [['ui/view/**'], [['@p/app', '@p/app2', '@p/sys', '@p/sys2', '@p/view2']]],
  [['ui/view2/**'], [['@p/app', '@p/app2', '@p/sys', '@p/sys2', '@p/view']]],
  [['harness/**', './knip.config.ts', './oxlint.config.ts', './vitest.gate.config.ts'], []],
];

/** The planted states of the whole chain: each production module imports a non-production one by another form; a test-support module imports one freely. */
const CHAIN: readonly (readonly [string, string])[] = [
  ['experiences/sandbox/src/__chain_infrastructure.ts', "export * from '@narratives/characterisation/browsers';\n"],
  ['experiences/sandbox/src/__chain_member.ts', "export * from '@narratives/foundation/testing';\n"],
  ['harness/lib/__chain_harness.ts', "export * from '../../packages/characterisation/browsers.ts';\n"],
  ['packages/foundation/src/__chain_ambient.ts', "export { planted } from 'chain-ambient';\n"],
  ['packages/foundation/src/__chain_global.ts', "export const read = (value: ChainGlobal): number => value['planted'];\n"],
  ['packages/foundation/src/__chain_declared.d.ts', "export type Module = typeof import('./testing/index.ts');\n"],
  ['packages/foundation/src/__chain_dynamic.ts', "export const later = async (): Promise<unknown> => import('./testing/index.ts');\n"],
  ['packages/foundation/src/__chain_import_type.ts', "export type Run = import('./testing/index.ts').FixtureRun;\n"],
  ['packages/foundation/src/__chain_own.ts', "export * from './testing/index.ts';\n"],
  [
    'packages/foundation/src/__chain_require.ts',
    "import fixture = require('./testing/index.ts');\n\nexport type Fixture = typeof fixture;\n",
  ],
  [
    'packages/foundation/src/__chain_strings.ts',
    "const path = './testing/index.ts';\nconst keyed = { './testing/index.ts': 1 };\n\nexport const read = (): number => keyed['./testing/index.ts'] + path.length;\n",
  ],
  ['packages/foundation/src/__chain_template.ts', 'export const later = async (): Promise<unknown> => import(`./testing/index.ts`);\n'],
  ['packages/foundation/src/__chain_typeof.ts', "export type Module = typeof import('./testing/index.ts');\n"],
  [
    'packages/foundation/test/__chain_declarations.ts',
    "declare module 'chain-ambient' {\n  const planted: number;\n}\n\ninterface ChainGlobal {\n  planted: number;\n}\n",
  ],
  ['packages/foundation/test/__chain_support.ts', "export * from '../src/testing/index.ts';\n"],
  ['packages/systems/chat/src/__chain_alias.ts', "export * from '#src/testing/predicates';\n"],
  [
    'packages/systems/chat/src/__chain_type.ts',
    "import type { FixtureRun } from '@narratives/foundation/testing';\n\nexport type Run = FixtureRun;\n",
  ],
];

export { BOUNDED, CHAIN, FIXTURES, PLANTED };
export type { Fixture };
