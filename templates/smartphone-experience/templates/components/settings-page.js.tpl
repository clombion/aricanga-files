/**
 * Settings Page - Full-page settings UI with language selection
 *
 * Design follows the same navigation pattern as chat-thread:
 * - Header with back button to return to hub
 * - Section headers in accent color
 * - Setting rows with title and value/description
 *
 * Reference: local/Screenshot_20260114-224300.png
 */

import { eventBus } from '@narratives/framework';
import { GAME, I18N } from '../config.js';
import { I18N_EVENTS, i18n } from '../services/i18n.js';

/**
 * SettingsPage - Full-page settings UI
 *
 * @element settings-page
 * @fires {CustomEvent} navigate-back - When user presses back button
 */
export class SettingsPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._onLocaleChanged = this._onLocaleChanged.bind(this);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    // Listen for locale ready and changes to re-render
    eventBus.on(I18N_EVENTS.LOCALE_READY, this._onLocaleChanged);
    eventBus.on(I18N_EVENTS.LOCALE_CHANGED, this._onLocaleChanged);
  }

  disconnectedCallback() {
    eventBus.off(I18N_EVENTS.LOCALE_READY, this._onLocaleChanged);
    eventBus.off(I18N_EVENTS.LOCALE_CHANGED, this._onLocaleChanged);
  }

  _onLocaleChanged() {
    // Re-render with new locale strings
    this.render();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Back button
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

    // Language selection
    this.shadowRoot.querySelectorAll('.locale-option').forEach((option) => {
      option.addEventListener('click', async () => {
        const locale = option.dataset.locale;
        if (locale && locale !== i18n.locale) {
          await i18n.setLocale(locale);
        }
      });

      // Keyboard support
      option.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          option.click();
        }
      });
    });
  }

  /**
   * Render locale options
   */
  renderLocaleOptions() {
    return I18N.availableLocales
      .map((locale) => {
        const isActive = locale === i18n.locale;
        const name = I18N.localeNames[locale] || locale;

        return `
        <button
          class="locale-option ${isActive ? 'active' : ''}"
          data-locale="${locale}"
          role="radio"
          aria-checked="${isActive}"
          tabindex="0"
        >
          <span class="locale-name">${name}</span>
          ${isActive ? '<span class="checkmark">✓</span>' : ''}
        </button>
      `;
      })
      .join('');
  }

  render() {
    // Get localized strings (with fallbacks for now)
    const strings = {
      settings: i18n.t('settings.title') || 'Settings',
      language: i18n.t('settings.language') || 'Language',
      gameLanguage: i18n.t('settings.game_language') || 'Game language',
      about: i18n.t('settings.about') || 'About',
      version: i18n.t('settings.version') || 'Version',
      back: i18n.t('a11y.back_to_chat_list') || 'Back to chat list',
    };

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

        /* Header - matches chat-thread */
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

        /* Content area - hidden scrollbar (smartphone-style) */
        .content {
          flex: 1;
          overflow-y: auto;
          padding: var(--ink-space-md, 16px) 0;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .content::-webkit-scrollbar {
          display: none;
        }

        /* Section header */
        .section-header {
          padding: var(--ink-space-lg, 24px) var(--ink-space-lg, 20px) var(--ink-space-sm, 8px);
          font-size: 0.75em;
          font-weight: 600;
          color: var(--ink-color-accent, #5b7cfa);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Setting row */
        .setting-row {
          padding: var(--ink-space-md, 14px) var(--ink-space-lg, 20px);
        }
        .setting-title {
          color: var(--ink-color-text, #e8e8ed);
          font-size: 1em;
          margin-bottom: 2px;
        }
        .setting-value {
          color: var(--ink-color-text-muted, #71717a);
          font-size: 0.9em;
        }

        /* Language selector */
        .locale-options {
          display: flex;
          flex-direction: column;
          padding: 0 var(--ink-space-lg, 20px);
          gap: 2px;
        }
        .locale-option {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--ink-space-md, 14px) var(--ink-space-md, 16px);
          background: var(--ink-color-surface, #1e1e24);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.15s;
          width: 100%;
          text-align: left;
        }
        .locale-option:hover {
          background: var(--ink-hover-light, rgba(255, 255, 255, 0.1));
        }
        .locale-option:focus-visible {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: 2px;
        }
        .locale-option.active {
          background: var(--ink-color-surface, #1e1e24);
        }
        .locale-name {
          color: var(--ink-color-text, #e8e8ed);
          font-size: 1em;
        }
        .checkmark {
          color: var(--ink-color-accent, #5b7cfa);
          font-size: 1.1em;
        }

        /* Divider */
        .divider {
          height: 1px;
          background: var(--ink-border-subtle, rgba(255, 255, 255, 0.08));
          margin: var(--ink-space-md, 16px) var(--ink-space-lg, 20px);
        }

        @media (prefers-reduced-motion: reduce) {
          .locale-option {
            transition: none;
          }
        }
      </style>

      <header class="header">
        <button
          class="back-button"
          aria-label="${strings.back}"
          data-testid="settings-back"
        >‹</button>
        <span class="header-title">${strings.settings}</span>
      </header>

      <div class="content">
        <div class="section-header">${strings.language}</div>

        <div class="setting-row">
          <div class="setting-title">${strings.gameLanguage}</div>
          <div class="setting-value">${I18N.localeNames[i18n.locale] || i18n.locale}</div>
        </div>

        <div class="locale-options" role="radiogroup" aria-label="${strings.language}">
          ${this.renderLocaleOptions()}
        </div>

        <div class="divider"></div>

        <div class="section-header">${strings.about}</div>

        <div class="setting-row">
          <div class="setting-title">${strings.version}</div>
          <div class="setting-value">${GAME.version || '0.1.0'}</div>
        </div>
      </div>
    `;
  }
}

customElements.define('settings-page', SettingsPage);
