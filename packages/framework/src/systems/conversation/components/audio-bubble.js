// Audio Bubble - Voice message with transcribe feature
// Shows waveform, duration, and expandable transcript

import { t } from '../services/conversation-context.js';
import {
  DURATION_FAST,
  DURATION_GENERATE,
} from '../utils/animation-constants.js';
import { escapeHtml, processText } from '../utils/text.js';

export class AudioBubble extends HTMLElement {
  static get observedAttributes() {
    return ['duration', 'type'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._transcript = '';
    this._revealed = false;
    this._generating = false;
  }

  connectedCallback() {
    this.render();
  }

  /**
   * Set the transcript text (hidden until revealed)
   * @param {string} text
   */
  set transcript(text) {
    this._transcript = text;
    // Re-render to show/hide transcribe button
    if (this.isConnected) {
      this.render();
    }
  }

  get transcript() {
    return this._transcript;
  }

  /**
   * Check if transcript has been revealed
   */
  get isRevealed() {
    return this._revealed;
  }

  /**
   * Generate static waveform SVG
   * @returns {string}
   */
  renderWaveform() {
    // Generate pseudo-random bars based on position
    const bars = [];
    const barCount = 28;
    for (let i = 0; i < barCount; i++) {
      // Create natural-looking waveform pattern
      const seed = Math.sin(i * 0.5) * 0.5 + Math.sin(i * 0.3) * 0.3 + 0.5;
      const height = 4 + seed * 16;
      const y = 12 - height / 2;
      bars.push(
        `<rect x="${i * 5}" y="${y}" width="3" height="${height}" rx="1.5" fill="currentColor" opacity="0.6"/>`,
      );
    }
    return `<svg width="140" height="24" viewBox="0 0 140 24" aria-hidden="true">${bars.join('')}</svg>`;
  }

  /**
   * Show generating animation then reveal transcript
   */
  showTranscript() {
    if (this._revealed || this._generating) return;

    this._generating = true;
    this.render();

    // Animate for 1.2s then reveal
    setTimeout(() => {
      this._generating = false;
      this._revealed = true;
      this.render();

      // Animate the reveal
      const transcript = this.shadowRoot.querySelector('.transcript');
      if (transcript) {
        transcript.animate(
          [
            { maxHeight: '0px', opacity: 0, paddingTop: '0px' },
            { maxHeight: '200px', opacity: 1, paddingTop: '8px' },
          ],
          { duration: DURATION_FAST, easing: 'ease-out', fill: 'forwards' },
        );
      }

      // Dispatch event for parent to handle (e.g., scroll to bottom)
      this.dispatchEvent(
        new CustomEvent('transcript-revealed', { bubbles: true }),
      );
    }, DURATION_GENERATE);
  }

  render() {
    const duration = this.getAttribute('duration') || '0:00';
    const type = this.getAttribute('type') || 'received';
    const isSent = type === 'sent';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          max-width: 75%;
          align-self: ${isSent ? 'flex-end' : 'flex-start'};
        }

        .audio-container {
          background: ${isSent ? 'var(--ink-bubble-sent-bg, #0a84ff)' : 'var(--ink-bubble-received-bg, #3a3a3c)'};
          color: ${isSent ? 'var(--ink-bubble-sent-text, white)' : 'var(--ink-bubble-received-text, #f2f2f7)'};
          border-radius: var(--ink-radius-bubble, 18px);
          ${isSent ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'}
          padding: var(--ink-space-sm, 8px) var(--ink-space-md, 15px);
        }

        .player {
          display: flex;
          align-items: center;
          gap: var(--ink-space-sm, 8px);
        }

        .play-btn {
          width: 36px;
          height: 36px;
          min-width: 36px;
          border-radius: 50%;
          background: ${isSent ? 'rgba(255,255,255,0.2)' : 'var(--ink-color-accent, #0a84ff)'};
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform var(--ink-transition-fast, 0.1s);
          user-select: none;
        }

        .play-btn:hover {
          transform: scale(1.05);
        }

        .play-btn:active {
          transform: scale(0.95);
        }

        .play-btn svg {
          width: 16px;
          height: 16px;
          margin-left: 2px; /* Visual center for play icon */
        }

        .waveform {
          flex: 1;
          opacity: 0.7;
          overflow: hidden;
        }

        .duration {
          font-size: var(--ink-font-size-small, 0.85em);
          opacity: 0.7;
          min-width: 32px;
          text-align: right;
        }

        .transcribe-btn {
          margin-top: var(--ink-space-sm, 8px);
          background: transparent;
          border: 1px solid currentColor;
          border-radius: var(--ink-radius-button, 12px);
          padding: 6px 12px;
          color: inherit;
          font-size: var(--ink-font-size-small, 0.85em);
          font-family: var(--ink-font-family, -apple-system, sans-serif);
          cursor: pointer;
          opacity: 0.8;
          transition: opacity var(--ink-transition-fast, 0.1s),
                      background-color var(--ink-transition-fast, 0.1s);
          user-select: none;
        }

        .transcribe-btn:hover {
          opacity: 1;
          background: var(--ink-hover-light);
        }

        .generating {
          margin-top: var(--ink-space-sm, 8px);
          font-size: var(--ink-font-size-small, 0.85em);
          opacity: 0.7;
          font-style: italic;
        }

        .generating::after {
          content: '';
          animation: dots 1.4s infinite;
        }

        @keyframes dots {
          0%, 20% { content: ''; }
          40% { content: '.'; }
          60% { content: '..'; }
          80%, 100% { content: '...'; }
        }

        .transcript {
          margin-top: var(--ink-space-sm, 8px);
          padding-top: var(--ink-space-sm, 8px);
          border-top: 1px solid var(--ink-border-normal);
          font-size: var(--ink-font-size-small, 0.85em);
          line-height: 1.4;
          overflow: hidden;
        }

        .learning-highlight {
          color: var(--ink-highlight, #0ea5e9);
          font-weight: 500;
          cursor: help;
          border-bottom: 1px dotted currentColor;
        }

        @media (prefers-reduced-motion: reduce) {
          .play-btn,
          .transcribe-btn {
            transition: none;
          }
          .generating::after {
            animation: none;
            content: '...';
          }
        }
      </style>

      <div class="audio-container">
        <div class="player">
          <button class="play-btn" aria-label="${t('ui.a11y.play_voice_message')}">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
          <div class="waveform">${this.renderWaveform()}</div>
          <span class="duration">${escapeHtml(duration)}</span>
        </div>

        ${
          this._generating
            ? `
          <div class="generating" aria-live="polite" aria-atomic="true">Generating transcript</div>
        `
            : ''
        }

        ${
          !this._revealed && !this._generating && this._transcript
            ? `
          <button class="transcribe-btn">Transcribe</button>
        `
            : ''
        }

        ${
          this._revealed
            ? `
          <div class="transcript" aria-live="polite" aria-atomic="true">${processText(this._transcript)}</div>
        `
            : ''
        }
      </div>
    `;

    // Wire transcribe button
    this.shadowRoot
      .querySelector('.transcribe-btn')
      ?.addEventListener('click', () => {
        this.showTranscript();
      });

    // Wire play button (for future audio support, currently just visual)
    this.shadowRoot
      .querySelector('.play-btn')
      ?.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('play-requested', { bubbles: true }),
        );
      });
  }
}

customElements.define('audio-bubble', AudioBubble);
