import type { ChatMessageVM } from './reduce';

export interface ChatView {
  readonly type: 'hub' | 'chat';
  readonly chatId?: string;
}

// Full-shape chat slice (declared now to make the design-for-two proof real — a
// trivial slice couldn't reveal whether read-cursor/HWM concepts leaked into
// foundation, ADR-0004). The Phase 1 reduce is a stub; Phase 2 fills the physics.
export interface ChatState {
  readonly messageHistory: Readonly<Record<string, readonly ChatMessageVM[]>>;
  readonly deferredMessages: Readonly<Record<string, readonly ChatMessageVM[]>>;
  readonly lastReadMessageId: Readonly<Record<string, string | null>>;
  readonly notifiedChatIds: readonly string[];
  readonly currentView: ChatView;
  // The conversation the story is currently in (set by a `# chat:` tag at knot
  // entry); the default routing target when no `# targetChat` override is present.
  readonly activeChat: string | null;
}

export function initChatState(): ChatState {
  return {
    messageHistory: {},
    deferredMessages: {},
    lastReadMessageId: {},
    notifiedChatIds: [],
    currentView: { type: 'hub' },
    activeChat: null,
  };
}
