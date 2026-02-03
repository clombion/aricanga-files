// Game Controller - Orchestrates state machine and UI events
// Simplified to ~150 lines by extracting state machine to game-state.js

import {
  createActor,
  eventBus,
  Story,
  storage,
  EVENTS,
  createChatOpenedEvent,
  createChoicesEvent,
  createMessageEvent,
  createNotificationEvent,
  createPresenceEvent,
  createTypingEndEvent,
  createTypingStartEvent,
} from '@narratives/framework';
import { CHATS } from './config.js';
import { gameStateMachine } from './game-state.js';
import { InkBridge } from './ink-bridge.js';
import { loadExternalData } from './services/data-loader.js';

export class GameController extends EventTarget {
  constructor() {
    super();
    this.story = null;
    this.bridge = null;

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
      this.actor.send({
        type: 'STORY_LOADED',
        story: this.story,
        history: savedData ? savedData.messageHistory : {},
      });

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
    // NOTE: Notifications are emergent - they fire automatically when messages
    // target a background chat via # targetChat: tag (see handleStateUpdate).
    // The notification-drawer is SSOT and subscribes to NOTIFICATION_SHOW.

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
    this.actor.send({ type: 'OPEN_CHAT', chatId });

    const snapshot = this.actor.getSnapshot();
    const history = snapshot.context.messageHistory[chatId] || [];

    const openPayload = createChatOpenedEvent(chatId, history);
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
      timestamp: Date.now(),
    });
  }

  loadState() {
    const state = storage.load();
    if (state && this.story) {
      try {
        this.story.state.LoadJson(state.inkState);
      } catch (e) {
        console.warn('Failed to restore ink state:', e);
      }
    }
    return state;
  }

  resetGame() {
    this.actor.send({ type: 'RESET_GAME' });
    storage.clear();
    location.reload();
  }

  handleStateUpdate(snapshot) {
    const ctx = snapshot.context;
    const view = ctx.currentView;
    const currentChat = view.type === 'chat' ? view.chatId : null;

    // Track notifications within this update to prevent duplicates
    // (MARK_CHAT_NOTIFIED is async, so ctx.notifiedChatIds isn't updated yet)
    const notifiedThisUpdate = new Set();

    // Process messages for ALL chats (cross-chat routing)
    for (const [chatId, msgs] of Object.entries(ctx.messageHistory)) {
      // emittedMessageIds[chatId] is now initialized by state machine when messages are added
      const emitted = ctx.emittedMessageIds[chatId] || new Set();
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

          // For background chats: auto-notify on FIRST message only
          // Skip if: already notified (in context or this update) or status-only
          if (
            !isCurrentChat &&
            !msg._statusOnly &&
            msg.text &&
            !ctx.notifiedChatIds?.has(chatId) &&
            !notifiedThisUpdate.has(chatId)
          ) {
            // Mark chat as notified locally AND send to state machine
            notifiedThisUpdate.add(chatId);
            this.actor.send({ type: 'MARK_CHAT_NOTIFIED', chatId });

            // CQO-17: Explicit type check prevents coercion bugs
            const preview =
              typeof msg.notificationPreview === 'string'
                ? msg.notificationPreview
                : msg.text?.length > 40
                  ? `${msg.text.slice(0, 40)}...`
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

          // Emit status-changed only for current chat
          if (isCurrentChat && msg.status) {
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

    // Emit pending alerts when story processing settles
    // This ensures notifications appear AFTER all triggering messages
    if (
      ctx.pendingAlerts?.length > 0 &&
      (snapshot.matches('idle') || snapshot.matches('waitingForInput'))
    ) {
      for (const alert of ctx.pendingAlerts) {
        this.dispatchEvent(new CustomEvent('notification', { detail: alert }));
        eventBus.emit(EVENTS.NOTIFICATION_SHOW, alert);
      }
      this.actor.send({ type: 'CLEAR_PENDING_ALERTS' });
    }

    // Typing indicator
    if (snapshot.matches('delaying') && ctx.targetChatId === currentChat) {
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
      eventBus.emit(EVENTS.TYPING_END, createTypingEndEvent(currentChat));
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
