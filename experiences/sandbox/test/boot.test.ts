// The sandbox's boot: it fetches the compiled story into the page's #app, and shows a failure there.

import { describe, test, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { SkMessage } from '#parts/sk-message';
import { compileInk } from '@narratives/foundation/testing';
import { flush } from 'solid-js';
import { start } from '#src/main';

/** A story with a narrated line, a line spoken by a speaker, and a line with no text. */
const STORY = 'Narrated.\nSpoken. # speaker: Pat\n# tag-only\n';

/**
 * A page holding an `#app` element.
 *
 * @returns {HTMLElement} The page's `#app`.
 */
function page(): HTMLElement {
  const app = document.createElement('div');
  app.id = 'app';
  const root = document.createElement('main');
  root.append(app);
  return root;
}

/**
 * Stub the platform's fetch with a function answering every request.
 *
 * @param {Function} answer - What each request resolves or rejects with.
 * @returns {MockInstance} The stub, which records the requests.
 */
function stubFetch(answer: () => Promise<Response>): MockInstance<typeof fetch> {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(answer);
}

/**
 * The texts of the messages rendered under `root`.
 *
 * @param {ParentNode} root - Where the boot rendered.
 * @returns {readonly string[]} Each message's text, in order.
 */
function messageTexts(root: Readonly<Pick<ParentNode, 'querySelectorAll'>>): readonly string[] {
  const texts: string[] = [];
  for (const element of root.querySelectorAll('sk-message')) {
    if (!(element instanceof SkMessage)) {
      throw new TypeError('the boot rendered an sk-message element that is no SkMessage');
    }
    texts.push(element.shadowRoot?.textContent ?? '');
  }
  return texts;
}

describe('the sandbox boot', () => {
  test('fetches the story and renders a message per line that carries text', async ({ expect }) => {
    expect.hasAssertions();
    const requested = stubFetch(async () => {
      const response = await Promise.resolve(new Response(compileInk(STORY)));
      return response;
    });
    const root = page();
    await start(root);
    // The messages render once the page holds them: the boot fills an `#app` the test never connects.
    document.body.append(root);
    flush();
    const texts = messageTexts(root);
    expect(requested).toHaveBeenCalledWith('/story.json');
    expect(texts).toStrictEqual(['Narrated.', 'Pat: Spoken.']);
  });

  test('shows the failure in #app when the story cannot be fetched', async ({ expect }) => {
    expect.hasAssertions();
    stubFetch(async () => {
      await Promise.reject(new Error('offline'));
      return new Response('');
    });
    const root = page();
    await start(root);
    expect(root.textContent).toBe('walking skeleton failed: Error: offline');
  });

  test('does nothing on a page without #app', async ({ expect }) => {
    expect.hasAssertions();
    const requested = stubFetch(async () => {
      const response = await Promise.resolve(new Response(''));
      return response;
    });
    const root = document.createElement('main');
    await start(root);
    expect(requested).not.toHaveBeenCalled();
    expect(root.hasChildNodes()).toBe(false);
  });
});
