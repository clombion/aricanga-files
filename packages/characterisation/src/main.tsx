import { fixtures } from './registry';
import { markDone, record } from './harness';

async function boot(): Promise<void> {
  const name = new URLSearchParams(location.search).get('fixture');
  if (!name) {
    const app = document.getElementById('app');
    if (app) app.textContent = `fixtures: ${Object.keys(fixtures).join(', ')}`;
    return;
  }
  const load = fixtures[name];
  if (!load) {
    record({ id: `unknown-fixture:${name}`, ok: false, threw: false, note: 'no such fixture' });
    markDone();
    return;
  }
  try {
    const mod = await load();
    await mod.run();
  } catch (err) {
    // A fixture that throws at the top level is itself evidence; record and finish.
    record({
      id: `fixture-threw:${name}`,
      ok: false,
      threw: true,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
    markDone();
  }
}

void boot();
