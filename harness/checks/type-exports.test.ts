/**
 * An exported type is read by another production module (or a harness check) or carries `@public`.
 *
 * A re-export passes a name on and a rebuild test reading a type is not a reader, so a type only an
 * index re-exports, or only a test names, fails. A type its own module alone uses need not be
 * exported; a type a package offers to modules not yet written is marked `@public`.
 */

import { describe, expect, test } from 'vitest';
import { usePlanted, useScan } from '#lib/scan-hooks.ts';
import { unread } from '#lib/type-exports.ts';

const HARNESS_ID = 'type-exports';

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
  'harness/checks/__types.test.ts': "import type { ReadByCheck } from '../../packages/foundation/src/__types_owner';\nexport const z: ReadByCheck = { a: 1 };\n",
  'packages/foundation/src/__types_index.ts': "export type { OnlyReexported } from './__types_owner';\n",
  'packages/systems/__types.test.ts': "import type { ReadByTest } from '../foundation/src/__types_owner';\nexport const y: ReadByTest = 2;\n",
  'packages/systems/__types_reader.ts': "import type { Read } from '../foundation/src/__types_owner';\nexport const x: Read = 1;\n",
};

const plantedScan = usePlanted(new Map(Object.entries(PLANTS)));
const repoScan = useScan();

describe('the repository', () => {
  test('every exported type is read by another module or marked @public', () => {
    expect.hasAssertions();
    expect(unread(repoScan())).toStrictEqual([]);
  });
});

describe('the scan', () => {
  test('fails a type only its own module, a re-export or a test names, and passes a read, a check read and @public', () => {
    expect.hasAssertions();
    expect(unread(plantedScan()).map((type) => type.name).toSorted()).toStrictEqual(['OnlyReexported', 'ReadByTest', 'Unread']);
  });
});

export { HARNESS_ID };
