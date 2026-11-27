/**
 * What counts as a read of an `Accepted`, `Prefixes` or `Vocabulary` declaration
 * (`exemption-lists.consults.ts`): a declaration only mentioned in a doc comment is stale.
 */

import { UNCONSULTED, findings } from './exemption-lists.fence.ts';
import { describe, expect, test } from 'vitest';

const PLANT = 'harness/checks/plant.test.ts';
const OWNER = 'harness/lib/planted.ts';

describe('a read of a read-kind declaration', () => {
  test.each([
    [
      'in an importer',
      "export const NAMES = new Accepted(['a']);\n",
      "import { NAMES } from '#lib/planted.ts';\n/** Mentions {@link NAMES} only. */\nexport const n = 1;\n",
    ],
    [
      'in its own module',
      "export const NAMES = new Accepted(['a']);\n/** See {@link NAMES}. */\nexport const x = 1;\n",
      'export const n = 1;\n',
    ],
  ])('is none for a mention in a doc comment, %s', async (_where, owner, user) => {
    expect.hasAssertions();
    await expect(findings({ [OWNER]: owner, [PLANT]: user })).resolves.toStrictEqual([
      { name: 'NAMES', path: OWNER, problem: UNCONSULTED },
    ]);
  });
});
