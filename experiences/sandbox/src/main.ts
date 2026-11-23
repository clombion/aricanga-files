// Sandbox experience: the Phase 0 walking skeleton.
// Thread: ink (compiled to story.json by the Vite ink plugin) → InkRuntime →
// stub reduce (system-chat) → <sk-message>, which mounts the Solid message part. Real
// contracts/physics arrive in Phases 1–2; the real Aricanga experience is ported in Phase 3.

import { SkMessage, defineSkMessage } from '#parts/sk-message';
import { InkRuntime } from '@narratives/foundation';
import { reduceStep } from '@narratives/system-chat';

/** Where the dev server serves the story the Vite ink plugin compiled. */
const STORY_URL = '/story.json';

/** Where the experience renders: it replaces the host's children. */
type Host = Readonly<Pick<HTMLElement, 'append' | 'replaceChildren'>>;

/**
 * The message elements of a story: one per step that carries text.
 * @param {string} storyJson The compiled story.
 * @returns {SkMessage[]} The elements, in story order.
 */
function messagesOf(storyJson: string): SkMessage[] {
  const runtime = InkRuntime.fromJson(storyJson);
  const elements: SkMessage[] = [];
  while (runtime.canContinue()) {
    const step = runtime.continue();
    if (step.text !== '') {
      const vm = reduceStep(step);
      const element = new SkMessage();
      element.show({ text: vm.speaker === '' ? vm.text : `${vm.speaker}: ${vm.text}` });
      elements.push(element);
    }
  }
  return elements;
}

/**
 * Run the full thread into `host`: load story → reduce each step → render.
 * @param {Host} host Where to render.
 * @param {string} storyJson The compiled story.
 */
function run(host: Host, storyJson: string): void {
  defineSkMessage();
  host.replaceChildren(...messagesOf(storyJson));
}

/**
 * Fetch the story and run it into `host`, showing the failure there when it cannot.
 * @param {Host} host Where to render.
 * @returns {Promise<void>} Resolves once the story ran or its failure is shown.
 */
async function boot(host: Host): Promise<void> {
  try {
    const response = await fetch(STORY_URL);
    run(host, await response.text());
  } catch (error) {
    // The failure is shown where the experience would have rendered.
    host.replaceChildren(`walking skeleton failed: ${String(error)}`);
  }
}

/**
 * Boot the experience into the page's `#app` element, if the page has one.
 * @param {Pick<ParentNode, 'querySelector'>} page Where to look for `#app`.
 * @returns {Promise<void>} Resolves once the experience booted, or at once without `#app`.
 */
async function start(page: Readonly<Pick<ParentNode, 'querySelector'>>): Promise<void> {
  const app = page.querySelector<HTMLElement>('#app');
  if (app !== null) {
    await boot(app);
  }
}

await start(document);

export { run, start };
