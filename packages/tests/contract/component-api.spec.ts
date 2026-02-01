/**
 * Component API Contract Test
 *
 * Verifies sync between:
 * - Code: src/systems/conversation/components/*.js (dispatchEvent calls, public methods)
 * - Docs: docs/reference/component-api.md (events and methods tables)
 *
 * Developers extending the UI rely on these docs to know what events
 * components emit and what methods are available.
 */

import { expect, test } from '@playwright/test';
import {
  extractDocumentedComponentMethods,
  extractDocumentedComponentEvents,
} from '@narratives/test-utils/helpers';

// Extract documented API at module load
const docMethods = extractDocumentedComponentMethods();
const docEvents = extractDocumentedComponentEvents();

// Component selectors - mapping doc names to CSS selectors
const componentSelectors: Record<string, string> = {
  'chat-hub': 'chat-hub',
  'chat-thread': 'chat-thread',
  'notification-popup': 'notification-popup',
  'typing-indicator': 'typing-indicator',
};

test.describe('Component API Contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('.');
    // Wait for components to be registered and rendered
    await page.waitForFunction(() => {
      return (
        customElements.get('chat-hub') &&
        customElements.get('chat-thread') &&
        customElements.get('notification-popup') &&
        customElements.get('typing-indicator')
      );
    }, { timeout: 10000 });
    // Unlock lock screen if visible
    const lockScreen = page.locator('lock-screen:not([hidden])');
    if (await lockScreen.isVisible({ timeout: 1000 }).catch(() => false)) {
      await lockScreen.locator('.fingerprint-btn').click();
      await page.waitForSelector('chat-hub:not([hidden])');
    }
  });

  test.describe('documented methods exist at runtime', () => {
    test('chat-hub methods', async ({ page }) => {
      const methods = docMethods
        .filter(m => m.component === 'chat-hub')
        .map(m => m.method);

      const results = await page.evaluate((methodNames: string[]) => {
        const el = document.querySelector('chat-hub');
        if (!el) return { error: 'chat-hub element not found' };

        return methodNames.map(method => ({
          method,
          exists: typeof (el as unknown as Record<string, unknown>)[method] === 'function',
        }));
      }, methods);

      if ('error' in results) {
        throw new Error(results.error as string);
      }

      for (const { method, exists } of results) {
        expect(exists, `chat-hub.${method}() documented but doesn't exist`).toBe(true);
      }
    });

    test('chat-thread methods', async ({ page }) => {
      const methods = docMethods
        .filter(m => m.component === 'chat-thread')
        .map(m => m.method);

      const results = await page.evaluate((methodNames: string[]) => {
        const el = document.querySelector('chat-thread');
        if (!el) return { error: 'chat-thread element not found' };

        return methodNames.map(method => ({
          method,
          exists: typeof (el as unknown as Record<string, unknown>)[method] === 'function',
        }));
      }, methods);

      if ('error' in results) {
        throw new Error(results.error as string);
      }

      for (const { method, exists } of results) {
        expect(exists, `chat-thread.${method}() documented but doesn't exist`).toBe(true);
      }
    });

    test('notification-popup methods', async ({ page }) => {
      const methods = docMethods
        .filter(m => m.component === 'notification-popup')
        .map(m => m.method);

      const results = await page.evaluate((methodNames: string[]) => {
        const el = document.querySelector('notification-popup');
        if (!el) return { error: 'notification-popup element not found' };

        return methodNames.map(method => ({
          method,
          exists: typeof (el as unknown as Record<string, unknown>)[method] === 'function',
        }));
      }, methods);

      if ('error' in results) {
        throw new Error(results.error as string);
      }

      for (const { method, exists } of results) {
        expect(exists, `notification-popup.${method}() documented but doesn't exist`).toBe(true);
      }
    });

    test('typing-indicator methods', async ({ page }) => {
      const methods = docMethods
        .filter(m => m.component === 'typing-indicator')
        .map(m => m.method);

      const results = await page.evaluate((methodNames: string[]) => {
        // typing-indicator may be inside chat-thread's shadow DOM or at top level
        let el = document.querySelector('typing-indicator');
        if (!el) {
          const thread = document.querySelector('chat-thread');
          el = thread?.shadowRoot?.querySelector('typing-indicator') ?? null;
        }
        if (!el) return { error: 'typing-indicator element not found' };

        return methodNames.map(method => ({
          method,
          exists: typeof (el as unknown as Record<string, unknown>)[method] === 'function',
        }));
      }, methods);

      if ('error' in results) {
        throw new Error(results.error as string);
      }

      for (const { method, exists } of results) {
        expect(exists, `typing-indicator.${method}() documented but doesn't exist`).toBe(true);
      }
    });
  });

  test.describe('documented events are emitted', () => {
    test('chat-hub emits chat-selected on item click', async ({ page }) => {
      const events = docEvents.filter(e => e.component === 'chat-hub');
      expect(events.some(e => e.event === 'chat-selected')).toBe(true);

      // Verify component can emit the event (check event handler pattern in code)
      // Use Playwright's click which handles shadow DOM properly
      const hub = page.locator('chat-hub');
      await expect(hub).toBeVisible();

      // Listen for the event before clicking
      const eventPromise = page.evaluate(() => {
        return new Promise<{ chatId: string } | null>((resolve) => {
          const hub = document.querySelector('chat-hub');
          if (!hub) {
            resolve(null);
            return;
          }
          const timeout = setTimeout(() => resolve(null), 2000);
          hub.addEventListener('chat-selected', (e: Event) => {
            clearTimeout(timeout);
            resolve((e as CustomEvent).detail);
          }, { once: true });
        });
      });

      // Click first chat item using Playwright's locator
      await page.locator('chat-hub').locator('[data-chat]').first().click();

      const eventDetail = await eventPromise;
      expect(eventDetail, 'chat-hub should emit chat-selected with chatId').not.toBeNull();
      expect(eventDetail?.chatId).toBeDefined();
    });

    test('notification-popup documents expected events', async ({ page }) => {
      const events = docEvents
        .filter(e => e.component === 'notification-popup')
        .map(e => e.event);

      // Verify expected events are documented
      // notification-popup is view-only (drawer is SSOT), so it only emits click/dismiss
      expect(events).toContain('notification-clicked');
      expect(events).toContain('notification-dismissed');

      // Verify notification-popup has show and dismiss methods
      const methodsExist = await page.evaluate(() => {
        const popup = document.querySelector('notification-popup');
        if (!popup) return { error: 'notification-popup not found' };

        const typedPopup = popup as unknown as Record<string, unknown>;
        return {
          show: typeof typedPopup.show === 'function',
          dismiss: typeof typedPopup.dismiss === 'function',
        };
      });

      if ('error' in methodsExist) {
        throw new Error(methodsExist.error as string);
      }

      expect(methodsExist.show, 'notification-popup should have show() method').toBe(true);
      expect(methodsExist.dismiss, 'notification-popup should have dismiss() method').toBe(true);
    });
  });

  test.describe('method signatures match documentation', () => {
    test('chat-hub.setUnread accepts (chatId, unread)', async ({ page }) => {
      const result = await page.evaluate(() => {
        const hub = document.querySelector('chat-hub') as unknown as {
          setUnread?: (chatId: string, unread: boolean) => void;
        };

        if (!hub?.setUnread) return { error: 'setUnread not found' };

        try {
          // Should accept string and boolean without throwing
          hub.setUnread('pat', true);
          hub.setUnread('pat', false);
          return { success: true };
        } catch (e) {
          return { error: (e as Error).message };
        }
      });

      expect(result).toEqual({ success: true });
    });

    test('chat-hub.setPreview accepts (chatId, text, time)', async ({ page }) => {
      const result = await page.evaluate(() => {
        const hub = document.querySelector('chat-hub') as unknown as {
          setPreview?: (chatId: string, text: string, time: string) => void;
        };

        if (!hub?.setPreview) return { error: 'setPreview not found' };

        try {
          hub.setPreview('pat', 'Hello!', '10:00');
          return { success: true };
        } catch (e) {
          return { error: (e as Error).message };
        }
      });

      expect(result).toEqual({ success: true });
    });

    test('typing-indicator.show accepts optional speaker', async ({ page }) => {
      const result = await page.evaluate(() => {
        // typing-indicator may be nested in chat-thread's shadow DOM
        let indicator: HTMLElement | null = document.querySelector('typing-indicator');
        if (!indicator) {
          const thread = document.querySelector('chat-thread');
          indicator = thread?.shadowRoot?.querySelector('typing-indicator') ?? null;
        }

        if (!indicator) {
          return { error: 'typing-indicator not found' };
        }

        const typedIndicator = indicator as unknown as {
          show?: (speaker?: string) => void;
          hide?: () => void;
        };

        if (!typedIndicator.show || !typedIndicator.hide) {
          return { error: 'show or hide not found' };
        }

        try {
          // Should work with and without speaker
          typedIndicator.show('Pat');
          typedIndicator.hide();
          typedIndicator.show();
          typedIndicator.hide();
          return { success: true };
        } catch (e) {
          return { error: (e as Error).message };
        }
      });

      expect(result).toEqual({ success: true });
    });
  });

  test('expected components are documented', () => {
    // Sanity check: ensure key components have doc coverage
    const documentedComponents = [...new Set(docMethods.map(m => m.component))];

    expect(documentedComponents).toContain('chat-hub');
    expect(documentedComponents).toContain('chat-thread');
    expect(documentedComponents).toContain('notification-popup');
    expect(documentedComponents).toContain('typing-indicator');
  });
});
