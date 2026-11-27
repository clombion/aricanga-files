/**
 * What counts as a read of an `Accepted`, `Prefixes` or `Vocabulary` declaration
 * (`exemption-lists.consults.ts`): a declaration only imported, re-exported, bound by an import clause,
 * destructured or mentioned in a doc comment is stale; one read two destructurings away is live.
 */

import { UNCONSULTED, findings } from './exemption-lists.fence.ts';
import { describe, expect, test } from 'vitest';

const PLANT = 'harness/checks/plant.test.ts';
const OWNER = 'harness/lib/planted.ts';

/** The read kinds, each declared with an entry, and default-exported by a specifier (no read). */
const READ_KINDS = [
  ['Accepted', "new Accepted(['a'])"],
  ['Prefixes', "new Prefixes(['a'])"],
  ['Vocabulary', 'new Vocabulary({ a: 1 })'],
] as const;

/** A module that imports the owner's declaration every way short of reading it. */
const IMPORTS_ONLY = [
  "import * as owner from '#lib/planted.ts';",
  "import Named, { NAME } from '#lib/planted.ts';",
  "export { NAME as AGAIN } from '#lib/planted.ts';",
  "export async function check(): Promise<void> {\n  const { NAME: local } = await import('#lib/planted.ts');\n}",
  '',
].join('\n');

describe('a read of a read-kind declaration', () => {
  test.each(READ_KINDS)('is none for %s only imported, re-exported, bound by an import clause or destructured', async (_kind, value) => {
    expect.hasAssertions();
    const owner = `export const NAME = ${value};\nexport { NAME as default };\n`;
    await expect(findings({ [OWNER]: owner, [PLANT]: IMPORTS_ONLY })).resolves.toStrictEqual([
      { name: 'NAME', path: OWNER, problem: UNCONSULTED },
    ]);
  });

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

  test('is a read two destructurings away: a relay destructures and re-exports it, the user destructures the relay', async () => {
    expect.hasAssertions();
    const modules = {
      [OWNER]: "export const NAMES = new Accepted(['a']);\n",
      [PLANT]:
        "export async function check(): Promise<boolean> {\n  const { NAMES } = await import('#lib/relay.ts');\n  return NAMES.has('a');\n}\n",
      'harness/lib/relay.ts': "const { NAMES } = await import('./planted.ts');\nexport { NAMES };\n",
    };
    await expect(findings(modules)).resolves.toStrictEqual([]);
  });
});
