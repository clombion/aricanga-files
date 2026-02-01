// Type Contracts - JSDoc definitions and factory functions
// These types make illegal states unrepresentable by using discriminated unions

import { estimateSpeechDuration } from './utils.js';

/**
 * @typedef {'sent' | 'received' | 'system'} MessageType
 */

/**
 * @typedef {'none' | 'sent' | 'delivered' | 'read'} ReceiptStatus
 */

/**
 * Content that can be quoted in a reply message
 * @typedef {Object} QuotedContent
 * @property {string} [text] - Quoted text content
 * @property {string} [imageSrc] - Quoted image path
 * @property {string} [audioTranscript] - Quoted audio transcript
 * @property {string} [speaker] - Original message sender
 */

/**
 * @typedef {'offline' | 'online' | 'typing'} PresenceStatus
 */

// ============================================================================
// MESSAGE TYPES (Discriminated Union via 'kind' field)
// ============================================================================

/**
 * Link preview data that can be attached to a text message
 * @typedef {Object} LinkPreviewData
 * @property {string} url - Target: "glossary:term-id" or external URL
 * @property {string} [domain] - Display domain (e.g., "Glossary", "youtube.com")
 * @property {string} [title] - Preview title
 * @property {string} [description] - Preview description
 * @property {string} [imageSrc] - Thumbnail/preview image
 * @property {LinkPreviewLayout} [layout] - 'card' (default), 'inline', 'minimal'
 * @property {boolean} [isVideo] - Show play button overlay
 */

/**
 * @typedef {Object} TextMessage
 * @property {'text'} kind - Discriminant for text messages
 * @property {string} id - Unique message ID
 * @property {string} text - Message content
 * @property {MessageType} type - sent/received/system
 * @property {string} [speaker] - Sender name (for received messages)
 * @property {string} [time] - Display timestamp
 * @property {string} [date] - Date string for separators (e.g., "2024-07-15" or "-1" for yesterday)
 * @property {ReceiptStatus} [receipt] - Read receipt status (for sent messages)
 * @property {number} timestamp - Unix timestamp for grouping
 * @property {QuotedContent} [quote] - Resolved quote content for reply messages
 * @property {string} [label] - Optional label for referencing this message
 * @property {LinkPreviewData} [linkPreview] - Attached link preview data
 */

/**
 * @typedef {Object} AudioMessage
 * @property {'audio'} kind - Discriminant for audio messages
 * @property {string} id - Unique message ID
 * @property {string} audioSrc - Path to audio file
 * @property {string} duration - Display duration, e.g., "0:14"
 * @property {string} transcript - Text revealed on expand
 * @property {MessageType} type - sent/received/system
 * @property {string} [speaker] - Sender name
 * @property {string} [time] - Display timestamp
 * @property {string} [date] - Date string for separators
 * @property {ReceiptStatus} [receipt] - Delivery status
 * @property {boolean} transcriptRevealed - Whether transcript has been shown
 * @property {number} timestamp - Unix timestamp for grouping
 * @property {QuotedContent} [quote] - Resolved quote content for reply messages
 * @property {string} [label] - Optional label for referencing this message
 */

/**
 * @typedef {Object} ImageMessage
 * @property {'image'} kind - Discriminant for image messages
 * @property {string} id - Unique message ID
 * @property {string} imageSrc - Path to image file
 * @property {string} [caption] - Optional caption text
 * @property {MessageType} type - sent/received/system
 * @property {string} [speaker] - Sender name
 * @property {string} [time] - Display timestamp
 * @property {string} [date] - Date string for separators
 * @property {ReceiptStatus} [receipt] - Delivery status
 * @property {number} timestamp - Unix timestamp for grouping
 * @property {QuotedContent} [quote] - Resolved quote content for reply messages
 * @property {string} [label] - Optional label for referencing this message
 */

/**
 * @typedef {Object} AttachmentMessage
 * @property {'attachment'} kind - Discriminant for attachment messages
 * @property {string} id - Unique message ID
 * @property {string} attachmentSrc - Path to attachment file
 * @property {string} [caption] - Optional caption text
 * @property {MessageType} type - sent/received/system
 * @property {string} [speaker] - Sender name
 * @property {string} [time] - Display timestamp
 * @property {string} [date] - Date string for separators
 * @property {ReceiptStatus} [receipt] - Delivery status
 * @property {number} timestamp - Unix timestamp for grouping
 * @property {QuotedContent} [quote] - Resolved quote content for reply messages
 * @property {string} [label] - Optional label for referencing this message
 */

/**
 * @typedef {'card' | 'inline' | 'minimal'} LinkPreviewLayout
 */

