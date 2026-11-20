import { fixtures } from './registry';
import { markDone, record } from './harness';

async function boot(): Promise<void> {
  const name = new URLSearchParams(location.search).get('fixture');
  if (!name) {
    const app = document.querySelector('#app');
    if (app) {app.textContent = `fixtures: ${Object.keys(fixtures).join(', ')}`;}
    return;
  }
  const load = fixtures[name];
  if (!load) {
    record({ id: `unknown-fixture:${name}`, note: 'no such fixture', ok: false, threw: false });
    markDone();
    return;
  }
  try {
    const mod = await load();
    await mod.run();
  } catch (error) {
    // A fixture that throws at the top level is itself evidence; record and finish.
    record({
      id: `fixture-threw:${name}`,
      ok: false,
      threw: true,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    markDone();
  }
}

void boot();
