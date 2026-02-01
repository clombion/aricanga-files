/**
 * utils.js - Shared utility functions for ink tag parsing and message formatting
 *
 * Contains pure functions used across components for parsing ink output,
 * handling namespaced tags (status:battery:75), and message processing.
 */

// ============================================================================
// DURATION ESTIMATION
// ============================================================================

/**
 * Average speaking rate in words per second.
 * Conversational speech is typically 130-150 WPM (~2.2-2.5 WPS).
 * Using 2.3 as middle ground for natural speech pace.
 */
const WORDS_PER_SECOND = 2.3;

/**
 * Noise range for natural speech variation (hesitation, pauses, breathing).
 * Expressed as percentage of base duration.
 * e.g., 0.15 means ±15% variation
 */
const DURATION_NOISE_FACTOR = 0.15;

/**
 * Minimum duration in seconds for any audio message.
 * Even very short messages have recording overhead.
 */
const MIN_DURATION_SECONDS = 2;

/**
 * Count words in text, handling various whitespace and punctuation.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Generate deterministic noise based on text content.
 * Uses simple hash to ensure same text produces same "random" variation.
 * @param {string} text
 * @returns {number} Value between -1 and 1
 */
function deterministicNoise(text) {
  if (!text) return 0;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return (hash % 1000) / 1000;
}

/**
 * Format seconds as duration string "M:SS"
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Estimate speech duration from transcript text.
 *
 * Calculates based on word count and average speaking rate,
 * then adds deterministic noise for natural variation (hesitation, pauses).
 *
 * @param {string} transcript - The text to estimate duration for
 * @returns {string} Duration string in "M:SS" format
 *
 * @example
 * estimateSpeechDuration("Hello, how are you?") // "0:04"
 * estimateSpeechDuration("This is a longer message with more words.") // "0:05"
 */
export function estimateSpeechDuration(transcript) {
  const wordCount = countWords(transcript);

  if (wordCount === 0) {
    return formatDuration(MIN_DURATION_SECONDS);
  }

  const baseDuration = wordCount / WORDS_PER_SECOND;
  const noise = deterministicNoise(transcript);
  const noiseFactor = 1 + noise * DURATION_NOISE_FACTOR;
  const adjustedDuration = baseDuration * noiseFactor;
  const finalDuration = Math.max(MIN_DURATION_SECONDS, adjustedDuration);

  return formatDuration(Math.round(finalDuration));
}

// ============================================================================
// TAG PARSING
// ============================================================================

/**
 * Parse ink tags into key-value object
 * Handles:
 * - "key:value" pairs
 * - Flag-style "key" tags (becomes true)
 * - Namespaced tags like "status:time:10:41 AM" (becomes status.time = "10:41 AM")
 *
 * @param {string[]} tags - Array of tag strings from ink
 * @returns {Record<string, string|boolean|Record<string, string|number>>}
 */
export function parseTags(tags) {
  const result = {};
  if (!tags) return result;

  for (const tag of tags) {
    const colonIdx = tag.indexOf(':');

    if (colonIdx === -1) {
      // Flag tag: "clear" -> { clear: true }
      result[tag.trim()] = true;
      continue;
    }

    const key = tag.slice(0, colonIdx).trim();
    const rest = tag.slice(colonIdx + 1).trim();

    // Handle namespaced tags (status:time:10:41 AM, status:battery:75)
    if (key === 'status') {
      const secondColon = rest.indexOf(':');
      if (secondColon > -1) {
        const subKey = rest.slice(0, secondColon).trim();
        const value = rest.slice(secondColon + 1).trim();
        result.status = result.status || {};
        // Parse numeric values for battery and signal
        if (subKey === 'battery' || subKey === 'signal') {
          result.status[subKey] = parseInt(value, 10);
        } else {
          result.status[subKey] = value;
        }
      }
      continue;
    }

    // Handle presence tag (presence:online, presence:offline, presence:lastseen:10:32 AM)
    // Why: typing isn't a presence state here - it's handled via delay tags and state machine
    if (key === 'presence') {
      result.status = result.status || {};
      // Check for lastseen format
      if (rest.startsWith('lastseen:')) {
        result.status.presence = rest; // Keep full "lastseen:TIME" format
      } else {
        result.status.presence = rest; // "online", "offline"
      }
      continue;
    }

    // Standard key:value
    result[key] = rest;
  }

  return result;
}