/**
 * @typedef {Object} LinkPreviewMessage
 * @property {'linkPreview'} kind - Discriminant for link preview messages
 * @property {string} id - Unique message ID
 * @property {string} url - Target: "glossary:term-id" or external URL
 * @property {string} [domain] - Display domain (e.g., "Glossary", "youtube.com")
 * @property {string} [title] - Preview title
 * @property {string} [description] - Preview description
 * @property {string} [imageSrc] - Thumbnail/preview image
 * @property {LinkPreviewLayout} [layout] - 'card' (default), 'inline', 'minimal'
 * @property {boolean} [isVideo] - Show play button overlay
 * @property {MessageType} type - sent/received/system
 * @property {string} [speaker] - Sender name
 * @property {string} [time] - Display timestamp
 * @property {string} [date] - Date string for separators
 * @property {ReceiptStatus} [receipt] - Delivery status
 * @property {number} timestamp - Unix timestamp for grouping
 * @property {QuotedContent} [quote] - Resolved quote content for reply messages
 * @property {string} [label] - Optional label for referencing this message
 */

/**
 * Union type for all message kinds
 * @typedef {TextMessage | AudioMessage | ImageMessage | AttachmentMessage | LinkPreviewMessage} Message
 */

// ============================================================================
// PHONE STATUS TYPES
// ============================================================================

/**
 * @typedef {Object} PhoneStatus
 * @property {string} time - Story time, e.g., "10:41 AM"
 * @property {number} battery - Battery percentage 0-100
 * @property {number} signal - Signal bars 0-4
 * @property {string} [internet] - Internet connectivity type (wifi0-2, mobile0-5, airplane, none)
 */

/**
 * @typedef {Object} PresenceState
 * @property {PresenceStatus} status - Current presence
 * @property {string} [lastSeen] - Time string for 'last seen' display
 */

// ============================================================================
// FACTORY FUNCTIONS (ensure required fields, generate IDs)
// ============================================================================

/**
 * Generate a unique ID
 * @returns {string}
 */
function generateId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  );
}

/**
 * Create a text message
 * @param {Object} params
 * @param {string} params.text - Message content
 * @param {MessageType} params.type - Message type
 * @param {string} [params.speaker] - Sender name
 * @param {string} [params.time] - Display timestamp
 * @param {string} [params.date] - Date string for separators
 * @param {ReceiptStatus} [params.receipt] - Receipt status
 * @param {string} [params.notificationPreview] - Override text for notification previews
 * @param {QuotedContent} [params.quote] - Resolved quote content
 * @param {string} [params.label] - Label for referencing this message
 * @param {LinkPreviewData} [params.linkPreview] - Attached link preview data
 * @returns {TextMessage}
 */
export function createTextMessage({
  text,
  type,
  speaker,
  time,
  date,
  receipt,
  notificationPreview,
  quote,
  label,
  linkPreview,
}) {
  return {
    kind: 'text',
    id: generateId(),
    text,
    type,
    speaker,
    time,
    date,
    receipt: receipt ?? (type === 'sent' ? 'delivered' : 'none'),
    timestamp: Date.now(),
    ...(notificationPreview && { notificationPreview }),
    ...(quote && { quote }),
    ...(label && { label }),
    ...(linkPreview && { linkPreview }),
  };
}

/**
 * Create an audio message
 * @param {Object} params
 * @param {string} [params.audioSrc] - Path to audio file (optional)
 * @param {string} [params.duration] - Duration string. If omitted, estimated from transcript.
 * @param {string} params.transcript - Transcript text
 * @param {MessageType} params.type - Message type
 * @param {string} [params.speaker] - Sender name
 * @param {string} [params.time] - Display timestamp
 * @param {string} [params.date] - Date string for separators
 * @param {ReceiptStatus} [params.receipt] - Receipt status
 * @param {QuotedContent} [params.quote] - Resolved quote content
 * @param {string} [params.label] - Label for referencing this message
 * @returns {AudioMessage}
 */
export function createAudioMessage({
  audioSrc,
  duration,
  transcript,
  type,
  speaker,
  time,
  date,
  receipt,
  quote,
  label,
}) {
  // If no explicit duration, estimate from transcript text
  const resolvedDuration = duration ?? estimateSpeechDuration(transcript);

  return {
    kind: 'audio',
    id: generateId(),
    audioSrc,
    duration: resolvedDuration,
    transcript,
    type,
    speaker,
    time,
    date,
    receipt: receipt ?? (type === 'sent' ? 'delivered' : 'none'),
    transcriptRevealed: false,
    timestamp: Date.now(),
    ...(quote && { quote }),
    ...(label && { label }),
  };
}

