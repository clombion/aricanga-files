import { test, expect } from '@playwright/test';
import { runFixture, rec } from './_helpers';

// Brief, "Run-time model → Mounting": each experience is mounted once into its
// shadow root in connectedCallback and disposed in disconnectedCallback, with
// per-part cleanup released on dispose.
test.describe('mounting & disposal', () => {
  test('renders one root into a shadow root, sets up once, cleans up on disconnect', async ({ page }) => {
    const state = await runFixture(page, 'mount-dispose');

    const rendered = rec(state, 'mount/renders-into-shadow-root');
    expect(rendered, 'fixture recorded a render result').toBeDefined();
    expect(rendered?.ok, `render into shadow root: ${rendered?.note}`).toBe(true);

    const setup = rec(state, 'mount/setup-ran-once');
    expect(setup?.ok, `onSettled setup ran exactly once: ${setup?.note}`).toBe(true);

    const cleanup = rec(state, 'mount/dispose-runs-cleanup-once');
    expect(cleanup?.ok, `dispose() ran the cleanup exactly once: ${cleanup?.note}`).toBe(true);
  });
});
