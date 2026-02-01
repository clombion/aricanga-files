/**
 * message-grouper.js - Pure utility for grouping consecutive messages
 *
 * Groups messages from the same sender within a time threshold
 * for visual presentation (grouped bubbles).
 */

import { getUITiming } from '../../services/conversation-context.js';

// Default message grouping threshold (2 minutes)
const DEFAULT_GROUP_THRESHOLD_MS = 120000;

/**
 * Group consecutive messages from same sender within time threshold
 * @param {Array} messages - Array of message objects
 * @param {number} thresholdMs - Group if within this time (default from config)
 * @returns {Array<{type: string, speaker: string|undefined, messages: Array, firstTimestamp: number, lastTimestamp: number}>}
 */
export function groupMessages(
  messages,
  thresholdMs = getUITiming('messageGroupThreshold') ??
    DEFAULT_GROUP_THRESHOLD_MS,
) {
  const groups = [];
  let current = null;

  for (const msg of messages) {
    // Inherit speaker from current group when omitted (ink convention:
    // speaker tag is set once, follow-up messages omit it)
    const effectiveSpeaker =
      msg.speaker ?? (msg.type === current?.type ? current.speaker : undefined);

    const shouldGroup =
      current &&
      msg.type === current.type &&
      effectiveSpeaker === current.speaker &&
      msg.timestamp != null &&
      current.lastTimestamp != null &&
      msg.timestamp - current.lastTimestamp < thresholdMs;

    if (shouldGroup) {
      current.messages.push(msg);
      current.lastTimestamp = msg.timestamp;
    } else {
      current = {
        type: msg.type || 'received',
        speaker: effectiveSpeaker,
        messages: [msg],
        firstTimestamp: msg.timestamp,
        lastTimestamp: msg.timestamp,
      };
      groups.push(current);
    }
  }
  return groups;
}
