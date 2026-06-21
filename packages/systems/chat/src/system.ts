import type { Effect, System } from '@narratives/foundation';
import { reduceChunk } from './reduce';
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

export type ChatEffect = Effect<
  'chat/showNotification',
  { readonly chatId: string; readonly preview: string }
>;

// Phase 1 STUB system — proves the System contract and tag-routing, not the
// physics. The real kernel (routing/deferral/notifications/time/receipts) lands
// in Phase 2; this just appends a message and notifies on a background chat.
export const chatSystem: System<ChatState, ChatViewModel> = {
  id: 'chat',
  tags: CHAT_TAGS,
  init: initChatState,
  reduce(state, chunk, _ctx) {
    if (chunk.text === '') return { state, effects: [] };
    const vm = reduceChunk(chunk);
    const chatId = chunk.tags.find((t) => t.key === 'targetChat')?.value ?? 'main';
    const prev = state.messageHistory[chatId] ?? [];
    const messageHistory = { ...state.messageHistory, [chatId]: [...prev, vm] };
    const isBackground =
      state.currentView.type !== 'chat' || state.currentView.chatId !== chatId;
    const effects: ChatEffect[] = isBackground
      ? [{ kind: 'chat/showNotification', payload: { chatId, preview: vm.text } }]
      : [];
    return { state: { ...state, messageHistory }, effects };
  },
  deriveViewModel(state) {
    return { view: state.currentView, messages: state.messageHistory };
  },
  registerComponents() {
    // no-op in Phase 1; Lit components register in Phase 3.
  },
};
