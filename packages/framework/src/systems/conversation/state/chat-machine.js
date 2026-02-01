// Chat State Machine - XState definition for conversation plugin
// Pure state transitions, guards, and actions. No DOM, no ink loading.

import {
  appendToHistory,
  extractCapturedState,
  generateId,
} from '../../../foundation/state/state-factory.js';
import {
  assign,
  createMachine,
  fromPromise,
} from '../../../vendor/xstate/dist/xstate.esm.js';
import { parseMessage } from '../types.js';
import {
  buildStatusMessage,
  extractStoryBoundary,
  getTargetChat,
  isDuplicateMessage,
  resolveDelay,
  shouldBufferMessage,
} from './chunk-helpers.js';

/**
 * Single receipt mutation point. Two modes:
 * - Auto: incomingType === 'received' → backward walk, last delivered→read
 * - Explicit: label + receipt → find by label across all chats
 * Returns { history, receiptChanged: { chatId, label, receipt } | null }
 */
function upgradeReceipt(history, { chatId, label, receipt, incomingType }) {
  // Mode A: explicit label+receipt
  if (label && receipt) {
    for (const [cid, msgs] of Object.entries(history)) {
      const idx = msgs.findIndex((m) => m.label === label);
      if (idx >= 0) {
        const updated = [...msgs];
        updated[idx] = { ...updated[idx], receipt };
        return {
          history: { ...history, [cid]: updated },
          receiptChanged: { chatId: cid, label, receipt },
        };
      }
    }
    return { history, receiptChanged: null };
  }

  // Mode B: auto-upgrade delivered→read when received message arrives
  if (incomingType !== 'received') return { history, receiptChanged: null };
  const chatMessages = history[chatId] || [];
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const msg = chatMessages[i];
    if (msg.type === 'sent' && msg.receipt === 'delivered') {
      const updated = [...chatMessages];
      updated[i] = { ...updated[i], receipt: 'read' };
      return {
        history: { ...history, [chatId]: updated },
        receiptChanged: { chatId, label: msg.label || msg.id, receipt: 'read' },
      };
    }
    if (msg.type === 'sent') break;
  }
  return { history, receiptChanged: null };
}

/**
 * appendToHistory + auto-upgrade receipts when a received message arrives.
 * Returns { history, receiptChanged } where receiptChanged is { chatId, label, receipt } | null.
 */
function appendAndUpgrade(history, chatId, message) {
  const appended = appendToHistory(history, chatId, message);
  return upgradeReceipt(appended, { chatId, incomingType: message.type });
}

/**
 * Upgrade receipts across an entire message history (e.g. seed loading).
 * Any sent message with 'delivered' that is followed by a received message
 * from the same chat gets upgraded to 'read'.
 */
function upgradeHistoryReceipts(history) {
  const result = {};
  for (const [chatId, msgs] of Object.entries(history)) {
    const updated = [...msgs];
    for (let i = 0; i < updated.length - 1; i++) {
      if (
        updated[i].type === 'sent' &&
        updated[i].receipt === 'delivered' &&
        updated[i + 1].type === 'received'
      ) {
        updated[i] = { ...updated[i], receipt: 'read' };
      }
    }
    result[chatId] = updated;
  }
  return result;
}

/**
 * Create the chat state machine
 * @param {Object} options
 * @param {function} options.parseTags - Tag parser function
 * @param {function} options.processMessageTime - Time processor function
 * @param {string[]} [options.knownChatIds] - List of valid chat IDs for validation
 * @param {function} [options.onStall] - Callback when story stalls unexpectedly
 * @param {string} [options.machineId='conversation'] - State machine ID
 * @returns {Object} XState machine config
 */
