import { type Effect, type InkStep, fx } from '@narratives/foundation';
import type { ChatMessageVM } from '../reduce';
import type { ChatState } from '../state';
import { appendMessage } from './route';

export interface MessageOutcome {
  readonly state: ChatState;
  readonly effects: readonly Effect[];
}

const viewedChatId = (state: ChatState): string | null =>
  state.currentView.type === 'chat' ? (state.currentView.chatId ?? null) : null;

/** A `# immediate` message bypasses the deferred queue. */
export function isImmediate(step: InkStep): boolean {
  return step.tags.some((t) => t.key === 'immediate');
}

function clearDeferred(state: ChatState, chatId: string): ChatState {
  if (!(chatId in state.deferredMessages)) return state;
  const { [chatId]: _drop, ...rest } = state.deferredMessages;
  return { ...state, deferredMessages: rest };
}

export function appendDeferred(state: ChatState, message: ChatMessageVM): ChatState {
  const prev = state.deferredMessages[message.chatId] ?? [];
  return {
    ...state,
    deferredMessages: { ...state.deferredMessages, [message.chatId]: [...prev, message] },
  };
}

// The notify/defer branch (task-021). immediate-flush is checked ahead of the
// plain defer gate, else an already-notified immediate in another chat would
// wrongly defer. Deferral happens ONLY inside a different open chat; at the hub
// and the viewed chat, messages flow to history (notify-once on the hub).
export function placeMessage(state: ChatState, message: ChatMessageVM, immediate: boolean): MessageOutcome {
  const { chatId } = message;
  const isViewed = chatId === viewedChatId(state);
  const inAnotherChat = state.currentView.type === 'chat' && !isViewed;
  const alreadyNotified = state.notifiedChatIds.includes(chatId);

  if (inAnotherChat && alreadyNotified) {
    if (immediate) {
      // bypass deferral: flush the queued messages, then this one, into history.
      const queued = state.deferredMessages[chatId] ?? [];
      let next = clearDeferred(state, chatId);
      for (const m of queued) next = appendMessage(next, m);
      return { state: appendMessage(next, message), effects: [] };
    }
    return { state: appendDeferred(state, message), effects: [] };
  }

  const next = appendMessage(state, message);
  if (!isViewed && !alreadyNotified) {
    // Anchor the unread separator at the pre-append last id (or null = before-all
    // for an empty chat), only if the cursor is unset — a set cursor preserves the
    // read position. Read from `state`, not `next` (which already holds `message`).
    const lastReadMessageId =
      chatId in state.lastReadMessageId
        ? next.lastReadMessageId
        : { ...next.lastReadMessageId, [chatId]: state.messageHistory[chatId]?.at(-1)?.id ?? null };
    return {
      state: { ...next, notifiedChatIds: [...next.notifiedChatIds, chatId], lastReadMessageId },
      effects: [fx.present('chat/showNotification', { chatId, preview: message.text })],
    };
  }
  return { state: next, effects: [] };
}

// Open a chat: focus it, clear its notified state, and replay its deferred queue
// into history in one shot (the stored VMs are moved — their defer-time ids are
// preserved; no notification on replay; typing animation is task-032).
export function openChat(state: ChatState, chatId: string): ChatState {
  const queued = state.deferredMessages[chatId] ?? [];
  let next: ChatState = {
    ...state,
    currentView: { type: 'chat', chatId },
    notifiedChatIds: state.notifiedChatIds.filter((c) => c !== chatId),
  };
  for (const m of queued) next = appendMessage(next, m);
  return clearDeferred(next, chatId);
}

export function closeChat(state: ChatState): ChatState {
  return { ...state, currentView: { type: 'hub' } };
}
