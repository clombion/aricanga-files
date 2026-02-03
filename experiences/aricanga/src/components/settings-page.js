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
import { i18n } from '../services/i18n.js';
import {
  MOTION_EVENTS,
  MOTION_LEVELS,
  motionPrefs,
} from '../services/motion-preferences.js';
import { withLocaleReactivity } from '../utils/locale-mixin.js';

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
    this._onMotionChanged = this._onMotionChanged.bind(this);
    this._locale = withLocaleReactivity(this._onLocaleChanged);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this._locale.connect();
    eventBus.on(MOTION_EVENTS.MOTION_CHANGED, this._onMotionChanged);
  }

  disconnectedCallback() {
    this._locale.disconnect();
    eventBus.off(MOTION_EVENTS.MOTION_CHANGED, this._onMotionChanged);
  }

  _onLocaleChanged() {
    this._updateLocalizedText();
    this._updateLocaleActiveState();
  }

  _onMotionChanged() {
    this._updateMotionActiveState();
  }

  _updateLocalizedText() {
    const root = this.shadowRoot;
    const strings = {
      settings: i18n.t('settings.title') || 'Settings',
      language: i18n.t('settings.language') || 'Language',
      gameLanguage: i18n.t('settings.game_language') || 'Game language',
      motion: i18n.t('settings.motion') || 'Motion',
      motionDescription:
        i18n.t('settings.motion_description') || 'Page transition animations',
      back: i18n.t('a11y.back_to_chat_list') || 'Back to chat list',
      version: i18n.t('about.version') || 'Version',
    };

    const title = root.querySelector('.header-title');
    if (title) title.textContent = strings.settings;

    const backBtn = root.querySelector('.back-button');
    if (backBtn) backBtn.setAttribute('aria-label', strings.back);

    // Section headers
    const sectionHeaders = root.querySelectorAll('.section-header');
    if (sectionHeaders[0]) sectionHeaders[0].textContent = strings.language;
    if (sectionHeaders[1]) sectionHeaders[1].textContent = strings.motion;

    // Setting rows
    const settingTitles = root.querySelectorAll('.setting-title');
    if (settingTitles[0]) settingTitles[0].textContent = strings.gameLanguage;
    if (settingTitles[1])
      settingTitles[1].textContent = strings.motionDescription;
    if (settingTitles[2]) settingTitles[2].textContent = strings.version;

    // Current locale display
    const settingValues = root.querySelectorAll('.setting-value');
    if (settingValues[0])
      settingValues[0].textContent =
        I18N.localeNames[i18n.locale] || i18n.locale;

    // Radiogroup aria-labels
    const localeGroup = root.querySelector('.locale-options');
    if (localeGroup) localeGroup.setAttribute('aria-label', strings.language);
    const motionGroup = root.querySelector('.motion-options');
    if (motionGroup) motionGroup.setAttribute('aria-label', strings.motion);

    // Motion option labels (translatable)
    this._updateMotionLabels();
  }

  _updateLocaleActiveState() {
    const root = this.shadowRoot;
    for (const option of root.querySelectorAll('.locale-option')) {
      const isActive = option.dataset.locale === i18n.locale;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-checked', String(isActive));
      option.setAttribute('tabindex', isActive ? '0' : '-1');
      const checkmark = option.querySelector('.checkmark');
      if (isActive && !checkmark) {
        option.insertAdjacentHTML(
          'beforeend',
          '<span class="checkmark">✓</span>',
        );
      } else if (!isActive && checkmark) {
        checkmark.remove();
      }
    }
  }

  _updateMotionActiveState() {
    const root = this.shadowRoot;
    for (const option of root.querySelectorAll('.motion-option')) {
      const isActive = option.dataset.level === motionPrefs.level;
      option.classList.toggle('active', isActive);
      option.setAttribute('aria-checked', String(isActive));
      option.setAttribute('tabindex', isActive ? '0' : '-1');
      const checkmark = option.querySelector('.checkmark');
      if (isActive && !checkmark) {
        option.insertAdjacentHTML(
          'beforeend',
          '<span class="checkmark">✓</span>',
        );
      } else if (!isActive && checkmark) {
        checkmark.remove();
      }
    }
    this._updateMotionLabels();
  }

  _updateMotionLabels() {
    const root = this.shadowRoot;
    const effectiveLevel = motionPrefs.getEffectiveLevel();
    const isOsOverriding = effectiveLevel !== motionPrefs.level;
    const labels = {
      [MOTION_LEVELS.FULL]: i18n.t('settings.motion_options.full'),
      [MOTION_LEVELS.REDUCED]: i18n.t('settings.motion_options.reduced'),
      [MOTION_LEVELS.OFF]: i18n.t('settings.motion_options.off'),
    };

    for (const option of root.querySelectorAll('.motion-option')) {
      const level = option.dataset.level;
      const nameEl = option.querySelector('.option-name');
      if (nameEl) nameEl.textContent = labels[level] || level;

      const showOsIndicator = isOsOverriding && level === effectiveLevel;
      const indicator = option.querySelector('.os-indicator');
      if (showOsIndicator && !indicator) {
        const labelEl = option.querySelector('.option-label');
        if (labelEl) {
          labelEl.insertAdjacentHTML(
            'beforeend',
            `<span class="os-indicator">${i18n.t('settings.motion_options.os_preference')}</span>`,
          );
        }
      } else if (!showOsIndicator && indicator) {
        indicator.remove();
      } else if (showOsIndicator && indicator) {
        indicator.textContent = i18n.t('settings.motion_options.os_preference');
      }
    }
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
    const options = this.shadowRoot.querySelectorAll('.locale-option');
    const optionCount = options.length;

    options.forEach((option) => {
      option.addEventListener('click', async () => {
        const locale = option.dataset.locale;
        if (locale && locale !== i18n.locale) {
          await i18n.setLocale(locale);
        }
      });

      // Keyboard support with arrow key navigation
      option.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          option.click();
          return;
        }

        // Arrow key navigation for radio group
        const currentIndex = parseInt(option.dataset.index, 10);
        let nextIndex = -1;

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          nextIndex = (currentIndex + 1) % optionCount;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          nextIndex = (currentIndex - 1 + optionCount) % optionCount;
        }

        if (nextIndex >= 0) {
          const nextOption = this.shadowRoot.querySelector(
            `.locale-option[data-index="${nextIndex}"]`,
          );
          if (nextOption) {
            // Update tabindex (roving tabindex pattern)
            option.setAttribute('tabindex', '-1');
            nextOption.setAttribute('tabindex', '0');
            nextOption.focus();
          }
        }
      });
    });

    // Motion selection
    const motionOptions = this.shadowRoot.querySelectorAll('.motion-option');
    const motionOptionCount = motionOptions.length;

    motionOptions.forEach((option) => {
      option.addEventListener('click', () => {
        const level = option.dataset.level;
        if (level && level !== motionPrefs.level) {
          motionPrefs.setLevel(level);
        }
      });

      // Keyboard support with arrow key navigation
      option.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          option.click();
          return;
        }

        // Arrow key navigation for radio group
        const currentIndex = parseInt(option.dataset.index, 10);
        let nextIndex = -1;

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          nextIndex = (currentIndex + 1) % motionOptionCount;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          nextIndex =
            (currentIndex - 1 + motionOptionCount) % motionOptionCount;
        }

        if (nextIndex >= 0) {
          const nextOption = this.shadowRoot.querySelector(
            `.motion-option[data-index="${nextIndex}"]`,
          );
          if (nextOption) {
            option.setAttribute('tabindex', '-1');
            nextOption.setAttribute('tabindex', '0');
            nextOption.focus();
          }
        }
      });
    });
  }

  /**
   * Render locale options
   * Uses roving tabindex: only active option is tabbable, others use tabindex="-1"
   */
  renderLocaleOptions() {
    return I18N.availableLocales
      .map((locale, index) => {
        const isActive = locale === i18n.locale;
        const name = I18N.localeNames[locale] || locale;
        // Roving tabindex: active item (or first if none active) is tabbable
        const tabindex = isActive ? '0' : '-1';

        return `
        <button
          class="locale-option ${isActive ? 'active' : ''}"
          data-locale="${locale}"
          data-index="${index}"
          role="radio"
          aria-checked="${isActive}"
          tabindex="${tabindex}"
        >
          <span class="locale-name">${name}</span>
          ${isActive ? '<span class="checkmark">✓</span>' : ''}
        </button>
      `;
      })
      .join('');
  }

  /**
   * Render motion level options
   * Uses effective level (considering OS preference) for visual state
   */
  renderMotionOptions() {
    const effectiveLevel = motionPrefs.getEffectiveLevel();
    const isOsOverriding = effectiveLevel !== motionPrefs.level;

    const levels = [
      {
        key: MOTION_LEVELS.FULL,
        label: i18n.t('settings.motion_options.full'),
      },
      {
        key: MOTION_LEVELS.REDUCED,
        label: i18n.t('settings.motion_options.reduced'),
      },
      {
        key: MOTION_LEVELS.OFF,
        label: i18n.t('settings.motion_options.off'),
      },
    ];

    return levels
      .map((level, index) => {
        const isActive = level.key === motionPrefs.level;
        // Roving tabindex: user's selection is tabbable, others use -1
        const tabindex = isActive ? '0' : '-1';
        // Show OS indicator on the effective level when it differs from user choice
        const showOsIndicator = isOsOverriding && level.key === effectiveLevel;

        return `
        <button
          class="motion-option ${isActive ? 'active' : ''}"
          data-level="${level.key}"
          data-index="${index}"
          role="radio"
          aria-checked="${isActive}"
          tabindex="${tabindex}"
        >
          <span class="option-label">
            <span class="option-name">${level.label}</span>
            ${showOsIndicator ? `<span class="os-indicator">${i18n.t('settings.motion_options.os_preference')}</span>` : ''}
          </span>
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
      motion: i18n.t('settings.motion') || 'Motion',
      motionDescription:
        i18n.t('settings.motion_description') || 'Page transition animations',
      back: i18n.t('a11y.back_to_chat_list') || 'Back to chat list',
      version: i18n.t('about.version') || 'Version',
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
        .locale-options,
        .motion-options {
          display: flex;
          flex-direction: column;
          padding: 0 var(--ink-space-lg, 20px);
          gap: 2px;
        }
        .locale-option,
        .motion-option {
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
        .locale-option:hover,
        .motion-option:hover {
          background: var(--ink-hover-light, rgba(255, 255, 255, 0.1));
        }
        .locale-option:focus-visible,
        .motion-option:focus-visible {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: 2px;
        }
        .locale-option.active,
        .motion-option.active {
          background: var(--ink-color-surface, #1e1e24);
        }
        .locale-name,
        .option-name {
          color: var(--ink-color-text, #e8e8ed);
          font-size: 1em;
        }
        .option-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .os-indicator {
          color: var(--ink-color-text-muted, #71717a);
          font-size: 0.8em;
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
          .locale-option,
          .motion-option {
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

        <div class="section-header">${strings.motion}</div>

        <div class="setting-row">
          <div class="setting-title">${strings.motionDescription}</div>
        </div>

        <div class="motion-options" role="radiogroup" aria-label="${strings.motion}">
          ${this.renderMotionOptions()}
        </div>

        <div class="divider"></div>

        <div class="setting-row version-row">
          <div class="setting-title">${strings.version}</div>
          <div class="setting-value">${GAME.version}</div>
        </div>
      </div>
    `;
  }
}

customElements.define('settings-page', SettingsPage);
