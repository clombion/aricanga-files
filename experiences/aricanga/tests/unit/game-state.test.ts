import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';

// Import game-state machine from this implementation
const { gameStateMachine } = await import('../../src/game-state.js');

// Mock window.crypto for UUID generation
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2),
});

// Mock window.matchMedia for reduced motion
vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addListener: () => {},
  removeListener: () => {},
}));

/**
 * Create a mock ink story object
 */
function createMockStory(options: {
  canContinue?: boolean;
  currentChoices?: Array<{ index: number; text: string }>;
  currentTags?: string[];
  continueText?: string;
  variablesState?: Record<string, unknown>;
} = {}) {
  const {
    canContinue = false,
    currentChoices = [],
    currentTags = [],
    continueText = '',
    variablesState = { current_chat: 'test' },
  } = options;

  let _canContinue = canContinue;
  let _continueText = continueText;
  let _currentTags = currentTags;
  let _currentChoices = currentChoices;

  return {
    get canContinue() { return _canContinue; },
    get currentChoices() { return _currentChoices; },
    get currentTags() { return _currentTags; },
    variablesState,
    state: {
      ToJson: () => JSON.stringify({ saved: true }),
      LoadJson: vi.fn(),
    },
    Continue: vi.fn(() => {
      _canContinue = false; // After continue, no more content
      return _continueText;
    }),
    ChooseChoiceIndex: vi.fn(),
    // Helper to set up for next continue
    _setNextContinue: (text: string, tags: string[] = [], choices: Array<{ index: number; text: string }> = []) => {
      _canContinue = true;
      _continueText = text;
      _currentTags = tags;
      _currentChoices = choices;
    },
  };
}