export function createChatMachine(options = {}) {
  const {
    parseTags,
    processMessageTime,
    knownChatIds = [],
    onStall,
    machineId = 'conversation',
  } = options;

  /**
   * Resolve quoteRef to a QuotedContent object from labeled messages registry
   * @param {string} quoteRef - Label ID to look up
   * @param {Object} labeledMessages - Registry of labeled messages
   * @returns {Object|undefined} QuotedContent or undefined if not found
   */
  function resolveQuoteRef(quoteRef, labeledMessages) {
    const quotedMsg = labeledMessages[quoteRef];
    if (!quotedMsg) {
      console.warn(`[quote] Label "${quoteRef}" not found in message registry`);
      return undefined;
    }

    // Build QuotedContent from the referenced message
    const quote = { speaker: quotedMsg.speaker };

    switch (quotedMsg.kind) {
      case 'text':
        quote.text = quotedMsg.text;
        break;
      case 'image':
        quote.imageSrc = quotedMsg.imageSrc;
        break;
      case 'audio':
        quote.audioTranscript = quotedMsg.transcript;
        break;
      case 'attachment':
        quote.text = quotedMsg.caption || quotedMsg.attachmentSrc;
        break;
    }

    return quote;
  }

  /**
   * Create a typed message using parseMessage with injected dependencies
   * @param {string} text - Message text
   * @param {Object} tags - Parsed tags
   * @param {boolean} storyStarted - Whether story has started
   * @param {Object} labeledMessages - Registry for quoteRef resolution
   */
  function createMessage(text, tags, storyStarted, labeledMessages = {}) {
    const time = processMessageTime
      ? processMessageTime(tags, false, storyStarted)
      : tags.time || null;

    // Resolve quoteRef to quote content if present
    const resolvedTags = { ...tags, time };
    if (tags.quoteRef && !tags.quote) {
      const quote = resolveQuoteRef(tags.quoteRef, labeledMessages);
      if (quote) {
        resolvedTags.quote = quote;
      }
    }

    const msg = parseMessage(text, resolvedTags);

    // Override ID with injected generator
    // Note: Seeds are now extracted at build time, not created at runtime
    return {
      ...msg,
      id: generateId(),
    };
  }

  /**
   * Create a status-only message using the helper
   */
  function createStatusMessage(tags) {
    return buildStatusMessage(tags, generateId);
  }

  return createMachine(
    {
      id: machineId,
      initial: 'loading',
      context: {
        story: null,

        // VIEW STATE - Single source of truth
        // { type: 'hub' } or { type: 'chat', chatId: string }
        currentView: { type: 'hub' },

        // Transient: receipt change signal (consumed by game controller each cycle)
        _receiptChanged: null,

        // MESSAGE STATE
        messageHistory: {},
        emittedMessageIds: {}, // { chatId: Set<msgId> } - O(1) lookup for deduplication

        // CHOICE STATE - ink story.currentChoices is authoritative
        savedChoicesState: {}, // { chatId: inkStateJson }

        // PROCESSING STATE
        bufferedMessage: null,
        pendingDelay: 0,
        targetChatId: null,
        isResetting: false,

        // STORY START BOUNDARY
        storyStartedThisRender: false,

        // QUOTE SUPPORT - Registry for labeled messages
        labeledMessages: {}, // { 'label-id': Message }

        // HIGH-WATER MARK STATE (for unread separator)
        lastReadMessageId: {}, // { chatId: messageId | null } - cursor for unread separator
        notifiedChatIds: new Set(), // Background chats that got a notification (cleared on open)
        deferredMessages: {}, // { chatId: Array<{ message, delay }> } - messages awaiting replay
      },

      // Global events available in all states
      on: {
        OPEN_CHAT: { actions: 'setCurrentView' },
        CLOSE_CHAT: { actions: 'clearCurrentView' },
        RESET_GAME: { actions: 'setResetting' },
        MARK_CHAT_NOTIFIED: { actions: 'markChatNotified' },
      },

      states: {
        loading: {
          on: {
            STORY_LOADED: { target: 'processing', actions: 'assignStory' },
          },
        },

        processing: {
          always: [
            { guard: 'hasPendingDelay', target: 'delaying' },
            { guard: 'isAwaitingData', target: 'awaitingData' },
            {
              guard: 'canContinue',
              actions: ['processStoryChunk'],
              target: 'processing',
            },
            {
              guard: 'hasChoices',
              target: 'waitingForInput',
              actions: 'captureTaggedChoices',
            },
            { target: 'idle', actions: 'checkForStall' },
          ],
        },

        awaitingData: {
          on: {
            DATA_READY: { target: 'processing' },
            CLOSE_CHAT: { target: 'idle', actions: 'clearCurrentView' },
          },
        },

        delaying: {
          entry: 'notifyTypingStart',
          on: {
            CLOSE_CHAT: {
              target: 'idle',
              actions: ['clearCurrentView', 'clearDelay', 'notifyTypingEnd'],
            },
            OPEN_CHAT: {
              target: 'processing',
              actions: ['setCurrentView', 'clearDelay', 'notifyTypingEnd'],
            },
          },
          invoke: {
            src: 'delayService',
            input: ({ context }) => ({ pendingDelay: context.pendingDelay }),
            onDone: {
              target: 'processing',
              actions: [
                'commitBufferedMessage',
                'clearDelay',
                'notifyTypingEnd',
              ],
            },
          },
        },

        waitingForInput: {
          on: {
            CHOOSE: {
              guard: 'choiceBelongsToCurrentView',
              target: 'processing',
              actions: 'makeChoice',
            },
            CHECK_STORY: { target: 'processing' },
          },
        },

        idle: {
          on: {
            CHECK_STORY: { target: 'processing' },
          },
        },
      },
    },
    {
      actions: {
        assignStory: assign({
          story: ({ event }) => event.story,
          messageHistory: ({ event }) =>
            upgradeHistoryReceipts(event.history || {}),
          emittedMessageIds: ({ event }) => {
            const history = event.history || {};
            const emitted = {};
            for (const [chatId, messages] of Object.entries(history)) {
              emitted[chatId] = new Set(messages.map((msg) => msg.id));
            }
            return emitted;
          },
          lastReadMessageId: ({ event }) => event.lastReadMessageId || {},
          deferredMessages: ({ event }) => event.deferredMessages || {},
          // Note: notifiedChatIds is NOT restored - intentional UX decision
          // On refresh, first new background message should notify again
        }),

        processStoryChunk: assign(({ context }) => {
          if (!context.story.canContinue) return context;

          // 1. Continue story and parse tags
          let text, tags;
          try {
            text = context.story.Continue().trim();
            tags = parseTags
              ? parseTags(context.story.currentTags)
              : context.story.currentTags.reduce((acc, t) => {
                  const [k, v] = t.split(':');
                  acc[k.trim()] = v?.trim() ?? true;
                  return acc;
                }, {});
          } catch (error) {
            console.error('Story processing error:', error);
            return context;
          }

          // 2. Extract captured state and routing info
          const { delay: capturedDelay } = extractCapturedState(context.story);
          // CQO-16: Defensive fallback if tags parsing failed
          const targetChat = getTargetChat(
            context.story,
            knownChatIds,
            tags || {},
          );

          // 3. Handle story boundary
          const { storyStarted, hasStoryStartTag } = extractStoryBoundary(
            tags,
            context.storyStartedThisRender,
          );

          // 3b. Handle deferred receipt update (# receipt:status:label)
          if (tags.receiptDeferred) {
            const { status, label } = tags.receiptDeferred;
            const { history: newHistory, receiptChanged } = upgradeReceipt(
              context.messageHistory,
              { label, receipt: status },
            );
            // Update labeled message registry (separate concern from history)
            const labeledMsg = context.labeledMessages[label];
            const newLabeledMsgs = labeledMsg
              ? {
                  ...context.labeledMessages,
                  [label]: { ...labeledMsg, receipt: status },
                }
              : context.labeledMessages;

            return {
              messageHistory: newHistory,
              labeledMessages: newLabeledMsgs,
              storyStartedThisRender: storyStarted,
              _receiptChanged: receiptChanged,
              ...(capturedDelay > 0 && { pendingDelay: capturedDelay }),
            };
          }

          // 4. Handle empty text (logic-only lines)
          if (!text) {
            if (hasStoryStartTag) {
              return {
                storyStartedThisRender: true,
                ...(capturedDelay > 0 && { pendingDelay: capturedDelay }),
              };
            }
            if (tags.status) {
              return {
                messageHistory: appendToHistory(
                  context.messageHistory,
                  targetChat,
                  createStatusMessage(tags),
                ),
                pendingDelay: capturedDelay,
                targetChatId: targetChat,
                storyStartedThisRender: storyStarted,
              };
            }
            if (capturedDelay > 0) {
              return {
                pendingDelay: capturedDelay,
                storyStartedThisRender: storyStarted,
              };
            }
            return { storyStartedThisRender: storyStarted };
          }

          // 4b. Skip ink-generated seeds when build seeds exist in history
          // Build seeds are loaded as initial history (with _isSeed: true).
          // Ink still processes the seed block, but we discard those messages.
          if (!storyStarted) {
            const existingHistory = context.messageHistory[targetChat] || [];
            if (existingHistory.some((m) => m._isSeed)) {
              return {
                storyStartedThisRender: storyStarted,
                ...(capturedDelay > 0 && { pendingDelay: capturedDelay }),
              };
            }
          }

          // 5. Create message and check for duplicates
          const message = createMessage(
            text,
            tags,
            storyStarted,
            context.labeledMessages,
          );
          const history = context.messageHistory[targetChat] || [];

          // 5a. Register labeled message for future quoteRef lookups
          let newLabeledMessages = context.labeledMessages;
          if (message.label) {
            newLabeledMessages = {
              ...context.labeledMessages,
              [message.label]: message,
            };
          }

          if (isDuplicateMessage(history, message)) {
            return {
              storyStartedThisRender: storyStarted,
              ...(capturedDelay > 0 && { pendingDelay: capturedDelay }),
            };
          }

          // 5b. Deferred message routing for background chats
          // CQO-16: Guard clause for uninitialized context
          const notifiedChatIds = context.notifiedChatIds ?? new Set();
          const deferredMessages = context.deferredMessages ?? {};

          const currentChatId = context.currentView?.chatId;
          // Only defer messages when user is IN a chat and message is for a DIFFERENT chat
          // When at hub, messages flow normally (no deferral)
          const isBackgroundChat =
            context.currentView?.type === 'chat' &&
            targetChat !== currentChatId;
          const alreadyNotified = notifiedChatIds.has(targetChat);
          const hasImmediateTag = tags.immediate === true;

          // # immediate tag acts as watermark: flush all deferred + current message
          if (hasImmediateTag && isBackgroundChat && alreadyNotified) {
            const existingDeferred = deferredMessages[targetChat] || [];
            let newHistory = context.messageHistory;
            let lastUpgraded = null;

            // Flush all deferred messages to history in order
            for (const item of existingDeferred) {
              const result = appendAndUpgrade(
                newHistory,
                targetChat,
                item.message,
              );
              newHistory = result.history;
              if (result.receiptChanged) lastUpgraded = result.receiptChanged;
            }
            // Add current message
            const finalResult = appendAndUpgrade(
              newHistory,
              targetChat,
              message,
            );
            newHistory = finalResult.history;
            if (finalResult.receiptChanged)
              lastUpgraded = finalResult.receiptChanged;

            return {
              messageHistory: newHistory,
              _receiptChanged: lastUpgraded || context._receiptChanged,
              deferredMessages: { ...deferredMessages, [targetChat]: [] },
              targetChatId: targetChat,
              storyStartedThisRender: storyStarted,
              labeledMessages: newLabeledMessages,
            };
          }

          // Subsequent background message (notified) without # immediate → defer
          if (isBackgroundChat && alreadyNotified) {
            const existingDeferred = deferredMessages[targetChat] || [];
            return {
              deferredMessages: {
                ...deferredMessages,
                [targetChat]: [
                  ...existingDeferred,
                  { message, delay: capturedDelay || 500 },
                ],
              },
              storyStartedThisRender: storyStarted,
              labeledMessages: newLabeledMessages,
            };
          }

          // 5c. First notification-triggering message sets lastReadMessageId for unread separator
          // This marks where "read" ends before new messages arrive
          // Note: This is different from isBackgroundChat - notifications fire from hub too
          const isNotCurrentChat = targetChat !== currentChatId;
          const willTriggerNotification = isNotCurrentChat && !alreadyNotified;
          let newLastReadMessageId = context.lastReadMessageId;
          if (willTriggerNotification) {
            const currentHistory = context.messageHistory[targetChat] || [];
            const lastMsg = currentHistory[currentHistory.length - 1];
            // Only set if not already set (preserve existing read position)
            // Use '__BEFORE_ALL__' sentinel when no messages exist yet
            if (!newLastReadMessageId[targetChat]) {
              newLastReadMessageId = {
                ...newLastReadMessageId,
                [targetChat]: lastMsg?.id || '__BEFORE_ALL__',
              };
            }
          }

          // 6. Buffer or commit message based on delay
          const totalDelay = resolveDelay(context.pendingDelay, capturedDelay);

          // DEBUG: Log cross-chat message routing
          if (targetChat !== context.currentView?.chatId && message.text) {
            console.log('[processStoryChunk] Cross-chat message:', {
              targetChat,
              currentView: context.currentView,
              text: message.text?.slice(0, 50),
              totalDelay,
              willBuffer: shouldBufferMessage(totalDelay),
            });
          }

          if (shouldBufferMessage(totalDelay)) {
            return {
              bufferedMessage: message,
              targetChatId: targetChat,
              pendingDelay: totalDelay,
              storyStartedThisRender: storyStarted,
              labeledMessages: newLabeledMessages,
              ...(willTriggerNotification && {
                lastReadMessageId: newLastReadMessageId,
              }),
            };
          }

          // Initialize emittedMessageIds for this chat if needed
          // (fixes duplicate emission bug when chat hasn't been opened yet)
          const needsEmittedInit = !context.emittedMessageIds[targetChat];

          const { history: newHist, receiptChanged } = appendAndUpgrade(
            context.messageHistory,
            targetChat,
            message,
          );

          return {
            messageHistory: newHist,
            _receiptChanged: receiptChanged || context._receiptChanged,
            targetChatId: targetChat,
            storyStartedThisRender: storyStarted,
            labeledMessages: newLabeledMessages,
            ...(willTriggerNotification && {
              lastReadMessageId: newLastReadMessageId,
            }),
            ...(needsEmittedInit && {
              emittedMessageIds: {
                ...context.emittedMessageIds,
                [targetChat]: new Set(),
              },
            }),
          };
        }),

        commitBufferedMessage: assign(({ context }) => {
          if (!context.bufferedMessage || !context.targetChatId) return context;
          const chatId = context.targetChatId;
          const history = context.messageHistory[chatId] || [];
          const message = context.bufferedMessage;

          if (isDuplicateMessage(history, message)) {
            return { bufferedMessage: null };
          }

          // Register labeled message when committing
          const newLabeledMessages = message.label
            ? { ...context.labeledMessages, [message.label]: message }
            : context.labeledMessages;

          // Chain deferred message replay: if more deferred messages for current chat, queue next
          const currentViewChatId = context.currentView?.chatId;
          const deferred = context.deferredMessages?.[currentViewChatId] ?? [];
          const nextDeferred = deferred[0] || null;

          // Initialize emittedMessageIds for this chat if needed
          // (fixes duplicate emission bug when chat hasn't been opened yet)
          const needsEmittedInit = !context.emittedMessageIds[chatId];

          const { history: commitHist, receiptChanged: commitChanged } =
            appendAndUpgrade(context.messageHistory, chatId, message);

          return {
            messageHistory: commitHist,
            _receiptChanged: commitChanged || context._receiptChanged,
            bufferedMessage: nextDeferred?.message || null,
            labeledMessages: newLabeledMessages,
            // Reset pendingDelay to prevent carry-over (task-062 fix)
            pendingDelay: nextDeferred?.delay || 0,
            // If chaining deferred replay, set target
            ...(nextDeferred && {
              targetChatId: currentViewChatId,
            }),
            // Remove chained message from deferred queue
            ...(nextDeferred && {
              deferredMessages: {
                ...context.deferredMessages,
                [currentViewChatId]: deferred.slice(1),
              },
            }),
            // Initialize emittedMessageIds for cross-chat recipients
            ...(needsEmittedInit && {
              emittedMessageIds: {
                ...context.emittedMessageIds,
                [chatId]: new Set(),
              },
            }),
          };
        }),

        clearDelay: assign({ pendingDelay: 0 }),

        makeChoice: ({ context, event }) => {
          const choices = context.story?.currentChoices || [];
          if (event.index < 0 || event.index >= choices.length) {
            console.warn(
              `Invalid choice index: ${event.index} (${choices.length} choices available)`,
            );
            return;
          }
          context.story.ChooseChoiceIndex(event.index);
        },

        notifyTypingStart: () => {},
        notifyTypingEnd: () => {},
        captureTaggedChoices: () => {},

        setCurrentView: assign(({ context, event }) => {
          const chatId = event.chatId;
          // CQO-16: Guard clause for missing chatId
          if (!chatId) return context;

          const story = context.story;

          // Task-062 fix: If buffered message is for THIS chat, commit immediately
          // This ensures HWM separator can render (message needs to be in history)
          let historyToUse = context.messageHistory;
          let clearedBuffer = false;
          let newLabeledMessages = context.labeledMessages;
          let openUpgraded = null;

          if (
            context.bufferedMessage &&
            context.targetChatId === chatId &&
            !isDuplicateMessage(
              context.messageHistory[chatId] || [],
              context.bufferedMessage,
            )
          ) {
            const openResult = appendAndUpgrade(
              context.messageHistory,
              chatId,
              context.bufferedMessage,
            );
            historyToUse = openResult.history;
            openUpgraded = openResult.receiptChanged;
            clearedBuffer = true;

            // Register labeled message if present
            if (context.bufferedMessage.label) {
              newLabeledMessages = {
                ...context.labeledMessages,
                [context.bufferedMessage.label]: context.bufferedMessage,
              };
            }
          }

          const history = historyToUse[chatId] || [];

          const existingEmitted =
            context.emittedMessageIds[chatId] || new Set();
          const newEmitted = new Set(existingEmitted);
          for (const msg of history) {
            newEmitted.add(msg.id);
          }

          const newSavedChoicesState = { ...context.savedChoicesState };

          if (story) {
            const currentStoryChat = getTargetChat(story, knownChatIds);
            const hasCurrentChoices = story.currentChoices.length > 0;

            if (
              hasCurrentChoices &&
              currentStoryChat &&
              currentStoryChat !== chatId
            ) {
              newSavedChoicesState[currentStoryChat] = story.state.ToJson();
            }

            if (newSavedChoicesState[chatId]) {
              story.state.LoadJson(newSavedChoicesState[chatId]);
              delete newSavedChoicesState[chatId];
            }
          }

          // Deferred message replay: queue first message for typing animation
          const deferred = context.deferredMessages?.[chatId] ?? [];
          const firstDeferred = deferred[0] || null;

          // Remove opened chat from notifiedChatIds (allow future notifications)
          const newNotifiedChatIds = new Set(context.notifiedChatIds);
          newNotifiedChatIds.delete(chatId);

          // Update lastReadMessageId for PREVIOUS chat (if switching between chats)
          // This ensures the read position is saved when navigating chat-to-chat
          const prevChatId = context.currentView?.chatId;
          const prevMessages = context.messageHistory[prevChatId] || [];
          const prevLastMsg = prevMessages[prevMessages.length - 1];
          const newLastReadMessageId = {
            ...context.lastReadMessageId,
            ...(prevChatId &&
              prevChatId !== chatId && {
                [prevChatId]: prevLastMsg?.id || null,
              }),
          };

          return {
            currentView: { type: 'chat', chatId },
            lastReadMessageId: newLastReadMessageId,
            emittedMessageIds: {
              ...context.emittedMessageIds,
              [chatId]: newEmitted,
            },
            savedChoicesState: newSavedChoicesState,
            storyStartedThisRender: false,
            notifiedChatIds: newNotifiedChatIds,
            // If buffer was cleared on open, update history and clear buffer state
            ...(clearedBuffer && {
              messageHistory: historyToUse,
              bufferedMessage: null,
              pendingDelay: 0,
              labeledMessages: newLabeledMessages,
              ...(openUpgraded && { _receiptChanged: openUpgraded }),
            }),
            // Queue first deferred message for replay (if any) - only if buffer wasn't just cleared
            ...(!clearedBuffer &&
              firstDeferred && {
                bufferedMessage: firstDeferred.message,
                pendingDelay: firstDeferred.delay || 500, // Min delay for typing indicator
                targetChatId: chatId,
              }),
            // Remove first deferred message, keep rest for subsequent replays
            deferredMessages: {
              ...context.deferredMessages,
              [chatId]: deferred.slice(1),
            },
          };
        }),

        clearCurrentView: assign(({ context }) => {
          const chatId = context.currentView?.chatId;
          const messages = context.messageHistory[chatId] || [];
          const lastMsg = messages[messages.length - 1];

          // Save ink choice state when leaving a chat with active choices
          const story = context.story;
          const newSavedChoicesState = { ...context.savedChoicesState };
          if (story && story.currentChoices.length > 0 && chatId) {
            newSavedChoicesState[chatId] = story.state.ToJson();
          }

          return {
            currentView: { type: 'hub' },
            savedChoicesState: newSavedChoicesState,
            lastReadMessageId: {
              ...context.lastReadMessageId,
              ...(chatId && { [chatId]: lastMsg?.id || null }),
            },
          };
        }),

        setResetting: assign({ isResetting: true }),

        markChatNotified: assign(({ context, event }) => {
          const chatId = event.chatId;
          if (!chatId) return context;
          const newNotifiedChatIds = new Set(context.notifiedChatIds);
          newNotifiedChatIds.add(chatId);
          return { notifiedChatIds: newNotifiedChatIds };
        }),

        checkForStall: ({ context }) => {
          const story = context.story;
          if (!story) return;

          // Only check when story truly stopped
          if (story.canContinue || story.currentChoices.length > 0) return;

          const path = story.state.currentPathString;
          if (!path) return;

          const visits = story.state.VisitCountAtPathString(path);
          const turn = story.state.currentTurnIndex;

          // Detect unexpected stops
          const isUnexpectedLocation =
            !path.includes('ending') && !path.includes('_done');
          if (visits > 10 || (turn > 100 && isUnexpectedLocation)) {
            const stallInfo = {
              path,
              visits,
              turn,
              hint:
                visits > 10
                  ? 'High visit count suggests loop behavior'
                  : 'High turn count at non-ending location',
            };
            console.warn(
              '[conversation] Story stopped unexpectedly:',
              stallInfo,
            );
            if (onStall) {
              onStall(stallInfo);
            }
          }
        },
      },

      guards: {
        canContinue: ({ context }) => context.story?.canContinue,
        hasChoices: ({ context }) => context.story?.currentChoices?.length > 0,
        hasPendingDelay: ({ context }) => context.pendingDelay > 0,
        isAwaitingData: ({ context }) => context.story?._awaitingData === true,

        choiceBelongsToCurrentView: ({ context }) => {
          const view = context.currentView;
          if (view.type !== 'chat') return false;

          const story = context.story;
          if (!story || story.currentChoices.length === 0) return false;

          return getTargetChat(story, knownChatIds) === view.chatId;
        },
      },

      actors: {
        delayService: fromPromise(({ input }) => {
          const ms = input.pendingDelay;
          const prefersReduced = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
          ).matches;
          return new Promise((resolve) => {
            setTimeout(resolve, prefersReduced ? 0 : ms);
          });
        }),
      },
    },
  );
}

// Backwards compatibility: export factory under new name
export { createChatMachine as createConversationMachine };

// Export default machine with standard parsers
// This will be configured with proper parsers when plugin initializes
export const chatStateMachine = createChatMachine();
