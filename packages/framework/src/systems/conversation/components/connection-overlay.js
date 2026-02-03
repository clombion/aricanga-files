// Connection Overlay - Top banner showing "No internet connection"
// Triggered by wifi0 or mobile0 internet status

import {
  DECELERATE_EASING,
  EXIT_EASING,
} from '../utils/animation-constants.js';
import { TRANSITIONS } from '../utils/view-transitions.js';

export class ConnectionOverlay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._visible = false;
  }

  connectedCallback() {
    this.render();
  }

  /**
   * Show the reconnecting banner with slide-down animation
   */
  show() {
    this._visible = true;
    this.hidden = false; // lint-ignore: direct visibility (not a transition target)
    this.render();

    // Animate in
    const banner = this.shadowRoot.querySelector('.banner');
    if (
      banner &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      banner.animate(
        [
          { transform: 'translateY(-100%)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 },
        ],
        {
          duration: TRANSITIONS.OPEN_OVERLAY.duration,
          easing: DECELERATE_EASING,
          fill: 'forwards',
        },
      );
    }
  }

  /**
   * Hide the banner with slide-up animation
   */
  hide() {
    const banner = this.shadowRoot.querySelector('.banner');
    if (
      banner &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const anim = banner.animate(
        [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-100%)', opacity: 0 },
        ],
        {
          duration: TRANSITIONS.CLOSE_OVERLAY.duration,
          easing: EXIT_EASING,
          fill: 'forwards',
        },
      );
      anim.finished
        .then(() => {
          this._visible = false;
          this.hidden = true;
        })
        .catch(() => {
          /* cancelled */
        });
    } else {
      this._visible = false;
      this.hidden = true;
    }
  }

  /**
   * Check if overlay is visible
   */
  get isVisible() {
    return this._visible;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: absolute;
          top: var(--ink-statusbar-height, 44px);
          left: 0;
          right: 0;
          z-index: 100;
          pointer-events: none;
        }

        :host([hidden]) {
          display: none;
        }

        .banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(var(--ink-color-danger-rgb, 255, 59, 48), 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          color: white; /* lint-ignore: banner text on danger bg */
          font-size: 12px;
          font-family: var(--ink-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
          pointer-events: auto;
        }

        .no-internet-icon {
          flex-shrink: 0;
          opacity: 0.9;
        }

        .text {
          flex: 1;
          font-weight: 500;
        }

        .spinner {
          width: 12px;
          height: 12px;
          border: 1.5px solid rgba(255, 255, 255, 0.4); /* lint-ignore: spinner on danger */
          border-top-color: white; /* lint-ignore: spinner on danger */
          border-radius: 50%;
          animation: spin 1s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-color-scheme: light) {
          .banner {
            background: rgba(var(--ink-color-danger-rgb, 255, 59, 48), 0.75);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .spinner {
            animation: none;
            border-color: white; /* lint-ignore: spinner fallback */
          }
        }
        /* Firefox: backdrop-filter causes blurry text with border-radius */
        @-moz-document url-prefix() {
          .banner {
            backdrop-filter: none;
          }
        }
      </style>

      <div class="banner" role="alert" aria-live="assertive">
        <svg class="no-internet-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="text">No internet connection. Reconnecting...</span>
        <div class="spinner" aria-hidden="true"></div>
      </div>
    `;
  }
}

customElements.define('connection-overlay', ConnectionOverlay);
