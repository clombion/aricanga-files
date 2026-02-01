// Image Bubble - Image message with optional caption
// Shows thumbnail with tap-to-expand functionality
// Emits 'image-preview-open' event for lightbox (managed by chat-thread)

import { getUIDimension } from '../services/conversation-context.js';
import { escapeHtml } from '../utils/text.js';

export class ImageBubble extends HTMLElement {
  static get observedAttributes() {
    return ['src', 'type', 'caption'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._loadError = false;
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  /**
   * Request lightbox open via custom event
   */
  requestPreview() {
    const src = this.getAttribute('src') || '';
    const caption = this.getAttribute('caption') || '';

    this.dispatchEvent(
      new CustomEvent('image-preview-open', {
        detail: { src, caption },
        bubbles: true,
        composed: true, // crosses shadow DOM automatically
      }),
    );
  }

  render() {
    const src = this.getAttribute('src') || '';
    const type = this.getAttribute('type') || 'received';
    const caption = this.getAttribute('caption') || '';
    const isSent = type === 'sent';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-width: 75%;
          align-self: ${isSent ? 'flex-end' : 'flex-start'};
        }

        .image-container {
          background: ${isSent ? 'var(--ink-bubble-sent-bg, #0a84ff)' : 'var(--ink-bubble-received-bg, #3a3a3c)'};
          color: ${isSent ? 'var(--ink-bubble-sent-text, white)' : 'var(--ink-bubble-received-text, #f2f2f7)'};
          border-radius: var(--ink-radius-bubble, 18px);
          ${isSent ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'}
          overflow: hidden;
          cursor: pointer;
        }

        .thumbnail {
          display: block;
          width: 100%;
          max-width: ${getUIDimension('imageMaxWidth') || 250}px;
          height: auto;
          object-fit: cover;
        }

        .thumbnail.error {
          min-height: 120px;
          background: var(--ink-color-surface, #2c2c2e);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .error-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 120px;
          padding: var(--ink-space-md, 15px);
          color: var(--ink-color-text-muted, #8e8e93);
          text-align: center;
          font-size: var(--ink-font-size-small, 0.85em);
        }

        .error-icon {
          font-size: 32px;
          margin-bottom: var(--ink-space-sm, 8px);
          opacity: 0.5;
        }

        .caption {
          padding: var(--ink-space-sm, 8px) var(--ink-space-md, 15px);
          font-size: var(--ink-font-size-small, 0.85em);
          line-height: 1.4;
        }
      </style>

      <div class="image-container" role="button" tabindex="0" aria-label="View image${caption ? `: ${caption}` : ''}">
        ${
          this._loadError
            ? `
          <div class="error-placeholder">
            <span class="error-icon">🖼</span>
            <span>Image not available</span>
          </div>
        `
            : `
          <img class="thumbnail" src="${this.escapeAttr(src)}" alt="${this.escapeAttr(caption) || 'Image message'}" loading="lazy"/>
        `
        }
        ${
          caption
            ? `
          <div class="caption">${escapeHtml(caption)}</div>
        `
            : ''
        }
      </div>
    `;

    // Wire thumbnail click
    this.shadowRoot
      .querySelector('.image-container')
      ?.addEventListener('click', () => {
        if (!this._loadError) {
          this.requestPreview();
        }
      });

    // Wire keyboard activation for thumbnail
    this.shadowRoot
      .querySelector('.image-container')
      ?.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !this._loadError) {
          e.preventDefault();
          this.requestPreview();
        }
      });

    // Wire image error handling
    const thumbnail = this.shadowRoot.querySelector('.thumbnail');
    if (thumbnail && !this._loadError) {
      thumbnail.addEventListener('error', () => {
        this._loadError = true;
        this.render();
      });
    }
  }

  escapeAttr(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

customElements.define('image-bubble', ImageBubble);
