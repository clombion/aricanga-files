import {
  type Command,
  type Effect,
  type ReduceResult,
  type System,
  fx,
} from '@narratives/foundation';
import { appendMessage, buildMessage, readChatSwitch, resolveChatId } from './model/route';
import { type ChatState, initChatState } from './state';

export const CHAT_TAGS = [
  'chat',
  'speaker',
  'type',
  'time',
  'duration',
  'targetChat',
  'receipt',
  'immediate',
] as const;

export interface ChatViewModel {
  readonly view: ChatState['currentView'];
  readonly messages: ChatState['messageHistory'];
}

// Chat kernel (Phase 2). task-020: routing — a `# chat:` tag sets the conversation
// context; a message routes to `# targetChat` (override) or `activeChat`, lands in
// its owning chat's history with a stable id, and a background message notifies.
// Deferral, notify-once, and replay are task-021. Commands narrow in later slices.
export const chatSystem: System<ChatState, Command, Effect, ChatViewModel> = {
  id: 'chat',
  tags: [...CHAT_TAGS],
  init: (_seed) => initChatState(),
  reduce(state, input, ctx): ReduceResult<ChatState, Effect> {
    if (input.source !== 'story') return { state, effects: [] };
    const { step } = input;

    // A `# chat:` tag switches the conversation context for subsequent messages.
    const switched = readChatSwitch(step);
    const base = switched !== null ? { ...state, activeChat: switched } : state;
    if (step.text === '') return { state: base, effects: [] };

    const chatId = resolveChatId(step, base.activeChat);
    const message = buildMessage(step, chatId, ctx);
    const next = appendMessage(base, message);

    const isBackground =
      next.currentView.type !== 'chat' || next.currentView.chatId !== chatId;
    const effects: Effect[] = isBackground
      ? [fx.present('chat/showNotification', { chatId, preview: message.text })]
      : [];
    return { state: next, effects };
  },
  status: () => 'free',
  view: (state) => ({ view: state.currentView, messages: state.messageHistory }),
};
