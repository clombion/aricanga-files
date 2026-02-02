# Creating a Custom Component

Build a web component that integrates with the conversation system.

**Prerequisites:** JavaScript/Web Components familiarity, project setup complete

---

## What You'll Learn

- Web component structure with Shadow DOM
- CSS variables for theming
- Event integration with the conversation system
- Accessibility requirements

---

## Example: Status Badge Component

We'll create a component that shows online/offline status.

### Step 1: Create the Component File

Create `packages/framework/src/systems/conversation/components/status-badge.js`:

```javascript
// Status Badge - Shows online/offline indicator
// Used in chat headers and contact lists

import { t } from '../services/conversation-context.js';
import { escapeHtml } from '../utils/text.js';

export class StatusBadge extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._online = false;
  }

  // Observed attributes trigger attributeChangedCallback
  static get observedAttributes() {
    return ['online'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'online') {
      this._online = newValue !== null && newValue !== 'false';
      this.render();
    }
  }

  // Public API
  setOnline(value) {
    this._online = Boolean(value);
    this.render();
  }

  render() {
    const statusText = this._online
      ? t('ui.status.online')
      : t('ui.status.offline');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          gap: var(--ink-space-xs, 4px);
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ink-color-offline, #8e8e93);
        }

        :host([online]) .dot,
        .dot.online {
          background: var(--ink-color-online, #30d158);
        }

        .label {
          font-size: var(--ink-font-size-small, 0.85em);
          color: var(--ink-color-text-muted, #8e8e93);
        }

        @media (prefers-reduced-motion: reduce) {
          .dot {
            transition: none;
          }
        }
      </style>

      <span
        class="dot ${this._online ? 'online' : ''}"
        aria-hidden="true"
      ></span>
      <span class="label">${escapeHtml(statusText)}</span>
    `;
  }
}

customElements.define('status-badge', StatusBadge);
```

### Step 2: Register the Component

Add to `packages/framework/src/systems/conversation/components/index.js`:

```javascript
// ... existing imports
export { StatusBadge } from './status-badge.js';
```

### Step 3: Use the Component

In HTML:
```html
<status-badge online></status-badge>
<status-badge></status-badge>
```

In JavaScript:
```javascript
const badge = document.createElement('status-badge');
badge.setOnline(true);
container.appendChild(badge);
```

---

## Component Patterns

### Shadow DOM Encapsulation

Always use Shadow DOM to prevent style leakage:

```javascript
constructor() {
  super();
  this.attachShadow({ mode: 'open' });  // Required
}
```

### CSS Variables

Use the `--ink-*` design tokens for consistency:

```css
.element {
  /* Colors */
  color: var(--ink-color-text, #fff);
  background: var(--ink-color-surface, #1c1c1e);

  /* Spacing */
  padding: var(--ink-space-md, 15px);
  gap: var(--ink-space-sm, 8px);

  /* Typography */
  font-size: var(--ink-font-size-base, 1rem);

  /* Borders */
  border-radius: var(--ink-radius-md, 12px);
}
```

Always provide fallback values.

### Internationalization

Use the `t()` function for user-facing text:

```javascript
import { t } from '../services/conversation-context.js';

// Simple string
const label = t('ui.status.online');  // "online"

// With interpolation
const status = t('ui.status.last_seen', { time: '5:30 PM' });  // "last seen 5:30 PM"
```

### XSS Prevention

Import text utilities from the shared module — don't define your own:

```javascript
import { escapeHtml, processText, LEARNING_HIGHLIGHT_CSS } from '../utils/text.js';

// escapeHtml: safe plain text
this.shadowRoot.innerHTML = `<span>${escapeHtml(userInput)}</span>`;

// processText: safe HTML with glossary highlights (for text that may contain ((term::glossary:id)) markup)
this.shadowRoot.innerHTML = `
  <style>${LEARNING_HIGHLIGHT_CSS}</style>
  <span>${processText(statusText)}</span>
`;
```

For glossary click handling, use `wireGlossaryClicks`. It's idempotent — safe to call from `render()` without stacking duplicate listeners:

```javascript
import { wireGlossaryClicks } from '../utils/text.js';

// In your wireEvents() or render():
wireGlossaryClicks(this.shadowRoot, this);
```

For read-more toggle handling on truncated messages, use `wireReadMoreToggles` (also idempotent):

```javascript
import { wireReadMoreToggles } from '../utils/text.js';

wireReadMoreToggles(this.shadowRoot);
```

---

## Accessibility Requirements

### Semantic Elements

```javascript
// Good - semantic button
<button class="action" aria-label="${t('ui.a11y.close')}">×</button>

// Bad - div as button
<div class="action" onclick="...">×</div>
```

### ARIA Labels

```javascript
// For icon-only buttons
<button aria-label="${t('ui.a11y.back_to_chat_list')}">
  <svg aria-hidden="true">...</svg>
</button>

// For status regions
<div role="status" aria-live="polite">${statusText}</div>
```

### Focus Management

```javascript
// When showing a modal/dialog
const closeButton = this.shadowRoot.querySelector('.close-btn');
closeButton?.focus();

// When content updates
const messagesArea = this.shadowRoot.querySelector('.messages');
messagesArea?.focus();
```

### Keyboard Navigation

```javascript
// Support Enter/Space for custom interactive elements
element.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    this.handleActivation();
  }
});
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .animated {
    animation: none;
    transition: none;
  }
}
```

---

## Event Integration

### Dispatching Events

```javascript
// Dispatch custom event for parent components
this.dispatchEvent(new CustomEvent('status-change', {
  bubbles: true,
  composed: true,  // Crosses shadow DOM boundary
  detail: { online: this._online }
}));
```

### Listening to EventBus

```javascript
import { eventBus } from '../services/event-bus.js';

connectedCallback() {
  this._unsubscribe = eventBus.on('chat:opened', (data) => {
    this.handleChatOpened(data.chatId);
  });
  this.render();
}

disconnectedCallback() {
  this._unsubscribe?.();
}
```

---

## Testing Your Component

1. **Manual testing**: Add to a page and inspect in DevTools
2. **Accessibility**: Run axe DevTools extension
3. **Keyboard**: Navigate using Tab, Enter, Space
4. **Screen reader**: Test with VoiceOver (Mac) or NVDA (Windows)

---

## Checklist

- [ ] Uses `attachShadow({ mode: 'open' })`
- [ ] Styles use CSS variables with fallbacks
- [ ] User text uses `t()` for i18n
- [ ] Dynamic content escaped with `escapeHtml()` from `utils/text.js`
- [ ] Interactive elements have `aria-label`
- [ ] Keyboard accessible (Enter/Space)
- [ ] Respects `prefers-reduced-motion`
- [ ] Cleanup in `disconnectedCallback`
- [ ] Registered in `components/index.js`

---

## What's Next?

- [Integrating Ink Variables](./ink-variables-ui.md) - Connect components to story state
