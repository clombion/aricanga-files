/**
 * Glossary Page - Full-page glossary UI with search
 *
 * Shows all glossary terms with definitions.
 * Supports search filtering and scrolling to specific terms.
 */

import { eventBus } from '@narratives/framework';
import { loadGlossary, searchTerms } from '../services/glossary-service.js';
import { I18N_EVENTS, i18n } from '../services/i18n.js';

/**
 * GlossaryPage - Full-page glossary UI
 *
 * @element glossary-page
 * @fires {CustomEvent} navigate-back - When user presses back button
 */
export class GlossaryPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._onLocaleChanged = this._onLocaleChanged.bind(this);
    this._searchQuery = '';
    this._highlightedTermId = null;
    this._debounceTimer = null;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    eventBus.on(I18N_EVENTS.LOCALE_READY, this._onLocaleChanged);
    eventBus.on(I18N_EVENTS.LOCALE_CHANGED, this._onLocaleChanged);
  }

  disconnectedCallback() {
    eventBus.off(I18N_EVENTS.LOCALE_READY, this._onLocaleChanged);
    eventBus.off(I18N_EVENTS.LOCALE_CHANGED, this._onLocaleChanged);
  }

  _onLocaleChanged() {
    this.render();
    this.setupEventListeners();
  }

  /**
   * Prepare glossary content. Does NOT set hidden or scroll —
   * visibility is owned by transitionViews(), scroll by scrollToTerm().
   * @param {string|null} termId - Term ID to highlight (stored for render)
   */
  async show(termId = null) {
    await loadGlossary();
    this._highlightedTermId = termId;
    this._searchQuery = '';
    this.render();
    this.setupEventListeners();
  }

  /**
   * Scroll to and highlight a specific term. Call after transition completes.
   * @param {string|null} termId - Term ID to scroll to
   */
  scrollToTerm(termId) {
    if (!termId) return;
    const termEl = this.shadowRoot.querySelector(
      `.term-card[data-term-id="${termId}"]`,
    );
    if (termEl) {
      termEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      termEl.classList.add('highlighted');
      setTimeout(() => termEl.classList.remove('highlighted'), 2000);
    }
  }

  setupEventListeners() {
    this.shadowRoot
      .querySelector('.back-button')
      ?.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('navigate-back', {
            bubbles: true,
            composed: true,
          }),
        );
      });

    // Search input (debounced)
    const searchInput = this.shadowRoot.querySelector('.search-input');
    searchInput?.addEventListener('input', (e) => {
      this._searchQuery = e.target.value;
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.renderTermsList(), 200);
    });
  }

  renderTermsList() {
    const container = this.shadowRoot.querySelector('.terms-list');
    if (!container) return;

    const terms = searchTerms(this._searchQuery);
    const strings = this.getStrings();

    if (terms.length === 0) {
      container.innerHTML = `<div class="empty">${strings.noResults}</div>`;
      return;
    }

    container.innerHTML = terms
      .map(
        (term) => `
      <div class="term-card" data-term-id="${term.id}">
        <div class="term-name">${this.escapeHtml(term.term)}</div>
        <div class="term-definition">${this.escapeHtml(term.definition)}</div>
        <div class="term-category">${this.escapeHtml(term.category)}</div>
      </div>
    `,
      )
      .join('');
  }

  getStrings() {
    return {
      title: i18n.t('glossary.title') || 'Glossary',
      searchPlaceholder: i18n.t('glossary.search') || 'Search terms...',
      noResults: i18n.t('glossary.no_results') || 'No terms found',
      back: i18n.t('a11y.back') || 'Back',
    };
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  render() {
    const strings = this.getStrings();
    const terms = searchTerms(this._searchQuery);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--ink-color-bg, #121216);
        }
        :host([hidden]) {
          display: none;
        }

        /* Header - matches settings-page */
        .header {
          display: flex;
          align-items: center;
          padding: var(--ink-space-sm, 8px) var(--ink-space-md, 15px);
          background: var(--ink-color-header, #1a1a20);
          flex-shrink: 0;
        }
        .back-button {
          background: none;
          border: none;
          color: var(--ink-color-accent, #5b7cfa);
          font-size: 1.5em;
          cursor: pointer;
          padding: 5px 10px 5px 0;
        }
        .back-button:hover {
          opacity: 0.8;
        }
        .back-button:focus-visible {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: 2px;
          border-radius: 4px;
        }
        .header-title {
          font-weight: 600;
          font-size: 1.1em;
          color: var(--ink-color-text, #e8e8ed);
        }

        /* Search bar */
        .search-bar {
          padding: var(--ink-space-sm, 12px) var(--ink-space-lg, 20px);
          background: var(--ink-color-header, #1a1a20);
          border-bottom: 1px solid var(--ink-border-subtle, rgba(255, 255, 255, 0.08));
        }
        .search-input {
          width: 100%;
          padding: 10px 14px;
          border: none;
          border-radius: var(--ink-radius-button, 20px);
          background: var(--ink-color-surface, #1e1e24);
          color: var(--ink-color-text, #e8e8ed);
          font-size: 0.95em;
          font-family: inherit;
        }
        .search-input::placeholder {
          color: var(--ink-color-text-muted, #71717a);
        }
        .search-input:focus {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: -2px;
        }

        /* Content area */
        .content {
          flex: 1;
          overflow-y: auto;
          padding: var(--ink-space-md, 16px) var(--ink-space-lg, 20px);
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .content::-webkit-scrollbar {
          display: none;
        }

        /* Terms list */
        .terms-list {
          display: flex;
          flex-direction: column;
          gap: var(--ink-space-sm, 12px);
        }

        /* Term card */
        .term-card {
          background: var(--ink-color-surface, #1e1e24);
          border-radius: var(--ink-radius-card, 12px);
          padding: var(--ink-space-md, 16px);
          transition: background 0.2s ease;
        }
        .term-card.highlighted {
          background: var(--ink-color-accent-dim, rgba(91, 124, 250, 0.2));
          animation: pulse 0.5s ease-in-out 2;
        }
        @keyframes pulse {
          0%, 100% { background: var(--ink-color-accent-dim, rgba(91, 124, 250, 0.2)); }
          50% { background: var(--ink-color-accent-dim, rgba(91, 124, 250, 0.35)); }
        }

        .term-name {
          color: var(--ink-highlight, #0ea5e9);
          font-weight: 600;
          font-size: 1em;
          margin-bottom: var(--ink-space-xs, 6px);
        }
        .term-definition {
          color: var(--ink-color-text, #e8e8ed);
          font-size: 0.9em;
          line-height: 1.5;
          margin-bottom: var(--ink-space-xs, 6px);
        }
        .term-category {
          color: var(--ink-color-text-muted, #71717a);
          font-size: 0.75em;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Empty state */
        .empty {
          color: var(--ink-color-text-muted, #71717a);
          text-align: center;
          padding: var(--ink-space-xl, 40px) var(--ink-space-md, 16px);
          font-size: 0.95em;
        }

        @media (prefers-reduced-motion: reduce) {
          .term-card.highlighted {
            animation: none;
          }
        }
      </style>

      <header class="header">
        <button
          class="back-button"
          aria-label="${strings.back}"
          data-testid="glossary-back"
        >&lsaquo;</button>
        <span class="header-title">${strings.title}</span>
      </header>

      <div class="search-bar">
        <input
          type="search"
          class="search-input"
          placeholder="${strings.searchPlaceholder}"
          value="${this.escapeHtml(this._searchQuery)}"
          aria-label="${strings.searchPlaceholder}"
        >
      </div>

      <div class="content">
        <div class="terms-list">
          ${
            terms.length === 0
              ? `<div class="empty">${strings.noResults}</div>`
              : terms
                  .map(
                    (term) => `
              <div class="term-card" data-term-id="${term.id}">
                <div class="term-name">${this.escapeHtml(term.term)}</div>
                <div class="term-definition">${this.escapeHtml(term.definition)}</div>
                <div class="term-category">${this.escapeHtml(term.category)}</div>
              </div>
            `,
                  )
                  .join('')
          }
        </div>
      </div>
    `;
  }
}

customElements.define('glossary-page', GlossaryPage);
