// Link Preview - Rich card-style preview for links (glossary terms, external URLs)
// Supports three layouts: card (large), inline (compact), minimal (text only)

import { t } from '../services/conversation-context.js';
import { escapeHtml, wireGlossaryClicks } from '../utils/text.js';

export class LinkPreview extends HTMLElement {
  static get observedAttributes() {
    return [
      'url',
      'domain',
      'title',
      'description',
      'image-src',
      'layout',
      'is-video',
      'type',
      'attached',
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  handleClick() {
    const url = this.getAttribute('url');
    if (!url) return;

    if (url.startsWith('glossary:')) {
      const termId = url.slice(9); // Remove "glossary:" prefix
      this.dispatchEvent(
        new CustomEvent('glossary-term-clicked', {
          detail: { termId },
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      // External URL - open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  render() {
    const domain = this.getAttribute('domain') || '';
    const title = this.getAttribute('title') || '';
    const description = this.getAttribute('description') || '';
    const imageSrc = this.getAttribute('image-src') || '';
    const layout = this.getAttribute('layout') || 'card';
    const isVideo = this.getAttribute('is-video') === 'true';
    const type = this.getAttribute('type') || 'received';
    const isSent = type === 'sent';

    // Normalize image path
    let normalizedImageSrc = imageSrc;
    if (imageSrc && !imageSrc.startsWith('/') && !imageSrc.startsWith('http')) {
      normalizedImageSrc = `/${imageSrc}`;
    }

    const hasImage = !!normalizedImageSrc && layout !== 'minimal';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-width: 75%;
          align-self: ${isSent ? 'flex-end' : 'flex-start'};
        }

        /* When attached to a text message, parent wrapper controls width */
        :host([attached]) {
          max-width: none;
          margin-bottom: 0;
        }

        .preview-card {
          background: ${isSent ? 'var(--ink-bubble-sent-bg, #0a84ff)' : 'var(--ink-bubble-received-bg, #3a3a3c)'};
          color: ${isSent ? 'var(--ink-bubble-sent-text, white)' : 'var(--ink-bubble-received-text, #f2f2f7)'};
          border-radius: var(--ink-radius-bubble, 18px);
          ${isSent ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'}
          overflow: hidden;
          cursor: pointer;
          transition: transform var(--ink-transition-fast, 0.1s), opacity var(--ink-transition-fast, 0.1s);
        }

        /* Attached preview: neutral charcoal grey (like iMessage), rounded TOP only, square bottom to connect with text bubble */
        :host([attached]) .preview-card {
          background: var(--ink-link-preview-attached-bg, #2c2c2e);
          color: var(--ink-link-preview-attached-text, #f2f2f7);
          border-radius: var(--ink-radius-bubble, 18px) var(--ink-radius-bubble, 18px) 0 0;
        }

        .preview-card:hover {
          opacity: 0.9;
        }

        .preview-card:active {
          transform: scale(0.98);
        }

        .preview-card:focus {
          outline: 2px solid var(--ink-color-accent, #5b7cfa);
          outline-offset: 2px;
        }

        /* Card layout - large image above, text below */
        .layout-card .preview-image {
          width: 100%;
          max-height: 180px;
          object-fit: cover;
          display: block;
        }

        .layout-card .preview-content {
          padding: 12px 14px;
        }

        /* Inline layout - small thumbnail right, text left */
        .layout-inline {
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }

        .layout-inline .preview-content {
          flex: 1;
          padding: 12px 14px;
          min-width: 0;
        }

        .layout-inline .preview-image {
          width: 80px;
          height: auto;
          min-height: 80px;
          object-fit: cover;
          flex-shrink: 0;
        }

        /* Minimal layout - text only */
        .layout-minimal .preview-content {
          padding: 12px 14px;
        }

        /* Content elements */
        .domain {
          font-size: 0.75em;
          opacity: 0.7;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .title {
          font-weight: 600;
          font-size: 0.95em;
          line-height: 1.3;
          margin-bottom: 4px;
        }

        .description {
          font-size: 0.85em;
          opacity: 0.85;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Video play button overlay */
        .image-container {
          position: relative;
        }

        .play-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 48px;
          height: 48px;
          background: var(--ink-overlay-medium, rgba(0, 0, 0, 0.6));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .play-overlay svg {
          width: 24px;
          height: 24px;
          fill: white;
          margin-left: 3px; /* Visual centering for play triangle */
        }

        /* Link icon for minimal layout */
        .link-icon {
          display: inline-flex;
          margin-right: 6px;
          opacity: 0.7;
          vertical-align: middle;
        }

        .link-icon svg {
          width: 14px;
          height: 14px;
        }

        @media (prefers-reduced-motion: reduce) {
          .preview-card {
            transition: none;
          }
        }
      </style>

      <div class="preview-card layout-${this.escapeAttr(layout)}"
           role="link"
           tabindex="0"
           aria-label="${title ? this.escapeAttr(title) : t('ui.a11y.link_preview')}${domain ? ` - ${this.escapeAttr(domain)}` : ''}">
        ${this.renderContent(layout, hasImage, normalizedImageSrc, isVideo, domain, title, description)}
      </div>
    `;

    // Wire click handler
    this.shadowRoot
      .querySelector('.preview-card')
      ?.addEventListener('click', () => this.handleClick());

    // Wire keyboard activation
    this.shadowRoot
      .querySelector('.preview-card')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleClick();
        }
      });

    // Wire glossary highlight clicks (for learning-highlight spans in content)
    wireGlossaryClicks(this.shadowRoot, this);
  }

  renderContent(
    layout,
    hasImage,
    imageSrc,
    isVideo,
    domain,
    title,
    description,
  ) {
    // Card layout: image on top
    if (layout === 'card' && hasImage) {
      return `
        <div class="image-container">
          <img class="preview-image" src="${this.escapeAttr(imageSrc)}" alt="" loading="lazy" />
          ${isVideo ? this.renderPlayOverlay() : ''}
        </div>
        <div class="preview-content">
          ${domain ? `<div class="domain">${escapeHtml(domain)}</div>` : ''}
          ${title ? `<div class="title">${escapeHtml(title)}</div>` : ''}
          ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}
        </div>
      `;
    }

    // Inline layout: text left, image right
    if (layout === 'inline' && hasImage) {
      return `
        <div class="preview-content">
          ${domain ? `<div class="domain">${escapeHtml(domain)}</div>` : ''}
          ${title ? `<div class="title">${escapeHtml(title)}</div>` : ''}
          ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}
        </div>
        <div class="image-container">
          <img class="preview-image" src="${this.escapeAttr(imageSrc)}" alt="" loading="lazy" />
          ${isVideo ? this.renderPlayOverlay() : ''}
        </div>
      `;
    }

    // Minimal layout or no image: text only
    return `
      <div class="preview-content">
        ${domain ? `<div class="domain">${escapeHtml(domain)}</div>` : ''}
        <div class="title">
          ${layout === 'minimal' ? this.renderLinkIcon() : ''}${title ? escapeHtml(title) : escapeHtml(domain) || 'Link'}
        </div>
        ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}
      </div>
    `;
  }

  renderPlayOverlay() {
    return `
      <div class="play-overlay">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
      </div>
    `;
  }

  renderLinkIcon() {
    return `
      <span class="link-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
      </span>
    `;
  }

  escapeAttr(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

customElements.define('link-preview', LinkPreview);
