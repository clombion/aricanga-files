import { captureConsoleCodes, recorded, runFixture } from './_helpers';
import { expect, test } from '@playwright/test';
import type { SpecArguments } from './_helpers';

// An async read in a part outside <Loading> does not throw: the part renders nothing until the value
// lands, and dev warns ASYNC_OUTSIDE_LOADING_BOUNDARY. Parts stay synchronous; async lives outside.
test.describe('async views', () => {
  test('an async read outside Loading renders empty, then the value, with a warning', async ({ page }: SpecArguments) => {
    const codes = captureConsoleCodes(page);
    const state = await runFixture(page, 'async-views');
    const observed = recorded(state, 'async-views/async-read-outside-loading');
    expect(observed.threw).toBe(false);
    expect(observed.note).toBe('thrown: <nothing>; while pending: ""; after it resolved: "resolved"');
    expect(codes).toContain('ASYNC_OUTSIDE_LOADING_BOUNDARY');
  });
});
