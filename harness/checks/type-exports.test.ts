/**
 * An exported type is read by another production module (or a harness check) or carries `@public`.
 *
 * A re-export passes a name on and a rebuild test reading a type is not a reader, so a type only an
 * index re-exports, or only a test names, fails. A type its own module alone uses need not be
 * exported; a type a package offers to modules not yet written is marked `@public`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { openScan, type Scan } from '../lib/checker.ts';
import { Exemptions, site } from '../lib/exemptions.ts';
import { typescriptFiles } from '../lib/scope.ts';
import { isReader, unread } from '../lib/type-exports.ts';

export const HARNESS_ID = 'type-exports';

const PACKAGE_API =
  'adopting: package API the view layer and experiences will name; mark it @public, or stop exporting it';
const HARNESS_API = 'adopting: harness library type no check names; stop exporting it, or name it in a check';

const sites = (pairs: readonly (readonly [string, string])[]): string[] => pairs.map(([path, name]) => site(path, name));

const EXEMPT = Exemptions.grouped({
  [PACKAGE_API]: sites([
    ['packages/foundation/src/core/create-experience.ts', 'ExperienceConfig'],
    ['packages/foundation/src/core/create-experience.ts', 'Experience'],
    ['packages/foundation/src/host/runtime.ts', 'RuntimeConfig'],
    ['packages/foundation/src/ink/ink-runtime.ts', 'NameResolver'],
    ['packages/foundation/src/ink/ink-runtime.ts', 'DataResolver'],
    ['packages/foundation/src/ink/ink-runtime.ts', 'InkFixtures'],
    ['packages/foundation/src/services/event-bus.ts', 'Unsubscribe'],
    ['packages/foundation/src/services/event-bus.ts', 'EventBus'],
    ['packages/foundation/src/services/services.ts', 'Clock'],
    ['packages/foundation/src/services/services.ts', 'AnalyticsSink'],
    ['packages/foundation/src/sim/effect.ts', 'EffectFamily'],
    ['packages/foundation/src/sim/input.ts', 'Resume'],
    ['packages/foundation/src/sim/input.ts', 'Lifecycle'],
    ['packages/foundation/src/sim/router.ts', 'RouteContext'],
    ['packages/foundation/src/sim/trace.ts', 'ReduceRecord'],
    ['packages/systems/cards/src/system.ts', 'CardsState'],
    ['packages/systems/cards/src/system.ts', 'CardsViewModel'],
    ['packages/systems/chat/src/model/defer.ts', 'MessageOutcome'],
    ['packages/systems/chat/src/reduce.ts', 'MessageFields'],
    ['packages/systems/chat/src/state.ts', 'ChatView'],
    ['packages/systems/chat/src/system.ts', 'ChatCommand'],
    ['packages/systems/chat/src/system.ts', 'ChatViewModel'],
    ['packages/characterisation/src/harness.ts', 'ChxRecord'],
    ['packages/characterisation/src/harness.ts', 'ChxState'],
    ['packages/characterisation/src/registry.ts', 'Fixture'],
  ]),
  [HARNESS_API]: sites([
    ['harness/lib/checks.ts', 'CheckModule'],
    ['harness/lib/exemptions.ts', 'Mismatch'],
    ['harness/lib/process.ts', 'TimedOut'],
    ['harness/lib/process.ts', 'NotStarted'],
    ['harness/lib/process.ts', 'Outcome'],
    ['harness/lib/process.ts', 'RunOptions'],
    ['harness/lib/pushed.ts', 'Update'],
  ]),
});

const OWNER = 'packages/foundation/src/__types_owner.ts';
const PLANTS: Readonly<Record<string, string>> = {
  [OWNER]: [
    'export type Read = number;',
    'export type Unread = string;',
    '/** @public */',
    'export type Public = boolean;',
    'export interface ReadByCheck {',
    '  readonly a: 1;',
    '}',
    'export type OnlyReexported = 1;',
    'export type ReadByTest = 2;',
    "export const own: Unread = 'a';",
    '',
  ].join('\n'),
  'packages/systems/__types_reader.ts': "import type { Read } from '../foundation/src/__types_owner';\nexport const x: Read = 1;\n",
  'packages/foundation/src/__types_index.ts': "export type { OnlyReexported } from './__types_owner';\n",
  'packages/systems/__types.test.ts': "import type { ReadByTest } from '../foundation/src/__types_owner';\nexport const y: ReadByTest = 2;\n",
  'harness/checks/__types.test.ts': "import type { ReadByCheck } from '../../packages/foundation/src/__types_owner';\nexport const z: ReadByCheck = { a: 1 };\n",
};

let plantedScan: Scan;
let repoScan: Scan;

beforeAll(() => {
  plantedScan = openScan(Object.keys(PLANTS), PLANTS);
  repoScan = openScan(typescriptFiles().filter(isReader), {});
}, 120_000);

afterAll(() => {
  plantedScan.close();
  repoScan.close();
});

describe('the repository', () => {
  test('every exported type is read by another module or marked @public', () => {
    const found = unread(repoScan).map((type) => site(type.path, type.name));
    expect(EXEMPT.unexempted(found)).toEqual([]);
  });
});

describe('the scan', () => {
  test('fails a type only its own module, a re-export or a test names, and passes a read, a check read and @public', () => {
    expect(unread(plantedScan).map((type) => type.name).toSorted()).toEqual(['OnlyReexported', 'ReadByTest', 'Unread']);
  });
});
