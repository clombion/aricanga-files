// The message element in real browsers: the booted sandbox mounts its part into a shadow root, a
// new view-model updates the part's text in place, and disconnecting disposes the root. Every
// console warning or error the page prints (Solid's dev diagnostics among them) fails the test.

import type { ConsoleMessage, Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** The page members the spec drives. */
type DrivenPage = Readonly<Pick<Page, 'goto' | 'locator' | 'on'>>;

/** The test arguments a spec reads. */
interface SpecArguments {
  readonly page: DrivenPage;
}

/** The console levels that fail a test. */
const LOUD = new Set(['error', 'warning']);

/** The bubbles a message element's shadow root holds. */
const ONE_BUBBLE = 1;

/** The first message the sandbox's story renders. */
const FIRST_MESSAGE = 'Skeleton: The walking skeleton works.';

/**
 * Collect every loud console message and uncaught error the page prints.
 * @param {DrivenPage} page The page.
 * @returns {readonly string[]} The messages, appended as they come.
 */
function loudConsole(page: DrivenPage): readonly string[] {
  const heard: string[] = [];
  page.on('console', (message: Readonly<Pick<ConsoleMessage, 'text' | 'type'>>) => {
    if (LOUD.has(message.type())) {
      heard.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error: Readonly<Pick<Error, 'message'>>) => {
    heard.push(`pageerror: ${error.message}`);
  });
  return heard;
}

/**
 * The body of a test: boot the sandbox, wait for its first message, run `check` on that element,
 * and hold the console quiet throughout.
 * @param {Function} check The assertions over the first message element.
 * @returns {Function} The test body.
 */
function booted(check: (message: Locator) => Promise<void>): (args: SpecArguments) => Promise<void> {
  return async ({ page }: SpecArguments): Promise<void> => {
    const heard = loudConsole(page);
    await page.goto('/');
    const message = page.locator('sk-message').first();
    await expect(message.locator('p[part="bubble"]')).toHaveText(FIRST_MESSAGE);
    await check(message);
    expect(heard).toStrictEqual([]);
  };
}

test.describe('sk-message', () => {
  test(
    'mounts its part into its shadow root',
    booted(async (message) => {
      const light = await message.evaluate((node: Readonly<Pick<Node, 'hasChildNodes'>>) => node.hasChildNodes());
      expect(light).toBe(false);
      await expect(message.locator('p[part="bubble"]')).toHaveCount(ONE_BUBBLE);
    }),
  );

  test(
    'a new view-model updates the text in place',
    booted(async (message) => {
      const bubble = await message.locator('p[part="bubble"]').elementHandle();
      await message.evaluate(() => {
        document.querySelector('sk-message')?.show({ text: 'updated' });
      });
      await expect(message.locator('p[part="bubble"]')).toHaveText('updated');
      // The node rendered before the update is the one showing the new text.
      const kept = await bubble.evaluate((node: Readonly<Pick<Node, 'isConnected' | 'textContent'>>) => [
        node.isConnected,
        node.textContent,
      ]);
      expect(kept).toStrictEqual([true, 'updated']);
    }),
  );

  test(
    'disconnecting disposes the root, and reconnecting renders it afresh',
    booted(async (message) => {
      const disposed = await message.evaluate(() => {
        const element = document.querySelector('sk-message');
        const bubble = element?.shadowRoot?.querySelector('p[part="bubble"]');
        const app = element?.parentElement;
        element?.remove();
        // Disposing the root takes its nodes out of the shadow root: the bubble is its own root.
        const outside = bubble?.getRootNode() === bubble;
        if (element !== null) {
          app?.prepend(element);
        }
        return outside;
      });
      expect(disposed).toBe(true);
      await expect(message.locator('p[part="bubble"]')).toHaveText(FIRST_MESSAGE);
    }),
  );
});
