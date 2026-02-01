// Pure functions for story chunk processing
// Extracted from processStoryChunk for testability and reuse

/**
 * Check if a message with same content already exists in history
 * Prevents duplicate messages when ink re-visits stitches
 * @param {Array} history - Existing message history
 * @param {Object} msg - New message to check
 * @returns {boolean} True if duplicate exists
 */
export function isDuplicateMessage(history, msg) {
  if (!history || history.length === 0) return false;
  // Check last 10 messages for efficiency (duplicates are usually recent)
  const recent = history.slice(-10);
  return recent.some((existing) => {
    // Different kinds are never duplicates
    if (existing.kind !== msg.kind) return false;
    // Different speaker or type are never duplicates
    if (existing.type !== msg.type || existing.speaker !== msg.speaker) {
      return false;
    }

    // Compare kind-specific content
    switch (msg.kind) {
      case 'text': {
        // Text must match, and linkPreview URL (if any) must match
        if (existing.text !== msg.text) return false;
        const existingUrl = existing.linkPreview?.url;
        const msgUrl = msg.linkPreview?.url;
        return existingUrl === msgUrl;
      }
      case 'audio':
        return existing.audioSrc === msg.audioSrc;
      case 'image':
        return existing.imageSrc === msg.imageSrc;
      case 'attachment':
        return existing.attachmentSrc === msg.attachmentSrc;
      case 'linkPreview':
        return existing.url === msg.url;
      default:
        return false;
    }
  });
}

/**
 * Extract story boundary information from tags
 * Determines if we've passed the story_start marker
 * @param {Object} tags - Parsed ink tags
 * @param {boolean} storyStartedThisRender - Current story_start state
 * @returns {{ storyStarted: boolean, isSeed: boolean }}
 */
export function extractStoryBoundary(tags, storyStartedThisRender) {
  const hasStoryStartTag = tags.story_start !== undefined;
  const storyStarted = storyStartedThisRender || hasStoryStartTag;
  return {
    storyStarted,
    isSeed: !storyStarted,
    hasStoryStartTag,
  };
}

/**
 * Build a status-only message (no text content)
 * @param {Object} tags - Parsed ink tags
 * @param {function} generateId - ID generator function
 * @returns {Object} Status message object
 */
export function buildStatusMessage(tags, generateId) {
  return {
    ...tags,
    id: generateId(),
    timestamp: Date.now(),
    _statusOnly: true,
  };
}

/**
 * Resolve total delay from accumulated and captured delays
 * @param {number} accumulatedDelay - Delay from previous processing
 * @param {number} capturedDelay - Delay captured in current chunk
 * @returns {number} Total delay in milliseconds
 */
export function resolveDelay(accumulatedDelay, capturedDelay) {
  return (accumulatedDelay || 0) + (capturedDelay || 0);
}

/**
 * Determine if a message should be buffered (delayed display)
 * @param {number} totalDelay - Total delay in milliseconds
 * @returns {boolean} True if message should be buffered
 */
export function shouldBufferMessage(totalDelay) {
  return totalDelay > 0;
}

/**
 * Validate target chat ID against known chats
 * Logs warning if chat ID is invalid or unknown
 * @param {string} chatId - Chat ID from story
 * @param {string[]} [knownChatIds=[]] - List of valid chat IDs
 * @returns {string} Validated chat ID or 'unknown'
 */
export function validateTargetChat(chatId, knownChatIds = []) {
  if (!chatId || typeof chatId !== 'string') {
    console.warn(
      '[conversation] current_chat not set, defaulting to "unknown"',
    );
    return 'unknown';
  }

  if (knownChatIds.length > 0 && !knownChatIds.includes(chatId)) {
    console.warn(
      `[conversation] current_chat "${chatId}" not in known chats: [${knownChatIds.join(', ')}]`,
    );
  }

  return chatId;
}

/**
 * Get target chat from tags or ink's current_chat variable
 *
 * NOTE: targetChat is handled here directly, NOT via TagHandlers registry.
 * This is intentional - routing must be determined before message processing.
 * See task-065 for architectural decision.
 *
 * Tags override variable (captured before ink variable reset in atomic Continue())
 * @param {Object} story - inkjs Story instance
 * @param {string[]} [knownChatIds=[]] - Optional list of valid chat IDs
 * @param {Object} [tags={}] - Parsed ink tags (may contain targetChat)
 * @returns {string} Chat ID or 'unknown' if invalid
 */
// CQO-17: Default parameter + optional chaining for defensive access
export function getTargetChat(story, knownChatIds = [], tags = {}) {
  // Tag override takes precedence (captured before variable reset)
  // CQO-15 exception: Framework layer, no InkBridge access - direct access acceptable
  const tagChat = tags?.targetChat;
  const varChat = story?.variablesState?.current_chat;
  const chatId = tagChat || varChat;

  // DEBUG: Log cross-chat routing
  if (tagChat && tagChat !== varChat) {
    console.log('[getTargetChat] Cross-chat routing:', {
      tagChat,
      varChat,
      resolved: chatId,
    });
  }

  return validateTargetChat(chatId, knownChatIds);
}
