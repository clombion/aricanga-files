// Sandbox experience — the Phase 0 walking skeleton (task-007).
// Thread: ink (compiled to story.json by the Vite ink plugin) → InkRuntime →
// stub reduce (system-chat) → Lit <sk-message> render. Real contracts/physics
// arrive in Phases 1–2; the real Aricanga experience is ported in Phase 3.

import { InkRuntime } from '@narratives/foundation';
import { reduceStep } from '@narratives/system-chat';
import { SkMessage } from './sk-message';

/** Run the full thread into `host`: load story → reduce each step → render. */
export async function run(host: HTMLElement, storyJson: string): Promise<void> {
  const runtime = new InkRuntime(storyJson);
  host.replaceChildren();
  while (runtime.canContinue()) {
    const step = runtime.continue();
    if (!step.text) continue;
    const vm = reduceStep(step);
    const el = new SkMessage();
    el.text = vm.speaker ? `${vm.speaker}: ${vm.text}` : vm.text;
    host.append(el);
  }
}

if (typeof document !== 'undefined') {
  const host = document.getElementById('app');
  if (host) {
    void fetch('/story.json')
      .then((r) => r.text())
      .then((json) => run(host, json))
      .catch((err: unknown) => console.error('walking skeleton failed', err));
  }
}
