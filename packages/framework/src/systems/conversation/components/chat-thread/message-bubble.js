/**
 * message-bubble.js - Text message bubble with metadata
 *
 * Renders individual message bubbles with support for:
 * - Sent/received/system message types
 * - Message grouping (visual stacking)
 * - Timestamps and read receipts
 * - Learning highlights
 * - Disappearing message timers
 */

import { getChat, t } from '../../services/conversation-context.js';
import { DURATION_FAST } from '../../utils/animation-constants.js';
import { timerIcon } from '../../utils/icons.js';
import {
  escapeAttr,
  escapeHtml,
  LEARNING_HIGHLIGHT_CSS,
  processText,
} from '../../utils/text.js';

// Receipt icon SVGs - Signal-style overlapping circled checkmarks
// Rendered outside the bubble on dark background. For sent/delivered the circle
// outline is light gray, circles transparent (outline visible against dark bg).
// For read, circles filled light gray; front circle outline and checkmarks use
// bg color for stronger contrast against the rear circle.
// viewBox matches display size (14×14) — no browser scaling, so 1.5px strokes
// render without sub-pixel anti-aliasing blur.
const RECEIPT_GRAY = '#9E9E9E';
const RECEIPT_CHECK_READ = '#555';
export const RECEIPT_ICONS = {
  sent: `<svg class="receipt" data-state="sent" width="14" height="14" viewBox="0 0 14 14" aria-label="Sent">
    <circle class="receipt-circle-rear" cx="7" cy="7" r="5.5" stroke="${RECEIPT_GRAY}" stroke-width="1.5" fill="none"/>
    <path d="M4.5 7L6.5 9L9.5 5.5" stroke="${RECEIPT_GRAY}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  delivered: `<svg class="receipt" data-state="delivered" width="19" height="14" viewBox="0 0 19 14" aria-label="Delivered">
    <circle class="receipt-circle-rear" cx="7" cy="7" r="5.5" stroke="${RECEIPT_GRAY}" stroke-width="1.5" fill="none"/>
    <path d="M4.5 7L6.5 9L9.5 5.5" stroke="${RECEIPT_GRAY}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle class="receipt-circle-front" cx="12" cy="7" r="5.5" stroke="${RECEIPT_GRAY}" stroke-width="1.5" fill="var(--ink-color-bg, #121216)"/>
    <path d="M9.5 7L11.5 9L14.5 5.5" stroke="${RECEIPT_GRAY}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  read: `<svg class="receipt" data-state="read" width="19" height="14" viewBox="0 0 19 14" aria-label="Read">
    <circle class="receipt-circle-rear" cx="7" cy="7" r="5.5" stroke="${RECEIPT_CHECK_READ}" stroke-width="1.5" fill="${RECEIPT_GRAY}"/>
    <path d="M4.5 7L6.5 9L9.5 5.5" stroke="${RECEIPT_CHECK_READ}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle class="receipt-circle-front" cx="12" cy="7" r="5.5" stroke="${RECEIPT_CHECK_READ}" stroke-width="1.5" fill="${RECEIPT_GRAY}"/>
    <path d="M9.5 7L11.5 9L14.5 5.5" stroke="${RECEIPT_CHECK_READ}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

// Timer icon for disappearing messages
const TIMER_ICON = timerIcon(12);

// Audio icon for quoted audio messages
const AUDIO_QUOTE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
  <line x1="12" y1="19" x2="12" y2="23"/>
</svg>`;

/**
 * Render timestamp + receipt metadata below a message bubble (Signal-style)
 * @param {Object} msg - Message object
 * @param {boolean} isLast - Whether this is the last message in its group
 * @param {string} type - 'sent' | 'received' | 'system'
 * @param {string} chatId - Chat identifier
 * @returns {string} HTML string (empty if not isLast)
 */
export function renderMeta(msg, isLast, type, chatId) {
  if (!isLast || type === 'system') return '';
  const receipt = msg.receipt;
  const chatConfig = getChat(chatId);
  const timerSuffix = chatConfig?.disappearingDuration
    ? `<span class="msg-timer">${TIMER_ICON}</span>`
    : '';
  if (msg.time || (type === 'sent' && receipt && RECEIPT_ICONS[receipt])) {
    let html = `<span class="meta meta-${type}"${msg.label ? ` data-msg-label="${escapeAttr(msg.label)}"` : ''}${msg.id ? ` data-msg-id="${escapeAttr(msg.id)}"` : ''}>`;
    if (msg.time) {
      html += escapeHtml(msg.time);
    }
    if (type === 'sent' && receipt && RECEIPT_ICONS[receipt]) {
      html += `<span class="receipt-icon">${RECEIPT_ICONS[receipt]}</span>`;
    }
    html += `${timerSuffix}</span>`;
    return html;
  }
  return '';
}

/**
 * Render quote preview HTML for reply messages
 * @param {Object} quote - QuotedContent object
 * @returns {string} HTML string for quote preview, or empty string if no quote
 */
export function renderQuotePreview(quote) {
  if (!quote) return '';

  let content = '';

  // Determine content type
  if (quote.imageSrc) {
    // Normalize image path
    let imageSrc = quote.imageSrc;
    if (imageSrc && !imageSrc.startsWith('/') && !imageSrc.startsWith('http')) {
      imageSrc = `/${imageSrc}`;
    }
    content = `<img class="quote-thumb" src="${escapeAttr(imageSrc)}" alt="Quoted image" loading="lazy">`;
  } else if (quote.audioTranscript) {
    content = `<span class="quote-audio">${AUDIO_QUOTE_ICON} ${escapeHtml(quote.audioTranscript)}</span>`;
  } else if (quote.text) {
    content = `<span class="quote-text">${escapeHtml(quote.text)}</span>`;
  } else {
    return ''; // No content to show
  }

  // Build the quote preview
  let html = '<div class="quote-preview">';
  if (quote.speaker) {
    html += `<span class="quote-speaker">${escapeHtml(quote.speaker)}</span>`;
  }
  html += content;
  html += '</div>';

  return html;
}

/**
 * Render a single message bubble HTML
 * @param {Object} options
 * @param {Object} options.msg - Message object
 * @param {boolean} options.isLast - Last in group (show time, full radius)
 * @param {string} options.chatId - Current chat ID for config lookup
 * @returns {string} HTML string
 */
export function renderMessageBubble({ msg, isLast, chatId, isFresh = false }) {
  const type = msg.type || 'received';
  const chatConfig = getChat(chatId);
  const textContent = msg.kind === 'attachment' ? msg.caption : msg.text;
  const hasLinkPreview = !!msg.linkPreview;

  let html = '';

  // If message has link preview, wrap both preview and bubble in a container
  // Preview renders OUTSIDE the bubble (card above text, visually connected)
  if (hasLinkPreview) {
    html += `<div class="message-wrapper has-link-preview" data-type="${type}"${msg.label ? ` data-label="${escapeAttr(msg.label)}"` : ''}>`;
    const lp = msg.linkPreview;
    html += `<link-preview attached
      url="${escapeAttr(lp.url || '')}"
      ${lp.domain ? `domain="${escapeAttr(lp.domain)}"` : ''}
      ${lp.title ? `title="${escapeAttr(lp.title)}"` : ''}
      ${lp.description ? `description="${escapeAttr(lp.description)}"` : ''}
      ${lp.imageSrc ? `image-src="${escapeAttr(lp.imageSrc)}"` : ''}
      layout="${escapeAttr(lp.layout || 'card')}"
      ${lp.isVideo ? 'is-video="true"' : ''}
      type="${type}"
    ></link-preview>`;
  }

  const classes = ['message', type];
  if (!isLast) classes.push('grouped');
  if (msg.kind === 'attachment') classes.push('attachment');
  if (msg.quote) classes.push('has-quote');
  if (hasLinkPreview) classes.push('has-link-preview');

  html += `<div class="${classes.join(' ')}" data-type="${type}"${!hasLinkPreview && msg.label ? ` data-label="${escapeAttr(msg.label)}"` : ''}>`;

  // Render quote preview if present
  html += renderQuotePreview(msg.quote);

  // For system messages in disappearing chats, prepend timer icon
  if (type === 'system' && chatConfig?.disappearingDuration) {
    html += `<span class="text"><span class="system-timer">${TIMER_ICON}</span> ${processText(textContent || '')}</span>`;
  } else if (textContent) {
    const isTruncatable = textContent.length >= 250;
    html += `<span class="text${isTruncatable ? ' truncated' : ''}">${processText(textContent)}</span>`;
    if (isTruncatable) {
      html += `<button class="read-more-toggle" aria-expanded="false">${t('messages.read_more')}</button>`;
    }
  }

  // Show attachment filename if present
  if (msg.kind === 'attachment') {
    html += `<span class="attachment-info">${escapeHtml(msg.attachmentSrc)}</span>`;
  }

  html += '</div>';

  const metaMsg = isFresh ? { ...msg, time: t('time.now') } : msg;
  html += renderMeta(metaMsg, isLast, type, chatId);

  // Close wrapper if we opened one
  if (hasLinkPreview) {
    html += '</div>';
  }

  return html;
}

/**
 * Process message text with learning highlights
 * 1. Escapes HTML for safety
 * 2. Converts ((text::source)) to learning-highlight spans
 * @param {string} text - Raw message text
 * @returns {string} - HTML with learning highlights
 */
// Re-export text utilities for backward compatibility
export { escapeHtml, escapeAttr, processText, LEARNING_HIGHLIGHT_CSS };

/**
 * Render an audio message bubble
 * @param {Object} msg - Message object with audio property
 * @returns {string} HTML string
 */
export function renderAudioBubble(msg) {
  const type = msg.type || 'received';
  const hasQuote = !!msg.quote;
  let html = `<div class="message-wrapper${hasQuote ? ' has-quote' : ''}" data-type="${type}"${msg.label ? ` data-label="${escapeAttr(msg.label)}"` : ''}>`;

  // Render quote preview if present
  html += renderQuotePreview(msg.quote);

  html += `<audio-bubble
    duration="${escapeAttr(msg.duration || '0:00')}"
    type="${type}"
    data-id="${msg.id}"
    data-transcript="${escapeAttr(msg.transcript || '')}"
  ></audio-bubble>`;

  html += '</div>';
  return html;
}

/**
 * Render an image message bubble
 * @param {Object} msg - Message object with image property
 * @returns {string} HTML string
 */
export function renderImageBubble(msg) {
  const type = msg.type || 'received';
  const hasQuote = !!msg.quote;
  let html = `<div class="message-wrapper${hasQuote ? ' has-quote' : ''}" data-type="${type}"${msg.label ? ` data-label="${escapeAttr(msg.label)}"` : ''}>`;

  // Render quote preview if present
  html += renderQuotePreview(msg.quote);

  // Normalize image path to absolute (prepend / if not already absolute or URL)
  let imageSrc = msg.imageSrc || '';
  if (imageSrc && !imageSrc.startsWith('/') && !imageSrc.startsWith('http')) {
    imageSrc = `/${imageSrc}`;
  }

  html += `<image-bubble
    src="${escapeAttr(imageSrc)}"
    type="${type}"
    ${msg.caption ? `caption="${escapeAttr(msg.caption)}"` : ''}
  ></image-bubble>`;

  html += '</div>';
  return html;
}

/**
 * Render a link preview message bubble
 * @param {Object} msg - Message object with link preview properties
 * @returns {string} HTML string
 */
export function renderLinkPreviewBubble(msg) {
  const type = msg.type || 'received';
  const hasQuote = !!msg.quote;
  let html = `<div class="message-wrapper${hasQuote ? ' has-quote' : ''}" data-type="${type}"${msg.label ? ` data-label="${escapeAttr(msg.label)}"` : ''}>`;

  // Render quote preview if present
  html += renderQuotePreview(msg.quote);

  html += `<link-preview
    url="${escapeAttr(msg.url || '')}"
    ${msg.domain ? `domain="${escapeAttr(msg.domain)}"` : ''}
    ${msg.title ? `title="${escapeAttr(msg.title)}"` : ''}
    ${msg.description ? `description="${escapeAttr(msg.description)}"` : ''}
    ${msg.imageSrc ? `image-src="${escapeAttr(msg.imageSrc)}"` : ''}
    layout="${escapeAttr(msg.layout || 'card')}"
    ${msg.isVideo ? 'is-video="true"' : ''}
    type="${type}"
  ></link-preview>`;

  html += '</div>';
  return html;
}

/**
 * CSS styles for message bubbles (to be included in parent component)
 */
export const MESSAGE_BUBBLE_STYLES = `
  /* Message bubbles */
  .message {
    max-width: 75%;
    padding: 10px 15px;
    border-radius: var(--ink-radius-bubble, 18px);
    line-height: 1.4;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .message.grouped {
    margin-bottom: -6px;
  }
  .message.sent {
    background: var(--ink-bubble-sent-bg, #0066cc);
    color: var(--ink-bubble-sent-text, white);
    align-self: flex-end;
    border-bottom-right-radius: 4px;
  }
  .message.sent.grouped {
    border-radius: var(--ink-radius-bubble, 18px);
    border-bottom-right-radius: 4px;
    border-top-right-radius: 4px;
  }
  .message.received {
    background: var(--ink-bubble-received-bg, #3a3a3c);
    color: var(--ink-bubble-received-text, #f2f2f7);
    align-self: flex-start;
    border-bottom-left-radius: 4px;
  }
  .message.received.grouped {
    border-radius: var(--ink-radius-bubble, 18px);
    border-bottom-left-radius: 4px;
    border-top-left-radius: 4px;
  }
  .message.system {
    background: none;
    color: var(--ink-color-text-secondary, #a1a1aa);
    align-self: center;
    font-style: italic;
    font-size: var(--ink-font-size-small, 0.85em);
    text-align: center;
    max-width: 90%;
  }
  .system-timer {
    display: inline-flex;
    vertical-align: middle;
    margin-right: 4px;
  }
  .system-timer svg {
    opacity: 0.8;
  }
  .msg-timer {
    display: inline-flex;
    vertical-align: middle;
    margin-left: 4px;
    opacity: 0.7;
  }

  ${LEARNING_HIGHLIGHT_CSS}

  .message.attachment {
    display: flex;
    flex-direction: column;
    gap: var(--ink-space-xs, 4px);
  }
  .attachment-info {
    display: flex;
    align-items: center;
    gap: var(--ink-space-xs, 4px);
    font-size: var(--ink-font-size-small, 0.85em);
    opacity: 0.9;
    padding-top: var(--ink-space-xs, 4px);
    border-top: 1px solid var(--ink-border-normal);
    margin-top: var(--ink-space-xs, 4px);
  }
  .attachment-info::before {
    content: '\\1F4CE';
  }

  /* Rich media message wrappers */
  .message-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ink-space-xs, 4px);
  }
  .message-wrapper[data-type="sent"] {
    align-items: flex-end;
  }
  /* Link preview wrapper: no gap, preview and bubble connect seamlessly */
  .message-wrapper.has-link-preview {
    gap: 0;
    max-width: 75%;
  }
  .message-wrapper.has-link-preview[data-type="sent"] {
    align-self: flex-end;
  }
  .message-wrapper.has-link-preview[data-type="received"] {
    align-self: flex-start;
  }
  /* Children stretch to match width of the widest one */
  .message-wrapper.has-link-preview > .message,
  .message-wrapper.has-link-preview > link-preview {
    max-width: none;
  }
  /* Square top corners on message when attached to preview above - must come last for specificity */
  .message-wrapper.has-link-preview > .message.sent,
  .message-wrapper.has-link-preview > .message.received {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  /* Quote preview styles - Signal-style inside bubble */
  .quote-preview {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    margin: -2px -6px 6px -6px;
    background: var(--ink-quote-bg, rgba(255, 255, 255, 0.12));
    border-left: 3px solid var(--ink-quote-border, rgba(255, 255, 255, 0.6));
    border-radius: 12px;
    font-size: var(--ink-font-size-small, 0.9em);
    max-width: calc(100% + 12px);
  }
  .message.sent .quote-preview {
    background: var(--ink-quote-sent-bg, rgba(200, 220, 255, 0.35));
    border-left-color: var(--ink-quote-sent-border, rgba(255, 255, 255, 0.7));
  }
  .quote-speaker {
    font-weight: 600;
    color: var(--ink-quote-speaker, #1a1a1a);
    font-size: 0.95em;
  }
  .message.sent .quote-speaker {
    color: var(--ink-quote-speaker-sent, #1a1a1a);
  }
  .quote-text {
    color: var(--ink-quote-text, rgba(0, 0, 0, 0.7));
    line-height: 1.35;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .message.received .quote-text {
    color: var(--ink-quote-text-received, rgba(255, 255, 255, 0.85));
  }
  .quote-audio {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    align-items: center;
    gap: 6px;
    color: var(--ink-quote-text, rgba(0, 0, 0, 0.7));
  }
  .message.received .quote-audio {
    color: var(--ink-quote-text-received, rgba(255, 255, 255, 0.85));
  }
  .quote-audio svg {
    flex-shrink: 0;
  }
  .quote-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 4px;
  }

  /* Message metadata — rendered outside/below the bubble (Signal-style) */
  .meta {
    display: flex;
    align-items: center;
    gap: var(--ink-space-xs, 4px);
    font-size: var(--ink-font-size-tiny, 0.75em);
    color: var(--ink-color-text-muted, #8e8e93);
    margin-top: 2px;
    padding: 0 4px;
  }
  .meta-sent {
    align-self: flex-end;
    justify-content: flex-end;
  }
  .meta-received {
    align-self: flex-start;
    justify-content: flex-start;
  }
  .receipt-icon {
    display: inline-flex;
    align-items: center;
  }
  .receipt-icon svg {
    height: 14px;
    width: auto;
  }

  /* Receipt CSS transition classes for animated state changes */
  .receipt-icon .receipt-circle-front {
    transition: fill ${DURATION_FAST}ms ease-out, opacity ${DURATION_FAST}ms ease-out;
  }
  .receipt-icon .receipt-circle-rear {
    transition: opacity ${DURATION_FAST}ms ease-out;
  }

  /* Animation for delivered → read transition */
  .receipt-animate {
    animation: receipt-pulse 0.3s ease-out;
  }

  @keyframes receipt-pulse {
    0% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .receipt-animate {
      animation: none;
    }
    .receipt-icon .receipt-circle-front,
    .receipt-icon .receipt-circle-rear {
      transition: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .message {
      animation: none;
      transition: none;
    }
  }

  /* Read-more truncation for long messages */
  .text.truncated {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 5;
    overflow: hidden;
  }
  .text.truncated.expanded {
    -webkit-line-clamp: unset;
    overflow: visible;
  }
  .read-more-toggle {
    background: none;
    border: none;
    color: var(--ink-bubble-received-text, #f2f2f7);
    font-size: var(--ink-font-size-small, 0.85em);
    font-weight: 600;
    padding: 4px 0 0;
    cursor: pointer;
    display: block;
    margin-left: auto;
    text-align: right;
  }
`;
