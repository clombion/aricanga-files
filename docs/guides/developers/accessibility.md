# Accessibility Guide

> **Audience:** Implementation Developers | Framework Developers

How to write accessible content and maintain CQO-8 compliance.

---

## ARIA Patterns

### Message Log

The message container uses `role="log"` with live region:

```html
<div class="messages"
     role="log"
     aria-live="polite"
     aria-label="Message history"
     tabindex="0">
```

- `role="log"`: Indicates sequential content
- `aria-live="polite"`: Screen readers announce new messages without interrupting
- `tabindex="0"`: Makes region focusable for keyboard users

### Notifications

Notifications use `role="alert"`:

```html
<div class="popup"
     role="alert"
     aria-live="assertive"
     aria-label="New message notification">
```

- `aria-live="assertive"`: Immediate announcement (appropriate for alerts)

### Buttons

All buttons must have accessible names:

```html
<!-- Icon button - needs aria-label -->
<button class="back-btn" aria-label="Back to chat list">
  <svg>...</svg>
</button>

<!-- Text button - inherits from content -->
<button class="choice">I understand</button>
```

### Unread Indicators

Badge dots need screen reader context:

```html
<span class="unread-dot"
      role="status"
      aria-label="Unread messages">
</span>
```

---

## Screen Reader Considerations

### Message Ordering

Messages render in DOM order (oldest first). Screen readers traverse naturally:

```html
<div class="message" data-type="received">Hello</div>
<div class="message" data-type="sent">Hi there</div>
<div class="message" data-type="received">How are you?</div>
```

### Typing Indicator

Announce who is typing:

```javascript
// typing-indicator.js
const label = speaker
  ? i18n.t('ui.status.typing', { name: speaker })  // "Pat is typing"
  : i18n.t('ui.status.someone_typing');            // "Someone is typing"
```

### Choice Buttons

Group choices with accessible label:

```html
<div class="choices"
     role="group"
     aria-label="Available responses">
  <button class="choice">Option 1</button>
  <button class="choice">Option 2</button>
</div>
```

### Hidden Elements

Use `hidden` attribute (not just CSS):

```html
<!-- Correct: screen readers ignore -->
<typing-indicator hidden></typing-indicator>

<!-- Incorrect: may still be announced -->
<typing-indicator style="display: none"></typing-indicator>
```

---

## Testing with axe-core

### Setup

Install `@axe-core/playwright`:

```bash
pnpm add -D @axe-core/playwright
```

### Basic Test

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('chat hub passes accessibility', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('chat-hub');

  const results = await new AxeBuilder({ page })
    .include('chat-hub')
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Enforced Rules

Critical rules (must pass):

| Rule | Description |
|------|-------------|
| `aria-allowed-attr` | ARIA attributes valid for role |
| `aria-required-attr` | Required ARIA attributes present |
| `aria-roles` | Valid ARIA roles |
| `button-name` | Buttons have accessible names |
| `image-alt` | Images have alt text |
| `label` | Form inputs have labels |
| `list/listitem` | List structure valid |

Serious rules (should pass):

| Rule | Description |
|------|-------------|
| `document-title` | Page has title |
| `landmark-one-main` | One main landmark |
| `page-has-heading-one` | h1 present |

### Running Tests

```bash
# Run accessibility tests only
pnpm exec playwright test packages/tests/quality/accessibility.spec.ts

# Run with UI for debugging
pnpm exec playwright test packages/tests/quality/accessibility.spec.ts --ui
```

---

## CQO-8 Compliance Checklist

Before submitting component changes:

### Structure

- [ ] Interactive elements are `<button>` or `<a>`, not `<div onclick>`
- [ ] Lists use `<ul>`/`<ol>` + `<li>`
- [ ] Headings follow hierarchy (h1 → h2 → h3)
- [ ] Semantic HTML used where appropriate

### ARIA

- [ ] All icon buttons have `aria-label`
- [ ] Live regions use appropriate `aria-live` value
- [ ] Status indicators have `role="status"`
- [ ] No redundant ARIA (e.g., `<button role="button">`)

### Keyboard

- [ ] All interactive elements focusable via Tab
- [ ] Focus order matches visual order
- [ ] Focus visible (`:focus-visible` styles)
- [ ] Escape closes modals/popups
- [ ] Enter/Space activates buttons

### Motion

- [ ] Animations respect `prefers-reduced-motion`
- [ ] No auto-playing animations that can't be paused
- [ ] Typing indicator has reduced-motion fallback

---

## Keyboard Navigation

### Focus Management

After choice selection, move focus to message area:

```javascript
// choice-buttons.js
this.dispatchEvent(new CustomEvent('choice-selected', { ... }));
// Focus moves to messages container
this.shadowRoot.querySelector('.messages')?.focus();
```

### Focus Trap in Modals

Use the shared focus trap utility for modals and dialogs:

```javascript
import { createFocusTrap } from '../utils/focus-trap.js';

// In your component
this._focusTrap = createFocusTrap(this.shadowRoot);

// When opening modal
this._focusTrap.activate();  // Stores previous focus, traps Tab

// When closing modal
this._focusTrap.deactivate();  // Restores previous focus
```

The utility handles:
- Storing and restoring `activeElement`
- Trapping Tab/Shift+Tab within container
- Finding focusable elements dynamically

**Used by:** `image-bubble` (lightbox)

### Notification Keyboard

```javascript
popup.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    this._handleClick(id);  // Open chat
  }
  if (e.key === 'Escape') {
    this._handleDismiss(id);  // Dismiss
  }
});
```

---

## Reduced Motion

### CSS Pattern

```css
/* Default: animated */
.dot {
  animation: bounce 1.4s ease-in-out infinite;
}

/* Reduced motion: static alternative */
@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
  }
  .dot:nth-child(1) { opacity: 0.4; }
  .dot:nth-child(2) { opacity: 0.7; }
  .dot:nth-child(3) { opacity: 1; }
}
```

### JavaScript Pattern

```javascript
// Check preference
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// Skip animation
if (prefersReducedMotion) {
  container.scrollTop = container.scrollHeight;
} else {
  container.scrollTo({
    top: container.scrollHeight,
    behavior: 'smooth'
  });
}
```

### Testing Reduced Motion

```typescript
test('respects prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  // Verify animations disabled
  const duration = await page.evaluate(() => {
    const el = document.querySelector('.animated');
    return getComputedStyle(el).animationDuration;
  });

  expect(duration).toBe('0s');
});
```

---

## Related

- [Component API](../../reference/component-api.md) - ARIA in component interfaces
- [CQO Reference](../../reference/cqo.md) - CQO-8 definition
- [Testing Guide](testing.md) - E2E test patterns
