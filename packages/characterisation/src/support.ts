/** What the fixtures share: a message's shape, a macrotask wait, an error's text and a mounted view. */

import { render } from '@solidjs/web';

/** A chat message as the snapshot adapter reconciles it, by id. */
export interface Message {
  readonly id: string;
  readonly text: string;
}

/** Resolve after `milliseconds` on the timer queue: past every pending microtask and flush. */
export async function settle(milliseconds = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** The message of a thrown value. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A view rendered into a fresh `tag` host appended to the body; `dispose` disposes it and removes the host. */
export function mount<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  view: Parameters<typeof render>[0],
): { readonly host: HTMLElementTagNameMap[K]; readonly dispose: () => void } {
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
