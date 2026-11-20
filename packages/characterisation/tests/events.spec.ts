import { characterised, recorded } from './_helpers';
import { expect, test } from '@playwright/test';

// Delegated handlers work inside the experience's shadow root on real input; a synthetic
// non-bubbling dispatch never reaches them, so tests drive parts through real interaction.
test.describe('events', () => {
  test(
    'a real click reaches the delegated handler; a non-bubbling dispatch does not',
    characterised('events', async ({ page, state }) => {
      expect(recorded(state, 'events/non-bubbling-dispatch').note).toBe(
        'delegated handler after a non-bubbling synthetic click: clicked 0',
      );
      const button = page.locator('chx-events-host').locator('#delegated');
      await button.click();
      await expect(button).toHaveText('clicked 1');
    }),
  );
});
