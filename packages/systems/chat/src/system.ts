import {
  type Command,
  type Effect,
  type ReduceResult,
  type System,
  fx,
} from '@narratives/foundation';
import { reduceStep } from './reduce';
import { type ChatState, initChatState } from './state';

export const CHAT_TAGS = [
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

// Phase 1 STUB system — proves the System contract and tag-routing, not the
// physics. The real kernel (routing/deferral/notifications/time/receipts) lands
// in Phase 2; this just appends a message and notifies on a background chat.
// Commands are the open envelope for now; physics narrows them.
export const chatSystem: System<ChatState, Command, Effect, ChatViewModel> = {
  id: 'chat',
  tags: [...CHAT_TAGS],
  init: (_seed) => initChatState(),
  reduce(state, input, _ctx): ReduceResult<ChatState, Effect> {
    if (input.source !== 'story') return { state, effects: [] };
    const { step } = input;
    if (step.text === '') return { state, effects: [] };
    const vm = reduceStep(step);
    const chatId = step.tags.find((t) => t.key === 'targetChat')?.value ?? 'main';
    const prev = state.messageHistory[chatId] ?? [];
    const messageHistory = { ...state.messageHistory, [chatId]: [...prev, vm] };
    const isBackground =
      state.currentView.type !== 'chat' || state.currentView.chatId !== chatId;
    const effects: Effect[] = isBackground
      ? [fx.present('chat/showNotification', { chatId, preview: vm.text })]
      : [];
    return { state: { ...state, messageHistory }, effects };
  },
  status: () => 'free',
  view: (state) => ({ view: state.currentView, messages: state.messageHistory }),
};
