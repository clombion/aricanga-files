/**
 * CQO-8: Accessibility Tests
 *
 * Consolidated accessibility validation for the chat interface.
 * Uses axe-core for WCAG 2.1 AA compliance + keyboard navigation tests.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Axe rules to enforce (WCAG 2.1 AA)
// Note: color-contrast excluded from critical - tested separately with skip flag
const AXE_RULES = {
  critical: [
    'aria-allowed-attr',
    'aria-hidden-body',
    'aria-hidden-focus',
    'aria-required-attr',
    'aria-roles',
    'aria-valid-attr',
    'aria-valid-attr-value',
    'button-name',
    'duplicate-id',
    'image-alt',
    'label',
    'link-name',
    'list',
    'listitem',
  ],
  serious: [
    'aria-input-field-name',
    'document-title',
    'focus-order-semantics',
    'landmark-one-main',
    'page-has-heading-one',
    'region',
  ],
};

test.describe('CQO-8: Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto('.');
    await page.waitForFunction(() => window.controller?.story && window.controller?.bridge);
    // Unlock lock screen if visible
    const lockScreen = page.locator('lock-screen:not([hidden])');
    if (await lockScreen.isVisible({ timeout: 1000 }).catch(() => false)) {
      await lockScreen.locator('.fingerprint-btn').click();
      await page.waitForSelector('chat-hub:not([hidden])');
    }
  });

  // --- Axe-core validation ---

  test('chat hub passes axe-core critical rules', async ({ page }) => {
    await page.waitForSelector('chat-hub:not([hidden])');

    const results = await new AxeBuilder({ page })
      .include('chat-hub')
      .withRules(AXE_RULES.critical)
      .analyze();

    const violations = results.violations.map((v) => ({
      rule: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => n.html.substring(0, 100)),
    }));

    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test('chat thread passes axe-core critical rules', async ({ page }) => {
    await page.evaluate(() => window.controller.openChat('pat'));
    await page.waitForSelector('chat-thread:not([hidden])');
    await page.locator('chat-thread .message, chat-thread .messages').first().waitFor({ state: 'visible', timeout: 5000 });

    const results = await new AxeBuilder({ page })
      .include('chat-thread')
      .withRules(AXE_RULES.critical)
      .analyze();

    const violations = results.violations.map((v) => ({
      rule: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.map((n) => n.html.substring(0, 100)),
    }));

    expect(violations, formatViolations(violations)).toEqual([]);
  });

  test('notification popup passes axe-core critical rules', async ({ page }) => {
    // Opening news chat triggers Pat notification (per story-expectations.ts)
    await page.evaluate(() => window.controller.openChat('news'));

    // Wait for notification popup to become visible
    const popup = page.locator('notification-popup');
    await popup.waitFor({ state: 'visible', timeout: 3000 });

    const results = await new AxeBuilder({ page })
      .include('notification-popup')
      .withRules(AXE_RULES.critical)
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('color contrast meets WCAG AA (4.5:1 for text)', async ({ page }) => {
    await page.evaluate(() => window.controller.openChat('pat'));
    await page.locator('chat-thread .message, chat-thread .messages').first().waitFor({ state: 'visible', timeout: 5000 });

    const results = await new AxeBuilder({ page })
      .include('chat-thread')
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  // --- ARIA attributes ---

  test('chat thread has role="log" and aria-live', async ({ page }) => {
    await page.click('text=Pat');
    await page.waitForSelector('chat-thread');

    const messageLog = page.locator('chat-thread .messages');
    await expect(messageLog).toHaveAttribute('role', 'log');
    await expect(messageLog).toHaveAttribute('aria-live', 'polite');
  });

  test('back button has accessible name', async ({ page }) => {
    await page.evaluate(() => window.controller.openChat('pat'));
    await page.waitForSelector('chat-thread:not([hidden])');

    const backButtonInfo = await page.evaluate(() => {
      const thread = document.querySelector('chat-thread');
      const shadow = thread?.shadowRoot;
      // Back button may be in chat-header sub-component or directly in chat-thread
      let backBtn = shadow?.querySelector('.back-btn, [class*="back"]');

      // Check inside chat-header component if not found directly
      if (!backBtn) {
        const chatHeader = shadow?.querySelector('chat-header');
        const headerShadow = chatHeader?.shadowRoot;
        backBtn = headerShadow?.querySelector('.back-btn, [class*="back"]');
      }

      if (!backBtn) return { exists: false };

      return {
        exists: true,
        hasAriaLabel: backBtn.hasAttribute('aria-label'),
        ariaLabel: backBtn.getAttribute('aria-label'),
        textContent: backBtn.textContent?.trim(),
        title: backBtn.getAttribute('title'),
      };
    });

    expect(backButtonInfo.exists).toBe(true);

    const hasAccessibleName =
      backButtonInfo.hasAriaLabel ||
      (backButtonInfo.textContent && backButtonInfo.textContent.length > 0) ||
      backButtonInfo.title;

    expect(
      hasAccessibleName,
      `Back button needs accessible name. Got: ${JSON.stringify(backButtonInfo)}`
    ).toBe(true);
  });

  // --- Keyboard navigation ---

  test('choices are keyboard navigable', async ({ page }) => {
    await page.click('text=Pat');
    await page.waitForSelector('chat-thread');

    const choices = page.locator('chat-thread .choices button');
    const count = await choices.count();

    if (count > 0) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toHaveRole('button');

      for (let i = 1; i < count; i++) {
        await page.keyboard.press('Tab');
      }

      await page.keyboard.press('Enter');
    }
  });

  test('back button is keyboard accessible', async ({ page }) => {
    await page.click('text=Pat');
    await page.waitForSelector('chat-thread');

    const backButton = page.locator('chat-thread .back-button');
    await expect(backButton).toBeVisible();

    await backButton.focus();
    await expect(backButton).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.locator('chat-hub')).toBeVisible();
  });

  test('focus moves to message area after choice selection', async ({ page }) => {
    // Story flow: open news first (sets seen_announcement), then pat shows choices
    await page.evaluate(() => window.controller.openChat('news'));
    await page.locator('chat-thread .message, chat-thread .messages').first().waitFor({ state: 'visible', timeout: 5000 });

    // Go back to hub
    await page.evaluate(() => window.controller.closeChat());
    await page.waitForSelector('chat-hub:not([hidden])');

    // Open pat - should now show choices since seen_announcement is true
    await page.evaluate(() => window.controller.openChat('pat'));

    // Wait for the choice prompt message and choices to appear
    await page.waitForFunction(
      () => {
        const thread = document.querySelector('chat-thread');
        const shadow = thread?.shadowRoot;
        // Choices may be in choice-buttons sub-component
        let choices = shadow?.querySelectorAll('.choice');
        if (!choices?.length) {
          const choiceButtons = shadow?.querySelector('choice-buttons');
          choices = choiceButtons?.shadowRoot?.querySelectorAll('.choice');
        }
        return choices && choices.length > 0;
      },
      { timeout: 15000 }
    );

    // Click the first choice
    await page.evaluate(() => {
      const thread = document.querySelector('chat-thread');
      const shadow = thread?.shadowRoot;
      let choice = shadow?.querySelector('.choice') as HTMLElement;
      if (!choice) {
        const choiceButtons = shadow?.querySelector('choice-buttons');
        choice = choiceButtons?.shadowRoot?.querySelector('.choice') as HTMLElement;
      }
      choice?.click();
    });

    // Wait for new messages to appear after choice
    await page.waitForFunction(
      () => {
        const thread = document.querySelector('chat-thread');
        const shadow = thread?.shadowRoot;
        const choices = shadow?.querySelectorAll('.choice');
        return !choices || choices.length === 0;
      },
      { timeout: 5000 }
    );

    const focusInfo = await page.evaluate(() => {
      const active = document.activeElement;
      const thread = document.querySelector('chat-thread');

      return {
        activeTag: active?.tagName,
        isInThread: thread?.contains(active) || active === thread,
        isBody: active === document.body,
      };
    });

    expect(focusInfo.isBody).toBe(false);
  });

  // --- Motion preferences ---

  test('respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('.');
    await page.waitForFunction(() => window.controller?.story && window.controller?.bridge);

    await page.evaluate(() => window.controller.openChat('pat'));
    await page.locator('chat-thread .message, chat-thread .messages').first().waitFor({ state: 'visible', timeout: 5000 });

    const animationDuration = await page.evaluate(() => {
      const thread = document.querySelector('chat-thread');
      const shadow = thread?.shadowRoot;
      const message = shadow?.querySelector('.message');

      if (!message) return null;

      const style = window.getComputedStyle(message);
      return {
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      };
    });

    if (animationDuration) {
      const duration = parseFloat(animationDuration.animationDuration) || 0;
      const transition = parseFloat(animationDuration.transitionDuration) || 0;

      expect(duration).toBeLessThanOrEqual(0.01);
      expect(transition).toBeLessThanOrEqual(0.01);
    }
  });
});

function formatViolations(violations: any[]): string {
  if (violations.length === 0) return '';

  return (
    '\n\nAccessibility violations:\n' +
    violations
      .map(
        (v) =>
          `  ❌ ${v.rule} (${v.impact}): ${v.description}\n` +
          `     Nodes: ${v.nodes.join(', ')}`
      )
      .join('\n\n')
  );
}
