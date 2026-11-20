import { expect, test } from '@playwright/test';
import { recorded, runFixture } from './_helpers';
import type { SpecArguments } from './_helpers';

// Brief, "Run-time model → Mounting": each experience is mounted once into its
// shadow root in connectedCallback and disposed in disconnectedCallback, with
// per-part cleanup released on dispose.
test.describe('mounting & disposal', () => {
  test('renders one root into a shadow root, sets up once, cleans up on disconnect', async ({ page }: SpecArguments) => {
    const state = await runFixture(page, 'mount-dispose');

    const rendered = recorded(state, 'mount/renders-into-shadow-root');
    expect(rendered.ok, `render into shadow root: ${rendered.note ?? ''}`).toBe(true);

    const setup = recorded(state, 'mount/setup-ran-once');
    expect(setup.ok, `onSettled setup ran exactly once: ${setup.note ?? ''}`).toBe(true);

    const cleanup = recorded(state, 'mount/dispose-runs-cleanup-once');
    expect(cleanup.ok, `dispose() ran the cleanup exactly once: ${cleanup.note ?? ''}`).toBe(true);
  });
});
