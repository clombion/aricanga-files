/**
 * Every skip in the tests is listed with its reason, so a test cannot stop running unnoticed.
 *
 * The scan reads each held test module's syntax tree, so it sees a skip decided at run time as well
 * as a skip modifier: Vitest's and Playwright's `skip`, `skipIf`, `runIf`, `todo`, `only`, `fails`,
 * `fixme` and `fail` on `test`, `it`, `describe` and `test.describe` (aliased imports included),
 * and a test context's `skip()`. Each site is keyed by `site(path, owner)`, where the owner is the
 * title of the test the skip belongs to, or `<module>`.
 */

import { Exemptions, site } from '#lib/exemptions.ts';
import { describe, expect, test } from 'vitest';
import { heldFiles } from '#lib/scope.ts';
import { skips } from './skips.scan.ts';
import { textsOf } from '#lib/source-files.ts';

const HARNESS_ID = 'skips';

/** The tests allowed to skip, keyed by `site(path, owner)`. */
const SKIPS = Exemptions.grouped({});

describe('the repository', () => {
  test('every skip is listed', async () => {
    expect.hasAssertions();
    const held = await heldFiles('.test.ts', '.test.tsx', '.spec.ts');
    const texts = await textsOf(held);
    const found = texts.flatMap(([path, text]: readonly [string, string]) => skips(path, text));
    expect(SKIPS.unexempted(found)).toStrictEqual([]);
  });
});

describe('the scan', () => {
  const PLANT = 'packages/plant/a.test.ts';

  test.each([
    ["import { test } from 'vitest';\ntest.skip('a', () => {});", 'a'],
    ["import { it } from 'vitest';\nit.todo('a');", 'a'],
    ["import { test } from 'vitest';\ntest.only('a', () => {});", 'a'],
    ["import { test } from 'vitest';\ntest.fails('a', () => {});", 'a'],
    ["import { test } from 'vitest';\ntest.skipIf(process.platform === 'win32')('a', () => {});", 'a'],
    ["import { describe, test } from 'vitest';\ndescribe('group', () => { test.runIf(false)('a', () => {}); });", 'a'],
    ["import { describe } from 'vitest';\ndescribe.skip('group', () => {});", 'group'],
    ["import { test as check } from 'vitest';\ncheck.skip('a', () => {});", 'a'],
    ["import { test } from 'vitest';\ntest('a', (context) => { context.skip(); });", 'a'],
    ["import { test } from 'vitest';\ntest('a', ({ skip }) => { skip(); });", 'a'],
    ["import { test } from '@playwright/test';\ntest('a', () => { test.skip(); });", 'a'],
    ["import { test } from '@playwright/test';\ntest.fixme('a', async () => {});", 'a'],
    ["import { test } from '@playwright/test';\ntest.describe.skip('group', () => {});", 'group'],
    ["import { test } from '@playwright/test';\ntest('a', () => { test.fail(); });", 'a'],
  ])('sees the planted skip in %j', (text, owner) => {
    expect.hasAssertions();
    expect(skips(PLANT, text)).toStrictEqual([site(PLANT, owner)]);
  });

  test.each([
    "import { test } from 'vitest';\ntest('a', () => { const s = 'test.skip'; });",
    "import { test } from 'vitest';\nconst list = { skip: 1 };\ntest('a', () => { list.skip; });",
    "import { test } from 'vitest';\ntest.each([1])('a %s', () => {});",
    'const test = { skip: () => {} };\ntest.skip();',
  ])('lets a near miss through: %j', (text) => {
    expect.hasAssertions();
    expect(skips(PLANT, text)).toStrictEqual([]);
  });

  test('a listed skip passes and a stale one fails', () => {
    expect.hasAssertions();
    const planted = skips(PLANT, "import { test } from 'vitest';\ntest.skip('a', () => {});");
    const listed = new Exemptions({ [site(PLANT, 'a')]: 'planted' });
    expect(listed.unexempted(planted)).toStrictEqual([]);
    expect(() => listed.unexempted([])).toThrow('stale');
  });
});

export { HARNESS_ID };
