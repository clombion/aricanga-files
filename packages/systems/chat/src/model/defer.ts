import type { ChatState, ReadCursor } from '#src/state';
import type { Effect, InkStep } from '@narratives/foundation';
import { entryOf, holds } from '#src/model/keyed';
import type { ChatMessageVM } from '#src/reduce';
import { appendMessage } from '#src/model/route';
import { showNotification } from '#src/effects';

interface MessageOutcome {
  readonly state: ChatState;
  readonly effects: readonly Effect[];
}

/** The index `Array.prototype.at` reads the last element at. */
const LAST = -1;

/**
 * The chat the player is viewing.
 *
 * @param {ChatState} state - The chat slice.
 * @returns {string | undefined} The open chat, or undefined at the hub.
 */
function viewedChatId(state: ChatState): string | undefined {
  return state.currentView.type === 'chat' ? state.currentView.chatId : undefined;
}

/**
 * Whether a message bypasses the deferred queue: it carries `# immediate`.
 *
 * @param {InkStep} step - The ink step a message comes from.
 * @returns {boolean} Whether the step is tagged `immediate`.
 */
function isImmediate(step: InkStep): boolean {
  return step.tags.some((tag) => tag.key === 'immediate');
}

/**
 * Drop a chat's deferred queue.
 *
 * @param {ChatState} state - The chat slice.
 * @param {string} chatId - The chat whose queue goes.
 * @returns {ChatState} The slice without that queue; the same slice when it had none.
 */
function clearDeferred(state: ChatState, chatId: string): ChatState {
  if (!holds(state.deferredMessages, chatId)) {
    return state;
  }
  const { [chatId]: _drop, ...rest } = state.deferredMessages;
  return { ...state, deferredMessages: rest };
}

/**
 * Queue a message behind its chat's earlier deferred messages.
 *
 * @param {ChatState} state - The chat slice.
 * @param {ChatMessageVM} message - The message to defer.
 * @returns {ChatState} The slice with the message at the end of its chat's queue.
 */
function appendDeferred(state: ChatState, message: ChatMessageVM): ChatState {
  const prev = entryOf(state.deferredMessages, message.chatId) ?? [];
  return {
    ...state,
    deferredMessages: { ...state.deferredMessages, [message.chatId]: [...prev, message] },
  };
}

/**
 * Move a chat's deferred queue into its history, in order.
 *
 * @param {ChatState} state - The chat slice.
 * @param {string} chatId - The chat whose queue moves.
 * @returns {ChatState} The slice with the queue appended to the history and dropped.
 */
function flushDeferred(state: ChatState, chatId: string): ChatState {
  let next = state;
  for (const message of entryOf(state.deferredMessages, chatId) ?? []) {
    next = appendMessage(next, message);
  }
  return clearDeferred(next, chatId);
}

/**
 * The cursor a chat's first notification anchors: after its last message, or above every message
 * when it has none.
 *
 * @param {ChatState} state - The chat slice before the notified message is appended.
 * @param {string} chatId - The notified chat.
 * @returns {ReadCursor} The cursor at the chat's current end.
 */
function cursorAtEnd(state: ChatState, chatId: string): ReadCursor {
  const last = entryOf(state.messageHistory, chatId)?.at(LAST);
  return last === undefined ? { at: 'top' } : { at: 'after', messageId: last.id };
}

/**
 * Append a message to the history of a chat the player is not viewing, notifying it once.
 *
 * Anchor the unread separator at the chat's pre-append end, only if the cursor is unset: a set
 * cursor keeps the read position. Read from `state`, not from the appended slice, which already
 * holds the message.
 *
 * @param {ChatState} state - The chat slice.
 * @param {ChatMessageVM} message - The message to place.
 * @returns {MessageOutcome} The slice with the message, its notification and its cursor.
 */
function notifyMessage(state: ChatState, message: ChatMessageVM): MessageOutcome {
  const { chatId } = message;
  const next = appendMessage(state, message);
  const lastReadMessageId =
    holds(state.lastReadMessageId, chatId)
      ? next.lastReadMessageId
      : { ...next.lastReadMessageId, [chatId]: cursorAtEnd(state, chatId) };
  return {
    effects: [showNotification({ chatId, preview: message.text })],
    state: { ...next, lastReadMessageId, notifiedChatIds: [...next.notifiedChatIds, chatId] },
  };
}

/**
 * The notify/defer branch. The immediate flush is checked ahead of the plain defer gate, else an
 * already-notified immediate in another chat would wrongly defer. Deferral happens only inside a
 * different open chat; at the hub and in the viewed chat, messages flow to history (notify-once on
 * the hub).
 *
 * @param {ChatState} state - The chat slice.
 * @param {ChatMessageVM} message - The message to place.
 * @param {boolean} immediate - Whether the message bypasses the deferred queue.
 * @returns {MessageOutcome} The slice with the message placed, and any notification.
 */
function placeMessage(state: ChatState, message: ChatMessageVM, immediate: boolean): MessageOutcome {
  const { chatId } = message;
  const isViewed = chatId === viewedChatId(state);
  const inAnotherChat = state.currentView.type === 'chat' && !isViewed;
  const alreadyNotified = state.notifiedChatIds.includes(chatId);

  if (inAnotherChat && alreadyNotified) {
    // Bypass deferral: flush the queued messages, then this one, into history.
    const placed = immediate ? appendMessage(flushDeferred(state, chatId), message) : appendDeferred(state, message);
    return { effects: [], state: placed };
  }
  if (isViewed || alreadyNotified) {
    return { effects: [], state: appendMessage(state, message) };
  }
  return notifyMessage(state, message);
}

/**
 * Open a chat: focus it, clear its notified state, and replay its deferred queue into history in
 * one shot. The stored view-models are moved, so their defer-time ids are kept; a replay notifies
 * nothing (the typing animation is #38).
 *
 * @param {ChatState} state - The chat slice.
 * @param {string} chatId - The chat to open.
 * @returns {ChatState} The slice viewing the chat, its queue in its history.
 */
function openChat(state: ChatState, chatId: string): ChatState {
  return flushDeferred(
    {
      ...state,
      currentView: { chatId, type: 'chat' },
      notifiedChatIds: state.notifiedChatIds.filter((notified) => notified !== chatId),
    },
    chatId,
  );
}

/**
 * Close the open chat, back to the hub.
 *
 * @param {ChatState} state - The chat slice.
 * @returns {ChatState} The slice viewing the hub.
 */
function closeChat(state: ChatState): ChatState {
  return { ...state, currentView: { type: 'hub' } };
}

export { closeChat, isImmediate, openChat, placeMessage, viewedChatId };
