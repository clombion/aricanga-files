// Game Controller - Orchestrates state machine and UI events
// Simplified to ~150 lines by extracting state machine to game-state.js

// Framework imports
import {
  createChatOpenedEvent,
  createChoicesEvent,
  createMessageEvent,
  createNotificationEvent,
  createPresenceEvent,
  createReceiptChangedEvent,
  createTypingEndEvent,
  createTypingStartEvent,
  EVENTS,
  eventBus,
  Story,
  storage,
} from '@narratives/framework';
import { createActor } from 'xstate';
import { CHATS } from './config.js';
import { gameStateMachine } from './game-state.js';
import { SEEDS } from './generated/seeds.js';
import { InkBridge } from './ink-bridge.js';
import { loadExternalData } from './services/data-loader.js';

export class GameController extends EventTarget {
  constructor() {
    super();
    this.story = null;
    this.bridge = null;
    this._lastReceiptChange = null;

    this.actor = createActor(gameStateMachine);
    this.actor.subscribe((snapshot) => this.handleStateUpdate(snapshot));
    this.actor.start();
  }

  async init(storyUrl) {
    try {
      const res = await fetch(storyUrl);
      const json = await res.json();
      this.story = new Story(json);

      // Load and inject external data BEFORE any ink runs
      // Values are wrapped with [[value||source]] for learning highlights
      const externalData = await loadExternalData();
      for (const [varName, value] of Object.entries(externalData)) {
        try {
          this.story.variablesState[varName] = value; // CQO-15 exception: bridge not created yet
        } catch (_e) {
          console.warn(`Variable ${varName} not declared in ink`);
        }
      }

      this.initBridge();

      const savedData = this.loadState();

      // Load seeds into history for fresh games
      // Seeds are pre-existing backstory - NO notifications should fire
      // (all seeds have _isSeed: true from build-time extraction)
      const initialHistory =
        savedData?.messageHistory || this.buildInitialHistory();

      this.actor.send({
        type: 'STORY_LOADED',
        story: this.story,
        history: initialHistory,
        lastReadMessageId: savedData?.lastReadMessageId || {},
        deferredMessages: savedData?.deferredMessages || {},
        unreadChatIds: savedData?.unreadChatIds || [],
      });

      // Auto-start story at hub knot for fresh games
      // Story writer controls initialization via hub -> game_init
      if (!savedData?.messageHistory) {
        this.story.ChoosePathString('hub');
        this.actor.send({ type: 'CHECK_STORY' });
      }

      this.dispatchEvent(new CustomEvent('ready'));
      eventBus.emit(EVENTS.READY);
    } catch (e) {
      console.error('Init failed', e);
    }
  }

  initBridge() {
    // Create bridge with view accessor
    this.bridge = new InkBridge(
      this.story,
      () => this.actor.getSnapshot().context.currentView,
    );

    // Wire bridge events to controller events
    // Sound events
    this.bridge.addEventListener('sound-requested', (e) => {
      console.log('play_sound:', e.detail.soundId);
    });

    // Async data events - resume story processing when data arrives
    this.bridge.addEventListener('data-ready', (e) => {
      this.actor.send({ type: 'DATA_READY', data: e.detail });
    });
  }

  openChat(chatId) {
    // Get deferred count BEFORE sending OPEN_CHAT (which starts replay)
    const snapshotBefore = this.actor.getSnapshot();
    const deferredCount =
      snapshotBefore.context.deferredMessages?.[chatId]?.length || 0;

    this.actor.send({ type: 'OPEN_CHAT', chatId });

    const snapshot = this.actor.getSnapshot();
    const history = snapshot.context.messageHistory[chatId] || [];

    const openPayload = createChatOpenedEvent(chatId, history, deferredCount);
    this.dispatchEvent(new CustomEvent('chat-opened', { detail: openPayload }));
    eventBus.emit(EVENTS.CHAT_OPENED, openPayload);

    // Set default presence from config (ink can override with # presence: tags)
    const chatConfig = CHATS[chatId];
    if (chatConfig?.defaultPresence) {
      const presencePayload = createPresenceEvent(
        chatId,
        chatConfig.defaultPresence,
      );
      this.dispatchEvent(
        new CustomEvent('status-changed', { detail: presencePayload }),
      );
      eventBus.emit(EVENTS.PRESENCE_CHANGED, presencePayload);
    }

    if (this.story) {
      const storyIsInThisChat = this.bridge.getCurrentChat() === chatId;

      if (this.story.currentChoices.length > 0 && storyIsInThisChat) {
        // Choices already exist for this chat
        const choicesPayload = createChoicesEvent(this.story.currentChoices);
        this.dispatchEvent(
          new CustomEvent('choices-available', { detail: choicesPayload }),
        );
        eventBus.emit(EVENTS.CHOICES_AVAILABLE, choicesPayload);
      } else {
        // Navigate to chat knot
        this.bridge.setCurrentChat(chatId);
        const config = CHATS[chatId];
        if (config) {
          try {
            this.story.ChoosePathString(config.knotName);
          } catch (_e) {
            console.warn(`Knot ${config.knotName} not found`);
          }
        }
        this.actor.send({ type: 'CHECK_STORY' });
      }
    } else {
      this.actor.send({ type: 'CHECK_STORY' });
    }
  }