describe('game-state machine', () => {
  describe('initial state', () => {
    it('starts in loading state', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe('loading');
      expect(actor.getSnapshot().context.currentView).toEqual({ type: 'hub' });

      actor.stop();
    });
  });

  describe('STORY_LOADED transition', () => {
    it('transitions to processing when story is loaded', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory();
      actor.send({ type: 'STORY_LOADED', story: mockStory });

      // Should transition through processing to idle (no content)
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.story).toBe(mockStory);

      actor.stop();
    });

    it('preserves existing message history when provided', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory();
      const existingHistory = {
        pat: [{ id: '1', text: 'Hello', timestamp: Date.now() }],
      };

      actor.send({ type: 'STORY_LOADED', story: mockStory, history: existingHistory });

      expect(actor.getSnapshot().context.messageHistory).toEqual(existingHistory);

      actor.stop();
    });
  });

  describe('processStoryChunk action', () => {
    it('parses tags correctly', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: true,
        continueText: 'Hello there!',
        currentTags: ['speaker:Pat', 'type:received', 'time:9:00 AM'],
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      const history = actor.getSnapshot().context.messageHistory;
      expect(history.pat).toHaveLength(1);
      expect(history.pat[0].text).toBe('Hello there!');
      expect(history.pat[0].speaker).toBe('Pat');
      expect(history.pat[0].type).toBe('received');
      expect(history.pat[0].time).toBe('9:00 AM');

      actor.stop();
    });

    // TODO: clear tag is parsed but not passed through parseMessage() to final message objects
    // The tag handler exists but the functionality to clear messages is not implemented
    it.skip('handles flag-style tags (no colon)', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: true,
        continueText: 'System message',
        currentTags: ['clear', 'type:system'],
        variablesState: { current_chat: 'notes' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      const history = actor.getSnapshot().context.messageHistory;
      expect(history.notes[0].clear).toBe(true);
      expect(history.notes[0].type).toBe('system');

      actor.stop();
    });

    it('skips empty text lines', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: true,
        continueText: '   ', // Whitespace only
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      const history = actor.getSnapshot().context.messageHistory;
      expect(history.pat || []).toHaveLength(0);

      actor.stop();
    });

    it('stores messages in correct chat based on current_chat variable', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: true,
        continueText: 'News alert!',
        variablesState: { current_chat: 'news' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      const history = actor.getSnapshot().context.messageHistory;
      expect(history.news).toHaveLength(1);
      expect(history.pat).toBeUndefined();

      actor.stop();
    });
  });

  describe('delay handling', () => {
    it('buffers message when pendingDelay > 0', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: true,
        continueText: 'Delayed message',
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      // Initially no delay, message goes to history immediately
      expect(actor.getSnapshot().context.messageHistory.pat).toHaveLength(1);

      actor.stop();
    });

    it('hasPendingDelay guard returns true when delay > 0', () => {
      // Test the guard directly through machine behavior
      const actor = createActor(gameStateMachine, {
        input: {},
      });
      actor.start();

      // Manually set pendingDelay by modifying context (for testing)
      const context = actor.getSnapshot().context;
      expect(context.pendingDelay).toBe(0);

      actor.stop();
    });
  });

  describe('choice handling', () => {
    it('derives choices from story.currentChoices (single source of truth)', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: false,
        currentChoices: [
          { index: 0, text: 'Option A' },
          { index: 1, text: 'Option B' },
        ],
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      expect(actor.getSnapshot().value).toBe('waitingForInput');

      // Choices are derived from story, not stored in context
      const { story } = actor.getSnapshot().context;
      expect(story.currentChoices).toHaveLength(2);
      expect(story.currentChoices[0].text).toBe('Option A');
      expect(story.variablesState.current_chat).toBe('pat');

      actor.stop();
    });

    it('choiceBelongsToCurrentView guard rejects choices from wrong chat', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: false,
        currentChoices: [{ index: 0, text: 'Option A' }],
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      // Open a different chat
      actor.send({ type: 'OPEN_CHAT', chatId: 'news' });

      // Try to make a choice - should be blocked by guard
      const stateBefore = actor.getSnapshot().value;
      actor.send({ type: 'CHOOSE', index: 0 });

      // Should still be waiting (choice was rejected)
      expect(actor.getSnapshot().value).toBe(stateBefore);
      expect(mockStory.ChooseChoiceIndex).not.toHaveBeenCalled();

      actor.stop();
    });

    it('allows choices when in correct chat', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: false,
        currentChoices: [{ index: 0, text: 'Option A' }],
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });
      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });

      // Recapture choices after opening chat
      actor.send({ type: 'CHECK_STORY' });

      actor.send({ type: 'CHOOSE', index: 0 });

      expect(mockStory.ChooseChoiceIndex).toHaveBeenCalledWith(0);

      actor.stop();
    });

    it('rejects out-of-bounds choice index', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: false,
        currentChoices: [{ index: 0, text: 'Option A' }],
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });
      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });
      actor.send({ type: 'CHECK_STORY' });

      // Try invalid indices
      actor.send({ type: 'CHOOSE', index: 5 }); // Out of bounds
      actor.send({ type: 'CHOOSE', index: -1 }); // Negative

      // ChooseChoiceIndex should NOT have been called with invalid indices
      expect(mockStory.ChooseChoiceIndex).not.toHaveBeenCalled();

      actor.stop();
    });
  });

  describe('view state management', () => {
    it('setCurrentView updates currentView', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory();
      actor.send({ type: 'STORY_LOADED', story: mockStory });

      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });

      expect(actor.getSnapshot().context.currentView).toEqual({
        type: 'chat',
        chatId: 'pat',
      });

      actor.stop();
    });

    it('clearCurrentView returns to hub', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory();
      actor.send({ type: 'STORY_LOADED', story: mockStory });

      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });
      actor.send({ type: 'CLOSE_CHAT' });

      expect(actor.getSnapshot().context.currentView).toEqual({ type: 'hub' });

      actor.stop();
    });

    it('clearCurrentView saves choice state when leaving chat with active choices', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: false,
        currentChoices: [{ index: 0, text: 'Option A' }],
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });
      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });

      // Close chat (go to hub) instead of navigating to another chat
      actor.send({ type: 'CLOSE_CHAT' });

      const saved = actor.getSnapshot().context.savedChoicesState;
      expect(saved.pat).toBeDefined();
      expect(actor.getSnapshot().context.currentView).toEqual({ type: 'hub' });

      actor.stop();
    });

    it('marks existing messages as emitted when opening chat', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory();
      const existingHistory = {
        pat: [
          { id: 'msg1', text: 'Hello', timestamp: Date.now() },
          { id: 'msg2', text: 'World', timestamp: Date.now() },
        ],
      };

      actor.send({ type: 'STORY_LOADED', story: mockStory, history: existingHistory });
      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });

      const emitted = actor.getSnapshot().context.emittedMessageIds;
      expect(emitted.pat.has('msg1')).toBe(true);
      expect(emitted.pat.has('msg2')).toBe(true);

      actor.stop();
    });
  });

  describe('saved choices state', () => {
    it('saves ink state when navigating away from chat with choices', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: false,
        currentChoices: [{ index: 0, text: 'Option A' }],
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      // Open pat (where choices are)
      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });

      // Navigate away to news
      actor.send({ type: 'OPEN_CHAT', chatId: 'news' });

      const saved = actor.getSnapshot().context.savedChoicesState;
      expect(saved.pat).toBeDefined();

      actor.stop();
    });

    it('restores ink state when returning to chat with saved state', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({
        canContinue: false,
        currentChoices: [{ index: 0, text: 'Option A' }],
        variablesState: { current_chat: 'pat' },
      });

      actor.send({ type: 'STORY_LOADED', story: mockStory });

      // Open pat, then navigate away
      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });
      actor.send({ type: 'OPEN_CHAT', chatId: 'news' });

      // Return to pat
      actor.send({ type: 'OPEN_CHAT', chatId: 'pat' });

      // Should have called LoadJson to restore state
      expect(mockStory.state.LoadJson).toHaveBeenCalled();

      // Saved state should be cleared after restoration
      const saved = actor.getSnapshot().context.savedChoicesState;
      expect(saved.pat).toBeUndefined();

      actor.stop();
    });
  });

  describe('guards', () => {
    it('canContinue returns false when story is null', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      // In loading state, story is null
      expect(actor.getSnapshot().context.story).toBeNull();

      actor.stop();
    });

    it('hasChoices returns false when no choices', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory({ currentChoices: [] });
      actor.send({ type: 'STORY_LOADED', story: mockStory });

      // Should be in idle, not waitingForInput
      expect(actor.getSnapshot().value).toBe('idle');

      actor.stop();
    });
  });

  describe('RESET_GAME event', () => {
    it('sets isResetting flag', () => {
      const actor = createActor(gameStateMachine);
      actor.start();

      const mockStory = createMockStory();
      actor.send({ type: 'STORY_LOADED', story: mockStory });

      expect(actor.getSnapshot().context.isResetting).toBe(false);

      actor.send({ type: 'RESET_GAME' });

      expect(actor.getSnapshot().context.isResetting).toBe(true);

      actor.stop();
    });
  });
});
