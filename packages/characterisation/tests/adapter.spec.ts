import { characterised, recorded } from './_helpers';
import { expect, test } from '@playwright/test';

// The snapshot adapter: reconcile by id keeps every unchanged item's nodes; applying from a timer
// works; a write from a component body or a memo throws REACTIVE_WRITE_IN_OWNED_SCOPE in dev.
test.describe('the snapshot adapter', () => {
  test(
    'reconciles by id, applies from timers, and refuses owned writes',
    characterised(
      'adapter',
      ({ state }) => {
        expect(recorded(state, 'adapter/reconcile-keeps-nodes-by-id').ok).toBe(true);
        expect(recorded(state, 'adapter/apply-from-timer').ok).toBe(true);
        for (const id of ['adapter/write-in-component-body-refused', 'adapter/write-in-memo-refused']) {
          const refusal = recorded(state, id);
          expect(refusal.threw, id).toBe(true);
          expect(refusal.error, id).toContain('[REACTIVE_WRITE_IN_OWNED_SCOPE]');
        }
      },
    ),
  );
});