/**
 * Create an image message
 * @param {Object} params
 * @param {string} params.imageSrc - Path to image file
 * @param {string} [params.caption] - Optional caption
 * @param {MessageType} params.type - Message type
 * @param {string} [params.speaker] - Sender name
 * @param {string} [params.time] - Display timestamp
 * @param {string} [params.date] - Date string for separators
 * @param {ReceiptStatus} [params.receipt] - Receipt status
 * @param {QuotedContent} [params.quote] - Resolved quote content
 * @param {string} [params.label] - Label for referencing this message
 * @returns {ImageMessage}
 */
export function createImageMessage({
  imageSrc,
  caption,
  type,
  speaker,
  time,
  date,
  receipt,
  quote,
  label,
}) {
  return {
    kind: 'image',
    id: generateId(),
    imageSrc,
    caption,
    type,
    speaker,
    time,
    date,
    receipt: receipt ?? (type === 'sent' ? 'delivered' : 'none'),
    timestamp: Date.now(),
    ...(quote && { quote }),
    ...(label && { label }),
  };
}

/**
 * Create an attachment message
 * @param {Object} params
 * @param {string} params.attachmentSrc - Path to attachment file
 * @param {string} [params.caption] - Optional caption
 * @param {MessageType} params.type - Message type
 * @param {string} [params.speaker] - Sender name
 * @param {string} [params.time] - Display timestamp
 * @param {string} [params.date] - Date string for separators
 * @param {ReceiptStatus} [params.receipt] - Receipt status
 * @param {QuotedContent} [params.quote] - Resolved quote content
 * @param {string} [params.label] - Label for referencing this message
 * @returns {AttachmentMessage}
 */
export function createAttachmentMessage({
  attachmentSrc,
  caption,
  type,
  speaker,
  time,
  date,
  receipt,
  quote,
  label,
}) {
  return {
    kind: 'attachment',
    id: generateId(),
    attachmentSrc,
    caption,
    type,
    speaker,
    time,
    date,
    receipt: receipt ?? (type === 'sent' ? 'delivered' : 'none'),
    timestamp: Date.now(),
    ...(quote && { quote }),
    ...(label && { label }),
  };
}

/**
 * Create a link preview message
 * @param {Object} params
 * @param {string} params.url - Target URL (e.g., "glossary:term-id" or external URL)
 * @param {string} [params.domain] - Display domain
 * @param {string} [params.title] - Preview title
 * @param {string} [params.description] - Preview description
 * @param {string} [params.imageSrc] - Thumbnail/preview image
 * @param {LinkPreviewLayout} [params.layout] - Layout variant
 * @param {boolean} [params.isVideo] - Show play button overlay
 * @param {MessageType} params.type - Message type
 * @param {string} [params.speaker] - Sender name
 * @param {string} [params.time] - Display timestamp
 * @param {string} [params.date] - Date string for separators
 * @param {ReceiptStatus} [params.receipt] - Receipt status
 * @param {QuotedContent} [params.quote] - Resolved quote content
 * @param {string} [params.label] - Label for referencing this message
 * @returns {LinkPreviewMessage}
 */
export function createLinkPreviewMessage({
  url,
  domain,
  title,
  description,
  imageSrc,
  layout,
  isVideo,
  type,
  speaker,
  time,
  date,
  receipt,
  quote,
  label,
}) {
  return {
    kind: 'linkPreview',
    id: generateId(),
    url,
    domain,
    title,
    description,
    imageSrc,
    layout: layout ?? 'card',
    isVideo: isVideo ?? false,
    type,
    speaker,
    time,
    date,
    receipt: receipt ?? (type === 'sent' ? 'delivered' : 'none'),
    timestamp: Date.now(),
    ...(quote && { quote }),
    ...(label && { label }),
  };
}

// ============================================================================
// PARSING (ink tags -> typed messages)
// ============================================================================

/**
 * Parse ink text and tags into a typed Message
 * @param {string} text - The text content from ink
 * @param {Record<string, string>} tags - Parsed tag key-value pairs
 * @returns {Message}
 */
