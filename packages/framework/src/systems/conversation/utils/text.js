/**
 * text.js - Shared text processing utilities
 *
 * Centralizes HTML escaping, glossary markup processing, and related CSS/event
 * wiring so components don't duplicate this logic.
 */

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape attribute value
 * @param {string} text
 * @returns {string}
 */
export function escapeAttr(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Regex matching glossary markup: ((display text::source:id)) */
const GLOSSARY_RE = /\(\(([^:]+)::([^)]+)\)\)/g;

/**
 * Escape HTML then convert ((value::source)) markers to learning-highlight spans.
 * Use this for any user-visible text that may contain glossary markup.
 * @param {string} text
 * @returns {string} Safe HTML with glossary spans
 */
export function processText(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(
    GLOSSARY_RE,
    '<span class="learning-highlight" data-source="$2">$1</span>',
  );
}

/**
 * Strip glossary markup to plain text (for textContent / length checks).
 * ((Land rights::glossary:land-rights)) → "Land rights"
 * @param {string} text
 * @returns {string}
 */
export function stripGlossaryMarkup(text) {
  return text.replace(GLOSSARY_RE, '$1');
}

/**
 * CSS for .learning-highlight spans. Include in any shadow DOM that renders
 * processText output.
 */
export const LEARNING_HIGHLIGHT_CSS = `
  /* Learning highlights for glossary terms */
  .learning-highlight {
    color: var(--ink-highlight, #0ea5e9);
    font-weight: 500;
    cursor: help;
    border-bottom: 1px dotted currentColor;
  }
  .learning-highlight:hover {
    color: var(--ink-highlight-hover, #38bdf8);
  }
`;

/**
 * Wire glossary click delegation on a shadow root.
 * Clicks on .learning-highlight dispatch a composed glossary-term-clicked event.
 * @param {ShadowRoot} shadowRoot
 * @param {HTMLElement} host - Element to dispatch the event from
 */
export function wireGlossaryClicks(shadowRoot, host) {
  shadowRoot.addEventListener('click', (e) => {
    const highlight = e.target.closest('.learning-highlight');
    if (!highlight) return;
    const source = highlight.dataset.source || '';
    if (source.startsWith('glossary:')) {
      host.dispatchEvent(
        new CustomEvent('glossary-term-clicked', {
          bubbles: true,
          composed: true,
          detail: { termId: source.replace('glossary:', '') },
        }),
      );
    }
  });
}
