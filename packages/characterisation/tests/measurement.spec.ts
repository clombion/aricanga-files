import { characterised, recorded } from './_helpers';
import { expect, test } from '@playwright/test';

// Reads lag writes until flush(); after it, layout sees the new snapshot. flush() in an effect
// callback is a no-op that warns; in onSettled it throws.
test.describe('measurement', () => {
  test(
    'apply, flush, then measure; flush in an effect is a no-op, in onSettled it throws',
    characterised('measurement', ({ codes, state }) => {
      expect(recorded(state, 'measurement/apply-flush-layout').ok).toBe(true);
      expect(recorded(state, 'measurement/flush-in-effect-callback').threw).toBe(false);
      expect(codes).toContain('FLUSH_IN_EFFECT_CALLBACK');
      const settled = recorded(state, 'measurement/flush-in-on-settled');
      expect(settled.threw).toBe(true);
      expect(settled.note).toContain('Cannot call flush() from inside onSettled');
    }),
  );
});
