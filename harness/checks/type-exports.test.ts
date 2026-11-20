/**
 * An exported type is read by another production module (or a harness check) or carries `@public`.
 *
 * A re-export passes a name on and a rebuild test reading a type is not a reader, so a type only an
 * index re-exports, or only a test names, fails. A type its own module alone uses need not be
 * exported; a type a package offers to modules not yet written is marked `@public`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { openScan, type Scan, scannedFiles } from '../lib/checker.ts';
import { unread } from '../lib/type-exports.ts';

export const HARNESS_ID = 'type-exports';

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
  repoScan = openScan(scannedFiles());
}, 120_000);

afterAll(() => {
  plantedScan.close();
  repoScan.close();
});

describe('the repository', () => {
  test('every exported type is read by another module or marked @public', () => {
    expect(unread(repoScan)).toEqual([]);
  });
});

describe('the scan', () => {
  test('fails a type only its own module, a re-export or a test names, and passes a read, a check read and @public', () => {
    expect(unread(plantedScan).map((type) => type.name).toSorted()).toEqual(['OnlyReexported', 'ReadByTest', 'Unread']);
  });
});
