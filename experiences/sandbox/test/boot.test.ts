// The sandbox's boot: it fetches the compiled story into the page's #app, and shows a failure there.

import { describe, expect, test, vi } from 'vitest';
import { SkMessage } from '#src/sk-message';
import { compileInk } from '@narratives/foundation/testing';
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
 * @returns {string[]} The URLs requested, filled as the boot runs.
 */
function stubFetch(answer: () => Promise<Response>): string[] {
  const requested: string[] = [];
  vi.stubGlobal('fetch', async (url: string): Promise<Response> => {
    requested.push(url);
    const response = await answer();
    return response;
  });
  return requested;
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
    texts.push(element.text);
  }
  return texts;
}

describe('the sandbox boot', () => {
  test('fetches the story and renders a message per line that carries text', async () => {
    expect.hasAssertions();
    const requested = stubFetch(async () => {
      const response = await Promise.resolve(new Response(compileInk(STORY)));
      return response;
    });
    const root = page();
    await start(root);
    const texts = messageTexts(root);
    expect(requested).toStrictEqual(['/story.json']);
    expect(texts).toStrictEqual(['Narrated.', 'Pat: Spoken.']);
  });

  test('shows the failure in #app when the story cannot be fetched', async () => {
    expect.hasAssertions();
    stubFetch(async () => {
      await Promise.reject(new Error('offline'));
      return new Response('');
    });
    const root = page();
    await start(root);
    expect(root.textContent).toBe('walking skeleton failed: Error: offline');
  });

  test('does nothing on a page without #app', async () => {
    expect.hasAssertions();
    const requested = stubFetch(async () => {
      const response = await Promise.resolve(new Response(''));
      return response;
    });
    const root = document.createElement('main');
    await start(root);
    expect(requested).toStrictEqual([]);
    expect(root.hasChildNodes()).toBe(false);
  });
});