  closeChat() {
    this.actor.send({ type: 'CLOSE_CHAT' });
    eventBus.emit(EVENTS.CHAT_CLOSED);
    this.saveState();
  }

  selectChoice(index) {
    this.actor.send({ type: 'CHOOSE', index });
  }

  getVariable(name) {
    return this.story?.variablesState[name]; // CQO-15 exception: debug panel API
  }

  getVariables() {
    return this.story?.variablesState ?? {}; // CQO-15 exception: debug panel API
  }

  setVariable(name, value) {
    // Delegate to bridge for type-safe access
    this.bridge?.setVariable(name, value);
  }

  saveState() {
    const snapshot = this.actor.getSnapshot();
    if (!this.story || snapshot.context.isResetting) return;

    storage.save({
      inkState: this.story.state.ToJson(),
      messageHistory: snapshot.context.messageHistory,
      lastReadMessageId: snapshot.context.lastReadMessageId,
      deferredMessages: snapshot.context.deferredMessages,
      unreadChatIds: [...snapshot.context.unreadChatIds],
      timestamp: Date.now(),
    });
    // Note: notifiedChatIds is NOT persisted - intentional UX decision
    // On refresh, first new background message should notify again
  }

  loadState() {
    const state = storage.load();
    if (state && this.story) {
      try {
        this.story.state.LoadJson(state.inkState);
      } catch (e) {
        console.warn('Failed to restore ink state:', e);
      }
      // Migrate old unreadState format to unreadChatIds
      if (state.unreadState && !state.unreadChatIds) {
        state.unreadChatIds = Object.keys(state.unreadState).filter(
          (k) => state.unreadState[k],
        );
      }
    }
    return state;
  }

  resetGame() {
    this.actor.send({ type: 'RESET_GAME' });
    storage.clear();
    location.reload();
  }

  /**
   * Build initial message history from pre-computed seeds
   * Seeds are extracted at build time from ink (before # story_start)
   * CQO-17: Validate SEEDS structure before use
   * @returns {Object} Message history keyed by chatId
   */
  buildInitialHistory() {
    if (!SEEDS || typeof SEEDS !== 'object') {
      console.warn('SEEDS not available, starting with empty history');
      return {};
    }

    const history = {};
    for (const [chatId, messages] of Object.entries(SEEDS)) {
      // CQO-17: Validate array structure
      history[chatId] = Array.isArray(messages) ? [...messages] : [];
    }
    return history;
  }

