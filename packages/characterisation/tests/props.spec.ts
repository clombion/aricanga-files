import { expect, test } from '@playwright/test';

import { captureConsoleCodes, recorded, runFixture } from './_helpers';

// A single vm prop read through props stays reactive to a field change and to a new vm object; a
// destructured vm follows field changes on a store proxy but misses a new vm, and dev warns.
test.describe('props', () => {
  test('only the undestructured part sees a new vm object', async ({ page }) => {
    const codes = captureConsoleCodes(page);
    const state = await runFixture(page, 'props');
    expect(recorded(state, 'props/single-vm-prop-is-reactive').note).toBe(
      'a field change, read through props: after; destructured: after',
    );
    expect(recorded(state, 'props/new-vm-reaches-only-the-undestructured-part').note).toBe(
      'a new vm object, read through props: a new vm; destructured: after',
    );
    expect(codes).toContain('STRICT_READ_UNTRACKED');
  });
});
