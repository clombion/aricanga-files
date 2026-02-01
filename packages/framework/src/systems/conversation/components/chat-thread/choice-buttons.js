/**
 * choice-buttons.js - Player choice selection buttons
 *
 * Displays available response choices for the player.
 * Fires choice-selected event when a choice is clicked.
 */

import { t } from '../../services/conversation-context.js';
import { escapeHtml } from '../../utils/text.js';

/**
 * ChoiceButtons - Player response choices web component
 *
 * @element choice-buttons
 * @fires {CustomEvent} choice-selected - When user selects a choice, detail: { index }
 */
export class ChoiceButtons extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._choices = [];
    this._selectedIndex = -1;
    this._animating = false;
  }

  connectedCallback() {
    this.render();
    this.wireEvents();
  }

  /**
   * Set choices and re-render
   * @param {Array<{text: string}>} choices
   */
  setChoices(choices) {
    this._choices = choices || [];
    this._selectedIndex = -1;
    this.render();
    this.wireEvents();

    // Focus first choice for keyboard accessibility
    const firstChoice = this.shadowRoot.querySelector('.choice');
    if (firstChoice) {
      firstChoice.focus();
    }
  }

  /**
   * Clear all choices
   */
  clear() {
    this._choices = [];
    this._selectedIndex = -1;
    this.render();
  }

  /**
   * Get current choices
   */
  get choices() {
    return this._choices;
  }

  wireEvents() {
    this.shadowRoot
      .querySelector('.choices')
      ?.addEventListener('click', async (e) => {
        const button = e.target.closest('.choice');
        if (!button || this._animating) return;

        this._animating = true;
        const index = parseInt(button.dataset.index, 10);

        // Update selected state and aria-pressed
        this._selectedIndex = index;
        this.shadowRoot.querySelectorAll('.choice').forEach((btn, i) => {
          btn.setAttribute('aria-pressed', i === index ? 'true' : 'false');
          btn.classList.toggle('selected', i === index);
        });

        await this.animateSelection(index);

        this.dispatchEvent(
          new CustomEvent('choice-selected', {
            detail: { index },
            bubbles: true,
          }),
        );

        this._animating = false;
      });
  }

  /**
   * Animate choice selection - fade out unselected, morph selected
   * @param {number} index - Selected choice index
   */
  async animateSelection(index) {
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReduced) return;

    const buttons = this.shadowRoot.querySelectorAll('.choice');
    const others = [...buttons].filter((_, i) => i !== index);

    const duration = 200;
    const easing = 'cubic-bezier(0.2, 0, 0, 1)';

    // Fade out unselected choices
    for (const btn of others) {
      btn.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration,
        easing,
        fill: 'forwards',
      });
    }

    // Wait for animation to complete
    await new Promise((r) => setTimeout(r, duration));
  }

  render() {
    const choicesHtml = this._choices
      .map(
        (choice, index) => `
      <button class="choice${this._selectedIndex === index ? ' selected' : ''}" data-index="${index}" tabindex="0" aria-pressed="${this._selectedIndex === index}">
        ${escapeHtml(choice.text)}
      </button>
    `,
      )
      .join('');

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .choices {
          padding: var(--ink-space-md, 15px);
          border-top: 1px solid var(--ink-color-surface, #2c2c2e);
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: var(--ink-space-sm, 8px);
        }

        .choices:empty {
          display: none;
        }

        .choice {
          max-width: 80%;
          padding: 10px 15px;
          background: transparent;
          color: var(--ink-color-accent, #0a84ff);
          border: 1.5px solid var(--ink-color-accent, #0a84ff);
          border-radius: 18px;
          border-bottom-right-radius: 4px;
          font-weight: 500;
          font-size: 1em;
          cursor: pointer;
          transition: background-color var(--ink-transition-normal, 0.2s),
                      border-color var(--ink-transition-normal, 0.2s),
                      color var(--ink-transition-normal, 0.2s);
          text-align: left;
          overflow-wrap: break-word;
          word-break: break-word;
          font-family: inherit;
          user-select: none;
        }

        @media (hover: hover) {
          .choice:hover {
            background: var(--ink-color-accent-subtle, rgba(10, 132, 255, 0.1));
          }
        }

        .choice:focus-visible {
          outline: 2px solid var(--ink-color-accent, #0a84ff);
          outline-offset: 2px;
        }

        .choice:active {
          background: var(--ink-color-accent-subtle-pressed, rgba(10, 132, 255, 0.15));
        }

        .choice.selected,
        .choice[aria-pressed="true"] {
          background: var(--ink-bubble-sent-bg, #0066cc);
          border-color: var(--ink-bubble-sent-bg, #0066cc);
          color: white;
        }

        @media (prefers-reduced-motion: reduce) {
          .choice {
            transition: none;
          }
        }
      </style>

      <div class="choices" role="group" aria-label="${t('ui.a11y.available_responses')}">
        ${choicesHtml}
      </div>
    `;
  }
}

customElements.define('choice-buttons', ChoiceButtons);