  handleStateUpdate(snapshot) {
    const ctx = snapshot.context;
    const view = ctx.currentView;
    const currentChat = view.type === 'chat' ? view.chatId : null;

    // Each background chat notifies once, then suppresses until the user
    // opens it. Two Sets enforce this across two scopes:
    //   - notifiedThisCycle: intra-render guard (ctx is a frozen snapshot, so
    //     MARK_CHAT_NOTIFIED won't update notifiedChatIds until next cycle)
    //   - ctx.notifiedChatIds: inter-render guard (cleared when chat is opened)
    const notifiedThisCycle = new Set();

    // Process messages for ALL chats (cross-chat routing)
    for (const [chatId, msgs] of Object.entries(ctx.messageHistory)) {
      // Skip if state machine hasn't initialized emittedMessageIds for this chat yet
      // (prevents duplicate processing during intermediate state transitions)
      const emitted = ctx.emittedMessageIds[chatId];
      if (!emitted) continue;

      const isCurrentChat = chatId === currentChat;

      for (const msg of msgs) {
        if (!emitted.has(msg.id)) {
          // Mark as emitted in Set (mutates context - intentional for performance)
          emitted.add(msg.id);

          // Emit MESSAGE_RECEIVED for all chats
          const msgPayload = createMessageEvent(chatId, msg, isCurrentChat);
          this.dispatchEvent(
            new CustomEvent('message-added', { detail: msgPayload }),
          );
          eventBus.emit(EVENTS.MESSAGE_RECEIVED, msgPayload);

          // For background chats: notify once per chat
          // Skip if: already notified (either scope), status-only, or seed
          if (
            !isCurrentChat &&
            !msg._statusOnly &&
            !msg._isSeed &&
            msg.text &&
            !ctx.notifiedChatIds?.has(chatId) &&
            !notifiedThisCycle.has(chatId)
          ) {
            // Mark in both scopes: local (immediate) and state machine (async)
            notifiedThisCycle.add(chatId);
            this.actor.send({ type: 'MARK_CHAT_NOTIFIED', chatId });

            // CQO-17: Explicit type check prevents coercion bugs
            // Send full text - components handle their own truncation for display
            const preview =
              typeof msg.notificationPreview === 'string'
                ? msg.notificationPreview
                : msg.text || '';

            // Emit notification event on both controller and eventBus
            const notificationPayload = createNotificationEvent(
              chatId,
              preview,
            );
            this.dispatchEvent(
              new CustomEvent('notification', { detail: notificationPayload }),
            );
            eventBus.emit(EVENTS.NOTIFICATION_SHOW, notificationPayload);
          }

          // Status bar updates are phone-level (not chat-specific), so emit regardless of active chat
          if (msg.status) {
            this.dispatchEvent(
              new CustomEvent('status-changed', { detail: msg.status }),
            );
            if (msg.status.presence) {
              eventBus.emit(
                EVENTS.PRESENCE_CHANGED,
                createPresenceEvent(chatId, msg.status.presence),
              );
            }
            // Why: status.time tags deprecated - TimeContext is single source of truth.
            // Use # time: tags instead, processed via processMessageTime()
          }
        }
      }
    }

    // Emit receipt changed event if state machine flagged one (deduplicate)
    if (ctx._receiptChanged) {
      const rc = ctx._receiptChanged;
      const rcKey = `${rc.chatId}:${rc.label}:${rc.receipt}`;
      if (
        rc.chatId &&
        rc.label &&
        rc.receipt &&
        this._lastReceiptChange !== rcKey
      ) {
        this._lastReceiptChange = rcKey;
        eventBus.emit(
          EVENTS.MESSAGE_RECEIPT_CHANGED,
          createReceiptChangedEvent(rc.chatId, rc.label, rc.receipt),
        );
      }
    }

    // Typing indicator (only emit when viewing a chat)
    if (
      currentChat &&
      snapshot.matches('delaying') &&
      ctx.targetChatId === currentChat
    ) {
      const typingPayload = createTypingStartEvent(
        currentChat,
        ctx.bufferedMessage?.speaker,
      );
      this.dispatchEvent(
        new CustomEvent('typing-start', { detail: typingPayload }),
      );
      eventBus.emit(EVENTS.TYPING_START, typingPayload);
    } else {
      this.dispatchEvent(new CustomEvent('typing-end'));
      if (currentChat) {
        eventBus.emit(EVENTS.TYPING_END, createTypingEndEvent(currentChat));
      }
    }

    // Choices - derive from ink story (single source of truth)
    if (snapshot.matches('waitingForInput') && this.story) {
      const storyChat = this.bridge.getCurrentChat();
      if (storyChat === currentChat && this.story.currentChoices.length > 0) {
        const choicesPayload = createChoicesEvent(this.story.currentChoices);
        this.dispatchEvent(
          new CustomEvent('choices-available', { detail: choicesPayload }),
        );
        eventBus.emit(EVENTS.CHOICES_AVAILABLE, choicesPayload);
      }
    }
  }
}
