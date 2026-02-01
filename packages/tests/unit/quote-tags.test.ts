/**
 * Unit tests for quote-related tag handlers and registry
 *
 * Tests the tag handlers for label, quoteRef, and inline quote tags,
 * plus the labeled message registry in chat-machine.
 */

import { describe, it, expect, vi } from 'vitest';
import { tagHandlers } from '../../framework/src/systems/conversation/tags/index.js';
import { createChatMachine } from '../../framework/src/systems/conversation/state/chat-machine.js';
import { createActor } from '../../framework/src/vendor/xstate/dist/xstate.esm.js';

// Helper to find a handler by tag name
function getHandler(tagName: string) {
  const entry = tagHandlers.find((h) => h.tag === tagName);
  if (!entry) throw new Error(`No handler for tag: ${tagName}`);
  return entry.handler;
}

describe('quote tag handlers', () => {
  describe('label tag', () => {
    it('returns label value', () => {
      const handler = getHandler('label');
      const result = handler('greeting-1', {});
      expect(result).toEqual({ label: 'greeting-1' });
    });

    it('preserves existing context', () => {
      const handler = getHandler('label');
      const result = handler('msg-2', { speaker: 'Pat' });
      expect(result).toEqual({ label: 'msg-2' });
    });
  });

  describe('quoteRef tag', () => {
    it('returns quoteRef value for registry lookup', () => {
      const handler = getHandler('quoteRef');
      const result = handler('greeting-1', {});
      expect(result).toEqual({ quoteRef: 'greeting-1' });
    });
  });

  describe('inline quote tags', () => {
    it('quote tag creates quote.text', () => {
      const handler = getHandler('quote');
      const result = handler('Original message text', {});
      expect(result).toEqual({ quote: { text: 'Original message text' } });
    });

    it('quoteFrom tag creates quote.speaker', () => {
      const handler = getHandler('quoteFrom');
      const result = handler('Pat', {});
      expect(result).toEqual({ quote: { speaker: 'Pat' } });
    });

    it('quoteImage tag creates quote.imageSrc', () => {
      const handler = getHandler('quoteImage');
      const result = handler('assets/chart.png', {});
      expect(result).toEqual({ quote: { imageSrc: 'assets/chart.png' } });
    });

    it('quoteAudio tag creates quote.audioTranscript', () => {
      const handler = getHandler('quoteAudio');
      const result = handler('Voice memo transcript', {});
      expect(result).toEqual({
        quote: { audioTranscript: 'Voice memo transcript' },
      });
    });

    it('quote tags accumulate into single quote object', () => {
      // Simulate parsing multiple tags in sequence
      const quoteHandler = getHandler('quote');
      const quoteFromHandler = getHandler('quoteFrom');

      // First tag creates quote object
      let context = {};
      const result1 = quoteHandler('Hello there', context);
      context = { ...context, ...result1 };

      // Second tag adds to existing quote
      const result2 = quoteFromHandler('Spectre', context);

      expect(result2.quote).toEqual({
        text: 'Hello there',
        speaker: 'Spectre',
      });
    });

    it('quoteImage and quoteFrom accumulate correctly', () => {
      const imageHandler = getHandler('quoteImage');
      const fromHandler = getHandler('quoteFrom');

      let context = {};
      const result1 = imageHandler('/photo.jpg', context);
      context = { ...context, ...result1 };

      const result2 = fromHandler('Editor', context);

      expect(result2.quote).toEqual({
        imageSrc: '/photo.jpg',
        speaker: 'Editor',
      });
    });
  });
});

describe('labeled message registry', () => {
  // Simple tag parser for testing
  function parseTags(tags: string[]) {
    const result: Record<string, unknown> = {};
    for (const tag of tags) {
      const colonIdx = tag.indexOf(':');
      if (colonIdx > -1) {
        const key = tag.slice(0, colonIdx).trim();
        const value = tag.slice(colonIdx + 1).trim();
        // Handle quote accumulation
        if (
          key === 'quote' ||
          key === 'quoteFrom' ||
          key === 'quoteImage' ||
          key === 'quoteAudio'
        ) {
          const quote = (result.quote as Record<string, string>) || {};
          if (key === 'quote') quote.text = value;
          if (key === 'quoteFrom') quote.speaker = value;
          if (key === 'quoteImage') quote.imageSrc = value;
          if (key === 'quoteAudio') quote.audioTranscript = value;
          result.quote = quote;
        } else {
          result[key] = value;
        }
      } else {
        result[tag.trim()] = true;
      }
    }
    return result;
  }

  // Mock story that returns controlled content
  function createMockStory(chunks: Array<{ text: string; tags: string[] }>) {
    let index = 0;
    return {
      canContinue: true,
      currentChoices: [],
      currentTags: [] as string[],
      variablesState: { current_chat: 'test_chat' },
      state: {
        currentPathString: 'test.path',
        VisitCountAtPathString: () => 1,
        currentTurnIndex: 1,
      },
      Continue() {
        if (index >= chunks.length) {
          this.canContinue = false;
          return '';
        }
        const chunk = chunks[index++];
        this.currentTags = chunk.tags;
        if (index >= chunks.length) {
          this.canContinue = false;
        }
        return chunk.text;
      },
    };
  }

  it('stores labeled messages in registry', () => {
    const machine = createChatMachine({
      parseTags,
      knownChatIds: ['test_chat'],
    });

    const mockStory = createMockStory([
      { text: 'First message', tags: ['speaker:Pat', 'label:msg-1'] },
    ]);

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'STORY_LOADED', story: mockStory });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.labeledMessages).toHaveProperty('msg-1');
    expect(snapshot.context.labeledMessages['msg-1'].text).toBe('First message');
  });

  it('resolves quoteRef from registry', () => {
    const machine = createChatMachine({
      parseTags,
      knownChatIds: ['test_chat'],
    });

    const mockStory = createMockStory([
      { text: 'Original message', tags: ['speaker:Pat', 'label:original'] },
      { text: 'Reply message', tags: ['type:sent', 'quoteRef:original'] },
    ]);

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'STORY_LOADED', story: mockStory });

    const snapshot = actor.getSnapshot();
    const messages = snapshot.context.messageHistory.test_chat || [];

    // Find the reply message
    const reply = messages.find((m: { text?: string }) => m.text === 'Reply message');
    expect(reply).toBeDefined();
    expect(reply.quote).toEqual({
      speaker: 'Pat',
      text: 'Original message',
    });
  });

  it('handles missing quoteRef gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const machine = createChatMachine({
      parseTags,
      knownChatIds: ['test_chat'],
    });

    const mockStory = createMockStory([
      { text: 'Reply to nothing', tags: ['type:sent', 'quoteRef:nonexistent'] },
    ]);

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: 'STORY_LOADED', story: mockStory });

    const snapshot = actor.getSnapshot();
    const messages = snapshot.context.messageHistory.test_chat || [];

    // Message should exist but without quote
    const msg = messages.find((m: { text?: string }) => m.text === 'Reply to nothing');
    expect(msg).toBeDefined();
    expect(msg.quote).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('nonexistent'),
    );

    warnSpy.mockRestore();
  });
});
