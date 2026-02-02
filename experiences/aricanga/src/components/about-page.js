/**
 * About Page - Full-page about/credits UI
 *
 * Shows game description, version, and credits.
 * Accessible via the About tile in the notification drawer.
 */

import { eventBus } from '@narratives/framework';
import { GAME } from '../config.js';
import { I18N_EVENTS, i18n } from '../services/i18n.js';

/**
 * AboutPage - Full-page about UI
 *
 * @element about-page
 * @fires {CustomEvent} navigate-back - When user presses back button
 */
export class AboutPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._onLocaleChanged = this._onLocaleChanged.bind(this);
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
  }

  render() {
    const strings = {
      title: i18n.t('about.title') || 'About',
      aboutGame: i18n.t('about.about_game') || 'About This Game',
      gameDescription:
        i18n.t('about.game_description') ||
        'Aricanga is an educational game designed to make extractive industries data more accessible.',
      version: i18n.t('about.version') || 'Version',
      credits: i18n.t('about.credits') || 'Credits',
      designedBy: i18n.t('about.designed_by') || 'Experience designed by',
      cliName: i18n.t('about.cli_name') || 'Civic Literacy Initiative',
      licenses: i18n.t('about.licenses') || 'Open Source Licenses',
      back: i18n.t('a11y.back') || 'Back',
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

        /* Content area */
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

        /* Description block */
        .description {
          padding: var(--ink-space-sm, 8px) var(--ink-space-lg, 20px) var(--ink-space-md, 16px);
          color: var(--ink-color-text-muted, #71717a);
          font-size: 0.95em;
          line-height: 1.5;
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

        /* Credits row with link */
        .credits-row {
          padding: var(--ink-space-md, 14px) var(--ink-space-lg, 20px);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .credits-label {
          color: var(--ink-color-text-muted, #71717a);
          font-size: 1em;
        }
        .credits-link {
          color: var(--ink-color-text, #e8e8ed);
          text-decoration: underline;
          text-underline-offset: 2px;
          font-size: 0.95em;
        }
        .credits-link:hover {
          opacity: 0.8;
        }
        .credits-link:focus-visible {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: 2px;
          border-radius: 2px;
        }

        /* License list */
        .license-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: var(--ink-space-sm, 8px) var(--ink-space-lg, 20px) var(--ink-space-md, 16px);
        }
        .license-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          text-decoration: none;
        }
        .license-item:focus-visible {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: 2px;
          border-radius: 4px;
        }
        .license-name {
          color: var(--ink-color-text, #e8e8ed);
          font-size: 1em;
          font-weight: 600;
        }
        .license-author,
        .license-type {
          color: var(--ink-color-text-muted, #71717a);
          font-size: 0.9em;
        }

        /* Divider */
        .divider {
          height: 1px;
          background: var(--ink-border-subtle, rgba(255, 255, 255, 0.08));
          margin: var(--ink-space-md, 16px) var(--ink-space-lg, 20px);
        }
      </style>

      <header class="header">
        <button
          class="back-button"
          aria-label="${strings.back}"
          data-testid="about-back"
        >‹</button>
        <span class="header-title">${strings.title}</span>
      </header>

      <div class="content">
        <div class="section-header">${strings.aboutGame}</div>
        <p class="description">${strings.gameDescription}</p>

        <div class="divider"></div>

        <div class="section-header">${strings.version}</div>
        <div class="setting-row">
          <div class="setting-value">${GAME.version || '0.1.0'}${GAME.buildId ? ` (${GAME.buildId})` : ''}</div>
        </div>

        <div class="divider"></div>

        <div class="section-header">${strings.credits}</div>
        <div class="credits-row">
          <span class="credits-label">${strings.designedBy}</span>
          <a
            class="credits-link"
            href="https://civicliteracies.org"
            target="_blank"
            rel="noopener noreferrer"
          >${strings.cliName}</a>
        </div>

        <div class="divider"></div>

        <div class="section-header">${strings.licenses}</div>
        <div class="license-list">
          <a class="license-item" href="https://github.com/y-lohse/inkjs" target="_blank" rel="noopener noreferrer">
            <span class="license-name">inkjs</span>
            <span class="license-author">y-lohse</span>
            <span class="license-type">MIT License</span>
          </a>
          <a class="license-item" href="https://github.com/inkle/ink" target="_blank" rel="noopener noreferrer">
            <span class="license-name">ink</span>
            <span class="license-author">inkle</span>
            <span class="license-type">MIT License</span>
          </a>
        </div>
      </div>
    `;
  }
}

customElements.define('about-page', AboutPage);
