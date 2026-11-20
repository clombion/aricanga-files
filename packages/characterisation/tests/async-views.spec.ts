import { characterised, recorded } from './_helpers';
import { expect, test } from '@playwright/test';

// An async read in a part outside <Loading> does not throw: the part renders nothing until the value
// lands, and dev warns ASYNC_OUTSIDE_LOADING_BOUNDARY. Parts stay synchronous; async lives outside.
test.describe('async views', () => {
  test(
    'an async read outside Loading renders empty, then the value, with a warning',
    characterised(
      'async-views',
      ({ codes, state }) => {
        const observed = recorded(state, 'async-views/async-read-outside-loading');
        expect(observed.threw).toBe(false);
        expect(observed.note).toBe('thrown: <nothing>; while pending: ""; after it resolved: "resolved"');
        expect(codes).toContain('ASYNC_OUTSIDE_LOADING_BOUNDARY');
      },
    ),
  );
});