export function parseMessage(text, tags) {
  const type = /** @type {MessageType} */ (tags.type ?? 'received');
  const speaker = tags.speaker;
  const time = tags.time;
  const date = tags.date;
  const quote = /** @type {QuotedContent} */ (tags.quote);
  const label = tags.label;

  // Audio message: has audio tag
  if (tags.audio) {
    return createAudioMessage({
      audioSrc: tags.audio,
      duration: tags.duration, // If omitted, factory estimates from transcript
      transcript: text, // Text content becomes the transcript
      type,
      speaker,
      time,
      date,
      receipt: /** @type {ReceiptStatus} */ (tags.receipt),
      quote,
      label,
    });
  }

  // Image message: has image tag
  if (tags.image) {
    return createImageMessage({
      imageSrc: tags.image,
      caption: text || undefined, // Empty text = no caption
      type,
      speaker,
      time,
      date,
      receipt: /** @type {ReceiptStatus} */ (tags.receipt),
      quote,
      label,
    });
  }

  // Attachment message: has attachment tag
  if (tags.attachment) {
    return createAttachmentMessage({
      attachmentSrc: tags.attachment,
      caption: text || undefined, // Empty text = no caption
      type,
      speaker,
      time,
      date,
      receipt: /** @type {ReceiptStatus} */ (tags.receipt),
      quote,
      label,
    });
  }

  // Link preview: if has linkUrl AND text content, attach to text message
  // If only linkUrl (no text), create standalone link preview (backward compat)
  if (tags.linkUrl) {
    const linkPreviewData = /** @type {LinkPreviewData} */ ({
      url: tags.linkUrl,
      domain: tags.linkDomain,
      title: tags.linkTitle,
      description: tags.linkDesc,
      imageSrc: tags.linkImage,
      layout: /** @type {LinkPreviewLayout} */ (tags.linkLayout),
      isVideo: tags.linkVideo === 'true',
    });

    // Text + link = text message with attached preview
    if (text) {
      return createTextMessage({
        text,
        type,
        speaker,
        time,
        date,
        receipt: /** @type {ReceiptStatus} */ (tags.receipt),
        notificationPreview: tags.notificationPreview,
        quote,
        label,
        linkPreview: linkPreviewData,
      });
    }

    // No text = standalone link preview (backward compatibility)
    return createLinkPreviewMessage({
      url: tags.linkUrl,
      domain: tags.linkDomain,
      title: tags.linkTitle,
      description: tags.linkDesc,
      imageSrc: tags.linkImage,
      layout: /** @type {LinkPreviewLayout} */ (tags.linkLayout),
      isVideo: tags.linkVideo === 'true',
      type,
      speaker,
      time,
      date,
      receipt: /** @type {ReceiptStatus} */ (tags.receipt),
      quote,
      label,
    });
  }

  // Default: text message
  return createTextMessage({
    text,
    type,
    speaker,
    time,
    date,
    receipt: /** @type {ReceiptStatus} */ (tags.receipt),
    notificationPreview: tags.notificationPreview,
    quote,
    label,
  });
}

// ============================================================================
// TYPE GUARDS (for runtime discrimination)
// ============================================================================

/**
 * Check if message is a text message
 * @param {Message} msg
 * @returns {msg is TextMessage}
 */
export function isTextMessage(msg) {
  return msg.kind === 'text';
}

/**
 * Check if message is an audio message
 * @param {Message} msg
 * @returns {msg is AudioMessage}
 */
export function isAudioMessage(msg) {
  return msg.kind === 'audio';
}

/**
 * Check if message is an image message
 * @param {Message} msg
 * @returns {msg is ImageMessage}
 */
export function isImageMessage(msg) {
  return msg.kind === 'image';
}

/**
 * Check if message is an attachment message
 * @param {Message} msg
 * @returns {msg is AttachmentMessage}
 */
export function isAttachmentMessage(msg) {
  return msg.kind === 'attachment';
}

/**
 * Check if message is a link preview message
 * @param {Message} msg
 * @returns {msg is LinkPreviewMessage}
 */
export function isLinkPreviewMessage(msg) {
  return msg.kind === 'linkPreview';
}

// ============================================================================
// PHONE STATUS HELPERS
// ============================================================================

/**
 * Parse time string to minutes since midnight
 * @param {string} timeStr - e.g., "10:41 AM"
 * @returns {number} Minutes since midnight
 */
export function parseTimeToMinutes(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;

  let [, hours, minutes, period] = match;
  let h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);

  if (period) {
    period = period.toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
  }

  return h * 60 + m;
}

/**
 * Calculate battery drain from story time change
 * Full day (1440 minutes) = 100% drain
 * @param {string} prevTime - Previous story time
 * @param {string} nextTime - New story time
 * @returns {number} Percentage points to subtract (0-100)
 */
export function calculateBatteryDrain(prevTime, nextTime) {
  const prevMinutes = parseTimeToMinutes(prevTime);
  const nextMinutes = parseTimeToMinutes(nextTime);

  // Backward time jump = entering chat that started earlier (no drain)
  const diff = nextMinutes - prevMinutes;
  if (diff < 0) return 0;

  // 1440 minutes = 100%, so 1 minute = ~0.069%
  return Math.max(0, diff * (100 / 1440));
}

/**
 * Create initial phone status
 * @param {Partial<PhoneStatus>} [overrides]
 * @returns {PhoneStatus}
 */
export function createPhoneStatus(overrides = {}) {
  return {
    time: '9:41 AM',
    battery: 100,
    signal: 4,
    internet: 'mobile4',
    ...overrides,
  };
}
