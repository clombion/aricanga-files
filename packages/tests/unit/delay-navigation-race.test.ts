/**
 * Regression test: CLOSE_CHAT during delaying state must cancel pending story processing.
 *
 * Without the fix, the invoked delayService setTimeout survives navigation events,
 * causing story.Continue() to advance past saved choice state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatMachine } from '../../framework/src/systems/conversation/state/chat-machine.js';
import { createActor } from '../../framework/src/vendor/xstate/dist/xstate.esm.js';

// Simple tag parser (reused pattern from quote-tags.test.ts)
function parseTags(tags: string[]) {
  const result: Record<string, unknown> = {};
  for (const tag of tags) {
    const colonIdx = tag.indexOf(':');
    if (colonIdx > -1) {
      const key = tag.slice(0, colonIdx).trim();
      const value = tag.slice(colonIdx + 1).trim();
      result[key] = value;
    } else {
      result[tag.trim()] = true;
    }
  }
  return result;
}

function createMockStory(
  chunks: Array<{ text: string; tags: string[]; capturedDelay?: number }>,
) {
  let index = 0;
  const story = {
    canContinue: true,
    currentChoices: [] as any[],
    currentTags: [] as string[],
    variablesState: { current_chat: 'chat_a' },
    _capturedDelay: 0,
    state: {
      currentPathString: 'test.path',
      VisitCountAtPathString: () => 1,
      currentTurnIndex: 1,
    },
    Continue: null as any,
  };

  const continueSpy = vi.fn(() => {
    if (index >= chunks.length) {
      story.canContinue = false;
      return '';
    }
    const chunk = chunks[index++];
    story.currentTags = chunk.tags;
    story._capturedDelay = chunk.capturedDelay || 0;
    if (index >= chunks.length) {
      story.canContinue = false;
    }
    return chunk.text;
  });

  story.Continue = continueSpy;
  return story;
}

describe('delay-navigation race condition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock matchMedia for any component that checks reduced-motion
    if (typeof globalThis.window === 'undefined') {
      (globalThis as any).window = {};
    }
    (globalThis as any).window.matchMedia =
      (globalThis as any).window.matchMedia ||
      (() => ({ matches: false, addEventListener: () => {} }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('CLOSE_CHAT during delaying state cancels pending story processing', () => {
    const mockStory = createMockStory([
      { text: 'First message', tags: ['speaker:Pat'] },
      { text: 'Delayed message', tags: ['speaker:Pat'], capturedDelay: 500 },
      { text: 'Should not appear', tags: ['speaker:Pat'] },
    ]);

    const machine = createChatMachine({
      parseTags,
      knownChatIds: ['chat_a', 'chat_b'],
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'STORY_LOADED', story: mockStory });

    // After processing chunk 1 and hitting delay on chunk 2, machine enters delaying
    const snap1 = actor.getSnapshot();
    expect(snap1.value).toBe('delaying');

    // Record how many times Continue was called before navigation
    const callsBefore = mockStory.Continue.mock.calls.length;

    // User navigates away
    actor.send({ type: 'CLOSE_CHAT' });

    // Timer fires — should be a no-op because delaying was exited
    vi.advanceTimersByTime(600);

    const snap2 = actor.getSnapshot();

    // Should be idle, not processing
    expect(snap2.value).toBe('idle');

    // Continue() should NOT have been called again after CLOSE_CHAT
    expect(mockStory.Continue.mock.calls.length).toBe(callsBefore);

    actor.stop();
  });

  it('OPEN_CHAT during delaying state transitions to processing', () => {
    const mockStory = createMockStory([
      { text: 'First message', tags: ['speaker:Pat'] },
      { text: 'Delayed message', tags: ['speaker:Pat'], capturedDelay: 500 },
      { text: 'Third message', tags: ['speaker:Pat'] },
    ]);

    const machine = createChatMachine({
      parseTags,
      knownChatIds: ['chat_a', 'chat_b'],
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'STORY_LOADED', story: mockStory });

    expect(actor.getSnapshot().value).toBe('delaying');

    // Open a different chat — should cancel delay and go to processing
    actor.send({ type: 'OPEN_CHAT', chatId: 'chat_b' });

    // The delay timer should not cause duplicate transitions
    vi.advanceTimersByTime(600);

    const snap = actor.getSnapshot();
    // Machine should have processed through to a terminal state (idle or waitingForInput)
    expect(['idle', 'waitingForInput']).toContain(snap.value);

    actor.stop();
  });
});
