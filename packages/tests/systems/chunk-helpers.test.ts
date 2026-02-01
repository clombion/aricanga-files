import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDuplicateMessage,
  extractStoryBoundary,
  buildStatusMessage,
  resolveDelay,
  shouldBufferMessage,
  validateTargetChat,
  getTargetChat,
} from '../../framework/src/systems/conversation/state/chunk-helpers.js';

describe('chunk-helpers', () => {
  describe('isDuplicateMessage', () => {
    it('returns false for empty history', () => {
      const msg = { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text' };
      expect(isDuplicateMessage([], msg)).toBe(false);
      expect(isDuplicateMessage(null, msg)).toBe(false);
      expect(isDuplicateMessage(undefined, msg)).toBe(false);
    });

    it('returns true for exact duplicate', () => {
      const history = [
        { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text', id: '1' },
      ];
      const msg = { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text' };
      expect(isDuplicateMessage(history, msg)).toBe(true);
    });

    it('returns false for different text', () => {
      const history = [
        { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text', id: '1' },
      ];
      const msg = { text: 'Hi there', speaker: 'Pat', type: 'received', kind: 'text' };
      expect(isDuplicateMessage(history, msg)).toBe(false);
    });

    it('returns false for different speaker', () => {
      const history = [
        { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text', id: '1' },
      ];
      const msg = { text: 'Hello', speaker: 'News', type: 'received', kind: 'text' };
      expect(isDuplicateMessage(history, msg)).toBe(false);
    });

    it('returns false for different type', () => {
      const history = [
        { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text', id: '1' },
      ];
      const msg = { text: 'Hello', speaker: 'Pat', type: 'sent', kind: 'text' };
      expect(isDuplicateMessage(history, msg)).toBe(false);
    });

    it('only checks last 10 messages', () => {
      const history = Array.from({ length: 15 }, (_, i) => ({
        text: `Message ${i}`,
        speaker: 'Pat',
        type: 'received',
        kind: 'text',
        id: String(i),
      }));
      // First message is outside the 10-message window
      const oldMsg = { text: 'Message 0', speaker: 'Pat', type: 'received', kind: 'text' };
      expect(isDuplicateMessage(history, oldMsg)).toBe(false);

      // Recent message is within window
      const recentMsg = { text: 'Message 12', speaker: 'Pat', type: 'received', kind: 'text' };
      expect(isDuplicateMessage(history, recentMsg)).toBe(true);
    });
  });

  describe('extractStoryBoundary', () => {
    it('returns storyStarted false when not started and no tag', () => {
      const result = extractStoryBoundary({}, false);
      expect(result.storyStarted).toBe(false);
      expect(result.isSeed).toBe(true);
      expect(result.hasStoryStartTag).toBe(false);
    });

    it('returns storyStarted true when tag present', () => {
      const result = extractStoryBoundary({ story_start: true }, false);
      expect(result.storyStarted).toBe(true);
      expect(result.isSeed).toBe(false);
      expect(result.hasStoryStartTag).toBe(true);
    });

    it('returns storyStarted true when already started', () => {
      const result = extractStoryBoundary({}, true);
      expect(result.storyStarted).toBe(true);
      expect(result.isSeed).toBe(false);
      expect(result.hasStoryStartTag).toBe(false);
    });

    it('handles story_start with empty value', () => {
      const result = extractStoryBoundary({ story_start: '' }, false);
      expect(result.storyStarted).toBe(true);
      expect(result.hasStoryStartTag).toBe(true);
    });
  });

  describe('buildStatusMessage', () => {
    const mockGenerateId = vi.fn(() => 'status-id-456');

    it('builds status-only message', () => {
      const msg = buildStatusMessage({ status: 'online', presence: 'typing' }, mockGenerateId);

      expect(msg.status).toBe('online');
      expect(msg.presence).toBe('typing');
      expect(msg.id).toBe('status-id-456');
      expect(msg._statusOnly).toBe(true);
      expect(msg.timestamp).toBeDefined();
    });
  });

  describe('resolveDelay', () => {
    it('adds accumulated and captured delays', () => {
      expect(resolveDelay(100, 200)).toBe(300);
    });

    it('handles zero delays', () => {
      expect(resolveDelay(0, 0)).toBe(0);
      expect(resolveDelay(100, 0)).toBe(100);
      expect(resolveDelay(0, 200)).toBe(200);
    });

    it('handles undefined/null delays', () => {
      expect(resolveDelay(undefined, 200)).toBe(200);
      expect(resolveDelay(100, undefined)).toBe(100);
      expect(resolveDelay(null, null)).toBe(0);
    });
  });

  describe('shouldBufferMessage', () => {
    it('returns true for positive delays', () => {
      expect(shouldBufferMessage(100)).toBe(true);
      expect(shouldBufferMessage(1)).toBe(true);
    });

    it('returns false for zero or negative', () => {
      expect(shouldBufferMessage(0)).toBe(false);
      expect(shouldBufferMessage(-100)).toBe(false);
    });
  });

  describe('validateTargetChat', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('returns chatId when valid', () => {
      expect(validateTargetChat('pat')).toBe('pat');
      expect(validateTargetChat('news', ['pat', 'news'])).toBe('news');
    });

    it('returns unknown for null/undefined', () => {
      expect(validateTargetChat(null)).toBe('unknown');
      expect(validateTargetChat(undefined)).toBe('unknown');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('returns unknown for non-string', () => {
      expect(validateTargetChat(123 as any)).toBe('unknown');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('warns when chatId not in known list', () => {
      const result = validateTargetChat('unknown-chat', ['pat', 'news']);
      expect(result).toBe('unknown-chat'); // Still returns it
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not in known chats')
      );
    });

    it('does not warn when knownChatIds is empty', () => {
      validateTargetChat('any-chat', []);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('getTargetChat', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('extracts current_chat from story', () => {
      const mockStory = {
        variablesState: { current_chat: 'pat' },
      };
      expect(getTargetChat(mockStory)).toBe('pat');
    });

    it('returns unknown for missing current_chat', () => {
      const mockStory = { variablesState: {} };
      expect(getTargetChat(mockStory)).toBe('unknown');
    });

    it('validates against known chat IDs', () => {
      const mockStory = {
        variablesState: { current_chat: 'invalid' },
      };
      getTargetChat(mockStory, ['pat', 'news']);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not in known chats')
      );
    });
  });

});
