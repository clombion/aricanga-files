/**
 * Unit tests for chunk-helpers.js
 *
 * Tests the pure functions used for story chunk processing
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isDuplicateMessage,
  extractStoryBoundary,
  buildStatusMessage,
  resolveDelay,
  shouldBufferMessage,
  validateTargetChat,
  getTargetChat,
} from '../../framework/src/systems/conversation/state/chunk-helpers.js';

describe('isDuplicateMessage', () => {
  it('returns false for empty history', () => {
    expect(isDuplicateMessage([], { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text' })).toBe(false);
    expect(isDuplicateMessage(null, { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text' })).toBe(false);
  });

  it('returns false when no match found', () => {
    const history = [
      { text: 'Hi', speaker: 'Pat', type: 'received', kind: 'text' },
      { text: 'Hello', speaker: 'System', type: 'received', kind: 'text' },
    ];
    expect(isDuplicateMessage(history, { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text' })).toBe(false);
  });

  it('returns true when exact match exists in recent history', () => {
    const history = [
      { text: 'Hi', speaker: 'Pat', type: 'received', kind: 'text' },
      { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text' },
    ];
    expect(isDuplicateMessage(history, { text: 'Hello', speaker: 'Pat', type: 'received', kind: 'text' })).toBe(true);
  });

  it('only checks last 10 messages for efficiency', () => {
    const history = Array(15).fill(null).map((_, i) => ({
      text: `Message ${i}`,
      speaker: 'Pat',
      type: 'received',
      kind: 'text',
    }));
    // Message at index 0 (oldest) should not be found
    expect(isDuplicateMessage(history, { text: 'Message 0', speaker: 'Pat', type: 'received', kind: 'text' })).toBe(false);
    // Message at index 14 (newest) should be found
    expect(isDuplicateMessage(history, { text: 'Message 14', speaker: 'Pat', type: 'received', kind: 'text' })).toBe(true);
  });
});

describe('extractStoryBoundary', () => {
  it('returns storyStarted=false and isSeed=true before story_start', () => {
    const result = extractStoryBoundary({}, false);
    expect(result.storyStarted).toBe(false);
    expect(result.isSeed).toBe(true);
    expect(result.hasStoryStartTag).toBe(false);
  });

  it('detects story_start tag', () => {
    const result = extractStoryBoundary({ story_start: true }, false);
    expect(result.storyStarted).toBe(true);
    expect(result.isSeed).toBe(false);
    expect(result.hasStoryStartTag).toBe(true);
  });

  it('maintains storyStarted state', () => {
    const result = extractStoryBoundary({}, true);
    expect(result.storyStarted).toBe(true);
    expect(result.isSeed).toBe(false);
    expect(result.hasStoryStartTag).toBe(false);
  });
});

describe('buildStatusMessage', () => {
  it('creates status-only message', () => {
    const generateId = vi.fn().mockReturnValue('status-123');
    const tags = { typing: true };

    const result = buildStatusMessage(tags, generateId);

    expect(result.typing).toBe(true);
    expect(result.id).toBe('status-123');
    expect(result.timestamp).toBeDefined();
    expect(result._statusOnly).toBe(true);
  });
});

describe('resolveDelay', () => {
  it('adds accumulated and captured delays', () => {
    expect(resolveDelay(100, 200)).toBe(300);
    expect(resolveDelay(0, 500)).toBe(500);
    expect(resolveDelay(500, 0)).toBe(500);
  });

  it('handles null/undefined values', () => {
    expect(resolveDelay(null, 100)).toBe(100);
    expect(resolveDelay(100, undefined)).toBe(100);
    expect(resolveDelay(null, null)).toBe(0);
  });
});

describe('shouldBufferMessage', () => {
  it('returns true for positive delays', () => {
    expect(shouldBufferMessage(100)).toBe(true);
    expect(shouldBufferMessage(1)).toBe(true);
  });

  it('returns false for zero or no delay', () => {
    expect(shouldBufferMessage(0)).toBe(false);
  });
});

describe('validateTargetChat', () => {
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('returns valid chat ID unchanged', () => {
    expect(validateTargetChat('pat_chat', ['pat_chat', 'news_chat'])).toBe('pat_chat');
  });

  it('logs warning and returns "unknown" for invalid chat ID', () => {
    const result = validateTargetChat(null, []);
    expect(result).toBe('unknown');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('logs warning for unknown chat ID when knownChatIds provided', () => {
    consoleSpy.mockClear();
    const result = validateTargetChat('unknown_chat', ['pat_chat', 'news_chat']);
    expect(result).toBe('unknown_chat');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('does not warn when knownChatIds is empty', () => {
    consoleSpy.mockClear();
    const result = validateTargetChat('any_chat', []);
    expect(result).toBe('any_chat');
    // First warn is for invalid ID check, second would be for unknown
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});

describe('getTargetChat', () => {
  it('extracts chat ID from story variables', () => {
    const mockStory = {
      variablesState: {
        current_chat: 'pat_chat',
      },
    };
    expect(getTargetChat(mockStory, ['pat_chat'])).toBe('pat_chat');
  });

  it('handles missing story or variables', () => {
    expect(getTargetChat(null, [])).toBe('unknown');
    expect(getTargetChat({}, [])).toBe('unknown');
    expect(getTargetChat({ variablesState: {} }, [])).toBe('unknown');
  });

  it('uses targetChat tag override when present', () => {
    const mockStory = { variablesState: { current_chat: 'news' } };
    const tags = { targetChat: 'pat' };
    expect(getTargetChat(mockStory, ['pat', 'news'], tags)).toBe('pat');
  });

  it('falls back to current_chat when no targetChat tag', () => {
    const mockStory = { variablesState: { current_chat: 'news' } };
    expect(getTargetChat(mockStory, ['news'], {})).toBe('news');
  });

  it('handles undefined tags parameter', () => {
    const mockStory = { variablesState: { current_chat: 'news' } };
    expect(getTargetChat(mockStory, ['news'], undefined)).toBe('news');
  });
});

