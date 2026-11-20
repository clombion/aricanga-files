/** The fixture page: runs the fixture the address names and records what it did. */

import { FIXTURE_NAMES, loadFixture } from '#src/registry';
import { markDone, record } from '#src/harness';

/**
 * Run one named fixture, recording an unknown name or a top-level throw as evidence of its own.
 * @param {string} name The fixture's name.
 */
async function runNamed(name: string): Promise<void> {
  try {
    const fixture = await loadFixture(name);
    if (fixture === undefined) {
      record({ id: `unknown-fixture:${name}`, note: 'no such fixture', ok: false, threw: false });
      markDone();
      return;
    }
    await fixture.run();
  } catch (error) {
    // A fixture that throws at the top level is itself evidence; record and finish.
    record({
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      id: `fixture-threw:${name}`,
      ok: false,
      threw: true,
    });
    markDone();
  }
}

const requested = new URLSearchParams(location.search).get('fixture');
if (requested === null || requested === '') {
  const app = document.querySelector('#app');
  if (app !== null) {
    app.textContent = `fixtures: ${FIXTURE_NAMES.join(', ')}`;
  }
} else {
  await runNamed(requested);
}
