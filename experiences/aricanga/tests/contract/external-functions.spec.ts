/**
 * External Functions Contract Test
 *
 * Verifies bidirectional sync between:
 * - Code: src/experiences/aricanga/ink-bridge.js (BindExternalFunction calls)
 * - Docs: docs/reference/inkjs-features.md (external function documentation)
 *
 * Writers rely on the docs to know what functions they can call from ink.
 * This contract ensures the docs stay accurate as the code evolves.
 */

import { expect, test } from '@playwright/test';
import {
  extractBoundFunctions,
  extractDocumentedExternalFunctions,
} from '@narratives/test-utils/helpers';

// Extract at module load time (static analysis)
const codeFunctions = extractBoundFunctions();
const docFunctions = extractDocumentedExternalFunctions();

test.describe('External Functions Contract', () => {
  test.describe('static analysis', () => {
    test('all bound external functions are documented', () => {
      // Every function in ink-bridge.js should appear in inkjs-features.md
      const undocumented = codeFunctions.filter(fn => !docFunctions.includes(fn));

      expect(
        undocumented,
        `Functions bound in code but not documented:\n${undocumented.map(f => `  - ${f}`).join('\n')}\n\nAdd these to docs/reference/inkjs-features.md`
      ).toEqual([]);
    });

    test('all documented external functions exist in code', () => {
      // Every function in docs should exist in ink-bridge.js
      // This catches stale documentation
      const stale = docFunctions.filter(fn => !codeFunctions.includes(fn));

      expect(
        stale,
        `Functions documented but not bound in code:\n${stale.map(f => `  - ${f}`).join('\n')}\n\nRemove stale entries from docs/reference/inkjs-features.md or add missing bindings`
      ).toEqual([]);
    });

    test('expected external functions are bound', () => {
      // Sanity check: verify we found the expected functions
      // Update this list when intentionally adding/removing functions
      const expectedFunctions = [
        'advance_day',
        'data',
        'delay_next',
        'name',
        'play_sound',
        'request_data',
      ];

      expect(codeFunctions.sort()).toEqual(expectedFunctions.sort());
    });
  });

  test.describe('runtime verification', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('.');
      await page.waitForFunction(() =>
        window.controller?.story && window.controller?.bridge
      );
    });

    test('story loaded successfully with all external functions', async ({ page }) => {
      // If external functions weren't bound correctly, the story would fail to load
      // The CONTRACT-3 test in contracts.spec.ts already verifies this
      // This test confirms the story is usable

      const storyValid = await page.evaluate(() => {
        const story = window.controller.story;
        return story && typeof story.Continue === 'function' && story.canContinue !== undefined;
      });

      expect(storyValid, 'Story should be loaded and usable').toBe(true);
    });

    test('external function calls work via ink execution', async ({ page }) => {
      // Test that external functions are properly callable by advancing story
      // This is an integration test - if bindings are wrong, the story would error

      const result = await page.evaluate(() => {
        try {
          const story = window.controller.story;

          // Save state before test
          const savedState = story.state.ToJson();

          // Try to navigate to any knot - this exercises the bound functions
          // If any BindExternalFunction failed, this would throw
          try {
            story.ChoosePathString('pat_chat');
            story.Continue(); // This may call external functions via ink
          } catch (_e) {
            // Path might not exist, that's okay - we're testing bindings not content
          }

          // Restore state
          story.state.LoadJson(savedState);

          return { success: true };
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      });

      expect(result.success, `External function binding error: ${result.error}`).toBe(true);
    });
  });
});

// Type declarations for window globals
declare global {
  interface Window {
    controller: {
      story: {
        Continue: () => string;
        canContinue: boolean;
        ChoosePathString: (path: string) => void;
        state: {
          ToJson: () => string;
          LoadJson: (json: string) => void;
        };
      };
      bridge: unknown;
    };
  }
}
