/** What the fixtures share: a message's shape, a macrotask wait, an error's text and a mounted view. */

import type { JSX } from '@solidjs/web';
import { render } from '@solidjs/web';

/** A chat message as the snapshot adapter reconciles it, by id. */
interface Message {
  readonly id: string;
  readonly text: string;
}

/** A view mounted into a fresh host. */
interface Mounted<Host> {
  readonly host: Host;
  readonly dispose: () => void;
}

/** No wait at all: the next macrotask, past every pending microtask and flush. */
const NEXT_MACROTASK = 0;

/**
 * Resolve after `milliseconds` on the timer queue: past every pending microtask and flush.
 * @param {number} milliseconds How long to wait.
 * @returns {Promise<void>} Resolves once the timer fires.
 */
async function settle(milliseconds: number = NEXT_MACROTASK): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  setTimeout(resolve, milliseconds);
  await promise;
}

/**
 * The message of a thrown value.
 * @param {unknown} error What was thrown.
 * @returns {string} Its message, or its string form when it is no `Error`.
 */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A view rendered into a fresh `tag` host appended to the body; `dispose` disposes it and removes the host.
 * @param {keyof HTMLElementTagNameMap} tag The host element's tag.
 * @param {Function} view The view to render into it.
 * @returns {Mounted} The host and the disposer.
 */
function mount<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  view: () => JSX.Element,
): Mounted<HTMLElementTagNameMap[Tag]> {
  const host = document.createElement(tag);
  document.body.append(host);
  const disposeView = render(view, host);
  return {
    dispose: () => {
      disposeView();
      host.remove();
    },
    host,
  };
}

export { errorText, mount, settle };
export type { Message };
