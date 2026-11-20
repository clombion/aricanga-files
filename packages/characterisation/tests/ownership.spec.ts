import { captureConsoleCodes, recorded, runFixture } from './_helpers';
import { expect, test } from '@playwright/test';
import type { SpecArguments } from './_helpers';

// The mounting seam runs unowned, and Solid refuses any primitive created in an effect's apply
// phase, including a root detached with runWithOwner(null).
test.describe('ownership', () => {
  test('connectedCallback is unowned; primitives in an effect callback are refused', async ({ page }: SpecArguments) => {
    const codes = captureConsoleCodes(page);
    const state = await runFixture(page, 'ownership');
    expect(recorded(state, 'ownership/connected-callback-unowned').ok).toBe(true);
    const memo = recorded(state, 'ownership/memo-in-effect-callback-refused');
    expect(memo.threw).toBe(true);
    expect(memo.error).toContain('[PRIMITIVE_IN_EFFECT_CALLBACK]');
    expect(recorded(state, 'ownership/root-in-effect-callback').note).toContain('refused: [PRIMITIVE_IN_EFFECT_CALLBACK]');
    expect(recorded(state, 'ownership/run-with-owner-null-in-effect-callback').note).toContain(
      'refused: [PRIMITIVE_IN_EFFECT_CALLBACK]',
    );
    expect(codes).toContain('PRIMITIVE_IN_EFFECT_CALLBACK');
  });
});
