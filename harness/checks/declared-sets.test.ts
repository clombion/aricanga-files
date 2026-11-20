/**
 * Every closed set of words has one owner: no two production type aliases declare the same union of
 * string literals (closedworld's `UNDECLARED_CLOSED_SET`, read as one set, one declaration).
 *
 * A set restated by a second alias drifts from its first when one gains a word; the second reads the
 * first's type instead (`Pick`, an indexed access, or an import). An `enum` cannot restate a set:
 * `erasableSyntaxOnly` refuses every one (the `typecheck-settings` check plants it).
 */

import { describe, expect, test } from 'vitest';
import { usePlanted, useScan } from '#lib/scan-hooks.ts';
import { twiceDeclared } from './declared-sets.scan.ts';

const HARNESS_ID = 'declared-sets';

/** A closed set, its restatement in another module, a reordered restatement, and the near misses. */
const PLANTS: Readonly<Record<string, string>> = {
  'packages/foundation/src/__sets_owner.ts': "export type Receipt = 'sent' | 'delivered' | 'read';\nexport type Single = 'only';\n",
  'packages/systems/__sets_read.ts': [
    "import type { Receipt } from '../foundation/src/__sets_owner';",
    "export type Arrived = Exclude<Receipt, 'sent'>;",
    'export type Mirror = Receipt;',
    "export type Again = 'only';",
    "export type Wider = 'sent' | 'delivered' | 'read' | 'lost';",
    '',
  ].join('\n'),
  'packages/systems/__sets_restated.ts': "export type Status = 'read' | 'sent' | 'delivered';\n",
};

const plantedScan = usePlanted(new Map(Object.entries(PLANTS)));
const repoScan = useScan();

describe('the repository', () => {
  test('declares each closed set of words once', () => {
    expect.hasAssertions();
    expect(twiceDeclared(repoScan())).toStrictEqual([]);
  });
});

describe('the scan', () => {
  test('finds a set restated in another module in any order, and passes a derived alias, a derived subset, a single word and a wider set', () => {
    expect.hasAssertions();
    expect(twiceDeclared(plantedScan())).toStrictEqual([
      ['packages/foundation/src/__sets_owner.ts#Receipt', 'packages/systems/__sets_restated.ts#Status'],
    ]);
  });
});

export { HARNESS_ID };
