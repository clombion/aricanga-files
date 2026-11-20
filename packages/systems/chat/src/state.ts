import type { ChatMessageVM } from '#src/reduce';

/** @public */
interface ChatView {
  readonly type: 'hub' | 'chat';
  readonly chatId?: string;
}

/**
 * Where a chat's unread separator sits: above every message (`top`, a chat first notified while
 * empty), or after the last message read. A chat with no cursor has no separator.
 */
type ReadCursor = { readonly at: 'top' } | { readonly at: 'after'; readonly messageId: string };

// Full-shape chat slice (declared now to make the design-for-two proof real — a
// trivial slice couldn't reveal whether read-cursor/HWM concepts leaked into
// foundation, ADR-0004). The Phase 1 reduce is a stub; Phase 2 fills the physics.
interface ChatState {
  readonly messageHistory: Readonly<Record<string, readonly ChatMessageVM[]>>;
  readonly deferredMessages: Readonly<Record<string, readonly ChatMessageVM[]>>;
  readonly lastReadMessageId: Readonly<Record<string, ReadCursor>>;
  readonly notifiedChatIds: readonly string[];
  readonly currentView: ChatView;
  /**
   * The conversation the story is currently in (set by a `# chat:` tag at knot entry); the default
   * routing target when no `# targetChat` override is present. Absent before the first tag.
   */
  readonly activeChat?: string;
  /**
   * The simulation clock in absolute minutes (day * 1440 + minute of day). Absent until a time
   * signal anchors it; forward-only by construction.
   */
  readonly clock?: number;
}

/**
 * The chat slice before any story step.
 *
 * @returns {ChatState} The hub view, with no history, no queue, no cursor and no clock.
 */
function initChatState(): ChatState {
  return {
    currentView: { type: 'hub' },
    deferredMessages: {},
    lastReadMessageId: {},
    messageHistory: {},
    notifiedChatIds: [],
  };
}

export { initChatState };
export type { ChatState, ChatView, ReadCursor };
